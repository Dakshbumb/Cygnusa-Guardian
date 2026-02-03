"""
Cygnusa Guardian - Demo Data Seeder
Creates pre-built candidates for demo day
"""

from datetime import datetime, timedelta
from models import (
    CandidateProfile, ResumeEvidence, CodeExecutionEvidence, 
    TestCaseResult, MCQEvidence, PsychometricEvidence,
    IntegrityEvidence, IntegrityEvent, User, UserRole
)



def seed_demo_users(db):
    """Create demo users for quick login"""
    users = [
        User(
            id="u_recruiter_demo",
            email="recruiter@demo.com",
            role=UserRole.RECRUITER,
            name="Sarah Recruiter"
        ),
        User(
            id="u_candidate_demo",
            email="candidate@demo.com",
            role=UserRole.CANDIDATE,
            name="Alex Candidate"
        ),
        User(
            id="u_admin_demo",
            email="admin@demo.com",
            role=UserRole.ADMIN,
            name="System Admin"
        )
    ]
    
    for user in users:
        db.save_user(user)
        print(f"  ✅ Created: {user.email} ({user.role})")
    
    return users


def seed_all_demos(db, decision_engine):
    """Seed all demo candidates and users"""
    results = []
    
    # Seed demo users first
    print("🔐 Seeding demo users...")
    seed_demo_users(db)
    
    # Demo 1: Strong Hire
    results.append(seed_alice_strong(db, decision_engine))
    
    # Demo 2: Borderline Conditional
    results.append(seed_bob_borderline(db, decision_engine))
    
    # Demo 3: Clear Reject
    results.append(seed_charlie_reject(db, decision_engine))
    
    print("\n📧 Demo accounts ready:")
    print("   Recruiter: recruiter@demo.com")
    print("   Candidate: candidate@demo.com")
    print("   Admin: admin@demo.com")
    
    return results


def seed_alice_strong(db, decision_engine):
    """
    Alice: Strong candidate - should be HIRE
    High scores across all dimensions, no integrity issues
    """
    candidate = CandidateProfile(
        id="demo_alice",
        name="Alice Chen",
        email="alice.chen@example.com",
        job_title="Senior Software Engineer",
        status="completed",
        created_at=(datetime.now() - timedelta(hours=2)).isoformat()
    )
    
    # Strong resume match
    candidate.resume_evidence = ResumeEvidence(
        skills_extracted=["python", "javascript", "react", "docker", "kubernetes", "postgresql", "aws"],
        jd_required=["python", "javascript", "react", "docker", "kubernetes", "postgresql"],
        match_score=100.0,
        reasoning="Found 6/6 required skills (100% match). ✓ All critical skills present. Experience: 5 years detected.",
        missing_critical=[],
        experience_years=5,
        education="Master's"
    )
    
    # Excellent coding performance
    candidate.code_evidence = [
        CodeExecutionEvidence(
            question_id="q1_fibonacci",
            question_title="Fibonacci Number",
            language="python",
            submitted_code="def solution(n):\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b",
            test_cases=[
                TestCaseResult(input="0", expected="0", actual="0", passed=True, time_ms=45),
                TestCaseResult(input="1", expected="1", actual="1", passed=True, time_ms=42),
                TestCaseResult(input="5", expected="5", actual="5", passed=True, time_ms=48),
                TestCaseResult(input="10", expected="55", actual="55", passed=True, time_ms=52),
                TestCaseResult(input="15", expected="610", actual="610", passed=True, time_ms=55),
            ],
            pass_rate=100.0,
            avg_time_ms=48.4,
            total_tests=5
        ),
        CodeExecutionEvidence(
            question_id="q2_palindrome",
            question_title="Palindrome Check",
            language="python",
            submitted_code="def solution(s):\n    return s == s[::-1]",
            test_cases=[
                TestCaseResult(input="racecar", expected="True", actual="True", passed=True, time_ms=32),
                TestCaseResult(input="hello", expected="False", actual="False", passed=True, time_ms=28),
                TestCaseResult(input="a", expected="True", actual="True", passed=True, time_ms=25),
                TestCaseResult(input="abba", expected="True", actual="True", passed=True, time_ms=30),
            ],
            pass_rate=100.0,
            avg_time_ms=28.75,
            total_tests=4
        )
    ]
    
    # Good MCQ performance
    candidate.mcq_evidence = [
        MCQEvidence(
            question_id="mcq1",
            question_text="Your team disagrees on implementation approach. What do you do?",
            competency="Collaboration",
            selected_option="B",
            correct_option="B",
            is_correct=True
        ),
        MCQEvidence(
            question_id="mcq2",
            question_text="Critical bug discovered 1 hour before deployment. What do you do?",
            competency="Problem Solving",
            selected_option="C",
            correct_option="C",
            is_correct=True
        ),
        MCQEvidence(
            question_id="mcq3",
            question_text="A colleague's code has obvious issues. How do you approach code review?",
            competency="Communication",
            selected_option="C",
            correct_option="C",
            is_correct=True
        )
    ]
    
    # Strong psychometric profile
    candidate.psychometric_evidence = PsychometricEvidence(
        competencies={
            "resilience": 8,
            "leadership": 7,
            "learning": 9,
            "teamwork": 8,
            "pressure": 7
        },
        weak_areas=[],
        strong_areas=["resilience", "leadership", "learning", "teamwork", "pressure"],
        interpretation="Self-assessment shows 5 strong areas and 0 areas for development."
    )
    
    # Clean integrity record
    integrity_evidence = IntegrityEvidence(
        total_violations=0,
        events=[],
        severity_score=0,
        trustworthiness_rating="High"
    )
    candidate.integrity_evidence = integrity_evidence
    
    # Generate decision
    decision = decision_engine.generate_decision(
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        resume_evidence=candidate.resume_evidence,
        code_evidence=candidate.code_evidence,
        mcq_evidence=candidate.mcq_evidence,
        psychometric_evidence=candidate.psychometric_evidence,
        integrity_evidence=integrity_evidence
    )
    
    candidate.final_decision = decision
    candidate.completed_at = datetime.now().isoformat()
    db.save_candidate(candidate)
    
    return {"id": candidate.id, "name": candidate.name, "outcome": decision.outcome}


