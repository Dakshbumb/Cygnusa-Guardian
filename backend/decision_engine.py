"""
Cygnusa Guardian - Explainable Decision Engine
The heart of "Glass-Box" hiring - every decision is traceable

Key principle: AI assists with reasoning, but ALL evidence is pre-calculated
and passed to the AI. No hidden scoring.
"""

import logging
import os
import json
from typing import List, Optional
from datetime import datetime
from models import (
    ResumeEvidence, CodeExecutionEvidence, MCQEvidence,
    PsychometricEvidence, IntegrityEvidence, FinalDecision, TextAnswerEvidence
)

# Configure logger
logger = logging.getLogger("cygnusa-decision")

# Try to import AI libraries
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class ExplainableDecisionEngine:
    """
    AI-assisted decision engine with FULL transparency.
    
    Key guarantees:
    1. All evidence is calculated BEFORE AI is called
    2. AI prompt contains exact numbers (no hidden scoring)
    3. Raw AI response is stored in audit trail
    4. Fallback to deterministic rules if AI fails
    """
    
    def __init__(self, use_gemini: bool = True, api_key: Optional[str] = None):
        self.use_gemini = use_gemini and HAS_GEMINI
        self.use_openai = not self.use_gemini and HAS_OPENAI
        
        if self.use_gemini:
            key = api_key or os.getenv('GEMINI_API_KEY')
            if key:
                genai.configure(api_key=key)
                self.model = genai.GenerativeModel('gemini-pro')
            else:
                logger.warning("No Gemini API key. Falling back to deterministic mode.")
                self.use_gemini = False
        
        if self.use_openai and not self.use_gemini:
            openai.api_key = api_key or os.getenv('OPENAI_API_KEY')
    
    def generate_decision(
        self,
        candidate_id: str,
        candidate_name: str,
        resume_evidence: Optional[ResumeEvidence],
        code_evidence: Optional[List[CodeExecutionEvidence]],
        mcq_evidence: Optional[List[MCQEvidence]],
        psychometric_evidence: Optional[PsychometricEvidence],
        integrity_evidence: Optional[IntegrityEvidence],
        text_evidence: Optional[List[TextAnswerEvidence]] = None,
        keystroke_evidence: Optional["KeystrokeEvidence"] = None
    ) -> FinalDecision:
        """
        Generate final hiring decision with full audit trail.
        """
        # Step 1: Build evidence summary (pre-calculated, no AI)
        evidence_summary = self._build_evidence_summary(
            resume_evidence, code_evidence, mcq_evidence,
            psychometric_evidence, integrity_evidence, text_evidence,
            keystroke_evidence
        )
        
        # Step 2: Apply deterministic rules first
        auto_decision = self._apply_auto_rules(evidence_summary)
        
        # Step 3: If no auto-decision, use AI for nuanced analysis
        if auto_decision:
            decision_data = auto_decision
            model_used = "deterministic_rules"
            # Transparently show the evidence state that triggered the rule
            prompt = f"RULE_ENGINE_EXECUTION\n\nPrimary Rule Triggered: {decision_data.get('reasoning', ['Unknown rule'])[0]}\n\nFull Evidence Context Snapshot:\n{json.dumps(evidence_summary, indent=2)}"
            raw_response = json.dumps(auto_decision, indent=2)
        else:
            # Build transparent prompt
            prompt = self._build_decision_prompt(candidate_name, evidence_summary)
            
            # Call AI
            try:
                if self.use_gemini:
                    raw_response = self._call_gemini(prompt)
                    model_used = "gemini-pro"
                    decision_data = self._parse_ai_response(raw_response)
                elif self.use_openai:
                    raw_response = self._call_openai(prompt)
                    model_used = "gpt-4"
                    decision_data = self._parse_ai_response(raw_response)
                else:
                    # Fallback to rule-based (already returns dict)
                    decision_data = self._generate_fallback_decision(evidence_summary)
                    model_used = "fallback_rules"
                    raw_response = json.dumps(decision_data)
            except Exception as e:
                decision_data = self._generate_fallback_decision(evidence_summary)
                model_used = "fallback_rules"
                raw_response = json.dumps(decision_data)
        
        return FinalDecision(
            candidate_id=candidate_id,
            outcome=decision_data.get('outcome', 'NO_HIRE'),
            confidence=decision_data.get('confidence', 'low'),
            conflict_score=decision_data.get('conflict_score', 0),
            conflict_analysis=decision_data.get('conflict_analysis', 'N/A'),
            reasoning=decision_data.get('reasoning', ['Unable to generate reasoning']),
            role_fit=decision_data.get('role_fit', 'Unable to determine'),
            next_steps=decision_data.get('next_steps', 'Manual review required'),
            evidence_summary=evidence_summary,
            evidentiary_mapping=decision_data.get('evidentiary_mapping', {}),
            forensic_trace=decision_data.get('forensic_trace', []),
            cognitive_profile=decision_data.get('cognitive_profile'),
            audit_trail={
                'prompt': prompt,
                'raw_response': raw_response,
                'model_used': model_used,
                'auto_rules_applied': auto_decision is not None,
                'audit_standard': 'FORENSIC_V1'
            },
            transparency_token=f"AUDIT-{uuid.uuid4().hex[:8].upper()}-{int(time.time())}",
            generated_at=datetime.now().isoformat()
        )
    
    def _build_evidence_summary(
        self,
        resume_evidence: Optional[ResumeEvidence],
        code_evidence: Optional[List[CodeExecutionEvidence]],
        mcq_evidence: Optional[List[MCQEvidence]],
        psychometric_evidence: Optional[PsychometricEvidence],
        integrity_evidence: Optional[IntegrityEvidence],
        text_evidence: Optional[List[TextAnswerEvidence]] = None,
        keystroke_evidence: Optional["KeystrokeEvidence"] = None
    ) -> dict:
        """
        Build a structured summary of all evidence.
        This is what gets passed to AI - fully transparent.
        """
        # Resume summary
        if resume_evidence:
            resume_data = {
                'match_score': resume_evidence.match_score,
                'skills_found': resume_evidence.skills_extracted,
                'skills_required': resume_evidence.jd_required,
                'missing_critical': resume_evidence.missing_critical,
                'experience_years': resume_evidence.experience_years,
                'reasoning': resume_evidence.reasoning
            }
        else:
            resume_data = {'match_score': 0, 'skills_found': [], 'missing_critical': []}
        
        # Coding summary
        if code_evidence:
            total_tests = sum(e.total_tests for e in code_evidence)
            total_passed = sum(
                sum(1 for tc in e.test_cases if tc.passed) 
                for e in code_evidence
            )
            avg_pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
            
            # Stress-response timing analysis
            timing_data = []
            rushing_flags = 0
            overthinking_flags = 0
            for e in code_evidence:
                if e.duration_seconds is not None:
                    timing_data.append(e.duration_seconds)
                    if e.duration_seconds < 60:  # < 1 min for code = rushing
                        rushing_flags += 1
                    elif e.duration_seconds > 900:  # > 15 min = overthinking
                        overthinking_flags += 1
            
            avg_time_per_question = sum(timing_data) / len(timing_data) if timing_data else None
            
            coding_data = {
                'avg_pass_rate': round(avg_pass_rate, 2),
                'questions_attempted': len(code_evidence),
                'total_tests': total_tests,
                'total_passed': total_passed,
                'stress_response': {
                    'avg_time_seconds': round(avg_time_per_question) if avg_time_per_question else None,
                    'rushing_flags': rushing_flags,
                    'overthinking_flags': overthinking_flags,
                    'pattern': 'rushing' if rushing_flags > 0 else ('overthinking' if overthinking_flags > 0 else 'normal')
                },
                'details': [
                    {
                        'question': e.question_title or e.question_id,
                        'pass_rate': e.pass_rate,
                        'time_ms': e.avg_time_ms,
                        'duration_seconds': e.duration_seconds,
                        'test_cases': [tc.model_dump() for tc in e.test_cases] if e.test_cases else []
                    }
                    for e in code_evidence
                ]
            }
        else:
            coding_data = {'avg_pass_rate': 0, 'questions_attempted': 0, 'stress_response': None}
        
        # MCQ summary
        if mcq_evidence:
            correct = sum(1 for m in mcq_evidence if m.is_correct)
            total = len(mcq_evidence)
            
            # Group by competency
            competency_scores = {}
            for m in mcq_evidence:
                if m.competency not in competency_scores:
                    competency_scores[m.competency] = {'correct': 0, 'total': 0}
                competency_scores[m.competency]['total'] += 1
                if m.is_correct:
                    competency_scores[m.competency]['correct'] += 1
            
            # Stress-response timing for MCQs
            mcq_timing = []
            mcq_rushing = 0
            for m in mcq_evidence:
                if m.duration_seconds is not None:
                    mcq_timing.append(m.duration_seconds)
                    if m.duration_seconds < 5:  # < 5 sec for MCQ = random clicking
                        mcq_rushing += 1
            
            avg_mcq_time = sum(mcq_timing) / len(mcq_timing) if mcq_timing else None
            
            mcq_data = {
                'total': total,
                'correct': correct,
                'pass_rate': round((correct / total * 100) if total > 0 else 0, 2),
                'by_competency': {
                    k: round(v['correct'] / v['total'] * 100, 2) if v['total'] > 0 else 0
                    for k, v in competency_scores.items()
                },
                'stress_response': {
                    'avg_time_seconds': round(avg_mcq_time) if avg_mcq_time else None,
                    'random_clicking_flags': mcq_rushing,
                    'pattern': 'random_clicking' if mcq_rushing > 1 else 'normal'
                }
            }
        else:
            mcq_data = {'total': 0, 'correct': 0, 'pass_rate': 0, 'stress_response': None}
        
        # Psychometric summary
        if psychometric_evidence:
            psych_data = {
                'scores': psychometric_evidence.competencies,
                'weak_areas': psychometric_evidence.weak_areas,
                'strong_areas': psychometric_evidence.strong_areas
            }
        else:
            psych_data = {'scores': {}, 'weak_areas': [], 'strong_areas': []}
        
        # Text/Probe summary
        if text_evidence:
            probes = [e for e in text_evidence if e.competency.startswith('Deep Probe:')]
            text_data = {
                'total_responses': len(text_evidence),
                'probes_triggered': len(probes),
                'details': [
                    {
                        'question': e.question_text,
                        'answer': e.answer_text,
                        'competency': e.competency,
                        'word_count': e.word_count
                    }
                    for e in text_evidence
                ]
            }
        else:
            text_data = {'total_responses': 0, 'probes_triggered': 0, 'details': []}
            
        # Integrity summary
        if integrity_evidence:
            integrity_data = {
                'total_violations': integrity_evidence.total_violations,
                'severity_score': integrity_evidence.severity_score,
                'trustworthiness': integrity_evidence.trustworthiness_rating,
                'events': [
                    {'type': e.event_type, 'severity': e.severity}
                    for e in integrity_evidence.events[:5]  # Last 5 events
                ]
            }
        # Keystroke summary
        if keystroke_evidence:
            keystroke_data = {
                'rhythm_score': keystroke_evidence.rhythm_score,
                'is_anomaly': keystroke_evidence.is_anomaly,
                'baseline_established': keystroke_evidence.baseline_established,
                'anomaly_reason': keystroke_evidence.anomaly_reason,
                'keystrokes_captured': len(keystroke_evidence.intervals)
            }
        else:
            keystroke_data = {'rhythm_score': 0, 'is_anomaly': False, 'baseline_established': False}
            
        return {
            'resume': resume_data,
            'coding': coding_data,
            'mcqs': mcq_data,
            'psychometric': psych_data,
            'integrity': integrity_data,
            'reasoning_probes': text_data,
            'biometrics': keystroke_data
        }
    
    def _apply_auto_rules(self, evidence: dict) -> Optional[dict]:
        """
        Apply deterministic rules for clear-cut cases.
        Returns decision dict if auto-decision, None if AI needed.
        """
        resume = evidence['resume']
        coding = evidence['coding']
        integrity = evidence['integrity']
        
        # AUTO-REJECT: Missing critical skills
        if resume.get('missing_critical'):
            return {
                'outcome': 'NO_HIRE',
                'confidence': 'high',
                'reasoning': [
                    f"Missing critical skills: {', '.join(resume['missing_critical'])}",
                    "Critical skills are mandatory for this role",
                    "Candidate does not meet minimum requirements"
                ],
                'role_fit': 'Not suitable - missing prerequisites',
                'next_steps': 'Advise candidate to gain required skills and reapply'
            }
        
        # AUTO-REJECT: Too many integrity violations (GAP.1 Closure)
        total_violations = integrity.get('total_violations', 0)
        if total_violations >= 5:
            return {
                'outcome': 'NO_HIRE',
                'confidence': 'high',
                'reasoning': [
                    f"{total_violations} integrity violations detected - auto-reject threshold exceeded",
                    f"Integrity severity score: {integrity.get('severity_score', 0)}",
                    "The high frequency of unauthorized events (tab switching, paste, etc.) invalidates this assessment."
                ],
                'role_fit': 'Not recommended due to integrity violations',
                'next_steps': 'Manual review of audit logs recommended to confirm findings'
            }
        
        # AUTO-REJECT: Very low scores
        if resume.get('match_score', 0) < 30 and coding.get('avg_pass_rate', 0) < 30:
            return {
                'outcome': 'NO_HIRE',
                'confidence': 'high',
                'reasoning': [
                    f"Resume match: {resume.get('match_score', 0):.1f}% (below 30% threshold)",
                    f"Coding assessment: {coding.get('avg_pass_rate', 0):.1f}% (below 30% threshold)",
                    "Performance significantly below minimum requirements"
                ],
                'role_fit': 'Not suitable for any technical role',
                'next_steps': 'No further action recommended'
            }
        
        # No auto-decision - needs AI analysis
        return None
    
    def _build_decision_prompt(self, candidate_name: str, evidence: dict) -> str:
        """
        Build the AI prompt with ALL evidence visible.
        This exact prompt is stored in the audit trail.
        """
        return f"""You are an HR decision assistant. Analyze this candidate's complete assessment data and provide a hiring recommendation.

CANDIDATE: {candidate_name}

=== RESUME ANALYSIS ===
Match Score: {evidence['resume'].get('match_score', 0):.1f}%
Skills Found: {', '.join(evidence['resume'].get('skills_found', []))}
Skills Required: {', '.join(evidence['resume'].get('skills_required', []))}
Missing Critical Skills: {', '.join(evidence['resume'].get('missing_critical', [])) or 'None'}
Experience: {evidence['resume'].get('experience_years', 'Unknown')} years
Parser Reasoning: {evidence['resume'].get('reasoning', 'N/A')}

=== CODING ASSESSMENT ===
Average Pass Rate: {evidence['coding'].get('avg_pass_rate', 0):.1f}%
Questions Attempted: {evidence['coding'].get('questions_attempted', 0)}
Total Tests: {evidence['coding'].get('total_tests', 0)}
Tests Passed: {evidence['coding'].get('total_passed', 0)}
Details: {json.dumps(evidence['coding'].get('details', []), indent=2)}

=== MCQ ASSESSMENT ===
Score: {evidence['mcqs'].get('correct', 0)}/{evidence['mcqs'].get('total', 0)} ({evidence['mcqs'].get('pass_rate', 0):.1f}%)
By Competency: {json.dumps(evidence['mcqs'].get('by_competency', {}), indent=2)}

=== PSYCHOMETRIC PROFILE ===
Scores: {json.dumps(evidence['psychometric'].get('scores', {}), indent=2)}
Weak Areas: {', '.join(evidence['psychometric'].get('weak_areas', [])) or 'None identified'}
Strong Areas: {', '.join(evidence['psychometric'].get('strong_areas', [])) or 'None identified'}

=== INTEGRITY MONITORING ===
Total Violations: {evidence['integrity'].get('total_violations', 0)}
Severity Score: {evidence['integrity'].get('severity_score', 0)}
Trustworthiness Rating: {evidence['integrity'].get('trustworthiness', 'Unknown')}
Recent Events: {json.dumps(evidence['integrity'].get('events', []), indent=2)}

=== REASONING & SHADOW PROBES (CRITICAL FORENSICS) ===
Total Reasoning Tasks: {evidence['reasoning_probes'].get('total_responses', 0)}
Deep Probes Triggered: {evidence['reasoning_probes'].get('probes_triggered', 0)}
Detailed Probe Responses: {json.dumps(evidence['reasoning_probes'].get('details', []), indent=2)}

=== CONFLICT ANALYSIS (CRITICAL) ===
Search for inconsistencies between the Resume claims and actual performance:
1. Did they claim a skill they failed in the Coding section?
2. Does their experience level match their coding speed and logic?
3. Are there integrity violations during high-difficulty questions?

=== YOUR TASK ===
Provide a JSON response with this exact structure:
{{
    "outcome": "HIRE" | "NO_HIRE" | "CONDITIONAL",
    "confidence": "high" | "medium" | "low",
    "conflict_score": 0-10, // 0 = no conflicts, 10 = major contradictions
    "reasoning": [
        "First reason citing specific data",
        "Second reason citing specific data",
        "Third reason about overall fit"
    ],
    "evidentiary_mapping": {{
        "resume": "primary_driver" | "supporting" | "negative",
        "coding": "primary_driver" | "supporting" | "negative",
        "mcqs": "primary_driver" | "supporting" | "negative",
        "integrity": "primary_driver" | "supporting" | "negative",
        "behavioral": "primary_driver" | "supporting" | "negative"
    }},
    "forensic_trace": [
        "Step 1: Evidence extraction and normalization...",
        "Step 2: Cross-referencing resume claims against coding performance...",
        "Step 3: Evaluating integrity signals during high-stakes segments...",
        "Step 4: Synthesizing final verdict based on weighted impact..."
    ],
    "cognitive_profile": {{
        "primary_style": "Architectural_Thinker" | "Tactical_Executor" | "Creative_Innovator" | "Deep_Analyst" | "Pragmatic_Generalist",
        "secondary_style": "Optional style from same list",
        "cognitive_scores": {{
            "abstraction": 0-10,
            "execution_speed": 0-10,
            "precision": 0-10,
            "creativity": 0-10
        }},
        "team_gap_fit": "Explain how this cognitive style fills specific gaps (e.g., 'Adds deep technical oversight to a tactical team')",
        "archetype_description": "2-sentence summary of their cognitive behavior",
        "transparency_logic": "Explain which evidence (e.g., 'High pass rate + complex code structure') led to this profile"
    }},
    "conflict_analysis": "Summary of inconsistencies found, or 'No conflicts detected'",
    "role_fit": "Specific role recommendation or why not suitable",
    "next_steps": "Concrete next action for recruiter"
}}

CRITICAL REQUIREMENTS:
1. Reference SPECIFIC numbers from the evidence (e.g., "scored 75% on coding")
2. Each reasoning point must cite actual data
3. Be direct and actionable
4. EXPLAIN FAILS BETTER THAN PASSES: If rejecting, be brutally precise about the gaps.
5. FORENSIC TRACE: This must be a step-by-step derivation of how you reached the conclusion.

Respond with ONLY the JSON, no additional text."""
    
    def _call_gemini(self, prompt: str) -> str:
        """Call Gemini API"""
        response = self.model.generate_content(
            prompt,
            generation_config={'temperature': 0.3}
        )
        text = response.text.strip()
        
        # Clean markdown code blocks if present
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
        if text.startswith('json'):
            text = text[4:].strip()
        
        return text
    
    def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API"""
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content
    
    def _parse_ai_response(self, response: str) -> dict:
        """Parse AI response, with fallback handling"""
        try:
            # Clean the response
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            
            data = json.loads(response)
            
            if not isinstance(data, dict):
                raise ValueError("AI response is not a valid JSON object")
            
            # Validate required fields
            required = ['outcome', 'confidence', 'reasoning', 'role_fit', 'next_steps']
            for field in required:
                if field not in data:
                    raise ValueError(f"Missing field: {field}")
            
            # Extract optional strategic enhancement fields
            data['conflict_analysis'] = data.get('conflict_analysis', 'No conflicts detected')
            data['conflict_score'] = data.get('conflict_score', 0)
            
            # Ensure reasoning is a list
            if isinstance(data['reasoning'], str):
                data['reasoning'] = [data['reasoning']]
            
            return data
            
        except Exception as e:
            logger.error(f"Parse error: {e}")
            return {
                'outcome': 'NO_HIRE',
                'confidence': 'low',
                'conflict_analysis': 'AI reasoning engine failed to parse response.',
                'conflict_score': 5,
                'reasoning': [
                    'AI response parsing failed',
                    'Manual review required',
                    f'Error: {str(e)[:100]}'
                ],
                'role_fit': 'Unable to determine',
                'next_steps': 'Manual review by hiring manager'
            }
    
    def _generate_fallback_decision(self, evidence: dict) -> str:
        """Generate deterministic decision when AI unavailable"""
        resume_score = evidence['resume'].get('match_score', 0)
        code_score = evidence['coding'].get('avg_pass_rate', 0)
        violations = evidence['integrity'].get('total_violations', 0)
        
        # Simple scoring
        if resume_score >= 70 and code_score >= 60 and violations < 2:
            outcome = 'HIRE'
            confidence = 'medium'
            reasoning = [
                f"Resume match: {resume_score:.1f}% (above 70% threshold)",
                f"Coding assessment: {code_score:.1f}% (above 60% threshold)",
                f"Integrity: {violations} violations (below 2 threshold)"
            ]
            role_fit = 'Suitable for role based on scores'
            next_steps = 'Schedule final interview'
        elif resume_score >= 50 and code_score >= 40 and violations < 4:
            outcome = 'CONDITIONAL'
            confidence = 'medium'
            reasoning = [
                f"Resume match: {resume_score:.1f}% (meets 50% minimum)",
                f"Coding assessment: {code_score:.1f}% (meets 40% minimum)",
                f"Areas for improvement identified"
            ]
            role_fit = 'May be suitable with additional evaluation'
            next_steps = 'Technical interview to assess gaps'
        else:
            outcome = 'NO_HIRE'
            confidence = 'medium'
            reasoning = [
                f"Resume match: {resume_score:.1f}%",
                f"Coding assessment: {code_score:.1f}%",
                "Scores below required thresholds"
            ]
            role_fit = 'Does not meet minimum requirements'
            next_steps = 'No further action'
        
        return {
            'outcome': outcome,
            'confidence': confidence,
            'reasoning': reasoning,
            'role_fit': role_fit,
            'next_steps': next_steps
        }


class ShadowProctorEngine:
    """
    The AI "Shadow" Deep-Probing engine.
    Analyzes submitted code and generates a targeted follow-up question
    to test the candidate's actual depth vs. memorization.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        key = api_key or os.getenv('GEMINI_API_KEY')
        self.enabled = False
        if HAS_GEMINI and key:
            genai.configure(api_key=key)
            self.model = genai.GenerativeModel('gemini-pro')
            self.enabled = True
        else:
            logger.warning("Shadow Proctor disabled: Missing Gemini API key.")

    def generate_probe(self, question_title: str, question_desc: str, code: str) -> dict:
        """
        Generate a targeted follow-up question based on the code implementation.
        """
        if not self.enabled:
            return {
                "question": "Can you explain your approach to this problem and any trade-offs you made?",
                "context": "General explanation requested (AI Probe Offline)"
            }

        prompt = f"""You are a senior technical interviewer. A candidate just submitted code for the following problem:

PROBLEM TITLE: {question_title}
PROBLEM DESCRIPTION: {question_desc}

CANDIDATE CODE:
```python
{code}
```

YOUR TASK:
Analyze the code for specific implementation choices (e.g., choice of algorithm, data structure, edge case handling, or potential bottlenecks). 

Generate EXACTLY ONE targeted, short, and challenging follow-up question that forces the candidate to explain WHY they chose a specific part of their implementation. 

Requirements:
1. Don't ask "How does this code work?"
2. Ask about a SPECIFIC line or choice (e.g., "Why did you choose a hash map here instead of a sorted list?", or "How would your logic handle a null input in the second loop?")
3. The question should be difficult to answer if the code was simply copied.

Respond with ONLY a JSON object:
{{
    "question": "The question text",
    "target_concept": "The technical concept you are probing"
}}
"""
        try:
            response = self.model.generate_content(prompt, generation_config={'temperature': 0.7})
            text = response.text.strip()
            
            # Clean markdown code blocks
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
            if text.startswith('json'):
                text = text[4:].strip()
                
            return json.loads(text)
        except Exception as e:
            logger.error(f"Shadow Probe generation failed: {e}")
            return {
                "question": "Explain the time and space complexity of your specific implementation.",
                "target_concept": "Big O Complexity"
            }


