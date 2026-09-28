from datetime import datetime
from io import BytesIO

from PIL import Image

from app.photos import DISPLAY_EDGE, MAX_UPLOAD_BYTES, THUMB_EDGE
from tests.conftest import UPLOAD_DIR, csrf
from tests.test_members import image_bytes


def upload(client, me, data, content_type="image/jpeg"):
    return client.post(
        "/api/photos", content=data, headers={**csrf(me), "Content-Type": content_type}
    )


def photo_files() -> list[str]:
    directory = UPLOAD_DIR / "photos"
    return sorted(path.name for path in directory.iterdir()) if directory.exists() else []


def open_image(client, url: str) -> Image.Image:
    response = client.get(url)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    return Image.open(BytesIO(response.content))


def jpeg_with_exif(size=(400, 300), **tags) -> bytes:
    image = Image.new("RGB", size, "red")
    exif = Image.Exif()
    for tag, value in tags.items():
        if tag == "orientation":
            exif[0x0112] = value
        elif tag == "taken":
            exif.get_ifd(0x8769)[36867] = value
        elif tag == "gps":
            exif.get_ifd(0x8825)[1] = value
    output = BytesIO()
    image.save(output, "JPEG", exif=exif)
    return output.getvalue()


def test_upload_scales_down_and_creates_thumbnail(client, parent):
    response = upload(client, parent, image_bytes("JPEG", size=(4000, 3000)))

    assert response.status_code == 201
    photo = response.json()
    assert photo["width"] == DISPLAY_EDGE
    assert photo["height"] == DISPLAY_EDGE * 3 // 4
    assert photo["visible"] is True
    assert photo["taken_at"] is None
    with open_image(client, photo["url"]) as image:
        assert image.format == "WEBP"
        assert image.size == (photo["width"], photo["height"])
    with open_image(client, photo["thumb_url"]) as thumb:
        assert max(thumb.size) == THUMB_EDGE
    assert len(photo_files()) == 2


def test_small_photos_are_not_enlarged(client, parent):
    photo = upload(client, parent, image_bytes("PNG", size=(800, 600)), "image/png").json()

    assert (photo["width"], photo["height"]) == (800, 600)


def test_upload_reads_capture_time_and_respects_orientation(client, parent):
    data = jpeg_with_exif(size=(400, 300), orientation=6, taken="2025:12:24 18:30:05")

    photo = upload(client, parent, data).json()

    assert photo["taken_at"] == "2025-12-24T18:30:05"
    # Orientierung 6: um 90° gedreht, aus Quer- wird Hochformat.
    assert (photo["width"], photo["height"]) == (300, 400)


def test_metadata_is_removed(client, parent):
    data = jpeg_with_exif(taken="2025:12:24 18:30:05", gps="N")

    photo = upload(client, parent, data).json()

    with open_image(client, photo["url"]) as image:
        assert not image.getexif()
        assert "exif" not in image.info


def test_list_newest_first(client, parent):
    first = upload(client, parent, image_bytes("JPEG")).json()
    second = upload(client, parent, image_bytes("JPEG", color="blue")).json()

    photos = client.get("/api/photos").json()

    assert [photo["id"] for photo in photos] == [second["id"], first["id"]]
    assert datetime.fromisoformat(photos[0]["created_at"])


def test_hide_and_show(client, parent):
    photo = upload(client, parent, image_bytes("JPEG")).json()

    response = client.patch(
        f"/api/photos/{photo['id']}", json={"visible": False}, headers=csrf(parent)
    )

    assert response.status_code == 200
    assert response.json()["visible"] is False
    assert client.get("/api/photos").json()[0]["visible"] is False
    # Ausgeblendete Fotos bleiben abrufbar (Vorschau im Elternbereich).
    assert client.get(photo["thumb_url"]).status_code == 200


def test_delete_removes_files(client, parent):
    photo = upload(client, parent, image_bytes("JPEG")).json()

    response = client.delete(f"/api/photos/{photo['id']}", headers=csrf(parent))

    assert response.status_code == 204
    assert client.get("/api/photos").json() == []
    assert photo_files() == []
    assert client.get(photo["url"]).status_code == 404


def test_unknown_photo(client, parent):
    response = client.delete("/api/photos/999", headers=csrf(parent))

    assert response.status_code == 404
    assert response.json() == {"code": "photo.not_found"}


def test_content_is_checked_not_the_type(client, parent):
    response = upload(client, parent, b"<svg></svg>")

    assert response.status_code == 422
    assert response.json() == {"code": "photo.invalid_image"}
    assert photo_files() == []


def test_gif_is_rejected(client, parent):
    response = upload(client, parent, image_bytes("GIF"), "image/gif")

    assert response.status_code == 422
    assert response.json() == {"code": "photo.invalid_image"}


def test_too_large(client, parent):
    response = upload(client, parent, b"x" * (MAX_UPLOAD_BYTES + 1))

    assert response.status_code == 413
    assert response.json() == {"code": "photo.too_large"}


def test_changes_need_unlocked_parent_area(client, admin):
    response = upload(client, admin, image_bytes("JPEG"))

    assert response.status_code == 403
    assert response.json() == {"code": "parent.locked"}


def test_files_need_login(client, parent):
    photo = upload(client, parent, image_bytes("JPEG")).json()
    client.cookies.clear()

    assert client.get("/api/photos").status_code == 401
    assert client.get(photo["url"]).status_code == 401


def test_file_names_are_checked(client, parent):
    upload(client, parent, image_bytes("JPEG"))

    for name in ("../avatars/x.webp", "0" * 32 + ".webp", "abc.webp", "0" * 32 + "-thumb.png"):
        assert client.get(f"/api/photo-files/{name}").status_code == 404
