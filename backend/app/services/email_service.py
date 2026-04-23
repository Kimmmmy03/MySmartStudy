"""SMTP helpers for transactional notification emails.

Every function here is best-effort: a misconfigured or unreachable SMTP server
must never break the calling endpoint. Errors are logged and swallowed.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from threading import Thread

logger = logging.getLogger("mysmartstudy.email")


def _smtp_config() -> tuple[str, int, str, str, str] | None:
    """Return (host, port, user, password, from_addr) if SMTP is configured."""
    host = os.getenv("SMTP_HOST", "")
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    if not host or not user or not password:
        return None
    port = int(os.getenv("SMTP_PORT", "587"))
    from_addr = os.getenv("SMTP_FROM", user)
    return host, port, user, password, from_addr


def _frontend_url() -> str:
    return os.getenv(
        "FRONTEND_URL",
        "https://mysmartstudy-web-393385396386.asia-southeast1.run.app",
    ).rstrip("/")


def _render_email(title: str, greeting: str, body_html: str, cta_label: str | None, cta_url: str | None) -> str:
    """Render a consistent transactional email shell."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <div style="text-align: center; margin: 28px 0;">
            <a href="{escape(cta_url, quote=True)}"
               style="background: linear-gradient(135deg, #1B2A80, #2E4DA7);
                      color: white; padding: 12px 28px; border-radius: 10px;
                      text-decoration: none; font-weight: 600; display: inline-block;">
                {escape(cta_label)}
            </a>
        </div>
        """

    return f"""\
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 600px; margin: 0 auto; padding: 28px; color: #1a1a2e;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #1B2A80; font-size: 22px; margin: 0;">{escape(title)}</h1>
        </div>
        <p style="margin: 0 0 12px 0;">{escape(greeting)}</p>
        <div style="color: #2a3050; line-height: 1.55;">{body_html}</div>
        {cta_block}
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px 0;" />
        <p style="color: #888; font-size: 11px; text-align: center; margin: 0;">
            &copy; MySmartStudy · IPG Kampus Perempuan Melayu Melaka
        </p>
    </div>
    """


def _send(to_email: str, subject: str, html: str) -> None:
    cfg = _smtp_config()
    if not cfg:
        return
    host, port, user, password, from_addr = cfg

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())
    except Exception as e:
        logger.warning("SMTP send to %s failed: %s", to_email, e)


def send_notification_email(
    *,
    to_email: str,
    display_name: str,
    title: str,
    message: str,
    link: str = "",
    cta_label: str = "Open MySmartStudy",
) -> None:
    """Fire-and-forget notification email.

    Spawns a background thread so the caller (e.g. a POST handler) doesn't
    block waiting for the SMTP round-trip. Safe to call even when SMTP is
    unconfigured — the worker thread will no-op.
    """
    if not to_email:
        return

    greeting = f"Hi {display_name or 'there'},"
    body_html = f"<p style=\"margin: 0 0 8px 0;\">{escape(message)}</p>"
    cta_url = ""
    if link:
        cta_url = link if link.startswith(("http://", "https://")) else f"{_frontend_url()}{link if link.startswith('/') else '/' + link}"
    html = _render_email(title=title, greeting=greeting, body_html=body_html, cta_label=cta_label if cta_url else None, cta_url=cta_url or None)

    t = Thread(target=_send, args=(to_email, title, html), daemon=True)
    t.start()
