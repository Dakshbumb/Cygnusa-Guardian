# 🔍 Cygnusa Guardian - Logic Transparency (20%)

## Overview

Cygnusa Guardian is built on the principle of **"Glass-Box" decision making**. Every hiring decision is:

- 🔍 **Fully Explainable** - No hidden scoring or black-box AI
- 📊 **Evidence-Based** - Every claim backed by specific data
- 🔄 **Counterfactual** - Shows "what-if" scenarios
- 📝 **Auditable** - Complete prompt/response logging
- 🎯 **Traceable** - Forensic timeline of decision factors

---

## 🏛️ Core Transparency Principles

### 1. Pre-Calculated Evidence

```
❌ Black-Box Approach:
   Raw Data → AI → "You're hired!" 
   (No explanation why)

✅ Cygnusa Guardian Approach:
   Raw Data → Evidence Summary → AI Enhancement → Decision + Full Trace
   (Every number visible BEFORE AI is called)
```

### Evidence Summary (Passed to AI)

```python
evidence_summary = {
    "resume": {
        "match_score": 78.5,           # Visible calculation
        "skills_found": ["Python", "React", "AWS"],
        "missing_critical": ["Docker"],
        "experience_years": 4
    },
    "coding": {
        "avg_pass_rate": 85.0,         # Weighted with partial credit
        "questions_attempted": 3,
        "execution_times_ms": [45, 120, 89]
    },
    "mcqs": {
        "pass_rate": 70.0,
        "competency_breakdown": {
            "Machine Learning": 80,
            "Data Structures": 60
        }
    },
    "integrity": {
        "total_violations": 2,
        "severity_score": 3.5,
        "events": ["tab_switch", "paste_attempt"]
    }
}
```

---

## 🔄 Counterfactual Explanations

### What Are Counterfactuals?

Counterfactuals answer: **"What would change the decision?"**

```
┌─────────────────────────────────────────────────────────────────┐
│                  COUNTERFACTUAL ENGINE                          │
│                                                                 │
│  Current Decision: NO_HIRE                                      │
│  Confidence: Medium                                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 💡 WHAT WOULD CHANGE THIS?                                 │ │
│  │                                                            │ │
│  │ 1. If coding score was 70%+                               │ │
│  │    Current: 45.0% → Target: ≥70%                          │ │
│  │    Outcome would be: CONDITIONAL                          │ │
│  │    Impact: HIGH                                           │ │
│  │                                                            │ │
│  │ 2. If resume match was 60%+                               │ │
│  │    Current: 52.0% → Target: ≥60%                          │ │
│  │    Outcome would be: CONDITIONAL                          │ │
│  │    Impact: MEDIUM                                         │ │
│  │                                                            │ │
│  │ 3. If integrity violations were ≤5                        │ │
│  │    Current: 8 violations → Target: ≤5                     │ │
│  │    Outcome would be: CONDITIONAL                          │ │
│  │    Impact: HIGH                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```python
def _generate_counterfactuals(self, evidence_summary: dict, current_outcome: str) -> list:
    counterfactuals = []
    
    coding_score = evidence_summary.get('coding', {}).get('avg_pass_rate', 0)
    resume_score = evidence_summary.get('resume', {}).get('match_score', 0)
    integrity_violations = evidence_summary.get('integrity', {}).get('total_violations', 0)
    
    if current_outcome == 'NO_HIRE':
        if coding_score < 70:
            counterfactuals.append({
                "condition": "If coding score was 70%+",
                "outcome_change": "CONDITIONAL",
                "current_value": f"{coding_score:.1f}%",
                "target_value": "≥70%",
                "impact": "high"
            })
        
        if resume_score < 60:
            counterfactuals.append({
                "condition": "If resume match was 60%+",
                "outcome_change": "CONDITIONAL",
                "current_value": f"{resume_score:.1f}%",
                "target_value": "≥60%",
                "impact": "medium"
            })
    
    return counterfactuals
```

---

## 📋 Evidentiary Mapping

### Evidence Impact Classification

Each evidence type is classified by its impact on the decision:

```
┌─────────────────────────────────────────────────────────────────┐
│                  EVIDENTIARY MAPPING                            │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ PRIMARY DRIVER  │  │   SUPPORTING    │  │    NEGATIVE     │ │
│  │     (Green)     │  │    (Yellow)     │  │      (Red)      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│  • Coding ≥70%        • MCQs ≥60%           • Integrity >5     │
│  • Resume ≥70%        • Behavioral OK       • Claims failed   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Visual Representation in UI:                              │ │
│  │                                                            │ │
│  │  Resume Match    [██████████████░░░░] 78%  🟢 Primary     │ │
│  │  Coding Score    [████████████░░░░░░] 65%  🟡 Supporting  │ │
│  │  MCQ Accuracy    [██████████░░░░░░░░] 55%  🟡 Supporting  │ │
│  │  Integrity       [████░░░░░░░░░░░░░░] 8    🔴 Negative    │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🕵️ Forensic Timeline (Decision Nodes)

