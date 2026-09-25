import datetime as dt

import pytest

from app.models import TaskRecurrence
from app.recurrence import occurs_on
from tests.conftest import csrf


def add_member(client, me, name="Lena", color="purple") -> int:
    response = client.post(
        "/api/members", json={"name": name, "role": "child", "color": color}, headers=csrf(me)
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.fixture
def lena(client, parent) -> int:
    return add_member(client, parent)


def task_data(member_ids, **overrides) -> dict:
    return {
        "title": "Zähne putzen",
        "icon": "fluent-emoji-flat:toothbrush",
        "points": 2,
        "time_of_day": "morning",
        "recurrence": {"kind": "daily"},
        "member_ids": member_ids,
        **overrides,
    }


def create(client, me, data):
    return client.post("/api/tasks", json=data, headers=csrf(me))


def test_create_and_list_task(client, parent, lena):
    response = create(client, parent, task_data([lena], title="  Zähne putzen "))

    assert response.status_code == 201, response.text
    task = response.json()
    assert task == {
        "id": task["id"],
        "title": "Zähne putzen",
        "icon": "fluent-emoji-flat:toothbrush",
        "description": "",
        "points": 2,
        "time_of_day": "morning",
        "color": None,
        "active": True,
        "needs_approval": False,
        "recurrence": {"kind": "daily"},
        "member_ids": [lena],
    }
    assert client.get("/api/tasks").json() == [task]


@pytest.mark.parametrize(
    "recurrence, expected",
    [
        ({"kind": "weekly", "weekdays": [5, 1, 3, 1]}, {"kind": "weekly", "weekdays": [1, 3, 5]}),
        ({"kind": "once", "date": "2026-10-03"}, {"kind": "once", "date": "2026-10-03"}),
    ],
)
def test_recurrence_kinds(client, parent, lena, recurrence, expected):
    response = create(client, parent, task_data([lena], recurrence=recurrence))

    assert response.status_code == 201, response.text
    assert response.json()["recurrence"] == expected


def test_task_for_several_members(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")

    response = create(client, parent, task_data([tom, lena, tom]))

    assert response.json()["member_ids"] == sorted([lena, tom])


@pytest.mark.parametrize(
    "overrides, field, code",
    [
        ({"title": "   "}, "title", "validation.too_short"),
        ({"title": "x" * 101}, "title", "validation.too_long"),
        ({"icon": "kein icon"}, "icon", "validation.invalid_format"),
        ({"points": -1}, "points", "validation.out_of_range"),
        ({"points": 1001}, "points", "validation.out_of_range"),
        ({"time_of_day": "night"}, "time_of_day", "validation.invalid_choice"),
        ({"color": "pink"}, "color", "validation.invalid_choice"),
        ({"member_ids": []}, "member_ids", "validation.required"),
        ({"recurrence": {"kind": "monthly"}}, "recurrence", "validation.invalid_choice"),
        (
            {"recurrence": {"kind": "weekly", "weekdays": []}},
            "recurrence.weekly.weekdays",
            "validation.required",
        ),
        (
            {"recurrence": {"kind": "weekly", "weekdays": [0]}},
            "recurrence.weekly.weekdays.0",
            "validation.out_of_range",
        ),
        ({"recurrence": {"kind": "once"}}, "recurrence.once.date", "validation.required"),
    ],
)
def test_invalid_task_data(client, parent, lena, overrides, field, code):
    response = create(client, parent, {**task_data([lena]), **overrides})

    assert response.status_code == 422
    assert response.json()["fields"] == {field: code}


def test_unknown_member(client, parent, lena):
    response = create(client, parent, task_data([lena, 999]))

    assert response.status_code == 404
    assert response.json() == {"code": "member.not_found"}
    assert client.get("/api/tasks").json() == []


def test_update_task(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    task = create(client, parent, task_data([lena])).json()

    response = client.put(
        f"/api/tasks/{task['id']}",
        json=task_data(
            [tom],
            title="Bett machen",
            icon="fluent-emoji-flat:bed",
            points=1,
            time_of_day=None,
            color="teal",
            active=False,
            description=" Decke glatt ziehen ",
            recurrence={"kind": "weekly", "weekdays": [1, 2, 3, 4, 5]},
        ),
        headers=csrf(parent),
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": task["id"],
        "title": "Bett machen",
        "icon": "fluent-emoji-flat:bed",
        "description": "Decke glatt ziehen",
        "points": 1,
        "time_of_day": None,
        "color": "teal",
        "active": False,
        "needs_approval": False,
        "recurrence": {"kind": "weekly", "weekdays": [1, 2, 3, 4, 5]},
        "member_ids": [tom],
    }
    assert client.get("/api/tasks").json() == [response.json()]


def test_update_keeps_existing_assignments(client, parent, lena):
    from app.db import SessionLocal
    from app.models import TaskAssignment

    tom = add_member(client, parent, "Tom", "green")
    task = create(client, parent, task_data([lena])).json()

    def assignment_ids() -> dict[int, int]:
        with SessionLocal() as db:
            return {a.member_id: a.id for a in db.query(TaskAssignment)}

    before = assignment_ids()
    client.put(f"/api/tasks/{task['id']}", json=task_data([lena, tom]), headers=csrf(parent))

    after = assignment_ids()
    assert after[lena] == before[lena]
    assert set(after) == {lena, tom}


def test_delete_task(client, parent, lena):
    task = create(client, parent, task_data([lena])).json()

    response = client.delete(f"/api/tasks/{task['id']}", headers=csrf(parent))

    assert response.status_code == 204
    assert client.get("/api/tasks").json() == []


@pytest.mark.parametrize("method", ["put", "delete"])
def test_unknown_task(client, parent, lena, method):
    kwargs = {"json": task_data([lena])} if method == "put" else {}

    response = getattr(client, method)("/api/tasks/999", headers=csrf(parent), **kwargs)

    assert response.status_code == 404
    assert response.json() == {"code": "task.not_found"}


def test_deleting_member_removes_assignment_but_keeps_task(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    create(client, parent, task_data([lena, tom]))

    client.delete(f"/api/members/{lena}", headers=csrf(parent))

    [task] = client.get("/api/tasks").json()
    assert task["member_ids"] == [tom]


def test_tasks_need_unlocked_parent_area(client, admin):
    assert client.get("/api/tasks").status_code == 403
    response = client.post("/api/tasks", json={}, headers=csrf(admin))
    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_tasks_need_login_and_csrf(client, parent, lena):
    assert create(client, {"csrf_token": "falsch"}, task_data([lena])).status_code == 403
    client.cookies.clear()
    assert client.get("/api/tasks").status_code == 401


# --- Wiederholungsregeln -------------------------------------------------------

MONDAY = dt.date(2026, 9, 21)
WEEK = [MONDAY + dt.timedelta(days=offset) for offset in range(7)]


def days_matching(recurrence: TaskRecurrence) -> list[int]:
    return [day.isoweekday() for day in WEEK if occurs_on(recurrence, day)]


def test_daily_occurs_every_day():
    assert days_matching(TaskRecurrence(kind="daily")) == [1, 2, 3, 4, 5, 6, 7]


def test_weekly_occurs_on_chosen_weekdays():
    assert days_matching(TaskRecurrence(kind="weekly", weekdays=[1, 2, 3, 4, 5])) == [1, 2, 3, 4, 5]
    assert days_matching(TaskRecurrence(kind="weekly", weekdays=[6, 7])) == [6, 7]


def test_once_occurs_only_on_its_date():
    rule = TaskRecurrence(kind="once", date=dt.date(2026, 9, 24))

    assert days_matching(rule) == [4]
    assert not occurs_on(rule, dt.date(2026, 10, 1))


def test_unknown_kind_never_occurs():
    assert days_matching(TaskRecurrence(kind="monthly")) == []
