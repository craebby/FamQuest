"""Mealie (https://mealie.io) als Rezeptquelle, nur lesend über die API mit einem API-Token.

Der Abgleich holt die Liste aller Rezepte und nur die geänderten neu (`updatedAt`); Zutaten und
Schritte liegen danach in `mealie_recipes`. Jedes Mealie-Rezept bekommt ein Gericht für den
Essensplan (`Dish.mealie_auto`), so erscheint es in der Rezeptsammlung, in den Vorschlägen und bei
„Woche füllen“. Von Hand lässt sich außerdem jedes andere Gericht mit einem Mealie-Rezept
verknüpfen. Ist Mealie nicht erreichbar, gilt der letzte Stand.

Modi (`Family.mealie_settings["mode"]`):
- `off`: aus, nur die eigenen Rezepte
- `link`: nur ein Knopf in der Navigationsleiste, der Mealie öffnet
- `mixed`: eigene Rezepte und Mealie-Rezepte
- `only`: nur Mealie-Rezepte in Rezeptsammlung und „Woche füllen“
"""

import asyncio
import datetime as dt
from dataclasses import dataclass
from typing import Literal

import httpx2 as httpx
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.auth import utcnow
from app.config import get_settings
from app.crypto import DecryptError, decrypt
from app.db import SessionLocal, engine
from app.logs import logger
from app.models import Dish, Family, MealieRecipe, MealPlanEntry

Mode = Literal["off", "link", "mixed", "only"]
# In diesen Modi kommen Rezepte aus Mealie.
RECIPE_MODES: tuple[Mode, ...] = ("mixed", "only")

# Grenzen wie bei den eigenen Rezepten (siehe api/meals.py).
MAX_LINES = 60
MAX_INGREDIENT = 200
MAX_STEP = 1000
MAX_SERVINGS = 50
NAME_MAX = 100
# Symbol eines Mealie-Gerichts, bis die Familie ein anderes wählt; meist zeigt es ohnehin das Foto.
DISH_ICON = "fluent-emoji-flat:fork-and-knife-with-plate"
# Gleichnamiges eigenes Gericht mit Rezept: das aus Mealie heißt dann so.
NAME_SUFFIX = " (Mealie)"

_LOCK_KEY = 0x46514D45  # "FQME"

# Tests setzen hier einen httpx.MockTransport ein.
transport: httpx.BaseTransport | None = None


