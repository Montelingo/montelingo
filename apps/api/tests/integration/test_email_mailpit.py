from __future__ import annotations

import os

import pytest

from app.infrastructure.email import EmailMessage, EmailSendError, SmtpEmailSender


@pytest.mark.asyncio
async def test_email_sender_delivers_to_mailpit() -> None:
    host = os.getenv("MONTELINGO_SMTP_HOST", "mailpit")
    port = int(os.getenv("MONTELINGO_SMTP_PORT", "1025"))
    sender = SmtpEmailSender(
        host=host,
        port=port,
        username=None,
        password=None,
        use_tls=False,
        from_address="no-reply@montelingo.local",
    )

    try:
        await sender.send(
            EmailMessage(
                to="e2e@example.com",
                subject="Mailpit integration test",
                text_body="Mailpit received this message.",
            )
        )
    except EmailSendError as exc:
        pytest.skip(f"Mailpit is not available at {host}:{port}: {exc}")
