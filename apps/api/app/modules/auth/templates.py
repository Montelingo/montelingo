from __future__ import annotations


def get_password_reset_email_content(
    reset_link: str, expires_in_minutes: int
) -> tuple[str, str, str]:
    """
    Returns (subject, text_content, html_content) for the password reset email.
    """
    subject = "Reset Your Password - Montelingo"

    text_content = (
        "You have requested to reset your password.\n\n"
        f"Please click the following link to reset your password:\n{reset_link}\n\n"
        f"This link will expire in {expires_in_minutes} minutes.\n"
        "If you did not request this, please ignore this email."
    )

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Password Reset Request</h2>
        <p>You have requested to reset your password.</p>
        <p>
            <a href="{reset_link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
            </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <p><small>This link will expire in {expires_in_minutes} minutes. If you did not request this, please ignore this email.</small></p>
    </body>
    </html>
    """

    return subject, text_content, html_content
