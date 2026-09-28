"""Essensplan: welches Gericht es an welchem Tag zu welcher Mahlzeit gibt.

Geplant wird direkt in der Ansicht „Essen“, ohne Eltern-PIN. Gerichte entstehen beim Eintippen
und werden danach wieder vorgeschlagen; welche Mahlzeiten geplant werden, legen die Eltern fest.
"""

import datetime as dt
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.calendar_week import MAX_WEEK_OFFSET
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.models import Dish, Family, MealPlanEntry
from app.schemas import MEALS, IconName
from app.today import family_now

router = APIRouter(tags=["meals"])

Meal = Literal["breakfast", "lunch", "dinner", "snack"]
assert tuple(Meal.__args__) == MEALS

# Standard: nur das Abendessen, das planen die meisten Familien.
DEFAULT_MEALS: list[Meal] = ["dinner"]


def _clean_name(value: str) -> str:
    # Mehrfache Leerzeichen wie beim Tippen am Touchscreen zusammenfassen.
    return re.sub(r"\s+", " ", value).strip()


DishName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    AfterValidator(_clean_name),
]


class MealSettings(BaseModel):
    """Geplante Mahlzeiten; gespeichert und ausgegeben in zeitlicher Reihenfolge."""

    meals: list[Meal] = Field(min_length=1, max_length=len(MEALS))


class DishOut(BaseModel):
    id: int
    name: str
    icon: str
    # Wann zuletzt im Plan (auch in der Zukunft) und wie oft; für die Vorschläge.
    last_planned: dt.date | None
    times_planned: int


class MealEntryOut(BaseModel):
    date: dt.date
    meal: Meal
    dish_id: int
    name: str
    icon: str


class MealWeekOut(BaseModel):
    start: dt.date
    today: dt.date
    meals: list[Meal]
    entries: list[MealEntryOut]


class MealEntryIn(BaseModel):
    name: DishName
    icon: IconName


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


@router.get("/dishes")
def list_dishes(_: CurrentSession, db: DbSession) -> list[DishOut]:
    """Alle Gerichte, zuletzt geplante zuerst."""
    usage = (
        select(
            MealPlanEntry.dish_id,
            func.max(MealPlanEntry.date).label("last"),
            func.count().label("count"),
        )
        .group_by(MealPlanEntry.dish_id)
        .subquery()
    )
    rows = db.execute(
        select(Dish, usage.c.last, usage.c.count)
        .outerjoin(usage, usage.c.dish_id == Dish.id)
        .order_by(usage.c.last.desc().nulls_last(), func.lower(Dish.name))
    ).all()
    return [
        DishOut(
            id=dish.id,
            name=dish.name,
            icon=dish.icon,
            last_planned=last,
            times_planned=count or 0,
        )
        for dish, last, count in rows
    ]
