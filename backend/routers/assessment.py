"""
Assessment Flow Router

Manages the entire candidate assessment lifecycle: coding problems,
MCQs, psychometric sliders, text answers, shadow probes, claim
verification, and keystroke dynamics.

Endpoints:
  POST /api/assessment/start             - Initialize assessment session
  POST /api/assessment/submit-code       - Grade a code submission
  POST /api/assessment/probe             - Generate a shadow probe question
  POST /api/assessment/submit-probe      - Submit probe response
  GET  /api/assessment/claim-probes/{id} - Get flagged resume claims
  POST /api/assessment/submit-claim-probe- Verify a resume claim
  POST /api/assessment/keystroke-data    - Submit keystroke biometrics
  GET  /api/assessment/authenticity-score/{id} - Get claim verification score
  POST /api/assessment/submit-mcq        - Submit MCQ answer
  POST /api/assessment/submit-psychometric - Submit psychometric scores
  POST /api/assessment/submit-text       - Submit text/reasoning answer
"""

import json
import logging

from fastapi import APIRouter, Form, HTTPException
from models import (
    MCQEvidence, PsychometricEvidence, TextAnswerEvidence,
    KeystrokeEvidence, KeystrokeInterval,
)
from code_executor import DEMO_QUESTIONS, DEMO_MCQS
from dependencies import (
    db, code_sandbox, shadow_proctor, keystroke_analyzer,
    active_sessions, add_decision_node,
)

logger = logging.getLogger("cygnusa-api")

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])


# --------------------------------------------------------------- Start ---

@router.post("/start")
async def start_assessment(candidate_id: str = Form(...)):
    """Initialize an assessment session for a candidate.

    Loads role-specific coding questions, MCQs, and text prompts.
    Returns the full question payload for the frontend to render.
    """
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = "in_progress"
    candidate.code_evidence = []
    candidate.mcq_evidence = []
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    # Determine role-specific questions
    coding_qs, mcqs, domain_qs = [], [], []
    requires_coding = True

    try:
        with open("job_roles.json", "r") as f:
            all_roles = json.load(f)
            target_role = next(
                (r for r in all_roles if r["title"] == candidate.job_title or r["id"] == candidate.job_title),
                next((r for r in all_roles if r["id"] == "backend_developer"), all_roles[0]),
            )

            requires_coding = target_role.get("requires_coding", True)

            if requires_coding:
                for q_id in target_role.get("coding_question_ids", ["fibonacci"]):
                    if q_id in DEMO_QUESTIONS:
                        q = DEMO_QUESTIONS[q_id]
                        coding_qs.append({
                            "id": f"q_{q_id}", "title": q["title"],
                            "description": q["description"],
                            "template": q["template"], "language": "python",
                        })
            else:
                domain_qs = _load_domain_questions(target_role)

            # MCQs
            for m_id in target_role.get("mcq_ids", ["be_q1"]):
                if m_id in DEMO_MCQS:
                    m = DEMO_MCQS[m_id]
                    mcqs.append({
                        "id": m_id, "question": m["question"],
                        "competency": m["competency"],
                        "options": m["options"], "correct": m["correct"],
                    })

            # Fallbacks
            if requires_coding and not coding_qs:
                coding_qs = [{"id": "q_fibonacci", **DEMO_QUESTIONS["fibonacci"], "language": "python"}]
            if not mcqs:
                for fid in ["be_q2", "fe_q2", "ml_q1"]:
                    if fid in DEMO_MCQS:
                        m = DEMO_MCQS[fid]
                        mcqs.append({"id": fid, "question": m["question"], "competency": m["competency"], "options": m["options"], "correct": m["correct"]})

    except Exception as e:
        logger.error(f"Failed to load role questions: {e}. Using fallback.")
        coding_qs = [{"id": "q_fibonacci", **DEMO_QUESTIONS["fibonacci"], "language": "python"}]
        mcqs = [{"id": "be_q1", **DEMO_MCQS["be_q1"]}]

    # Text questions
    if requires_coding:
        text_questions = [
            {"id": "text1", "question": "Describe a challenging technical problem you solved. What was your approach and what did you learn?", "competency": "Problem Solving", "min_words": 50, "max_words": 300},
            {"id": "text2", "question": "Tell us about a time you disagreed with a team decision. How did you handle it?", "competency": "Collaboration", "min_words": 50, "max_words": 300},
        ]
    else:
        text_questions = domain_qs

    return {
        "candidate_id": candidate_id,
        "candidate_name": candidate.name,
        "job_title": candidate.job_title,
        "requires_coding": requires_coding,
        "coding_questions": coding_qs if requires_coding else [],
        "domain_questions": domain_qs if not requires_coding else [],
        "mcqs": mcqs,
        "psychometric_sliders": [
            {"id": "resilience", "label": "I handle setbacks and criticism well", "min": 0, "max": 10},
            {"id": "leadership", "label": "I naturally take charge in group settings", "min": 0, "max": 10},
            {"id": "learning", "label": "I actively seek out new skills and knowledge", "min": 0, "max": 10},
            {"id": "teamwork", "label": "I prefer collaborating over working alone", "min": 0, "max": 10},
            {"id": "pressure", "label": "I perform well under tight deadlines", "min": 0, "max": 10},
        ],
        "text_questions": text_questions,
        "config": {
            "total_time_minutes": 45 if requires_coding else 35,
            "section_times": {
                "coding": 20 if requires_coding else 0,
                "domain": 0 if requires_coding else 20,
                "mcq": 10,
                "text": 10 if requires_coding else 5,
                "psychometric": 5,
            },
        },
        "instructions": {
            "coding": "Write Python functions to solve each problem. Your solution function must be named 'solution'." if requires_coding else None,
            "domain": "Answer each scenario question thoughtfully, drawing on your professional experience." if not requires_coding else None,
            "mcqs": "Select the best response for each workplace scenario.",
            "text": "Answer each question thoughtfully. Your responses will be analyzed for clarity and relevance.",
            "psychometric": "Rate yourself honestly on each statement (0 = Strongly Disagree, 10 = Strongly Agree)",
            "integrity": "Webcam monitoring is active. Tab switches and copy-paste will be logged.",
        },
    }


