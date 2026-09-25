from io import BytesIO

import pytest
from PIL import Image

from app.avatars import MAX_UPLOAD_BYTES
from tests.conftest import UPLOAD_DIR, csrf

LENA = {"name": "Lena", "role": "child", "color": "purple"}


def create(client, me, **overrides):
    return client.post("/api/members", json={**LENA, **overrides}, headers=csrf(me))


def image_bytes(fmt="PNG", size=(800, 600), color="red") -> bytes:
    output = BytesIO()
    Image.new("RGB", size, color).save(output, fmt)
    return output.getvalue()


def upload(client, me, member_id, data, content_type="image/png"):
    return client.put(
        f"/api/members/{member_id}/avatar",
        content=data,
        headers={**csrf(me), "Content-Type": content_type},
    )


def avatar_files() -> list[str]:
    directory = UPLOAD_DIR / "avatars"
    return sorted(path.name for path in directory.iterdir()) if directory.exists() else []


def test_create_and_list_members(client, parent):
    response = create(client, parent, name="  Lena  ")

    assert response.status_code == 201
    member = response.json()
    assert member == {
        "id": member["id"],
        "name": "Lena",
        "role": "child",
        "color": "purple",
        "avatar_url": None,
    }
    create(client, parent, name="Papa", role="parent", color="blue")

    members = client.get("/api/members").json()
    assert [m["name"] for m in members] == ["Lena", "Papa"]


def test_list_needs_login_but_no_pin(client, admin):
    assert client.get("/api/members").status_code == 200
    client.cookies.clear()
    assert client.get("/api/members").status_code == 401


def test_changes_need_unlocked_parent_area(client, admin):
    response = create(client, admin)

    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_changes_need_csrf_token(client, parent):
    response = client.post("/api/members", json=LENA)

    assert response.status_code == 403
    assert response.json() == {"code": "auth.csrf_failed"}


def test_color_can_only_be_used_once(client, parent):
    create(client, parent)

    response = create(client, parent, name="Tom")

    assert response.status_code == 409
    assert response.json() == {"code": "member.color_taken"}


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("name", "   ", "validation.too_short"),
        ("name", "x" * 51, "validation.too_long"),
        ("role", "admin", "validation.invalid_choice"),
        ("color", "pink", "validation.invalid_choice"),
    ],
)
def test_invalid_member_data(client, parent, field, value, code):
    response = create(client, parent, **{field: value})

    assert response.status_code == 422
    assert response.json()["fields"] == {field: code}


