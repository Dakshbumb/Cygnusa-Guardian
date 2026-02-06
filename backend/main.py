"""
Cygnusa Guardian - FastAPI Main Application
Central API for the Glass-Box Hiring System
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import json
import uuid
import os
import io
import logging
import traceback
import time
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from the same directory as this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("cygnusa_guardian.log")
    ]
)
logger = logging.getLogger("cygnusa-api")

ENV = os.getenv("ENV", "development")

from models import (
    CandidateProfile, IntegrityEvent, IntegrityEvidence,
    MCQEvidence, PsychometricEvidence, JobDescription, TextAnswerEvidence,
    VideoSnapshot, VideoEvidence, User, UserRole, LoginRequest, LoginResponse,
    KeystrokeEvidence, KeystrokeInterval
)
from resume_parser import ResumeGatekeeper
from code_executor import CodeSandbox, DEMO_QUESTIONS, DEMO_MCQS
from decision_engine import ExplainableDecisionEngine
from database import Database
from resume_validator import ResumeValidator
from auth import (
    create_token, get_current_user, get_optional_user,
    require_recruiter, require_admin, check_candidate_access,
    ROLE_CANDIDATE, ROLE_RECRUITER, ROLE_ADMIN, AuthError
)

# Initialize FastAPI app
app = FastAPI(
    title="Cygnusa Guardian API",
    description="Glass-Box AI Hiring System - Every decision is explainable",
    version="1.0.0"
)

# Add GZip compression for faster responses
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)


# Simple in-memory response cache for dashboard endpoints
_response_cache = {}
_cache_ttl = 30  # 30 seconds

def cache_response(key: str, data: dict, ttl: int = _cache_ttl):
    """Cache a response with TTL"""
    _response_cache[key] = {
        "data": data,
        "expires": time.time() + ttl
    }

def get_cached_response(key: str):
    """Get cached response if valid"""
    if key in _response_cache:
        cached = _response_cache[key]
        if time.time() < cached["expires"]:
            return cached["data"]
        del _response_cache[key]
    return None

def clear_cache(pattern: str = None):
    """Clear cache entries matching pattern"""
    if pattern:
        keys_to_delete = [k for k in _response_cache.keys() if pattern in k]
        for k in keys_to_delete:
            del _response_cache[k]
    else:
        _response_cache.clear()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Optimized logging - only log non-trivial requests"""
    # Skip logging for frequent/trivial requests
    skip_log_paths = ["/health", "/api/health", "/snapshots"]
    should_log = not any(request.url.path.startswith(p) for p in skip_log_paths)
    
    if should_log and ENV != "production":
        logger.info(f"🔍 {request.method} {request.url.path}")
    
    start_time = time.time()
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        # Only log slow requests in production
        if duration_ms > 500 or (should_log and ENV != "production"):
            logger.info(f"✨ {response.status_code} {request.url.path} ({duration_ms:.0f}ms)")
        return response
    except Exception as e:
        logger.error(f"💥 ERROR: {str(e)}", exc_info=True)
        raise

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://cygnusa-guardian.vercel.app",
        "https://cygnusa-guardian-one.vercel.app",
    ],
    # Better for production: allow any vercel subdomain if needed
    allow_origin_regex=r"https://cygnusa-guardian.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("snapshots", exist_ok=True)  # For video proctoring snapshots

# Initialize services
db = Database()
code_sandbox = CodeSandbox()
decision_engine = ExplainableDecisionEngine(use_gemini=True)
from decision_engine import ShadowProctorEngine, KeystrokeDynamicsAnalyzer
shadow_proctor = ShadowProctorEngine()
keystroke_analyzer = KeystrokeDynamicsAnalyzer()
resume_validator = ResumeValidator()

# In-memory cache for active sessions (for faster access)
active_sessions = {}

# Share tokens for report sharing (token -> {candidate_id, expires_at})
share_tokens = {}

# Static files for snapshots (fallback for local dev)
app.mount("/snapshots", StaticFiles(directory="snapshots"), name="snapshots")

# Initialize Supabase client for cloud storage
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        # Robust initialization for cloud environments
        from supabase.client import ClientOptions
        supabase = create_client(
            SUPABASE_URL, 
            SUPABASE_KEY,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10
            )
        )
        logger.info("Supabase client successfully initialized")
    except Exception as e:
        logger.error(f"Supabase init error (retrying with minimal options): {e}")
        try:
            # Fallback to absolute bare-bones client
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Supabase client initialized with fallback")
        except Exception as e2:
            logger.error(f"Critical Supabase failure: {e2}")


def add_decision_node(candidate_id: str, node_type: str, title: str, description: str, impact: str = "neutral", evidence_id: str = None, predicted_rank: float = None):
    """Utility to record a decision node for the forensic timeline"""
    from models import DecisionNode
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if candidate:
        node = DecisionNode(
            node_type=node_type,
            title=title,
            description=description,
            impact=impact,
            evidence_id=evidence_id,
            predicted_rank=predicted_rank
        )
        if candidate.decision_nodes is None:
            candidate.decision_nodes = []
        candidate.decision_nodes.append(node)
        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate
        logger.info(f"Recorded Decision Node: {title} for {candidate_id}")



# ==================== Health & Info ====================

@app.get("/")
def root():
    """API root - health check"""
    return {
        "service": "Cygnusa Guardian",
        "tagline": "Glass-Box Hiring Intelligence",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/health")
def health_check():
    """Detailed health check"""
    db_ok = False
    user_count = 0
    candidate_count = 0
    db_error = None
    
    try:
        db_ok = db.check_connection()
        if db_ok:
            try:
                user_count = len(db.get_all_users())
                candidate_count = len(db.get_all_candidates())
            except Exception as e:
                db_error = f"count_error: {str(e)}"
    except Exception as e:
        db_error = str(e)
        db_ok = False
            
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else f"connection_failed ({db_error})" if db_error else "not_configured",
        "counts": {
            "users": user_count,
            "candidates": candidate_count
        },
        "ai_engine": "gemini" if decision_engine.use_gemini else "fallback",
        "timestamp": datetime.now().isoformat(),
        "env": ENV
    }



