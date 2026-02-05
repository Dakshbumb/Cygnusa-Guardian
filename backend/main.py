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
    VideoSnapshot, VideoEvidence, User, UserRole, LoginRequest, LoginResponse
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

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Verbose logging for debugging production connectivity"""
    logger.info(f"🔍 REQUEST: {request.method} {request.url}")
    try:
        response = await call_next(request)
        logger.info(f"✨ RESPONSE: {response.status_code} for {request.url}")
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
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    
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
    """List all candidates, optionally filtered by status"""
    candidates = db.get_all_candidates(status=status)
    return {
        "total": len(candidates),
        "candidates": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "job_title": c.job_title,
                "status": c.status,
                "created_at": c.created_at,
                "has_decision": c.final_decision is not None,
                "final_decision": c.final_decision.model_dump() if c.final_decision else None
            }
            for c in candidates
        ]
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
    
    # Step 3: Save file
    file_name = f"{candidate_id}_{file.filename}"
    file_content = await file.read()
    
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
            file_path = file_url
            logger.info(f"Resume uploaded to Supabase: {file_url}")
        except Exception as e:
            logger.error(f"Supabase upload failed: {e}. Falling back to local.")
            file_path = f"uploads/{file_name}"
            with open(file_path, "wb") as f:
                f.write(file_content)
    else:
        file_path = f"uploads/{file_name}"
        with open(file_path, "wb") as f:
            f.write(file_content)
    
    # Step 4: Parse and rank
    skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
    critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]
    
    gatekeeper = ResumeGatekeeper(
        jd_skills=skills_list,
        critical_skills=critical_list
    )
    evidence = gatekeeper.parse_resume(file_path)
    rank, justification = gatekeeper.rank_candidate(evidence)
    
    # Step 5: Load job roles for multi-role matching
    multi_role_results = []
    try:
        with open("job_roles.json", "r") as f:
            all_roles = json.load(f)
            for role in all_roles:
                # Skip the primary target role if it's already in the list to avoid redundancy
                # (Optional logic, but usually good for UX)
                role_gatekeeper = ResumeGatekeeper(
                    jd_skills=role["required_skills"],
                    critical_skills=role["critical_skills"]
                )
                role_evidence = role_gatekeeper.parse_resume(file_path)
                status, _ = role_gatekeeper.rank_candidate(role_evidence)
                multi_role_results.append({
                    "id": role["id"],
                    "title": role["title"],
                    "match_score": role_evidence.match_score,
                    "status": status,
                    "reasoning": role_evidence.reasoning
                })
    except Exception as e:
        logger.error(f"Multi-role matching failed in analyze_resume: {e}")

    # Step 6: Save candidate with evidence
    candidate.resume_path = file_path
    candidate.resume_evidence = evidence
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    logger.info(f"Created candidate {candidate_id} from resume upload with {len(multi_role_results)} multi-role matches")
    
    return {
        "success": True,
        "candidate_id": candidate_id,
        "name": candidate_name,
        "rank": rank,
        "justification": justification,
        "evidence": {
            "score": evidence.match_score,
            "skills_found": evidence.skills_extracted,
            "skills_missing": list(set(skills_list) - set(evidence.skills_extracted)),
            "missing_critical": evidence.missing_critical,
            "experience_years": evidence.experience_years,
            "education": evidence.education,
            "reasoning": evidence.reasoning
        },
        "multi_role_matches": multi_role_results,
        "next_step": f"/candidate/{candidate_id}" if rank != "REJECT" else None
    }

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
    
    # Parse resume with provided skills (primary analysis)
    skills_list = [s.strip() for s in jd_skills.split(",") if s.strip()]
    critical_list = [s.strip() for s in critical_skills.split(",") if s.strip()]
    
    gatekeeper = ResumeGatekeeper(
        jd_skills=skills_list,
        critical_skills=critical_list
    )
    evidence = gatekeeper.parse_resume(file_path)
    rank, justification = gatekeeper.rank_candidate(evidence)
    
    # Load job roles for multi-role matching
    multi_role_results = []
    try:
        with open("job_roles.json", "r") as f:
            all_roles = json.load(f)
            for role in all_roles:
                role_gatekeeper = ResumeGatekeeper(
                    jd_skills=role["required_skills"],
                    critical_skills=role["critical_skills"]
                )
                role_evidence = role_gatekeeper.parse_resume(file_path)
                status, _ = role_gatekeeper.rank_candidate(role_evidence)
                multi_role_results.append({
                    "role_id": role["id"],
                    "title": role["title"],
                    "match_score": role_evidence.match_score,
                    "status": status,
                    "reasoning": role_evidence.reasoning
                })
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
    
    # Update candidate
    if candidate.code_evidence is None:
        candidate.code_evidence = []
    candidate.code_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    return {
        "success": True,
        "evidence": evidence.model_dump(),
        "summary": {
            "passed": evidence.pass_rate,
            "total_tests": evidence.total_tests,
            "avg_time_ms": evidence.avg_time_ms
        }
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
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Build integrity evidence from logs
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
    
    # Generate decision
    try:
        decision = decision_engine.generate_decision(
            candidate_id=candidate_id,
            candidate_name=candidate.name,
            resume_evidence=candidate.resume_evidence,
            code_evidence=candidate.code_evidence,
            mcq_evidence=candidate.mcq_evidence,
            psychometric_evidence=candidate.psychometric_evidence,
            integrity_evidence=integrity_evidence
        )
    except Exception as e:
        logger.error(f"Decision generation failed for {candidate_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Decision generation failed: {str(e)}")
    
    # Update candidate
    candidate.integrity_evidence = integrity_evidence
    candidate.final_decision = decision
    candidate.status = "completed"
    candidate.completed_at = datetime.now().isoformat()
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate
    
    logger.info(f"Report generated for {candidate_id}: {decision.outcome}")
    
    return {
        "success": True,
        "decision": decision.model_dump(),
        "message": f"Decision generated: {decision.outcome}"
    }


# ==================== Report Export ====================

@app.get("/api/report/export/{candidate_id}")
async def export_report_pdf(candidate_id: str):
    """
    Export candidate report as downloadable PDF-ready HTML.
    Frontend can use this with browser print or a PDF library.
    """
    candidate = db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    if not candidate.final_decision:
        raise HTTPException(status_code=400, detail="Report not yet generated")
    
    decision = candidate.final_decision
    evidence = decision.evidence_summary
    
    # Build HTML report with premium design
    integrity_logs = db.get_integrity_logs(candidate_id)
    
    # Format dates and values
    completion_date = candidate.completed_at or candidate.created_at
    try:
        completion_dt = datetime.fromisoformat(completion_date)
        formatted_date = completion_dt.strftime("%B %d, %Y at %H:%M")
    except:
        formatted_date = completion_date

    def get_val(path, default="PENDING"):
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
    integrity_rating = get_val('integrity.rating', 'High')
    violations_count = len(integrity_logs)

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forensic Assessment Report - {candidate.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --primary: #1e3a8a;
            --primary-light: #eff6ff;
            --success: #10b981;
            --success-bg: #ecfdf5;
            --danger: #ef4444;
            --danger-bg: #fef2f2;
            --warning: #f59e0b;
            --warning-bg: #fffbeb;
            --neutral: #64748b;
            --neutral-bg: #f8fafc;
            --text-dark: #0f172a;
            --border: #e2e8f0;
        }}

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: 'Inter', system-ui, -apple-system, sans-serif; 
            background: #f1f5f9; 
            color: var(--text-dark);
            line-height: 1.5;
            padding: 2rem;
        }}

        .report-page {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid var(--border);
        }}

        /* Header */
        .report-header {{
            background: #0f172a;
            color: white;
            padding: 3rem 2rem;
            position: relative;
        }}

        .brand {{
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 2rem;
        }}

        .candidate-meta {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
        }}

        .meta-item .label {{
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 0.25rem;
        }}

        .meta-item .value {{
            font-weight: 600;
            font-size: 1rem;
        }}

        /* Main Content */
        .report-body {{
            padding: 2.5rem;
        }}

        .section-title {{
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-bottom: 2px solid var(--primary-light);
            padding-bottom: 0.5rem;
        }}

        /* Decision Card */
        .decision-container {{
            display: flex;
            gap: 2rem;
            background: var(--neutral-bg);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2.5rem;
            border: 1px solid var(--border);
        }}

        .outcome-box {{
            text-align: center;
            min-width: 180px;
        }}

        .badge {{
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 1.125rem;
            text-transform: uppercase;
            letter-spacing: 0.025em;
        }}

        .badge-HIRE {{ background: var(--success); color: white; }}
        .badge-NO_HIRE {{ background: var(--danger); color: white; }}
        .badge-CONDITIONAL {{ background: var(--warning); color: white; }}

        .decision-details {{
            flex: 1;
        }}

        .decision-details p {{
            margin-bottom: 0.75rem;
            font-size: 0.9375rem;
        }}

        /* Evidence Grid */
        .score-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 2.5rem;
        }}

        .score-card {{
            background: white;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            text-align: center;
        }}

        .score-card .label {{
            font-size: 0.75rem;
            color: var(--neutral);
            font-weight: 600;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
        }}

        .score-card .value {{
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-dark);
        }}

        /* Reasoning List */
        .reasoning-list {{
            list-style: none;
            margin-bottom: 2.5rem;
        }}

        .reasoning-list li {{
            position: relative;
            padding-left: 2rem;
            margin-bottom: 1rem;
            font-size: 0.9375rem;
        }}

        .reasoning-list li::before {{
            content: '✓';
            position: absolute;
            left: 0;
            top: 0;
            color: var(--success);
            font-weight: 700;
            background: var(--success-bg);
            width: 1.25rem;
            height: 1.25rem;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
        }}

        /* Violation Table */
        .violation-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            margin-top: 1rem;
        }}

        .violation-table th {{
            text-align: left;
            padding: 0.75rem;
            background: #f8fafc;
            border-bottom: 2px solid var(--border);
            color: var(--neutral);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
        }}

        .violation-table td {{
            padding: 1rem 0.75rem;
            border-bottom: 1px solid var(--border);
        }}

        .severity-badge {{
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }}

        .sev-low {{ background: #f1f5f9; color: #475569; }}
        .sev-medium {{ background: #fef3c7; color: #92400e; }}
        .sev-high {{ background: #fee2e2; color: #b91c1c; }}

        .timestamp {{ font-family: 'Space Grotesk', monospace; color: var(--neutral); }}

        /* Footer */
        .report-footer {{
            background: #f8fafc;
            padding: 2rem;
            border-top: 1px solid var(--border);
            text-align: center;
            color: var(--neutral);
            font-size: 0.8125rem;
        }}

        @media print {{
            body {{ padding: 0; background: white; }}
            .report-page {{ box-shadow: none; border: none; max-width: 100%; }}
            .report-header {{ background: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }}
        }}
    </style>
</head>
<body>
    <div class="report-page">
        <header class="report-header">
            <div class="brand">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                CYGNUSA GUARDIAN
            </div>
            <div class="candidate-meta">
                <div class="meta-item">
                    <div class="label">Candidate Name</div>
                    <div class="value">{candidate.name}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Assigned Role</div>
                    <div class="value">{candidate.job_title}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Assessment Date</div>
                    <div class="value">{formatted_date}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Report Integrity</div>
                    <div class="value">VERIFIED_SECURE</div>
                </div>
            </div>
        </header>

        <main class="report-body">
            <h2 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Hiring Intelligence Summary
            </h2>
            
            <div class="decision-container">
                <div class="outcome-box">
                    <span class="badge badge-{decision.outcome}">{decision.outcome}</span>
                    <div style="margin-top: 1rem; color: var(--neutral); font-size: 0.875rem;">
                        <strong>Confidence:</strong> {decision.confidence.upper()}
                    </div>
                </div>
                <div class="decision-details">
                    <p><strong>Rationale:</strong> The candidate was evaluated across technical proficiency, behavioral alignment, and assessment integrity.</p>
                    <p><strong>Fit Analysis:</strong> {decision.role_fit}</p>
                    <p><strong>Recruiter Action:</strong> {decision.next_steps}</p>
                </div>
            </div>

            <div class="score-grid">
                <div class="score-card">
                    <div class="label">Resume Match</div>
                    <div class="value">{resume_score:.1f}%</div>
                </div>
                <div class="score-card">
                    <div class="label">Coding Perf.</div>
                    <div class="value">{coding_score if isinstance(coding_score, (int, float)) else 0:.1f}%</div>
                </div>
                <div class="score-card">
                    <div class="label">Soft Skills</div>
                    <div class="value">{mcq_score if isinstance(mcq_score, (int, float)) else 0:.1f}%</div>
                </div>
                <div class="score-card">
                    <div class="label">Integrity</div>
                    <div class="value">{integrity_rating}</div>
                </div>
            </div>

            <h2 class="section-title">Key Decision Points</h2>
            <ul class="reasoning-list">
                {''.join(f'<li>{r}</li>' for r in decision.reasoning)}
            </ul>

            <h2 class="section-title">Forensic Integrity Audit</h2>
            <p style="font-size: 0.875rem; color: var(--neutral); margin-bottom: 1rem;">
                Detailed log of all detected anomalous events during the assessment session.
            </p>
            
            {f'''
            <table class="violation-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Event Type</th>
                        <th>Severity</th>
                        <th>Forensic Context</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(f'<tr><td class="timestamp">{e.timestamp.split("T")[1].split(".")[0] if "T" in e.timestamp else e.timestamp}</td><td style="font-weight: 500;">{e.event_type.replace("_", " ").capitalize()}</td><td><span class="severity-badge sev-{e.severity}">{e.severity}</span></td><td style="color: var(--neutral);">{e.context or "No additional context"}</td></tr>' for e in integrity_logs)}
                </tbody>
            </table>
            ''' if integrity_logs else f'<div style="padding: 2rem; background: var(--success-bg); color: var(--success); border-radius: 8px; text-align: center; font-weight: 600;">No integrity violations detected. Assessment environment verified as stable.</div>'}

        </main>

        <footer class="report-footer">
            <p><strong>Forensic Report ID:</strong> {candidate.id} | <strong>System Version:</strong> 2.4.0-Forensic</p>
            <p style="margin-top: 0.5rem;">The Cygnusa Guardian system utilizes deterministic rule-matching and generative reasoning for high-transparency hiring decisions.</p>
        </footer>
    </div>
</body>
</html>
"""
    
    # Return as streaming HTML response that can be printed/saved as PDF
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
            text_done = len(c.text_evidence or [])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
