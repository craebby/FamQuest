import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class DecryptError(Exception):
    """Token lässt sich nicht entschlüsseln, z. B. weil TOKEN_ENCRYPTION_KEY geändert wurde."""


def _fernet() -> Fernet:
    # Aus einer beliebig langen Zeichenkette wird ein gültiger Fernet-Schlüssel (32 Byte).
    secret = get_settings().token_encryption_key.encode()
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise DecryptError from exc