# ==================== Authentication ====================

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Login or register user.
    For demo purposes, creates user if not exists.
    In production, this would verify credentials.
    """
    # Check if user exists
    user = db.get_user_by_email(request.email)
    
    if not user:
        # Create new user (demo mode - auto-register)
        user_id = f"u_{uuid.uuid4().hex[:8]}"
        user = User(
            id=user_id,
            email=request.email,
            role=request.role,
            name=request.email.split('@')[0].title().replace('.', ' ')
        )
        db.save_user(user)
        logger.info(f"Created new user: {user.email} ({user.role})")
    
    # Generate JWT token
    token = create_token(user.id, user.email, user.role.value, user.name)
    
    logger.info(f"User logged in: {user.email} as {user.role}")
    
    return LoginResponse(
        user_id=user.id,
        role=user.role,
        token=token,
        name=user.name
    )


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "user_id": current_user["user_id"],
        "role": current_user["role"],
        "name": current_user["name"]
    }


# ==================== Candidate Management ====================

@app.post("/api/candidates/create")
async def create_candidate(
    name: str = Form(...),
    email: str = Form(...),
    job_title: str = Form(default="Software Engineer"),
    recruiter: dict = Depends(require_recruiter)
):
    """Create a new candidate profile"""
    candidate_id = f"c_{uuid.uuid4().hex[:8]}"
    
    candidate = CandidateProfile(
        id=candidate_id,
        name=name,
        email=email,
        job_title=job_title,
        status="pending"
    )
    
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    return {
        "success": True,
        "candidate_id": candidate_id,
        "message": f"Candidate {name} created successfully",
        "next_step": "Upload resume via /api/resume/upload"
    }


@app.get("/api/candidates/{candidate_id}")
async def get_candidate(candidate_id: str, current_user: dict = Depends(get_optional_user)):
    candidate = active_sessions.get(candidate_id)
    if not candidate:
        candidate = db.get_candidate(candidate_id)
        if candidate:
            active_sessions[candidate_id] = candidate
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # If user is logged in, check access (recruiters see all, candidates own only)
    # If no user (magic link access), allow access via candidate_id URL
    if current_user and current_user.get("role") == ROLE_CANDIDATE:
        if not check_candidate_access(current_user, candidate):
            raise HTTPException(status_code=403, detail="Access denied")
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return candidate.model_dump()


@app.get("/api/candidates")
async def list_candidates(
    status: Optional[str] = None,
    recruiter: dict = Depends(require_recruiter)
):
    """Shallow list of candidates for dashboard (Fast & Lightweight)"""
    candidates = db.get_candidates_summary(status=status)
    return {
        "total": len(candidates),
        "candidates": candidates
    }


@app.delete("/api/candidates/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    recruiter: dict = Depends(require_recruiter)
):
    """Delete a candidate and all associated data"""
    success = db.delete_candidate(candidate_id)
    if candidate_id in active_sessions:
        del active_sessions[candidate_id]
    
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return {"success": True, "message": "Candidate deleted"}


@app.get("/api/roles")
async def list_roles():
    """List all available job roles for resume analysis"""
    try:
        with open("job_roles.json", "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load roles: {e}")
        return []


# ==================== Resume Analysis ====================

@app.post("/api/resume/validate")
async def validate_resume_only(file: UploadFile = File(...)):
    """
    Lightweight resume validation without saving or candidate association.
    Used for instant feedback in the UI.
    """
    is_valid, error_code, error_message = await resume_validator.validate_file(file)
    
    if not is_valid:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": error_code,
                "message": error_message
            }
        )
    
    return {
        "success": True,
        "message": "Valid resume format and content",
        "status": "valid"
    }


@app.post("/api/resume/analyze")
async def analyze_resume_full(
    candidate_name: str = Form(default="Candidate Subject"),
    candidate_email: str = Form(default="subject@cygnusa.internal"),
    job_title: str = Form(default="Software Engineer"),
    jd_skills: str = Form(default="python,javascript,react,nodejs,postgresql,docker,git,typescript"),
    critical_skills: str = Form(default=""),
    file: UploadFile = File(...)
):
    """
    One-shot resume analysis: creates candidate, validates, parses, and returns ranking.
    This is the primary endpoint for the real-time resume upload flow.
    """
    # Step 1: Validate file
    is_valid, error_code, error_message = await resume_validator.validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "error": error_code,
                "message": error_message,
                "accepted_formats": ["PDF", "DOCX"]
            }
        )
    
    # Step 2: Create candidate
    candidate_id = f"c_{uuid.uuid4().hex[:8]}"
    candidate = CandidateProfile(
        id=candidate_id,
        name=candidate_name,
        email=candidate_email,
        job_title=job_title,
        status="resume_uploaded"
    )
    
    # Step 3: Prepare file metadata
    file_name = f"{candidate_id}_{file.filename}"
    file_content = await file.read()
    
    # Step 4: Save file locally for parsing (even if using Supabase)
    local_path = f"uploads/{file_name}"
    with open(local_path, "wb") as f:
        f.write(file_content)
        
    # Step 4b: Supabase upload (Cloud Backup)
    file_path = local_path # Start with local path
    if supabase:
        try:
            # Upload to Supabase Bucket 'resumes'
            res = supabase.storage.from_("resumes").upload(
                path=file_name,
                file=file_content,
                file_options={"content-type": file.content_type}
            )
            # Get public URL
            file_url = supabase.storage.from_("resumes").get_public_url(file_name)
            file_path = file_url # Use URL for the database record
            logger.info(f"Resume uploaded to Supabase: {file_url}")
        except Exception as e:
            logger.error(f"Supabase upload failed: {e}. Falling back to local stored at {local_path}")
    
    # Step 5: Extract text ONCE (O(1) optimization)
    start_ext = time.time()
    extracted_text = ResumeGatekeeper.extract_text(local_path)
    logger.info(f"O(1) Text Extraction completed in {time.time() - start_ext:.4f}s")
    
    # Step 6: Parse and rank (primary role)
    try:
        logger.info(f"Starting primary analysis for candidate {candidate_id}")
        skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
        critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]
        
        gatekeeper = ResumeGatekeeper(
            jd_skills=skills_list,
            critical_skills=critical_list
        )
        evidence = gatekeeper.parse_resume(extracted_text=extracted_text)
        logger.info(f"Primary analysis complete: Match={evidence.match_score:.1f}%")
        rank, justification = gatekeeper.rank_candidate(evidence)
        
        # Step 7: Load job roles for multi-role matching using the same extracted text
        multi_role_results = []
        try:
            if os.path.exists("job_roles.json"):
                with open("job_roles.json", "r") as f:
                    all_roles = json.load(f)
                    for role in all_roles:
                        role_gatekeeper = ResumeGatekeeper(
                            jd_skills=role["required_skills"],
                            critical_skills=role["critical_skills"]
                        )
                        role_evidence = role_gatekeeper.parse_resume(extracted_text=extracted_text)
                        status, _ = role_gatekeeper.rank_candidate(role_evidence)
                        multi_role_results.append({
                            "id": role["id"],
                            "title": role["title"],
                            "match_score": role_evidence.match_score,
                            "status": status,
                            "reasoning": role_evidence.reasoning
                        })
            else:
                logger.warning("job_roles.json not found for multi-role matching")
        except Exception as e:
            logger.error(f"Multi-role matching failed: {e}", exc_info=True)

        # Update candidate with evidence
        candidate.resume_path = file_path
        candidate.resume_evidence = evidence
        
        # Record Decision Node
        add_decision_node(
            candidate_id=candidate_id,
            node_type="RESUME",
            title="Resume Analysis Baseline",
            description=f"Initial match score established at {evidence.match_score:.1f}%. {evidence.reasoning[:100]}...",
            impact="positive" if evidence.match_score >= 60 else "neutral" if evidence.match_score >= 30 else "negative",
            predicted_rank=evidence.match_score
        )
        
        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate
        
        logger.info(f"Successfully processed resume for {candidate_id}")
        
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
                "match_calculation": evidence.match_calculation
            },
            "multi_role_matches": multi_role_results,
            "next_step": f"/candidate/{candidate_id}" if rank not in ["REJECT", "GAP_DETECTED", "INCOMPATIBLE"] else None
        }
    except Exception as e:
        logger.error(f"CRITICAL FAILURE in analyze_resume_full: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Resume analysis failed during processing: {str(e)}",
                "type": type(e).__name__,
                "trace": traceback.format_exc()[-500:] # Last 500 chars of trace
            }
        )

@app.post("/api/resume/upload")
async def upload_resume(
    candidate_id: str = Form(...),
    jd_skills: str = Form(...),  # Comma-separated skills
    critical_skills: str = Form(default=""),  # Comma-separated critical skills
    file: UploadFile = File(...)
):
    """
    Upload and analyze resume.
    Returns deterministic skill matching with full reasoning.
    """
    # Get candidate
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Layered Validation
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
                    "File size: 10KB - 5MB"
                ]
            }
        )
    
    # Save file
    file_path = f"uploads/{candidate_id}_{file.filename}"
    # Reset file pointer again just in case
    file.file.seek(0)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Step 3: Extract text ONCE
    logger.info(f"Extracting text from {file_path}")
    extracted_text = ResumeGatekeeper.extract_text(file_path).replace("\x00", "").replace("\u0000", "")
    logger.info(f"Extracted {len(extracted_text)} characters")
    
    # Step 4: Parse resume with provided skills (primary analysis)
    skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
    critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]
    
    logger.info(f"Parsing resume for candidate {candidate_id}")
    gatekeeper = ResumeGatekeeper(
        jd_skills=skills_list,
        critical_skills=critical_list
    )
    try:
        evidence = gatekeeper.parse_resume(extracted_text=extracted_text)
        logger.info(f"Primary analysis complete. Match score: {evidence.match_score}")
        rank, justification = gatekeeper.rank_candidate(evidence)
        logger.info(f"Ranking complete: {rank}")
    except Exception as e:
        logger.error(f"Error during primary analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    # Step 5: Load job roles for multi-role matching using optimized text
    multi_role_results = []
    try:
        if os.path.exists("job_roles.json"):
            with open("job_roles.json", "r") as f:
                all_roles = json.load(f)
                for role in all_roles:
                    logger.info(f"Matching against role: {role['title']}")
                    role_gatekeeper = ResumeGatekeeper(
                        jd_skills=role["required_skills"],
                        critical_skills=role["critical_skills"]
                    )
                    role_evidence = role_gatekeeper.parse_resume(extracted_text=extracted_text)
                    status, _ = role_gatekeeper.rank_candidate(role_evidence)
                    multi_role_results.append({
                        "role_id": role["id"],
                        "title": role["title"],
                        "match_score": role_evidence.match_score,
                        "status": status,
                        "reasoning": role_evidence.reasoning
                    })
        else:
            logger.warning("job_roles.json not found, skipping multi-role matching")
    except Exception as e:
        logger.error(f"Error during multi-role matching: {e}", exc_info=True)
        # We don't fail the whole request for multi-role matching errors
        pass
    except Exception as e:
        logger.error(f"Multi-role matching failed: {e}")


    # Update candidate
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
        "next_step": "Start assessment via /api/assessment/start" if rank != "REJECT" else "Candidate auto-rejected"
    }


# ==================== Assessment Flow ====================

@app.post("/api/assessment/start")
async def start_assessment(candidate_id: str = Form(...)):
    """
    Initialize assessment session.
    Returns all questions and starts proctoring.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Update status
    candidate.status = "in_progress"
    candidate.code_evidence = []
    candidate.mcq_evidence = []
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    # Determine role-specific questions
    coding_qs = []
    mcqs = []
    
    try:
        with open("job_roles.json", "r") as f:
            all_roles = json.load(f)
            # Match by title (what's stored in candidate.job_title) or ID
            target_role = next(
                (r for r in all_roles if r["title"] == candidate.job_title or r["id"] == candidate.job_title), 
                next((r for r in all_roles if r["id"] == "backend_developer"), all_roles[0])
            )
            
            # Load coding questions
            for q_id in target_role.get("coding_question_ids", ["fibonacci"]):
                if q_id in DEMO_QUESTIONS:
                    q = DEMO_QUESTIONS[q_id]
                    coding_qs.append({
                        "id": f"q_{q_id}",
                        "title": q["title"],
                        "description": q["description"],
                        "template": q["template"],
                        "language": "python"
                    })
            
            # Load MCQs
            for m_id in target_role.get("mcq_ids", ["be_q1"]):
                if m_id in DEMO_MCQS:
                    m = DEMO_MCQS[m_id]
                    mcqs.append({
                        "id": m_id,
                        "question": m["question"],
                        "competency": m["competency"],
                        "options": m["options"],
                        "correct": m["correct"]
                    })
            
            # Ensure at least some coding questions exist
            if not coding_qs:
                coding_qs = [{"id": "q_fibonacci", **DEMO_QUESTIONS["fibonacci"], "language": "python"}]
            
            # Ensure at least some MCQs exist
            if not mcqs:
                # Absolute fallback to common questions
                for fid in ["be_q2", "fe_q2", "ml_q1"]:
                    if fid in DEMO_MCQS:
                        m = DEMO_MCQS[fid]
                        mcqs.append({
                            "id": fid,
                            "question": m["question"],
                            "competency": m["competency"],
                            "options": m["options"],
                            "correct": m["correct"]
                        })
                    
    except Exception as e:
        logger.error(f"Failed to load role questions: {e}. Using fallback.")
        # Minimal fallback
        coding_qs = [{"id": "q_fibonacci", **DEMO_QUESTIONS["fibonacci"], "language": "python"}]
        mcqs = [{"id": "be_q1", **DEMO_MCQS["be_q1"]}]

    # Build assessment payload
    assessment = {
        "candidate_id": candidate_id,
        "candidate_name": candidate.name,
        "job_title": candidate.job_title,
        "coding_questions": coding_qs,
        "mcqs": mcqs,
        
        # Psychometric sliders
        "psychometric_sliders": [
            {"id": "resilience", "label": "I handle setbacks and criticism well", "min": 0, "max": 10},
            {"id": "leadership", "label": "I naturally take charge in group settings", "min": 0, "max": 10},
            {"id": "learning", "label": "I actively seek out new skills and knowledge", "min": 0, "max": 10},
            {"id": "teamwork", "label": "I prefer collaborating over working alone", "min": 0, "max": 10},
            {"id": "pressure", "label": "I perform well under tight deadlines", "min": 0, "max": 10}
        ],
        
        # Text/Reasoning questions
        "text_questions": [
            {
                "id": "text1",
                "question": "Describe a challenging technical problem you solved. What was your approach and what did you learn?",
                "competency": "Problem Solving",
                "min_words": 50,
                "max_words": 300
            },
            {
                "id": "text2", 
                "question": "Tell us about a time you disagreed with a team decision. How did you handle it?",
                "competency": "Collaboration",
                "min_words": 50,
                "max_words": 300
            }
        ],
        
        # Assessment configuration
        "config": {
            "total_time_minutes": 45,
            "section_times": {
                "coding": 20,
                "mcq": 10,
                "text": 10,
                "psychometric": 5
            }
        },
        
        "instructions": {
            "coding": "Write Python functions to solve each problem. Your solution function must be named 'solution'.",
            "mcqs": "Select the best response for each workplace scenario.",
            "text": "Answer each question thoughtfully. Your responses will be analyzed for clarity and relevance.",
            "psychometric": "Rate yourself honestly on each statement (0 = Strongly Disagree, 10 = Strongly Agree)",
            "integrity": "Webcam monitoring is active. Tab switches and copy-paste will be logged."
        }
    }
    
    return assessment


