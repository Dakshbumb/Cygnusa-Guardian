# 📚 Cygnusa Guardian - API Reference

Complete documentation of all REST API endpoints.

---

## Base URL

| Environment | URL |
|------------|-----|
| Local Development | `http://localhost:8000` |
| Production | `https://cygnusa-guardian.onrender.com` |

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Obtain a token via the `/api/login` endpoint.

---

## Endpoints

### Health & Info

#### `GET /`
Returns API welcome message and version.

**Response:**
```json
{
  "message": "Welcome to Cygnusa Guardian API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

#### `GET /api/health`
Returns detailed system health status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "ai_provider": "gemini",
  "timestamp": "2026-02-06T10:00:00Z"
}
```

---

### Authentication

#### `POST /api/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "recruiter"  // "candidate" | "recruiter" | "admin"
}
```

**Response:**
```json
{
  "user_id": "usr_123abc",
  "role": "recruiter",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "name": "John Doe"
}
```

---

#### `GET /api/me`
Get current authenticated user info.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "role": "recruiter",
  "name": "John Doe"
}
```

---

### Candidate Management

#### `GET /api/candidates`
List all candidates (Recruiter only).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`)

**Response:**
```json
[
  {
    "id": "cand_123",
    "name": "Alice Chen",
    "email": "alice@example.com",
    "status": "completed",
    "job_title": "Software Engineer",
    "created_at": "2026-02-06T10:00:00Z"
  }
]
```

---

#### `GET /api/candidate/{candidate_id}`
Get detailed candidate profile with all evidence.

**Response:**
```json
{
  "id": "cand_123",
  "name": "Alice Chen",
  "email": "alice@example.com",
  "status": "completed",
  "resume_evidence": { /* ResumeEvidence model */ },
  "code_evidence": [ /* CodeExecutionEvidence[] */ ],
  "mcq_evidence": [ /* MCQEvidence[] */ ],
  "integrity_evidence": { /* IntegrityEvidence model */ },
  "final_decision": { /* FinalDecision model */ }
}
```

---

#### `POST /api/candidate`
Create a new candidate profile.

**Headers:** `Authorization: Bearer <token>` (Recruiter only)

**Form Data:**
- `name` (required): Candidate name
- `email` (required): Candidate email
- `job_title` (optional): Target job title

**Response:**
```json
{
  "id": "cand_new123",
  "name": "New Candidate",
  "status": "pending"
}
```

---

#### `DELETE /api/candidate/{candidate_id}`
Delete a candidate and all associated data.

**Headers:** `Authorization: Bearer <token>` (Recruiter only)

---

### Resume Analysis

#### `POST /api/validate-resume`
Quick resume validation without saving.

**Form Data:**
- `file` (required): PDF or DOCX resume file

**Response:**
```json
{
  "is_valid": true,
  "file_type": "application/pdf",
  "page_count": 2,
  "word_count": 650,
  "warnings": []
}
```

---

#### `POST /api/analyze-resume`
Full resume analysis with skill extraction and matching.

**Form Data:**
- `file` (required): Resume file
- `job_title` (optional): Target job title
- `jd_skills` (optional): Comma-separated required skills
- `critical_skills` (optional): Comma-separated must-have skills

**Response:**
```json
{
  "candidate_id": "cand_123",
  "resume_evidence": {
    "skills_extracted": ["python", "javascript", "react"],
    "jd_required": ["python", "javascript", "react", "docker"],
    "match_score": 75.0,
    "reasoning": "Matched 3 of 4 required skills",
    "missing_critical": ["docker"]
  }
}
```

---

#### `GET /api/roles`
List available job roles for resume matching.

**Response:**
```json
{
  "roles": [
    {
      "id": "software_engineer",
      "title": "Software Engineer",
      "required_skills": ["python", "javascript"],
      "critical_skills": ["problem_solving"]
    }
  ]
}
```

---

### Assessment

#### `GET /api/coding-questions`
Get available coding questions.

**Response:**
```json
{
  "questions": [
    {
      "id": "two_sum",
      "title": "Two Sum",
      "difficulty": "easy",
      "description": "Given an array of integers...",
      "examples": [...]
    }
  ]
}
```

---

#### `POST /api/submit-code`
Submit code for execution and grading.

**Request Body:**
```json
{
  "candidate_id": "cand_123",
  "question_id": "two_sum",
  "code": "def two_sum(nums, target): ...",
  "language": "python"
}
```

**Response:**
```json
{
  "question_id": "two_sum",
  "pass_rate": 100.0,
  "test_cases": [
    {
      "input": "[2,7,11,15], 9",
      "expected": "[0,1]",
      "actual": "[0,1]",
      "passed": true,
      "time_ms": 1.2
    }
  ],
  "avg_time_ms": 1.2
}
```

---

#### `GET /api/mcq-questions`
Get MCQ assessment questions.

**Response:**
```json
{
  "questions": [
    {
      "id": "mcq_1",
      "question_text": "What is the time complexity of binary search?",
      "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      "competency": "Algorithms"
    }
  ]
}
```

---

#### `POST /api/submit-mcq`
Submit MCQ answers.

**Request Body:**
```json
{
  "candidate_id": "cand_123",
  "answers": [
    {"question_id": "mcq_1", "selected_option": "O(log n)"}
  ]
}
```

---

### Proctoring & Integrity

#### `POST /api/violation`
Log an integrity violation event.

**Request Body:**
```json
{
  "candidate_id": "cand_123",
  "event_type": "tab_switch",
  "severity": "medium",
  "context": "Switched to another browser tab",
  "timestamp": "2026-02-06T10:05:00Z"
}
```

---

#### `POST /api/snapshot`
Upload a webcam snapshot.

**Form Data:**
- `candidate_id` (required): Candidate ID
- `image` (required): Base64 encoded image or file

---

### Decision & Export

#### `GET /api/decision/{candidate_id}`
Get the final hiring decision for a candidate.

**Response:**
```json
{
  "candidate_id": "cand_123",
  "outcome": "HIRE",
  "confidence": "high",
  "reasoning": [
    "Excellent technical skills with 100% code pass rate",
    "Strong alignment with job requirements (85% match)",
    "No integrity concerns detected"
  ],
  "counterfactuals": [
    {
      "factor": "Code Pass Rate",
      "current": "100%",
      "change_needed": "N/A - already optimal"
    }
  ],
  "audit_trail": {
    "prompt_sent": "...",
    "ai_response": "...",
    "generated_at": "2026-02-06T12:00:00Z"
  }
}
```

---

#### `GET /api/export-case/{candidate_id}`
Download complete candidate case file.

**Response:** JSON file download with all evidence and decisions.

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Invalid request format |
| 500 | Internal Server Error |

---

## Rate Limits

- **Development:** No limits
- **Production:** 100 requests/minute per IP

---

## OpenAPI Documentation

Interactive API documentation is available at:
- Swagger UI: `/docs`
- ReDoc: `/redoc`
