from __future__ import annotations

import logging
from dataclasses import dataclass
from email.message import EmailMessage as SmtpMessage
from email.utils import parseaddr
from typing import Protocol

import aiosmtplib
from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.core.request_id import get_request_id

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EmailMessage:
    to: str
    subject: str
    text_body: str
    html_body: str | None = None


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None:
        """Send one email message."""


class EmailSendError(RuntimeError):
    def __init__(self, recipient_domain: str, cause: Exception) -> None:
        super().__init__(f"Email delivery failed for recipient domain {recipient_domain}.")
        self.recipient_domain = recipient_domain
        self.__cause__ = cause


def recipient_domain(recipient: str) -> str:
    address = parseaddr(recipient)[1]
    return address.rsplit("@", 1)[-1] if "@" in address else "invalid"


class InMemoryEmailSender:
    def __init__(self) -> None:
        self.messages: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.messages.append(message)


class SmtpEmailSender:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str | None,
        password: str | None,
        use_tls: bool,
        from_address: str,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._use_tls = use_tls
        self._from_address = from_address

    async def send(self, message: EmailMessage) -> None:
        smtp_message = SmtpMessage()
        smtp_message["From"] = self._from_address
        smtp_message["To"] = message.to
        smtp_message["Subject"] = message.subject
        smtp_message.set_content(message.text_body)
        if message.html_body is not None:
            smtp_message.add_alternative(message.html_body, subtype="html")

        try:
            await aiosmtplib.send(
                smtp_message,
                hostname=self._host,
                port=self._port,
                username=self._username or None,
                password=self._password or None,
                use_tls=self._use_tls,
                start_tls=False,
            )
        except Exception as exc:
            raise EmailSendError(recipient_domain(message.to), exc) from exc


class _RequestScopedEmailSender:
    def __init__(self, sender: EmailSender, request_id: str) -> None:
        self._sender = sender
        self._request_id = request_id

    async def send(self, message: EmailMessage) -> None:
        try:
            await self._sender.send(message)
        except EmailSendError as exc:
            logger.error(
                "email_send_failed request_id=%s recipient_domain=%s",
                self._request_id,
                exc.recipient_domain,
            )
            raise


def create_email_sender(settings: Settings) -> EmailSender:
    settings.validate_smtp_for_production()
    if not settings.smtp_host:
        if settings.env.lower() in {"production", "prod"}:
            raise ValueError("SMTP email configuration is required in production.")
        return InMemoryEmailSender()
    if not settings.smtp_from:
        raise ValueError("MONTELINGO_SMTP_FROM is required when SMTP is configured.")
    return SmtpEmailSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        use_tls=settings.smtp_use_tls,
        from_address=settings.smtp_from,
    )


def get_email_sender(request: Request, settings: Settings = Depends(get_settings)) -> EmailSender:
    return _RequestScopedEmailSender(
        create_email_sender(settings),
        get_request_id(request),
    )
