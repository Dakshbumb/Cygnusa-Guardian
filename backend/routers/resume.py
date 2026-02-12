"""
Resume Analysis Router

Handles resume upload, validation, and bulk analysis.
Endpoints:
  POST /api/resume/validate      - Validate resume format (no save)
  POST /api/resume/analyze       - One-shot: create candidate + analyze resume
  POST /api/resume/upload        - Upload resume for existing candidate
  POST /api/resume/bulk-analyze  - Batch analysis of multiple resumes
"""

import json
import os
import time
import uuid
import logging
import traceback
from typing import List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from models import CandidateProfile
from resume_parser import ResumeGatekeeper
from dependencies import (
    db, resume_validator, supabase, active_sessions, add_decision_node,
)

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/resume", tags=["Resume Analysis"])


# --------------------------------------------------------------- Validate ---

@router.post("/validate")
async def validate_resume_only(file: UploadFile = File(...)):
    """Lightweight resume validation without saving or candidate association.

    Intended for instant UI feedback before the full analysis flow.
    """
    is_valid, error_code, error_message = await resume_validator.validate_file(file)

    if not is_valid:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": error_code, "message": error_message},
        )

    return {"success": True, "message": "Valid resume format and content", "status": "valid"}


# --------------------------------------------------------------- Analyze ---

@router.post("/analyze")
async def analyze_resume_full(
    candidate_name: str = Form(default="Candidate Subject"),
    candidate_email: str = Form(default="subject@cygnusa.internal"),
    job_title: str = Form(default="Software Engineer"),
    jd_skills: str = Form(default="python,javascript,react,nodejs,postgresql,docker,git,typescript"),
    critical_skills: str = Form(default=""),
    file: UploadFile = File(...),
):
    """One-shot resume analysis: validate → create candidate → parse → rank.

    This is the primary endpoint used by the candidate-facing upload flow.
    Returns skill matching evidence, ranking, and multi-role comparisons.
    """
    # Step 1: Validate
    is_valid, error_code, error_message = await resume_validator.validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={"error": error_code, "message": error_message, "accepted_formats": ["PDF", "DOCX"]},
        )

    # Step 2: Create candidate
    candidate_id = f"c_{uuid.uuid4().hex[:8]}"
    candidate = CandidateProfile(
        id=candidate_id,
        name=candidate_name,
        email=candidate_email,
        job_title=job_title,
        status="resume_uploaded",
    )

    # Step 3: Save file locally (needed for text extraction)
    file_name = f"{candidate_id}_{file.filename}"
    file_content = await file.read()
    local_path = f"uploads/{file_name}"
    with open(local_path, "wb") as f:
        f.write(file_content)

    # Step 3b: Cloud backup via Supabase
    file_path = local_path
    if supabase:
        try:
            supabase.storage.from_("resumes").upload(
                path=file_name,
                file=file_content,
                file_options={"content-type": file.content_type},
            )
            file_path = supabase.storage.from_("resumes").get_public_url(file_name)
            logger.info(f"Resume uploaded to Supabase: {file_path}")
        except Exception as e:
            logger.error(f"Supabase upload failed, using local: {e}")

    # Step 4: Extract text once
    start_ext = time.time()
    extracted_text = ResumeGatekeeper.extract_text(local_path)
    logger.info(f"Text extraction completed in {time.time() - start_ext:.4f}s")

    # Step 5: Parse and rank
    try:
        skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
        critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]

        gatekeeper = ResumeGatekeeper(jd_skills=skills_list, critical_skills=critical_list)
        evidence = gatekeeper.parse_resume(extracted_text=extracted_text)
        rank, justification = gatekeeper.rank_candidate(evidence)
        logger.info(f"Analysis complete: Match={evidence.match_score:.1f}%, Rank={rank}")

        # Step 6: Multi-role matching
        multi_role_results = _run_multi_role_matching(extracted_text)

        # Persist candidate
        candidate.resume_path = file_path
        candidate.resume_evidence = evidence

        add_decision_node(
            candidate_id=candidate_id,
            node_type="RESUME",
            title="Resume Analysis Baseline",
            description=f"Match score: {evidence.match_score:.1f}%. {evidence.reasoning[:100]}...",
            impact="positive" if evidence.match_score >= 60 else "neutral" if evidence.match_score >= 30 else "negative",
            predicted_rank=evidence.match_score,
        )

        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate

        return {
            "success": True,
            "candidate_id": candidate_id,
            "name": candidate_name,
            "rank": rank,
            "justification": justification,
            "evidence": {
                "score": evidence.match_score,
                "skills_extracted": evidence.skills_extracted,
                "jd_required": evidence.jd_required,
                "missing_critical": evidence.missing_critical,
                "experience_years": evidence.experience_years,
                "education": evidence.education,
                "reasoning": evidence.reasoning,
                "match_calculation": evidence.match_calculation,
            },
            "multi_role_matches": multi_role_results,
            "next_step": f"/candidate/{candidate_id}" if rank not in ["REJECT", "GAP_DETECTED", "INCOMPATIBLE"] else None,
        }
    except Exception as e:
        logger.error(f"Resume analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"message": f"Resume analysis failed: {e}", "type": type(e).__name__},
        )


# --------------------------------------------------------------- Upload ---

