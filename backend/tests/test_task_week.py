import datetime as dt

from sqlalchemy import update

from app.db import SessionLocal
from app.models import Task, TaskCompletion
from tests.conftest import csrf
from tests.test_tasks import add_member, task_data
from tests.test_today import complete

# Die Uhr (Fixture `now`) steht auf Samstag, 3. Oktober 2026; die Woche beginnt am 28. September.
MONDAY = dt.date(2026, 9, 28)


def day(offset: int) -> str:
    return (MONDAY + dt.timedelta(days=offset)).isoformat()


def add_task(client, me, member_ids, created=MONDAY - dt.timedelta(days=7), **overrides) -> int:
    response = client.post("/api/tasks", json=task_data(member_ids, **overrides), headers=csrf(me))
    assert response.status_code == 201, response.text
    task_id = response.json()["id"]
    # Anlegedatum festlegen, damit der Test nicht vom echten Datum abhängt.
    with SessionLocal() as db:
        db.execute(
            update(Task)
            .where(Task.id == task_id)
            .values(created_at=dt.datetime.combine(created, dt.time(8), dt.UTC))
        )
        db.commit()
    return task_id


def done_on(task_id: int, member_id: int, date: str, approved: bool = True) -> None:
    with SessionLocal() as db:
        db.add(
            TaskCompletion(
                task_id=task_id,
                member_id=member_id,
                date=dt.date.fromisoformat(date),
                points=2,
                approved_at=dt.datetime.now(dt.UTC) if approved else None,
            )
        )
        db.commit()


def week(client, offset=0) -> dict:
    response = client.get("/api/tasks/week", params={"offset": offset})
    assert response.status_code == 200, response.text
    return response.json()


def statuses(data: dict, task_id: int, member_id: int) -> dict[str, str]:
    """Tag → Status der Aufgabe für die Person (nur Tage, an denen sie ansteht)."""
    return {
        d["date"]: e["status"]
        for d in data["days"]
        for e in d["entries"]
        if e["task_id"] == task_id and e["member_id"] == member_id
    }


def test_daily_task_over_the_week(client, parent, lena, now):
    teeth = add_task(client, parent, [lena])
    done_on(teeth, lena, day(3))
    assert complete(client, parent, teeth, lena).status_code == 204

    data = week(client)

    assert (data["start"], data["today"]) == (day(0), day(5))
    assert statuses(data, teeth, lena) == {
        day(0): "open",
        day(1): "open",
        day(2): "open",
        day(3): "done",
        day(4): "open",
        day(5): "done",
        day(6): "open",
    }
    [task] = data["tasks"]
    assert (task["id"], task["title"], task["extra"]) == (teeth, "Zähne putzen", False)
    assert task["positions"] == [{"member_id": lena, "position": 0}]


def test_weekdays_and_creation_date(client, parent, lena, now):
    weekly = add_task(client, parent, [lena], recurrence={"kind": "weekly", "weekdays": [1, 3]})
    # Erst am Mittwoch angelegt: Montag und Dienstag stand sie noch nicht an.
    new = add_task(client, parent, [lena], created=MONDAY + dt.timedelta(days=2))

    data = week(client)

    assert list(statuses(data, weekly, lena)) == [day(0), day(2)]
    assert list(statuses(data, new, lena)) == [day(d) for d in range(2, 7)]


def test_shared_and_pending(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    shared = add_task(client, parent, [lena, tom], shared=True)
    check = add_task(client, parent, [lena], needs_approval=True, title="Zimmer")
    done_on(shared, tom, day(1))
    assert complete(client, parent, check, lena).status_code == 204

    data = week(client)
    tuesday = next(d for d in data["days"] if d["date"] == day(1))["entries"]

    assert {
        (e["member_id"], e["status"], e["done_by"]) for e in tuesday if e["task_id"] == shared
    } == {
        (lena, "done", tom),
        (tom, "done", tom),
    }
    assert statuses(data, check, lena)[day(5)] == "pending"


def test_flexible_task_on_due_days(client, parent, lena, now):
    flexible = add_task(
        client,
        parent,
        [lena],
        recurrence={"kind": "flexible", "interval_days": 3, "date": day(5)},
    )

    # Heute fällig, dann alle drei Tage (Vorschau ab heute).
    assert statuses(week(client), flexible, lena) == {day(5): "open"}
    assert list(statuses(week(client, 1), flexible, lena)) == [day(8), day(11)]


def test_completions_of_inactive_tasks_still_show(client, parent, lena, now):
    old = add_task(client, parent, [lena], active=False)
    done_on(old, lena, day(2))

    assert statuses(week(client), old, lena) == {day(2): "done"}


def test_week_is_for_the_display(client, admin, now):
    assert client.get("/api/tasks/week").status_code == 200
    assert client.get("/api/tasks/week", params={"offset": 60}).status_code == 422
    client.cookies.clear()
    assert client.get("/api/tasks/week").status_code == 401