@app.post("/api/assessment/submit-code")
async def submit_code(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    code: str = Form(...),
    language: str = Form(default="python"),
    time_started: str = Form(default=None),
    time_submitted: str = Form(default=None),
    duration_seconds: int = Form(default=None)
):
    """
    Submit code solution for grading.
    Returns test case results with full transparency.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Find question
    question_key = question_id.split('_', 1)[1] if '_' in question_id else question_id
    question_data = DEMO_QUESTIONS.get(question_key)
    
    if not question_data:
        raise HTTPException(status_code=400, detail=f"Unknown question: {question_id}")
    
    # Execute code
    evidence = code_sandbox.execute(
        code=code,
        language=language,
        test_cases=question_data["test_cases"],
        question_id=question_id,
        question_title=question_data["title"]
    )
    
    # Add timing data for stress-response correlation
    evidence.time_started = time_started
    evidence.time_submitted = time_submitted
    evidence.duration_seconds = duration_seconds
    
    # FIX: Append code evidence to candidate's code_evidence list
    if candidate.code_evidence is None:
        candidate.code_evidence = []
    candidate.code_evidence.append(evidence)
    
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    # Record Decision Node for code submission
    add_decision_node(
        candidate_id=candidate_id,
        node_type="CODE",
        title=f"Code Verified: {question_data['title']}",
        description=f"Automated test pass rate: {evidence.pass_rate:.1f}%. Duration: {duration_seconds}s.",
        impact="positive" if evidence.pass_rate >= 70 else "neutral" if evidence.pass_rate >= 40 else "negative",
        evidence_id=question_id,
        predicted_rank=evidence.pass_rate
    )
    
    return {
        "success": True,
        "evidence": evidence.model_dump(),
        "summary": {
            "passed": evidence.pass_rate,
            "total_tests": evidence.total_tests,
            "avg_time_ms": evidence.avg_time_ms
        }
    }


@app.post("/api/assessment/probe")
async def generate_shadow_probe(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    code: str = Form(...)
):
    """
    Step 1 of Shadow Probing: Analyze code and generate a targeted follow-up.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    # Find question metadata
    question_key = question_id.split('_', 1)[1] if '_' in question_id else question_id
    question_data = DEMO_QUESTIONS.get(question_key)
    
    if not question_data:
        # Fallback question if metadata missing
        return {
            "shadow_probe": {
                "question": "Tell us about the complexity of your approach.",
                "target_concept": "General Implementation"
            }
        }
        
    # Generate probe using AI
    probe = shadow_proctor.generate_probe(
        question_title=question_data["title"],
        question_desc=question_data["description"],
        code=code
    )
    
    return {
        "success": True,
        "shadow_probe": probe
    }


@app.post("/api/assessment/submit-probe")
async def submit_shadow_probe(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    probe_question: str = Form(...),
    answer: str = Form(...),
    target_concept: str = Form(default="General")
):
    """
    Step 2 of Shadow Probing: Save the candidate's response to the probe.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    # Create evidence for text answer
    probe_evidence = TextAnswerEvidence(
        question_id=f"probe_{question_id}",
        question_text=probe_question,
        answer_text=answer,
        competency=f"Deep Probe: {target_concept}",
        word_count=len(answer.split())
    )
    
    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(probe_evidence)
    
    # Forensic Milestone: Shadow Probe Answered
    add_decision_node(
        candidate_id=candidate_id,
        node_type="TEXT",
        title="Forensic Verification: Shadow Probe Answered",
        description=f"Candidate explained their logic for question {question_id}. Target Concept: {target_concept}",
        impact="positive" if len(answer.split()) > 10 else "neutral",
        evidence_id=f"probe_{question_id}"
    )
    
    # Note: add_decision_node already saves the candidate to DB and active_sessions
    # so we don't need redundant saves here unless we want to ensure latest object state.
    # To be safe, we'll let add_decision_node handle the final persistence of the updated candidate.
    
    return {
        "success": True,
        "message": "Shadow probe response captured"
    }


# ==================== CLAIM PROBING ENGINE ====================

@app.get("/api/assessment/claim-probes/{candidate_id}")
async def get_claim_probes(candidate_id: str):
    """
    Get all suspicious claims flagged for verification.
    These are resume claims that require probing during assessment.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get claims from resume evidence
    claims = []
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        claims = [c.model_dump() for c in candidate.resume_evidence.suspicious_claims]
    
    return {
        "success": True,
        "candidate_id": candidate_id,
        "total_claims": len(claims),
        "claims": claims
    }


@app.post("/api/assessment/submit-claim-probe")
async def submit_claim_probe(
    candidate_id: str = Form(...),
    claim_id: str = Form(...),
    claim_text: str = Form(...),
    probe_question: str = Form(...),
    answer: str = Form(...),
    claim_type: str = Form(default="general")
):
    """
    Submit candidate's response to a claim verification probe.
    Evaluates response quality and updates verification status.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Evaluate response quality
    word_count = len(answer.split())
    if word_count >= 50:
        response_quality = "detailed"
        verified = True
    elif word_count >= 20:
        response_quality = "adequate"
        verified = True
    elif word_count >= 5:
        response_quality = "vague"
        verified = False
    else:
        response_quality = "no_response"
        verified = False
    
    # Update the claim in resume evidence
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        for claim in candidate.resume_evidence.suspicious_claims:
            if claim.claim_id == claim_id:
                claim.verified = verified
                claim.response_quality = response_quality
                break
    
    # Also record as text answer evidence for the decision engine
    from models import TextAnswerEvidence
    probe_evidence = TextAnswerEvidence(
        question_id=f"claim_probe_{claim_id}",
        question_text=probe_question,
        answer_text=answer,
        competency=f"Claim Verification: {claim_type.title()}",
        word_count=word_count
    )
    
    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(probe_evidence)
    
    # Decision node for timeline
    add_decision_node(
        candidate_id=candidate_id,
        node_type="TEXT",
        title=f"Claim Probe: {claim_type.title()} Verification",
        description=f"Verified claim '{claim_text[:50]}...' - Response: {response_quality}",
        impact="positive" if verified else "negative",
        evidence_id=f"claim_{claim_id}"
    )
    
    return {
        "success": True,
        "verified": verified,
        "response_quality": response_quality,
        "message": f"Claim verification recorded: {response_quality}"
    }


@app.post("/api/assessment/keystroke-data")
async def save_keystroke_data(
    candidate_id: str = Form(...),
    intervals_json: str = Form(...)  # JSON string of List[KeystrokeInterval]
):
    """
    Save and analyze a batch of keystroke rhythm data.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    try:
        new_intervals_data = json.loads(intervals_json)
        new_intervals = [KeystrokeInterval(**i) for i in new_intervals_data]
        logger.info(f"Received {len(new_intervals)} keystroke intervals for {candidate_id}")
        
        if candidate.keystroke_evidence is None:
            candidate.keystroke_evidence = KeystrokeEvidence()
            
        # Analyze and update
        candidate.keystroke_evidence = keystroke_analyzer.analyze_intervals(
            candidate_id, new_intervals, candidate.keystroke_evidence
        )
        
        # If a serious anomaly is detected for the first time, record it
        if candidate.keystroke_evidence.is_anomaly:
            # Check if we already have a node for this
            has_node = any(n.node_type == "INTEGRITY" and "Keystroke" in n.title for n in candidate.decision_nodes)
            if not has_node:
                add_decision_node(
                    candidate_id=candidate_id,
                    node_type="INTEGRITY",
                    title="Biometric Anomaly: Keystroke DNA Mismatch",
                    description=f"Significant shift in typing rhythm detected. Rhythm consistency: {candidate.keystroke_evidence.rhythm_score}%",
                    impact="negative"
                )
        
        db.save_candidate(candidate)
        
        return {
            "success": True,
            "rhythm_score": candidate.keystroke_evidence.rhythm_score,
            "is_anomaly": candidate.keystroke_evidence.is_anomaly,
            "baseline_established": candidate.keystroke_evidence.baseline_established
        }
    except Exception as e:
        logger.error(f"Failed to process keystroke data: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/assessment/authenticity-score/{candidate_id}")
