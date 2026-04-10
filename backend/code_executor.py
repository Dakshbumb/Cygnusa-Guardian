"""
Cygnusa Guardian - Code Sandbox
Secure code execution with timeout and safety checks
Every test case result is recorded for full transparency
"""

import subprocess
import json
import time
import tempfile
import os
import logging
from typing import List, Dict, Optional
from models import CodeExecutionEvidence, TestCaseResult

# Configure logger
logger = logging.getLogger("cygnusa-sandbox")


class CodeSandbox:
    """
    Secure code execution sandbox.
    Runs candidate code against test cases with strict limits.
    """
    
    TIMEOUT_SECONDS = 10  # Increased for production robustness
    MAX_OUTPUT_LENGTH = 10000
    MAX_MEMORY_MB = 128  # Memory limit per execution
    
    # Dangerous imports that will be blocked
    BANNED_IMPORTS = [
        'os', 'subprocess', 'sys', 'socket', 'requests', 
        'urllib', 'http', 'ftplib', 'smtplib', 'telnetlib',
        'pickle', 'marshal', 'shelve', 'dbm', 'shutil', 'tempfile',
        'ctypes', 'multiprocessing', 'threading',
        '__builtins__', 'eval', 'exec', 'compile',
        'importlib', '__import__'
    ]
    
    def execute(
        self, 
        code: str, 
        language: str,
        test_cases: List[Dict],
        question_id: str,
        question_title: str = ""
    ) -> CodeExecutionEvidence:
        """
        Generic execution entry point that dispatches based on language.
        """
        language = language.lower()
        if language == "python":
            return self.execute_python(code, test_cases, question_id, question_title)
        elif language == "java":
            return self.execute_java(code, test_cases, question_id, question_title)
        elif language == "cpp":
            return self.execute_cpp(code, test_cases, question_id, question_title)
        else:
            return self._create_unsupported_language_failure(code, language, question_id, question_title, test_cases)

    def execute_python(
        self, 
        code: str, 
        test_cases: List[Dict],
        question_id: str,
        question_title: str = ""
    ) -> CodeExecutionEvidence:
        """
        Execute Python code against test cases.
        Returns evidence with all test results.
        """
        # Security check
        security_error = self._check_security(code)
        if security_error:
            return self._create_security_failure(
                code, "python", question_id, question_title, test_cases, security_error
            )
        
        # Run each test case
        test_results = []
        for tc in test_cases:
            result = self._run_single_test_python(code, tc)
            test_results.append(result)
        
        # Calculate statistics with partial credit support
        # Full pass = 1.0, partial credit = similarity_score/100, fail = 0
        total_score = 0.0
        for r in test_results:
            if r.passed:
                total_score += 1.0
            elif r.partial_credit:
                total_score += r.similarity_score / 100.0  # Weighted partial credit
        
        pass_rate = (total_score / len(test_results)) * 100 if test_results else 0
        avg_time = sum(r.time_ms for r in test_results) / len(test_results) if test_results else 0

        
        return CodeExecutionEvidence(
            question_id=question_id,
            question_title=question_title,
            language="python",
            submitted_code=code,
            test_cases=test_results,
            pass_rate=round(pass_rate, 2),
            avg_time_ms=round(avg_time, 2),
            total_tests=len(test_results)
        )

    def execute_java(
        self, 
        code: str, 
        test_cases: List[Dict],
        question_id: str,
        question_title: str = ""
    ) -> CodeExecutionEvidence:
        """Execute Java code (Currently skeleton - requires JDK)"""
        return self._create_compiler_missing_failure(code, "java", question_id, question_title, test_cases, "javac")

    def execute_cpp(
        self, 
        code: str, 
        test_cases: List[Dict],
        question_id: str,
        question_title: str = ""
    ) -> CodeExecutionEvidence:
        """Execute C++ code (Currently skeleton - requires G++)"""
        return self._create_compiler_missing_failure(code, "cpp", question_id, question_title, test_cases, "g++")

    def _create_compiler_missing_failure(
        self, code: str, language: str, q_id: str, q_title: str, test_cases: List[Dict], compiler: str
    ) -> CodeExecutionEvidence:
        error = f"Environment Error: {compiler} compiler not found in sandbox."
        results = [
            TestCaseResult(
                input=str(tc.get('input', '')),
                expected=str(tc.get('expected', '')),
                actual="ENV_ERROR",
                passed=False,
                time_ms=0,
                error=error
            ) for tc in test_cases
        ]
        return CodeExecutionEvidence(
            question_id=q_id, question_title=q_title, language=language,
            submitted_code=code, test_cases=results, pass_rate=0.0,
            avg_time_ms=0.0, total_tests=len(test_cases)
        )

    def _create_unsupported_language_failure(
        self, code: str, language: str, q_id: str, q_title: str, test_cases: List[Dict]
    ) -> CodeExecutionEvidence:
        error = f"Error: Language '{language}' is not supported by the sandbox."
        results = [
            TestCaseResult(
                input=str(tc.get('input', '')),
                expected=str(tc.get('expected', '')),
                actual="UNSUPPORTED",
                passed=False,
                time_ms=0,
                error=error
            ) for tc in test_cases
        ]
        return CodeExecutionEvidence(
            question_id=q_id, question_title=q_title, language=language,
            submitted_code=code, test_cases=results, pass_rate=0.0,
            avg_time_ms=0.0, total_tests=len(test_cases)
        )
    
    def _check_security(self, code: str) -> Optional[str]:
        """
        Check code for dangerous patterns.
        Returns error message if unsafe, None if safe.
        """
        code_lower = code.lower()
        
        for banned in self.BANNED_IMPORTS:
            # Check various import patterns
            patterns = [
                f"import {banned}",
                f"from {banned}",
                f"__import__('{banned}'",
                f'__import__("{banned}"',
            ]
            for pattern in patterns:
                if pattern in code_lower:
                    return f"Restricted module detected: {banned}"
        
        # Check for dangerous builtins
        dangerous_calls = ['eval(', 'exec(', 'compile(', 'open(', '__import__']
        for call in dangerous_calls:
            if call in code_lower:
                return f"Restricted function detected: {call.rstrip('(')}"
        
        return None
    
    def _create_security_failure(
        self, 
        code: str,
        language: str,
        question_id: str,
        question_title: str,
        test_cases: List[Dict],
        error: str
    ) -> CodeExecutionEvidence:
        """Create evidence for security violation"""
        failed_results = [
            TestCaseResult(
                input=str(tc.get('input', '')),
                expected=str(tc.get('expected', '')),
                actual="BLOCKED",
                passed=False,
                time_ms=0,
                error=error
            )
            for tc in test_cases
        ]
        
        return CodeExecutionEvidence(
            question_id=question_id,
            question_title=question_title,
            language=language,
            submitted_code=code,
            test_cases=failed_results,
            pass_rate=0.0,
            avg_time_ms=0.0,
            total_tests=len(test_cases)
        )

    
    def _run_single_test_python(self, code: str, test_case: Dict) -> TestCaseResult:
        """
        Run code against a single test case.
        Uses subprocess with timeout for safety.
        """
        # Build test wrapper
        test_code = self._build_test_wrapper(code, test_case['input'])
        
        try:
            # Create temp file for code
            with tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.py', 
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(test_code)
                temp_path = f.name
            
            # Execute with timeout
            start_time = time.time()
            result = subprocess.run(
                ['python', temp_path],
                capture_output=True,
                timeout=self.TIMEOUT_SECONDS,
                text=True,
                env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
            )
            execution_time = (time.time() - start_time) * 1000
            
            # Parse output
            if result.returncode == 0:
                try:
                    output_data = json.loads(result.stdout.strip())
                    actual_output = output_data.get('result')
                    error = None
                except json.JSONDecodeError:
                    actual_output = result.stdout.strip()[:self.MAX_OUTPUT_LENGTH]
                    error = "Output parsing error"
            else:
                actual_output = "ERROR"
                error = result.stderr.strip()[:500] if result.stderr else "Unknown error"
            
            # Compare results
            expected = test_case['expected']
            passed = self._compare_outputs(actual_output, expected)
            
            # Calculate similarity for partial credit
            similarity = 100.0 if passed else self._calculate_similarity(actual_output, expected)
            partial_credit = not passed and similarity >= 50.0  # Award partial credit for 50%+ similarity
            
            return TestCaseResult(
                input=str(test_case['input']),
                expected=str(expected),
                actual=str(actual_output),
                passed=passed,
                time_ms=round(execution_time, 2),
                error=error,
                similarity_score=similarity,
                partial_credit=partial_credit
            )

            
        except subprocess.TimeoutExpired:
            return TestCaseResult(
                input=str(test_case['input']),
                expected=str(test_case['expected']),
                actual="TIMEOUT",
                passed=False,
                time_ms=self.TIMEOUT_SECONDS * 1000,
                error=f"Execution exceeded {self.TIMEOUT_SECONDS}s time limit"
            )
        except Exception as e:
            return TestCaseResult(
                input=str(test_case['input']),
                expected=str(test_case['expected']),
                actual="EXECUTION_ERROR",
                passed=False,
                time_ms=0,
                error=str(e)[:200]
            )
        finally:
            # Cleanup temp file
            try:
                os.remove(temp_path)
            except OSError:
                pass
    
    def _build_test_wrapper(self, code: str, test_input) -> str:
        """Build the test execution wrapper"""
        return f'''
import json
import sys

def limit_resources():
    # Set maximum memory usage (address space) in bytes
    memory_limit = {self.MAX_MEMORY_MB} * 1024 * 1024
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
    except (ImportError, Exception):
        # On some systems (like Windows), resource module might have limited functionality or be missing
        pass

# Set limits before running candidate code
limit_resources()

# Candidate's code
{code}

# Test execution
try:
    test_input = {repr(test_input)}
    result = solution(test_input)
    print(json.dumps({{"result": result}}))
except MemoryError:
    print(json.dumps({{"error": "Memory limit exceeded"}}))
    sys.exit(2)
except Exception as e:
    print(json.dumps({{"error": f"{{type(e).__name__}}: {{str(e)}}"}}))
    sys.exit(1)
'''
    
    def _compare_outputs(self, actual, expected) -> bool:
        """
        Compare actual output with expected.
        Handles type coercion for common cases.
        """
        # Direct comparison
        if actual == expected:
            return True
        
        # String comparison
        if str(actual).strip() == str(expected).strip():
            return True
        
        # Numeric comparison (handles float precision)
        try:
            if float(actual) == float(expected):
                return True
        except (ValueError, TypeError):
            pass
        
        # Boolean comparison
        if isinstance(expected, bool):
            return actual == expected
        
        # List comparison (order matters)
        if isinstance(expected, list) and isinstance(actual, list):
            return actual == expected
        
        return False

    def _calculate_similarity(self, actual, expected) -> float:
        """
        Calculate similarity score (0-100) between actual and expected output.
        Uses Levenshtein distance for string comparison.
        """
        str_actual = str(actual).strip()
        str_expected = str(expected).strip()
        
        # Exact match = 100%
        if str_actual == str_expected:
            return 100.0
        
        # Empty outputs
        if not str_actual or not str_expected:
            return 0.0
        
        # Levenshtein distance-based similarity
        def levenshtein_distance(s1, s2):
            if len(s1) < len(s2):
                return levenshtein_distance(s2, s1)
            if len(s2) == 0:
                return len(s1)
            
            previous_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            
            return previous_row[-1]
        
        distance = levenshtein_distance(str_actual, str_expected)
        max_len = max(len(str_actual), len(str_expected))
        similarity = ((max_len - distance) / max_len) * 100
        
        # Also check for numeric near-misses
        try:
            actual_num = float(str_actual)
            expected_num = float(str_expected)
            if expected_num != 0:
                pct_diff = abs(actual_num - expected_num) / abs(expected_num)
                if pct_diff < 0.01:  # Within 1%
                    similarity = max(similarity, 95.0)
                elif pct_diff < 0.05:  # Within 5%
                    similarity = max(similarity, 75.0)
                elif pct_diff < 0.10:  # Within 10%
                    similarity = max(similarity, 50.0)
        except (ValueError, TypeError):
            pass
        
        return round(similarity, 1)


# ---------------------------------------------------------------------------
# Question Banks (loaded from external JSON files)
# Keeps data separate from logic â€” a standard engineering practice.
# ---------------------------------------------------------------------------

_DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_json(filename: str) -> dict:
    """Load a JSON data file from the backend directory."""
    path = os.path.join(_DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


DEMO_MCQS: Dict[str, dict] = _load_json("mcq_questions.json")
"""Role-specific MCQs served by routers/assessment.py."""

DEMO_QUESTIONS: Dict[str, dict] = _load_json("coding_questions.json")
"""Coding challenges with test cases, used by routers/assessment.py and CodeSandbox."""

