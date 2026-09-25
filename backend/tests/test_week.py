from tests.conftest import csrf
from tests.test_rewards import add_parent_member
from tests.test_today import add_task, complete

# „Heute“ ist Samstag, 3. Oktober 2026; die Woche beginnt am Montag, 28. September.


def week(client, **params) -> dict:
    response = client.get("/api/week", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def counts(data: dict, member_id: int) -> list[tuple[int, int]]:
    entry = next(m for m in data["members"] if m["member_id"] == member_id)
    return [(day["planned"], day["done"]) for day in entry["days"]]


def test_week_counts_planned_and_done_per_day(client, parent, lena, now):
    teeth = add_task(client, parent, [lena])
    add_task(
        client,
        parent,
        [lena],
        title="Hausaufgaben",
        recurrence={"kind": "weekly", "weekdays": [1, 2, 3, 4, 5]},
    )
    complete(client, parent, teeth, lena)

    data = week(client)
    assert (data["start"], data["today"]) == ("2026-09-28", "2026-10-03")
    assert counts(data, lena) == [(2, 0)] * 5 + [(1, 1), (1, 0)]


def test_week_can_be_browsed(client, parent, lena, now):
    add_task(client, parent, [lena])

    # Jeder Tag der Woche führt zu ihrem Montag.
    assert week(client, start="2026-10-01")["start"] == "2026-09-28"
    assert week(client, start="2026-10-05")["start"] == "2026-10-05"


def test_flexible_tasks_count_when_due_or_done(client, parent, lena, now):
    add_task(
        client,
        parent,
        [lena],
        recurrence={"kind": "flexible", "interval_days": 7, "date": "2026-09-29"},
    )

    # Seit Dienstag überfällig: zählt heute, nicht an den verpassten Tagen.
    assert counts(week(client), lena) == [(0, 0)] * 5 + [(1, 0), (0, 0)]


def test_shared_task_counts_as_done_for_everyone(client, parent, lena, now):
    mama = add_parent_member(client, parent)
    papa = add_parent_member(client, parent, "Papa", "orange")
    task = add_task(client, parent, [mama, papa], shared=True)
    complete(client, parent, task, papa)

    data = week(client)
    assert counts(data, mama)[5] == (1, 1)
    assert counts(data, papa)[5] == (1, 1)


def test_week_needs_parent_pin(client, parent, lena):
    client.post("/api/parent/lock", headers=csrf(parent))

    assert client.get("/api/week").status_code == 403
