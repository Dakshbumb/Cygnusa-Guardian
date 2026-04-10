"""
Cygnusa Guardian - Authentication Module
JWT-based authentication with bcrypt password hashing and RBAC.
"""

import os
import time
import jwt
import bcrypt
from datetime import datetime, timedelta
from fastapi import HTTPException, Header, Depends
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("JWT_SECRET", "cygnusa-guardian-dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt. Returns the hash string."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Login rate limiting (in-memory, resets on restart)
# ---------------------------------------------------------------------------

_failed_attempts: dict = {}   # email → {"count": int, "locked_until": float}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60


def check_rate_limit(email: str) -> None:
    """Raise HTTPException 429 if the email is temporarily locked out."""
    entry = _failed_attempts.get(email)
    if entry and entry["locked_until"] > time.time():
        wait = int(entry["locked_until"] - time.time())
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {wait}s."
        )


def record_failed_attempt(email: str) -> None:
    """Increment failed attempt counter; lock the account after MAX_ATTEMPTS."""
    entry = _failed_attempts.get(email, {"count": 0, "locked_until": 0.0})
    entry["count"] += 1
    if entry["count"] >= MAX_ATTEMPTS:
        entry["locked_until"] = time.time() + LOCKOUT_SECONDS
        entry["count"] = 0  # reset counter after locking
    _failed_attempts[email] = entry


def clear_failed_attempts(email: str) -> None:
    """Reset failed attempt counter after a successful login."""
    _failed_attempts.pop(email, None)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

class AuthError(Exception):
    """Custom auth exception for better error messages"""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


def create_token(user_id: str, email: str, role: str, name: str) -> str:
    """Create a signed JWT token. Expires in TOKEN_EXPIRE_HOURS."""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "name": name,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(authorization: Optional[str]) -> dict:
    """Verify and decode a JWT from the Authorization header."""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise AuthError(401, "Missing or invalid authorization header")

        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        for field in ["user_id", "email", "role", "name"]:
            if field not in payload:
                raise AuthError(401, f"Invalid token: missing {field}")

        return payload

    except jwt.ExpiredSignatureError:
        raise AuthError(401, "Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise AuthError(401, "Invalid token. Please log in again.")
    except AuthError:
        raise
    except Exception as e:
        raise AuthError(401, f"Authentication failed: {str(e)}")


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency — extracts current user from Authorization header."""
    try:
        return verify_token(authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Return user if authenticated, None otherwise."""
    try:
        if not authorization:
            return None
        return verify_token(authorization)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Role constants & guards
# ---------------------------------------------------------------------------

ROLE_CANDIDATE = "candidate"
ROLE_RECRUITER = "recruiter"
ROLE_ADMIN = "admin"


def require_recruiter(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires recruiter or admin role."""
    if current_user["role"] not in [ROLE_RECRUITER, ROLE_ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied. Recruiter role required.")
    return current_user


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires admin role."""
    if current_user["role"] != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    return current_user


def check_candidate_access(current_user: dict, candidate_profile) -> bool:
    """Recruiters/admins can access all; candidates only their own profile."""
    if current_user["role"] in [ROLE_RECRUITER, ROLE_ADMIN]:
        return True
    if hasattr(candidate_profile, "email"):
        return current_user["email"] == candidate_profile.email
    elif isinstance(candidate_profile, dict):
        return current_user["email"] == candidate_profile.get("email")
    return False
