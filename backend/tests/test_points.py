import datetime as dt

import pytest

from tests.conftest import csrf
from tests.test_tasks import add_member, task_data
from tests.test_today import add_task, complete, today, undo


def points_of(client, member_id) -> dict:
    """Heutige und gesamte Punkte einer Person laut Familienansicht."""
    entry = next(p for p in today(client)["points"] if p["member_id"] == member_id)
    return {"today": entry["today"], "total": entry["total"]}


def history(client, member_id, **params) -> dict:
    response = client.get(f"/api/members/{member_id}/points", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def book_manually(client, me, member_id, amount, reason="Zimmer aufgeräumt"):
    return client.post(
        f"/api/members/{member_id}/points",
        json={"amount": amount, "reason": reason},
        headers=csrf(me),
    )


def test_today_lists_points_for_every_member(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")

    assert today(client)["points"] == [
        {"member_id": lena, "today": 0, "total": 0},
        {"member_id": tom, "today": 0, "total": 0},
    ]


def test_completion_books_points_and_undo_books_them_back(client, parent, lena, now):
    task = add_task(client, parent, [lena], title="Zähne putzen", points=2)

    complete(client, parent, task, lena)
    assert points_of(client, lena) == {"today": 2, "total": 2}

    undo(client, parent, task, lena)
    assert points_of(client, lena) == {"today": 0, "total": 0}

    # Nichts wird gelöscht: Buchung und Gegenbuchung stehen in der Historie.
    transactions = history(client, lena)["transactions"]
    assert [(t["kind"], t["amount"], t["reason"]) for t in transactions] == [
        ("task_undone", -2, "Zähne putzen"),
        ("task_completed", 2, "Zähne putzen"),
    ]
    assert transactions[0]["icon"] == "fluent-emoji-flat:toothbrush"
    assert transactions[0]["task_date"] == "2026-10-03"


def test_double_tap_books_once(client, parent, lena, now):
    task = add_task(client, parent, [lena], points=3)

    complete(client, parent, task, lena)
    complete(client, parent, task, lena)
    assert points_of(client, lena)["total"] == 3

    undo(client, parent, task, lena)
    undo(client, parent, task, lena)
    assert points_of(client, lena)["total"] == 0
    assert len(history(client, lena)["transactions"]) == 2


def test_undo_books_back_the_original_points(client, parent, lena, now):
    task = add_task(client, parent, [lena], points=2)
    complete(client, parent, task, lena)

    client.put(f"/api/tasks/{task}", json=task_data([lena], points=5), headers=csrf(parent))
    undo(client, parent, task, lena)

    assert points_of(client, lena)["total"] == 0


def test_task_without_points_books_nothing(client, parent, lena, now):
    task = add_task(client, parent, [lena], points=0)

    complete(client, parent, task, lena)
    undo(client, parent, task, lena)

    assert history(client, lena)["transactions"] == []


def test_each_member_earns_separately(client, parent, lena, now):
    tom = add_member(client, parent, "Tom", "green")
    task = add_task(client, parent, [lena, tom], points=2)

    complete(client, parent, task, lena)

    assert points_of(client, lena)["total"] == 2
    assert points_of(client, tom)["total"] == 0


def test_points_today_start_fresh_each_day(client, parent, lena, now):
    task = add_task(client, parent, [lena], points=2)
    complete(client, parent, task, lena)

    now["value"] += dt.timedelta(days=1)

    assert points_of(client, lena) == {"today": 0, "total": 2}


def test_deleting_task_keeps_transactions(client, parent, lena, now):
    task = add_task(client, parent, [lena], title="Bett machen", points=2)
    complete(client, parent, task, lena)

    client.delete(f"/api/tasks/{task}", headers=csrf(parent))

    data = history(client, lena)
    assert data["total"] == 2
    assert data["transactions"][0]["reason"] == "Bett machen"
    assert data["transactions"][0]["icon"] is None


def test_manual_credit_and_deduction(client, parent, lena, now):
    response = book_manually(client, parent, lena, 5, "  Zimmer aufgeräumt ")
    assert response.status_code == 201, response.text
    assert response.json()["total"] == 5

    response = book_manually(client, parent, lena, -3, "Streit")
    assert response.json()["total"] == 2
    assert [(t["kind"], t["amount"], t["reason"]) for t in response.json()["transactions"]] == [
        ("manual", -3, "Streit"),
        ("manual", 5, "Zimmer aufgeräumt"),
    ]
    # Manuelle Buchungen zählen nicht als heute mit Aufgaben verdient.
    assert points_of(client, lena) == {"today": 0, "total": 2}


def test_deduction_cannot_make_balance_negative(client, parent, lena, now):
    book_manually(client, parent, lena, 2)

    response = book_manually(client, parent, lena, -3)

    assert response.status_code == 409
    assert response.json() == {"code": "points.insufficient"}
    assert history(client, lena)["total"] == 2


@pytest.mark.parametrize(
    "body, field, code",
    [
        ({"amount": 0, "reason": "x"}, "amount", "validation.not_zero"),
        ({"amount": 1001, "reason": "x"}, "amount", "validation.out_of_range"),
        ({"amount": 5, "reason": "  "}, "reason", "validation.too_short"),
        ({"amount": 5}, "reason", "validation.required"),
    ],
)
def test_manual_booking_validation(client, parent, lena, body, field, code):
    response = client.post(f"/api/members/{lena}/points", json=body, headers=csrf(parent))

    assert response.status_code == 422
    assert response.json()["fields"] == {field: code}


def test_points_area_needs_parent_pin(client, parent, lena):
    client.post("/api/parent/lock", headers=csrf(parent))

    assert client.get(f"/api/members/{lena}/points").status_code == 403
    assert book_manually(client, parent, lena, 5).status_code == 403


def test_unknown_member(client, parent):
    assert client.get("/api/members/999/points").json() == {"code": "member.not_found"}
    assert book_manually(client, parent, 999, 5).status_code == 404


def test_history_is_paged(client, parent, lena):
    for amount in range(1, 6):
        book_manually(client, parent, lena, amount)

    first = history(client, lena, limit=2)
    assert [t["amount"] for t in first["transactions"]] == [5, 4]
    assert first["has_more"] is True

    last = history(client, lena, limit=5, before=first["transactions"][-1]["id"])
    assert [t["amount"] for t in last["transactions"]] == [3, 2, 1]
    assert last["has_more"] is False
    assert last["total"] == 15
