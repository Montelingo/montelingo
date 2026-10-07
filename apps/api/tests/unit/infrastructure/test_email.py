from __future__ import annotations

import logging

import pytest

from app.core.config import Settings
from app.infrastructure.email import (
    EmailMessage,
    EmailSendError,
    InMemoryEmailSender,
    SmtpEmailSender,
    _get_process_email_sender,
    _RequestScopedEmailSender,
    create_email_sender,
    get_email_sender,
)


@pytest.mark.asyncio
async def test_in_memory_sender_records_messages() -> None:
    sender = InMemoryEmailSender()
    message = EmailMessage(
        to="user@example.com",
        subject="Reset password",
        text_body="Use this link to reset your password.",
        html_body="<p>Use this link to reset your password.</p>",
    )

    await sender.send(message)

    assert sender.messages == [message]


def test_factory_uses_in_memory_sender_without_smtp_in_development() -> None:
    sender = create_email_sender(Settings(env="development"))

    assert isinstance(sender, InMemoryEmailSender)


def test_factory_uses_smtp_sender_when_host_is_configured() -> None:
    sender = create_email_sender(
        Settings(
            env="development",
            smtp_host="mailpit",
            smtp_port=1025,
            smtp_from="no-reply@montelingo.local",
        )
    )

    assert isinstance(sender, SmtpEmailSender)


def test_factory_rejects_missing_smtp_in_production() -> None:
    with pytest.raises(ValueError, match="SMTP email configuration"):
        create_email_sender(Settings(env="production"))


def test_factory_rejects_empty_production_credentials() -> None:
    with pytest.raises(ValueError, match="MONTELINGO_SMTP_PASSWORD"):
        create_email_sender(
            Settings(
                env="production",
                smtp_host="smtp.example.com",
                smtp_username="user",
                smtp_password="",
                smtp_from="no-reply@example.com",
            )
        )


@pytest.mark.asyncio
async def test_smtp_sender_wraps_failures_without_logging_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fail_send(*args: object, **kwargs: object) -> None:
        captured.update(kwargs)
        raise TimeoutError("connection timed out")

    monkeypatch.setattr("app.infrastructure.email.aiosmtplib.send", fail_send)
    sender = SmtpEmailSender(
        host="smtp.example.com",
        port=587,
        username="user",
        password="password",
        smtp_security="starttls",
        from_address="no-reply@example.com",
    )

    with pytest.raises(EmailSendError) as raised:
        await sender.send(
            EmailMessage(
                to="private@example.com",
                subject="private subject",
                text_body="private body",
            )
        )

    assert raised.value.recipient_domain == "example.com"
    assert isinstance(raised.value.__cause__, TimeoutError)
    assert captured["start_tls"] is True
    assert captured["use_tls"] is False
    assert captured["timeout"] == 10.0


@pytest.mark.asyncio
async def test_send_failure_log_redacts_address_and_body(
    caplog: pytest.LogCaptureFixture,
) -> None:
    class FailingSender:
        async def send(self, message: EmailMessage) -> None:
            raise EmailSendError("example.com", RuntimeError("connection failed"))

    sender = _RequestScopedEmailSender(FailingSender(), "request-456")
    message = EmailMessage(
        to="private@example.com",
        subject="private subject",
        text_body="private body",
    )

    with caplog.at_level(logging.ERROR), pytest.raises(EmailSendError):
        await sender.send(message)

    assert "request-456" in caplog.text
    assert "example.com" in caplog.text
    assert "RuntimeError" in caplog.text
    assert "private@example.com" not in caplog.text
    assert "private subject" not in caplog.text
    assert "private body" not in caplog.text


@pytest.mark.asyncio
async def test_in_memory_sender_is_process_scoped_and_logs_safe_fields(
    caplog: pytest.LogCaptureFixture,
) -> None:
    _get_process_email_sender.cache_clear()
    settings = Settings(env="development")

    class Request:
        state = type("State", (), {"request_id": "request-123"})()

    first = get_email_sender(Request(), settings)
    second = get_email_sender(Request(), settings)
    assert first is not second
    assert first._sender is second._sender

    with caplog.at_level(logging.INFO):
        await first.send(
            EmailMessage(
                to="private@example.com",
                subject="reset subject",
                text_body="reset body",
            )
        )

    assert "reset subject" in caplog.text
    assert "example.com" in caplog.text
    assert "private@example.com" not in caplog.text
    assert "reset body" not in caplog.text
