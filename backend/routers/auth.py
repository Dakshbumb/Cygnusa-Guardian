"""
Authentication Router

Handles user registration, login, and session management.

Endpoints:
  POST /api/auth/register - Register a new account with email + password
  POST /api/auth/login    - Authenticate and receive JWT token
  GET  /api/auth/me       - Get current user info from token
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from models import User, RegisterRequest, LoginRequest, LoginResponse
from auth import (
    create_token, get_current_user,
    hash_password, verify_password,
    check_rate_limit, record_failed_attempt, clear_failed_attempts,
)
from dependencies import db

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@router.post("/register", response_model=LoginResponse, status_code=201)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    - Email must be unique.
    - Password must be at least 8 characters (enforced by the model).
    - Returns a JWT token so the user is immediately logged in.
    """
    if db.user_email_exists(request.email):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please log in instead."
        )

    user_id = f"u_{uuid.uuid4().hex[:8]}"
    user = User(
        id=user_id,
        email=request.email,
        role=request.role,
        name=request.name,
    )
    pw_hash = hash_password(request.password)
    db.save_user(user, password_hash=pw_hash)
    logger.info(f"New user registered: {user.email} ({user.role})")

    token = create_token(user.id, user.email, user.role.value, user.name)
    return LoginResponse(user_id=user.id, role=user.role, token=token, name=user.name)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate with email + password.
    - Returns 401 for unknown email or wrong password (same message to prevent enumeration).
    - Returns 429 after 5 consecutive failures (60s lockout).
    """
    check_rate_limit(request.email)

    user, pw_hash = db.get_user_with_hash(request.email)

    if not user:
        record_failed_attempt(request.email)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not pw_hash:
        # Legacy account with no password — prompt re-registration
        raise HTTPException(
            status_code=401,
            detail="This account was created before password auth was enabled. "
                   "Please register again with a password."
        )

    if not verify_password(request.password, pw_hash):
        record_failed_attempt(request.email)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Role mismatch guard (prevents candidate using recruiter UI and vice-versa)
    if user.role.value != request.role.value:
        raise HTTPException(
            status_code=403,
            detail=f"This account is registered as '{user.role.value}', not '{request.role.value}'."
        )

    clear_failed_attempts(request.email)
    token = create_token(user.id, user.email, user.role.value, user.name)
    logger.info(f"User logged in: {user.email} as {user.role}")

    return LoginResponse(user_id=user.id, role=user.role, token=token, name=user.name)


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile extracted from the JWT."""
    return {
        "user_id": current_user["user_id"],
        "role": current_user["role"],
        "name": current_user["name"],
        "email": current_user["email"],
    }
