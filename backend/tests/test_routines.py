import datetime as dt

import sqlalchemy as sa
from alembic import command

from app.db import SessionLocal
from tests.conftest import SATURDAY, alembic_config, csrf
from tests.test_task_week import add_task as add_week_task
from tests.test_tasks import add_member, task_data
from tests.test_today import complete, today

# Die Uhr (Fixture `now`) steht auf Samstag, 3. Oktober 2026.
WEEKDAYS = [1, 2, 3, 4, 5]
WEEKEND = [6, 7]


def add_task(client, me, member_ids, **overrides) -> int:
    response = client.post("/api/tasks", json=task_data(member_ids, **overrides), headers=csrf(me))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def new_routine(client, me, member_id, weekdays, time_of_day="morning", **extra) -> dict:
    response = client.post(
        "/api/routines",
        json={"member_id": member_id, "time_of_day": time_of_day, "weekdays": weekdays, **extra},
        headers=csrf(me),
    )
    assert response.status_code == 201, response.text
    return response.json()


def set_steps(client, me, routine_id, steps):
    return client.put(f"/api/routines/{routine_id}/steps", json={"steps": steps}, headers=csrf(me))


def routines(client) -> list[dict]:
    response = client.get("/api/routines")
    assert response.status_code == 200, response.text
    return response.json()


def lena_today(client, lena) -> list[tuple[str, int, bool]]:
    """Heutige Aufgaben von Lena als (Titel, Platz, optional), in ihrer Reihenfolge."""
    result = []
    for task in today(client)["tasks"]:
        if lena not in task["member_ids"]:
            continue
        slot = next(p for p in task["positions"] if p["member_id"] == lena)
        result.append((task["title"], slot["position"], slot["optional"]))
    return sorted(result, key=lambda entry: entry[1])


def test_routine_decides_the_days_and_order(client, parent, lena, now):
    teeth = add_task(client, parent, [lena])
    dress = add_task(client, parent, [lena], title="Anziehen")
    teddy = add_task(client, parent, [lena], title="Kuscheltier")
    week = new_routine(client, parent, lena, WEEKDAYS)
    weekend = new_routine(client, parent, lena, WEEKEND)
    set_steps(client, parent, week["id"], [{"task_id": teeth}, {"task_id": dress}])
    response = set_steps(
        client,
        parent,
        weekend["id"],
        [{"task_id": dress}, {"task_id": teeth}, {"task_id": teddy, "optional": True}],
    )
    assert response.status_code == 200, response.text
    assert response.json()["steps"] == [
        {"task_id": dress, "optional": False},
        {"task_id": teeth, "optional": False},
        {"task_id": teddy, "optional": True},
    ]

    # Samstag: die Wochenend-Variante, in ihrer Reihenfolge, Kuscheltier optional.
    assert lena_today(client, lena) == [
        ("Anziehen", 0, False),
        ("Zähne putzen", 1, False),
        ("Kuscheltier", 2, True),
    ]
    assert complete(client, parent, teddy, lena).status_code == 204

    # Am Montag gilt die andere Variante: kein Kuscheltier, und es lässt sich nicht erledigen.
    now["value"] += dt.timedelta(days=2)
    assert lena_today(client, lena) == [("Zähne putzen", 0, False), ("Anziehen", 1, False)]
    monday = "2026-10-05"
    assert complete(client, parent, teddy, lena, monday).json()["code"] == "task.not_due"


def test_task_recurrence_still_applies_to_others(client, parent, lena, now):
    """Für Personen ohne Routine gilt weiter die Wiederholung der Aufgabe."""
    tom = add_member(client, parent, "Tom", "green")
    teeth = add_task(client, parent, [lena, tom])
    new_routine(client, parent, lena, WEEKDAYS)  # nur werktags, ohne diesen Schritt
    routine = new_routine(client, parent, lena, [3])
    set_steps(client, parent, routine["id"], [{"task_id": teeth}])

    [task] = today(client)["tasks"]
    # Samstag: für Lena nicht (ihre Routine hat den Schritt nur mittwochs), für Tom schon.
    assert task["member_ids"] == [tom]
    assert task["positions"] == [{"member_id": tom, "position": 1000, "optional": False}]


