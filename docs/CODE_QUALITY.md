# 🏆 Code Quality Standards

This document outlines the coding standards and quality measures implemented in Cygnusa Guardian.

---

## Architecture Principles

### 1. Three-Tier Separation

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Presentation   │ ──► │   Application   │ ──► │      Data       │
│   (React/Vite)  │     │   (FastAPI)     │     │   (Supabase)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Frontend:** React components, no business logic
- **Backend:** All business logic, validation, and AI orchestration
- **Data Layer:** Abstracted via `database.py`, supports SQLite/PostgreSQL

### 2. Single Responsibility

Each module has a focused purpose:

| Module | Responsibility |
|--------|---------------|
| `main.py` | API routing and request handling | 
| `decision_engine.py` | AI decision logic and transparency |
| `code_executor.py` | Secure code sandbox execution |
| `resume_parser.py` | Resume parsing and skill extraction |
| `database.py` | Data persistence abstraction |
| `models.py` | Data structure definitions |
| `config.py` | Centralized configuration |

---

## Code Style

### Python (Backend)

- **Style Guide:** PEP 8 compliant
- **Type Hints:** Used for function parameters and returns
- **Docstrings:** Google-style for all public functions

```python
def calculate_match_score(
    extracted_skills: List[str],
    required_skills: List[str],
    critical_skills: Optional[List[str]] = None
) -> float:
    """
    Calculate the skill match percentage.
    
    Args:
        extracted_skills: Skills found in the resume
        required_skills: Skills required by the job description
        critical_skills: Must-have skills (weighted higher)
    
    Returns:
        Match percentage as a float between 0 and 100
    
    Example:
        >>> calculate_match_score(["python", "react"], ["python", "react", "docker"])
        66.67
    """
```

### JavaScript/React (Frontend)

- **Formatting:** Consistent indentation (2 spaces)
- **Components:** Functional components with hooks
- **Naming:** PascalCase for components, camelCase for functions

```javascript
/**
 * Displays candidate integrity monitoring status
 * @param {Object} props - Component props
 * @param {string} props.candidateId - Unique candidate identifier
 * @param {boolean} props.isActive - Whether monitoring is active
 */
const IntegrityMonitor = ({ candidateId, isActive }) => {
  // Implementation
};
```

---

## Error Handling

### Backend Error Pattern

All errors are caught and returned with proper HTTP status codes:

```python
@app.get("/api/candidate/{candidate_id}")
async def get_candidate(candidate_id: str):
    try:
        candidate = db.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return candidate
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### Frontend Error Handling

API calls use try-catch with user-friendly error messages:

```javascript
const fetchCandidate = async (id) => {
  try {
    const response = await api.get(`/candidate/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch candidate:', error);
    showToast('Unable to load candidate data. Please try again.');
    return null;
  }
};
```

---

## Security Practices

### 1. Input Validation

All inputs are validated using Pydantic models:

```python
class LoginRequest(BaseModel):
    email: str = Field(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    role: UserRole
```

### 2. Authentication

- JWT-based authentication
- Role-based access control (Candidate, Recruiter, Admin)
- Token expiration after 24 hours

### 3. Code Sandbox Security

```python
BANNED_IMPORTS = [
    "os", "sys", "subprocess", "shutil", 
    "socket", "requests", "urllib"
]
EXECUTION_TIMEOUT = 10  # seconds
```

### 4. SQL Injection Prevention

Using SQLAlchemy ORM with parameterized queries.

---

## Testing Strategy

### Unit Tests

Located in `backend/test_*.py`:

- `test_main.py` - API endpoint tests
- `test_decision_engine.py` - Decision logic tests

Run tests:
```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest -v
```

### Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| API Endpoints | 80%+ |
| Decision Engine | 90%+ |
| Models | 100% |

---

## Logging

Structured logging throughout the application:

```python
import logging

logger = logging.getLogger(__name__)

# Log levels used appropriately
logger.debug("Detailed debug info")
logger.info("Normal operation")
logger.warning("Something unexpected")
logger.error("Error occurred", exc_info=True)
```

Logs are written to `cygnusa_guardian.log`.

---

## Configuration Management

All configuration centralized in `config.py`:

```python
from config import settings

# Usage
database_url = settings.DATABASE_URL
api_key = settings.GEMINI_API_KEY

# Check availability
if settings.has_gemini():
    # Use Gemini AI
```

Environment variables:
- `DATABASE_URL` - Database connection string
- `GEMINI_API_KEY` - Google AI API key
- `JWT_SECRET` - Token signing secret
- `SUPABASE_URL` / `SUPABASE_KEY` - Supabase credentials

---

## Documentation

### Code Comments

- All public functions have docstrings
- Complex logic has inline comments
- TODO/FIXME markers for known issues

### Project Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and quick start |
| `docs/ARCHITECTURE.md` | System design and data flow |
| `docs/API_REFERENCE.md` | Complete API documentation |
| `docs/FEATURES.md` | Feature descriptions |
| `docs/SECURITY_ANTICHEAT.md` | Security implementation |

---

## Performance Optimizations

### Backend

- Response caching for dashboard endpoints (30s TTL)
- Database query optimization with indexes
- GZip compression for large responses
- Lazy loading of AI models

### Frontend

- Code splitting with React.lazy()
- Optimistic UI updates
- Debounced API calls for search/filter

---

## Code Review Checklist

Before merging, verify:

- [ ] Type hints on all new functions
- [ ] Docstrings on public functions
- [ ] Error handling for edge cases
- [ ] No hardcoded secrets or credentials
- [ ] Unit tests for new functionality
- [ ] Documentation updated if needed