async def get_authenticity_score(candidate_id: str):
    """
    Calculate and return the resume authenticity score.
    Based on how well the candidate verified their claims.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    claims = []
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        claims = candidate.resume_evidence.suspicious_claims
    
    if not claims:
        return {
            "success": True,
            "overall_score": 100,
            "claims_detected": 0,
            "claims_verified": 0,
            "claims_failed": 0,
            "red_flags": [],
            "message": "No verifiable claims detected"
        }
    
    # Calculate score
    claims_verified = sum(1 for c in claims if c.verified is True)
    claims_failed = sum(1 for c in claims if c.verified is False)
    claims_pending = sum(1 for c in claims if c.verified is None)
    
    # Score calculation: verified claims boost, failed claims penalize
    base_score = 70
    verified_bonus = (claims_verified / len(claims)) * 30
    failed_penalty = (claims_failed / len(claims)) * 40
    
    overall_score = max(0, min(100, int(base_score + verified_bonus - failed_penalty)))
    
    # Identify red flags
    red_flags = []
    for claim in claims:
        if claim.verified is False and claim.confidence_flag == "high":
            red_flags.append(f"Failed to verify: {claim.claim_text[:50]}")
    
    return {
        "success": True,
        "overall_score": overall_score,
        "claims_detected": len(claims),
        "claims_verified": claims_verified,
        "claims_failed": claims_failed,
        "claims_pending": claims_pending,
        "red_flags": red_flags
    }


@app.post("/api/assessment/submit-mcq")
async def submit_mcq(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    question_text: str = Form(...),
    selected_option: str = Form(...),
    correct_option: str = Form(...),
    competency: str = Form(...),
    time_started: str = Form(default=None),
    time_submitted: str = Form(default=None),
    duration_seconds: int = Form(default=None)
):
    """Submit MCQ answer with timing data for stress-response correlation"""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    evidence = MCQEvidence(
        question_id=question_id,
        question_text=question_text,
        competency=competency,
        selected_option=selected_option,
        correct_option=correct_option,
        is_correct=(selected_option == correct_option),
        time_started=time_started,
        time_submitted=time_submitted,
        duration_seconds=duration_seconds
    )
    
    if candidate.mcq_evidence is None:
        candidate.mcq_evidence = []
    candidate.mcq_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    # Forensic Milestone: Scenarios
    if len(candidate.mcq_evidence) == 1:
        add_decision_node(candidate_id, "MCQ", "Scenario Logic Initialized", "Behavioral logic and scenario-based reasoning assessment started.", "neutral")
    
    return {
        "success": True,
        "evidence": evidence.model_dump()
    }


@app.post("/api/assessment/submit-psychometric")
async def submit_psychometric(
    candidate_id: str = Form(...),
    resilience: int = Form(...),
    leadership: int = Form(...),
    learning: int = Form(...),
    teamwork: int = Form(default=5),
    pressure: int = Form(default=5)
):
    """Submit psychometric self-assessment"""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    scores = {
        "resilience": resilience,
        "leadership": leadership,
        "learning": learning,
        "teamwork": teamwork,
        "pressure": pressure
    }
    
    # Identify weak and strong areas
    weak_areas = [k for k, v in scores.items() if v < 5]
    strong_areas = [k for k, v in scores.items() if v >= 7]
    
    evidence = PsychometricEvidence(
        competencies=scores,
        weak_areas=weak_areas,
        strong_areas=strong_areas,
        interpretation=f"Self-assessment shows {len(strong_areas)} strong areas and {len(weak_areas)} areas for development."
    )
    
    candidate.psychometric_evidence = evidence
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    # Record Decision Node for Psychometric
    add_decision_node(
        candidate_id=candidate_id,
        node_type="PSYCH",
        title="Psychometric Calibration",
        description=f"Candidate self-assessment complete. {len(strong_areas)} strengths and {len(weak_areas)} weak areas identified.",
        impact="positive" if len(strong_areas) > len(weak_areas) else "neutral"
    )
    
    return {
        "success": True,
        "evidence": evidence.model_dump()
    }


@app.post("/api/assessment/submit-text")
async def submit_text_answer(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    question_text: str = Form(...),
    answer_text: str = Form(...),
    competency: str = Form(...),
    time_taken_seconds: float = Form(default=0)
):
    """Submit a text/reasoning answer"""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Calculate word count
    word_count = len(answer_text.split())
    
    # Extract key themes (simple keyword extraction)
    key_themes = []
    theme_keywords = {
        "problem-solving": ["solved", "solution", "approach", "analyzed", "debug", "fixed"],
        "collaboration": ["team", "together", "discussed", "shared", "helped"],
        "leadership": ["led", "managed", "organized", "coordinated", "delegated"],
        "learning": ["learned", "discovered", "improved", "researched", "studied"],
        "communication": ["explained", "presented", "documented", "clarified"]
    }
    
    answer_lower = answer_text.lower()
    for theme, keywords in theme_keywords.items():
        if any(kw in answer_lower for kw in keywords):
            key_themes.append(theme)
    
    evidence = TextAnswerEvidence(
        question_id=question_id,
        question_text=question_text,
        competency=competency,
        answer_text=answer_text,
        word_count=word_count,
        time_taken_seconds=time_taken_seconds,
        key_themes=key_themes,
        quality_score=min(10, word_count / 30)  # Simple heuristic based on length
    )
    
    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    # Forensic Checkpoint
    if not question_id.startswith("probe_"):
        add_decision_node(candidate_id, "TEXT", f"Reasoning Verified: {competency}", f"Word context established: {word_count} words.", "positive" if word_count > 50 else "neutral")
    
    return {
        "success": True,
        "evidence": evidence.model_dump()
    }


# ==================== Integrity Monitoring ====================

@app.post("/api/integrity/log")
async def log_integrity_event(
    candidate_id: str = Form(...),
    event_type: str = Form(...),
    severity: str = Form(...),
    context: str = Form(default=None)
):
    """
    Log an integrity violation from the proctoring system.
    Event types: tab_switch, paste_detected, no_face, multiple_faces, suspicious_audio
    Severity: low, medium, high, critical
    """
    event = IntegrityEvent(
        timestamp=datetime.now().isoformat(),
        event_type=event_type,
        severity=severity,
        context=context
    )
    
    db.log_integrity_event(candidate_id, event)
    
    # Check for decision node impact on high severity
    if severity in ["high", "critical"]:
        add_decision_node(
            candidate_id=candidate_id,
            node_type="INTEGRITY",
            title=f"Forensic Alert: {event_type.replace('_', ' ').title()}",
            description=f"A {severity} violation was detected. {context}",
            impact="negative",
            evidence_id="integrity_violation"
        )
    
    return {
        "logged": True,
        "event": event.model_dump()
    }


@app.get("/api/integrity/{candidate_id}")
async def get_integrity_summary(candidate_id: str):
    """Get integrity violation summary for a candidate"""
    events = db.get_integrity_logs(candidate_id)
    summary = db.get_integrity_summary(candidate_id)
    
    # Calculate severity score
    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(e.severity, 1) for e in events)
    
    # Determine trustworthiness
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
        "events": [e.model_dump() for e in events[-10:]]  # Last 10 events
    }


# ==================== Video Proctoring ====================

@app.post("/api/assessment/upload-snapshot")
async def upload_snapshot(
    candidate_id: str = Form(...),
    snapshot: UploadFile = File(...),
    face_detected: bool = Form(default=None)
):
    """
    Upload a webcam snapshot for video proctoring.
    Frontend captures periodic screenshots during assessment.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Generate unique filename
    timestamp = datetime.now().isoformat().replace(":", "-")
    filename = f"{candidate_id}_{timestamp}.jpg"
    content = await snapshot.read()
    
    if supabase:
        try:
            # Upload to Supabase Bucket 'snapshots'
            supabase.storage.from_("snapshots").upload(
                path=filename,
                file=content,
                file_options={"content-type": "image/jpeg"}
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
    
    # Create snapshot record
    snap = VideoSnapshot(
        timestamp=datetime.now().isoformat(),
        snapshot_path=filepath,
        face_detected=face_detected
    )
    
    # Initialize video evidence if needed
    if not candidate.video_evidence:
        candidate.video_evidence = VideoEvidence()
    
    candidate.video_evidence.snapshots.append(snap)
    candidate.video_evidence.total_snapshots = len(candidate.video_evidence.snapshots)
    
    # Calculate face detection rate
    detected = sum(1 for s in candidate.video_evidence.snapshots if s.face_detected)
    total = len(candidate.video_evidence.snapshots)
    candidate.video_evidence.face_detection_rate = (detected / total * 100) if total > 0 else 0
    
    # Count anomalies (no face detected)
    candidate.video_evidence.anomalies_detected = total - detected
    
    active_sessions[candidate_id] = candidate
    db.save_candidate(candidate)
    
    logger.info(f"Snapshot uploaded for {candidate_id}: {filename}, face: {face_detected}")
    
    return {
        "success": True,
        "snapshot_path": filepath,
        "total_snapshots": candidate.video_evidence.total_snapshots,
        "face_detection_rate": candidate.video_evidence.face_detection_rate
    }


@app.get("/api/assessment/snapshots/{candidate_id}")
async def get_snapshots(candidate_id: str):
    """Get video proctoring snapshots for a candidate"""
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    if not candidate.video_evidence:
        return {
            "total_snapshots": 0,
            "snapshots": [],
            "face_detection_rate": None,
            "anomalies_detected": 0
        }
    
    return {
        "total_snapshots": candidate.video_evidence.total_snapshots,
        "snapshots": [s.model_dump() for s in candidate.video_evidence.snapshots[-20:]],  # Last 20
        "face_detection_rate": candidate.video_evidence.face_detection_rate,
        "anomalies_detected": candidate.video_evidence.anomalies_detected
    }


@app.post("/api/assessment/generate-report/{candidate_id}")
async def generate_report(candidate_id: str):
    """
    Generate final hiring decision with full explainability.
    This is the core "glass-box" feature.
    """
    try:
        logger.info(f"[GENERATE_REPORT] Starting report generation for {candidate_id}")
        
        candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
        if not candidate:
            logger.error(f"[GENERATE_REPORT] Candidate not found: {candidate_id}")
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        logger.info(f"[GENERATE_REPORT] Candidate loaded: {candidate.name}")
        
        # Build integrity evidence from logs (With failure protection)
        try:
            integrity_events = db.get_integrity_logs(candidate_id)
            severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
            severity_score = sum(severity_weights.get(e.severity, 1) for e in integrity_events)
            
            if severity_score == 0:
                trustworthiness = "High"
            elif severity_score < 5:
                trustworthiness = "Medium"
            else:
                trustworthiness = "Low"
            
            integrity_evidence = IntegrityEvidence(
                total_violations=len(integrity_events),
                events=integrity_events,
                severity_score=severity_score,
                trustworthiness_rating=trustworthiness
            )
            logger.info(f"[GENERATE_REPORT] Integrity evidence built: {len(integrity_events)} events")
        except Exception as e:
            logger.error(f"[GENERATE_REPORT] Integrity mapping failed: {e}")
            integrity_evidence = IntegrityEvidence(
                total_violations=0,
                events=[],
                severity_score=0,
                trustworthiness_rating="Unknown (Recovery Mode)"
            )
        
        # Generate decision
        decision = None
        try:
            logger.info("[GENERATE_REPORT] Calling decision engine...")
            decision = decision_engine.generate_decision(
                candidate_id=candidate_id,
                candidate_name=candidate.name,
                resume_evidence=candidate.resume_evidence,
                code_evidence=candidate.code_evidence,
                mcq_evidence=candidate.mcq_evidence,
                psychometric_evidence=candidate.psychometric_evidence,
                integrity_evidence=integrity_evidence,
                text_evidence=candidate.text_answer_evidence,
                keystroke_evidence=candidate.keystroke_evidence
            )
            logger.info(f"[GENERATE_REPORT] Decision generated: {decision.outcome}")
        except Exception as e:
            logger.error(f"[GENERATE_REPORT] Decision generation failed for {candidate_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Absolute fallback to allow submission
            logger.info("[GENERATE_REPORT] Using emergency fallback decision...")
            fallback_data = decision_engine._generate_fallback_decision({
                'resume': candidate.resume_evidence.model_dump() if candidate.resume_evidence else {},
                'coding': {'avg_pass_rate': 0},
                'integrity': {'total_violations': 0}
            }, candidate_id=candidate_id)
            decision = FinalDecision(**fallback_data)
            logger.info(f"[GENERATE_REPORT] Fallback decision created: {decision.outcome}")
        
        # Update candidate
        candidate.integrity_evidence = integrity_evidence
        candidate.final_decision = decision
        candidate.status = "completed"
        candidate.completed_at = datetime.utcnow().isoformat()
        
        # Final Decision Node (Protected)
        try:
            add_decision_node(
                candidate_id=candidate_id,
                node_type="FINAL",
                title=f"Forensic Verdict: {decision.outcome}",
                description=f"AI concluded {decision.outcome}. Reasoning: {decision.reasoning[0] if decision.reasoning else 'N/A'}",
                impact="positive" if decision.outcome == "HIRE" else "neutral"
            )
        except Exception as node_err:
            logger.warning(f"[GENERATE_REPORT] Failed to add decision node: {node_err}")
        
        logger.info(f"[GENERATE_REPORT] Saving candidate to database...")
        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate
        
        logger.info(f"[GENERATE_REPORT] Report generated successfully for {candidate_id}: {decision.outcome}")
        
        return {
            "success": True,
            "decision": decision.model_dump(),
            "message": f"Decision generated: {decision.outcome}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"[GENERATE_REPORT] CRITICAL ERROR for {candidate_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


# ==================== Report Export ====================

@app.get("/api/report/export/{candidate_id}")
async def export_report_pdf(candidate_id: str):
    """
    Export candidate report as downloadable PDF-ready HTML.
    Features premium design with Chart.js visual analytics.
    """
    import traceback as tb
    
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    if not candidate.final_decision:
        raise HTTPException(status_code=400, detail="Report not yet generated")
    
    decision = candidate.final_decision
    evidence = decision.evidence_summary or {}
    
    # FIX: Properly convert cognitive_profile to dict (may be Pydantic model or dict)
    raw_cognitive = decision.cognitive_profile
    if raw_cognitive is None:
        cognitive = {}
    elif hasattr(raw_cognitive, 'model_dump'):
        cognitive = raw_cognitive.model_dump()
    elif hasattr(raw_cognitive, 'dict'):
        cognitive = raw_cognitive.dict()
    elif isinstance(raw_cognitive, dict):
        cognitive = raw_cognitive
    else:
        cognitive = {}
    
    integrity_logs = db.get_integrity_logs(candidate_id)
    
    # 1. Aggregate Data for Charts
    logger.info(f"DEBUG EXPORT: Starting chart aggregation for {candidate_id}")
    
    # Integrity Breakdown (Bar Chart)
    violation_counts = {}
    for log in integrity_logs:
        # Support both Pydantic model (log.event_type) and Dict (log['event_type'])
        try:
            etype_raw = log.event_type if hasattr(log, 'event_type') else log.get('event_type', 'unknown')
        except:
            etype_raw = 'unknown'
        
        etype = str(etype_raw).replace("_", " ").title()
        violation_counts[etype] = violation_counts.get(etype, 0) + 1
    
    integrity_chart_labels = list(violation_counts.keys())
    integrity_chart_data = list(violation_counts.values())


    # Cognitive Profile (Radar Chart)
    cognitive_labels = []
    cognitive_values = []
    if cognitive and "cognitive_scores" in cognitive:
        try:
            for trait, score in cognitive["cognitive_scores"].items():
                # FIX: Ensure trait is a string and score is a float (AI may return dicts)
                trait_str = str(trait) if not isinstance(trait, dict) else "unknown"
                if isinstance(score, dict):
                    score_val = float(score.get('score', score.get('value', 5.0)))
                else:
                    score_val = float(score) if score is not None else 0.0
                cognitive_labels.append(trait_str.title())
                cognitive_values.append(score_val)
        except Exception as cog_err:
            logger.warning(f"Cognitive score parsing failed: {cog_err}, using defaults")
            cognitive_labels = ["Abstraction", "Speed", "Precision", "Creativity"]
            cognitive_values = [5, 5, 5, 5]
    else:
        # Fallback for old records
        cognitive_labels = ["Abstraction", "Speed", "Precision", "Creativity"]
        cognitive_values = [0, 0, 0, 0]

    # Evidentiary Mapping (Horizontal Bar)
    mapping = decision.evidentiary_mapping or {}
    mapping_labels = []
    mapping_values = []
    impact_weight = {"primary_driver": 100, "supporting": 60, "negative": 30, "neutral": 10, "none": 0}
    
    try:
        for section, impact in mapping.items():
            # FIX: Ensure section is a string (never use dict as key)
            section_str = str(section) if not isinstance(section, dict) else "unknown_section"
            mapping_labels.append(section_str.title())
            # Defensive: If impact is a dict (e.g. from AI), extract value or use neutral
            safe_impact = impact
            if isinstance(impact, dict):
                safe_impact = impact.get('impact', impact.get('value', 'neutral'))
            mapping_values.append(impact_weight.get(str(safe_impact).lower(), 10))
    except Exception as map_err:
        logger.warning(f"Evidentiary mapping parsing failed: {map_err}, using empty")
        mapping_labels = []
        mapping_values = []

    # Format dates
    completion_date = candidate.completed_at or candidate.created_at
    try:
        completion_dt = datetime.fromisoformat(completion_date)
        formatted_date = completion_dt.strftime("%B %d, %Y at %H:%M")
    except:
        formatted_date = completion_date

    # Score calculations
    def get_val(path, default=0):
        parts = path.split('.')
        curr = evidence
        for p in parts:
            if isinstance(curr, dict):
                curr = curr.get(p)
            else:
                return default
        return curr if curr is not None else default

    resume_score = get_val('resume.match_score', 0)
    coding_score = get_val('coding.avg_pass_rate', 0)
    mcq_score = get_val('mcqs.pass_rate', 0)
    
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forensic Assessment Report - {candidate.name}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-dark: #09090b;
            --surface: #ffffff;
            --surface-muted: #f8fafc;
            --primary: #2563eb;
            --secondary: #6366f1;
            --accent: #8b5cf6;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }}

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: 'Plus Jakarta Sans', sans-serif; 
            background: var(--surface-muted); 
            color: var(--text-main);
            line-height: 1.6;
        }}

        .page {{
            max-width: 1000px;
            margin: 2rem auto;
            background: var(--surface);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid var(--border);
        }}

        /* Header Section */
        header {{
            background: var(--bg-dark);
            color: white;
            padding: 4rem 3rem;
            position: relative;
        }}

        .brand-logo {{
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 3rem;
        }}

        .brand-logo svg {{ width: 32px; height: 32px; color: var(--primary); }}
        .brand-name {{ font-weight: 800; font-size: 1.5rem; letter-spacing: -0.02em; }}

        .hero-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
        }}

        .candidate-info h1 {{ font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.03em; }}
        .candidate-info .role {{ color: #94a3b8; font-weight: 500; font-size: 1.125rem; }}

        .status-badge {{
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 1.5rem;
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }}

        .status-label {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; }}
        .status-value {{ font-size: 1.25rem; font-weight: 700; color: white; }}

        /* Main Content */
        main {{ padding: 3rem; }}

        .section {{ margin-bottom: 4rem; }}
        .section-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1rem;
        }}

        .section-title {{ font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }}
        
        /* Grid Layouts */
        .chart-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }}

        .chart-card {{
            background: var(--surface-muted);
            padding: 2rem;
            border-radius: 20px;
            border: 1px solid var(--border);
        }}

        .chart-card h4 {{ margin-bottom: 1.5rem; font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }}

        /* Summary Dashboard */
        .verdict-banner {{
            display: grid;
            grid-template-columns: 240px 1fr;
            gap: 2.5rem;
            background: #f1f5f9;
            padding: 2.5rem;
            border-radius: 24px;
            margin-bottom: 3rem;
            align-items: center;
        }}

        .outcome-badge {{
            padding: 1rem;
            border-radius: 16px;
            text-align: center;
            font-weight: 800;
            font-size: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        }}

        .outcome-HIRE {{ background: var(--success); color: white; }}
        .outcome-NO_HIRE {{ background: var(--danger); color: white; }}
        .outcome-CONDITIONAL {{ background: var(--warning); color: white; }}

        .rationale-text {{ font-size: 1rem; color: var(--text-main); font-weight: 500; }}

        /* Score Cards */
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 3rem;
        }}

        .kpi-card {{
            background: white;
            border: 1px solid var(--border);
            padding: 1.5rem;
            border-radius: 16px;
            text-align: center;
        }}

        .kpi-card .label {{ font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; }}
        .kpi-card .value {{ font-size: 1.75rem; font-weight: 800; }}

        /* Timeline/Logs */
        .log-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }}

        .log-table th {{ text-align: left; padding: 1rem; color: var(--text-muted); border-bottom: 2px solid var(--border); }}
        .log-table td {{ padding: 1rem; border-bottom: 1px solid var(--border); }}
        
        .severity-dot {{
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }}

        .dot-high {{ background: var(--danger); }}
        .dot-medium {{ background: var(--warning); }}
        .dot-low {{ background: var(--success); }}

        footer {{
            background: var(--surface-muted);
            padding: 3rem;
            text-align: center;
            border-top: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.875rem;
        }}

        @media print {{
            body {{ background: white; }}
            .page {{ box-shadow: none; margin: 0; max-width: 100%; border: none; }}
            header {{ -webkit-print-color-adjust: exact; }}
        }}
    </style>