def test_update_member(client, parent):
    member = create(client, parent).json()

    response = client.put(
        f"/api/members/{member['id']}",
        json={"name": "Lena Marie", "role": "child", "color": "green"},
        headers=csrf(parent),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Lena Marie"
    assert response.json()["color"] == "green"


def test_keeping_own_color_is_allowed_but_not_taking_another(client, parent):
    lena = create(client, parent).json()
    create(client, parent, name="Tom", color="orange")

    same = client.put(f"/api/members/{lena['id']}", json=LENA, headers=csrf(parent))
    taken = client.put(
        f"/api/members/{lena['id']}", json={**LENA, "color": "orange"}, headers=csrf(parent)
    )

    assert same.status_code == 200
    assert taken.status_code == 409
    assert taken.json() == {"code": "member.color_taken"}


def test_unknown_member(client, parent):
    response = client.put("/api/members/999", json=LENA, headers=csrf(parent))

    assert response.status_code == 404
    assert response.json() == {"code": "member.not_found"}


def test_delete_member_frees_color_and_avatar(client, parent):
    member = create(client, parent).json()
    upload(client, parent, member["id"], image_bytes())

    response = client.delete(f"/api/members/{member['id']}", headers=csrf(parent))

    assert response.status_code == 204
    assert client.get("/api/members").json() == []
    assert avatar_files() == []
    assert create(client, parent).status_code == 201


@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
def test_avatar_is_square_512_webp(client, parent, fmt):
    member = create(client, parent).json()

    response = upload(client, parent, member["id"], image_bytes(fmt), f"image/{fmt.lower()}")

    assert response.status_code == 200
    avatar_url = response.json()["avatar_url"]
    assert avatar_url.startswith("/api/avatars/")
    image_response = client.get(avatar_url)
    assert image_response.status_code == 200
    assert image_response.headers["content-type"] == "image/webp"
    with Image.open(BytesIO(image_response.content)) as image:
        assert (image.format, image.size) == ("WEBP", (512, 512))


def test_avatar_respects_exif_orientation(client, parent):
    member = create(client, parent).json()
    # 100 × 50, links rot, rechts blau; EXIF sagt „90° drehen“ (Orientation 6).
    image = Image.new("RGB", (100, 50), "red")
    image.paste("blue", (50, 0, 100, 50))
    exif = Image.Exif()
    exif[0x0112] = 6
    output = BytesIO()
    image.save(output, "JPEG", exif=exif)

    url = upload(client, parent, member["id"], output.getvalue(), "image/jpeg").json()["avatar_url"]

    with Image.open(BytesIO(client.get(url).content)) as avatar:
        # Nach dem Drehen ist oben rot und unten blau.
        top = avatar.convert("RGB").getpixel((256, 10))
        bottom = avatar.convert("RGB").getpixel((256, 500))
    assert top[0] > 200 and top[2] < 60
    assert bottom[2] > 200 and bottom[0] < 60


def test_avatar_content_is_checked_not_the_type(client, parent):
    member = create(client, parent).json()

    response = upload(client, parent, member["id"], b"<svg></svg>", "image/png")

    assert response.status_code == 422
    assert response.json() == {"code": "avatar.invalid_image"}


def test_gif_is_rejected(client, parent):
    member = create(client, parent).json()

    response = upload(client, parent, member["id"], image_bytes("GIF"), "image/gif")

    assert response.status_code == 422
    assert response.json() == {"code": "avatar.invalid_image"}


def test_avatar_too_large(client, parent):
    member = create(client, parent).json()

    response = upload(client, parent, member["id"], b"0" * (MAX_UPLOAD_BYTES + 1))

    assert response.status_code == 413
    assert response.json() == {"code": "avatar.too_large"}


def test_avatar_with_huge_pixel_count_is_rejected(client, parent):
    member = create(client, parent).json()
    # Einfarbige PNGs komprimieren extrem gut: klein als Datei, riesig im Speicher.
    data = image_bytes("PNG", size=(10_000, 6_000), color="white")
    assert len(data) < MAX_UPLOAD_BYTES

    response = upload(client, parent, member["id"], data)

    assert response.status_code == 422
    assert response.json() == {"code": "avatar.invalid_image"}


def test_replacing_avatar_deletes_old_file(client, parent):
    member = create(client, parent).json()
    first = upload(client, parent, member["id"], image_bytes()).json()["avatar_url"]

    second = upload(client, parent, member["id"], image_bytes(color="blue")).json()["avatar_url"]

    assert first != second
    assert avatar_files() == [second.rsplit("/", 1)[1]]
    assert client.get(first).status_code == 404


def test_remove_avatar(client, parent):
    member = create(client, parent).json()
    url = upload(client, parent, member["id"], image_bytes()).json()["avatar_url"]

    response = client.delete(f"/api/members/{member['id']}/avatar", headers=csrf(parent))

    assert response.status_code == 200
    assert response.json()["avatar_url"] is None
    assert avatar_files() == []
    assert client.get(url).status_code == 404


def test_avatar_upload_needs_unlocked_parent_area(client, admin):
    response = upload(client, admin, 1, image_bytes())

    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_avatars_need_login(client, parent):
    member = create(client, parent).json()
    url = upload(client, parent, member["id"], image_bytes()).json()["avatar_url"]
    client.cookies.clear()

    assert client.get(url).status_code == 401


@pytest.mark.parametrize("filename", ["..%2F..%2Fetc%2Fpasswd", "abc.webp", "x" * 32 + ".webp"])
def test_unknown_avatar_names(client, parent, filename):
    assert client.get(f"/api/avatars/{filename}").status_code == 404
