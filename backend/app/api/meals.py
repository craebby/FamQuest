"""Essensplan: welches Gericht es an welchem Tag zu welcher Mahlzeit gibt.

Geplant wird direkt in der Ansicht „Essen“, ohne Eltern-PIN. Gerichte entstehen beim Eintippen
und werden danach wieder vorgeschlagen; welche Mahlzeiten geplant werden, legen die Eltern fest.
Mit Zutaten und Schritten wird ein Gericht zum Rezept; eingefügt, bearbeitet und bewertet wird
ebenfalls ohne Eltern-PIN.
"""

import datetime as dt
import random
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import delete, exists, func, select
from sqlalchemy.exc import IntegrityError

from app.api.calendar_week import MAX_WEEK_OFFSET
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.avatars import (
    MAX_UPLOAD_BYTES,
    InvalidImage,
    delete_image,
    image_path,
    read_body,
    square_webp,
    store_image,
)
from app.demo_mode import NotInDemo
from app.errors import ApiError
from app.models import Dish, Family, MealPlanEntry
from app.schemas import MEALS, IconName, TypedName
from app.today import family_now

router = APIRouter(tags=["meals"])

Meal = Literal["breakfast", "lunch", "dinner", "snack"]
assert tuple(Meal.__args__) == MEALS

# Upload-Ordner der Fotos zu Gerichten.
IMAGE_FOLDER = "dishes"

# Standard: nur das Abendessen, das planen die meisten Familien.
DEFAULT_MEALS: list[Meal] = ["dinner"]

# Grenzen eines Rezepts: so viele Zutaten bzw. Schritte, so lang je Zeile.
MAX_RECIPE_LINES = 60
Ingredient = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Step = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
# So viele Portionen kann ein Rezept haben.
MAX_SERVINGS = 50
# So viele Rezepte auf einmal beim Einfügen.
MAX_IMPORT = 50

# „Woche füllen“: Gewicht je Bewertung (ohne Bewertung wie drei Sterne). Schlecht Bewertetes
# kommt selten, aber nicht nie, damit es eine zweite Chance bekommt.
FILL_WEIGHTS = {None: 3.0, 1: 0.25, 2: 1.0, 3: 3.0, 4: 5.0, 5: 8.0}
# Dasselbe Gericht frühestens nach so vielen Tagen wieder, solange die Sammlung reicht.
FILL_GAP_DAYS = 7
# So viele Tage auf einmal (zwei Wochen).
MAX_FILL_DAYS = 14
# Zufall für „Woche füllen“; Tests setzen einen festen Startwert.
fill_random = random.Random()


class MealSettings(BaseModel):
    """Geplante Mahlzeiten; gespeichert und ausgegeben in zeitlicher Reihenfolge."""

    meals: list[Meal] = Field(min_length=1, max_length=len(MEALS))


class DishOut(BaseModel):
    id: int
    name: str
    icon: str
    # Eigenes Foto; ersetzt in der Anzeige das Symbol.
    image_url: str | None
    # Wann zuletzt im Plan (auch in der Zukunft) und wie oft; für die Vorschläge.
    last_planned: dt.date | None
    times_planned: int
    ingredients: list[str]
    steps: list[str]
    # Für wie viele Portionen die Mengen gelten; ohne Angabe None.
    servings: int | None
    # 1 bis 5 Sterne, ohne Bewertung None.
    rating: int | None


class MealEntryOut(BaseModel):
    date: dt.date
    meal: Meal
    dish_id: int
    name: str
    icon: str
    image_url: str | None


class MealWeekOut(BaseModel):
    start: dt.date
    today: dt.date
    meals: list[Meal]
    entries: list[MealEntryOut]


class MealEntryIn(BaseModel):
    name: TypedName
    icon: IconName


class DishIn(BaseModel):
    name: TypedName
    icon: IconName


