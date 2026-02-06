# 📊 Cygnusa Guardian - Grading Accuracy (20%)

## Overview

Cygnusa Guardian implements a **multi-dimensional, evidence-based scoring system** that goes beyond simple pass/fail to provide:

- ✅ Partial credit for close-but-not-exact answers
- ✅ Competency-mapped MCQ scoring
- ✅ AI-assisted text evaluation
- ✅ Weighted aggregate scoring
- ✅ Full transparency on score derivation

---

## 🎯 Scoring Components

### 1. Code Execution Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│                    CODE SCORING PIPELINE                        │
│                                                                 │
│  Submitted Code → Sandbox Execution → Test Case Results → Score│
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Security    │ →  │ Execute in   │ →  │ Compare     │         │
│  │ Check       │    │ Sandbox      │    │ Outputs     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                              │                  │
│                                              ▼                  │
│                         ┌─────────────────────────────┐        │
│                         │   Similarity Analysis       │        │
│                         │   (Levenshtein Distance)    │        │
│                         └─────────────────────────────┘        │
│                                              │                  │
│                                              ▼                  │
│                              ┌────────────────────┐            │
│                              │  Partial Credit    │            │
│                              │  Calculation       │            │
│                              └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

#### Partial Credit Scoring Algorithm

```python
def calculate_score(actual, expected):
    # Exact match = 100%
    if actual == expected:
        return 100.0, "PASS"
    
    # Calculate Levenshtein distance
    distance = levenshtein_distance(str(actual), str(expected))
    max_len = max(len(str(actual)), len(str(expected)))
    similarity = ((max_len - distance) / max_len) * 100
    
    # Numeric near-miss detection
    try:
        pct_diff = abs(float(actual) - float(expected)) / abs(float(expected))
        if pct_diff < 0.01:   # Within 1%
            similarity = max(similarity, 95.0)
        elif pct_diff < 0.05: # Within 5%
            similarity = max(similarity, 75.0)
        elif pct_diff < 0.10: # Within 10%
            similarity = max(similarity, 50.0)
    except:
        pass
    
    # Award partial credit for 50%+ similarity
    if similarity >= 50:
        return similarity, "PARTIAL"
    else:
        return 0.0, "FAIL"
```

#### Weighted Pass Rate Calculation

```python
# Traditional binary scoring
pass_rate = (passed_count / total_tests) * 100

# Enhanced partial credit scoring
total_score = 0.0
for test in test_results:
    if test.passed:
        total_score += 1.0           # Full credit
    elif test.partial_credit:
        total_score += test.similarity_score / 100  # Proportional credit

weighted_pass_rate = (total_score / len(test_results)) * 100
```

---

### 2. MCQ Competency Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCQ SCORING MATRIX                          │
│                                                                 │
│  Question → Competency Mapping → Weighted Score → Profile       │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ ML/AI       │    │ Frontend    │    │ Backend     │         │
│  │ Questions   │    │ Questions   │    │ Questions   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              COMPETENCY AGGREGATOR                   │       │
│  │                                                      │       │
│  │  Machine Learning:  80%  ████████░░                  │       │
│  │  React/Frontend:    90%  █████████░                  │       │
│  │  Data Structures:   70%  ███████░░░                  │       │
│  │  System Design:     60%  ██████░░░░                  │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation

```python
class MCQEvidence(BaseModel):
    question_id: str
    question_text: str
    competency: str           # "Machine Learning", "React", etc.
    selected_option: str
    correct_option: str
    is_correct: bool
    explanation: str          # Why this answer matters
```

---

