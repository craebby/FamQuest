import datetime as dt

from tests.conftest import csrf
from tests.test_points import points_of
from tests.test_rewards import add_parent_member
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
    mama = add_parent_member(client, parent)
    papa = add_parent_member(client, parent, "Papa", "orange")
    task = add_task(
        client,
        parent,
        [mama, papa],
        title="Bad putzen",
        points=1,
        shared=True,
        recurrence=WEEKLY_FROM_SATURDAY,
    )

    complete(client, parent, task, papa)
    # Ein zweiter Tipp in Mamas Spalte legt keine zweite Erledigung an.
    complete(client, parent, task, mama)

    [entry] = today(client)["tasks"]
    assert entry["shared"] is True
    assert entry["done_member_ids"] == [papa]
    week = {p["member_id"]: p["week_done"] for p in today(client)["points"]}
    assert (week[mama], week[papa]) == (0, 1)

    # Mama kann Papas Erledigung zurücknehmen; die Gegenbuchung trifft Papa.
    undo(client, parent, task, mama)
    assert today(client)["tasks"][0]["done_member_ids"] == []
    assert points_of(client, papa)["total"] == 0

    complete(client, parent, task, papa)
    now["value"] += dt.timedelta(days=1)
    # Fälligkeit gilt für alle, auch wenn nur Papa es gemacht hat.
    assert due_of(client, task, mama) == day(7)
    assert due_of(client, task, papa) == day(7)


def test_not_shared_tasks_stay_per_member(client, parent, lena, now):
    from tests.test_tasks import add_member

    tom = add_member(client, parent, "Tom", "green")
    task = add_task(client, parent, [lena, tom], recurrence=WEEKLY_FROM_SATURDAY)

    complete(client, parent, task, lena)
    now["value"] += dt.timedelta(days=1)

    assert due_of(client, task, lena) == day(7)
    assert due_of(client, task, tom) == day(0)


def test_shared_option_is_stored(client, parent, lena):
    add_task(client, parent, [lena], shared=True)

    assert client.get("/api/tasks", headers=csrf(parent)).json()[0]["shared"] is True