# -------------------------------------------------------- Code Submission ---

@router.post("/submit-code")
async def submit_code(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    code: str = Form(...),
    language: str = Form(default="python"),
    time_started: str = Form(default=None),
    time_submitted: str = Form(default=None),
    duration_seconds: int = Form(default=None),
):
    """Execute candidate code against hidden test cases and record evidence."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    question_key = question_id.split("_", 1)[1] if "_" in question_id else question_id
    question_data = DEMO_QUESTIONS.get(question_key)
    if not question_data:
        raise HTTPException(status_code=400, detail=f"Unknown question: {question_id}")

    evidence = code_sandbox.execute(
        code=code, language=language,
        test_cases=question_data["test_cases"],
        question_id=question_id, question_title=question_data["title"],
    )
    evidence.time_started = time_started
    evidence.time_submitted = time_submitted
    evidence.duration_seconds = duration_seconds

    if candidate.code_evidence is None:
        candidate.code_evidence = []
    candidate.code_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    add_decision_node(
        candidate_id=candidate_id, node_type="CODE",
        title=f"Code Verified: {question_data['title']}",
        description=f"Test pass rate: {evidence.pass_rate:.1f}%. Duration: {duration_seconds}s.",
        impact="positive" if evidence.pass_rate >= 70 else "neutral" if evidence.pass_rate >= 40 else "negative",
        evidence_id=question_id, predicted_rank=evidence.pass_rate,
    )

    return {
        "success": True,
        "evidence": evidence.model_dump(),
        "summary": {"passed": evidence.pass_rate, "total_tests": evidence.total_tests, "avg_time_ms": evidence.avg_time_ms},
    }


# -------------------------------------------------------- Shadow Probes ---

@router.post("/probe")
async def generate_shadow_probe(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    code: str = Form(...),
):
    """Analyze submitted code and generate a targeted follow-up question."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    question_key = question_id.split("_", 1)[1] if "_" in question_id else question_id
    question_data = DEMO_QUESTIONS.get(question_key)
    if not question_data:
        return {"shadow_probe": {"question": "Tell us about the complexity of your approach.", "target_concept": "General Implementation"}}

    probe = shadow_proctor.generate_probe(
        question_title=question_data["title"],
        question_desc=question_data["description"],
        code=code,
    )
    return {"success": True, "shadow_probe": probe}


