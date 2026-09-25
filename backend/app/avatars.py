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


def avatar_dir() -> Path:
    return get_settings().upload_dir / "avatars"


async def read_upload(request: Request) -> bytes:
    """Request-Body lesen, aber höchstens MAX_UPLOAD_BYTES."""
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_UPLOAD_BYTES:
        raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, "avatar.too_large")

    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_UPLOAD_BYTES:
            raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, "avatar.too_large")
    return bytes(data)


def process_avatar(data: bytes) -> bytes:
    """Bild prüfen (Inhalt, nicht Endung), quadratisch zuschneiden, 512 × 512 WebP erzeugen.

    Durch das Neukodieren gehen auch Metadaten wie GPS-Koordinaten verloren.
    """
    try:
        with Image.open(BytesIO(data), formats=ALLOWED_FORMATS) as image:
            if image.width * image.height > MAX_PIXELS:
                raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "avatar.invalid_image")
            upright = ImageOps.exif_transpose(image).convert("RGBA")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "avatar.invalid_image") from error

    square = ImageOps.fit(upright, (AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)
    output = BytesIO()
    square.save(output, "WEBP", quality=85)
    return output.getvalue()


def store_avatar(data: bytes) -> str:
    """Speichert ein fertiges Avatarbild unter einem zufälligen Namen."""
    directory = avatar_dir()
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(16)}.webp"
    (directory / filename).write_bytes(data)
    return filename


def avatar_path(filename: str) -> Path | None:
    if not _FILENAME.match(filename):
        return None
    return avatar_dir() / filename


def delete_avatar(filename: str | None) -> None:
    path = avatar_path(filename) if filename else None
    if path is not None:
        path.unlink(missing_ok=True)
