import pytest

from tests.conftest import csrf
from tests.test_points import book_manually, history, points_of
from tests.test_tasks import add_member


def reward_data(member_id, **overrides) -> dict:
    return {
        "member_id": member_id,
        "name": "Ein Eis",
        "icon": "fluent-emoji-flat:soft-ice-cream",
        "cost": 5,
        **overrides,
    }


def add_reward(client, me, member_id, **overrides) -> int:
    response = client.post(
        "/api/rewards", json=reward_data(member_id, **overrides), headers=csrf(me)
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def redeem(client, me, reward_id):
    return client.post(f"/api/rewards/{reward_id}/redeem", headers=csrf(me))


def add_parent_member(client, me, name="Mama", color="blue") -> int:
    response = client.post(
        "/api/members", json={"name": name, "role": "parent", "color": color}, headers=csrf(me)
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_create_update_list_and_delete(client, parent, lena):
    reward = add_reward(client, parent, lena, name="  Ein Eis ", description=" lecker ")

    response = client.put(
        f"/api/rewards/{reward}",
        json=reward_data(lena, cost=8, active=False),
        headers=csrf(parent),
    )
    assert response.status_code == 200, response.text

    assert client.get("/api/rewards").json() == [
        {
            "id": reward,
            "member_id": lena,
            "name": "Ein Eis",
            "icon": "fluent-emoji-flat:soft-ice-cream",
            "description": "",
            "cost": 8,
            "active": False,
        }
    ]

    assert client.delete(f"/api/rewards/{reward}", headers=csrf(parent)).status_code == 204
    assert client.get("/api/rewards").json() == []


def test_rewards_are_per_child(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    add_reward(client, parent, lena, cost=20)
    add_reward(client, parent, tom, cost=10)
    add_reward(client, parent, lena, cost=5)

    rewards = client.get("/api/rewards").json()

    assert [(r["member_id"], r["cost"]) for r in rewards] == [(lena, 5), (lena, 20), (tom, 10)]


def test_adults_get_no_rewards(client, parent):
    mama = add_parent_member(client, parent)

    response = client.post("/api/rewards", json=reward_data(mama), headers=csrf(parent))

    assert response.status_code == 409
    assert response.json() == {"code": "reward.child_only"}


@pytest.mark.parametrize(
    "overrides, field, code",
    [
        ({"cost": 0}, "cost", "validation.out_of_range"),
        ({"cost": 1001}, "cost", "validation.out_of_range"),
        ({"name": "  "}, "name", "validation.too_short"),
        ({"icon": "<svg>"}, "icon", "validation.invalid_format"),
    ],
)
def test_reward_validation(client, parent, lena, overrides, field, code):
    response = client.post(
        "/api/rewards", json=reward_data(lena, **overrides), headers=csrf(parent)
    )

    assert response.status_code == 422
    assert response.json()["fields"] == {field: code}


def test_managing_rewards_needs_parent_pin(client, parent, lena):
    reward = add_reward(client, parent, lena)
    client.post("/api/parent/lock", headers=csrf(parent))

    assert (
        client.post("/api/rewards", json=reward_data(lena), headers=csrf(parent)).status_code == 403
    )
    assert client.delete(f"/api/rewards/{reward}", headers=csrf(parent)).status_code == 403
    assert client.get("/api/redemptions").status_code == 403
    # Anzeigen und Einlösen gehen am Display ohne PIN.
    assert client.get("/api/rewards").status_code == 200
    assert redeem(client, parent, reward).json() == {"code": "reward.insufficient_points"}


def test_redeem_books_points_and_stores_redemption(client, parent, lena, now):
    book_manually(client, parent, lena, 12)
    reward = add_reward(client, parent, lena, name="Ein Eis", cost=5)

    response = redeem(client, parent, reward)

    assert response.status_code == 201, response.text
    redemption = response.json()
    assert redemption["status"] == "redeemed"
    assert (redemption["reward_name"], redemption["cost"]) == ("Ein Eis", 5)
    assert points_of(client, lena) == {"today": 0, "total": 7}
    transaction = history(client, lena)["transactions"][0]
    assert (transaction["kind"], transaction["amount"], transaction["reason"]) == (
        "reward_redeemed",
        -5,
        "Ein Eis",
    )
    assert transaction["icon"] == "fluent-emoji-flat:soft-ice-cream"


def test_redeem_with_too_few_points(client, parent, lena):
    book_manually(client, parent, lena, 4)
    reward = add_reward(client, parent, lena, cost=5)

    response = redeem(client, parent, reward)

    assert response.status_code == 409
    assert response.json() == {"code": "reward.insufficient_points"}
    assert history(client, lena)["total"] == 4
    assert client.get("/api/redemptions").json()["redemptions"] == []


def test_balance_never_goes_negative(client, parent, lena):
    book_manually(client, parent, lena, 7)
    reward = add_reward(client, parent, lena, cost=5)

    assert redeem(client, parent, reward).status_code == 201
    # Ein zweiter Tipp scheitert, statt den Stand ins Minus zu bringen.
    assert redeem(client, parent, reward).status_code == 409
    assert history(client, lena)["total"] == 2


def test_inactive_and_unknown_rewards_cannot_be_redeemed(client, parent, lena):
    book_manually(client, parent, lena, 50)
    reward = add_reward(client, parent, lena, active=False)

    assert redeem(client, parent, reward).json() == {"code": "reward.inactive"}
    assert redeem(client, parent, 999).json() == {"code": "reward.not_found"}


def test_history_survives_changes_to_reward(client, parent, lena):
    book_manually(client, parent, lena, 50)
    reward = add_reward(client, parent, lena, name="Kino", cost=40)
    redeem(client, parent, reward)

    client.delete(f"/api/rewards/{reward}", headers=csrf(parent))

    [redemption] = client.get("/api/redemptions").json()["redemptions"]
    assert (redemption["reward_id"], redemption["reward_name"], redemption["cost"]) == (
        None,
        "Kino",
        40,
    )
    assert history(client, lena)["transactions"][0]["reason"] == "Kino"


def test_redemptions_filtered_and_paged(client, parent, lena):
    tom = add_member(client, parent, "Tom", "green")
    book_manually(client, parent, lena, 100)
    book_manually(client, parent, tom, 100)
    for cost in (1, 2, 3):
        redeem(client, parent, add_reward(client, parent, lena, cost=cost))
    redeem(client, parent, add_reward(client, parent, tom, cost=4))

    everyone = client.get("/api/redemptions").json()["redemptions"]
    assert [r["cost"] for r in everyone] == [4, 3, 2, 1]

    first = client.get("/api/redemptions", params={"member_id": lena, "limit": 2}).json()
    assert [r["cost"] for r in first["redemptions"]] == [3, 2]
    assert first["has_more"] is True
    rest = client.get(
        "/api/redemptions",
        params={"member_id": lena, "before": first["redemptions"][-1]["id"]},
    ).json()
    assert [r["cost"] for r in rest["redemptions"]] == [1]
    assert rest["has_more"] is False