@router.post("/submit-probe")
async def submit_shadow_probe(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    probe_question: str = Form(...),
    answer: str = Form(...),
    target_concept: str = Form(default="General"),
):
    """Record the candidate's response to a shadow-probe question."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    probe_evidence = TextAnswerEvidence(
        question_id=f"probe_{question_id}",
        question_text=probe_question,
        answer_text=answer,
        competency=f"Deep Probe: {target_concept}",
        word_count=len(answer.split()),
    )

    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(probe_evidence)

    add_decision_node(
        candidate_id=candidate_id, node_type="TEXT",
        title="Forensic Verification: Shadow Probe Answered",
        description=f"Candidate explained logic for {question_id}. Target: {target_concept}",
        impact="positive" if len(answer.split()) > 10 else "neutral",
        evidence_id=f"probe_{question_id}",
    )

    return {"success": True, "message": "Shadow probe response captured"}


# -------------------------------------------------------- Claim Probing ---

@router.get("/claim-probes/{candidate_id}")
async def get_claim_probes(candidate_id: str):
    """Get resume claims flagged for verification during the assessment."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    claims = []
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        claims = [c.model_dump() for c in candidate.resume_evidence.suspicious_claims]

    return {"success": True, "candidate_id": candidate_id, "total_claims": len(claims), "claims": claims}


@router.post("/submit-claim-probe")
async def submit_claim_probe(
    candidate_id: str = Form(...),
    claim_id: str = Form(...),
    claim_text: str = Form(...),
    probe_question: str = Form(...),
    answer: str = Form(...),
    claim_type: str = Form(default="general"),
):
    """Evaluate candidate's response to a claim verification probe."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    word_count = len(answer.split())
    if word_count >= 50:
        response_quality, verified = "detailed", True
    elif word_count >= 20:
        response_quality, verified = "adequate", True
    elif word_count >= 5:
        response_quality, verified = "vague", False
    else:
        response_quality, verified = "no_response", False

    # Update claim verification status
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        for claim in candidate.resume_evidence.suspicious_claims:
            if claim.claim_id == claim_id:
                claim.verified = verified
                claim.response_quality = response_quality
                break

    probe_evidence = TextAnswerEvidence(
        question_id=f"claim_probe_{claim_id}",
        question_text=probe_question,
        answer_text=answer,
        competency=f"Claim Verification: {claim_type.title()}",
        word_count=word_count,
    )
    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(probe_evidence)

    add_decision_node(
        candidate_id=candidate_id, node_type="TEXT",
        title=f"Claim Probe: {claim_type.title()} Verification",
        description=f"Verified claim '{claim_text[:50]}...' - Response: {response_quality}",
        impact="positive" if verified else "negative",
        evidence_id=f"claim_{claim_id}",
    )

    return {"success": True, "verified": verified, "response_quality": response_quality, "message": f"Claim verification recorded: {response_quality}"}


# -------------------------------------------------- Keystroke Biometrics ---

@router.post("/keystroke-data")
async def save_keystroke_data(
    candidate_id: str = Form(...),
    intervals_json: str = Form(...),
):
    """Analyze a batch of keystroke rhythm intervals for anomaly detection."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    try:
        new_intervals = [KeystrokeInterval(**i) for i in json.loads(intervals_json)]
        logger.info(f"Received {len(new_intervals)} keystroke intervals for {candidate_id}")

        if candidate.keystroke_evidence is None:
            candidate.keystroke_evidence = KeystrokeEvidence()

        candidate.keystroke_evidence = keystroke_analyzer.analyze_intervals(
            candidate_id, new_intervals, candidate.keystroke_evidence,
        )

        if candidate.keystroke_evidence.is_anomaly:
            has_node = any(n.node_type == "INTEGRITY" and "Keystroke" in n.title for n in candidate.decision_nodes)
            if not has_node:
                add_decision_node(
                    candidate_id=candidate_id, node_type="INTEGRITY",
                    title="Biometric Anomaly: Keystroke DNA Mismatch",
                    description=f"Rhythm consistency: {candidate.keystroke_evidence.rhythm_score}%",
                    impact="negative",
                )

        db.save_candidate(candidate)
        return {
            "success": True,
            "rhythm_score": candidate.keystroke_evidence.rhythm_score,
            "is_anomaly": candidate.keystroke_evidence.is_anomaly,
            "baseline_established": candidate.keystroke_evidence.baseline_established,
        }
    except Exception as e:
        logger.error(f"Keystroke processing failed: {e}")
        return {"success": False, "error": str(e)}