### Timeline Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                   FORENSIC TIMELINE                             │
│                                                                 │
│  09:00  ┌──────────────────────────────────────────────┐       │
│    │    │ 📄 RESUME UPLOADED                           │       │
│    │    │ Impact: POSITIVE                              │       │
│    │    │ "78% match score, strong Python background"  │       │
│    │    └──────────────────────────────────────────────┘       │
│    │                          │                                 │
│    ▼                          ▼                                 │
│  09:05  ┌──────────────────────────────────────────────┐       │
│    │    │ 💻 CODE_Q1: Two Sum                          │       │
│    │    │ Impact: POSITIVE                              │       │
│    │    │ "100% test pass, optimal O(n) solution"      │       │
│    │    └──────────────────────────────────────────────┘       │
│    │                          │                                 │
│    ▼                          ▼                                 │
│  09:12  ┌──────────────────────────────────────────────┐       │
│    │    │ ⚠️ INTEGRITY: Tab Switch                     │       │
│    │    │ Impact: NEGATIVE                              │       │
│    │    │ "User switched to external tab for 8s"       │       │
│    │    └──────────────────────────────────────────────┘       │
│    │                          │                                 │
│    ▼                          ▼                                 │
│  09:20  ┌──────────────────────────────────────────────┐       │
│    │    │ ✅ MCQ: 4/5 Correct                           │       │
│    │    │ Impact: POSITIVE                              │       │
│    │    │ "Strong ML competency (80%), DS needs work"  │       │
│    │    └──────────────────────────────────────────────┘       │
│    │                          │                                 │
│    ▼                          ▼                                 │
│  09:30  ┌──────────────────────────────────────────────┐       │
│    │    │ 🎯 FINAL DECISION: CONDITIONAL               │       │
│    │    │ Confidence: MEDIUM                            │       │
│    │    │ "Strong technical skills offset by minor     │       │
│    │    │  integrity concerns. Recommend follow-up."   │       │
│    │    └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### DecisionNode Model

```python
class DecisionNode(BaseModel):
    timestamp: str
    node_type: str  # RESUME, CODE, MCQ, TEXT, INTEGRITY, FINAL, COGNITIVE
    title: str
    impact: str     # positive, neutral, negative
    description: str
    evidence_id: Optional[str] = None
    predicted_rank: Optional[float] = None
```

---

## 📝 Audit Trail

### Complete Transparency Record

```python
audit_trail = {
    "prompt": """
    You are evaluating candidate John Doe for Software Engineer.
    
    EVIDENCE (pre-calculated, not AI-generated):
    - Resume Match: 78.5%
    - Coding Pass Rate: 85% (with partial credit)
    - MCQ Accuracy: 70%
    - Integrity Violations: 2 (low severity)
    
    Generate a decision with reasoning...
    """,
    
    "raw_response": """
    {
        "outcome": "HIRE",
        "confidence": "high",
        "reasoning": [
            "Strong coding performance (85%) exceeds threshold",
            "Resume shows 4+ years relevant experience",
            "Minor integrity issues (tab switches) are acceptable"
        ],
        "role_fit": "Excellent fit for backend role"
    }
    """,
    
    "model_used": "gemini-pro",
    "auto_rules_applied": False,
    "audit_standard": "FORENSIC_V1",
    "generated_at": "2026-02-06T09:30:00Z"
}
```

### Transparency Token

Every decision gets a unique, trackable token:

```
AUDIT-A7F3B2C1-1736412600
       │         │
       │         └── Unix timestamp
       └──────────── Random hex identifier
```

---

## 🎭 Cognitive Profile Transparency

### Profile Derivation

```
┌─────────────────────────────────────────────────────────────────┐
│               COGNITIVE PROFILE DERIVATION                      │
│                                                                 │
│  Performance Data → Analysis → Cognitive Style                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ METRICS OBSERVED:                                        │   │
│  │ • Code complexity preference: High abstraction           │   │
│  │ • Solution approach: Optimal first (not iterative)       │   │
│  │ • MCQ response time: Fast on theory, slow on practical   │   │
│  │ • Text answers: Detailed, structured explanations        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DERIVED PROFILE:                                         │   │
│  │                                                          │   │
│  │ Primary Style: Architectural_Thinker                     │   │
│  │ Secondary Style: Deep_Analyst                            │   │
│  │                                                          │   │
│  │ Cognitive Scores:                                        │   │
│  │ ├── Abstraction:    ████████░░  8/10                     │   │
│  │ ├── Execution Speed: ██████░░░░  6/10                    │   │
│  │ ├── Precision:       █████████░  9/10                    │   │
│  │ └── Creativity:      ███████░░░  7/10                    │   │
│  │                                                          │   │
│  │ Team Gap Fit: "Ideal for system design and architecture" │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Evaluation Criteria Alignment (20%)

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| Explainable decisions | ✅ Full reasoning array | `FinalDecision.reasoning` |
| Counterfactuals | ✅ What-if scenarios | `_generate_counterfactuals()` |
| Evidence mapping | ✅ Primary/supporting/negative | `evidentiary_mapping` |
| Forensic timeline | ✅ Decision nodes | `decision_nodes` |
| Audit trail | ✅ Prompt + response logging | `audit_trail` |
| Cognitive profiling | ✅ Archetype derivation | `CognitiveProfile` |
| No black-box AI | ✅ Pre-calculated evidence | Evidence summary |