def seed_bob_borderline(db, decision_engine):
    """
    Bob: Borderline candidate - should be CONDITIONAL
    Mixed scores, some integrity concerns
    """
    candidate = CandidateProfile(
        id="demo_bob",
        name="Bob Smith",
        email="bob.smith@example.com",
        job_title="Software Engineer",
        status="completed",
        created_at=(datetime.now() - timedelta(hours=3)).isoformat()
    )
    
    # Moderate resume match
    candidate.resume_evidence = ResumeEvidence(
        skills_extracted=["python", "javascript", "react"],
        jd_required=["python", "javascript", "react", "docker", "kubernetes", "postgresql"],
        match_score=50.0,
        reasoning="Found 3/6 required skills (50% match). Missing: docker, kubernetes, postgresql. Experience: 3 years detected.",
        missing_critical=[],
        experience_years=3,
        education="Bachelor's"
    )
    
    # Mixed coding performance
    candidate.code_evidence = [
        CodeExecutionEvidence(
            question_id="q1_fibonacci",
            question_title="Fibonacci Number",
            language="python",
            submitted_code="def solution(n):\n    if n <= 1:\n        return n\n    return solution(n-1) + solution(n-2)",
            test_cases=[
                TestCaseResult(input="0", expected="0", actual="0", passed=True, time_ms=45),
                TestCaseResult(input="1", expected="1", actual="1", passed=True, time_ms=42),
                TestCaseResult(input="5", expected="5", actual="5", passed=True, time_ms=180),
                TestCaseResult(input="10", expected="55", actual="55", passed=True, time_ms=850),
                TestCaseResult(input="15", expected="610", actual="TIMEOUT", passed=False, time_ms=5000, error="Execution exceeded 5s limit"),
            ],
            pass_rate=80.0,
            avg_time_ms=1223.4,
            total_tests=5
        ),
        CodeExecutionEvidence(
            question_id="q2_palindrome",
            question_title="Palindrome Check",
            language="python",
            submitted_code="def solution(s):\n    for i in range(len(s)//2):\n        if s[i] != s[len(s)-1-i]:\n            return False\n    return True",
            test_cases=[
                TestCaseResult(input="racecar", expected="True", actual="True", passed=True, time_ms=35),
                TestCaseResult(input="hello", expected="False", actual="False", passed=True, time_ms=32),
                TestCaseResult(input="a", expected="True", actual="True", passed=True, time_ms=28),
                TestCaseResult(input="abba", expected="True", actual="True", passed=True, time_ms=33),
            ],
            pass_rate=100.0,
            avg_time_ms=32.0,
            total_tests=4
        )
    ]
    
    # Mixed MCQ performance
    candidate.mcq_evidence = [
        MCQEvidence(
            question_id="mcq1",
            question_text="Your team disagrees on implementation approach. What do you do?",
            competency="Collaboration",
            selected_option="A",  # Wrong
            correct_option="B",
            is_correct=False
        ),
        MCQEvidence(
            question_id="mcq2",
            question_text="Critical bug discovered 1 hour before deployment. What do you do?",
            competency="Problem Solving",
            selected_option="C",
            correct_option="C",
            is_correct=True
        ),
        MCQEvidence(
            question_id="mcq3",
            question_text="A colleague's code has obvious issues. How do you approach code review?",
            competency="Communication",
            selected_option="C",
            correct_option="C",
            is_correct=True
        )
    ]
    
    # Mixed psychometric profile
    candidate.psychometric_evidence = PsychometricEvidence(
        competencies={
            "resilience": 6,
            "leadership": 4,  # Weak
            "learning": 7,
            "teamwork": 5,
            "pressure": 5
        },
        weak_areas=["leadership"],
        strong_areas=["learning"],
        interpretation="Self-assessment shows 1 strong area and 1 area for development."
    )
    
    # Some integrity concerns
    integrity_events = [
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=45)).isoformat(),
            event_type="tab_switch",
            severity="medium",
            context="Switched to external browser tab during coding question"
        ),
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=30)).isoformat(),
            event_type="paste_detected",
            severity="high",
            context="Paste event detected in code editor"
        )
    ]
    
    for event in integrity_events:
        db.log_integrity_event(candidate.id, event)
    
    integrity_evidence = IntegrityEvidence(
        total_violations=2,
        events=integrity_events,
        severity_score=5,
        trustworthiness_rating="Medium"
    )
    candidate.integrity_evidence = integrity_evidence
    
    # Generate decision
    decision = decision_engine.generate_decision(
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        resume_evidence=candidate.resume_evidence,
        code_evidence=candidate.code_evidence,
        mcq_evidence=candidate.mcq_evidence,
        psychometric_evidence=candidate.psychometric_evidence,
        integrity_evidence=integrity_evidence
    )
    
    candidate.final_decision = decision
    candidate.completed_at = datetime.now().isoformat()
    db.save_candidate(candidate)
    
    return {"id": candidate.id, "name": candidate.name, "outcome": decision.outcome}


