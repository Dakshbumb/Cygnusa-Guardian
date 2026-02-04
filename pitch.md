# 🎯 Cygnusa Guardian: The Technical Pitch

## 🛡️ Executive Summary
Cygnusa Guardian is an **Explainable AI (XAI)** hiring platform designed to solve the "Black-Box" problem in recruitment. Unlike traditional tools that provide a simple score, Cygnusa exposes the **raw evidence** behind every decision, ensuring transparency for recruiters and fairness for candidates.

---

## 🛠️ The Power Stack

### Backend (The Brain)
- **Language:** Python 3.11+ (Chosen for its robust ecosystem in AI and secure subprocess management).
- **Web Framework:** `FastAPI` (Asynchronous, high-performance, and type-safe via Pydantic).
- **AI Core:** `google-generativeai` (Gemini Pro) for reasoning; `openai` (GPT-4) as a high-fidelity fallback.
- **Database:** `Supabase` (PostgreSQL) – provides scalable relational storage with built-in connection pooling.
- **Parsing:** `pdfplumber` for deep PDF text extraction and `python-docx` for MS Word compatibility.
- **ORM:** `SQLAlchemy 2.0` with `Psycopg2` for high-performance PostgreSQL interaction.

### Frontend (The Interface)
- **Framework:** `React 18` + `Vite` (Optimized for ultra-fast development and runtime).
- **Styling:** `Tailwind CSS` + `Framer Motion` for cinematic, forensic-grade animations.
- **Components:** `Monaco Editor` (The VS Code engine) for the Coding Assessment.
- **Visualization:** `Chart.js` + `react-chartjs-2` for competency radar and timing graphs.
- **Icons:** `Lucide React` for clean, consistent iconography.

---

## 🧠 The Decision Engine: "Glass-Box" Philosophy

The heart of Cygnusa is the **Explainable Decision Engine** (`decision_engine.py`). 

### ⚙️ How it Works (Logic Flow)
1. **Evidence Aggregation:** Before the AI is even invoked, the system pre-calculates **Raw Evidence Objects** (Resume stats, code pass rates, MCQ scores, and proctoring violations).
2. **Deterministic Filter (The Gatekeeper):** The engine applies **Auto-Reject Rules**:
   - Missing "Critical Skills" (e.g., Python for a Python role).
   - Exceeding the "Integrity Threshold" (e.g., >5 tab switches).
   - Scoring below 30% in multiple sections.
   *If an auto-rule triggers, the process stops here, and the human gets an immediate, rule-based explanation.*
3. **AI-Driven Reasoning:** If the candidate passes the rules, the engine builds a **Transparent Prompt**. 
   - We don't ask the AI to "score" the candidate. 
   - We provide the AI with the **exact raw data** and ask it to **explain the fit**.
4. **Audit Trail:** Every prompt and raw JSON response is stored in the database. A recruiter can click "View Prompt" to see exactly what "evidence" the AI saw.

---

## ⚔️ Feature Deep-Dive

### 1. Smart Resume Gatekeeper
- **Logic:** Uses **Regex-based Entity Extraction**. Instead of blindly trusting a model, it looks for exact keywords and their aliases (e.g., "Py" → "Python").
- **Approach:** It maps skill occurrences with **Context Snippets**. The recruiter doesn't just see "Python: 80%", they see "...5 years experience building microservices with **Python**...".
- **Coding:** Implemented in `resume_parser.py` using a variation-normalization dictionary.

### 2. Forensic Integrity Shield
- **Logic:** Uses a **Multi-Event Listener Pattern** in the browser. 
- **Events Tracked:** 
  - `visibilitychange`: Detects tab switching.
  - `blur`: Detects window switching.
  - `paste` & `copy`: Detects external code insertion.
  - `contextmenu`: Blocks cheating lookups.
- **Approach:** Every event is sent to a **Live-Log API** in the background. It doesn't just "block" the candidate; it **builds a forensic report** for the recruiter to review later.

### 3. Real-Time Code Sandbox
- **Logic:** Subprocess-based isolation.
- **Approach:** When a candidate submits code, the backend initiates a **fresh Python subprocess**.
- **Security:**
  - **Resource Limits:** Enforces a 5-second timeout.
  - **Banned Imports:** Uses a `ForbiddenImport` filter to block `os`, `sys`, and `shutil`.
  - **Test Isolation:** Compares `stdout` against hidden expected values using exact string matching or numeric tolerance.

### 4. Psychometric Strategy Analysis
- **Logic:** Self-assessment mapped to **Competency Vectors**.
- **Approach:** Candidates use sliders to rate themselves. The engine then correlates these self-ratings with their **Actual Performance** (e.g., Did they claim "High Resilience" but stop the coding task after 1 fail?). 
- **Coding:** Results are visualized using a **Radar Chart** for instant visual comprehension of role fit.

---

## 🚀 Why This Matters
Cygnusa isn't just an "AI Tool." It's a **Compliance Layer**. By moving away from "Black-Box" scoring and toward **Evidence-First Reasoning**, we eliminate algorithmic bias and restore trust to the hiring pipeline.

**Built for the future of ethical recruitment. Built with Cygnusa Guardian.**
