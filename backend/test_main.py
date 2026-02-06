"""
Cygnusa Guardian - API Unit Tests
Comprehensive test suite for core API endpoints

Run with: pytest test_main.py -v
"""

import pytest
from unittest.mock import patch, MagicMock
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import (
    UserRole, LoginRequest, CandidateProfile, ResumeEvidence,
    IntegrityEvidence, IntegrityEvent, MCQEvidence, CodeExecutionEvidence,
    TestCaseResult, FinalDecision
)


# ===========================================
# Test Client Setup (Lazy Loading)
# ===========================================

_client = None

def get_client():
    """Lazy load TestClient to avoid import-time issues"""
    global _client
    if _client is None:
        from fastapi.testclient import TestClient
        from main import app
        _client = TestClient(app)
    return _client


# ===========================================
# Health & Info Endpoint Tests
# ===========================================

class TestHealthEndpoints:
    """Tests for application health and info endpoints"""
    
    def test_root_endpoint(self):
        """Test API root returns welcome message"""
        response = get_client().get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "Cygnusa Guardian" in data["service"]
        assert "status" in data
    
    def test_health_check(self):
        """Test health check endpoint returns system status"""
        response = get_client().get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "degraded"]
        assert "database" in data
        assert "timestamp" in data


# ===========================================
# Authentication Endpoint Tests
# ===========================================

class TestAuthenticationEndpoints:
    """Tests for authentication endpoints"""
    
    def test_login_as_recruiter(self):
        """Test login as recruiter role"""
        response = get_client().post("/api/auth/login", json={
            "email": "test_recruiter@example.com",
            "role": "recruiter"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "recruiter"
        assert "user_id" in data
    
    def test_login_as_candidate(self):
        """Test login as candidate role"""
        response = get_client().post("/api/auth/login", json={
            "email": "test_candidate@example.com",
            "role": "candidate"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "candidate"
    
    def test_login_invalid_role(self):
        """Test login with invalid role returns error"""
        response = get_client().post("/api/auth/login", json={
            "email": "test@example.com",
            "role": "invalid_role"
        })
        assert response.status_code == 422  # Validation error
    
    def test_get_me_without_token(self):
        """Test /me endpoint without authentication"""
        response = get_client().get("/api/auth/me")
        assert response.status_code == 401


# ===========================================
# Candidate Management Tests
# ===========================================

class TestCandidateEndpoints:
    """Tests for candidate management endpoints"""
    
    @pytest.fixture
    def recruiter_token(self):
        """Get a valid recruiter token for authenticated requests"""
        response = get_client().post("/api/auth/login", json={
            "email": "pytest_recruiter@test.com",
            "role": "recruiter"
        })
        return response.json()["token"]
    
    def test_list_candidates_unauthorized(self):
        """Test listing candidates without authentication"""
        response = get_client().get("/api/candidates")
        assert response.status_code == 401
    
    def test_list_candidates_authorized(self, recruiter_token):
        """Test listing candidates with valid recruiter token"""
        response = get_client().get(
            "/api/candidates",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "candidates" in data
        assert "total" in data
    
    def test_get_nonexistent_candidate(self, recruiter_token):
        """Test getting a candidate that doesn't exist"""
        response = get_client().get(
            "/api/candidates/nonexistent_id_12345",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 404


# ===========================================
# Resume Validation Tests
# ===========================================

class TestResumeEndpoints:
    """Tests for resume upload and validation endpoints"""
    
    def test_validate_resume_no_file(self):
        """Test resume validation without file returns error"""
        response = get_client().post("/api/resume/validate")
        assert response.status_code == 422  # Missing required file
    
    def test_list_roles(self):
        """Test listing available job roles"""
        response = get_client().get("/api/roles")
        assert response.status_code == 200
        # Returns array or object with roles
        data = response.json()
        assert isinstance(data, (list, dict))


# ===========================================
# Model Validation Tests
# ===========================================

class TestModelValidation:
    """Tests for Pydantic model validation"""
    
    def test_login_request_model(self):
        """Test LoginRequest model validation"""
        request = LoginRequest(email="test@example.com", role=UserRole.CANDIDATE)
        assert request.email == "test@example.com"
        assert request.role == UserRole.CANDIDATE
    
    def test_integrity_event_model(self):
        """Test IntegrityEvent model creation"""
        event = IntegrityEvent(
            timestamp="2026-02-06T10:00:00",
            event_type="tab_switch",
            severity="medium",
            context="Switched to browser tab"
        )
        assert event.event_type == "tab_switch"
        assert event.severity == "medium"
    
    def test_integrity_evidence_model(self):
        """Test IntegrityEvidence model with events"""
        evidence = IntegrityEvidence(
            total_violations=2,
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
            severity_score=45.0,
            trustworthiness_rating="Medium"
        )
        assert evidence.total_violations == 2
        assert len(evidence.events) == 2
        assert evidence.trustworthiness_rating == "Medium"
    
    def test_test_case_result_model(self):
        """Test TestCaseResult model with partial credit"""
        result = TestCaseResult(
            input="[1, 2, 3]",
            expected="6",
            actual="6",
            passed=True,
            time_ms=1.5,
            similarity_score=100.0,
            partial_credit=False
        )
        assert result.passed == True
        assert result.similarity_score == 100.0
    
    def test_mcq_evidence_model(self):
        """Test MCQEvidence model creation"""
        evidence = MCQEvidence(
            question_id="mcq_1",
            question_text="What is the time complexity of binary search?",
            competency="Algorithms",
            selected_option="O(log n)",
            correct_option="O(log n)",
            is_correct=True
        )
        assert evidence.is_correct == True
        assert evidence.competency == "Algorithms"
    
    def test_final_decision_model(self):
        """Test FinalDecision model with all fields"""
        decision = FinalDecision(
            candidate_id="test_123",
            outcome="HIRE",
            confidence="high",
            reasoning=["Strong technical skills", "Good communication"],
            role_fit="Senior Developer",
            next_steps="Schedule onsite interview"
        )
        assert decision.outcome == "HIRE"
        assert len(decision.reasoning) == 2


# ===========================================
# Error Handling Tests
# ===========================================

class TestErrorHandling:
    """Tests for API error handling"""
    
    def test_invalid_json_body(self):
        """Test handling of invalid JSON in request body"""
        response = get_client().post(
            "/api/auth/login",
            content="not valid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_missing_required_fields(self):
        """Test handling of missing required fields"""
        response = get_client().post("/api/auth/login", json={"email": "test@example.com"})
        # Missing 'role' field
        assert response.status_code == 422


# ===========================================
# Integration Tests
# ===========================================

class TestIntegration:
    """Integration tests for complete workflows"""
    
    def test_recruiter_workflow(self):
        """Test complete recruiter login and candidate listing workflow"""
        client = get_client()
        
        # Step 1: Login as recruiter
        login_response = client.post("/api/auth/login", json={
            "email": "integration_test_recruiter@test.com",
            "role": "recruiter"
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Step 2: List candidates
        list_response = client.get(
            "/api/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert list_response.status_code == 200
        
        # Step 3: Get health status
        health_response = client.get("/api/health")
        assert health_response.status_code == 200


# ===========================================
# Run Tests
# ===========================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
