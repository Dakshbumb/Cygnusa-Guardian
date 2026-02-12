"""
Integrity Monitoring Router

Logs proctoring events and video snapshots during assessments.
Endpoints:
  POST /api/integrity/log                    - Record a proctoring violation
  GET  /api/integrity/{candidate_id}         - Get integrity summary
  POST /api/assessment/upload-snapshot        - Upload webcam snapshot
  GET  /api/assessment/snapshots/{id}         - Retrieve snapshots
"""

import logging
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models import IntegrityEvent, VideoSnapshot, VideoEvidence
from dependencies import db, supabase, active_sessions, add_decision_node

logger = logging.getLogger("cygnusa-api")

router = APIRouter(tags=["Integrity Monitoring"])


# --------------------------------------------------------------- Events ---

@router.post("/api/integrity/log")
async def log_integrity_event(
    candidate_id: str = Form(...),
    event_type: str = Form(...),
    severity: str = Form(...),
    context: str = Form(default=None),
):
    """Log an integrity violation from the proctoring system.

    Supported event types: tab_switch, paste_detected, no_face,
    multiple_faces, suspicious_audio.
    Severity levels: low, medium, high, critical.
    """
    event = IntegrityEvent(
        timestamp=datetime.now().isoformat(),
        event_type=event_type,
        severity=severity,
        context=context,
    )

    db.log_integrity_event(candidate_id, event)

    if severity in ["high", "critical"]:
        add_decision_node(
            candidate_id=candidate_id,
            node_type="INTEGRITY",
            title=f"Forensic Alert: {event_type.replace('_', ' ').title()}",
            description=f"A {severity} violation was detected. {context}",
            impact="negative",
            evidence_id="integrity_violation",
        )

    return {"logged": True, "event": event.model_dump()}


@router.get("/api/integrity/{candidate_id}")
async def get_integrity_summary(candidate_id: str):
    """Return an integrity violation summary with trustworthiness rating."""
    events = db.get_integrity_logs(candidate_id)
    summary = db.get_integrity_summary(candidate_id)

    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(e.severity, 1) for e in events)

    if severity_score == 0:
        trustworthiness = "High"
    elif severity_score < 5:
        trustworthiness = "Medium"
    else:
        trustworthiness = "Low"

    return {
        "total_violations": len(events),
        "severity_score": severity_score,
        "trustworthiness_rating": trustworthiness,
        "by_severity": summary.get("by_severity", {}),
        "events": [e.model_dump() for e in events[-10:]],
    }


# -------------------------------------------------------- Video Proctoring ---

@router.post("/api/assessment/upload-snapshot")
async def upload_snapshot(
    candidate_id: str = Form(...),
    snapshot: UploadFile = File(...),
    face_detected: bool = Form(default=None),
):
    """Upload a webcam snapshot taken during the assessment.

    The frontend captures periodic screenshots for face-detection
    analysis and proctoring evidence.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    timestamp = datetime.now().isoformat().replace(":", "-")
    filename = f"{candidate_id}_{timestamp}.jpg"
    content = await snapshot.read()

    # Try cloud first, fall back to local
    if supabase:
        try:
            supabase.storage.from_("snapshots").upload(
                path=filename, file=content,
                file_options={"content-type": "image/jpeg"},
            )
            filepath = supabase.storage.from_("snapshots").get_public_url(filename)
            logger.info(f"Snapshot uploaded to Supabase: {filepath}")
        except Exception as e:
            logger.error(f"Supabase snapshot upload failed: {e}")
            filepath = f"snapshots/{filename}"
            with open(filepath, "wb") as f:
                f.write(content)
    else:
        filepath = f"snapshots/{filename}"
        with open(filepath, "wb") as f:
            f.write(content)

    snap = VideoSnapshot(
        timestamp=datetime.now().isoformat(),
        snapshot_path=filepath,
        face_detected=face_detected,
    )

    if not candidate.video_evidence:
        candidate.video_evidence = VideoEvidence()

    candidate.video_evidence.snapshots.append(snap)
    candidate.video_evidence.total_snapshots = len(candidate.video_evidence.snapshots)

    detected = sum(1 for s in candidate.video_evidence.snapshots if s.face_detected)
    total = len(candidate.video_evidence.snapshots)
    candidate.video_evidence.face_detection_rate = (detected / total * 100) if total > 0 else 0
    candidate.video_evidence.anomalies_detected = total - detected

    active_sessions[candidate_id] = candidate
    db.save_candidate(candidate)

    return {
        "success": True,
        "snapshot_path": filepath,
        "total_snapshots": candidate.video_evidence.total_snapshots,
        "face_detection_rate": candidate.video_evidence.face_detection_rate,
    }


@router.get("/api/assessment/snapshots/{candidate_id}")
async def get_snapshots(candidate_id: str):
    """Return video proctoring snapshots for a candidate (last 20)."""
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.video_evidence:
        return {"total_snapshots": 0, "snapshots": [], "face_detection_rate": None, "anomalies_detected": 0}

    return {
        "total_snapshots": candidate.video_evidence.total_snapshots,
        "snapshots": [s.model_dump() for s in candidate.video_evidence.snapshots[-20:]],
        "face_detection_rate": candidate.video_evidence.face_detection_rate,
        "anomalies_detected": candidate.video_evidence.anomalies_detected,
    }
