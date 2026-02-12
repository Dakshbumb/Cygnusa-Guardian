"""
Authentication Router

Handles user login/registration and session management.
Endpoints:
  POST /api/auth/login  - Authenticate and receive JWT token
  GET  /api/auth/me     - Get current user info from token
"""

import uuid
import logging

from fastapi import APIRouter, Depends
from models import User, LoginRequest, LoginResponse
from auth import create_token, get_current_user
from dependencies import db

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate user and return a JWT token.

    In demo mode, creates the user automatically if they don't exist.
    In production, this would verify credentials against a password hash.
    """
    user = db.get_user_by_email(request.email)

    if not user:
        user_id = f"u_{uuid.uuid4().hex[:8]}"
        user = User(
            id=user_id,
            email=request.email,
            role=request.role,
            name=request.email.split("@")[0].title().replace(".", " "),
        )
        db.save_user(user)
        logger.info(f"New user registered: {user.email} ({user.role})")

    token = create_token(user.id, user.email, user.role.value, user.name)
    logger.info(f"User logged in: {user.email} as {user.role}")

    return LoginResponse(
        user_id=user.id,
        role=user.role,
        token=token,
        name=user.name,
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile extracted from the JWT."""
    return {
        "user_id": current_user["user_id"],
        "role": current_user["role"],
        "name": current_user["name"],
    }
