from __future__ import annotations

from app.infrastructure.email import EmailMessage

ACCOUNT_DELETED_SUBJECT = "Tvoj Montelingo nalog je obrisan"

_PARAGRAPHS = (
    "Tvoj Montelingo nalog je obrisan, zajedno sa podacima svih igrača na njemu: "
    "imenima, napretkom i rezultatima igara.",
    "Brisanje se ne može poništiti. Iz rezervnih kopija podaci nestaju najkasnije za 28 dana.",
    "Ako poželiš da ponovo igrate, možeš napraviti novi nalog.",
)


def account_deleted_email(*, to: str) -> EmailMessage:
    """The confirmation after an account is deleted. It names no child (ADR 0008)."""
    text_body = "\n\n".join(_PARAGRAPHS) + "\n"
    html_body = (
        "<!DOCTYPE html>\n"
        '<html lang="sr-ME"><head><meta charset="utf-8">'
        f"<title>{ACCOUNT_DELETED_SUBJECT}</title></head>"
        '<body style="font-family: Arial, sans-serif; color: #333;">'
        + "".join(f"<p>{paragraph}</p>" for paragraph in _PARAGRAPHS)
        + "</body></html>\n"
    )
    return EmailMessage(
        to=to, subject=ACCOUNT_DELETED_SUBJECT, text_body=text_body, html_body=html_body
    )
