from __future__ import annotations

from html import escape

from app.infrastructure.email import EmailMessage

ACCOUNT_DELETED_SUBJECT = "Tvoj Montelingo nalog je obrisan"
INACTIVITY_WARNING_SUBJECT = "Tvoj Montelingo nalog će uskoro biti obrisan"

_DELETED_PARAGRAPHS = (
    "Tvoj Montelingo nalog je obrisan, zajedno sa podacima svih igrača na njemu: "
    "imenima, napretkom i rezultatima igara.",
    "Brisanje se ne može poništiti. Iz rezervnih kopija podaci nestaju najkasnije za 28 dana.",
    "Ako poželiš da ponovo igrate, možeš napraviti novi nalog.",
)


def _message(
    *, to: str, subject: str, paragraphs: tuple[str, ...], link: str | None = None
) -> EmailMessage:
    """Plain text and HTML with the same paragraphs; the link, if any, after the third."""
    text = list(paragraphs)
    html = [escape(paragraph) for paragraph in paragraphs]
    if link is not None:
        text.insert(3, link)
        href = escape(link, quote=True)
        html.insert(3, f'<a href="{href}">{href}</a>')
    html_body = (
        "<!DOCTYPE html>\n"
        '<html lang="sr-ME"><head><meta charset="utf-8">'
        f"<title>{escape(subject)}</title></head>"
        '<body style="font-family: Arial, sans-serif; color: #333;">'
        + "".join(f"<p>{part}</p>" for part in html)
        + "</body></html>\n"
    )
    return EmailMessage(
        to=to, subject=subject, text_body="\n\n".join(text) + "\n", html_body=html_body
    )


def account_deleted_email(*, to: str) -> EmailMessage:
    """The confirmation after an account is deleted. It names no child (ADR 0008)."""
    return _message(to=to, subject=ACCOUNT_DELETED_SUBJECT, paragraphs=_DELETED_PARAGRAPHS)


def inactivity_warning_email(*, to: str, deletion_date: str, sign_in_link: str) -> EmailMessage:
    """The warning before an inactive account is deleted (ADR 0008). It names no child,
    says when the account goes, and that signing in keeps it.
    """
    paragraphs = (
        "Na tvoj Montelingo nalog niko se nije prijavio duže vrijeme.",
        "Da ne bismo čuvali podatke koji više nisu potrebni, nalog i podaci svih igrača "
        f"na njemu biće obrisani nakon {deletion_date}",
        "Ako želiš da ga zadržiš, samo se prijavi prije tog dana:",
        "Ako ne uradiš ništa, nalog se briše i to se ne može poništiti.",
    )
    return _message(
        to=to, subject=INACTIVITY_WARNING_SUBJECT, paragraphs=paragraphs, link=sign_in_link
    )
