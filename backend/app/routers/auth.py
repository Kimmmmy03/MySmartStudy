from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from .. import models, schemas
from ..firestore import get_db
from ..auth import get_current_user
from datetime import datetime, timezone
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _user_to_out(user: dict) -> schemas.UserOut:
    """Map camelCase Firestore fields → snake_case API response."""
    return schemas.UserOut(
        id=user["id"],
        email=user.get("email", ""),
        display_name=user.get("displayName", ""),
        role=user.get("role", "student"),
        class_name=user.get("className", ""),
        photo_url=user.get("photoURL", ""),
        year=user.get("year"),
        semester=user.get("semester"),
        department=user.get("department"),
        points=user.get("points", 0),
        streak=user.get("streak", 0),
        badges=user.get("badges", []),
        created_at=user.get("createdAt", datetime.now(timezone.utc)),
    )


@router.post("/sync", response_model=schemas.UserOut, status_code=200)
def sync_user(req: schemas.SyncRequest, db=Depends(get_db)):
    """Idempotent: verify Firebase token, create or return the Firestore user profile."""
    try:
        decoded = firebase_auth.verify_id_token(req.id_token, clock_skew_seconds=10)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    uid = decoded["uid"]
    email = decoded.get("email", "")

    doc = db.collection(models.USERS).document(uid).get()
    user = models.doc_to_dict(doc)
    if user:
        # Update lastActiveAt on login
        db.collection(models.USERS).document(uid).update({"lastActiveAt": datetime.now(timezone.utc)})
        user["lastActiveAt"] = datetime.now(timezone.utc)
        return _user_to_out(user)

    now = datetime.now(timezone.utc)
    user_data = {
        "uid": uid,
        "email": email,
        "displayName": req.display_name or email.split("@")[0],
        "role": req.role or "student",
        "className": req.class_name or "",
        "photoURL": "",
        "year": req.year,
        "semester": req.semester,
        "department": req.department,
        "points": 0,
        "streak": 0,
        "badges": [],
        "createdAt": now,
    }
    db.collection(models.USERS).document(uid).set(user_data)
    user_data["id"] = uid
    return _user_to_out(user_data)


@router.get("/me", response_model=schemas.UserOut)
def get_me(user: dict = Depends(get_current_user), db=Depends(get_db)):
    updates: dict = {"lastActiveAt": datetime.now(timezone.utc)}
    # Self-heal stale photoURL paths from the pre-GCS era (files on ephemeral
    # Cloud Run disk that were lost on revision restart). Only clear when
    # running with GCS configured, so local dev still serves /uploads/ fine.
    photo = user.get("photoURL", "") or ""
    if os.getenv("GCS_BUCKET") and photo.startswith("/uploads/"):
        updates["photoURL"] = ""
        user["photoURL"] = ""
    db.collection(models.USERS).document(user["id"]).update(updates)
    return _user_to_out(user)


@router.post("/welcome-email", status_code=200)
def send_welcome_email(user: dict = Depends(get_current_user)):
    """Send a welcome email to the newly registered user. Best-effort — never raises."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)
    frontend_url = os.getenv("FRONTEND_URL", "https://mysmartstudy-web-393385396386.asia-southeast1.run.app").rstrip("/")

    if not smtp_host or not smtp_user or not smtp_password:
        return {"detail": "SMTP not configured, skipping welcome email"}

    display_name = user.get("displayName", "there")
    to_email = user.get("email", "")
    if not to_email:
        return {"detail": "No email address on profile"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Welcome to MySmartStudy!"
    msg["From"] = smtp_from
    msg["To"] = to_email

    html = f"""\
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1B2A80; font-size: 28px;">Welcome to MySmartStudy!</h1>
        </div>
        <p>Hi <strong>{display_name}</strong>,</p>
        <p>Your account has been created successfully. You are now part of the
        MySmartStudy learning community at IPG Kampus Perempuan Melayu Melaka.</p>
        <p>Here is what you can do:</p>
        <ul>
            <li>Create interactive mind maps</li>
            <li>Join courses with a class code</li>
            <li>Collaborate with classmates in real-time</li>
            <li>Track your achievements and streaks</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{frontend_url}/login"
               style="background: linear-gradient(135deg, #1B2A80, #2E4DA7);
                      color: white; padding: 14px 32px; border-radius: 12px;
                      text-decoration: none; font-weight: 600;">
                Start Learning Now
            </a>
        </div>
        <p style="color: #666; font-size: 12px; text-align: center;">
            &copy; MySmartStudy - Institut Pendidikan Guru
        </p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return {"detail": "Welcome email sent"}
    except Exception as e:
        logger.warning("Failed to send welcome email to %s: %s", to_email, e)
        return {"detail": "Email send failed (non-critical)"}


