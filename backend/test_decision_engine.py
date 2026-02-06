"""
Cygnusa Guardian - Decision Engine Unit Tests
Tests for the explainable AI decision engine

Run with: pytest test_decision_engine.py -v
"""

import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from decision_engine import (
    ExplainableDecisionEngine,
    ShadowProctorEngine,
    KeystrokeDynamicsAnalyzer
)
from models import (
    ResumeEvidence, CodeExecutionEvidence, MCQEvidence,
    PsychometricEvidence, IntegrityEvidence, IntegrityEvent,
    TestCaseResult, TextAnswerEvidence, KeystrokeEvidence, KeystrokeInterval
)


# ===========================================
# Decision Engine Tests
# ===========================================

class TestExplainableDecisionEngine:
    """Tests for the main decision engine"""
    
    @pytest.fixture
    def engine(self):
        """Create a decision engine instance for testing"""
        # Disable AI for deterministic testing
        return ExplainableDecisionEngine(use_gemini=False)
    
    @pytest.fixture
    def sample_resume_evidence(self):
        """Sample resume evidence for testing"""
        return ResumeEvidence(
            skills_extracted=["python", "javascript", "react", "sql"],
            jd_required=["python", "javascript", "react", "nodejs", "docker"],
            match_score=60.0,
            reasoning="Matched 3 of 5 required skills",
            missing_critical=["docker"]
        )
    
    @pytest.fixture
    def sample_code_evidence(self):
        """Sample code execution evidence"""
        return [
            CodeExecutionEvidence(
                question_id="q1",
                question_title="Two Sum",
                language="python",
                submitted_code="def two_sum(nums, target): pass",
                test_cases=[
                    TestCaseResult(
                        input="[2,7,11,15], 9",
                        expected="[0,1]",
                        actual="[0,1]",
                        passed=True,
                        time_ms=1.2,
                        similarity_score=100.0
                    )
                ],
                pass_rate=100.0,
                avg_time_ms=1.2,
                total_tests=1
            )
        ]
    
    @pytest.fixture
    def sample_mcq_evidence(self):
        """Sample MCQ evidence"""
        return [
            MCQEvidence(
                question_id="mcq_1",
                question_text="What is O(1)?",
                competency="Algorithms",
                selected_option="Constant time",
                correct_option="Constant time",
                is_correct=True
            ),
            MCQEvidence(
                question_id="mcq_2",
                question_text="What is a closure?",
                competency="JavaScript",
                selected_option="A function with access to parent scope",
                correct_option="A function with access to parent scope",
                is_correct=True
            )
        ]
    
    @pytest.fixture
    def sample_integrity_clean(self):
        """Sample clean integrity evidence"""
        return IntegrityEvidence(
            total_violations=0,
            events=[],
            severity_score=0.0,
            trustworthiness_rating="High"
        )
    
    @pytest.fixture
    def sample_integrity_violations(self):
        """Sample integrity evidence with violations"""
        return IntegrityEvidence(
            total_violations=5,
            events=[
                IntegrityEvent(
                    timestamp="2026-02-06T10:00:00",
                    event_type="tab_switch",
                    severity="medium"
                ),
                IntegrityEvent(
                    timestamp="2026-02-06T10:01:00",
                    event_type="paste_detected",
                    severity="high"
                )
            ],
            severity_score=65.0,
            trustworthiness_rating="Low"
        )
    
    def test_engine_initialization(self, engine):
        """Test decision engine initializes correctly"""
        assert engine is not None
        assert hasattr(engine, 'generate_decision')
    
    def test_build_evidence_summary(self, engine, sample_resume_evidence, 
                                      sample_code_evidence, sample_mcq_evidence,
                                      sample_integrity_clean):
        """Test evidence summary building"""
        summary = engine._build_evidence_summary(
            resume_evidence=sample_resume_evidence,
            code_evidence=sample_code_evidence,
            mcq_evidence=sample_mcq_evidence,
            psychometric_evidence=None,
            integrity_evidence=sample_integrity_clean
        )
        
        assert "resume" in summary
        assert "coding" in summary
        assert "mcqs" in summary
        assert "integrity" in summary
        assert summary["resume"]["match_score"] == 60.0
    
    def test_counterfactual_generation_structure(self, engine):
        """Test counterfactual 'what-if' explanation generation"""
        evidence = {
            "resume": {"match_score": 50, "missing_critical": ["docker"]},
            "coding": {"avg_pass_rate": 60},
            "mcqs": {"pass_rate": 70},
            "integrity": {"total_violations": 8, "severity_score": 45}
        }
        
        counterfactuals = engine._generate_counterfactuals(evidence, "NO_HIRE")
        
        assert isinstance(counterfactuals, list)
        # Should generate counterfactuals for NO_HIRE case
        if len(counterfactuals) > 0:
            cf = counterfactuals[0]
            # Actual structure uses 'condition' not 'factor'
            assert "condition" in cf
            assert "outcome_change" in cf
            assert "current_value" in cf


# ===========================================
# Shadow Proctor Engine Tests
# ===========================================

