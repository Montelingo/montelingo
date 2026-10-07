from __future__ import annotations

import asyncio
import os

import httpx
import pytest

from app.infrastructure.email import EmailMessage, EmailSendError, SmtpEmailSender


@pytest.mark.asyncio
async def test_email_sender_delivers_to_mailpit() -> None:
    host = os.getenv("MONTELINGO_SMTP_HOST", "localhost")
    port = int(os.getenv("MONTELINGO_SMTP_PORT", "1025"))
    api_url = os.getenv("MAILPIT_API_URL", "http://localhost:8025")
    message = EmailMessage(
        to="e2e@example.com",
        subject="Mailpit integration test",
        text_body="Mailpit received this message.",
    )
    sender = SmtpEmailSender(
        host=host,
        port=port,
        username=None,
        password=None,
        smtp_security="none",
        from_address="no-reply@montelingo.local",
    )

    try:
        await sender.send(message)
    except EmailSendError as exc:
        pytest.skip(f"Mailpit is not available at {host}:{port}: {exc}")

    async with httpx.AsyncClient(base_url=api_url, timeout=5.0) as client:
        for _ in range(10):
            try:
                response = await client.get("/api/v1/messages", params={"limit": 50})
                response.raise_for_status()
                payload = response.json()
                messages = payload.get("messages", [])
                if any(
                    item.get("Subject") == message.subject
                    and any(
                        recipient.get("Address") == message.to for recipient in item.get("To", [])
                    )
                    for item in messages
                ):
                    return
            except (httpx.HTTPError, ValueError):
                pass
            await asyncio.sleep(0.5)

    pytest.fail("Mailpit did not contain the sent message.")