### 3. Resume Match Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│                   RESUME SCORING ENGINE                         │
│                                                                 │
│  Resume Text → Skill Extraction → JD Matching → Score          │
│                                                                 │
│  Step 1: Extract Skills                                        │
│  ┌──────────────────────────────────────────────┐              │
│  │ "Python, React, TensorFlow, AWS, 3 years..." │              │
│  └──────────────────────────────────────────────┘              │
│                         │                                       │
│                         ▼                                       │
│  Step 2: Compare with Job Requirements                         │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ Required Skills │    │ Found Skills    │                    │
│  │ - Python ✅     │    │ - Python        │                    │
│  │ - AWS ✅        │    │ - AWS           │                    │
│  │ - Java ❌       │    │ - React         │                    │
│  │ - Docker ❌     │    │ - TensorFlow    │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                         │                                       │
│                         ▼                                       │
│  Step 3: Calculate Match Score                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │ Match Score: 75%                              │              │
│  │ Critical Missing: [Java, Docker]             │              │
│  │ Bonus Skills: [TensorFlow, React]            │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Claim Verification Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTHENTICITY SCORING                           │
│                                                                 │
│  Resume Claims → AI Detection → Probe Questions → Verification  │
│                                                                 │
│  Suspicious Claims Detected:                                    │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ 1. "Led team of 20 engineers" (Leadership)           │      │
│  │    → Probe: "Describe a conflict you resolved..."    │      │
│  │    → Status: ✅ Verified (detailed response)         │      │
│  │                                                       │      │
│  │ 2. "4.0 GPA from Stanford" (Education)               │      │
│  │    → Probe: "What was your thesis topic?"            │      │
│  │    → Status: ⚠️ Vague response                       │      │
│  │                                                       │      │
│  │ 3. "Increased revenue by 300%" (Impact)              │      │
│  │    → Probe: "Walk me through the metrics..."         │      │
│  │    → Status: ❌ Failed verification                  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  Authenticity Score: 65/100                                    │
│  Claims Verified: 2/3                                          │
│  Red Flags: 1                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 Final Score Aggregation

### Evidence Weight Distribution

| Evidence Type | Weight | Justification |
|--------------|--------|---------------|
| Coding Performance | 35% | Core technical competency |
| MCQ Accuracy | 20% | Conceptual knowledge |
| Resume Match | 15% | Background alignment |
| Claim Verification | 10% | Authenticity check |
| Text/Behavioral | 10% | Communication skills |
| Integrity Score | 10% | Trust factor |

### Decision Thresholds

```
┌─────────────────────────────────────────────────────────────────┐
│                   DECISION THRESHOLDS                           │
│                                                                 │
│  100% ┌──────────────────────────────────────────────┐         │
│       │                    HIRE                       │         │
│   80% ├──────────────────────────────────────────────┤         │
│       │               CONDITIONAL                     │         │
│   60% ├──────────────────────────────────────────────┤         │
│       │                                               │         │
│   40% │                 NO_HIRE                       │         │
│       │                                               │         │
│    0% └──────────────────────────────────────────────┘         │
│                                                                 │
│  Auto-HIRE if:                                                  │
│  - Coding ≥ 80% AND                                            │
│  - Resume ≥ 70% AND                                            │
│  - Integrity violations ≤ 3                                    │
│                                                                 │
│  Auto-REJECT if:                                               │
│  - Coding < 30% OR                                             │
│  - Critical integrity violation OR                             │
│  - Claim verification failed                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Score Transparency Features

### 1. Per-Test-Case Results
Every test case shows:
- Input provided
- Expected output
- Actual output
- Pass/Fail status
- Similarity score (for partial credit)
- Execution time

### 2. Competency Breakdown
MCQs are grouped by competency area with individual scores visible.

### 3. Resume Match Details
Shows exactly which skills matched, which are missing, and why the match score was calculated.

### 4. Claim Verification Trail
Each suspicious claim shows the probe question asked and the candidate's response quality.

---

## ✅ Evaluation Criteria Alignment (20%)

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| Multiple scoring dimensions | ✅ 6 evidence types | `models.py` |
| Partial credit support | ✅ Levenshtein similarity | `code_executor.py` |
| Competency mapping | ✅ MCQ → skill areas | `DEMO_MCQS` |
| Score transparency | ✅ Full breakdown visible | `DecisionCard.jsx` |
| Weighted aggregation | ✅ Configurable weights | `decision_engine.py` |
| Deterministic fallback | ✅ Rule-based backup | `_apply_auto_rules()` |
