from __future__ import annotations

import hashlib
import ipaddress
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from threading import Lock
from typing import Protocol
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request

from app.core.config import Settings, get_settings
from app.core.security import Clock, SystemClock

from .schemas import PasswordResetRequest, SignInRequest


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after: int = 0


class RateLimiter(Protocol):
    def check(
        self,
        key: str,
        limit: int,
        window: timedelta,
        *,
        now: datetime | None = None,
    ) -> RateLimitDecision: ...


class InMemoryRateLimiter:
    """A process-local sliding-window limiter.

    Keys contain only caller-provided identifiers. Auth dependencies hash
    normalized email addresses before passing them here.
    """

    def __init__(self, clock: Clock | None = None) -> None:
        self._clock = clock or SystemClock()
        self._events: dict[tuple[str, int, int], deque[datetime]] = {}
        self._lock = Lock()

    def check(
        self,
        key: str,
        limit: int,
        window: timedelta,
        *,
        now: datetime | None = None,
    ) -> RateLimitDecision:
        current = now or self._clock.now()
        bucket_key = (key, limit, int(window.total_seconds()))
        cutoff = current - window
        with self._lock:
            events = self._events.setdefault(bucket_key, deque())
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int((events[0] + window - current).total_seconds() + 0.999))
                return RateLimitDecision(False, retry_after)
            events.append(current)
        return RateLimitDecision(True)


InMemorySlidingWindowRateLimiter = InMemoryRateLimiter


def _rate_limited(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many requests.",
        headers={"Retry-After": str(retry_after)},
    )


def _email_key(email: str) -> str:
    normalized = email.strip().casefold()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _check(limiter: RateLimiter, key: str, limit: int, window_seconds: int) -> None:
    decision = limiter.check(key, limit, timedelta(seconds=window_seconds))
    if not decision.allowed:
        raise _rate_limited(decision.retry_after)


def _trusted_proxy(peer: str, configured: list[str]) -> bool:
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return peer in configured
    for value in configured:
        try:
            if address in ipaddress.ip_network(value, strict=False):
                return True
        except ValueError:
            if peer == value:
                return True
    return False


def get_client_ip(request: Request, settings: Settings) -> str:
    """Resolve the client address, trusting forwarding headers only at proxies."""
    peer = request.client.host if request.client else ""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if not forwarded_for or not _trusted_proxy(peer, settings.trusted_proxies):
        return peer
    for candidate in reversed([part.strip() for part in forwarded_for.split(",")]):
        if not _trusted_proxy(candidate, settings.trusted_proxies):
            return candidate
    return forwarded_for.split(",", 1)[0].strip()


def _origin_from_request(request: Request) -> str | None:
    value = request.headers.get("origin") or request.headers.get("referer")
    if not value:
        return None
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def require_trusted_origin(request: Request, settings: Settings = Depends(get_settings)) -> None:
    origin = _origin_from_request(request)
    if origin is None and settings.env == "test":
        return
    if origin is None or origin not in settings.allowed_origins:
        raise HTTPException(status_code=403, detail="Forbidden.")


@lru_cache
def get_rate_limiter() -> InMemoryRateLimiter:
    return InMemoryRateLimiter()


def _limit_ip(
    request: Request,
    settings: Settings,
    limiter: RateLimiter,
    scope: str,
    limit: int,
    window: int,
) -> None:
    _check(limiter, f"{scope}:ip:{get_client_ip(request, settings)}", limit, window)


def rate_limit_sign_in(
    payload: SignInRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> None:
    client_ip = get_client_ip(request, settings)
    _limit_ip(
        request, settings, limiter, "sign-in", settings.sign_in_ip_limit, settings.sign_in_window
    )
    _check(
        limiter,
        f"sign-in:pair:{client_ip}:{_email_key(str(payload.email))}",
        settings.sign_in_email_limit,
        settings.sign_in_window,
    )


def rate_limit_sign_up(
    request: Request,
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> None:
    _limit_ip(
        request, settings, limiter, "sign-up", settings.sign_up_ip_limit, settings.sign_up_window
    )


def rate_limit_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> None:
    _limit_ip(
        request,
        settings,
        limiter,
        "password-reset",
        settings.password_reset_ip_limit,
        settings.password_reset_window,
    )
    _check(
        limiter,
        f"password-reset:email:{_email_key(str(payload.email))}",
        settings.password_reset_email_limit,
        settings.password_reset_window,
    )