# ------------------------------------------------ Authenticity Score ---

@router.get("/authenticity-score/{candidate_id}")
async def get_authenticity_score(candidate_id: str):
    """Calculate resume authenticity score from claim verification results."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    claims = []
    if candidate.resume_evidence and candidate.resume_evidence.suspicious_claims:
        claims = candidate.resume_evidence.suspicious_claims

    if not claims:
        return {"success": True, "overall_score": 100, "claims_detected": 0, "claims_verified": 0, "claims_failed": 0, "red_flags": [], "message": "No verifiable claims detected"}

    claims_verified = sum(1 for c in claims if c.verified is True)
    claims_failed = sum(1 for c in claims if c.verified is False)
    claims_pending = sum(1 for c in claims if c.verified is None)

    base_score = 70
    verified_bonus = (claims_verified / len(claims)) * 30
    failed_penalty = (claims_failed / len(claims)) * 40
    overall_score = max(0, min(100, int(base_score + verified_bonus - failed_penalty)))

    red_flags = [f"Failed to verify: {c.claim_text[:50]}" for c in claims if c.verified is False and c.confidence_flag == "high"]

    return {
        "success": True, "overall_score": overall_score,
        "claims_detected": len(claims), "claims_verified": claims_verified,
        "claims_failed": claims_failed, "claims_pending": claims_pending,
        "red_flags": red_flags,
    }


# --------------------------------------------------------------- MCQ ---

@router.post("/submit-mcq")
async def submit_mcq(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    question_text: str = Form(...),
    selected_option: str = Form(...),
    correct_option: str = Form(...),
    competency: str = Form(...),
    time_started: str = Form(default=None),
    time_submitted: str = Form(default=None),
    duration_seconds: int = Form(default=None),
):
    """Submit an MCQ answer with timing data for stress-response analysis."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    evidence = MCQEvidence(
        question_id=question_id, question_text=question_text,
        competency=competency, selected_option=selected_option,
        correct_option=correct_option, is_correct=(selected_option == correct_option),
        time_started=time_started, time_submitted=time_submitted,
        duration_seconds=duration_seconds,
    )

    if candidate.mcq_evidence is None:
        candidate.mcq_evidence = []
    candidate.mcq_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    if len(candidate.mcq_evidence) == 1:
        add_decision_node(candidate_id, "MCQ", "Scenario Logic Initialized", "Behavioral reasoning assessment started.", "neutral")

    return {"success": True, "evidence": evidence.model_dump()}


# -------------------------------------------------------- Psychometric ---

