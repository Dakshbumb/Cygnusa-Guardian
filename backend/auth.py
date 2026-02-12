"""
Cygnusa Guardian - Authentication Module
JWT-based authentication with role-based access control
"""

import os
import jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, Header, Depends
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration - Secret must be at least 32 bytes for HS256 (RFC 7518)
SECRET_KEY = os.getenv("JWT_SECRET", "cygnusa-demo-secret-key-2026-guardian-secure")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


class AuthError(Exception):
    """Custom auth exception for better error messages"""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


def create_token(user_id: str, email: str, role: str, name: str) -> str:
    """
    Create JWT token with user information.
    Expires in 24 hours.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "name": name,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(authorization: Optional[str]) -> dict:
    """
    Verify and decode JWT token from Authorization header.
    Returns decoded payload with user_id, role, name.
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise AuthError(401, "Missing or invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Validate payload structure
        required_fields = ["user_id", "email", "role", "name"]
        for field in required_fields:
            if field not in payload:
                raise AuthError(401, f"Invalid token: missing {field}")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "Token has expired. Please log in again.")
    except jwt.InvalidTokenError as e:
        raise AuthError(401, f"Invalid token. Please log in again.")
    except AuthError:
        raise
    except Exception as e:
        raise AuthError(401, f"Authentication failed: {str(e)}")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency to extract current user from Authorization header.
    Use as: current_user = Depends(get_current_user)
    """
    try:
        return verify_token(authorization)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Get user if authenticated, None otherwise.
    Use for endpoints that work with or without auth.
    """
    try:
        if not authorization:
            return None
        return verify_token(authorization)
    except Exception:
        return None


# Role constants for easy checking
ROLE_CANDIDATE = "candidate"
ROLE_RECRUITER = "recruiter"  
ROLE_ADMIN = "admin"


def require_recruiter(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires recruiter role"""
    if current_user["role"] not in [ROLE_RECRUITER, ROLE_ADMIN]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Recruiter role required."
        )
    return current_user


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires admin role"""
    if current_user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin role required."
        )
    return current_user


def check_candidate_access(current_user: dict, candidate_profile) -> bool:
    """
    Check if current user can access a candidate's data.
    - Candidates can only access their own data
    - Recruiters and admins can access all
    """
    if current_user["role"] in [ROLE_RECRUITER, ROLE_ADMIN]:
        return True
    
    # Candidates can only access their own profile (matching email)
    # candidate_profile can be a dict (from API) or CandidateProfile object
    if hasattr(candidate_profile, 'email'):
        return current_user["email"] == candidate_profile.email
    elif isinstance(candidate_profile, dict):
        return current_user["email"] == candidate_profile.get("email")
    
    return False
