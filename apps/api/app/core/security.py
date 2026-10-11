from __future__ import annotations

import hashlib
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



_hasher = Argon2PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hash."""
    return _hasher.verify(plain_password, hashed_password)


class SecureToken:
    @staticmethod
    def generate(length: int = 32) -> str:
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash(token: str) -> bytes:
        return hashlib.sha256(token.encode("utf-8")).digest()

    @staticmethod
    def compare_digest(val1: bytes, val2: bytes) -> bool:
        return hmac.compare_digest(val1, val2)

    @staticmethod
    def verify(token: str, expected_hash: bytes) -> bool:
        try:
            token_bytes = SecureToken.hash(token)
            return SecureToken.compare_digest(token_bytes, expected_hash)
        except (ValueError, TypeError):
            return False
