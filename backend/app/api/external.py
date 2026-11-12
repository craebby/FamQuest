"""API für andere Programme (Bon-Drucker, Home Assistant) unter `/api/v1`, mit API-Schlüssel
statt Session (siehe app/api_tokens.py).

Lesen geht mit jedem Schlüssel. Eintragen und abhaken braucht einen Schlüssel mit Schreibrecht und
kann nur, was am Display auch ohne Eltern-PIN geht. Der Aufbau dieser Antworten bleibt stabil; die
übrige API (`/api/...`) gehört zum Frontend und kann sich mit jeder Version ändern.
"""

import datetime as dt
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select

from app import printing
from app.api import shopping, todos
from app.api.calendar_week import upcoming
from app.api.chores import list_chores
from app.api.meals import meal_week
from app.api.today import get_today
from app.api_tokens import ReadToken, WriteToken
from app.auth import DbSession, get_family
from app.models import ChoreRoom, FamilyMember
from app.receipt import (
    DEFAULT_WIDTH,
    MAX_WIDTH,
    MIN_WIDTH,
    Entry,
    entries,
    language,
    receipt_markup,
    receipt_text,
)
from app.schemas import TypedName
from app.shopping_areas import LABELS, Store, default_icon
from app.today import family_now

router = APIRouter(prefix="/v1", tags=["external"])

Lang = Annotated[Literal["de", "en"] | None, Query()]
TODO_ICON = "fluent-emoji-flat:memo"


class ItemOut(BaseModel):
    id: int
    name: str
    note: str | None
    # Aus welchen Rezepten („Chili, Lasagne“); None = von Hand eingetragen.
    recipes: str | None
    checked: bool
    store: Store
    store_label: str
    area: str
    area_label: str


class ShoppingOut(BaseModel):
    date: dt.date
    open: int
    items: list[ItemOut]


class AddItemIn(BaseModel):
    name: TypedName
    note: shopping.Note | None = None


class CheckIn(BaseModel):
    checked: bool = True


class TodoIn(BaseModel):
    title: TypedName


class TodoOut(BaseModel):
    id: int
    title: str
    done: bool


class PrintedOut(BaseModel):
    items: int


class ChoreSummary(BaseModel):
    id: int
    title: str
    room: str
    # "soon" (gelb) oder "due" (rot).
    level: str
    # 0 = heute fällig, negativ = so viele Tage drüber.
    days_left: int


class EventSummary(BaseModel):
    title: str | None
    day: dt.date
    all_day: bool
    start: dt.date | dt.datetime
    end: dt.date | dt.datetime
    people: list[str]


class MealSummary(BaseModel):
    meal: str
    name: str


class MemberSummary(BaseModel):
    id: int
    name: str
    role: str
    color: str
    points: int
    points_today: int
    # Heutige Pflichtaufgaben und Routinenschritte (ohne optionale und Extras).
    tasks_total: int
    tasks_done: int


class SummaryOut(BaseModel):
    date: dt.date
    time_of_day: str
    shopping_open: int
    shopping: list[str]
    todos_open: int
    todos: list[str]
    chores_due: int
    chores_soon: int
    chores: list[ChoreSummary]
    meals_today: list[MealSummary]
    events_today: list[EventSummary]
    next_event: EventSummary | None
    members: list[MemberSummary]
    pending_approvals: int


def _item_out(entry: Entry, lang: str) -> ItemOut:
    labels = LABELS[lang]
    return ItemOut(
        id=entry.id,
        name=entry.name,
        note=entry.note,
        recipes=entry.recipes,
        checked=entry.checked,
        store=entry.store,  # type: ignore[arg-type]
        store_label=labels[entry.store],
        area=entry.area,
        area_label=labels[entry.area],
    )


def _filtered(items: list[Entry], store: Store | None) -> list[Entry]:
    return [entry for entry in items if store is None or entry.store == store]


@router.get("/shopping")
def get_shopping(
    _: ReadToken,
    db: DbSession,
    store: Store | None = None,
    include_checked: bool = False,
    lang: Lang = None,
) -> ShoppingOut:
    """Einkaufsliste nach Laden und Bereich im Laufweg; `store` nur ein Laden."""
    family = get_family(db)
    items = _filtered(entries(db, family, include_checked=include_checked), store)
    chosen = language(family, lang)
    return ShoppingOut(
        date=family_now(family).date(),
        open=sum(not entry.checked for entry in items),
        items=[_item_out(entry, chosen) for entry in items],
    )


@router.get("/shopping/receipt", response_class=PlainTextResponse)
def get_receipt(
    _: ReadToken,
    db: DbSession,
    width: Annotated[int, Query(ge=MIN_WIDTH, le=MAX_WIDTH)] = DEFAULT_WIDTH,
    store: Store | None = None,
    lang: Lang = None,
    format: Literal["text", "markup"] = "text",
) -> str:
    """Die offene Liste als Text für einen Bon-Drucker, `width` Zeichen breit; mit
    `format=markup` als `# Titel`, `## Laden`, `- Artikel` für Apps mit eigener Schrift."""
    family = get_family(db)
    items = _filtered(entries(db, family), store)
    lang = language(family, lang)
    if format == "markup":
        return receipt_markup(items, lang=lang)
    return receipt_text(family, items, width=width, lang=lang)


@router.post("/shopping", status_code=status.HTTP_201_CREATED)
def add_shopping(body: AddItemIn, _: WriteToken, db: DbSession, lang: Lang = None) -> ItemOut:
    """Setzt einen Artikel auf die Liste. Ein bekannter behält sein Symbol, ein neuer bekommt eins
    passend zum Laden."""
    known = shopping.find_item(db, body.name)
    icon = known.icon if known is not None else default_icon(body.name)
    added = shopping.add_to_list(
        shopping.AddIn(name=body.name, icon=icon, note=body.note),
        None,  # type: ignore[arg-type]
        db,
    )
    family = get_family(db)
    entry = next(e for e in entries(db, family) if e.id == added.id)
    return _item_out(entry, language(family, lang))


