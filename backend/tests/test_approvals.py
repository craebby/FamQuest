import datetime as dt

from tests.conftest import csrf
from tests.test_points import history, points_of
from tests.test_today import add_task, complete, today, undo


def approvals(client) -> list[dict]:
    response = client.get("/api/approvals")
    assert response.status_code == 200, response.text
    return response.json()


def approve(client, me, completion_id):
    return client.post(f"/api/approvals/{completion_id}", headers=csrf(me))


def reject(client, me, completion_id):
    return client.delete(f"/api/approvals/{completion_id}", headers=csrf(me))


def room_task(client, me, member_ids) -> int:
    return add_task(
        client,
        me,
        member_ids,
        title="Zimmer aufräumen",
        icon="fluent-emoji-flat:teddy-bear",
        points=5,
        needs_approval=True,
    )


def test_task_stores_approval_option(client, parent, lena):
    task = room_task(client, parent, [lena])

    [data] = client.get("/api/tasks").json()
    assert (data["id"], data["needs_approval"]) == (task, True)


def test_completion_waits_for_parents_without_points(client, parent, lena, now):
    task = room_task(client, parent, [lena])

    complete(client, parent, task, lena)

    [entry] = today(client)["tasks"]
    assert entry["needs_approval"] is True
    assert entry["done_member_ids"] == [lena]
    assert entry["pending_member_ids"] == [lena]
    assert today(client)["pending_approvals"] == 1
    assert points_of(client, lena) == {"today": 0, "total": 0}
    [pending] = approvals(client)
    assert (pending["title"], pending["points"], pending["member_id"], pending["date"]) == (
        "Zimmer aufräumen",
        5,
        lena,
        "2026-10-03",
    )


def test_approve_books_points_once(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)
    [pending] = approvals(client)

    assert approve(client, parent, pending["id"]).status_code == 204
    # Doppelter Tipp: nichts passiert zweimal.
    assert approve(client, parent, pending["id"]).json() == {"code": "approval.not_found"}

    assert points_of(client, lena) == {"today": 5, "total": 5}
    assert today(client)["tasks"][0]["pending_member_ids"] == []
    assert today(client)["pending_approvals"] == 0
    assert approvals(client) == []
    [transaction] = history(client, lena)["transactions"]
    assert (transaction["kind"], transaction["amount"]) == ("task_completed", 5)

    # Rückgängig nach der Kontrolle bucht die Punkte zurück.
    undo(client, parent, task, lena)
    assert points_of(client, lena)["total"] == 0


def test_reject_reopens_the_task(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)
    [pending] = approvals(client)

    assert reject(client, parent, pending["id"]).status_code == 204

    assert today(client)["tasks"][0]["done_member_ids"] == []
    assert history(client, lena)["transactions"] == []
    # Das Kind kann es nochmal versuchen.
    complete(client, parent, task, lena)
    assert len(approvals(client)) == 1


def test_undo_before_approval_books_nothing(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)

    undo(client, parent, task, lena)

    assert approvals(client) == []
    assert history(client, lena)["transactions"] == []


def test_earlier_days_stay_approvable(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)
    now["value"] += dt.timedelta(days=1)

    [pending] = approvals(client)
    assert pending["date"] == "2026-10-03"
    approve(client, parent, pending["id"])

    # Die Punkte zählen für den Tag der Erledigung, nicht für heute.
    assert points_of(client, lena) == {"today": 0, "total": 5}
    assert history(client, lena)["transactions"][0]["task_date"] == "2026-10-03"


def test_week_counts_only_approved(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)

    week_done = {p["member_id"]: p["week_done"] for p in today(client)["points"]}
    assert week_done[lena] == 0


def test_approvals_need_parent_pin(client, parent, lena, now):
    task = room_task(client, parent, [lena])
    complete(client, parent, task, lena)
    client.post("/api/parent/lock", headers=csrf(parent))

    assert client.get("/api/approvals").status_code == 403
    assert approve(client, parent, 1).status_code == 403
    assert reject(client, parent, 1).status_code == 403
    # Am Display bleibt der Zähler sichtbar.
    assert today(client)["pending_approvals"] == 1
