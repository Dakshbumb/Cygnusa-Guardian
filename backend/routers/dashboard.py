"""
Dashboard & Management Router

Recruiter-facing analytics, candidate browsing, bulk actions, and notes.

Endpoints:
  GET   /api/dashboard/live                - Real-time active session feed
  GET   /api/dashboard/analytics           - Aggregate hiring metrics
  GET   /api/dashboard/candidates-by-role  - Candidates grouped by role
  PATCH /api/candidates/bulk-update        - Bulk status updates
  POST  /api/candidates/{id}/notes         - Add recruiter note
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel as PydanticBaseModel
from models import FinalDecision
from auth import require_recruiter
from dependencies import (
    db, decision_engine, active_sessions,
    add_decision_node, cache_response, get_cached_response, clear_cache,
)

logger = logging.getLogger("cygnusa-api")

router = APIRouter(tags=["Dashboard & Management"])





# ============================================================
# Live dashboard
# ============================================================

@router.get("/api/dashboard/live")
async def get_live_dashboard(user: dict = Depends(require_recruiter)):
    """Real-time dashboard showing active assessments and recent completions.

    Designed for polling every 2–5 seconds from the recruiter UI.
    """
    all_candidates = db.get_all_candidates()

    active_candidates = []
    for c in all_candidates:
        if c.status != "in_progress":
            continue

        coding_done = len(c.code_evidence or [])
        mcq_done = len(c.mcq_evidence or [])
        text_done = len(c.text_answer_evidence or [])
        psych_done = 1 if c.psychometric_evidence else 0

        total_progress = min(100, coding_done * 15 + mcq_done * 15 + text_done * 15 + psych_done * 25)

        # Get integrity events from database
        integrity_events = db.get_integrity_logs(c.id)
        high_severity = sum(1 for e in integrity_events if e.severity in ["high", "critical"])

        active_candidates.append({
            "id": c.id,
            "name": c.name,
            "job_title": c.job_title,
            "status": c.status,
            "started_at": c.created_at,
            "progress_percent": total_progress,
            "sections_completed": {
                "coding": coding_done, "mcq": mcq_done,
                "text": text_done, "psychometric": psych_done,
            },
            "integrity": {
                "total_events": len(integrity_events),
                "high_severity": high_severity,
                "recent_events": [e.model_dump() for e in integrity_events[-5:]],
                "status": "flagged" if high_severity > 2 else ("warning" if len(integrity_events) > 3 else "clean"),
            },
        })

    completed = [
        {
            "id": c.id, "name": c.name, "job_title": c.job_title,
            "outcome": c.final_decision.outcome if c.final_decision else None,
            "completed_at": c.completed_at,
        }
        for c in all_candidates
        if c.status == "completed" and c.final_decision
    ][-10:]

    return {
        "timestamp": datetime.now().isoformat(),
        "active_candidates": active_candidates,
        "active_count": len(active_candidates),
        "recently_completed": completed,
        "stats": {
            "total_in_progress": len(active_candidates),
            "total_completed": len([c for c in all_candidates if c.status == "completed"]),
            "flagged_count": len([c for c in active_candidates if c.get("integrity", {}).get("status") == "flagged"]),
        },
    }


# ============================================================
# Analytics
# ============================================================

@router.get("/api/dashboard/analytics")
async def get_dashboard_analytics(recruiter: dict = Depends(require_recruiter)):
    """Aggregate hiring analytics: counts, percentages, role distribution."""
    try:
        candidates = db.get_all_candidates()
        total = len(candidates)
        selected = rejected = pending = 0
        total_score = score_count = integrity_violations = completed_count = 0
        role_stats: dict = {}

        for c in candidates:
            outcome = c.final_decision.outcome if c.final_decision else "PENDING"
            if outcome == "HIRE":
                selected += 1
            elif outcome == "NO_HIRE":
                rejected += 1
            else:
                pending += 1

            if c.resume_evidence and c.resume_evidence.match_score:
                total_score += c.resume_evidence.match_score
                score_count += 1
            if c.integrity_evidence:
                integrity_violations += c.integrity_evidence.total_violations
            if c.status == "completed":
                completed_count += 1

            role = c.job_title or "Unspecified"
            if role not in role_stats:
                role_stats[role] = {"total": 0, "selected": 0, "rejected": 0, "pending": 0, "avg_score": 0}
            role_stats[role]["total"] += 1
            if outcome == "HIRE":
                role_stats[role]["selected"] += 1
            elif outcome == "NO_HIRE":
                role_stats[role]["rejected"] += 1
            else:
                role_stats[role]["pending"] += 1

        avg_score = (total_score / score_count) if score_count else 0
        completion_rate = (completed_count / total * 100) if total else 0

        return {
            "success": True,
            "metrics": {
                "total_candidates": total,
                "selected": {"count": selected, "percentage": round(selected / total * 100, 1) if total else 0},
                "rejected": {"count": rejected, "percentage": round(rejected / total * 100, 1) if total else 0},
                "pending": {"count": pending, "percentage": round(pending / total * 100, 1) if total else 0},
                "avg_score": round(avg_score, 1),
                "completion_rate": round(completion_rate, 1),
                "integrity_violations": integrity_violations,
            },
            "role_distribution": role_stats,
            "chart_data": {
                "status_pie": [
                    {"label": "Selected", "value": selected, "color": "#22C55E"},
                    {"label": "Rejected", "value": rejected, "color": "#EF4444"},
                    {"label": "Pending", "value": pending, "color": "#F59E0B"},
                ],
                "role_bar": [
                    {"role": role, "selected": s["selected"], "rejected": s["rejected"], "pending": s["pending"]}
                    for role, s in role_stats.items()
                ],
            },
        }
    except Exception as e:
        logger.error(f"Dashboard analytics failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analytics failed: {e}")


# ============================================================
# Candidates by role
# ============================================================

@router.get("/api/dashboard/candidates-by-role")
async def get_candidates_by_role(
    role: Optional[str] = None,
    recruiter: dict = Depends(require_recruiter),
):
    """Candidates grouped/sorted by role. HIRE first, then CONDITIONAL, PENDING, NO_HIRE."""
    try:
        candidates = db.get_all_candidates()
        if role:
            candidates = [c for c in candidates if c.job_title == role]

        sort_order = {"HIRE": 0, "CONDITIONAL": 1, "PENDING": 2, "NO_HIRE": 3}

        def _sort_key(c):
            outcome = c.final_decision.outcome if c.final_decision else "PENDING"
            return sort_order.get(outcome, 2)

        result = []
        for c in sorted(candidates, key=_sort_key):
            outcome = c.final_decision.outcome if c.final_decision else "PENDING"
            confidence = c.final_decision.confidence if c.final_decision else "low"
            overall_score = c.resume_evidence.match_score if c.resume_evidence else 0

            integrity_score = 100
            integrity_level = "clean"
            if c.integrity_evidence:
                v = c.integrity_evidence.total_violations
                integrity_score = max(0, 100 - v * 10)
                integrity_level = "major" if v > 5 else ("minor" if v > 0 else "clean")

            result.append({
                "id": c.id, "name": c.name, "email": c.email,
                "job_title": c.job_title, "status": c.status,
                "outcome": outcome, "confidence": confidence,
                "overall_score": round(overall_score, 1),
                "integrity_score": integrity_score,
                "integrity_level": integrity_level,
                "created_at": c.created_at, "completed_at": c.completed_at,
            })

        all_candidates = db.get_all_candidates()
        roles = list({c.job_title for c in all_candidates if c.job_title})
        role_summary = {}
        for r in roles:
            rc = [c for c in all_candidates if c.job_title == r]
            role_summary[r] = {
                "total": len(rc),
                "pending": sum(1 for c in rc if not c.final_decision or c.final_decision.outcome in [None, "PENDING", "CONDITIONAL"]),
            }

        return {"success": True, "candidates": result, "total": len(result), "available_roles": roles, "role_summary": role_summary}
    except Exception as e:
        logger.error(f"Candidates by role failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


# ============================================================
# Bulk update
# ============================================================

@router.patch("/api/candidates/bulk-update")
async def bulk_update_candidates(request: Request, recruiter: dict = Depends(require_recruiter)):
    """Bulk update candidate statuses (select / reject / pending).

    Body: {"candidate_ids": [...], "action": "select|reject|pending", "notes": "optional"}
    """
    try:
        body = await request.json()
        candidate_ids = body.get("candidate_ids", [])
        action = body.get("action", "").lower()
        notes = body.get("notes", "")

        if not candidate_ids:
            raise HTTPException(status_code=400, detail="No candidate IDs provided")
        if action not in ["select", "reject", "pending"]:
            raise HTTPException(status_code=400, detail="Invalid action. Use: select, reject, or pending")

        outcome_map = {"select": "HIRE", "reject": "NO_HIRE", "pending": "PENDING"}
        new_outcome = outcome_map[action]

        updated = 0
        failed = []
        for cid in candidate_ids:
            try:
                candidate = db.get_candidate(cid)
                if not candidate:
                    failed.append({"id": cid, "reason": "Not found"})
                    continue

                if not candidate.final_decision:
                    candidate.final_decision = FinalDecision(
                        candidate_id=cid, outcome=new_outcome,
                        confidence="medium", reasoning=[f"Bulk action by recruiter: {action}"],
                    )
                else:
                    candidate.final_decision.outcome = new_outcome
                    candidate.final_decision.reasoning.append(f"Bulk updated to {action} by recruiter")

                add_decision_node(
                    candidate_id=cid, node_type="MANUAL",
                    title=f"Recruiter Bulk Action: {action.title()}",
                    description=notes or f"Status updated to {new_outcome} via bulk action",
                    impact="positive" if action == "select" else "negative" if action == "reject" else "neutral",
                )
                db.save_candidate(candidate)
                updated += 1
            except Exception as e:
                failed.append({"id": cid, "reason": str(e)})

        return {"success": True, "updated_count": updated, "failed": failed, "action": action, "new_outcome": new_outcome}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk update failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {e}")


# ============================================================
# Notes
# ============================================================

@router.post("/api/candidates/{candidate_id}/notes")
async def add_recruiter_note(candidate_id: str, request: Request, recruiter: dict = Depends(require_recruiter)):
    """Add a recruiter note (added to the audit trail as a decision node)."""
    try:
        body = await request.json()
        note_text = body.get("note", "")
        if not note_text:
            raise HTTPException(status_code=400, detail="Note text is required")

        candidate = db.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        add_decision_node(
            candidate_id=candidate_id, node_type="NOTE",
            title="Recruiter Note Added", description=note_text, impact="neutral",
        )
        return {"success": True, "message": "Note added successfully", "candidate_id": candidate_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add note failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add note: {e}")