</head>
<body>
    <div class="page">
        <header>
            <div class="brand-logo">
                <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
                <span class="brand-name">CYGNUSA GUARDIAN</span>
            </div>
            
            <div class="hero-grid">
                <div class="candidate-info">
                    <p class="status-label" style="color: var(--primary)">Professional Assessment Export</p>
                    <h1>{candidate.name}</h1>
                    <p class="role">{candidate.job_title} • Forensic Report</p>
                </div>
                <div class="status-badge">
                    <div class="status-label">Report Integrity Signature</div>
                    <div class="status-value">{formatted_date}</div>
                    <div style="font-family: 'JetBrains Mono'; font-size: 10px; color: #475569; margin-top: 4px;">SIGNATURE: {candidate.id[:12].upper()}-VERIFIED</div>
                </div>
            </div>
        </header>

        <main>
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Forensic Verdict Dashboard</h2>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">CONFIDENCE: {decision.confidence.upper()}</span>
                </div>

                <div class="verdict-banner">
                    <div class="outcome-badge outcome-{decision.outcome}">
                        {decision.outcome}
                    </div>
                    <div class="rationale-text">
                        <p style="margin-bottom: 1rem;"><strong>AI Reasoning Trace:</strong> {decision.reasoning[0]}</p>
                        <div style="display: flex; gap: 1rem;">
                            <div style="flex: 1; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px; font-size: 0.8125rem;">
                                <strong>Role Fit:</strong> {decision.role_fit}
                            </div>
                            <div style="flex: 1; padding: 1rem; background: rgba(255,255,255,0.5); border-radius: 12px; font-size: 0.8125rem;">
                                <strong>Next Action:</strong> {decision.next_steps}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="label">Resume Match</div>
                        <div class="value">{resume_score:.1f}%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="label">Coding Score</div>
                        <div class="value">{coding_score:.1f}%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="label">MCQ Performance</div>
                        <div class="value">{mcq_score:.1f}%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="label">Integrity</div>
                        <div class="value" style="color: { 'var(--success)' if len(integrity_logs) < 5 else 'var(--danger)' }">{ 'PASSED' if len(integrity_logs) < 5 else 'FLAGGED' }</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-header"><h2 class="section-title">Visual Intelligence Assets</h2></div>
                
                <div class="chart-grid">
                    <div class="chart-card">
                        <h4>Cognitive Architecture Profile</h4>
                        <canvas id="cognitiveRadar"></canvas>
                        <p style="font-size: 11px; color: var(--text-muted); margin-top: 1rem; text-align: center;">
                            Archetype: <strong>{cognitive.get('primary_style', 'N/A').replace('_', ' ')}</strong>
                        </p>
                    </div>
                    <div class="chart-card">
                        <h4>Integrity Violation Breakdown</h4>
                        <canvas id="integrityBar"></canvas>
                    </div>
                </div>

                <div class="chart-card" style="margin-bottom: 2rem;">
                    <h4>Evidentiary Mapping (AI Drivers)</h4>
                    <canvas id="mappingChart" height="100"></canvas>
                </div>
            </div>

            <div class="section">
                <div class="section-header"><h2 class="section-title">Detailed Forensic Appendix</h2></div>
                
                {f'''
                <table class="log-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Incident Category</th>
                            <th>Severity</th>
                            <th>Contextual Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join(f'<tr><td>{log.timestamp.split("T")[1][:8] if "T" in log.timestamp else log.timestamp}</td><td style="font-weight: 600;">{log.event_type.replace("_", " ").title()}</td><td><span class="severity-dot dot-{log.severity}"></span>{log.severity.upper()}</td><td style="color: var(--text-muted); font-size: 12px;">{log.context or "N/A"}</td></tr>' for log in integrity_logs)}
                    </tbody>
                </table>
                ''' if integrity_logs else '<p style="text-align: center; color: var(--success); padding: 2rem; background: #ecfdf5; border-radius: 12px; font-weight: 600;">Zero integrity anomalies detected during entire session.</p>'}
            </div>
        </main>

        <footer>
            <p><strong>Cygnusa Guardian Forensic Protocol v4.2</strong> • Data sensitivity: <strong>RESTRICED_HR</strong></p>
            <p style="margin-top: 0.5rem; opacity: 0.6;">Automated decisions are cross-referenced with behavioral biometric DNA. Forensic ID: {candidate.id}</p>
        </footer>
    </div>

    <script>
        // Chart Configs
        const ctxRadar = document.getElementById('cognitiveRadar');
        new Chart(ctxRadar, {{
            type: 'radar',
            data: {{
                labels: {json.dumps(cognitive_labels)},
                datasets: [{{
                    label: 'Score',
                    data: {json.dumps(cognitive_values)},
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: 'rgb(99, 102, 241)',
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(99, 102, 241)'
                }}]
            }},
            options: {{
                scales: {{ r: {{ min: 0, max: 10, ticks: {{ display: false }} }} }},
                plugins: {{ legend: {{ display: false }} }}
            }}
        }});

        const ctxBar = document.getElementById('integrityBar');
        new Chart(ctxBar, {{
            type: 'bar',
            data: {{
                labels: {json.dumps(integrity_chart_labels)},
                datasets: [{{
                    label: 'Occurrences',
                    data: {json.dumps(integrity_chart_data)},
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderRadius: 8
                }}]
            }},
            options: {{
                indexAxis: 'y',
                scales: {{ x: {{ beginAtZero: true, ticks: {{ stepSize: 1 }} }} }},
                plugins: {{ legend: {{ display: false }} }}
            }}
        }});

        const ctxMap = document.getElementById('mappingChart');
        new Chart(ctxMap, {{
            type: 'bar',
            data: {{
                labels: {json.dumps(mapping_labels)},
                datasets: [{{
                    label: 'Impact Weight',
                    data: {json.dumps(mapping_values)},
                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    borderRadius: 4
                }}]
            }},
            options: {{
                indexAxis: 'y',
                scales: {{ x: {{ display: false, max: 100 }} }},
                plugins: {{ legend: {{ display: false }} }}
            }}
        }});
    </script>
