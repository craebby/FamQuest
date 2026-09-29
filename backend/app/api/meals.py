"""Essensplan: welches Gericht es an welchem Tag zu welcher Mahlzeit gibt.

Geplant wird direkt in der Ansicht „Essen“, ohne Eltern-PIN. Gerichte entstehen beim Eintippen
und werden danach wieder vorgeschlagen; welche Mahlzeiten geplant werden, legen die Eltern fest.
"""

import datetime as dt
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
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