class RecipeIn(BaseModel):
    ingredients: list[Ingredient] = Field(default=[], max_length=MAX_RECIPE_LINES)
    steps: list[Step] = Field(default=[], max_length=MAX_RECIPE_LINES)
    servings: Annotated[int, Field(ge=1, le=MAX_SERVINGS)] | None = None


class ImportedRecipe(RecipeIn):
    name: TypedName
    icon: IconName


class RecipeImport(BaseModel):
    recipes: list[ImportedRecipe] = Field(min_length=1, max_length=MAX_IMPORT)


class FillIn(BaseModel):
    start: dt.date
    end: dt.date
    meal: Meal = "dinner"
    # Auch schon geplante Tage neu belegen („neu würfeln“).
    replace: bool = False


class RatingIn(BaseModel):
    # None nimmt die Bewertung zurück.
    rating: Annotated[int, Field(ge=1, le=5)] | None


async def read_dish_image(request: Request) -> bytes:
    return await read_body(request, MAX_UPLOAD_BYTES, "dish.image_too_large")


DishImage = Annotated[bytes, Depends(read_dish_image)]


def image_url(dish: Dish) -> str | None:
    return f"/api/dish-images/{dish.image}" if dish.image else None


def _ordered(meals: list[str]) -> list[Meal]:
    return [meal for meal in MEALS if meal in meals]  # type: ignore[misc]


def settings_of(family: Family) -> MealSettings:
    """Gespeicherte Mahlzeiten; Unbekanntes fällt weg, ohne gültige gilt der Standard."""
    stored = (family.meal_settings or {}).get("meals")
    meals = _ordered(stored) if isinstance(stored, list) else []
    return MealSettings(meals=meals or DEFAULT_MEALS)


def entry_out(entry: MealPlanEntry) -> MealEntryOut:
    return MealEntryOut(
        date=entry.date,
        meal=entry.meal,  # type: ignore[arg-type]
        dish_id=entry.dish_id,
        name=entry.dish.name,
        icon=entry.dish.icon,
        image_url=image_url(entry.dish),
    )


@router.get("/meals/settings")
def get_settings(_: CurrentSession, db: DbSession) -> MealSettings:
    return settings_of(get_family(db))


@router.put("/meals/settings")
def set_settings(body: MealSettings, _: ParentSession, db: DbSession) -> MealSettings:
    family = get_family(db)
    family.meal_settings = {"meals": _ordered(body.meals)}
    db.commit()
    return settings_of(family)


@router.get("/meals/week")
def meal_week(
    _: CurrentSession,
    db: DbSession,
    offset: Annotated[int, Query(ge=-MAX_WEEK_OFFSET, le=MAX_WEEK_OFFSET)] = 0,
) -> MealWeekOut:
    """Essensplan einer Woche (Montag bis Sonntag); `offset` 0 = diese Woche."""
    family = get_family(db)
    today = family_now(family).date()
    start = today - dt.timedelta(days=today.weekday()) + dt.timedelta(weeks=offset)
    meals = settings_of(family).meals
    entries = db.scalars(
        select(MealPlanEntry)
        .where(
            MealPlanEntry.date >= start,
            MealPlanEntry.date < start + dt.timedelta(days=7),
            # Abgeschaltete Mahlzeiten bleiben gespeichert, erscheinen aber nicht.
            MealPlanEntry.meal.in_(meals),
        )
        .order_by(MealPlanEntry.date, MealPlanEntry.id)
    )
    return MealWeekOut(
        start=start, today=today, meals=meals, entries=[entry_out(e) for e in entries]
    )


