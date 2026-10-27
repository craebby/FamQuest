"""Mealie im Elternbereich verbinden und Mealie-Rezepte im Essensplan (siehe app/mealie.py).

Einrichten (Modus, Adresse, API-Token) braucht die Eltern-PIN; der Token wird verschlüsselt
gespeichert und nie wieder ausgegeben. Alles andere geht wie der Essensplan ohne PIN.
"""

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Response, status
from pydantic import AfterValidator, BaseModel, StringConstraints
from pydantic_core import PydanticCustomError
from sqlalchemy import func, select

from app import mealie
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.crypto import encrypt
from app.demo_mode import NotInDemo
from app.errors import ApiError
from app.models import MealieRecipe

router = APIRouter(prefix="/mealie", tags=["mealie"])


def _url(value: str) -> str:
    value = value.rstrip("/")
    if not value.startswith(("http://", "https://")) or " " in value or len(value) < 10:
        raise PydanticCustomError("validation.invalid_url", "invalid url")
    return value


Url = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=300),
    AfterValidator(_url),
]
Token = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class MealieOut(BaseModel):
    mode: mealie.Mode
    url: str | None
    # Ein API-Token ist gespeichert (er selbst wird nie ausgegeben).
    has_token: bool
    # Lässt sich ein Token speichern (TOKEN_ENCRYPTION_KEY gesetzt)?
    can_store_token: bool
    synced_at: dt.datetime | None
    # Fehlercode des letzten Abgleichs, z. B. `mealie.unreachable`.
    sync_error: str | None
    recipes: int


class MealieIn(BaseModel):
    mode: mealie.Mode
    url: Url | None = None
    # None lässt den gespeicherten Token, "" löscht ihn.
    token: Token | None = None


class RecipeOut(BaseModel):
    id: str
    name: str
    # Adresse in Mealie (zum Öffnen im Browser); ohne bekannte Gruppe None.
    url: str | None
    image_url: str | None
    rating: int | None


def _out(db: DbSession) -> MealieOut:
    family = get_family(db)
    stored = mealie.settings_of(family)
    synced = stored.get("synced_at")
    return MealieOut(
        mode=mealie.mode_of(family),
        url=stored.get("url"),
        has_token=bool(stored.get("token")),
        can_store_token=mealie.configured(),
        synced_at=dt.datetime.fromisoformat(synced) if synced else None,
        sync_error=stored.get("sync_error"),
        recipes=db.scalar(select(func.count()).select_from(MealieRecipe)) or 0,
    )


@router.get("")
def get_mealie(_: CurrentSession, db: DbSession) -> MealieOut:
    """Modus und Adresse; braucht jedes Gerät (Knopf in der Navigationsleiste)."""
    return _out(db)


@router.put("", dependencies=[NotInDemo])
def set_mealie(body: MealieIn, _: ParentSession, db: DbSession) -> MealieOut:
    """Speichert Modus, Adresse und Token. Sollen Rezepte aus Mealie kommen, wird die Verbindung
    vorher geprüft und gleich abgeglichen."""
    family = get_family(db)
    stored = dict(mealie.settings_of(family))
    if body.url is not None:
        if body.url != stored.get("url"):
            stored.pop("group_slug", None)
        stored["url"] = body.url
    if body.token == "":
        stored.pop("token", None)
    elif body.token is not None:
        if not mealie.configured():
            raise ApiError(status.HTTP_409_CONFLICT, "mealie.no_encryption_key")
        stored["token"] = encrypt(body.token)
    if body.mode != "off" and not stored.get("url"):
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "mealie.url_missing")
    if body.mode in mealie.RECIPE_MODES and not stored.get("token"):
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "mealie.token_missing")
    stored["mode"] = body.mode
    family.mealie_settings = stored
    connection = mealie.connection_of(family)
    if body.mode in mealie.RECIPE_MODES:
        if connection is None:
            # Token nicht mehr lesbar, z. B. nach einem neuen TOKEN_ENCRYPTION_KEY.
            raise ApiError(status.HTTP_409_CONFLICT, "mealie.token_missing")
        try:
            stored["group_slug"] = mealie.check(connection)
        except mealie.MealieError as exc:
            db.rollback()
            raise ApiError(status.HTTP_502_BAD_GATEWAY, exc.code) from exc
        family.mealie_settings = stored
        db.commit()
        mealie.sync_with_error(db, family)
    else:
        db.commit()
    return _out(db)


@router.post("/sync", dependencies=[NotInDemo])
def sync_now(_: ParentSession, db: DbSession) -> MealieOut:
    """Jetzt abgleichen (sonst alle paar Minuten im Hintergrund)."""
    family = get_family(db)
    if not mealie.recipes_on(family):
        raise ApiError(status.HTTP_409_CONFLICT, "mealie.off")
    mealie.sync_with_error(db, family)
    return _out(db)


@router.get("/recipes")
def list_recipes(_: CurrentSession, db: DbSession) -> list[RecipeOut]:
    """Alle Mealie-Rezepte (letzter Stand), zum Verknüpfen eines Gerichts."""
    family = get_family(db)
    if not mealie.recipes_on(family):
        return []
    return [
        RecipeOut(
            id=recipe.id,
            name=recipe.name,
            url=mealie.recipe_url(family, recipe.slug),
            image_url=mealie.image_url(recipe),
            rating=recipe.rating,
        )
        for recipe in db.scalars(select(MealieRecipe).order_by(func.lower(MealieRecipe.name)))
    ]


def _recipe(db: DbSession, recipe_id: str) -> MealieRecipe:
    recipe = db.get(MealieRecipe, recipe_id)
    if recipe is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "mealie.not_found")
    return recipe


@router.post("/recipes/{recipe_id}/refresh", status_code=status.HTTP_204_NO_CONTENT)
def refresh_recipe(recipe_id: str, _: CurrentSession, db: DbSession) -> None:
    """Holt ein Rezept sofort neu, z. B. beim Öffnen zum Kochen. Ist Mealie nicht erreichbar,
    bleibt der letzte Stand (ohne Fehler: Kochen geht trotzdem)."""
    family = get_family(db)
    if not mealie.recipes_on(family):
        return
    try:
        mealie.refresh_recipe(db, family, _recipe(db, recipe_id))
    except mealie.MealieError:
        db.rollback()


@router.get("/images/{recipe_id}")
def recipe_image(recipe_id: str, _: CurrentSession, db: DbSession) -> Response:
    """Bild eines Mealie-Rezepts über den Server: Das Display braucht so keinen Zugang zu Mealie."""
    family = get_family(db)
    recipe = _recipe(db, recipe_id)
    connection = mealie.connection_of(family)
    if connection is None or not recipe.image:
        raise ApiError(status.HTTP_404_NOT_FOUND, "mealie.not_found")
    try:
        content, content_type = mealie.image(connection, recipe.id)
    except mealie.MealieError as exc:
        raise ApiError(status.HTTP_502_BAD_GATEWAY, exc.code) from exc
    return Response(
        content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=604800"},
    )
