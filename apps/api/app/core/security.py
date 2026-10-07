import hmac
import secrets
from datetime import UTC, datetime
from typing import Protocol

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import VerificationError, VerifyMismatchError


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...
    def verify(self, password: str, password_hash: str) -> bool: ...
    def needs_rehash(self, password_hash: str) -> bool: ...


class Argon2PasswordHasher:
    def __init__(self) -> None:
        self._ph = Argon2Hasher()

    def hash(self, password: str) -> str:
        return self._ph.hash(password)

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return self._ph.verify(password_hash, password)
        except (VerifyMismatchError, VerificationError):
            return False

    def needs_rehash(self, password_hash: str) -> bool:
        try:
            return self._ph.check_needs_rehash(password_hash)
        except Exception:
            return True


DUMMY_PASSWORD_HASH = Argon2PasswordHasher().hash("montelingo_dummy_password")


class SecureToken:
    @staticmethod
    def generate(length: int = 32) -> str:
        return secrets.token_urlsafe(length)

    @staticmethod
    def compare_digest(val1: str, val2: str) -> bool:
        return hmac.compare_digest(val1.encode("utf-8"), val2.encode("utf-8"))