class KeystrokeDynamicsAnalyzer:
    """
    Analyzes typing rhythm (Biometric DNA) to detect participant handover or macros.
    Uses dwell time (keydown-keyup) and flight time (keyup-keydown).
    """
    
    def __init__(self, baseline_keys: int = 50, threshold_z: float = 3.0):
        self.baseline_keys = baseline_keys
        self.threshold_z = threshold_z
        
    def analyze_intervals(self, candidate_id: str, new_intervals: List["KeystrokeInterval"], existing_evidence: "KeystrokeEvidence") -> "KeystrokeEvidence":
        """
        Analyze a batch of keystroke intervals and update evidence.
        """
        import statistics
        
        # Add new intervals to evidence
        existing_evidence.intervals.extend(new_intervals)
        
        # Need enough data for a baseline
        if len(existing_evidence.intervals) < self.baseline_keys:
            existing_evidence.baseline_established = False
            return existing_evidence
            
        existing_evidence.baseline_established = True
        
        # Split into baseline and target (current batch)
        baseline = existing_evidence.intervals[:self.baseline_keys]
        # Analyze the most recent chunk (last 50 keys)
        current_chunk = existing_evidence.intervals[-50:] if len(new_intervals) > 0 else []
        
        if not current_chunk:
            return existing_evidence
            
        # Calculate baseline stats
        dwells_base = [i.dwell_time for i in baseline]
        flights_base = [i.flight_time for i in baseline if i.flight_time > 0]
        
        mean_dwell = statistics.mean(dwells_base)
        std_dwell = statistics.stdev(dwells_base) if len(dwells_base) > 1 else 10
        
        mean_flight = statistics.mean(flights_base) if flights_base else 0
        std_flight = statistics.stdev(flights_base) if len(flights_base) > 1 else 50
        
        # Check current chunk for anomalies
        dwell_anomalies = 0
        flight_anomalies = 0
        
        for interval in current_chunk:
            # Dwell time Z-score
            z_dwell = abs(interval.dwell_time - mean_dwell) / (std_dwell or 1)
            if z_dwell > self.threshold_z:
                dwell_anomalies += 1
                
            # Flight time Z-score
            if interval.flight_time > 0:
                z_flight = abs(interval.flight_time - mean_flight) / (std_flight or 1)
                if z_flight > self.threshold_z:
                    flight_anomalies += 1
                    
        # Calculate consistency score (0-100)
        total_checks = len(current_chunk) * 2
        anomaly_count = dwell_anomalies + flight_anomalies
        
        rhythm_score = int(max(0, 100 - (anomaly_count / (total_checks or 1)) * 300))
        existing_evidence.rhythm_score = rhythm_score
        
        # Determine if it's a high-confidence anomaly
        if rhythm_score < 40:
            existing_evidence.is_anomaly = True
            existing_evidence.anomaly_reason = "Significant shift in typing rhythm detected (Bometric DNA mismatch)"
        else:
            # Don't reset is_anomaly if it was already True (sticky violation)
            # but update reason if it's currently low
            if rhythm_score < 60:
                existing_evidence.anomaly_reason = "Unstable typing rhythm - monitoring for handover"
                
        return existing_evidence