@router.post("/request-password-reset", status_code=200)
def request_password_reset(req: schemas.PasswordResetRequest, db=Depends(get_db)):
    """
    Generate a Firebase password-reset link for `email` and deliver it via our
    own SMTP (Firebase's default email delivery is unreliable on free-tier).

    Responds 200 regardless of whether the email exists — we don't want to leak
    which addresses are registered. The underlying Firebase call is only made
    for accounts that have a password provider; Google-only accounts can't
    reset a password they don't have.
    """
    email = req.email.strip().lower()

    # Reject obviously missing / Google-only accounts silently (200 OK).
    try:
        user_record = firebase_auth.get_user_by_email(email)
    except Exception:
        logger.info("Password reset requested for unknown email %s", email)
        return {"detail": "If an account exists, a reset email has been sent."}

    has_password_provider = any(
        p.provider_id == "password" for p in (user_record.provider_data or [])
    )
    if not has_password_provider:
        logger.info(
            "Password reset requested for %s but account has no password provider",
            email,
        )
        return {"detail": "If an account exists, a reset email has been sent."}

    # Generate the Firebase-hosted reset link. `continueUrl` sends the user
    # back to the frontend login after they finish resetting.
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    try:
        action_settings = firebase_auth.ActionCodeSettings(
            url=f"{frontend_url}/login",
            handle_code_in_app=False,
        )
        reset_link = firebase_auth.generate_password_reset_link(
            email, action_code_settings=action_settings
        )
    except Exception as e:
        logger.exception("Failed to generate Firebase reset link for %s: %s", email, e)
        raise HTTPException(status_code=500, detail="Could not create reset link")

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        logger.error(
            "SMTP not configured — cannot deliver password reset email to %s",
            email,
        )
        raise HTTPException(status_code=500, detail="Email service not configured")

    display_name = user_record.display_name or email.split("@")[0]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your MySmartStudy password"
    msg["From"] = smtp_from
    msg["To"] = email

    html = f"""\
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1B2A80; font-size: 26px;">Reset your password</h1>
        </div>
        <p>Hi <strong>{display_name}</strong>,</p>
        <p>We received a request to reset the password on your MySmartStudy
        account. Click the button below to choose a new one:</p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{reset_link}"
               style="background: linear-gradient(135deg, #1B2A80, #2E4DA7);
                      color: white; padding: 14px 32px; border-radius: 12px;
                      text-decoration: none; font-weight: 600; display: inline-block;">
                Reset Password
            </a>
        </div>
        <p style="color: #555; font-size: 13px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="{reset_link}" style="word-break: break-all; color: #2E4DA7;">{reset_link}</a>
        </p>
        <p style="color: #555; font-size: 13px;">
            This link will expire in one hour. If you didn't request a password
            reset, you can safely ignore this email.
        </p>
        <p style="color: #888; font-size: 11px; text-align: center; margin-top: 32px;">
            &copy; MySmartStudy - Institut Pendidikan Guru
        </p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [email], msg.as_string())
        logger.info("Password reset email delivered to %s", email)
    except Exception as e:
        logger.exception("Failed to deliver password reset email to %s: %s", email, e)
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"detail": "If an account exists, a reset email has been sent."}
