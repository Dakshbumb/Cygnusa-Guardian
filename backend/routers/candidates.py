"""
Candidate Management Router

CRUD operations for candidate profiles and job role listing.
Endpoints:
  POST   /api/candidates/create          - Create a new candidate
  GET    /api/candidates/{candidate_id}  - Get candidate details
  GET    /api/candidates                 - List all candidates (recruiter)
  DELETE /api/candidates/{candidate_id}  - Delete a candidate
  GET    /api/roles                      - List available job roles
"""

import json
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Form, Depends, HTTPException
from models import CandidateProfile
from auth import get_optional_user, require_recruiter, check_candidate_access, ROLE_CANDIDATE
from dependencies import db, active_sessions

logger = logging.getLogger("cygnusa-api")

router = APIRouter(tags=["Candidates"])


# ------------------------------------------------------------------ CRUD ---

@router.post("/api/candidates/create")
async def create_candidate(
    name: str = Form(...),
    email: str = Form(...),
    job_title: str = Form(default="Software Engineer"),
    recruiter: dict = Depends(require_recruiter),
):
    """Create a new candidate profile (recruiter-only)."""
    candidate_id = f"c_{uuid.uuid4().hex[:8]}"

    candidate = CandidateProfile(
        id=candidate_id,
        name=name,
        email=email,
        job_title=job_title,
        status="pending",
    )

    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    return {
        "success": True,
        "candidate_id": candidate_id,
        "message": f"Candidate {name} created successfully",
        "next_step": "Upload resume via /api/resume/upload",
    }


@router.get("/api/candidates/{candidate_id}")
async def get_candidate(candidate_id: str, current_user: dict = Depends(get_optional_user)):
    """Retrieve a single candidate's full profile.

    Recruiters can view any candidate; candidates can only view their own.
    Unauthenticated access (e.g. magic-link) is allowed by candidate ID.
    """
    candidate = active_sessions.get(candidate_id)
    if not candidate:
        candidate = db.get_candidate(candidate_id)
        if candidate:
            active_sessions[candidate_id] = candidate

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Access control: candidates may only view their own profile
    if current_user and current_user.get("role") == ROLE_CANDIDATE:
        if not check_candidate_access(current_user, candidate):
            raise HTTPException(status_code=403, detail="Access denied")

    return candidate.model_dump()


@router.get("/api/candidates")
async def list_candidates(
    status: Optional[str] = None,
    recruiter: dict = Depends(require_recruiter),
):
    """Return a lightweight list of candidates for the dashboard (recruiter-only)."""
    candidates = db.get_candidates_summary(status=status)
    return {"total": len(candidates), "candidates": candidates}


@router.delete("/api/candidates/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    recruiter: dict = Depends(require_recruiter),
):
    """Delete a candidate and all associated data (recruiter-only)."""
    success = db.delete_candidate(candidate_id)
    if candidate_id in active_sessions:
        del active_sessions[candidate_id]

    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {"success": True, "message": "Candidate deleted"}


# --------------------------------------------------------------- Roles ---

@router.get("/api/roles")
async def list_roles():
    """Return all available job roles from the configuration file."""
    try:
        with open("job_roles.json", "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load roles: {e}")
        return []