@router.post("/submit-psychometric")
async def submit_psychometric(
    candidate_id: str = Form(...),
    resilience: int = Form(...),
    leadership: int = Form(...),
    learning: int = Form(...),
    teamwork: int = Form(default=5),
    pressure: int = Form(default=5),
):
    """Submit psychometric self-assessment scores."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    scores = {"resilience": resilience, "leadership": leadership, "learning": learning, "teamwork": teamwork, "pressure": pressure}
    weak_areas = [k for k, v in scores.items() if v < 5]
    strong_areas = [k for k, v in scores.items() if v >= 7]

    evidence = PsychometricEvidence(
        competencies=scores,
        weak_areas=weak_areas,
        strong_areas=strong_areas,
        interpretation=f"Self-assessment: {len(strong_areas)} strengths, {len(weak_areas)} areas for development.",
    )

    candidate.psychometric_evidence = evidence
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    add_decision_node(
        candidate_id=candidate_id, node_type="PSYCH",
        title="Psychometric Calibration",
        description=f"{len(strong_areas)} strengths and {len(weak_areas)} weak areas identified.",
        impact="positive" if len(strong_areas) > len(weak_areas) else "neutral",
    )

    return {"success": True, "evidence": evidence.model_dump()}


# -------------------------------------------------------- Text Answer ---

@router.post("/submit-text")
async def submit_text_answer(
    candidate_id: str = Form(...),
    question_id: str = Form(...),
    question_text: str = Form(...),
    answer_text: str = Form(...),
    competency: str = Form(...),
    time_taken_seconds: float = Form(default=0),
):
    """Submit a written reasoning answer and extract key themes."""
    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    word_count = len(answer_text.split())

    # Simple keyword-based theme extraction
    theme_keywords = {
        "problem-solving": ["solved", "solution", "approach", "analyzed", "debug", "fixed"],
        "collaboration": ["team", "together", "discussed", "shared", "helped"],
        "leadership": ["led", "managed", "organized", "coordinated", "delegated"],
        "learning": ["learned", "discovered", "improved", "researched", "studied"],
        "communication": ["explained", "presented", "documented", "clarified"],
    }
    answer_lower = answer_text.lower()
    key_themes = [theme for theme, kws in theme_keywords.items() if any(kw in answer_lower for kw in kws)]

    evidence = TextAnswerEvidence(
        question_id=question_id, question_text=question_text,
        competency=competency, answer_text=answer_text,
        word_count=word_count, time_taken_seconds=time_taken_seconds,
        key_themes=key_themes, quality_score=min(10, word_count / 30),
    )

    if candidate.text_answer_evidence is None:
        candidate.text_answer_evidence = []
    candidate.text_answer_evidence.append(evidence)
    db.save_candidate(candidate)
    active_sessions[candidate_id] = candidate

    if not question_id.startswith("probe_"):
        add_decision_node(candidate_id, "TEXT", f"Reasoning Verified: {competency}", f"Word count: {word_count}.", "positive" if word_count > 50 else "neutral")

    return {"success": True, "evidence": evidence.model_dump()}


# ----------------------------------------------------------- Helpers ---

def _load_domain_questions(target_role: dict) -> list:
    """Load domain-specific questions for non-technical roles."""
    domain_qs = []
    try:
        with open("domain_questions.json", "r") as dq_file:
            domain_data = json.load(dq_file)
            domain_category = target_role.get("domain_category", "finance")

            for q_id in target_role.get("domain_question_ids", []):
                category_qs = domain_data.get("domain_questions", {}).get(domain_category, [])
                for dq in category_qs:
                    if dq["id"] == q_id:
                        domain_qs.append(dq)
                        break

            soft_skills = domain_data.get("soft_skills", [])
            domain_qs.extend(soft_skills[:3])
    except Exception as e:
        logger.error(f"Failed to load domain questions: {e}")
        domain_qs = [
            {"id": "fallback_domain", "question": "Describe a challenging situation in your field and how you handled it.", "competency": "Problem Solving", "category": "domain", "min_words": 100, "max_words": 400},
            {"id": "fallback_leadership", "question": "Tell us about a time you led a team or project. What was the outcome?", "competency": "Leadership", "category": "soft_skills", "min_words": 100, "max_words": 400},
        ]
    return domain_qs
