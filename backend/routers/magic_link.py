"""
Magic Link Authentication Router

Allows recruiters to send passwordless assessment invitations to candidates.
Candidates receive an email with a one-time signed link; clicking it establishes
a short-lived JWT session scoped to their candidate_id.

Endpoints:
  POST /api/auth/magic-link          - Recruiter sends link to candidate email
  GET  /api/auth/verify-magic/{token} - Candidate clicks link → JWT returned
"""

import os
import uuid
import logging
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import create_token, get_current_user
from dependencies import db

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/auth", tags=["Magic Link"])

# ---------------------------------------------------------------------------
# In-memory token store (TTL = 72 hours)
# For multi-instance prod, swap this dict for Redis or a DB table.
# ---------------------------------------------------------------------------
_magic_tokens: dict[str, dict] = {}   # token → {candidate_id, email, expires_at}
MAGIC_LINK_TTL_HOURS = int(os.getenv("MAGIC_LINK_TTL_HOURS", "72"))

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def _send_email(to: str, subject: str, html: str) -> bool:
    """Send email via SMTP. Falls back to console log in dev."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    from_addr = os.getenv("SMTP_FROM", smtp_user or "noreply@cygnusa.ai")

    if not smtp_host or not smtp_user:
        # Dev mode — print to console
        logger.info(f"\n{'='*60}\n📧 MAGIC LINK EMAIL (DEV MODE)\nTo: {to}\nSubject: {subject}\nBody:\n{html}\n{'='*60}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Cygnusa Guardian <{from_addr}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_addr, [to], msg.as_string())

        logger.info(f"Magic link email sent to {to}")
        return True
    except Exception as e:
        logger.error(f"Failed to send magic link email to {to}: {e}")
        return False


def _build_email_html(candidate_name: str, magic_url: str, expires_hours: int) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0d0e12;font-family:'Segoe UI',sans-serif;color:#f2f0f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0e12;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#121318;border-radius:16px;border:1px solid rgba(71,71,76,0.4);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#ba9eff15,#8455ef15);padding:32px;border-bottom:1px solid rgba(71,71,76,0.3);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;background:rgba(186,158,255,0.1);border:1px solid rgba(186,158,255,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:20px;">🛡️</span>
            </div>
            <div>
              <p style="margin:0;font-weight:800;font-size:18px;color:#f2f0f6;">Cygnusa Guardian</p>
              <p style="margin:0;font-size:11px;color:#ba9eff;letter-spacing:2px;text-transform:uppercase;">Forensic Intelligence Platform</p>
            </div>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f2f0f6;">You're invited,<br/>{candidate_name} 👋</h1>
          <p style="margin:0 0 24px;color:#abaab0;font-size:14px;line-height:1.6;">
            You have been invited to complete a <strong style="color:#ba9eff;">forensic assessment</strong> on Cygnusa Guardian.
            This is a secure, AI-monitored evaluation. Your integrity is protected and every decision is explainable.
          </p>
          <!-- CTA Button -->
          <div style="text-align:center;margin:32px 0;">
            <a href="{magic_url}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#ba9eff,#8455ef);color:#0d0e12;font-weight:700;font-size:16px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
              🚀 Begin Assessment
            </a>
          </div>
          <!-- Note -->
          <div style="background:rgba(186,158,255,0.05);border:1px solid rgba(186,158,255,0.15);border-radius:10px;padding:16px;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#abaab0;line-height:1.6;">
              ⏱ This link expires in <strong style="color:#ba9eff;">{expires_hours} hours</strong>.<br/>
              🔒 One-time use only. Do not share this link.<br/>
              🎥 The assessment includes webcam and integrity monitoring.
            </p>
          </div>
          <!-- Raw link fallback -->
          <p style="margin:24px 0 0;font-size:11px;color:#47474c;word-break:break-all;">
            If the button doesn't work, paste this URL in your browser:<br/>
            <span style="color:#ba9eff;">{magic_url}</span>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0d0e12;padding:20px;border-top:1px solid rgba(71,71,76,0.2);text-align:center;">
          <p style="margin:0;font-size:10px;color:#47474c;letter-spacing:1px;text-transform:uppercase;">
            Cygnusa Guardian · AES-256 Encrypted · Every Access Logged · Powered by Gemini AI
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class MagicLinkRequest(BaseModel):
    candidate_id: str
    candidate_email: str
    candidate_name: str


class MagicLinkResponse(BaseModel):
    success: bool
    message: str
    # Only included in dev mode (SMTP not configured)
    dev_link: str | None = None


class MagicVerifyResponse(BaseModel):
    token: str
    candidate_id: str
    name: str
    email: str
    role: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/magic-link", response_model=MagicLinkResponse)
async def send_magic_link(
    request: MagicLinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Recruiter-only: generate a magic link token for a candidate and email it.
    The candidate does NOT need a password — the token IS their credential.
    """
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can send assessment invitations.")

    # Verify candidate exists
    candidate = db.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    # Generate a cryptographically secure random token
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(hours=MAGIC_LINK_TTL_HOURS)

    _magic_tokens[token] = {
        "candidate_id": request.candidate_id,
        "email": request.candidate_email,
        "name": request.candidate_name,
        "expires_at": expires_at,
        "used": False,
    }

    magic_url = f"{FRONTEND_URL}/assess/{token}"

    smtp_configured = bool(os.getenv("SMTP_HOST"))
    html = _build_email_html(request.candidate_name, magic_url, MAGIC_LINK_TTL_HOURS)
    sent = _send_email(
        to=request.candidate_email,
        subject=f"🛡️ Your Cygnusa Guardian Assessment Invitation — {request.candidate_name}",
        html=html,
    )

    if not sent and smtp_configured:
        raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP configuration.")

    logger.info(f"Magic link created for candidate {request.candidate_id} by recruiter {current_user['email']}")

    return MagicLinkResponse(
        success=True,
        message="Invitation sent!" if smtp_configured else "Dev mode: email logged to console.",
        dev_link=magic_url if not smtp_configured else None,
    )


@router.get("/verify-magic/{token}", response_model=MagicVerifyResponse)
async def verify_magic_link(token: str):
    """
    Public endpoint — candidate clicks the link in their email.
    Validates the token and returns a short-lived JWT scoped to the candidate.
    Token is invalidated (one-time use) after successful verification.
    """
    entry = _magic_tokens.get(token)

    if not entry:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired magic link. Please request a new invitation."
        )

    if entry.get("used"):
        raise HTTPException(
            status_code=401,
            detail="This magic link has already been used. Please contact your recruiter for a new link."
        )

    if datetime.utcnow() > entry["expires_at"]:
        _magic_tokens.pop(token, None)
        raise HTTPException(
            status_code=401,
            detail=f"This magic link expired after {MAGIC_LINK_TTL_HOURS} hours. Please request a new invitation."
        )

    # Mark as used (one-time)
    entry["used"] = True

    candidate_id = entry["candidate_id"]
    name = entry["name"]
    email = entry["email"]

    # Create a candidate-scoped JWT (role=candidate, 12hr expiry)
    jwt_token = create_token(
        user_id=candidate_id,
        email=email,
        role="candidate",
        name=name,
    )

    logger.info(f"Magic link verified for candidate {candidate_id} ({email})")

    return MagicVerifyResponse(
        token=jwt_token,
        candidate_id=candidate_id,
        name=name,
        email=email,
        role="candidate",
    )
