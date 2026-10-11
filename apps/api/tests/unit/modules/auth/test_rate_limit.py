from datetime import UTC, datetime, timedelta

from fastapi import Request

from app.core.config import Settings
from app.modules.auth.rate_limit import (
    InMemoryRateLimiter,
    RateLimitDecision,
    get_client_ip,
)


class FrozenClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 1, 1, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current


def test_sliding_window_expires_oldest_attempt() -> None:
    clock = FrozenClock()
    limiter = InMemoryRateLimiter(clock)
    window = timedelta(minutes=15)

    assert limiter.check("key", 2, window) == RateLimitDecision(True)
    clock.current += timedelta(minutes=1)
    assert limiter.check("key", 2, window) == RateLimitDecision(True)
    denied = limiter.check("key", 2, window)
    assert denied.allowed is False
    assert denied.retry_after == 14 * 60

    clock.current += timedelta(minutes=14)
    assert limiter.check("key", 2, window).allowed is True


def _request(client_host: str, forwarded_for: str | None = None) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": ([(b"x-forwarded-for", forwarded_for.encode())] if forwarded_for else []),
        "client": (client_host, 1234),
        "scheme": "http",
        "server": ("test", 80),
    }
    return Request(scope)


def test_client_ip_ignores_forwarding_from_untrusted_peer() -> None:
    settings = Settings(trusted_proxies=["10.0.0.2"])
    assert get_client_ip(_request("192.0.2.10", "198.51.100.7"), settings) == "192.0.2.10"


def test_client_ip_resolves_forwarding_from_trusted_peer() -> None:
    settings = Settings(trusted_proxies=["10.0.0.2"])
    request = _request("10.0.0.2", "198.51.100.7, 10.0.0.2")
    assert get_client_ip(request, settings) == "198.51.100.7"
