    """
Cygnusa Guardian - Resume Parser (Gatekeeper)
DETERMINISTIC logic - no AI black boxes here
Every decision is explainable with exact reasoning
"""

import re
from typing import List, Tuple, Optional, Dict
from models import ResumeEvidence

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
    
    def parse_resume(self, pdf_path: str) -> ResumeEvidence:
        """
        Parse resume and generate evidence.
        Returns fully traceable evidence object.
        """
        # Extract text from PDF
        text = self._extract_text(pdf_path)
        
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
            education=education
        )
    
    def _extract_text(self, pdf_path: str) -> str:
        """Extract text from PDF file"""
        if HAS_PDFPLUMBER:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    text = "\n".join([
                        page.extract_text() or "" 
                        for page in pdf.pages
                    ])
                return text.lower()
            except Exception as e:
                logger.error(f"PDF parsing error: {e}")
                return ""
        else:
            # Fallback: try reading as text (for .txt files or testing)
            try:
                with open(pdf_path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read().lower()
            except Exception:
                return ""
    
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
        if evidence.match_score >= 80:
            return (
                "HIGH_MATCH",
                f"Strong candidate: {evidence.match_score:.1f}% skill match"
            )
        elif evidence.match_score >= 50:
            return (
                "POTENTIAL",
                f"Moderate match ({evidence.match_score:.1f}%). Consider for testing."
            )
        else:
            return (
                "REJECT",
                f"Low match ({evidence.match_score:.1f}%). Below 50% threshold."
            )


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