@router.post("/meals/fill")
def fill_meals(body: FillIn, _: CurrentSession, db: DbSession) -> list[MealEntryOut]:
    """Füllt leere Tage von `start` bis `end` (ab heute) mit Gerichten aus der Rezeptsammlung.

    Gut bewertete kommen öfter (siehe FILL_WEIGHTS); dasselbe Gericht kommt frühestens nach
    FILL_GAP_DAYS Tagen wieder, solange die Sammlung dafür reicht. Mit `replace` werden auch
    geplante Tage neu belegt, möglichst mit einem anderen Gericht. Gibt die neuen Einträge zurück.
    """
    if body.end < body.start or (body.end - body.start).days >= MAX_FILL_DAYS:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "meals.invalid_range")
    recipes = [
        dish
        for dish in db.scalars(select(Dish).order_by(Dish.id))
        if dish.ingredients or dish.steps
    ]
    if not recipes:
        raise ApiError(status.HTTP_409_CONFLICT, "meals.no_recipes")

    today = family_now(get_family(db)).date()
    first = max(body.start, today)
    days = [first + dt.timedelta(days=i) for i in range((body.end - first).days + 1)]
    # Was rundherum schon geplant ist, je Tag; daran misst sich der Abstand.
    gap = dt.timedelta(days=FILL_GAP_DAYS - 1)
    nearby = db.scalars(
        select(MealPlanEntry)
        .where(
            MealPlanEntry.meal == body.meal,
            MealPlanEntry.date >= first - gap,
            MealPlanEntry.date <= body.end + gap,
        )
        .with_for_update(of=MealPlanEntry)
    ).all()
    planned: dict[dt.date, MealPlanEntry] = {entry.date: entry for entry in nearby}

    changed: list[MealPlanEntry] = []
    for day in days:
        entry = planned.get(day)
        if entry is not None and not body.replace:
            continue
        previous = entry.dish_id if entry is not None else None
        too_close = {
            other.dish_id
            for date, other in planned.items()
            if date != day and abs((date - day).days) < FILL_GAP_DAYS
        }
        choices = [d for d in recipes if d.id not in too_close and d.id != previous]
        if not choices:
            # Die Sammlung reicht nicht für den Abstand: wenigstens nicht dasselbe wie vorher.
            choices = [d for d in recipes if d.id != previous] or recipes
        dish = fill_random.choices(choices, weights=[FILL_WEIGHTS[d.rating] for d in choices])[0]
        if entry is None:
            entry = MealPlanEntry(date=day, meal=body.meal)
            db.add(entry)
            planned[day] = entry
        entry.dish = dish
        entry.dish_id = dish.id
        changed.append(entry)
    db.commit()
    return [entry_out(entry) for entry in changed]


def _find_dish(db: DbSession, name: str) -> Dish | None:
    return db.scalar(select(Dish).where(func.lower(Dish.name) == name.lower()))


@router.put("/meals/{date}/{meal}")
def set_meal(
    date: dt.date, meal: Meal, body: MealEntryIn, _: CurrentSession, db: DbSession
) -> MealEntryOut:
    """Trägt ein Gericht ein. Ein unbekannter Name legt das Gericht an; das Symbol gilt für das
    Gericht, also auch an anderen Tagen."""
    dish = _find_dish(db, body.name)
    if dish is None:
        dish = Dish(name=body.name, icon=body.icon)
        db.add(dish)
        try:
            db.flush()
        except IntegrityError:
            # Gleichzeitig auf einem anderen Gerät angelegt.
            db.rollback()
            dish = _find_dish(db, body.name)
            assert dish is not None
    dish.icon = body.icon

    entry = db.scalar(
        select(MealPlanEntry)
        .where(MealPlanEntry.date == date, MealPlanEntry.meal == meal)
        .with_for_update(of=MealPlanEntry)
    )
    if entry is None:
        entry = MealPlanEntry(date=date, meal=meal)
        db.add(entry)
    entry.dish = dish
    db.commit()
    return entry_out(entry)


@router.delete("/meals/{date}/{meal}", status_code=status.HTTP_204_NO_CONTENT)
def clear_meal(date: dt.date, meal: Meal, _: CurrentSession, db: DbSession) -> None:
    """Nimmt das Gericht aus dem Plan; das Gericht selbst bleibt als Vorschlag erhalten."""
    entry = db.scalar(
        select(MealPlanEntry).where(MealPlanEntry.date == date, MealPlanEntry.meal == meal)
    )
    if entry is not None:
        db.delete(entry)
        db.commit()


