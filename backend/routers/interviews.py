"""
Interview Scheduling Router

Manages interview slots created by recruiters for candidates who passed assessment.

Endpoints:
  POST /api/interviews/schedule       - Schedule an interview
  GET  /api/interviews/upcoming       - List upcoming interviews (recruiter)
  GET  /api/interviews/{candidateId}  - Get interview for a specific candidate
  DELETE /api/interviews/{interviewId} - Cancel an interview
"""

import uuid
import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user
from dependencies import db

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])

# ---------------------------------------------------------------------------
# In-memory store (swap for a DB table in full production)
# ---------------------------------------------------------------------------
_interviews: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class InterviewScheduleRequest(BaseModel):
    candidate_id: str
    candidate_name: str
    candidate_email: str
    scheduled_at: str           # ISO-8601 datetime string
    duration_minutes: int = 45
    interviewer_name: str = ""
    interviewer_email: str = ""
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    interview_type: str = "technical"   # technical | hr | final | panel


class InterviewResponse(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    scheduled_at: str
    duration_minutes: int
    interviewer_name: str
    interviewer_email: str
    meeting_link: Optional[str]
    notes: Optional[str]
    interview_type: str
    status: str          # scheduled | completed | cancelled
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(interview: dict) -> InterviewResponse:
    return InterviewResponse(**interview)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/schedule", response_model=InterviewResponse, status_code=201)
async def schedule_interview(
    request: InterviewScheduleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Schedule an interview for a candidate who has completed assessment."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can schedule interviews.")

    # Verify candidate exists
    candidate = db.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    interview_id = f"iv_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()

    interview = {
        "id": interview_id,
        "candidate_id": request.candidate_id,
        "candidate_name": request.candidate_name,
        "candidate_email": request.candidate_email,
        "scheduled_at": request.scheduled_at,
        "duration_minutes": request.duration_minutes,
        "interviewer_name": request.interviewer_name,
        "interviewer_email": request.interviewer_email,
        "meeting_link": request.meeting_link,
        "notes": request.notes,
        "interview_type": request.interview_type,
        "status": "scheduled",
        "created_at": now,
        "created_by": current_user.get("email"),
    }

    _interviews[interview_id] = interview

    logger.info(f"Interview scheduled: {interview_id} for candidate {request.candidate_id}")
    return _to_response(interview)


@router.get("/upcoming", response_model=List[InterviewResponse])
async def get_upcoming_interviews(
    current_user: dict = Depends(get_current_user),
):
    """Return all upcoming (not cancelled) interviews, sorted by date."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view interview schedules.")

    upcoming = [
        iv for iv in _interviews.values()
        if iv["status"] != "cancelled"
    ]
    upcoming.sort(key=lambda x: x["scheduled_at"])
    return [_to_response(iv) for iv in upcoming]


@router.get("/{candidate_id}", response_model=Optional[InterviewResponse])
async def get_candidate_interview(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the latest scheduled interview for a specific candidate."""
    allowed = (
        current_user.get("role") == "recruiter"
        or current_user.get("user_id") == candidate_id
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied.")

    matches = [
        iv for iv in _interviews.values()
        if iv["candidate_id"] == candidate_id and iv["status"] == "scheduled"
    ]
    if not matches:
        return None

    matches.sort(key=lambda x: x["scheduled_at"])
    return _to_response(matches[-1])


@router.delete("/{interview_id}", status_code=204)
async def cancel_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel an interview by ID."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can cancel interviews.")

    iv = _interviews.get(interview_id)
    if not iv:
        raise HTTPException(status_code=404, detail="Interview not found.")

    _interviews[interview_id]["status"] = "cancelled"
    logger.info(f"Interview {interview_id} cancelled by {current_user.get('email')}")
