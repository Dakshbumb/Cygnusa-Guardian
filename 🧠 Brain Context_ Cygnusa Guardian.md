# 🧠 Brain Context: Cygnusa Guardian

Cygnusa Guardian is an **Explainable AI (XAI)** hiring platform designed to eliminate "black-box" decision-making in technical recruitment. It provides a "Glass-Box" view where every hiring decision—Auto-Hire, Conditional, or Auto-Reject—is backed by auditable evidence, real-time proctoring, and transparent reasoning.

---

## 🏗️ System Architecture

The project follows a modular **Three-Tier Architecture** designed for scalability, security, and transparency.

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Presentation (Frontend)** | React 18, Vite, Tailwind CSS, Framer Motion, Monaco Editor | Provides an immersive candidate assessment flow and a detailed recruiter dashboard. |
| **Application (Backend)** | Python FastAPI, Pydantic, Google Gemini Pro, OpenAI GPT-4 | Handles async API orchestration, secure code execution, and the XAI decision engine. |
| **Data (Persistence)** | Supabase (PostgreSQL), SQLite (Fallback) | Manages candidate data, assessment results, and audit trails. |

---

## 🧩 Core Components & Responsibilities

### 1. Frontend (`/frontend/src`)
*   **`CandidateFlow.jsx`**: Orchestrates the multi-step assessment (Resume -> MCQ -> Coding -> Psychometric).
*   **`IntegrityMonitor.jsx`**: Real-time proctoring using webcam (Face-API), tab-switch detection, and typing burst analysis.
*   **`ShadowProber.jsx`**: An AI-driven follow-up component that asks candidates questions about their submitted code to verify authorship.
*   **`DecisionCard.jsx`**: Displays the "Why" behind AI decisions, including evidentiary mapping and counterfactuals.
*   **`RecruiterDashboard.jsx`**: A central hub for managing candidates, viewing reports, and auditing AI logic.

### 2. Backend (`/backend`)
*   **`main.py`**: Entry point that initializes FastAPI and integrates modular routers.
*   **`decision_engine.py`**: The "brain" of the platform. It aggregates evidence from all modules and uses LLMs (Gemini/OpenAI) to generate structured rationales.
*   **`code_executor.py`**: A secure sandbox that executes candidate Python code using subprocesses with strict timeouts and banned import detection.
*   **`resume_parser.py`**: Extracts skills and experience using NLP and regex, mapping them against job requirements.
*   **`routers/`**: Modular API endpoints for `assessment`, `candidates`, `integrity`, `reports`, and `auth`.

---

## 🔐 Security & Anti-Cheat Matrix

The platform employs a multi-layered security approach to ensure assessment integrity:

*   **Visual**: Face detection (baseline comparison), multi-face alerts, and no-face detection.
*   **Browser**: Fullscreen enforcement, tab-switch detection (`visibilitychange`), and context menu/copy-paste blocking.
*   **Input**: Typing burst detection (flags rapid input suggestive of pasting) and keyboard shortcut interception.
*   **Execution**: Code sandbox with 10s execution timeout and blocking of sensitive modules (e.g., `os`, `subprocess`).
*   **Identity**: Device fingerprinting using browser, GPU, and canvas hashes.

---

## 📊 Decision Logic & Transparency

The **Explainable Decision Engine** follows a "Glass-Box" philosophy:
1.  **Evidentiary Mapping**: Categorizes data into *Primary Driver*, *Supporting*, *Negative*, and *Neutral* factors.
2.  **Counterfactual Engine**: Provides "What-if" scenarios (e.g., *"If coding score was >70%, the decision would be CONDITIONAL instead of REJECT"*).
3.  **Audit Trail**: Logs full AI prompts and raw responses for human verification.
4.  **Thresholds**: 
    *   **Auto-Hire**: Coding ≥ 80% AND Resume ≥ 70%.
    *   **Auto-Reject**: Coding < 30% OR critical skill gaps.
    *   **Conditional**: Mixed signals requiring human review.

---

## 🛠️ Development & Deployment

*   **Frontend**: Deployed on **Vercel**. Uses `npm run dev` for local development.
*   **Backend**: Deployed on **Render**. Requires `GOOGLE_API_KEY` for Gemini or `OPENAI_API_KEY` for fallback.
*   **Database**: Uses **Supabase** for production and **SQLite** for local testing/fallback.
*   **Docker**: Includes `Dockerfile` and `docker-compose.yml` for containerized deployment.

---

> *"Because every hiring decision deserves an explanation."*
