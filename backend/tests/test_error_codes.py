import json
import re
from pathlib import Path

import pytest

from app.errors import _VALIDATION_CODES

APP_DIR = Path(__file__).resolve().parents[1] / "app"
LOCALES_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales"

_CODE_PATTERNS = (
    re.compile(r'ApiError\([^,]+,\s*"([a-z_]+\.[a-z_]+)"\)'),
    re.compile(r'PydanticCustomError\(\s*"([a-z_]+\.[a-z_]+)"'),
    re.compile(r'"code":\s*"([a-z_]+\.[a-z_]+)"'),
)


def backend_error_codes() -> set[str]:
    codes = set(_VALIDATION_CODES.values()) | {"validation.invalid"}
    for path in APP_DIR.rglob("*.py"):
        source = path.read_text()
        for pattern in _CODE_PATTERNS:
            codes.update(pattern.findall(source))
    return codes


def test_finds_error_codes():
    assert {"auth.invalid_credentials", "setup.already_done", "common.validation"} <= (
        backend_error_codes()
    )


@pytest.mark.skipif(not LOCALES_DIR.exists(), reason="Frontend nicht vorhanden (Container)")
@pytest.mark.parametrize("language", ["de", "en"])
def test_every_error_code_is_translated(language):
    translations = json.loads((LOCALES_DIR / language / "common.json").read_text())["errors"]

    missing = []
    for code in sorted(backend_error_codes()):
        group, key = code.split(".")
        if key not in translations.get(group, {}):
            missing.append(code)

    assert missing == []
