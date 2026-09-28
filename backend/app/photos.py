"""Fotos für den Bilderrahmen: prüfen, verkleinern, neu kodieren und speichern."""

import re
import secrets
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import Request, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.avatars import read_body
from app.config import get_settings
from app.errors import ApiError

# Handyfotos sind oft 5–15 MB groß; der Server verkleinert sie ohnehin.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
# Schutz vor „Dekompressionsbomben“; reicht für Kameras mit rund 100 Megapixeln.
MAX_PIXELS = 110_000_000
ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP")
# Lange Kante der Anzeige (scharf bis 1440p-Displays) und der Vorschau im Elternbereich.
DISPLAY_EDGE = 2560
THUMB_EDGE = 480
_FILENAME = re.compile(r"^(?P<key>[0-9a-f]{32})(?P<thumb>-thumb)?\.webp$")
# EXIF: Aufnahmezeit steht im Exif-IFD (DateTimeOriginal), ersatzweise im Hauptverzeichnis.
_EXIF_IFD = 0x8769
_DATETIME_ORIGINAL = 36867
_DATETIME = 306


@dataclass
class ProcessedPhoto:
    display: bytes
    thumb: bytes
    width: int
    height: int
    taken_at: datetime | None


async def read_photo_upload(request: Request) -> bytes:
    return await read_body(request, MAX_UPLOAD_BYTES, "photo.too_large")


def _taken_at(image: Image.Image) -> datetime | None:
    exif = image.getexif()
    raw = exif.get_ifd(_EXIF_IFD).get(_DATETIME_ORIGINAL) or exif.get(_DATETIME)
    if not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw.strip("\x00 "), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def _webp(image: Image.Image, edge: int, quality: int) -> bytes:
    copy = image.copy()
    copy.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    output = BytesIO()
    copy.save(output, "WEBP", quality=quality)
    return output.getvalue()


def process_photo(data: bytes) -> ProcessedPhoto:
    """Bild prüfen (Inhalt, nicht Endung), aufrichten, verkleinern und als WebP neu kodieren.

    Durch das Neukodieren gehen Metadaten wie GPS-Koordinaten verloren; nur die Aufnahmezeit wird
    vorher gelesen. Kleine Bilder werden nicht vergrößert.
    """
    try:
        with Image.open(BytesIO(data), formats=ALLOWED_FORMATS) as image:
            if image.width * image.height > MAX_PIXELS:
                raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "photo.invalid_image")
            taken_at = _taken_at(image)
            # JPEG gleich verkleinert dekodieren, das spart bei großen Fotos viel Speicher.
            image.draft("RGB", (DISPLAY_EDGE, DISPLAY_EDGE))
            upright = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "photo.invalid_image") from error

    upright.thumbnail((DISPLAY_EDGE, DISPLAY_EDGE), Image.Resampling.LANCZOS)
    return ProcessedPhoto(
        display=_webp(upright, DISPLAY_EDGE, 82),
        thumb=_webp(upright, THUMB_EDGE, 75),
        width=upright.width,
        height=upright.height,
        taken_at=taken_at,
    )


def photo_dir() -> Path:
    return get_settings().upload_dir / "photos"


def _paths(key: str) -> tuple[Path, Path]:
    directory = photo_dir()
    return directory / f"{key}.webp", directory / f"{key}-thumb.webp"


def store_photo(photo: ProcessedPhoto) -> str:
    """Speichert Anzeige und Vorschau unter einem zufälligen Schlüssel."""
    photo_dir().mkdir(parents=True, exist_ok=True)
    key = secrets.token_hex(16)
    display, thumb = _paths(key)
    display.write_bytes(photo.display)
    thumb.write_bytes(photo.thumb)
    return key


def delete_photo_files(key: str) -> None:
    for path in _paths(key):
        path.unlink(missing_ok=True)


def parse_filename(filename: str) -> tuple[str, Path] | None:
    """Dateiname aus der URL → (Schlüssel, Pfad); None bei allem, was nicht passt."""
    match = _FILENAME.match(filename)
    if match is None:
        return None
    display, thumb = _paths(match["key"])
    return match["key"], thumb if match["thumb"] else display


def photo_urls(key: str) -> tuple[str, str]:
    return f"/api/photo-files/{key}.webp", f"/api/photo-files/{key}-thumb.webp"