class MealieError(Exception):
    """Mealie nicht erreichbar oder Anmeldung abgelehnt; `code` ist der Fehlercode für die API."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass
class Connection:
    url: str
    token: str


def settings_of(family: Family) -> dict:
    return family.mealie_settings or {}


def mode_of(family: Family) -> Mode:
    mode = settings_of(family).get("mode")
    return mode if mode in ("link", "mixed", "only") else "off"


def recipes_on(family: Family) -> bool:
    """Kommen gerade Rezepte aus Mealie?"""
    return mode_of(family) in RECIPE_MODES


def connection_of(family: Family) -> Connection | None:
    stored = settings_of(family)
    if not stored.get("url") or not stored.get("token"):
        return None
    try:
        return Connection(url=stored["url"], token=decrypt(stored["token"]))
    except DecryptError:
        return None


def recipe_url(family: Family, slug: str) -> str | None:
    """Adresse des Rezepts in Mealie, zum Öffnen im Browser."""
    stored = settings_of(family)
    if not stored.get("url") or not stored.get("group_slug"):
        return None
    return f"{stored['url']}/g/{stored['group_slug']}/r/{slug}"


def image_url(recipe: MealieRecipe) -> str | None:
    # Die Kennung des Bilds in der Adresse: Ein neues Bild in Mealie umgeht den Browser-Cache.
    return f"/api/mealie/images/{recipe.id}?v={recipe.image}" if recipe.image else None


def _get(connection: Connection, path: str, params: dict | None = None) -> httpx.Response:
    try:
        with httpx.Client(
            base_url=connection.url, timeout=15, transport=transport, follow_redirects=True
        ) as client:
            response = client.get(
                path, params=params, headers={"Authorization": f"Bearer {connection.token}"}
            )
    except httpx.HTTPError as exc:
        logger.warning("Mealie nicht erreichbar: %s", type(exc).__name__)
        raise MealieError("mealie.unreachable") from exc
    if response.status_code in (401, 403):
        raise MealieError("mealie.unauthorized")
    if response.status_code >= 400:
        logger.warning("Mealie antwortet mit %s auf %s", response.status_code, path)
        raise MealieError("mealie.unreachable")
    return response


def _json(connection: Connection, path: str, params: dict | None = None) -> dict:
    try:
        data = _get(connection, path, params).json()
    except ValueError as exc:
        # Meist die falsche Adresse: eine Webseite statt der Mealie-API.
        raise MealieError("mealie.not_mealie") from exc
    if not isinstance(data, dict):
        raise MealieError("mealie.not_mealie")
    return data


def check(connection: Connection) -> str:
    """Prüft Adresse und Token; gibt die Gruppe zurück (für die Adressen der Rezepte)."""
    me = _json(connection, "/api/users/self")
    group = me.get("groupSlug")
    if not isinstance(group, str) or not group:
        raise MealieError("mealie.not_mealie")
    return group


def image(connection: Connection, recipe_id: str) -> tuple[bytes, str]:
    """Bild eines Rezepts (verkleinert) mit Inhaltstyp."""
    response = _get(connection, f"/api/media/recipes/{recipe_id}/images/min-original.webp")
    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise MealieError("mealie.unreachable")
    return response.content, content_type


# --- Rezepte zerlegen -----------------------------------------------------------------------

_FRACTIONS = {0.25: "¼", 0.5: "½", 0.75: "¾"}


def _amount(quantity: float, decimal: str) -> str:
    """„½“ unter 1, sonst Zahlen („1,5“): So versteht sie der Einkauf und der Umrechner."""
    for value, sign in _FRACTIONS.items():
        if abs(quantity - value) < 0.01:
            return sign
    if abs(quantity - round(quantity)) < 0.01:
        return str(round(quantity))
    return f"{quantity:.2f}".rstrip("0").rstrip(".").replace(".", decimal)


def _name(entry: object) -> str:
    return entry.get("name", "").strip() if isinstance(entry, dict) else ""


def ingredient_line(ingredient: dict, decimal: str = ",") -> str:
    """Eine Zutat als Text wie bei den eigenen Rezepten: „400 ml Gemüsebrühe (selbst gemacht)“.

    Hat Mealie die Zutat nicht zerlegt, gilt ihr Text."""
    food = _name(ingredient.get("food"))
    note = (ingredient.get("note") or "").strip()
    if not food:
        text = note or ingredient.get("display") or ingredient.get("originalText") or ""
        return " ".join(str(text).split())
    unit = ingredient.get("unit")
    unit_text = ""
    if isinstance(unit, dict):
        unit_text = (unit.get("abbreviation") or "").strip() or _name(unit)
    quantity = ingredient.get("quantity")
    parts = [
        _amount(quantity, decimal) if isinstance(quantity, int | float) and quantity > 0 else "",
        unit_text,
        food,
        f"({note})" if note else "",
    ]
    return " ".join(" ".join(part for part in parts if part).split())


def parse_recipe(detail: dict, decimal: str = ",") -> dict:
    """Spalten von MealieRecipe aus der Antwort auf /api/recipes/{slug}."""
    ingredients = [
        ingredient_line(item, decimal)[:MAX_INGREDIENT]
        for item in detail.get("recipeIngredient") or []
        if isinstance(item, dict)
    ]
    steps = [
        " ".join(str(item.get("text") or "").split())[:MAX_STEP]
        for item in detail.get("recipeInstructions") or []
        if isinstance(item, dict)
    ]
    servings = detail.get("recipeServings")
    return {
        "ingredients": [line for line in ingredients if line][:MAX_LINES],
        "steps": [step for step in steps if step][:MAX_LINES],
        "servings": min(round(servings), MAX_SERVINGS)
        if isinstance(servings, int | float) and servings >= 1
        else None,
    }


def _rating(value: object) -> int | None:
    if isinstance(value, int | float) and value >= 0.5:
        return max(1, min(5, round(value)))
    return None


# --- Abgleich -------------------------------------------------------------------------------


def _summary(item: dict) -> dict | None:
    if not isinstance(item.get("id"), str) or not item.get("slug") or not item.get("name"):
        return None
    return {
        "id": item["id"],
        "slug": str(item["slug"])[:300],
        "name": " ".join(str(item["name"]).split())[:300],
        "image": str(item["image"])[:64] if item.get("image") else None,
        "rating": _rating(item.get("rating")),
        "updated": str(item.get("updatedAt") or item.get("dateUpdated") or "")[:64] or None,
    }


def _find_dish(db: Session, name: str) -> Dish | None:
    return db.scalar(select(Dish).where(func.lower(Dish.name) == name.lower()))


def _ensure_dish(db: Session, recipe: MealieRecipe) -> None:
    """Gericht für ein Mealie-Rezept, falls es noch keins hat."""
    if db.scalar(select(exists().where(Dish.mealie_id == recipe.id, Dish.mealie_auto))):
        return
    name = recipe.name[:NAME_MAX].strip()
    same = _find_dish(db, name)
    if same is not None and same.mealie_id is None and not (same.ingredients or same.steps):
        # Gab es schon als Gericht ohne Rezept (z. B. so im Essensplan eingetippt).
        same.mealie_id, same.mealie_auto = recipe.id, True
        return
    if same is not None:
        name = name[: NAME_MAX - len(NAME_SUFFIX)].strip() + NAME_SUFFIX
        if _find_dish(db, name) is not None:
            return
    db.add(Dish(name=name, icon=DISH_ICON, mealie_id=recipe.id, mealie_auto=True))
    db.flush()


def _forget(db: Session, recipe: MealieRecipe) -> None:
    """In Mealie gelöscht: Ein Gericht, das nie geplant war, verschwindet; sonst bleibt es mit dem
    letzten Stand des Rezepts als eigenem Rezept."""
    for dish in db.scalars(select(Dish).where(Dish.mealie_id == recipe.id)):
        planned = db.scalar(select(exists().where(MealPlanEntry.dish_id == dish.id)))
        if dish.mealie_auto and not planned:
            db.delete(dish)
            continue
        if not (dish.ingredients or dish.steps):
            dish.ingredients, dish.steps = recipe.ingredients, recipe.steps
            dish.servings = recipe.servings
        dish.mealie_id, dish.mealie_auto = None, False
    db.flush()
    db.delete(recipe)


def _store(row: MealieRecipe, summary: dict, detail: dict | None, decimal: str) -> None:
    row.slug, row.name = summary["slug"], summary["name"]
    row.image, row.rating, row.updated = summary["image"], summary["rating"], summary["updated"]
    if detail is not None:
        parsed = parse_recipe(detail, decimal)
        row.ingredients, row.steps, row.servings = (
            parsed["ingredients"],
            parsed["steps"],
            parsed["servings"],
        )


def _rename_dishes(db: Session, row: MealieRecipe, old_name: str, new_name: str) -> None:
    """Ein Mealie-Gericht heißt wie in Mealie, solange die Familie es nicht umbenannt hat."""
    if old_name == new_name:
        return
    for dish in db.scalars(select(Dish).where(Dish.mealie_id == row.id, Dish.mealie_auto)):
        if dish.name == old_name[:NAME_MAX].strip():
            target = new_name[:NAME_MAX].strip()
            other = _find_dish(db, target)
            if other is None or other.id == dish.id:
                dish.name = target


def _decimal(family: Family) -> str:
    return "." if family.default_language.startswith("en") else ","


def sync(db: Session, family: Family, now: dt.datetime | None = None) -> None:
    """Gleicht die Rezepte mit Mealie ab; wirft MealieError (der alte Stand bleibt dann)."""
    connection = connection_of(family)
    if connection is None:
        raise MealieError("mealie.not_configured")
    data = _json(connection, "/api/recipes", {"perPage": -1, "orderBy": "name"})
    items = data.get("items")
    if not isinstance(items, list):
        raise MealieError("mealie.not_mealie")
    decimal = _decimal(family)
    known = {row.id: row for row in db.scalars(select(MealieRecipe))}
    for item in items:
        summary = _summary(item) if isinstance(item, dict) else None
        if summary is None:
            continue
        row = known.pop(summary["id"], None)
        changed = row is None or row.updated != summary["updated"] or summary["updated"] is None
        detail = _json(connection, f"/api/recipes/{summary['slug']}") if changed else None
        if row is None:
            row = MealieRecipe(id=summary["id"])
            db.add(row)
            old_name = summary["name"]
        else:
            old_name = row.name
        _store(row, summary, detail, decimal)
        db.flush()
        _rename_dishes(db, row, old_name, row.name)
        _ensure_dish(db, row)
    for gone in known.values():
        _forget(db, gone)
    stored = dict(settings_of(family))
    stored["synced_at"] = (now or utcnow()).isoformat()
    stored.pop("sync_error", None)
    family.mealie_settings = stored
    db.commit()


def refresh_recipe(db: Session, family: Family, recipe: MealieRecipe) -> None:
    """Holt ein Rezept sofort neu (beim Öffnen zum Kochen); Fehler lassen den alten Stand."""
    connection = connection_of(family)
    if connection is None:
        raise MealieError("mealie.not_configured")
    detail = _json(connection, f"/api/recipes/{recipe.id}")
    summary = _summary(detail)
    if summary is None:
        raise MealieError("mealie.not_mealie")
    old_name = recipe.name
    _store(recipe, summary, detail, _decimal(family))
    _rename_dishes(db, recipe, old_name, recipe.name)
    db.commit()


def sync_with_error(db: Session, family: Family) -> None:
    """Abgleich; ein Fehler wird gespeichert (für den Elternbereich) statt geworfen."""
    try:
        sync(db, family)
    except MealieError as exc:
        db.rollback()
        stored = dict(settings_of(family))
        stored["sync_error"] = exc.code
        family.mealie_settings = stored
        db.commit()


def sync_all() -> bool:
    """Ein Durchlauf im Hintergrund. False, wenn schon einer läuft."""
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as lock:
        if not lock.scalar(select(func.pg_try_advisory_lock(_LOCK_KEY))):
            return False
        try:
            with SessionLocal() as db:
                family = db.scalars(select(Family)).one_or_none()
                if family is not None and recipes_on(family):
                    sync_with_error(db, family)
        finally:
            lock.scalar(select(func.pg_advisory_unlock(_LOCK_KEY)))
    return True


async def run_periodically(interval: dt.timedelta) -> None:
    """Hintergrundschleife im App-Prozess; Fehler beenden sie nicht."""
    while True:
        try:
            await asyncio.to_thread(sync_all)
        except Exception:
            logger.exception("Mealie-Abgleich fehlgeschlagen")
        await asyncio.sleep(interval.total_seconds())


def configured() -> bool:
    """Lässt sich ein Token speichern? Dafür braucht es TOKEN_ENCRYPTION_KEY."""
    return bool(get_settings().token_encryption_key)
