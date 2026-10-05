from __future__ import annotations

import pytest

from app.core.config import Settings
from app.infrastructure.email import (
    EmailMessage,
    InMemoryEmailSender,
    SmtpEmailSender,
    create_email_sender,
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
