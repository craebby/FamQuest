import datetime as dt

import pytest

from tests.conftest import SATURDAY, csrf
from tests.test_tasks import add_member, create, task_data


def add_task(client, me, member_ids, **overrides) -> int:
    response = create(client, me, task_data(member_ids, **overrides))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def completion_url(task_id, member_id, date=SATURDAY):
    return f"/api/today/tasks/{task_id}/members/{member_id}?date={date}"


def complete(client, me, task_id, member_id, date=SATURDAY):
    return client.put(completion_url(task_id, member_id, date), headers=csrf(me))


def undo(client, me, task_id, member_id, date=SATURDAY):
    return client.delete(completion_url(task_id, member_id, date), headers=csrf(me))


def today(client) -> dict:
    response = client.get("/api/today")
    assert response.status_code == 200, response.text
    return response.json()


def test_today_uses_family_timezone(client, parent, lena, now):
    weekend = add_task(client, parent, [lena], recurrence={"kind": "weekly", "weekdays": [6, 7]})
    friday = add_task(client, parent, [lena], recurrence={"kind": "weekly", "weekdays": [5]})

    data = today(client)

    # In UTC wäre noch Freitag, in Berlin ist schon Samstag.
    assert data["date"] == SATURDAY
    assert data["time_of_day"] == "morning"
    assert [task["id"] for task in data["tasks"]] == [weekend]
    assert friday not in [task["id"] for task in data["tasks"]]


@pytest.mark.parametrize(
    "local_time, expected",
    [("10:59", "morning"), ("11:00", "midday"), ("14:00", "afternoon"), ("18:00", "evening")],
)
def test_current_time_of_day(client, parent, now, local_time, expected):
    hour, minute = map(int, local_time.split(":"))
    # Berlin ist im Oktober UTC+2 (Sommerzeit bis 25.10.).
    now["value"] = dt.datetime(2026, 10, 3, hour - 2, minute, tzinfo=dt.UTC)

    assert today(client)["time_of_day"] == expected


def test_today_lists_only_due_active_assigned_tasks(client, parent, lena, now):
    due = add_task(client, parent, [lena], title="Bett machen", icon="fluent-emoji-flat:bed")
    add_task(client, parent, [lena], active=False)
    add_task(client, parent, [lena], recurrence={"kind": "once", "date": "2026-10-04"})
    once = add_task(client, parent, [lena], recurrence={"kind": "once", "date": SATURDAY})
    # Aufgabe, deren einzige Person gelöscht wurde.
    tom = add_member(client, parent, "Tom", "green")
    add_task(client, parent, [tom])
    client.delete(f"/api/members/{tom}", headers=csrf(parent))

    tasks = today(client)["tasks"]

    assert [task["id"] for task in tasks] == [due, once]
    assert tasks[0] == {
        "id": due,
        "title": "Bett machen",
        "icon": "fluent-emoji-flat:bed",
        "points": 2,
        "time_of_day": "morning",
        "color": None,
        "member_ids": [lena],
        "done_member_ids": [],
    }


def test_complete_and_undo(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    task = add_task(client, parent, [lena, tom])

    assert complete(client, parent, task, lena).status_code == 204
    assert today(client)["tasks"][0]["done_member_ids"] == [lena]

    assert undo(client, parent, task, lena).status_code == 204
    assert today(client)["tasks"][0]["done_member_ids"] == []


def test_completion_of_removed_assignment_is_hidden(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    task = add_task(client, parent, [lena, tom])
    complete(client, parent, task, tom)

    client.put(f"/api/tasks/{task}", json=task_data([lena]), headers=csrf(parent))

    assert today(client)["tasks"][0]["done_member_ids"] == []


def test_double_tap_counts_once(client, parent, lena, now):
    task = add_task(client, parent, [lena])

    assert complete(client, parent, task, lena).status_code == 204
    assert complete(client, parent, task, lena).status_code == 204
    assert undo(client, parent, task, lena).status_code == 204
    assert undo(client, parent, task, lena).status_code == 204

    assert today(client)["tasks"][0]["done_member_ids"] == []


def test_completion_is_per_day(client, parent, lena, now):
    task = add_task(client, parent, [lena])
    complete(client, parent, task, lena)

    now["value"] += dt.timedelta(days=1)

    data = today(client)
    assert data["date"] == "2026-10-04"
    assert data["tasks"][0]["done_member_ids"] == []


def test_stale_date_is_rejected(client, parent, lena, now):
    task = add_task(client, parent, [lena])

    # Das Display zeigt noch Freitag, in Berlin ist es aber schon Samstag.
    response = complete(client, parent, task, lena, date="2026-10-02")

    assert response.status_code == 409
    assert response.json() == {"code": "completion.day_changed"}


@pytest.mark.parametrize("case", ["unassigned", "inactive", "not_today"])
def test_task_must_be_due_for_member(client, parent, lena, now, case):
    tom = add_member(client, parent, "Tom", "green")
    overrides = {
        "unassigned": {},
        "inactive": {"active": False},
        "not_today": {"recurrence": {"kind": "weekly", "weekdays": [1]}},
    }[case]
    task = add_task(client, parent, [tom], **overrides)
    member = lena if case == "unassigned" else tom

    response = complete(client, parent, task, member)

    assert response.status_code == 409
    assert response.json() == {"code": "task.not_due"}


def test_unknown_task(client, parent, lena, now):
    response = complete(client, parent, 999, lena)

    assert response.status_code == 404
    assert response.json() == {"code": "task.not_found"}


def test_invalid_date(client, parent, lena, now):
    task = add_task(client, parent, [lena])

    response = complete(client, parent, task, lena, date="gestern")

    assert response.status_code == 422


def test_family_view_works_without_parent_pin(client, parent, lena, now):
    task = add_task(client, parent, [lena])
    client.post("/api/parent/lock", headers=csrf(parent))
    assert client.get("/api/tasks").status_code == 403

    assert complete(client, parent, task, lena).status_code == 204
    assert today(client)["tasks"][0]["done_member_ids"] == [lena]


def test_family_view_needs_login_and_csrf(client, parent, lena, now):
    task = add_task(client, parent, [lena])

    response = client.put(completion_url(task, lena))
    assert response.status_code == 403
    assert response.json() == {"code": "auth.csrf_failed"}

    client.cookies.clear()
    assert client.get("/api/today").status_code == 401
    assert complete(client, parent, task, lena).status_code == 401


def test_deleting_task_removes_completions(client, parent, lena, now):
    task = add_task(client, parent, [lena])
    complete(client, parent, task, lena)

    assert client.delete(f"/api/tasks/{task}", headers=csrf(parent)).status_code == 204
    assert today(client)["tasks"] == []


def test_week_counts_completions_since_monday(client, parent, lena, now):
    from tests.test_rewards import add_parent_member

    mama = add_parent_member(client, parent)
    papa = add_parent_member(client, parent, "Papa", "orange")
    task = add_task(client, parent, [mama, papa], points=1)

    def week_done() -> dict[int, int]:
        return {p["member_id"]: p["week_done"] for p in today(client)["points"]}

    complete(client, parent, task, mama)
    complete(client, parent, task, papa)
    now["value"] += dt.timedelta(days=1)
    complete(client, parent, task, mama, date="2026-10-04")

    data = today(client)
    assert data["week_start"] == "2026-09-28"
    assert week_done() == {lena: 0, mama: 2, papa: 1}

    # Neue Woche ab Montag in der Zeitzone der Familie.
    now["value"] += dt.timedelta(days=1)
    assert today(client)["week_start"] == "2026-10-05"
    assert week_done() == {lena: 0, mama: 0, papa: 0}