</body>
</html>
"""
    
    # Return as streaming HTML response
    return StreamingResponse(
        io.StringIO(html_content),
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename=cygnusa_report_{candidate_id}.html"
        }
    )


# ==================== Demo Data ====================

@app.post("/api/demo/seed")
async def seed_demo_data(user: dict = Depends(require_recruiter)):
    """Create demo candidates for testing"""
    from seed_demo_data import seed_all_demos
    results = seed_all_demos(db, decision_engine)
    return {
        "success": True,
        "seeded": results,
        "message": "Demo candidates created. View at /api/candidates"
    }


# ==================== Live Dashboard ====================

@app.get("/api/dashboard/live")
async def get_live_dashboard(user: dict = Depends(require_recruiter)):
    """
    Get real-time dashboard data for recruiters.
    Returns active candidates, their progress, and recent events.
    Designed for polling every 2-5 seconds.
    """
    # Get all candidates
    all_candidates = db.get_all_candidates()
    
    # Filter active candidates (in_progress status)
    active_candidates = []
    for c in all_candidates:
        if c.status == "in_progress":
            # Calculate progress
            coding_done = len(c.code_evidence or [])
            mcq_done = len(c.mcq_evidence or [])
            text_done = len(c.text_answer_evidence or [])
            psych_done = 1 if c.psychometric_evidence else 0
            
            # Assume 2 coding, 2 MCQ, 2 text, 1 psych as max
            total_progress = min(100, (coding_done * 15 + mcq_done * 15 + text_done * 15 + psych_done * 25))
            
            # Get recent integrity events
            events = candidate_events.get(c.id, [])
            recent_events = events[-5:] if events else []
            high_severity = sum(1 for e in events if e.get("severity") in ["high", "critical"])
            
            active_candidates.append({
                "id": c.id,
                "name": c.name,
                "job_title": c.job_title,
                "status": c.status,
                "started_at": c.created_at,
                "progress_percent": total_progress,
                "sections_completed": {
                    "coding": coding_done,
                    "mcq": mcq_done,
                    "text": text_done,
                    "psychometric": psych_done
                },
                "integrity": {
                    "total_events": len(events),
                    "high_severity": high_severity,
                    "recent_events": recent_events,
                    "status": "flagged" if high_severity > 2 else ("warning" if len(events) > 3 else "clean")
                }
            })
    
    # Get recently completed candidates (last 10)
    completed = [
        {
            "id": c.id,
            "name": c.name,
            "job_title": c.job_title,
            "outcome": c.final_decision.outcome if c.final_decision else None,
            "completed_at": c.completed_at
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
            "flagged_count": len([c for c in active_candidates if c.get("integrity", {}).get("status") == "flagged"])
        }
    }


# ==================== Report Sharing ====================

@app.post("/api/report/share/{candidate_id}")
async def create_share_link(
    candidate_id: str,
    expires_hours: int = 72  # Default 3 days
):
    """
    Generate a shareable link for a candidate's report.
    Returns a unique token that can be used to view the report without auth.
    """
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    if not candidate.final_decision:
        raise HTTPException(status_code=400, detail="Report not yet generated")
    
    # Generate unique share token
    share_token = f"share_{uuid.uuid4().hex[:12]}"
    expires_at = (datetime.now() + timedelta(hours=expires_hours)).isoformat()
    
    # Store token
    share_tokens[share_token] = {
        "candidate_id": candidate_id,
        "expires_at": expires_at,
        "created_at": datetime.now().isoformat()
    }
    
    logger.info(f"Created share link for {candidate_id}: {share_token}")
    
    return {
        "success": True,
        "share_token": share_token,
        "expires_at": expires_at,
        "share_url": f"/shared/{share_token}",
        "message": f"Link expires in {expires_hours} hours"
    }


@app.get("/api/report/shared/{share_token}")
async def get_shared_report(share_token: str):
    """
    View a shared report using the share token.
    Public endpoint - no authentication required.
    """
    if share_token not in share_tokens:
        raise HTTPException(status_code=404, detail="Invalid or expired share link")
    
    token_data = share_tokens[share_token]
    
    # Check expiry
    if datetime.now() > datetime.fromisoformat(token_data["expires_at"]):
        del share_tokens[share_token]  # Clean up expired token
        raise HTTPException(status_code=410, detail="This share link has expired")
    
    candidate_id = token_data["candidate_id"]
    candidate = db.get_candidate(candidate_id)
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    decision = candidate.final_decision
    if not decision:
        raise HTTPException(status_code=400, detail="Report not available")
    
    # Return sanitized report (no sensitive internal data)
    return {
        "candidate": {
            "name": candidate.name,
            "job_title": candidate.job_title,
            "completed_at": candidate.completed_at
        },
        "decision": {
            "outcome": decision.outcome,
            "confidence": decision.confidence,
            "reasoning": decision.reasoning,
            "role_fit": decision.role_fit,
            "next_steps": decision.next_steps
        },
        "evidence_summary": decision.evidence_summary,
        "shared_at": token_data["created_at"],
        "expires_at": token_data["expires_at"]
    }


@app.delete("/api/report/share/{share_token}")
async def revoke_share_link(share_token: str):
    """Revoke a share link before it expires"""
    if share_token not in share_tokens:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    del share_tokens[share_token]
    logger.info(f"Revoked share link: {share_token}")
    
    return {"success": True, "message": "Share link revoked"}


# ==================== Dashboard Analytics API ====================

@app.get("/api/dashboard/analytics")
async def get_dashboard_analytics(recruiter: dict = Depends(require_recruiter)):
    """
    Get aggregate analytics for the recruiter dashboard.
    Returns counts, percentages, and trend data.
    """
    try:
        candidates = db.get_all_candidates()
        
        # Calculate status counts
        total = len(candidates)
        selected = 0
        rejected = 0
        pending = 0
        
        total_score = 0
        score_count = 0
        integrity_violations = 0
        completed_count = 0
        
        # Role distribution
        role_stats = {}
        
        for c in candidates:
            # Determine status from final_decision
            outcome = "PENDING"
            if c.final_decision:
                outcome = c.final_decision.outcome or "PENDING"
            
            if outcome == "HIRE":
                selected += 1
            elif outcome == "NO_HIRE":
                rejected += 1
            else:
                pending += 1
            
            # Aggregate scores
            if c.resume_evidence and c.resume_evidence.match_score:
                total_score += c.resume_evidence.match_score
                score_count += 1
            
            # Count integrity violations
            if c.integrity_evidence:
                integrity_violations += c.integrity_evidence.total_violations
            
            # Track completion
            if c.status == "completed":
                completed_count += 1
            
            # Role distribution
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
        
        # Calculate averages
        avg_score = (total_score / score_count) if score_count > 0 else 0
        completion_rate = (completed_count / total * 100) if total > 0 else 0
        
        return {
            "success": True,
            "metrics": {
                "total_candidates": total,
                "selected": {"count": selected, "percentage": round(selected / total * 100, 1) if total > 0 else 0},
                "rejected": {"count": rejected, "percentage": round(rejected / total * 100, 1) if total > 0 else 0},
                "pending": {"count": pending, "percentage": round(pending / total * 100, 1) if total > 0 else 0},
                "avg_score": round(avg_score, 1),
                "completion_rate": round(completion_rate, 1),
                "integrity_violations": integrity_violations
            },
            "role_distribution": role_stats,
            "chart_data": {
                "status_pie": [
                    {"label": "Selected", "value": selected, "color": "#22C55E"},
                    {"label": "Rejected", "value": rejected, "color": "#EF4444"},
                    {"label": "Pending", "value": pending, "color": "#F59E0B"}
                ],
                "role_bar": [
                    {"role": role, "selected": stats["selected"], "rejected": stats["rejected"], "pending": stats["pending"]}
                    for role, stats in role_stats.items()
                ]
            }
        }
    except Exception as e:
        logger.error(f"Dashboard analytics failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")


@app.get("/api/dashboard/candidates-by-role")
async def get_candidates_by_role(
    role: Optional[str] = None,
    recruiter: dict = Depends(require_recruiter)
):
    """
    Get candidates grouped by role with smart sorting.
    Selected candidates first, then Pending, then Rejected.
    """
    try:
        candidates = db.get_all_candidates()
        
        # Filter by role if specified
        if role:
            candidates = [c for c in candidates if c.job_title == role]
        
        # Transform to response format with sorting key
        def get_sort_key(c):
            outcome = "PENDING"
            if c.final_decision:
                outcome = c.final_decision.outcome or "PENDING"
            # Sort order: HIRE=0, CONDITIONAL=1, PENDING=2, NO_HIRE=3
            order = {"HIRE": 0, "CONDITIONAL": 1, "PENDING": 2, "NO_HIRE": 3}
            return order.get(outcome, 2)
        
        # Sort candidates
        sorted_candidates = sorted(candidates, key=get_sort_key)
        
        # Build response
        result = []
        for c in sorted_candidates:
            outcome = "PENDING"
            confidence = "low"
            if c.final_decision:
                outcome = c.final_decision.outcome or "PENDING"
                confidence = c.final_decision.confidence or "low"
            
            # Calculate overall score
            overall_score = 0
            if c.resume_evidence:
                overall_score = c.resume_evidence.match_score or 0
            
            # Integrity score
            integrity_score = 100
            integrity_level = "clean"
            if c.integrity_evidence:
                violations = c.integrity_evidence.total_violations
                integrity_score = max(0, 100 - (violations * 10))
                if violations > 5:
                    integrity_level = "major"
                elif violations > 0:
                    integrity_level = "minor"
            
            result.append({
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "job_title": c.job_title,
                "status": c.status,
                "outcome": outcome,
                "confidence": confidence,
                "overall_score": round(overall_score, 1),
                "integrity_score": integrity_score,
                "integrity_level": integrity_level,
                "created_at": c.created_at,
                "completed_at": c.completed_at
            })
        
        # Get unique roles for tab generation
        all_candidates = db.get_all_candidates()
        roles = list(set(c.job_title for c in all_candidates if c.job_title))
        
        # Role summary counts
        role_summary = {}
        for r in roles:
            role_candidates = [c for c in all_candidates if c.job_title == r]
            role_summary[r] = {
                "total": len(role_candidates),
                "pending": sum(1 for c in role_candidates if not c.final_decision or c.final_decision.outcome in [None, "PENDING", "CONDITIONAL"])
            }
        
        return {
            "success": True,
            "candidates": result,
            "total": len(result),
            "available_roles": roles,
            "role_summary": role_summary
        }
    except Exception as e:
        logger.error(f"Candidates by role failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.patch("/api/candidates/bulk-update")
async def bulk_update_candidates(
    request: Request,
    recruiter: dict = Depends(require_recruiter)
):
    """
    Bulk update candidate statuses.
    Request body: {"candidate_ids": [...], "action": "select|reject|pending", "notes": "optional"}
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
        
        # Map action to outcome
        outcome_map = {
            "select": "HIRE",
            "reject": "NO_HIRE",
            "pending": "PENDING"
        }
        new_outcome = outcome_map[action]
        
        updated = 0
        failed = []
        
        for cid in candidate_ids:
            try:
                candidate = db.get_candidate(cid)
                if not candidate:
                    failed.append({"id": cid, "reason": "Not found"})
                    continue
                
                # Update or create final_decision
                if not candidate.final_decision:
                    candidate.final_decision = FinalDecision(
                        candidate_id=cid,
                        outcome=new_outcome,
                        confidence="medium",
                        reasoning=[f"Bulk action by recruiter: {action}"]
                    )
                else:
                    candidate.final_decision.outcome = new_outcome
                    candidate.final_decision.reasoning.append(f"Bulk updated to {action} by recruiter")
                
                # Add decision node for audit trail
                add_decision_node(
                    candidate_id=cid,
                    node_type="MANUAL",
                    title=f"Recruiter Bulk Action: {action.title()}",
                    description=notes or f"Status updated to {new_outcome} via bulk action",
                    impact="positive" if action == "select" else "negative" if action == "reject" else "neutral"
                )
                
                db.save_candidate(candidate)
                updated += 1
            except Exception as e:
                failed.append({"id": cid, "reason": str(e)})
        
        return {
            "success": True,
            "updated_count": updated,
            "failed": failed,
            "action": action,
            "new_outcome": new_outcome
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk update failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")


@app.post("/api/candidates/{candidate_id}/notes")
async def add_recruiter_note(
    candidate_id: str,
    request: Request,
    recruiter: dict = Depends(require_recruiter)
):
    """
    Add a recruiter note to a candidate.
    """
    try:
        body = await request.json()
        note_text = body.get("note", "")
        
        if not note_text:
            raise HTTPException(status_code=400, detail="Note text is required")
        
        candidate = db.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Add as decision node for now (notes are part of audit trail)
        add_decision_node(
            candidate_id=candidate_id,
            node_type="NOTE",
            title="Recruiter Note Added",
            description=note_text,
            impact="neutral"
        )
        
        return {
            "success": True,
            "message": "Note added successfully",
            "candidate_id": candidate_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add note failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add note: {str(e)}")



@app.post("/api/demo/seed")
async def seed_demo():
    """Seed the database with demo users and candidates"""
    try:
        from seed_demo_data import seed_all_demos
        # Use fallback engine for seeding to avoid AI costs during setup
        from decision_engine import ExplainableDecisionEngine
        fallback_engine = ExplainableDecisionEngine(use_gemini=False)
        
        results = seed_all_demos(db, fallback_engine)
        logger.info(f"Database seeded with {len(results)} candidates")
        return {
            "success": True, 
            "message": f"Seeded {len(results)} candidates and demo users",
            "candidates": results
        }
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


# ==================== Error Handling ====================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global error handler with production masking"""
    # Log the full traceback for internal auditing
    logger.error(f"Unhandled Exception: {str(exc)}\n{traceback.format_exc()}")
    
    if ENV == "production":
        return JSONResponse(
            status_code=500,
            content={
                "error": "An internal server error occurred. Please contact support.",
                "request_id": str(uuid.uuid4())[:8]
            }
        )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "path": str(request.url)
        }
    )