def _dishes_out(db: DbSession, dish_id: int | None = None) -> list[DishOut]:
    """Gerichte mit Nutzung, zuletzt geplante zuerst; mit `dish_id` nur dieses."""
    usage = (
        select(
            MealPlanEntry.dish_id,
            func.max(MealPlanEntry.date).label("last"),
            func.count().label("count"),
        )
        .group_by(MealPlanEntry.dish_id)
        .subquery()
    )
    query = (
        select(Dish, usage.c.last, usage.c.count)
        .outerjoin(usage, usage.c.dish_id == Dish.id)
        .order_by(usage.c.last.desc().nulls_last(), func.lower(Dish.name))
    )
    if dish_id is not None:
        query = query.where(Dish.id == dish_id)
    return [
        DishOut(
            id=dish.id,
            name=dish.name,
            icon=dish.icon,
            image_url=image_url(dish),
            last_planned=last,
            times_planned=count or 0,
            ingredients=dish.ingredients,
            steps=dish.steps,
            servings=dish.servings,
            rating=dish.rating,
        )
        for dish, last, count in db.execute(query).all()
    ]


def get_dish(db: DbSession, dish_id: int) -> Dish:
    dish = db.get(Dish, dish_id)
    if dish is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "dish.not_found")
    return dish


@router.get("/dishes")
def list_dishes(_: CurrentSession, db: DbSession) -> list[DishOut]:
    """Alle Gerichte, zuletzt geplante zuerst."""
    return _dishes_out(db)


@router.put("/dishes/{dish_id}")
def update_dish(dish_id: int, body: DishIn, _: CurrentSession, db: DbSession) -> DishOut:
    """Name und Symbol ändern; gilt überall, wo das Gericht geplant ist."""
    dish = get_dish(db, dish_id)
    other = _find_dish(db, body.name)
    if other is not None and other.id != dish.id:
        raise ApiError(status.HTTP_409_CONFLICT, "dish.duplicate_name")
    dish.name, dish.icon = body.name, body.icon
    try:
        db.commit()
    except IntegrityError as error:
        raise ApiError(status.HTTP_409_CONFLICT, "dish.duplicate_name") from error
    return _dishes_out(db, dish.id)[0]


@router.put("/dishes/{dish_id}/recipe")
def set_recipe(dish_id: int, body: RecipeIn, _: CurrentSession, db: DbSession) -> DishOut:
    """Zutaten, Schritte und Portionen ersetzen; Zutaten und Schritte leer macht aus dem Rezept
    wieder ein Gericht."""
    dish = get_dish(db, dish_id)
    dish.ingredients, dish.steps = body.ingredients, body.steps
    dish.servings = body.servings if body.ingredients or body.steps else None
    db.commit()
    return _dishes_out(db, dish.id)[0]


