# 🛡️ Cygnusa Guardian

**Glass-Box Hiring Intelligence** - AI-powered HR evaluation system with explainable decisions and integrity monitoring.

> Every hiring decision is fully transparent and auditable. No black boxes.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

Backend runs at: `http://localhost:8000`

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

## 📋 Features

### 1. Smart Resume Parsing
- Deterministic skill matching against job description
- No AI black box - exact matching rules visible
- Critical skill detection
- Experience extraction

### 2. Coding Assessment
- Live code execution sandbox
- Python support
- Hidden test cases with visible results
- Pass rate and timing metrics

### 3. Scenario-based MCQs
- Behavioral competency assessment
- Workplace scenario questions
- Competency mapping (Collaboration, Problem Solving, Communication)

### 4. Psychometric Self-Assessment
- Slider-based ratings
- Identify strengths and development areas
- Resilience, Leadership, Learning, Teamwork, Pressure

### 5. Integrity Shield (Proctoring)
- Webcam monitoring
- Tab switch detection
- Copy/paste detection
- Full audit trail

### 6. Explainable AI Decisions
- Clear HIRE / NO_HIRE / CONDITIONAL outcomes
- 3-reason justification with specific data
- Role fit recommendation
- Next steps for recruiter
- Full audit trail with exact AI prompt

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                          │
├──────────────────────────────────────────────────────────────────┤
│  HomePage  │  CandidateFlow  │  RecruiterDashboard               │
│            │  - CodeEditor   │  - DecisionCard                   │
│            │  - Monitoring   │  - EvidencePanel                  │
│            │                 │  - AuditTrail                     │
└──────────────────────────────────────────────────────────────────┘
                              │ API
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI)                           │
├─────────────────┬────────────────┬───────────────────────────────┤
│ Resume Parser   │ Code Executor  │ Decision Engine               │
│ (Deterministic) │ (Subprocess)   │ (AI + Fallback Rules)         │
├─────────────────┴────────────────┴───────────────────────────────┤
│                        Database (SQLite)                          │
└──────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Design Principles

1. **Glass-Box AI**: Every decision shows exact reasoning
2. **Evidence-First**: All scores are calculated before AI analysis
3. **Deterministic Rules**: Critical decisions use rules, not AI
4. **Full Audit Trail**: AI prompts and responses are stored
5. **Graceful Degradation**: Falls back to rules if AI unavailable

## 📂 Project Structure

```
cygnusa-guardian/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Pydantic data models
│   ├── database.py          # SQLite operations
│   ├── resume_parser.py     # Resume analysis
│   ├── code_executor.py     # Code sandbox
│   ├── decision_engine.py   # Explainable AI
│   ├── seed_demo_data.py    # Demo candidates
│   └── requirements.txt     
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── CandidateFlow.jsx
│   │   │   └── RecruiterDashboard.jsx
│   │   ├── components/
│   │   │   ├── IntegrityMonitor.jsx
│   │   │   ├── CodeEditor.jsx
│   │   │   ├── DecisionCard.jsx
│   │   │   └── AuditTrail.jsx
│   │   └── utils/
│   │       └── api.js
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🎮 Demo Flow

1. **Home Page**: Load demo candidates with "Load Demo Candidates" button
2. **Three demo profiles**:
   - **Alice Chen**: Strong candidate → HIRE
   - **Bob Smith**: Borderline → CONDITIONAL  
   - **Charlie Davis**: Weak candidate → NO_HIRE
3. **Click any candidate** to view their full report
4. **Audit Trail** section shows exact AI prompt and response

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/candidates/create` | Create candidate |
| GET | `/api/candidates` | List all candidates |
| GET | `/api/candidates/{id}` | Get candidate details |
| POST | `/api/resume/upload` | Upload and analyze resume |
| POST | `/api/assessment/start` | Start assessment |
| POST | `/api/assessment/submit-code` | Submit code solution |
| POST | `/api/assessment/submit-mcq` | Submit MCQ answer |
| POST | `/api/assessment/submit-psychometric` | Submit self-assessment |
| POST | `/api/integrity/log` | Log integrity event |
| POST | `/api/assessment/generate-report/{id}` | Generate final decision |
| POST | `/api/demo/seed` | Create demo candidates |

## 🔐 Environment Variables

```bash
# Optional: For AI-powered decisions
GEMINI_API_KEY=your_gemini_api_key

# Or
OPENAI_API_KEY=your_openai_api_key
```

Without API keys, the system uses deterministic fallback rules.

## 📊 Demo Day Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Demo candidates seeded
- [ ] Show Alice (HIRE) decision with audit trail
- [ ] Show Bob (CONDITIONAL) with integrity concerns
- [ ] Show Charlie (NO_HIRE) with auto-reject

## 📝 License

MIT License - Built for hackathon demo, Feb 2026

---

**Cygnusa Guardian** - Because every hiring decision deserves an explanation.