# ==================== Interview Scheduling API ====================

# In-memory interview schedule storage (for demo - would use database in production)
interview_schedules = {}

from pydantic import BaseModel as PydanticBaseModel

class InterviewScheduleRequest(PydanticBaseModel):
    candidate_id: str
    scheduled_date: str
    scheduled_time: str
    interview_type: str = "video"
    notes: str = ""
    round: str = "second"

@app.post("/api/interviews/schedule")
async def schedule_interview(
    data: InterviewScheduleRequest,
    recruiter: dict = Depends(require_recruiter)
):
    """
    Schedule an interview for a candidate.
    Only for Selected/Conditional candidates with 50%+ score.
    """
    try:
        # Verify candidate exists and is eligible
        candidate = db.get_candidate(data.candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Check eligibility (50%+ match score, Selected or Conditional)
        outcome = candidate.final_decision.outcome if candidate.final_decision else "PENDING"
        score = candidate.resume_evidence.match_score if candidate.resume_evidence else 0
        
        if outcome not in ["HIRE", "CONDITIONAL"]:
            raise HTTPException(status_code=400, detail="Only Selected or Conditional candidates can be scheduled")
        
        if score < 50:
            raise HTTPException(status_code=400, detail="Candidate must have 50%+ match score for Round 2")
        
        # Create interview schedule
        schedule_id = str(uuid.uuid4())
        schedule = {
            "id": schedule_id,
            "candidate_id": data.candidate_id,
            "candidate_name": candidate.name,
            "candidate_email": candidate.email,
            "scheduled_date": data.scheduled_date,
            "scheduled_time": data.scheduled_time,
            "interview_type": data.interview_type,
            "notes": data.notes,
            "round": data.round,
            "scheduled_by": recruiter.get("email", "recruiter"),
            "created_at": datetime.now().isoformat(),
            "status": "scheduled"
        }
        
        interview_schedules[schedule_id] = schedule
        
        logger.info(f"Interview scheduled for {candidate.name}: {data.scheduled_date} at {data.scheduled_time}")
        
        return {
            "success": True,
            "message": f"Interview scheduled for {data.scheduled_date} at {data.scheduled_time}",
            "schedule": schedule
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Interview scheduling failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/{candidate_id}")
async def get_candidate_interviews(
    candidate_id: str,
    recruiter: dict = Depends(require_recruiter)
):
    """Get all scheduled interviews for a candidate."""
    schedules = [s for s in interview_schedules.values() if s["candidate_id"] == candidate_id]
    return {"success": True, "schedules": schedules}


@app.get("/api/interviews/upcoming")
async def get_upcoming_interviews(
    recruiter: dict = Depends(require_recruiter)
):
    """Get all upcoming interviews."""
    today = datetime.now().date().isoformat()
    upcoming = [
        s for s in interview_schedules.values() 
        if s["scheduled_date"] >= today and s["status"] == "scheduled"
    ]
    # Sort by date and time
    upcoming.sort(key=lambda x: (x["scheduled_date"], x["scheduled_time"]))
    return {"success": True, "interviews": upcoming}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
