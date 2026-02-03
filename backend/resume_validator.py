import os
import re
import magic
import pdfplumber
import docx
import io
import json
import logging
from typing import Dict, Tuple, List, Optional
from fastapi import UploadFile
import google.generativeai as genai

logger = logging.getLogger("cygnusa-validator")

class ResumeValidator:
    """
    Multi-layer resume validation pipeline.
    Rejects non-resume files before expensive processing.
    """
    
    ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc'}
    ALLOWED_MIME_TYPES = {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    }
    MIN_FILE_SIZE = 10 * 1024  # 10KB
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MIN_WORD_COUNT = 20  # Adjusted for freshers
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.has_ai = True
        else:
            logger.warning("GEMINI_API_KEY not found. Layer 3 validation will be skipped.")
            self.has_ai = False

    async def validate_file(self, file: UploadFile) -> Tuple[bool, str, str]:
        """
        Validates uploaded file through all layers.
        
        Returns:
            (is_valid, error_code, error_message)
        """
        # Read content for validation
        content = await file.read()
        file_size = len(content)
        file.file.seek(0)  # Reset for later extraction
        
        # Layer 1: File type validation (Extensions, MIME, Magic, Size)
        is_valid, error_code, error = self._validate_file_type(file, content, file_size)
        if not is_valid:
            return False, error_code, error
        
        # Extract text for content validation
        extracted_text = self._extract_text(content, file.filename)
        if not extracted_text or len(extracted_text.strip()) < 10:
            return False, "not_a_resume", "Unable to extract meaningful text from file."
        
        # Layer 2: Content structure validation (Regex)
        is_valid, error_code, error = self._validate_content_structure(extracted_text)
        if not is_valid:
            return False, error_code, error
        
        # Layer 3: AI classification (Gemini Flash)
        if self.has_ai:
            is_valid, error_code, error = await self._ai_classify_document(extracted_text)
            if not is_valid:
                return False, error_code, error
        
        return True, "valid", "Valid resume file"

    def _validate_file_type(self, file: UploadFile, content: bytes, size: int) -> Tuple[bool, str, str]:
        """Layer 1: Check extension, MIME type, magic bytes, size"""
        
        # Check size
        if size < self.MIN_FILE_SIZE:
            return False, "file_too_small", f"File too small ({size/1024:.1f}KB). Minimum 10KB required."
        if size > self.MAX_FILE_SIZE:
            return False, "file_too_large", f"File too large ({size/(1024*1024):.1f}MB). Maximum 5MB allowed."
        
        # Check extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            return False, "invalid_format", f"Unsupported file extension: {ext}. Only PDF and DOCX are allowed."
        
        # Check magic bytes / MIME type
        mime = magic.from_buffer(content, mime=True)
        if mime not in self.ALLOWED_MIME_TYPES:
            # Extra check for some DOCX variants or PDF headers
            if not (mime == 'application/octet-stream' and ext == '.docx'):
                return False, "invalid_format", f"MIME type mismatch: {mime}. File signature does not match extension."

        return True, "", ""

    def _validate_content_structure(self, text: str) -> Tuple[bool, str, str]:
        """Layer 2: Check for resume-specific patterns and sections"""
        
        # Word count check
        words = text.split()
        if len(words) < self.MIN_WORD_COUNT:
            return False, "file_too_small", f"Too few words ({len(words)}). Standard resumes usually have at least {self.MIN_WORD_COUNT} words."
        
        # Contact info check
        has_email = self._detect_email(text)
        has_phone = self._detect_phone(text)
        
        if not has_email and not has_phone:
            return False, "missing_contact", "No email address or phone number detected. Professional resumes must include contact info."
        
        # Section detection
        sections = self._detect_resume_sections(text)
        if len(sections) < 1:  # At least one major section required
             return False, "not_a_resume", "No standard resume sections (Experience, Education, Skills) detected."
             
        return True, "", ""

    async def _ai_classify_document(self, text: str) -> Tuple[bool, str, str]:
        """Layer 3: AI-powered document classification"""
        
        prompt = f"""
        Analyze this document and classify it as:
        1. RESUME - A professional resume/CV containing career information
        2. COVER_LETTER - A cover letter or application letter
        3. OTHER - Any other document type (code, article, random text)

        Document text (first 800 words):
        {text[:2000]}

        Respond ONLY with valid JSON:
        {{
          "classification": "RESUME" | "COVER_LETTER" | "OTHER",
          "confidence": 0.0 to 1.0,
          "reason": "brief explanation",
          "detected_sections": ["section1", "section2", ...]
        }}
        """
        
        try:
            response = await self.model.generate_content_async(prompt)
            # Clean JSON response
            text_res = response.text.strip()
            if "```json" in text_res:
                text_res = text_res.split("```json")[1].split("```")[0].strip()
            
            data = json.loads(text_res)
            
            if data["classification"] == "COVER_LETTER":
                return False, "cover_letter", f"Cover letter detected. Please upload a resume/CV instead. Reason: {data.get('reason')}"
            
            if data["classification"] == "OTHER":
                return False, "not_a_resume", f"Document does not appear to be a resume. Reason: {data.get('reason')}"
            
            if data["classification"] == "RESUME" and data["confidence"] < 0.6:
                 return False, "not_a_resume", "Low confidence in resume classification. Please ensure the document is clear."
                 
            return True, "", ""
            
        except Exception as e:
            logger.error(f"AI Classification error: {e}")
            return True, "", ""  # Fallback: ignore Layer 3 if AI fails

    def _extract_text(self, content: bytes, filename: str) -> str:
        """Extract text from PDF/DOCX bytes"""
        ext = os.path.splitext(filename)[1].lower()
        text = ""
        
        try:
            if ext == '.pdf':
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    text = "\n".join([page.extract_text() or "" for page in pdf.pages])
            elif ext in ['.docx', '.doc']:
                doc = docx.Document(io.BytesIO(content))
                text = "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            
        return text

    def _detect_email(self, text: str) -> bool:
        """Check if text contains valid email address"""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        return bool(re.search(email_pattern, text))
    
    def _detect_phone(self, text: str) -> bool:
        """Check if text contains phone number"""
        phone_patterns = [
            r'\+?1?\d{9,15}',  # International
            r'\(\d{3}\)\s*\d{3}-\d{4}',  # (123) 456-7890
            r'\d{3}-\d{3}-\d{4}',  # 123-456-7890
        ]
        return any(re.search(pattern, text) for pattern in phone_patterns)
    
    def _detect_resume_sections(self, text: str) -> List[str]:
        """Detect common resume section headers"""
        sections = []
        section_keywords = {
            'experience': r'(work experience|professional experience|employment|work history|career summary)',
            'education': r'(education|academic|qualifications|degrees|educational background)',
            'skills': r'(skills|technical skills|competencies|expertise|technologies)',
            'projects': r'(projects|personal projects|portfolio)',
        }
        
        text_lower = text.lower()
        for section_name, pattern in section_keywords.items():
            if re.search(pattern, text_lower):
                sections.append(section_name)
        
        return sections
