"""
Cygnusa Guardian - Data Models
All evidence types are explicit and auditable - no black boxes
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum


# ==================== Authentication Models ====================

class UserRole(str, Enum):
    """User role for role-based access control"""
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class User(BaseModel):
    """User account for authentication"""
    id: str
    email: str
    role: UserRole
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class LoginRequest(BaseModel):
    """Login request - for demo, user selects their role"""
    email: str
    role: UserRole


class LoginResponse(BaseModel):
    """Login response with JWT token"""
    user_id: str
    role: UserRole
    token: str
    name: str


# ==================== Evidence Models ====================


class ResumeEvidence(BaseModel):
    """Evidence from resume parsing - fully explainable"""
    skills_extracted: List[str]
    skill_context: Dict[str, str] = {}  # skill -> snippet/location context
    jd_required: List[str]
    match_score: float = Field(ge=0, le=100)
    match_calculation: Optional[str] = None  # Explanation of %
    reasoning: str
    missing_critical: List[str] = []
    experience_years: Optional[int] = None
    education: Optional[str] = None


class TestCaseResult(BaseModel):
    """Single test case execution result"""
    input: str
    expected: str
    actual: str
    passed: bool
    time_ms: float
    error: Optional[str] = None


class CodeExecutionEvidence(BaseModel):
    """Evidence from code execution - shows exact test results"""
    question_id: str
    question_title: str
    language: str = "python"
    submitted_code: str
    test_cases: List[TestCaseResult]
    pass_rate: float
    avg_time_ms: float
    total_tests: int
    # Stress-response timing
    time_started: Optional[str] = None
    time_submitted: Optional[str] = None
    duration_seconds: Optional[int] = None


class MCQEvidence(BaseModel):
    """MCQ assessment evidence - tracks competency mapping"""
    question_id: str
    question_text: str
    competency: str
    selected_option: str
    correct_option: str
    is_correct: bool
    explanation: Optional[str] = None
    # Stress-response timing
    time_started: Optional[str] = None
    time_submitted: Optional[str] = None
    duration_seconds: Optional[int] = None


class TextAnswerEvidence(BaseModel):
    """Text/reasoning answer evidence - evaluates written responses"""
    question_id: str
    question_text: str
    competency: str
    answer_text: str
    word_count: int
    time_taken_seconds: Optional[float] = None
    key_themes: List[str] = []
    quality_score: Optional[float] = None  # 0-10 scale, can be AI-assessed


class PsychometricEvidence(BaseModel):
    """Psychometric slider evidence - self-assessment data"""
    competencies: Dict[str, float]
    weak_areas: List[str]
    strong_areas: List[str]
    interpretation: Optional[str] = None


class IntegrityEvent(BaseModel):
    """Single integrity violation with full context"""
    timestamp: str
    event_type: str  # tab_switch, paste_detected, no_face, multiple_faces, etc.
    severity: str  # low, medium, high, critical
    context: Optional[str] = None


class IntegrityEvidence(BaseModel):
    """Proctoring evidence summary"""
    total_violations: int
    events: List[IntegrityEvent]
    severity_score: float
    trustworthiness_rating: str  # High, Medium, Low


class VideoSnapshot(BaseModel):
    """Single video snapshot from webcam"""
    timestamp: str
    snapshot_path: str  # Path to stored image
    face_detected: Optional[bool] = None  # From face detection
    notes: Optional[str] = None


class VideoEvidence(BaseModel):
    """Video proctoring evidence - webcam snapshots during assessment"""
    snapshots: List[VideoSnapshot] = []
    total_snapshots: int = 0
    face_detection_rate: Optional[float] = None  # % of snapshots with face
    anomalies_detected: int = 0  # Number of suspicious frames


class FinalDecision(BaseModel):
    """Final hiring decision with FULL transparency"""
    candidate_id: str
    outcome: str  # HIRE, NO_HIRE, CONDITIONAL
    confidence: str  # high, medium, low
    conflict_analysis: Optional[str] = None
    conflict_score: Optional[int] = None
    reasoning: List[str] = Field(min_length=1, max_length=10) # Increased max length
    role_fit: str
    next_steps: str
    evidence_summary: Dict
    audit_trail: Dict  # Contains the exact AI prompt + raw response
    generated_at: str


class DecisionNode(BaseModel):
    """
    A single point in the assessment timeline that influenced the final decision.
    This is the core of the forensic "Glass-Box" UI.
    """
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    node_type: str # RESUME, CODE, MCQ, TEXT, INTEGRITY, FINAL
    title: str
    impact: str # positive, neutral, negative
    description: str
    evidence_id: Optional[str] = None # ID of the specific question or event
    predicted_rank: Optional[float] = None


class CandidateProfile(BaseModel):
    """Complete candidate data - single source of truth"""
    id: str
    name: str
    email: str
    job_title: str = "Software Engineer"
    resume_path: str = ""
    status: str = "pending"  # pending, resume_uploaded, in_progress, completed
    
    # Evidence artifacts - each one is explainable
    resume_evidence: Optional[ResumeEvidence] = None
    code_evidence: Optional[List[CodeExecutionEvidence]] = None
    mcq_evidence: Optional[List[MCQEvidence]] = None
    text_answer_evidence: Optional[List[TextAnswerEvidence]] = None
    psychometric_evidence: Optional[PsychometricEvidence] = None
    integrity_evidence: Optional[IntegrityEvidence] = None
    video_evidence: Optional[VideoEvidence] = None  # Webcam proctoring
    decision_nodes: List[DecisionNode] = [] # The Forensic Timeline
    final_decision: Optional[FinalDecision] = None
    
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None


class JobDescription(BaseModel):
    """Job description for matching"""
    id: str
    title: str
    required_skills: List[str]
    critical_skills: List[str]  # Must-have skills
    nice_to_have: List[str] = []
    min_experience_years: int = 0
