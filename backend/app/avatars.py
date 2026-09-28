import re
import secrets
from io import BytesIO
from pathlib import Path

from fastapi import Request, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import get_settings
from app.errors import ApiError

AVATAR_SIZE = 512
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# Schutz vor „Dekompressionsbomben“: kleine Dateien mit riesiger Pixelzahl.
MAX_PIXELS = 50_000_000
ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP")
_FILENAME = re.compile(r"^[0-9a-f]{32}\.webp$")


async def read_body(request: Request, max_bytes: int, too_large: str) -> bytes:
    """Request-Body lesen, aber höchstens `max_bytes`; sonst Fehler mit dem Code `too_large`."""
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > max_bytes:
        raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, too_large)

    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > max_bytes:
            raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, too_large)
    return bytes(data)


async def read_upload(request: Request) -> bytes:
    """Request-Body eines Avatarbilds, höchstens MAX_UPLOAD_BYTES."""
    return await read_body(request, MAX_UPLOAD_BYTES, "avatar.too_large")


class InvalidImage(Exception):
    """Kein gültiges Bild (Inhalt geprüft, nicht die Endung)."""


def square_webp(data: bytes) -> bytes:
    """Bild prüfen, quadratisch zuschneiden, 512 × 512 WebP erzeugen.

    Durch das Neukodieren gehen auch Metadaten wie GPS-Koordinaten verloren.
    """
    try:
        with Image.open(BytesIO(data), formats=ALLOWED_FORMATS) as image:
            if image.width * image.height > MAX_PIXELS:
                raise InvalidImage
            upright = ImageOps.exif_transpose(image).convert("RGBA")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise InvalidImage from error

    square = ImageOps.fit(upright, (AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)
    output = BytesIO()
    square.save(output, "WEBP", quality=85)
    return output.getvalue()


def process_avatar(data: bytes) -> bytes:
    try:
        return square_webp(data)
    except InvalidImage as error:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "avatar.invalid_image") from error


def image_dir(folder: str) -> Path:
    return get_settings().upload_dir / folder


def store_image(folder: str, data: bytes) -> str:
    """Speichert ein fertiges Bild unter einem zufälligen Namen im Upload-Ordner `folder`."""
    directory = image_dir(folder)
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(16)}.webp"
    (directory / filename).write_bytes(data)
    return filename


def image_path(folder: str, filename: str) -> Path | None:
    if not _FILENAME.match(filename):
        return None
    return image_dir(folder) / filename


def delete_image(folder: str, filename: str | None) -> None:
    path = image_path(folder, filename) if filename else None
    if path is not None:
        path.unlink(missing_ok=True)


def store_avatar(data: bytes) -> str:
    return store_image("avatars", data)


def avatar_path(filename: str) -> Path | None:
    return image_path("avatars", filename)


def delete_avatar(filename: str | None) -> None:
    delete_image("avatars", filename)