@router.put("/shopping/{item_id}/checked")
def check_shopping(
    item_id: int, body: CheckIn, _: WriteToken, db: DbSession, lang: Lang = None
) -> ItemOut:
    """Abhaken (oder mit `checked: false` zurücknehmen)."""
    shopping.set_checked(item_id, shopping.CheckIn(checked=body.checked), None, db)  # type: ignore[arg-type]
    family = get_family(db)
    entry = next(e for e in entries(db, family, include_checked=True) if e.id == item_id)
    return _item_out(entry, language(family, lang))


@router.post("/shopping/print")
def print_shopping(_: WriteToken, db: DbSession, lang: Lang = None) -> PrintedOut:
    """Schickt die Liste an den Bon-Drucker aus dem Elternbereich (wie der Knopf am Display)."""
    return PrintedOut(items=printing.send(db, get_family(db), lang))


@router.get("/todos")
def get_todos(_: ReadToken, db: DbSession) -> list[TodoOut]:
    """„Zu erledigen“: Offenes, danach heute Abgehaktes."""
    today = family_now(get_family(db)).date()
    return [
        TodoOut(id=todo.id, title=todo.title, done=todo.done_date is not None)
        for todo in todos.visible_todos(db, today)
    ]


@router.post("/todos", status_code=status.HTTP_201_CREATED)
def add_todo(body: TodoIn, _: WriteToken, db: DbSession) -> TodoOut:
    todo = todos.add_todo(todos.TodoIn(title=body.title, icon=TODO_ICON), None, db)  # type: ignore[arg-type]
    return TodoOut(id=todo.id, title=todo.title, done=todo.done)


@router.post("/todos/{todo_id}/done")
def done_todo(todo_id: int, _: WriteToken, db: DbSession) -> TodoOut:
    todo = todos.mark_done(todo_id, todos.TodoDoneIn(), None, db)  # type: ignore[arg-type]
    return TodoOut(id=todo.id, title=todo.title, done=todo.done)


def _event(event, members: dict[int, str], family_name: str) -> EventSummary:
    people = [members[m] for m in event.member_ids if m in members]
    if event.family:
        people = [family_name]
    return EventSummary(
        title=event.title,
        day=event.day,
        all_day=event.all_day,
        start=event.start,
        end=event.end,
        people=people,
    )


@router.get("/summary")
def summary(_: ReadToken, db: DbSession) -> SummaryOut:
    """Alles Wichtige von heute auf einen Blick, z. B. für Sensoren in Home Assistant."""
    family = get_family(db)
    session = None  # Die Funktionen der App-API brauchen die Session nicht.
    today = get_today(session, db)  # type: ignore[arg-type]
    members = list(
        db.scalars(select(FamilyMember).order_by(FamilyMember.position, FamilyMember.id))
    )
    names = {member.id: member.name for member in members}

    shopping_items = entries(db, family)
    chores = list_chores(session, db)  # type: ignore[arg-type]
    rooms = {room.id: room.name for room in db.scalars(select(ChoreRoom))}
    flagged = sorted(
        (c for c in chores.chores if c.active and c.level in ("soon", "due") and not c.done_today),
        key=lambda c: (c.days_left, c.title.lower()),
    )
    open_todos = [todo.title for todo in chores.todos if not todo.done]

    meals = meal_week(session, db, 0)  # type: ignore[arg-type]
    meals_today = [
        MealSummary(meal=entry.meal, name=entry.name)
        for entry in meals.entries
        if entry.date == today.date
    ]

    soon = upcoming(session, db, 20, None)  # type: ignore[arg-type]
    now = family_now(family)
    events = [_event(e, names, family.name) for e in soon.events]
    events_today = [e for e in events if e.day == today.date]
    tz = ZoneInfo(family.timezone)

    def started(event: EventSummary) -> bool:
        return isinstance(event.start, dt.datetime) and event.start.astimezone(tz) <= now

    next_event = next((e for e in events if not e.all_day and not started(e)), None)

    points = {p.member_id: p for p in today.points}
    member_rows = []
    for member in members:
        total = done = 0
        for task in today.tasks:
            if member.id not in task.member_ids or task.extra:
                continue
            slot = next((p for p in task.positions if p.member_id == member.id), None)
            if slot is not None and slot.optional:
                continue
            total += 1
            if member.id in task.done_member_ids or (task.shared and task.done_member_ids):
                done += 1
        member_points = points.get(member.id)
        member_rows.append(
            MemberSummary(
                id=member.id,
                name=member.name,
                role=member.role,
                color=member.color,
                points=member_points.total if member_points else 0,
                points_today=member_points.today if member_points else 0,
                tasks_total=total,
                tasks_done=done,
            )
        )

    return SummaryOut(
        date=today.date,
        time_of_day=today.time_of_day,
        shopping_open=len(shopping_items),
        shopping=[e.name + (f" ({e.note})" if e.note else "") for e in shopping_items],
        todos_open=len(open_todos),
        todos=open_todos,
        chores_due=sum(c.level == "due" for c in flagged),
        chores_soon=sum(c.level == "soon" for c in flagged),
        chores=[
            ChoreSummary(
                id=c.id,
                title=c.title,
                room=rooms.get(c.room_id, ""),
                level=c.level,
                days_left=c.days_left,
            )
            for c in flagged
        ],
        meals_today=meals_today,
        events_today=events_today,
        next_event=next_event,
        members=member_rows,
        pending_approvals=today.pending_approvals,
    )
