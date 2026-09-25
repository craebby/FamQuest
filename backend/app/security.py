import hashlib
import secrets
import threading
import time
from collections import deque
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()


def hash_secret(secret: str) -> str:
    """Argon2-Hash für Passwörter und die Eltern-PIN."""
    return _hasher.hash(secret)


def verify_secret(secret_hash: str | None, secret: str) -> bool:
    if secret_hash is None:
        # Gleiche Rechenzeit wie bei einem echten Vergleich, damit man nicht
        # an der Antwortzeit erkennt, ob ein Konto existiert.
        _verify(_dummy_hash(), secret)
        return False
    return _verify(secret_hash, secret)


def _verify(secret_hash: str, secret: str) -> bool:
    try:
        return _hasher.verify(secret_hash, secret)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(secret_hash: str) -> bool:
    return _hasher.check_needs_rehash(secret_hash)


@lru_cache
def _dummy_hash() -> str:
    return _hasher.hash(secrets.token_urlsafe(16))


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    """Zählt Fehlversuche je Schlüssel in einem gleitenden Zeitfenster (im Arbeitsspeicher).

    Reicht, weil die App als ein einzelner Prozess läuft.
    """

    def __init__(self, max_failures: int, window_seconds: float) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str) -> deque[float]:
        failures = self._failures.setdefault(key, deque())
        cutoff = time.monotonic() - self.window_seconds
        while failures and failures[0] < cutoff:
            failures.popleft()
        return failures

    def is_blocked(self, *keys: str) -> bool:
        with self._lock:
            return any(len(self._recent(key)) >= self.max_failures for key in keys)

    def record_failure(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._recent(key).append(time.monotonic())

    def reset(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


# 5 Fehlversuche in 15 Minuten, danach wird gesperrt, bis ältere Versuche verfallen.
login_limiter = RateLimiter(max_failures=5, window_seconds=15 * 60)
pin_limiter = RateLimiter(max_failures=5, window_seconds=15 * 60)