def test_days_are_exclusive_per_time_of_day(client, parent, lena):
    everyday = new_routine(client, parent, lena, [1, 2, 3, 4, 5, 6, 7])
    evening = new_routine(client, parent, lena, [1, 2, 3, 4, 5, 6, 7], time_of_day="evening")
    weekend = new_routine(client, parent, lena, WEEKEND)

    days = {r["id"]: r["weekdays"] for r in routines(client)}
    assert days == {
        everyday["id"]: WEEKDAYS,
        evening["id"]: [1, 2, 3, 4, 5, 6, 7],
        weekend["id"]: WEEKEND,
    }

    response = client.put(
        f"/api/routines/{everyday['id']}/days",
        json={"weekdays": [1, 2, 3, 4, 5, 6]},
        headers=csrf(parent),
    )
    assert response.status_code == 200, response.text
    days = {r["id"]: r["weekdays"] for r in response.json()}
    assert (days[everyday["id"]], days[weekend["id"]]) == ([1, 2, 3, 4, 5, 6], [7])


def test_copy_to_another_child(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    teeth = add_task(client, parent, [lena])
    dress = add_task(client, parent, [lena], title="Anziehen")
    source = new_routine(client, parent, lena, WEEKDAYS)
    set_steps(
        client, parent, source["id"], [{"task_id": dress}, {"task_id": teeth, "optional": True}]
    )

    copy = new_routine(client, parent, tom, [1, 2, 3, 4, 5, 6, 7], copy_from=source["id"])
    assert copy["steps"] == [
        {"task_id": dress, "optional": False},
        {"task_id": teeth, "optional": True},
    ]
    # Tom hat die Aufgaben jetzt auch; Punkte und Erledigung bleiben je Person getrennt.
    tasks = {t["id"]: t for t in client.get("/api/tasks").json()}
    assert tasks[teeth]["member_ids"] == [lena, tom]
    assert tasks[teeth]["routine_member_ids"] == [lena, tom]


def test_add_new_and_existing_steps(client, parent, lena):
    routine = new_routine(client, parent, lena, WEEKDAYS)
    response = client.post(
        f"/api/routines/{routine['id']}/steps",
        # Kind, Tagesabschnitt und „Extra“ bestimmt die Routine, nicht die Eingabe.
        json={"task": task_data([999], title="Brotdose", time_of_day=None, extra=True)},
        headers=csrf(parent),
    )
    assert response.status_code == 201, response.text
    [step] = response.json()["steps"]
    task = client.get("/api/tasks").json()[0]
    assert (task["id"], task["title"], task["time_of_day"], task["extra"], task["member_ids"]) == (
        step["task_id"],
        "Brotdose",
        "morning",
        False,
        [lena],
    )

    teeth = add_task(client, parent, [lena])
    response = client.post(
        f"/api/routines/{routine['id']}/steps",
        json={"task_id": teeth, "optional": True},
        headers=csrf(parent),
    )
    assert response.json()["steps"][-1] == {"task_id": teeth, "optional": True}


def test_invalid_steps_are_rejected(client, parent, lena):
    routine = new_routine(client, parent, lena, WEEKDAYS)
    evening = add_task(client, parent, [lena], time_of_day="evening")
    extra = add_task(client, parent, [lena], time_of_day=None, extra=True)
    teeth = add_task(client, parent, [lena])

    for steps in ([{"task_id": evening}], [{"task_id": extra}], [{"task_id": teeth}] * 2):
        response = set_steps(client, parent, routine["id"], steps)
        assert (response.status_code, response.json()["code"]) == (409, "routine.step_invalid")
    assert set_steps(client, parent, routine["id"], [{"task_id": 999}]).status_code == 404

    response = client.post(f"/api/routines/{routine['id']}/steps", json={}, headers=csrf(parent))
    assert response.status_code == 422


def test_routines_only_for_children(client, parent):
    mum = client.post(
        "/api/members",
        json={"name": "Mama", "role": "parent", "color": "blue"},
        headers=csrf(parent),
    ).json()["id"]
    response = client.post(
        "/api/routines",
        json={"member_id": mum, "time_of_day": "morning", "weekdays": [1]},
        headers=csrf(parent),
    )
    assert (response.status_code, response.json()["code"]) == (409, "routine.child_only")


def test_removing_steps_and_routines_unassigns_the_task(client, parent, lena):
    teeth = add_task(client, parent, [lena])
    week = new_routine(client, parent, lena, WEEKDAYS)
    weekend = new_routine(client, parent, lena, WEEKEND)
    set_steps(client, parent, week["id"], [{"task_id": teeth}])
    set_steps(client, parent, weekend["id"], [{"task_id": teeth}])

    # Noch in der Wochenend-Variante: bleibt zugeordnet.
    set_steps(client, parent, week["id"], [])
    assert client.get("/api/tasks").json()[0]["member_ids"] == [lena]

    assert client.delete(f"/api/routines/{weekend['id']}", headers=csrf(parent)).status_code == 204
    task = client.get("/api/tasks").json()[0]
    assert (task["member_ids"], task["routine_member_ids"]) == ([], [])


def test_task_editor_keeps_routine_consistent(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    teeth = add_task(client, parent, [lena, tom])
    routine = new_routine(client, parent, lena, WEEKDAYS)
    set_steps(client, parent, routine["id"], [{"task_id": teeth}])

    # Tagesabschnitt eines Routinenschritts lässt sich nicht einfach ändern.
    response = client.put(
        f"/api/tasks/{teeth}",
        json=task_data([lena, tom], time_of_day="evening"),
        headers=csrf(parent),
    )
    assert (response.status_code, response.json()["code"]) == (409, "task.in_routine")

    # Lena abwählen: Ihr Routinenschritt verschwindet mit.
    response = client.put(f"/api/tasks/{teeth}", json=task_data([tom]), headers=csrf(parent))
    assert response.status_code == 200, response.text
    assert response.json()["routine_member_ids"] == []
    assert routines(client)[0]["steps"] == []


def test_routines_need_unlocked_parent_area(client, admin):
    assert client.get("/api/routines").status_code == 403


def test_week_view_uses_routine_positions(client, parent, lena, now):
    # Mit festem Anlegedatum vor der Woche, damit der Test nicht vom echten Datum abhängt.
    teeth = add_week_task(client, parent, [lena])
    dress = add_week_task(client, parent, [lena], title="Anziehen")
    week = new_routine(client, parent, lena, WEEKDAYS)
    weekend = new_routine(client, parent, lena, WEEKEND)
    set_steps(client, parent, week["id"], [{"task_id": teeth}, {"task_id": dress}])
    set_steps(client, parent, weekend["id"], [{"task_id": dress, "optional": True}])

    data = client.get("/api/tasks/week").json()
    by_day = {
        d["date"]: [(e["task_id"], e["position"], e["optional"]) for e in d["entries"]]
        for d in data["days"]
    }
    assert sorted(by_day["2026-10-01"]) == [(teeth, 0, False), (dress, 1, False)]
    assert by_day[SATURDAY] == [(dress, 0, True)]


MEMBER = "INSERT INTO family_members (id, name, role, color) VALUES (:id, :name, :role, :color)"
TASK = (
    "INSERT INTO tasks (id, title, icon, points, time_of_day, extra)"
    " VALUES (:id, :title, 'x', 1, :time_of_day, :extra)"
)
RECURRENCE = (
    "INSERT INTO task_recurrences (task_id, kind, weekdays, date)"
    " VALUES (:id, :kind, :weekdays, :date)"
)
ASSIGNMENT = (
    "INSERT INTO task_assignments (task_id, member_id, position) VALUES (:id, :member, :position)"
)
MIGRATED = (
    "SELECT r.member_id, r.time_of_day, r.weekdays, array_agg(s.task_id ORDER BY s.position)"
    " FROM routines r JOIN routine_steps s ON s.routine_id = r.id GROUP BY r.id ORDER BY r.weekdays"
)


def test_migration_turns_child_tasks_into_routines():
    """Bestehende Aufgaben: gleiche Wochentage werden eine Variante, Reihenfolge bleibt."""
    config = alembic_config()
    command.downgrade(config, "5ec074ee95f5")
    tasks = [
        # id, Titel, Tagesabschnitt, extra, Wiederholung, Wochentage, Person, Platz
        (1, "Zähne", "morning", False, "daily", None, 1, 1),
        (2, "Brotdose", "morning", False, "weekly", [1, 2, 3, 4, 5], 1, 0),
        (3, "Tisch", None, True, "daily", None, 1, 2),
        (4, "Kochen", "morning", False, "daily", None, 2, 0),
        (5, "Arzt", "morning", False, "once", None, 1, 3),
    ]
    with SessionLocal() as db:
        db.execute(sa.text(MEMBER), {"id": 1, "name": "Lena", "role": "child", "color": "purple"})
        db.execute(sa.text(MEMBER), {"id": 2, "name": "Mama", "role": "parent", "color": "blue"})
        for task_id, title, time_of_day, extra, kind, weekdays, member, position in tasks:
            params = {"id": task_id, "member": member, "position": position}
            db.execute(
                sa.text(TASK),
                {**params, "title": title, "time_of_day": time_of_day, "extra": extra},
            )
            date = "2026-10-05" if kind == "once" else None
            db.execute(
                sa.text(RECURRENCE), {**params, "kind": kind, "weekdays": weekdays, "date": date}
            )
            db.execute(sa.text(ASSIGNMENT), params)
        db.commit()
    command.upgrade(config, "head")

    with SessionLocal() as db:
        rows = [tuple(row) for row in db.execute(sa.text(MIGRATED))]
    assert rows == [
        (1, "morning", [1, 2, 3, 4, 5], [2, 1]),
        (1, "morning", [6, 7], [1]),
    ]