# Demo function
def demo_decision():
    """Demo the decision engine"""
    from models import ResumeEvidence, CodeExecutionEvidence, TestCaseResult
    
    engine = ExplainableDecisionEngine(use_gemini=False)
    
    # Create sample evidence
    resume = ResumeEvidence(
        skills_extracted=["python", "sql", "react"],
        jd_required=["python", "sql", "react", "docker", "kubernetes"],
        match_score=60.0,
        reasoning="Found 3/5 required skills (60% match). Missing: docker, kubernetes.",
        missing_critical=[]
    )
    
    code = [CodeExecutionEvidence(
        question_id="q1",
        question_title="Fibonacci",
        language="python",
        submitted_code="def solution(n): ...",
        test_cases=[
            TestCaseResult(input="5", expected="5", actual="5", passed=True, time_ms=100),
            TestCaseResult(input="10", expected="55", actual="55", passed=True, time_ms=120),
        ],
        pass_rate=100.0,
        avg_time_ms=110.0,
        total_tests=2
    )]
    
    psych = PsychometricEvidence(
        competencies={"resilience": 7, "leadership": 5, "learning": 8},
        weak_areas=["leadership"],
        strong_areas=["learning", "resilience"]
    )
    
    integrity = IntegrityEvidence(
        total_violations=1,
        events=[],
        severity_score=2,
        trustworthiness_rating="Medium"
    )
    
    decision = engine.generate_decision(
        candidate_id="demo_001",
        candidate_name="Demo Candidate",
        resume_evidence=resume,
        code_evidence=code,
        mcq_evidence=[],
        psychometric_evidence=psych,
        integrity_evidence=integrity
    )
    
    logger.info("=== Decision Generated ===")
    logger.info(f"Outcome: {decision.outcome}")
    logger.info(f"Confidence: {decision.confidence}")
    logger.info(f"Reasoning:")
    for r in decision.reasoning:
        logger.info(f"  - {r}")
    logger.info(f"Role Fit: {decision.role_fit}")
    logger.info(f"Next Steps: {decision.next_steps}")
    print(f"\nModel Used: {decision.audit_trail['model_used']}")
    
    return decision


if __name__ == "__main__":
    demo_decision()