def seed_charlie_reject(db, decision_engine):
    """
    Charlie: Weak candidate - should be NO_HIRE
    Low scores, integrity violations
    """
    candidate = CandidateProfile(
        id="demo_charlie",
        name="Charlie Davis",
        email="charlie.davis@example.com",
        job_title="Junior Developer",
        status="completed",
        created_at=(datetime.now() - timedelta(hours=4)).isoformat()
    )
    
    # Poor resume match with missing critical skill
    candidate.resume_evidence = ResumeEvidence(
        skills_extracted=["html", "css"],
        jd_required=["python", "javascript", "react", "docker", "kubernetes", "postgresql"],
        match_score=0.0,
        reasoning="Found 0/6 required skills (0% match). ⚠️ Missing critical skills: python. No relevant experience detected.",
        missing_critical=["python"],
        experience_years=None,
        education="Bachelor's"
    )
    
    # Poor coding performance
    candidate.code_evidence = [
        CodeExecutionEvidence(
            question_id="q1_fibonacci",
            question_title="Fibonacci Number",
            language="python",
            submitted_code="def solution(n):\n    return n",
            test_cases=[
                TestCaseResult(input="0", expected="0", actual="0", passed=True, time_ms=20),
                TestCaseResult(input="1", expected="1", actual="1", passed=True, time_ms=18),
                TestCaseResult(input="5", expected="5", actual="5", passed=True, time_ms=19),
                TestCaseResult(input="10", expected="55", actual="10", passed=False, time_ms=17),
                TestCaseResult(input="15", expected="610", actual="15", passed=False, time_ms=18),
            ],
            pass_rate=60.0,
            avg_time_ms=18.4,
            total_tests=5
        ),
        CodeExecutionEvidence(
            question_id="q2_palindrome",
            question_title="Palindrome Check",
            language="python",
            submitted_code="def solution(s):\n    return True",
            test_cases=[
                TestCaseResult(input="racecar", expected="True", actual="True", passed=True, time_ms=15),
                TestCaseResult(input="hello", expected="False", actual="True", passed=False, time_ms=14),
                TestCaseResult(input="a", expected="True", actual="True", passed=True, time_ms=13),
                TestCaseResult(input="abba", expected="True", actual="True", passed=True, time_ms=14),
            ],
            pass_rate=75.0,
            avg_time_ms=14.0,
            total_tests=4
        )
    ]
    
    # Poor MCQ performance
    candidate.mcq_evidence = [
        MCQEvidence(
            question_id="mcq1",
            question_text="Your team disagrees on implementation approach. What do you do?",
            competency="Collaboration",
            selected_option="A",
            correct_option="B",
            is_correct=False
        ),
        MCQEvidence(
            question_id="mcq2",
            question_text="Critical bug discovered 1 hour before deployment. What do you do?",
            competency="Problem Solving",
            selected_option="B",  # Wrong - deploy anyway
            correct_option="C",
            is_correct=False
        ),
        MCQEvidence(
            question_id="mcq3",
            question_text="A colleague's code has obvious issues. How do you approach code review?",
            competency="Communication",
            selected_option="A",  # Wrong - approve without comment
            correct_option="C",
            is_correct=False
        )
    ]
    
    # Weak psychometric profile
    candidate.psychometric_evidence = PsychometricEvidence(
        competencies={
            "resilience": 4,
            "leadership": 3,
            "learning": 4,
            "teamwork": 5,
            "pressure": 3
        },
        weak_areas=["resilience", "leadership", "learning", "pressure"],
        strong_areas=[],
        interpretation="Self-assessment shows 0 strong areas and 4 areas for development."
    )
    
    # Major integrity violations
    integrity_events = [
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=50)).isoformat(),
            event_type="tab_switch",
            severity="medium",
            context="Switched to Stack Overflow"
        ),
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=45)).isoformat(),
            event_type="tab_switch",
            severity="medium",
            context="Switched to GPT chat"
        ),
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=40)).isoformat(),
            event_type="paste_detected",
            severity="high",
            context="Large code block pasted"
        ),
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=35)).isoformat(),
            event_type="no_face",
            severity="high",
            context="No face detected for 30 seconds"
        ),
        IntegrityEvent(
            timestamp=(datetime.now() - timedelta(minutes=25)).isoformat(),
            event_type="multiple_faces",
            severity="critical",
            context="Multiple faces detected in webcam"
        )
    ]
    
    for event in integrity_events:
        db.log_integrity_event(candidate.id, event)
    
    integrity_evidence = IntegrityEvidence(
        total_violations=5,
        events=integrity_events,
        severity_score=13,
        trustworthiness_rating="Low"
    )
    candidate.integrity_evidence = integrity_evidence
    
    # Generate decision
    decision = decision_engine.generate_decision(
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        resume_evidence=candidate.resume_evidence,
        code_evidence=candidate.code_evidence,
        mcq_evidence=candidate.mcq_evidence,
        psychometric_evidence=candidate.psychometric_evidence,
        integrity_evidence=integrity_evidence
    )
    
    candidate.final_decision = decision
    candidate.completed_at = datetime.now().isoformat()
    db.save_candidate(candidate)
    
    return {"id": candidate.id, "name": candidate.name, "outcome": decision.outcome}


if __name__ == "__main__":
    from database import Database
    from decision_engine import ExplainableDecisionEngine
    
    db = Database()
    engine = ExplainableDecisionEngine(use_gemini=False)  # Use fallback for seeding
    
    results = seed_all_demos(db, engine)
    
    print("\n=== Demo Data Seeded ===")
    for r in results:
        print(f"  ✓ {r['name']} ({r['id']}): {r['outcome']}")
    
    print("\nView candidates at:")
    print("  http://localhost:8000/api/candidates")
    print("\nView individual reports at:")
    for r in results:
        print(f"  http://localhost:5173/recruiter/{r['id']}")
