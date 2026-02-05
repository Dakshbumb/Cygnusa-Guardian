# Cygnusa Guardian: The Forensic Gold Standard
### Feature Inventory & Technical USP Deep-Dive

Cygnusa Guardian is not just an assessment tool; it is a **Forensic Verification Platform**. Every feature is designed around the **"Glass-Box" Principle**—total transparency for recruiters and zero-tolerance for dishonesty.

---

## 💎 Core USPs (Unique Selling Propositions)

### 1. AI "Shadow" Deep-Probing (Forensic Code Verification)
**The Problem:** Candidates often copy-paste code from AI tools or memorized snippets without understanding.
**The Forensic Solution:** A "Shadow Interviewer" analyzes the candidate's specific code implementation and asks a tailored, context-aware follow-up question in real-time.
- **How it's built:**
    - **Backend (`ShadowProctorEngine`):** Uses **Google Gemini 1.5 Flash** to identify algorithmic choices (e.g., set vs. list, recursion vs. iteration).
    - **Prompt Engineering:** The AI is instructed to find a "pivot point" in the code and ask *why* that choice was made.
    - **Frontend (`ShadowProber.jsx`):** A motion-enabled, secure overlay that interrupts the flow immediately after submission, preventing the candidate from "searching for a reason" later.

### 2. Decision Node Timeline (Ranking Evolution)
**The Problem:** Most AI hiring tools provide a single "Hire/No-Hire" score with no explanation of how it was reached.
**The Forensic Solution:** A scrubbable timeline that shows how every piece of evidence (Resume, Code, Scenarios, Integrity violations) moved the needle on the candidate's predicted rank.
- **How it's built:**
    - **Data Model (`DecisionNode`):** A custom schema in `models.py` that captures the timestamp, node type (RESUME/CODE/INTEGRITY), and the "Impact Weight."
    - **UI Scrubber (`DecisionTimeline.jsx`):** An interactive horizontal timeline where recruiters can click any "pivot" to see the raw evidence (e.g., a specific test case failure or a high-severity tab-switch event).

### 3. O(1) Forensic Resume Pipeline
**The Problem:** Parsing resumes multiple times is expensive and slow.
**The Forensic Solution:** Resumes are parsed **exactly once** upon upload, with the "Context Snippet" preserved for every extracted skill.
- **How it's built:**
    - **Extractor (`resume_parser.py`):** Uses AI to map candidate skills directly to the Job Description while simultaneously extracting the "Evidence Context" (the exact sentence in the resume proving that skill).
    - **Efficiency:** The parsed evidence is cached in the `CandidateProfile`, making recruiter review instantaneous.

---

## 🛡️ Integrity Shield (Anti-Cheat Suite)

### 1. Lockdown Mode & Integrity Monitor
- **Feature:** Blocks Copy, Paste, Right-Click, and Context Menus. Enforces mandatory Fullscreen.
- **Forensic Logic:** Rather than just blocking, it **logs everything**. If a candidate exceeds 5 "High Severity" violations (e.g., trying to paste code repeatedly), the system enters **Lockdown**, suspending the session.
- **Built with:** Custom React Hooks in `IntegrityMonitor.jsx` utilizing `document.addEventListener` for keyboard/visibility events.

### 2. Webcam & Environmental Proctoring
- **Feature:** Periodic snapshots with face detection.
- **Built with:** `WebcamProctor.jsx` captures frames every 30 seconds; the backend calculates the **"Face Detection Rate"** and logs anomalies if the candidate leaves the frame or uses a side assistant.

### 3. Stress-Response Analytics
- **Feature:** Correlates the time taken for a question with the difficulty level to detect "Rushing" (a sign of memorized answers).
- **Built with:** Tracking `time_started` vs. `time_submitted` for every code and MCQ task, stored in the `CodeExecutionEvidence`.

---

## 🛠️ Technical Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React + Vite + Tailwind | High-performance, low-latency UI with premium aesthetics. |
| **Backend** | FastAPI (Python 3.11) | Asynchronous processing of heavy AI tasks. |
| **AI Engine** | Google Gemini API | Powers resume parsing, shadow probing, and decision reasoning. |
| **Sandbox** | Docker-style Subprocess | Secure execution of candidate code against test cases. |
| **Database** | SQLAlchemy + JSONB | Auditable evidence storage with full query support. |

---

## 🔍 The "Glass-Box" Audit Trail

Every final decision comes with an **Audit Trail** (`AuditTrail.jsx`). This allows recruiters to see the **exact prompt** sent to the AI and the **raw response** it gave. This eliminates "AI Bias" by making the machine's "thought process" visible to a human investigator.
