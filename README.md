<div align="center">

<img src="assets/logo.png" alt="Cygnusa Guardian" width="140"/>

# Cygnusa Guardian

**Forensic Hiring Intelligence Platform — Glass-Box Decision Engine**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Tests](https://img.shields.io/badge/Tests-55%20passing-059669?style=flat-square&logo=pytest)](backend/test_main.py)

</div>

---

## What Is This?

Cygnusa Guardian is a production-grade **forensic hiring SaaS platform** that replaces opaque AI scoring with **fully auditable, explainable hiring decisions**. Every recommendation — HIRE, NO_HIRE, or CONDITIONAL — is backed by traceable evidence, weighted decision trees, counterfactual analysis, and a complete forensic audit trail.

The platform manages the entire end-to-end hiring pipeline:

- 📄 **Resume forensics** — skill extraction, claim probing, credential verification
- 💻 **Live coding assessment** — sandboxed execution, keystroke biometrics, AI shadow probing
- 🧠 **MCQ + psychometric evaluation** — timed, proctored, with stress-response analysis
- 👁️ **Real-time proctoring** — webcam monitoring, tab-switch detection, copy-paste blocking
- ⚖️ **XAI decision engine** — structured Glass-Box verdicts with full evidentiary mapping
- 📊 **Recruiter intelligence center** — forensic reports, integrity logs, bulk ops

**Core principle:** The AI never produces a hidden score. All evidence is pre-calculated, verified, and passed verbatim to the reasoning engine. The raw prompt, raw response, and every decision path are stored and viewable in the audit trail.

---

## User Flow

```
Landing Page (/)
     │
     ├──► Recruiter Portal (/login?role=recruiter)
     │         │
     │         └──► Dashboard (/recruiter/dashboard)
     │                  │
     │                  ├──► Forensic Report (/recruiter/:candidateId)
     │                  └──► Live Monitor (/monitor)
     │
     └──► Candidate Portal (/login?role=candidate)
               │
               └──► Resume Upload (/resume-analysis)
                        │
                        └──► Assessment (/candidate/:id)
                                  │
                                  ├── Coding Challenge
                                  ├── MCQ Evaluation
                                  ├── Reasoning Test
                                  └── Psychometric Profile
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                        │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ Landing  │ │  Candidate   │ │  Recruiter  │ │ Live Monitor  │  │
│  │  Page    │ │  Assessment  │ │  Dashboard  │ │     Page      │  │
│  └──────────┘ └──────────────┘ └─────────────┘ └───────────────┘  │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │  IntegrityMonitor · WebcamProctor · ShadowProber · Monaco    │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST API (JSON + JWT)
┌────────────────────────────────┴────────────────────────────────────┐
│                      SERVER (FastAPI + Uvicorn)                     │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │  Auth    │ │   Resume     │ │  Assessment │ │  Integrity    │  │
│  │  Router  │ │   Router     │ │   Router    │ │  Router       │  │
│  └──────────┘ └──────────────┘ └─────────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────────────┐   │
│  │Dashboard │ │   Reports    │ │       Core Services           │   │
│  │  Router  │ │   Router     │ │  ResumeParser · CodeExecutor  │   │
│  └──────────┘ └──────────────┘ │  DecisionEngine · Validator   │   │
│                                └──────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────┴───────┐  ┌──────┴──────┐  ┌───────┴────────┐
     │   Supabase     │  │   Google    │  │   SQLite       │
     │   PostgreSQL   │  │  Gemini Pro │  │  (local dev)   │
     └────────────────┘  └─────────────┘  └────────────────┘
```

**Three-tier architecture:**

- **Presentation** — React SPA with lazy-loaded routes, Framer Motion transitions, and client-side integrity hooks
- **Application** — FastAPI with 7 domain routers, Pydantic v2 models, GZip middleware, and structured logging
- **Data & AI** — Supabase PostgreSQL primary, SQLite fallback, Google Gemini Pro for XAI reasoning

---

## Core Modules

### 1. Resume Forensics (`resume_parser.py`)

Extracts skills, education, and work history from PDF/DOCX uploads using `pdfplumber` and `python-docx`. Each matched skill retains its **context snippet** — the exact sentence from the resume proving the claim — so recruiters see evidence, not just a percentage.

Includes a **Claim Probing Engine** that flags suspicious claims (inflated CGPA, vague impact metrics, unverifiable leadership roles) and generates targeted verification questions.

### 2. Sandboxed Code Executor (`code_executor.py`)

| Feature | Detail |
|:--------|:-------|
| Execution timeout | 10 seconds per test case |
| Banned imports | `os`, `subprocess`, `socket`, `requests` blocked at AST level |
| Partial credit | Numeric tolerance bands (1%/5%/10%) + Levenshtein similarity for near-miss outputs |
| Stress timing | Flags rushing (<60s) and overthinking (>15min) per question |

### 3. XAI Decision Engine (`decision_engine.py`, ~1000 LOC)

Three-phase pipeline:

1. **Evidence Aggregation** — All pre-calculated scores collected into a structured `evidence_summary`. No data is hidden from the AI.
2. **Deterministic Gatekeeper** — Auto-reject rules fire first (missing critical skills, ≥5 integrity violations, both resume and coding below 30%). Rule-based decisions require no LLM call.
3. **AI Reasoning** — Transparent prompt built with all raw evidence. LLM returns structured JSON: outcome, confidence, conflict analysis, evidentiary mapping, forensic trace, and cognitive profile.

Every decision includes:
- **Counterfactual explanations** — "If coding score was 70%+, outcome would change from NO_HIRE to HIRE"
- **Transparency token** — unique audit ID linking the decision to stored prompt/response
- **Full audit trail** — exact prompt sent and raw response received, viewable in the recruiter dashboard

### 4. Integrity Monitor (`IntegrityMonitor.jsx`)

Browser-side proctoring system:

| Event | Detection | Severity |
|:------|:----------|:---------|
| Tab switch | `visibilitychange` + `blur` | High |
| Copy/Paste | `clipboard` event interception | High |
| Fullscreen exit | `fullscreenchange` listener | Medium |
| Keyboard shortcuts | `keydown` for Ctrl+C/V/X, Alt+Tab | Medium |
| Typing burst | >40 characters in <300ms | High |
| Banned imports | Real-time AST scan | Critical |

All events are timestamped, streamed to the backend, and surfaced in the recruiter's forensic integrity log.

### 5. Shadow Prober (`ShadowProber.jsx`)

After code submission, the system sends the candidate's implementation to Gemini to generate a **context-aware follow-up question** targeting a specific algorithmic choice (e.g., _"Why did you use a hash map instead of a sorted array on line 12?"_). The candidate must answer immediately — preventing post-hoc rationalization.

### 6. Webcam Proctor (`WebcamProctor.jsx`)

Periodic frame capture every 30 seconds with client-side face detection. Tracks **face detection rate** across the session and flags: no face detected, multiple faces, or candidate leaving frame during high-difficulty questions.

---

## Decision Engine Flow

```
Resume Upload      Coding Assessment      MCQ + Text         Integrity Events
     │                    │                    │                     │
     ▼                    ▼                    ▼                     ▼
┌──────────┐       ┌────────────┐        ┌──────────┐         ┌───────────┐
│  Parse   │       │  Sandbox   │        │  Score   │         │ Aggregate │
│  & Match │       │  Execute   │        │  & Map   │         │  & Weight │
└────┬─────┘       └─────┬──────┘        └────┬─────┘         └─────┬─────┘
     └────────────────────┴─────────────────────┴───────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Deterministic Rules   │──► Auto-reject? ──► Rule-based decision
                        │  (Gatekeeper)          │                     (no LLM call)
                        └───────────┬────────────┘
                                    │ Ambiguous case
                                    ▼
                        ┌───────────────────────┐
                        │  Transparent Prompt    │
                        │  (all evidence inline) │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Gemini Pro / GPT-4    │
                        │  (structured JSON out) │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Parse + Validate +    │
                        │  Generate Counterfacts │
                        │  + Store Audit Trail   │
                        └───────────────────────┘
                                    │
                                    ▼
                            FinalDecision object
                    (outcome · reasoning · evidence map ·
                     counterfactuals · audit trail · token)
```

---

## Tech Stack

| Layer | Technology | Notes |
|:------|:-----------|:------|
| **Frontend** | React 18, Vite, Tailwind CSS | Lazy-loaded routes, fast HMR |
| **UI Design** | Stitch (Google) + Aegis Violet design system | Dark forensic aesthetic, glassmorphism |
| **Animations** | Framer Motion | Page transitions, staggered animations |
| **Code Editor** | Monaco Editor | VS Code engine — syntax highlighting, IntelliSense |
| **Charts** | Chart.js + react-chartjs-2 | Radar charts, timing analysis |
| **Backend** | Python 3.11, FastAPI, Pydantic v2 | Async handlers, auto OpenAPI docs |
| **AI Engine** | Google Gemini Pro (primary), GPT-4 (fallback) | Dual-provider resilience |
| **Database** | Supabase PostgreSQL (primary), SQLite (local) | Managed Postgres + zero-config fallback |
| **Auth** | PyJWT, RBAC | Role-based tokens: recruiter / candidate |
| **PDF Parsing** | pdfplumber, python-docx | Deep text extraction |
| **Deployment** | Vercel (frontend), Render (backend) | Edge CDN for SPA, managed Python runtime |

---

## Project Structure

```
cygnusa-guardian/
├── backend/
│   ├── main.py                    # FastAPI app, middleware, CORS, health endpoints
│   ├── config.py                  # Environment and service configuration
│   ├── dependencies.py            # Singleton service injection (DB, DecisionEngine)
│   ├── models.py                  # 20+ Pydantic models (evidence types, decisions)
│   ├── auth.py                    # JWT generation and validation
│   ├── resume_parser.py           # Skill extraction, JD matching, claim detection
│   ├── resume_validator.py        # File type/size validation
│   ├── code_executor.py           # Sandboxed Python execution, partial credit
│   ├── decision_engine.py         # Three-phase XAI decision pipeline (~970 LOC)
│   ├── database.py                # SQLAlchemy data access layer (SQLite + PostgreSQL)
│   ├── domain_questions.json      # Coding + MCQ questions by role
│   ├── job_roles.json             # Job description templates and skill maps
│   ├── mcq_questions.json         # MCQ question bank (34 questions, 12 domains)
│   ├── coding_questions.json      # Coding challenges with test cases
│   ├── routers/
│   │   ├── auth.py                # Login, registration, token refresh
│   │   ├── candidates.py          # CRUD for candidate profiles
│   │   ├── resume.py              # Upload, parse, analyze resumes
│   │   ├── assessment.py          # Code execution, MCQ scoring, text evaluation
│   │   ├── integrity.py           # Violation logging, webcam snapshots
│   │   ├── reports.py             # Decision generation, case file export
│   │   └── dashboard.py           # Analytics, bulk ops, live monitoring
│   ├── test_main.py               # API integration tests
│   ├── test_decision_engine.py    # Decision engine unit tests
│   ├── test_extended.py           # Extended coverage
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Route definitions, lazy loading, AnimatePresence
│   │   ├── pages/
│   │   │   ├── HomePage.jsx           # Landing page with role-based CTA
│   │   │   ├── LoginPage.jsx          # Auth with ?role= pre-selection
│   │   │   ├── CandidateFlow.jsx      # Multi-stage assessment (Coding/MCQ/Psychometric)
│   │   │   ├── RecruiterDashboard.jsx # Individual candidate forensic report
│   │   │   ├── DashboardMain.jsx      # Candidate roster, analytics, bulk ops
│   │   │   ├── ResumeAnalysisPage.jsx # Resume upload and analysis
│   │   │   ├── LiveMonitorPage.jsx    # Real-time session monitoring
│   │   │   ├── BulkCandidateDetail.jsx# Bulk-imported candidate view
│   │   │   └── SharedReportPage.jsx   # Public shareable forensic report
│   │   ├── components/
│   │   │   ├── IntegrityMonitor.jsx   # Browser proctoring hooks
│   │   │   ├── WebcamProctor.jsx      # Periodic face detection capture
│   │   │   ├── ShadowProber.jsx       # AI context-aware follow-up probing
│   │   │   ├── CodeEditor.jsx         # Monaco-based code editor
│   │   │   ├── DecisionCard.jsx       # Rich decision visualization
│   │   │   ├── DecisionTimeline.jsx   # Scrubbable evidence timeline
│   │   │   ├── AuditTrail.jsx         # Raw prompt/response viewer
│   │   │   ├── ClaimProber.jsx        # Resume claim verification UI
│   │   │   ├── ResumeAuthenticityPanel.jsx
│   │   │   ├── dashboard/             # Dashboard sub-components
│   │   │   └── ui/                    # Skeleton loaders, shared UI primitives
│   │   └── utils/
│   │       ├── api.js                 # Axios API client with JWT interceptors
│   │       └── deviceFingerprint.js   # Browser/GPU/Canvas fingerprinting
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── GRADING_ACCURACY.md
│   ├── SECURITY_ANTICHEAT.md
│   ├── API_REFERENCE.md
│   ├── LOGIC_TRANSPARENCY.md
│   ├── CODE_QUALITY.md
│   └── USER_EXPERIENCE.md
│
├── docker-compose.yml
├── render.yaml
├── Dockerfile
└── assets/
    └── logo.png
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Google Gemini API key](https://makersuite.google.com/app/apikey) (free tier works)
- (Optional) Supabase project for PostgreSQL — falls back to SQLite without it

### 1. Clone

```bash
git clone https://github.com/Dakshbumb/Cygnusa-Guardian.git
cd Cygnusa-Guardian
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET_KEY=your_jwt_secret_key

# Optional — omit to use SQLite fallback
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
uvicorn main:app --reload
# API server: http://localhost:8000
# Interactive docs: http://localhost:8000/docs
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
# App: http://localhost:5173
```

### 4. Docker (Alternative)

```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:80
```

---

## API Overview

All endpoints are prefixed with `/api` and documented via FastAPI's OpenAPI spec at `/docs`.

| Domain | Key Endpoints | Purpose |
|:-------|:-------------|:--------|
| **Auth** | `POST /api/auth/login`, `POST /api/auth/register` | JWT login with role selection |
| **Candidates** | `GET /api/candidates`, `POST /api/candidates/create` | Profile CRUD |
| **Resume** | `POST /api/resume/upload`, `POST /api/resume/analyze` | Upload + AI parsing |
| **Assessment** | `POST /api/assessment/execute-code`, `POST /api/assessment/submit-mcq` | Sandboxed execution, MCQ scoring |
| **Integrity** | `POST /api/integrity/log-event`, `POST /api/integrity/snapshot` | Violation logging |
| **Reports** | `POST /api/reports/generate-decision`, `GET /api/reports/case-file` | XAI decisions + HTML export |
| **Dashboard** | `GET /api/dashboard/candidates`, `GET /api/dashboard/analytics` | Roster + aggregate stats |
| **Health** | `GET /api/health` | DB status, AI engine status, env info |

Full reference: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)

---

## Testing

```bash
cd backend
pytest                           # Run all 55 tests
pytest test_decision_engine.py   # XAI decision engine unit tests
pytest test_main.py              # API integration tests
pytest test_extended.py          # Extended coverage
```

Test coverage includes:
- Decision engine auto-reject rules and LLM fallback behavior
- Sandboxed code executor timeouts and banned import detection
- API endpoint request/response schema validation
- Resume parsing edge cases

---

## Deployment

| Service | Platform | Config |
|:--------|:---------|:-------|
| Frontend | Vercel | Auto-deploy from `main` branch |
| Backend | Render | [`render.yaml`](render.yaml) — Python 3.11 |
| Database | Supabase | Managed PostgreSQL with connection pooling |

---

## Documentation

| Document | Contents |
|:---------|:---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component interactions |
| [FEATURES.md](docs/FEATURES.md) | Complete feature catalog |
| [GRADING_ACCURACY.md](docs/GRADING_ACCURACY.md) | Scoring algorithms, partial credit, tolerance bands |
| [SECURITY_ANTICHEAT.md](docs/SECURITY_ANTICHEAT.md) | Proctoring system, anti-cheat implementation |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Endpoint documentation with request/response schemas |
| [LOGIC_TRANSPARENCY.md](docs/LOGIC_TRANSPARENCY.md) | XAI transparency layer, audit trail design |
| [CODE_QUALITY.md](docs/CODE_QUALITY.md) | Code standards, type safety |
| [USER_EXPERIENCE.md](docs/USER_EXPERIENCE.md) | UX design decisions |

---

## License

MIT © 2026 Cygnusa Guardian — see [LICENSE](LICENSE) for details.
