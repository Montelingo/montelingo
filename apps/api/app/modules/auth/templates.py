from __future__ import annotations

from html import escape

from app.infrastructure.email import EmailMessage

PASSWORD_RESET_SUBJECT = "Reset your Montelingo password"


def password_reset_email(*, to: str, reset_link: str, expires_in_minutes: int) -> EmailMessage:
    """The password reset email. It carries no personal data beyond the link."""
    text_body = (
        "Someone asked to reset the password for your Montelingo account.\n\n"
        f"To choose a new password, open this link:\n{reset_link}\n\n"
        f"The link expires in {expires_in_minutes} minutes and works once.\n"
        "If you did not ask for this, ignore this email. Your password stays the same.\n"
    )
    link = escape(reset_link, quote=True)
    html_body = (
        "<!DOCTYPE html>\n"
        '<html><head><meta charset="utf-8"><title>Reset your password</title></head>'
        '<body style="font-family: Arial, sans-serif; color: #333;">'
        "<p>Someone asked to reset the password for your Montelingo account.</p>"
        f'<p><a href="{link}">Choose a new password</a></p>'
        f"<p>Or paste this link into your browser:<br>{link}</p>"
        f"<p>The link expires in {expires_in_minutes} minutes and works once. "
        "If you did not ask for this, ignore this email. Your password stays the same.</p>"
        "</body></html>\n"
    )
    return EmailMessage(
        to=to, subject=PASSWORD_RESET_SUBJECT, text_body=text_body, html_body=html_body
    )
