"""„Zu erledigen“: gemeinsame Liste für Einmaliges ohne Person und Termin.

Gehört zum Haushalt und kommt deshalb mit dem Putzplan (`GET /chores`). Eintragen, ändern, abhaken
und streichen geht am Display ohne Eltern-PIN; wer es war, ist freiwillig. Abgehaktes bleibt bis zum
Ende des Tages (Zeitzone der Familie) stehen, damit sich ein falscher Tipp zurücknehmen lässt.
"""

import datetime as dt

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from app.api.members import get_member
from app.auth import CurrentSession, DbSession, get_family
from app.errors import ApiError
from app.models import Todo
from app.schemas import IconName, TypedName
from app.today import family_now

router = APIRouter(prefix="/todos", tags=["todos"])


class TodoOut(BaseModel):
    id: int
    title: str
    icon: str
    done: bool
    # Wer es erledigt hat, falls angegeben.
    done_by: int | None


class TodoIn(BaseModel):
    title: TypedName
    icon: IconName


class TodoDoneIn(BaseModel):
    # None = erledigt, ohne zu sagen von wem.
    member_id: int | None = None


def todo_out(todo: Todo) -> TodoOut:
    return TodoOut(
        id=todo.id,
        title=todo.title,
        icon=todo.icon,
        done=todo.done_date is not None,
        done_by=todo.done_by,
    )


def visible_todos(db: DbSession, today: dt.date) -> list[Todo]:
    """Offenes in der Reihenfolge des Eintragens, danach das heute Abgehakte."""
    return list(
        db.scalars(
            select(Todo)
            .where(or_(Todo.done_date.is_(None), Todo.done_date >= today))
            .order_by(Todo.done_date.is_not(None), Todo.created_at, Todo.id)
        )
    )


def todo_shares(db: DbSession, since: dt.date, today: dt.date) -> dict[int, int]:
    """Wer seit `since` wie oft etwas von der Liste erledigt hat; nur mit Angabe „Wer war's?“."""
    counts = db.execute(
        select(Todo.done_by, func.count())
        .where(Todo.done_by.is_not(None), Todo.done_date >= since, Todo.done_date <= today)
        .group_by(Todo.done_by)
    )
    return {member_id: count for member_id, count in counts}


def _today(db: DbSession) -> dt.date:
    return family_now(get_family(db)).date()


def _get(db: DbSession, todo_id: int) -> Todo:
    """Ein Eintrag, der noch auf der Liste steht: offen oder heute abgehakt."""
    todo = db.get(Todo, todo_id)
    if todo is None or (todo.done_date is not None and todo.done_date < _today(db)):
        raise ApiError(status.HTTP_404_NOT_FOUND, "todo.not_found")
    return todo


@router.post("", status_code=status.HTTP_201_CREATED)
def add_todo(body: TodoIn, _: CurrentSession, db: DbSession) -> TodoOut:
    """Trägt etwas ein. Steht dasselbe schon offen auf der Liste, bleibt es bei einem Eintrag."""
    todo = db.scalar(
        select(Todo).where(Todo.done_date.is_(None), func.lower(Todo.title) == body.title.lower())
    )
    if todo is None:
        todo = Todo(title=body.title, icon=body.icon)
        db.add(todo)
    todo.icon = body.icon
    db.commit()
    return todo_out(todo)


@router.put("/{todo_id}")
def update_todo(todo_id: int, body: TodoIn, _: CurrentSession, db: DbSession) -> TodoOut:
    """Ändert Titel und Symbol. Derselbe Titel darf nicht zweimal offen auf der Liste stehen."""
    todo = _get(db, todo_id)
    twin = db.scalar(
        select(Todo.id).where(
            Todo.id != todo.id,
            Todo.done_date.is_(None),
            func.lower(Todo.title) == body.title.lower(),
        )
    )
    if twin is not None:
        raise ApiError(status.HTTP_409_CONFLICT, "todo.duplicate")
    todo.title, todo.icon = body.title, body.icon
    db.commit()
    return todo_out(todo)


@router.put("/{todo_id}/done")
def mark_done(todo_id: int, body: TodoDoneIn, _: CurrentSession, db: DbSession) -> TodoOut:
    """Erledigt. Ein zweiter Aufruf am selben Tag trägt nur nach, wer es war."""
    todo = _get(db, todo_id)
    if body.member_id is not None:
        get_member(db, body.member_id)
    if todo.done_date is None:
        todo.done_date = _today(db)
    todo.done_by = body.member_id
    db.commit()
    return todo_out(todo)


@router.delete("/{todo_id}/done")
def undo_done(todo_id: int, _: CurrentSession, db: DbSession) -> TodoOut:
    """Nimmt das Abhaken zurück; der Eintrag steht wieder offen auf der Liste."""
    todo = _get(db, todo_id)
    todo.done_date, todo.done_by = None, None
    db.commit()
    return todo_out(todo)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int, _: CurrentSession, db: DbSession) -> None:
    """Streicht einen Eintrag, ohne ihn zu erledigen."""
    db.delete(_get(db, todo_id))
    db.commit()
