"""
Cygnusa Guardian - Resume Parser (Gatekeeper)
DETERMINISTIC logic - no AI black boxes here
Every decision is explainable with exact reasoning
"""

import re
import uuid
from typing import List, Tuple, Optional, Dict
from models import ResumeEvidence, SuspiciousClaim

import logging

# Configure logger
logger = logging.getLogger("cygnusa-resume")

# Try to import pdfplumber, fallback to basic text extraction
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    logger.warning("pdfplumber not installed. PDF parsing will be limited.")


class ResumeGatekeeper:
    """
    Deterministic resume parser - NO black box.
    Every skill match and score is traceable.
    """
    
    # Common skill variations to normalize
    SKILL_ALIASES = {
        "js": "javascript",
        "ts": "typescript",
        "py": "python",
        "k8s": "kubernetes",
        "postgres": "postgresql",
        "mongo": "mongodb",
        "react.js": "react",
        "reactjs": "react",
        "node.js": "nodejs",
        "node": "nodejs",
        "vue.js": "vue",
        "vuejs": "vue",
        "angular.js": "angular",
        "angularjs": "angular",
        "ml": "machine learning",
        "ai": "artificial intelligence",
        "aws": "amazon web services",
        "gcp": "google cloud platform",
        "azure": "microsoft azure",
        "aws cloud": "amazon web services",
        "api": "api integration",
        "rest": "api integration",
        "micro-services": "microservices",
        "ai/ml": "machine learning",
        "deep learning": "machine learning",
        "stats": "statistics",
    }
    
    def __init__(self, jd_skills: List[str], critical_skills: Optional[List[str]] = None):
        """
        Args:
            jd_skills: All required skills from job description
            critical_skills: Must-have skills (auto-reject if missing)
        """
        self.jd_skills = [self._normalize_skill(s) for s in jd_skills]
        self.critical_skills = [self._normalize_skill(s) for s in (critical_skills or [])]
    
    def _normalize_skill(self, skill: str) -> str:
        """Normalize skill names for consistent matching"""
        skill = skill.lower().strip()
        return self.SKILL_ALIASES.get(skill, skill)
    
    def parse_resume(self, pdf_path: Optional[str] = None, extracted_text: Optional[str] = None) -> ResumeEvidence:
        """
        Parse resume and generate evidence.
        Accepts either a path to a PDF or pre-extracted text.
        """
        # Get text (either from path or provided)
        text = extracted_text if extracted_text else self.extract_text(pdf_path) if pdf_path else ""
        
        # Find matching skills (deterministic matching) with context
        found_skills, skill_context = self._extract_skills_with_context(text)
        
        # Calculate match score
        match_score = self._calculate_match_score(found_skills)
        match_calc = f"({len(found_skills)} matched / {len(self.jd_skills)} required) * 100"
        
        # Find missing critical skills
        missing_critical = [
            s for s in self.critical_skills 
            if s not in found_skills
        ]
        
        # Extract additional info
        experience_years = self._extract_experience_years(text)
        education = self._extract_education(text)
        
        # Extract suspicious claims for verification
        claim_extractor = ClaimExtractor()
        suspicious_claims = claim_extractor.extract_claims(text)
        
        # Generate human-readable reasoning
        reasoning = self._generate_reasoning(
            found_skills, missing_critical, match_score, experience_years
        )
        
        return ResumeEvidence(
            skills_extracted=found_skills,
            skill_context=skill_context,
            jd_required=self.jd_skills,
            match_score=round(match_score, 2),
            match_calculation=match_calc,
            reasoning=reasoning,
            missing_critical=missing_critical,
            experience_years=experience_years,
            education=education,
            suspicious_claims=suspicious_claims
        )
    
    @staticmethod
    def extract_text(pdf_path: str) -> str:
        """Standalone text extraction for O(1) caching"""
        if not pdf_path:
            return ""
            
        # Handle Supabase URLs (must be local for pdfplumber)
        if pdf_path.startswith("http"):
             logger.warning(f"Attempting to parse remote URL {pdf_path}. This might fail if not accessible locally.")
             # In production, we should download this. For now, we assume local file exists in uploads/
             # or the caller passes the correct local path.
             
        if HAS_PDFPLUMBER:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    text = "\n".join([
                        page.extract_text() or "" 
                        for page in pdf.pages
                    ])
                return text.lower()
            except Exception as e:
                logger.error(f"PDF parsing error for {pdf_path}: {e}")
                return ""
        else:
            try:
                with open(pdf_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read().lower()
            except Exception:
                return ""

    def _extract_text(self, pdf_path: str) -> str:
        """Deprecated: Use static extract_text instead"""
        return self.extract_text(pdf_path)
    
    def _extract_skills_with_context(self, text: str) -> Tuple[List[str], Dict[str, str]]:
        """
        Extract skills and return context snippets.
        """
        found = []
        context = {}
        
        for skill in self.jd_skills:
            escaped_skill = re.escape(skill)
            pattern = r'\b' + escaped_skill + r'\b'
            
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                found.append(skill)
                # Extract surrounding context (e.g., 40 chars before/after)
                start = max(0, match.start() - 30)
                end = min(len(text), match.end() + 30)
                snippet = text[start:end].replace("\n", " ").strip()
                context[skill] = f"...{snippet}..."
        
        return list(set(found)), context
    
    def _calculate_match_score(self, found_skills: List[str]) -> float:
        """
        Calculate percentage of required skills found.
        Simple, transparent calculation.
        """
        if not self.jd_skills:
            return 0.0
        
        matched = len(found_skills)
        required = len(self.jd_skills)
        
        return (matched / required) * 100
    
    def _extract_experience_years(self, text: str) -> Optional[int]:
        """
        Extract years of experience from resume.
        Looks for common patterns like "5 years", "5+ years", etc.
        """
        patterns = [
            r'(\d+)\+?\s*years?\s*(?:of\s+)?experience',
            r'experience[:\s]+(\d+)\+?\s*years?',
            r'(\d+)\+?\s*years?\s*(?:in|of|working)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    continue
        
        return None
    
    def _extract_education(self, text: str) -> Optional[str]:
        """Extract highest education level"""
        education_levels = [
            (r'\bph\.?d\.?\b', "PhD"),
            (r'\bmaster\'?s?\b|\bm\.?s\.?\b|\bm\.?tech\b|\bmba\b', "Master's"),
            (r'\bbachelor\'?s?\b|\bb\.?s\.?\b|\bb\.?tech\b|\bb\.?e\.?\b', "Bachelor's"),
            (r'\bassociate\'?s?\b', "Associate's"),
        ]
        
        for pattern, level in education_levels:
            if re.search(pattern, text, re.IGNORECASE):
                return level
        
        return None
    
    def _generate_reasoning(
        self, 
        found_skills: List[str], 
        missing_critical: List[str],
        match_score: float,
        experience_years: Optional[int]
    ) -> str:
        """
        Generate human-readable reasoning for the resume analysis.
        This is what recruiters will see.
        """
        parts = []
        
        # Skill matching summary
        parts.append(
            f"Found {len(found_skills)}/{len(self.jd_skills)} required skills "
            f"({match_score:.1f}% match)"
        )
        
        # Critical skills assessment
        if missing_critical:
            parts.append(
                f"⚠️ Missing critical skills: {', '.join(missing_critical)}"
            )
        elif self.critical_skills:
            parts.append("✓ All critical skills present")
        
        # Experience assessment
        if experience_years is not None:
            parts.append(f"Experience: {experience_years} years detected")
        
        # Missing skills note (non-critical)
        missing_regular = set(self.jd_skills) - set(found_skills) - set(missing_critical)
        if missing_regular and len(missing_regular) <= 3:
            parts.append(f"Missing: {', '.join(list(missing_regular))}")
        elif missing_regular:
            parts.append(f"Missing {len(missing_regular)} other skills")
        
        return ". ".join(parts) + "."
    
    def rank_candidate(self, evidence: ResumeEvidence) -> Tuple[str, str]:
        """
        Rank candidate based on resume evidence.
        Returns: (rank, justification)
        
        Ranks:
        - HIGH_MATCH: Strong candidate, proceed to assessment
        - POTENTIAL: Worth testing, some gaps
        - REJECT: Missing critical skills or too low match
        """
        # Auto-reject if missing critical skills
        if evidence.missing_critical:
            return (
                "REJECT", 
                f"Auto-rejected: Missing critical skills ({', '.join(evidence.missing_critical)})"
            )
        
        # Rank by match score
        if evidence.match_score >= 70:
            return (
                "MATCH",
                f"Strong candidate: {evidence.match_score:.1f}% skill resonance"
            )
        elif evidence.match_score >= 25:
            return (
                "POTENTIAL",
                f"Emerging match ({evidence.match_score:.1f}%). Proceed to verification."
            )
        elif evidence.match_score > 0:
            return (
                "GAP_DETECTED",
                f"Significant gaps ({evidence.match_score:.1f}%). Low technical resonance."
            )
        else:
            return (
                "INCOMPATIBLE",
                "No relevant skills detected for this specific profile."
            )


class ClaimExtractor:
    """
    Extracts and flags suspicious claims from resumes for verification.
    Part of the Claim Probing Engine - detects potential resume fraud.
    """
    
    # Big companies that are commonly faked
    NOTABLE_COMPANIES = [
        "google", "meta", "facebook", "amazon", "apple", "microsoft", "netflix",
        "uber", "airbnb", "stripe", "coinbase", "tesla", "nvidia", "openai",
        "goldman sachs", "mckinsey", "bcg", "bain", "deloitte", "accenture",
        "jpmorgan", "morgan stanley", "samsung", "ibm", "oracle", "salesforce",
        "adobe", "linkedin", "twitter", "x corp", "paypal", "spotify"
    ]
    
    # Patterns for suspicious claims
    CLAIM_PATTERNS = {
        "cgpa": [
            (r'(?:cgpa|gpa|grade)[:\s]*(\d+\.?\d*)\s*/?\s*(?:10|4\.0|4)', "CGPA/GPA Score"),
            (r'(\d+\.?\d*)\s*/\s*(?:10|4\.0|4)\s*(?:cgpa|gpa)', "CGPA/GPA Score"),
            (r'(?:percentage|percent)[:\s]*(\d+\.?\d*)%?', "Academic Percentage"),
        ],
        "leadership": [
            (r'(?:led|managed|headed|directed)\s+(?:a\s+)?team\s+of\s+(\d+)', "Team Leadership"),
            (r'(\d+)\+?\s*(?:direct\s+)?reports', "Team Size"),
            (r'(?:led|managed|oversaw)\s+(\d+)\+?\s*(?:engineers|developers|people)', "People Management"),
        ],
        "impact": [
            (r'(?:increased|improved|boosted|grew)\s+.*?by\s+(\d+)%', "Impact Metric"),
            (r'(?:reduced|decreased|cut)\s+.*?by\s+(\d+)%', "Cost/Time Reduction"),
            (r'(?:saved|generated)\s+\$?([\d,]+(?:k|m|million|thousand)?)', "Financial Impact"),
            (r'(\d+)x\s+(?:improvement|increase|growth)', "Multiplier Claim"),
        ],
        "experience": [
            (r'(\d+)\+?\s*years?\s+(?:of\s+)?experience', "Years of Experience"),
            (r'(?:senior|staff|principal|lead)\s+(?:software\s+)?(?:engineer|developer)', "Seniority Level"),
        ],
        "company": []  # Populated dynamically from NOTABLE_COMPANIES
    }
    
    def __init__(self):
        # Build company patterns
        for company in self.NOTABLE_COMPANIES:
            self.CLAIM_PATTERNS["company"].append(
                (rf'\b{re.escape(company)}\b', f"Employment at {company.title()}")
            )
    
    def extract_claims(self, text: str) -> List[SuspiciousClaim]:
        """
        Extract and flag suspicious claims from resume text.
        Returns a list of SuspiciousClaim objects.
        """
        claims = []
        text_lower = text.lower()
        
        for claim_type, patterns in self.CLAIM_PATTERNS.items():
            for pattern, label in patterns:
                matches = list(re.finditer(pattern, text_lower, re.IGNORECASE))
                for match in matches:
                    # Get context around the match
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].replace("\n", " ").strip()
                    
                    # Determine suspicion level
                    confidence = self._assess_suspicion(claim_type, match, text_lower)
                    
                    # Generate verification prompt
                    verification_prompt = self._generate_verification_prompt(
                        claim_type, label, match.group(0), context
                    )
                    
                    claim = SuspiciousClaim(
                        claim_id=str(uuid.uuid4())[:8],
                        claim_text=match.group(0).strip(),
                        claim_type=claim_type,
                        confidence_flag=confidence,
                        verification_prompt=verification_prompt,
                        context=f"...{context}..."
                    )
                    claims.append(claim)
        
        # Deduplicate similar claims
        return self._deduplicate_claims(claims)
    
    def _assess_suspicion(self, claim_type: str, match, text: str) -> str:
        """
        Assess how suspicious a claim is.
        Returns: 'high', 'medium', or 'low'
        """
        try:
            if claim_type == "cgpa":
                # Extract the numeric value
                value_str = match.group(1)
                value = float(value_str)
                if value >= 9.5 or value >= 3.9:  # Top-tier GPA
                    return "high"
                elif value >= 8.5 or value >= 3.5:
                    return "medium"
                return "low"
            
            elif claim_type == "leadership":
                team_size = int(match.group(1))
                if team_size >= 20:
                    return "high"
                elif team_size >= 10:
                    return "medium"
                return "low"
            
            elif claim_type == "impact":
                # Check for unrealistic percentages or amounts
                value_str = match.group(1).replace(",", "").lower()
                if "m" in value_str or "million" in value_str:
                    return "high"
                try:
                    value = float(value_str.replace("k", "000"))
                    if value >= 100:  # 100% or $100k+
                        return "high"
                    elif value >= 50:
                        return "medium"
                except:
                    pass
                return "medium"
            
            elif claim_type == "company":
                # FAANG companies are always high-value claims
                return "high"
            
            elif claim_type == "experience":
                years = int(match.group(1)) if match.group(1) else 0
                if years >= 10:
                    return "high"
                elif years >= 5:
                    return "medium"
                return "low"
        except (ValueError, IndexError):
            pass
        
        return "medium"
    
    def _generate_verification_prompt(
        self, claim_type: str, label: str, claim_text: str, context: str
    ) -> str:
        """
        Generate a specific verification question for the claim.
        """
        prompts = {
            "cgpa": f"You mentioned achieving {claim_text}. Can you describe a particularly challenging academic project or course that contributed to this grade?",
            "leadership": f"You mentioned leading a team ({claim_text}). Describe a specific conflict or challenge you faced while managing this team and how you resolved it.",
            "impact": f"The resume mentions: '{claim_text}'. Walk us through the exact methodology you used to measure this impact. What were the before/after metrics?",
            "company": f"You've worked at a notable company. Describe the internal tools, team structure, or proprietary processes you encountered there that an outsider wouldn't know.",
            "experience": f"With {claim_text}, what's the most significant evolution you've seen in your field, and how has your approach adapted?"
        }
        return prompts.get(claim_type, f"Tell us more about: {claim_text}")
    
    def _deduplicate_claims(self, claims: List[SuspiciousClaim]) -> List[SuspiciousClaim]:
        """Remove duplicate or overlapping claims."""
        seen = set()
        unique = []
        for claim in claims:
            key = (claim.claim_type, claim.claim_text[:20])
            if key not in seen:
                seen.add(key)
                unique.append(claim)
        return unique

# Demo function for testing
def demo_parse():
    """Demo the resume parser with sample data"""
    # Create a sample text file for testing
    sample_text = """
    John Doe
    Software Engineer with 5 years of experience
    
    Skills: Python, JavaScript, React, Docker, PostgreSQL, Git
    
    Education: Bachelor's in Computer Science
    
    Experience:
    - Built microservices using Python and FastAPI
    - Frontend development with React and TypeScript
    - Container orchestration with Kubernetes
    """
    
    # Write sample to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(sample_text)
        temp_path = f.name
    
    # Parse
    gatekeeper = ResumeGatekeeper(
        jd_skills=["python", "javascript", "react", "docker", "kubernetes", "postgresql"],
        critical_skills=["python", "docker"]
    )
    
    evidence = gatekeeper.parse_resume(temp_path)
    rank, justification = gatekeeper.rank_candidate(evidence)
    
    logger.info("=== Resume Analysis ===")
    logger.info(f"Skills Found: {evidence.skills_extracted}")
    logger.info(f"Match Score: {evidence.match_score}%")
    logger.info(f"Reasoning: {evidence.reasoning}")
    logger.info(f"Rank: {rank}")
    logger.info(f"Justification: {justification}")
    
    # Cleanup
    import os
    os.remove(temp_path)
    
    return evidence


if __name__ == "__main__":
    demo_parse()