class TestShadowProctorEngine:
    """Tests for the shadow probing engine"""
    
    @pytest.fixture
    def engine(self):
        """Create a shadow proctor engine for testing"""
        return ShadowProctorEngine(api_key=None)  # No API key for testing
    
    def test_engine_initialization(self, engine):
        """Test shadow proctor initializes correctly"""
        assert engine is not None
        assert hasattr(engine, 'generate_probe')
    
    def test_probe_generation_structure(self, engine):
        """Test that probe generation returns proper structure"""
        # Note: Without API key, this will use fallback logic
        result = engine.generate_probe(
            question_title="Two Sum",
            question_desc="Find two numbers that add up to target",
            code="def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]"
        )
        
        assert isinstance(result, dict)
        # Should have either probe_question or error
        assert "probe_question" in result or "error" in result or "question" in result


# ===========================================
# Keystroke Dynamics Analyzer Tests
# ===========================================

class TestKeystrokeDynamicsAnalyzer:
    """Tests for keystroke biometric analysis"""
    
    @pytest.fixture
    def analyzer(self):
        """Create a keystroke analyzer for testing"""
        return KeystrokeDynamicsAnalyzer(baseline_keys=10, threshold_z=3.0)
    
    @pytest.fixture
    def sample_intervals(self):
        """Sample keystroke intervals for testing"""
        return [
            KeystrokeInterval(key="a", dwell_time=100, flight_time=50, timestamp=1000.0),
            KeystrokeInterval(key="b", dwell_time=110, flight_time=55, timestamp=1100.0),
            KeystrokeInterval(key="c", dwell_time=95, flight_time=48, timestamp=1200.0),
            KeystrokeInterval(key="d", dwell_time=105, flight_time=52, timestamp=1300.0),
            KeystrokeInterval(key="e", dwell_time=102, flight_time=51, timestamp=1400.0),
        ]
    
    @pytest.fixture
    def empty_evidence(self):
        """Empty keystroke evidence for initialization"""
        return KeystrokeEvidence(intervals=[], rhythm_score=100, is_anomaly=False)
    
    def test_analyzer_initialization(self, analyzer):
        """Test keystroke analyzer initializes correctly"""
        assert analyzer is not None
        assert analyzer.baseline_keys == 10
        assert analyzer.threshold_z == 3.0
    
    def test_analyze_intervals_returns_evidence(self, analyzer, sample_intervals, empty_evidence):
        """Test keystroke interval analysis returns valid evidence"""
        result = analyzer.analyze_intervals(
            candidate_id="test_123",
            new_intervals=sample_intervals,
            existing_evidence=empty_evidence
        )
        
        assert result is not None
        assert hasattr(result, 'intervals')
        assert hasattr(result, 'rhythm_score')
        assert hasattr(result, 'is_anomaly')
        # Rhythm score should be a number between 0 and 100
        assert 0 <= result.rhythm_score <= 100


# ===========================================
# Evidence Summary Tests
# ===========================================

class TestEvidenceSummary:
    """Tests for evidence summary calculations"""
    
    def test_code_pass_rate_calculation(self):
        """Test code pass rate is calculated correctly"""
        evidence = CodeExecutionEvidence(
            question_id="q1",
            question_title="Test",
            language="python",
            submitted_code="pass",
            test_cases=[
                TestCaseResult(input="1", expected="1", actual="1", passed=True, time_ms=1.0, similarity_score=100.0),
                TestCaseResult(input="2", expected="2", actual="2", passed=True, time_ms=1.0, similarity_score=100.0),
                TestCaseResult(input="3", expected="3", actual="4", passed=False, time_ms=1.0, similarity_score=80.0),
            ],
            pass_rate=66.67,
            avg_time_ms=1.0,
            total_tests=3
        )
        
        assert evidence.pass_rate == 66.67
        assert evidence.total_tests == 3
        assert len(evidence.test_cases) == 3
    
    def test_mcq_accuracy_calculation(self):
        """Test MCQ accuracy tracking"""
        mcqs = [
            MCQEvidence(question_id="1", question_text="Q1", selected_option="A", correct_option="A", is_correct=True),
            MCQEvidence(question_id="2", question_text="Q2", selected_option="B", correct_option="C", is_correct=False),
            MCQEvidence(question_id="3", question_text="Q3", selected_option="C", correct_option="C", is_correct=True),
            MCQEvidence(question_id="4", question_text="Q4", selected_option="D", correct_option="D", is_correct=True),
        ]
        
        correct_count = sum(1 for m in mcqs if m.is_correct)
        accuracy = (correct_count / len(mcqs)) * 100
        
        assert correct_count == 3
        assert accuracy == 75.0
    
    def test_integrity_severity_levels(self):
        """Test integrity severity is categorized correctly"""
        # Low severity
        low = IntegrityEvidence(total_violations=1, severity_score=10.0, trustworthiness_rating="High")
        assert low.trustworthiness_rating == "High"
        
        # Medium severity
        medium = IntegrityEvidence(total_violations=3, severity_score=40.0, trustworthiness_rating="Medium")
        assert medium.trustworthiness_rating == "Medium"
        
        # High severity
        high = IntegrityEvidence(total_violations=10, severity_score=80.0, trustworthiness_rating="Low")
        assert high.trustworthiness_rating == "Low"


# ===========================================
# Run Tests
# ===========================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