@router.post("/upload")
async def upload_resume(
    candidate_id: str = Form(...),
    jd_skills: str = Form(...),
    critical_skills: str = Form(default=""),
    file: UploadFile = File(...),
):
    """Upload and analyze a resume for an *existing* candidate.

    Returns deterministic skill matching with full reasoning.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate
    is_valid, error_code, error_message = await resume_validator.validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "error": error_code,
                "message": error_message,
                "accepted_formats": ["PDF", "DOCX"],
                "requirements": [
                    "Must be a professional resume/CV",
                    "Must contain contact information",
                    "Must have experience or education sections",
                    "File size: 10KB - 5MB",
                ],
            },
        )

    # Save file
    file_path = f"uploads/{candidate_id}_{file.filename}"
    file.file.seek(0)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Extract text
    extracted_text = ResumeGatekeeper.extract_text(file_path).replace("\x00", "").replace("\u0000", "")

    # Parse and rank
    skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
    critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]
    gatekeeper = ResumeGatekeeper(jd_skills=skills_list, critical_skills=critical_list)

    try:
        evidence = gatekeeper.parse_resume(extracted_text=extracted_text)
        rank, justification = gatekeeper.rank_candidate(evidence)
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    # Multi-role matching
    multi_role_results = _run_multi_role_matching(extracted_text)

    # Persist
    candidate.resume_path = file_path
    candidate.resume_evidence = evidence
    candidate.status = "resume_uploaded"
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    return {
        "success": True,
        "evidence": evidence.model_dump(),
        "rank": rank,
        "justification": justification,
        "multi_role_matches": multi_role_results,
        "next_step": "Start assessment via /api/assessment/start" if rank != "REJECT" else "Candidate auto-rejected",
    }


# -------------------------------------------------------- Bulk Analyze ---

@router.post("/bulk-analyze")
async def bulk_analyze_resumes(
    job_title: str = Form(default="Software Engineer"),
    jd_skills: str = Form(default="python,javascript,react,nodejs,sql"),
    critical_skills: str = Form(default=""),
    files: List[UploadFile] = File(...),
):
    """Batch resume analysis for recruiters (max 20 files).

    Each file is validated, parsed, ranked, and a candidate profile is
    created automatically. Results are sorted by score (descending).
    """
    MAX_FILES = 20
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES} files per batch. Received {len(files)}")
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
    critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]

    results = []
    processed = 0
    failed = 0

    for file in files:
        file_result = {
            "filename": file.filename, "status": "pending", "candidate_id": None,
            "name": None, "score": 0, "rank": None, "reasoning": None,
            "skills_matched": [], "missing_critical": [], "experience_years": None, "error": None,
        }
        try:
            is_valid, error_code, error_message = await resume_validator.validate_file(file)
            if not is_valid:
                file_result.update(status="invalid", error=error_message)
                failed += 1
                results.append(file_result)
                continue

            candidate_id = f"bulk_{uuid.uuid4().hex[:8]}"
            file_content = await file.read()
            local_path = f"uploads/{candidate_id}_{file.filename}"
            with open(local_path, "wb") as f:
                f.write(file_content)

            extracted_text = ResumeGatekeeper.extract_text(local_path)
            if not extracted_text or len(extracted_text) < 50:
                file_result.update(status="extraction_failed", error="Could not extract text from resume")
                failed += 1
                results.append(file_result)
                continue

            gatekeeper = ResumeGatekeeper(jd_skills=skills_list, critical_skills=critical_list)
            evidence = gatekeeper.parse_resume(extracted_text=extracted_text)
            rank, justification = gatekeeper.rank_candidate(evidence)

            # Infer candidate name from first line of resume text
            lines = extracted_text.strip().split("\n")
            candidate_name = lines[0].strip()[:50] if lines else "Unknown Candidate"
            if any(x in candidate_name.lower() for x in ["resume", "cv", "curriculum", "page", "http", "@"]):
                candidate_name = f"Candidate {candidate_id[-4:]}"

            candidate = CandidateProfile(
                id=candidate_id, name=candidate_name,
                email=f"{candidate_id}@bulk-import.cygnusa",
                job_title=job_title, status="bulk_imported",
                resume_path=local_path, resume_evidence=evidence,
            )
            db.save_candidate(candidate)

            file_result.update(
                status="success", candidate_id=candidate_id, name=candidate_name,
                score=evidence.match_score, rank=rank, reasoning=evidence.reasoning,
                justification=justification, skills_matched=evidence.skills_extracted,
                missing_critical=evidence.missing_critical, experience_years=evidence.experience_years,
                education=evidence.education,
            )
            processed += 1
            logger.info(f"Bulk: {file.filename} -> {candidate_id} (Score: {evidence.match_score}%)")
        except Exception as e:
            file_result.update(status="error", error=str(e))
            failed += 1
            logger.error(f"Bulk error for {file.filename}: {e}")

        results.append(file_result)

    # Sort by score descending and assign position
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    for i, r in enumerate(results):
        if r["status"] == "success":
            r["position"] = i + 1

    return {
        "success": True,
        "total_files": len(files),
        "processed": processed,
        "failed": failed,
        "job_title": job_title,
        "required_skills": skills_list,
        "critical_skills": critical_list,
        "results": results,
        "top_candidates": [r for r in results if r.get("score", 0) >= 60][:5],
    }


# ----------------------------------------------------------- Helpers ---

def _run_multi_role_matching(extracted_text: str) -> list:
    """Match a resume against every role defined in job_roles.json."""
    results = []
    try:
        if os.path.exists("job_roles.json"):
            with open("job_roles.json", "r") as f:
                for role in json.load(f):
                    rg = ResumeGatekeeper(
                        jd_skills=role["required_skills"],
                        critical_skills=role["critical_skills"],
                    )
                    ev = rg.parse_resume(extracted_text=extracted_text)
                    status, _ = rg.rank_candidate(ev)
                    results.append({
                        "id": role["id"],
                        "title": role["title"],
                        "match_score": ev.match_score,
                        "status": status,
                        "reasoning": ev.reasoning,
                    })
    except Exception as e:
        logger.error(f"Multi-role matching failed: {e}", exc_info=True)
    return results
