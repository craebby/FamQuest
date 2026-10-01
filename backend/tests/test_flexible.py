import datetime as dt

from tests.conftest import csrf
from tests.test_points import points_of
from tests.test_tasks import add_member
from tests.test_today import add_task, complete, today, undo

# SATURDAY (2026-10-03) ist „heute“ laut conftest.
WEEKLY_FROM_SATURDAY = {"kind": "flexible", "interval_days": 7, "date": "2026-10-03"}


def day(offset: int) -> str:
    return (dt.date(2026, 10, 3) + dt.timedelta(days=offset)).isoformat()


def due_of(client, task_id, member_id) -> str | None:
    task = next((t for t in today(client)["tasks"] if t["id"] == task_id), None)
    assert task is not None
    return next(d["due_date"] for d in task["due_dates"] if d["member_id"] == member_id)


def test_flexible_task_is_due_from_start_until_done(client, parent, lena, now):
    task = add_task(client, parent, [lena], recurrence=WEEKLY_FROM_SATURDAY)
    assert due_of(client, task, lena) == day(0)

    # Nicht erledigt: Sie bleibt da und wird überfällig.
    now["value"] += dt.timedelta(days=3)
    assert due_of(client, task, lena) == day(0)

    complete(client, parent, task, lena, date=day(3))
    assert today(client)["tasks"][0]["done_member_ids"] == [lena]

    # Danach ist sie 7 Tage nach der Erledigung wieder fällig.
    now["value"] += dt.timedelta(days=1)
    assert due_of(client, task, lena) == day(10)
    assert today(client)["tasks"][0]["done_member_ids"] == []


def test_flexible_task_can_be_done_early(client, parent, lena, now):
    task = add_task(
        client,
        parent,
        [lena],
        recurrence={"kind": "flexible", "interval_days": 7, "date": day(4)},
    )
    assert due_of(client, task, lena) == day(4)

    assert complete(client, parent, task, lena).status_code == 204
    assert points_of(client, lena)["today"] == 2

    now["value"] += dt.timedelta(days=1)
    assert due_of(client, task, lena) == day(7)


def test_shared_task_counts_once_for_everyone(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    task = add_task(
        client,
        parent,
        [lena, tom],
        title="Tisch decken",
        points=1,
        shared=True,
        recurrence=WEEKLY_FROM_SATURDAY,
    )

    complete(client, parent, task, tom)
    # Ein zweiter Tipp in Lenas Spalte legt keine zweite Erledigung an.
    complete(client, parent, task, lena)

    [entry] = today(client)["tasks"]
    assert entry["shared"] is True
    assert entry["done_member_ids"] == [tom]
    assert (points_of(client, lena)["total"], points_of(client, tom)["total"]) == (0, 1)

    # Lena kann Toms Erledigung zurücknehmen; die Gegenbuchung trifft Tom.
    undo(client, parent, task, lena)
    assert today(client)["tasks"][0]["done_member_ids"] == []
    assert points_of(client, tom)["total"] == 0

    complete(client, parent, task, tom)
    now["value"] += dt.timedelta(days=1)
    # Fälligkeit gilt für alle, auch wenn nur Tom es gemacht hat.
    assert due_of(client, task, lena) == day(7)
    assert due_of(client, task, tom) == day(7)


def test_not_shared_tasks_stay_per_member(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    task = add_task(client, parent, [lena, tom], recurrence=WEEKLY_FROM_SATURDAY)

    complete(client, parent, task, lena)
    now["value"] += dt.timedelta(days=1)

    assert due_of(client, task, lena) == day(7)
    assert due_of(client, task, tom) == day(0)


def test_shared_option_is_stored(client, parent, lena):
    add_task(client, parent, [lena], shared=True)

    assert client.get("/api/tasks", headers=csrf(parent)).json()[0]["shared"] is True