@router.delete("/dishes/{dish_id}/recipe", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(dish_id: int, _: CurrentSession, db: DbSession) -> None:
    """Nimmt das Rezept weg. Stand das Gericht nie im Essensplan (z. B. nur eingefügt), geht es
    ganz, sonst bliebe es unsichtbar in den Vorschlägen. Geplantes bleibt als Gericht ohne
    Rezept."""
    dish = get_dish(db, dish_id)
    planned = db.scalar(select(exists().where(MealPlanEntry.dish_id == dish.id)))
    if planned:
        dish.ingredients, dish.steps, dish.servings = [], [], None
        db.commit()
        return
    image = dish.image
    db.delete(dish)
    db.commit()
    delete_image(IMAGE_FOLDER, image)


@router.put("/dishes/{dish_id}/rating")
def rate_dish(dish_id: int, body: RatingIn, _: CurrentSession, db: DbSession) -> DishOut:
    """Wie es der Familie schmeckt (1 bis 5 Sterne); `null` nimmt die Bewertung zurück."""
    dish = get_dish(db, dish_id)
    dish.rating = body.rating
    db.commit()
    return _dishes_out(db, dish.id)[0]


@router.post("/recipes")
def import_recipes(body: RecipeImport, _: CurrentSession, db: DbSession) -> list[DishOut]:
    """Fügt Rezepte ein (zerlegt hat sie das Frontend). Gibt es ein Gericht mit dem Namen schon,
    bekommt es das Rezept; Symbol, Foto und Bewertung bleiben. Sonst entsteht ein neues Gericht.
    Kommt ein Name mehrfach vor, gilt das letzte Rezept."""
    ids: list[int] = []
    for recipe in body.recipes:
        dish = _find_dish(db, recipe.name)
        if dish is None:
            dish = Dish(name=recipe.name, icon=recipe.icon)
            db.add(dish)
        dish.ingredients, dish.steps = recipe.ingredients, recipe.steps
        dish.servings = recipe.servings
        db.flush()
        if dish.id not in ids:
            ids.append(dish.id)
    try:
        db.commit()
    except IntegrityError as error:
        # Gleichzeitig auf einem anderen Gerät angelegt; einfach noch einmal einfügen.
        raise ApiError(status.HTTP_409_CONFLICT, "dish.duplicate_name") from error
    by_id = {dish.id: dish for dish in _dishes_out(db)}
    return [by_id[dish_id] for dish_id in ids]


@router.delete("/dishes/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dish(dish_id: int, _: CurrentSession, db: DbSession) -> None:
    """Löscht ein Gericht samt vergangener Plan-Einträge. Steht es heute oder später im Plan,
    muss es dort zuerst weg."""
    dish = get_dish(db, dish_id)
    today = family_now(get_family(db)).date()
    planned = db.scalar(
        select(exists().where(MealPlanEntry.dish_id == dish.id, MealPlanEntry.date >= today))
    )
    if planned:
        raise ApiError(status.HTTP_409_CONFLICT, "dish.planned")
    image = dish.image
    db.execute(delete(MealPlanEntry).where(MealPlanEntry.dish_id == dish.id))
    db.delete(dish)
    db.commit()
    delete_image(IMAGE_FOLDER, image)


@router.put("/dishes/{dish_id}/image", dependencies=[NotInDemo])
def upload_dish_image(dish_id: int, _: CurrentSession, db: DbSession, upload: DishImage) -> DishOut:
    """Nimmt das (im Browser zugeschnittene) Foto als Request-Body entgegen."""
    dish = get_dish(db, dish_id)
    try:
        data = square_webp(upload)
    except InvalidImage as error:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "dish.invalid_image") from error
    filename = store_image(IMAGE_FOLDER, data)
    previous, dish.image = dish.image, filename
    try:
        db.commit()
    except Exception:
        delete_image(IMAGE_FOLDER, filename)
        raise
    delete_image(IMAGE_FOLDER, previous)
    return _dishes_out(db, dish.id)[0]


@router.delete("/dishes/{dish_id}/image")
def remove_dish_image(dish_id: int, _: CurrentSession, db: DbSession) -> DishOut:
    dish = get_dish(db, dish_id)
    previous, dish.image = dish.image, None
    db.commit()
    delete_image(IMAGE_FOLDER, previous)
    return _dishes_out(db, dish.id)[0]


@router.get("/dish-images/{filename}")
def get_dish_image(filename: str, _: CurrentSession, db: DbSession) -> FileResponse:
    path = image_path(IMAGE_FOLDER, filename)
    in_use = path is not None and db.scalar(select(exists().where(Dish.image == filename)))
    if not in_use or not path.is_file():
        raise ApiError(status.HTTP_404_NOT_FOUND, "common.not_found")
    # Jedes neue Foto bekommt einen neuen Namen, daher darf der Browser lange cachen.
    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
