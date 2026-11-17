import pytest

from app.companions import ITEMS, SPECIES, stage_for, tricks_for
from tests.conftest import csrf
from tests.test_points import book_manually, history, points_of
from tests.test_rewards import add_parent_member
from tests.test_today import add_task, complete


def companions(client) -> dict:
    response = client.get("/api/companions")
    assert response.status_code == 200, response.text
    return response.json()


def companion_of(client, member_id) -> dict:
    return next(c for c in companions(client)["companions"] if c["member_id"] == member_id)


def choose(client, me, member_id, species="fox", name=""):
    return client.put(
        f"/api/members/{member_id}/companion",
        json={"species": species, "name": name},
        headers=csrf(me),
    )


def buy(client, me, member_id, item):
    return client.post(f"/api/members/{member_id}/companion/items/{item}", headers=csrf(me))


def test_child_without_companion_starts_as_empty_egg(client, parent, lena):
    data = companions(client)
    assert data["species"] == list(SPECIES)
    assert {item["key"] for item in data["items"]} == set(ITEMS)
    assert data["companions"] == [
        {
            "member_id": lena,
            "mode": "both",
            "species": None,
            "name": "",
            "stage": "egg",
            "care_days": 0,
            "next_stage_at": 2,
            "tricks": [],
            "next_trick_at": 4,
            "owned": [],
            "equipped": {},
        }
    ]


def test_adults_have_no_companion(client, parent, lena):
    mama = add_parent_member(client, parent)
    assert [c["member_id"] for c in companions(client)["companions"]] == [lena]
    assert choose(client, parent, mama).json()["code"] == "companion.child_only"


def test_choose_once_then_only_rename(client, admin, lena, now):
    # Am Display ohne Eltern-PIN.
    response = choose(client, admin, lena, "snow_leopard", "  Flocke ")
    assert response.status_code == 200, response.text
    assert response.json()["species"] == "snow_leopard"
    assert response.json()["name"] == "Flocke"

    assert choose(client, admin, lena, "snow_leopard", "Schneeflocke").json()["name"] == (
        "Schneeflocke"
    )
    response = choose(client, admin, lena, "dragon")
    assert response.status_code == 409
    assert response.json()["code"] == "companion.already_chosen"
    assert choose(client, admin, lena, "tiger").json()["code"] == "companion.unknown_species"


def test_reset_needs_parent_area_and_keeps_items(client, parent, admin, lena, now):
    choose(client, parent, lena, "cat")
    book_manually(client, parent, lena, 20)
    assert buy(client, parent, lena, "ribbon").status_code == 201

    client.post("/api/parent/lock", headers=csrf(parent))
    assert client.delete(f"/api/members/{lena}/companion", headers=csrf(admin)).status_code == 403
    unlocked = client.post("/api/parent/unlock", json={"pin": "1234"}, headers=csrf(admin)).json()
    assert (
        client.delete(f"/api/members/{lena}/companion", headers=csrf(unlocked)).status_code == 204
    )

    data = companion_of(client, lena)
    assert data["species"] is None
    assert data["owned"] == ["ribbon"]
    assert choose(client, unlocked, lena, "dog").json()["species"] == "dog"


def test_completed_days_feed_growth(client, parent, lena, now):
    choose(client, parent, lena, "turtle")
    task = add_task(client, parent, [lena])
    assert complete(client, parent, task, lena).status_code == 204
    data = companion_of(client, lena)
    assert data["care_days"] == 1
    assert data["stage"] == "egg"


@pytest.mark.parametrize(
    ("days", "stage", "next_at"),
    [
        (0, "egg", 2),
        (1, "egg", 2),
        (2, "baby", 12),
        (11, "baby", 12),
        (12, "kid", 25),
        (25, "teen", 42),
        (42, "grown", None),
    ],
)
def test_stages(days, stage, next_at):
    assert stage_for(days) == (stage, next_at)


def test_tricks_spread_over_all_stages():
    assert tricks_for(3) == ([], 4)
    assert tricks_for(4) == (["spin"], 8)
    # Je Stufe zwei: Baby (2–11), Kind (12–24), Teenager (25–41), groß bis Tag 60.
    assert len(tricks_for(11)[0]) == 2
    assert len(tricks_for(24)[0]) == 4
    assert len(tricks_for(41)[0]) == 6
    assert tricks_for(59)[1] == 60
    learned, upcoming = tricks_for(1000)
    assert learned[-1] == "magic"
    assert upcoming is None


def test_buy_books_points_and_wears_item(client, parent, lena, now):
    choose(client, parent, lena, "unicorn")
    book_manually(client, parent, lena, 70)

    response = buy(client, parent, lena, "crown")
    assert response.status_code == 201, response.text
    assert response.json()["owned"] == ["crown"]
    assert response.json()["equipped"] == {"head": "crown"}
    assert points_of(client, lena)["total"] == 10
    assert history(client, lena)["transactions"][0]["kind"] == "companion_item"

    assert buy(client, parent, lena, "crown").json()["code"] == "companion.already_owned"
    response = buy(client, parent, lena, "ringed_planet")
    assert response.status_code == 409
    assert response.json()["code"] == "companion.insufficient_points"
    assert buy(client, parent, lena, "laser").json()["code"] == "companion.unknown_item"


def test_one_item_per_slot(client, parent, lena, now):
    choose(client, parent, lena, "penguin")
    book_manually(client, parent, lena, 100)
    buy(client, parent, lena, "ribbon")
    buy(client, parent, lena, "top_hat")
    assert companion_of(client, lena)["equipped"] == {"head": "top_hat"}

    url = f"/api/members/{lena}/companion/items/ribbon"
    response = client.put(url, json={"worn": True}, headers=csrf(parent))
    assert response.json()["equipped"] == {"head": "ribbon"}
    response = client.put(url, json={"worn": False}, headers=csrf(parent))
    assert response.json()["equipped"] == {}
    response = client.put(
        f"/api/members/{lena}/companion/items/crown", json={"worn": True}, headers=csrf(parent)
    )
    assert response.json()["code"] == "companion.not_owned"


def test_buying_needs_a_companion(client, parent, lena):
    book_manually(client, parent, lena, 100)
    assert buy(client, parent, lena, "ribbon").json()["code"] == "companion.not_found"


def test_mode_is_set_in_parent_area(client, parent, admin, lena):
    url = f"/api/members/{lena}/companion-mode"
    response = client.put(url, json={"mode": "companion"}, headers=csrf(parent))
    assert response.status_code == 200, response.text
    assert response.json()["mode"] == "companion"
    assert client.get("/api/members").json()[0]["companion_mode"] == "companion"

    assert client.put(url, json={"mode": "rewards"}, headers=csrf(parent)).status_code == 200
    assert choose(client, parent, lena).json()["code"] == "companion.disabled"
    assert client.put(url, json={"mode": "pets"}, headers=csrf(parent)).status_code == 422

    client.post("/api/parent/lock", headers=csrf(parent))
    assert client.put(url, json={"mode": "both"}, headers=csrf(admin)).status_code == 403
