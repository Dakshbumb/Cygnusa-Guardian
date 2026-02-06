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
            except:
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



# ==================== Demo MCQs ====================

DEMO_MCQS = {
    # Tech - AI/ML
    "ml_q1": {
        "question": "Which loss function is most commonly used for a binary classification problem?",
        "competency": "Machine Learning",
        "options": {"A": "Mean Squared Error", "B": "Binary Cross-Entropy", "C": "Hinge Loss", "D": "MAE"},
        "correct": "B"
    },
    "ml_q2": {
        "question": "What is the purpose of 'Dropout' in a Neural Network?",
        "competency": "Deep Learning",
        "options": {"A": "Increase learning rate", "B": "Prevent overfitting", "C": "Batch data", "D": "Feature scaling"},
        "correct": "B"
    },
    "ml_q3": {
        "question": "In NLP, what does the 'Attention' mechanism solve?",
        "competency": "NLP",
        "options": {"A": "Memory limits", "B": "Long-range dependencies", "C": "Tokenization speed", "D": "Dictionary size"},
        "correct": "B"
    },
    # Tech - Frontend
    "fe_q1": {
        "question": "Which React hook is used to perform side effects?",
        "competency": "React",
        "options": {"A": "useState", "B": "useEffect", "C": "useMemo", "D": "useReducer"},
        "correct": "B"
    },
    "fe_q2": {
        "question": "What is the Big O complexity of searching an element in a balanced Binary Search Tree?",
        "competency": "Data Structures",
        "options": {"A": "O(1)", "B": "O(n)", "C": "O(log n)", "D": "O(n^2)"},
        "correct": "C"
    },
    "fe_q3": {
        "question": "Which CSS property is used to create a flex container?",
        "competency": "CSS",
        "options": {"A": "position: flex", "B": "display: flex", "C": "float: flex", "D": "align: flex"},
        "correct": "B"
    },
    # Tech - Backend
    "be_q1": {
        "question": "Which HTTP method is typically used to update an existing resource?",
        "competency": "Web APIs",
        "options": {"A": "GET", "B": "POST", "C": "PUT/PATCH", "D": "DELETE"},
        "correct": "C"
    },
    "be_q2": {
        "question": "What is the primary purpose of a database index?",
        "competency": "Databases",
        "options": {"A": "Encrypt data", "B": "Speed up retrieval", "C": "Ensure redundancy", "D": "Validate input"},
        "correct": "B"
    },
    "be_q3": {
        "question": "In Python, which keyword is used to handle exceptions?",
        "competency": "Python",
        "options": {"A": "catch", "B": "error", "C": "try/except", "D": "handle"},
        "correct": "C"
    },
    # Finance - Investment Banking
    "ib_q1": {
        "question": "What does WACC stand for?",
        "competency": "Corporate Finance",
        "options": {"A": "Weighted Average Cost of Capital", "B": "Wide Area Capital Control", "C": "Weekly Asset Cost Calculation", "D": "World Association of Capital Credit"},
        "correct": "A"
    },
    "ib_q2": {
        "question": "In a DCF analysis, what does 'terminal value' represent?",
        "competency": "Valuation",
        "options": {"A": "Value at start", "B": "Value beyond the forecast period", "C": "Liquidated value", "D": "Equity value"},
        "correct": "B"
    },
    "ib_q3": {
        "question": "Which financial statement links Net Income to Cash?",
        "competency": "Accounting",
        "options": {"A": "Balance Sheet", "B": "Income Statement", "C": "Cash Flow Statement", "D": "Equity Statement"},
        "correct": "C"
    },
    # Blockchain
    "bc_q1": {
        "question": "What is a 'Gas fee' in Ethereum?",
        "competency": "Blockchain Mechanics",
        "options": {"A": "Registration fee", "B": "Computation cost", "C": "Insurance tax", "D": "Storage rent"},
        "correct": "B"
    },
    # Cybersecurity
    "sec_q1": {
        "question": "What type of attack involves an attacker placing themselves between two parties?",
        "competency": "Network Security",
        "options": {"A": "Phishing", "B": "Man-in-the-Middle (MITM)", "C": "SQL Injection", "D": "DDoS"},
        "correct": "B"
    },
    "sec_q2": {
        "question": "What is the primary purpose of Salting in password storage?",
        "competency": "Cryptography",
        "options": {"A": "Encrypt password", "B": "Prevent rainbow table attacks", "C": "Speed up hash", "D": "Compress data"},
        "correct": "B"
    },
    # Tech - DevOps & Cloud
    "devops_q1": {
        "question": "What does CI/CD stand for?",
        "competency": "DevOps Practices",
        "options": {"A": "Continuous Integration / Continuous Deployment", "B": "Cloud Infrastructure / Cloud Design", "C": "Control Interface / Connection Design", "D": "Centralized ID / Collaborative Data"},
        "correct": "A"
    },
    "devops_q2": {
        "question": "Which tool is primarily used for Infrastructure as Code (IaC)?",
        "competency": "Tooling",
        "options": {"A": "Jenkins", "B": "Terraform", "C": "Docker", "D": "Excel"},
        "correct": "B"
    },
    "cloud_q1": {
        "question": "In AWS, what is the primary function of an S3 bucket?",
        "competency": "Storage",
        "options": {"A": "Run code", "B": "Object storage", "C": "Database indexing", "D": "Virtual networking"},
        "correct": "B"
    },
    "cloud_q2": {
        "question": "What is 'Serverless' computing?",
        "competency": "Cloud Architecture",
        "options": {"A": "Computing without computers", "B": "Developer doesn't manage servers", "C": "Permanent hardware allocation", "D": "Local execution"},
        "correct": "B"
    },
    # Data Science & Engineering
    "ds_q1": {
        "question": "Which Python library is standard for data manipulation and analysis?",
        "competency": "Tooling",
        "options": {"A": "Flask", "B": "Pandas", "C": "Pytest", "D": "Requests"},
        "correct": "B"
    },
    "ds_q2": {
        "question": "What is p-value used for in statistics?",
        "competency": "Statistics",
        "options": {"A": "Calculate mean", "B": "Test hypothesis significance", "C": "Plot graphs", "D": "Sort data"},
        "correct": "B"
    },
    "de_q1": {
        "question": "What does ETL stand for in data engineering?",
        "competency": "Data Pipelines",
        "options": {"A": "Extract, Transform, Load", "B": "Encrypt, Transfer, List", "C": "Entry, Timing, Logging", "D": "External, Temporary, Local"},
        "correct": "A"
    },
    "de_q2": {
        "question": "In Spark, what is an RDD?",
        "competency": "Distributed Computing",
        "options": {"A": "Random Data Disk", "B": "Resilient Distributed Dataset", "C": "Rapid Delivery Driver", "D": "Remote Data Database"},
        "correct": "B"
    },
    # QA & Testing
    "qa_q1": {
        "question": "What is 'Regression Testing'?",
        "competency": "Testing Methodology",
        "options": {"A": "Testing new features", "B": "Ensuring changes didn't break existing features", "C": "Performance testing", "D": "Security audit"},
        "correct": "B"
    },
    "qa_q2": {
        "question": "What is a 'Unit Test'?",
        "competency": "Testing Levels",
        "options": {"A": "Testing the whole system", "B": "Testing individual small components in isolation", "C": "User acceptance test", "D": "Integration test"},
        "correct": "B"
    },
    # specialized finance
    "fa_q1": {
        "question": "What is the formula for Gross Margin?",
        "competency": "Accounting",
        "options": {"A": "(Revenue - COGS) / Revenue", "B": "Revenue - Expenses", "C": "Net Income / Sales", "D": "Assets - Liabilities"},
        "correct": "A"
    },
    "risk_q1": {
        "question": "What does VAR stand for in risk management?",
        "competency": "Market Risk",
        "options": {"A": "Value at Risk", "B": "Variance as Result", "C": "Variable Asset Rate", "D": "Virtual Access Record"},
        "correct": "A"
    },
    "port_q1": {
        "question": "What is the 'Sharpe Ratio' used for?",
        "competency": "Portfolio Analysis",
        "options": {"A": "Measure return only", "B": "Measure risk-adjusted return", "C": "Calculate dividends", "D": "Track volume"},
        "correct": "B"
    },
    "comp_q1": {
        "question": "What does KYC stand for in banking compliance?",
        "competency": "Regulatory",
        "options": {"A": "Know Your Customer", "B": "Keep Your Capital", "C": "Know Your Competitor", "D": "Key Yield Calculation"},
        "correct": "A"
    },
    "audit_q1": {
        "question": "What is the primary objective of an internal audit?",
        "competency": "Auditing",
        "options": {"A": "Find fraud only", "B": "Evaluate risk management and controls", "C": "Prepare tax returns", "D": "Sign off on IPOs"},
        "correct": "B"
    },
    "tax_q1": {
        "question": "In corporate tax, what is 'VAT'?",
        "competency": "Taxation",
        "options": {"A": "Value Added Tax", "B": "Variable Asset Transfer", "C": "Virtual Account Transaction", "D": "Volume Adjusted Tax"},
        "correct": "A"
    },
    "ftp_q1": {
        "question": "Which of these is a core component of 'Open Banking'?",
        "competency": "FinTech",
        "options": {"A": "Private ledgers", "B": "Standardized APIs for data sharing", "C": "Physical branches", "D": "Centralized ID storage"},
        "correct": "B"
    },
    "fs_q1": {
        "question": "What is a 'Fullstack' engineer expected to handle?",
        "competency": "Engineering",
        "options": {"A": "Only UI", "B": "Only DB", "C": "Both Frontend and Backend", "D": "Only mobile"},
        "correct": "C"
    },
    "quant_q1": {
        "question": "In quantitative finance, what is the 'Black-Scholes' model used for?",
        "competency": "Quantitative Analysis",
        "options": {"A": "Pricing options", "B": "Predicting weather", "C": "Sorting lists", "D": "Managing personnel"},
        "correct": "A"
    },
    "bc_q2": {
        "question": "What is the primary difference between Proof of Work (PoW) and Proof of Stake (PoS)?",
        "competency": "Consensus",
        "options": {"A": "PoW uses hardware, PoS uses capital", "B": "PoW is faster", "C": "PoS is older", "D": "No difference"},
        "correct": "A"
    }
}


# ==================== Demo Questions ====================

DEMO_QUESTIONS = {
    "fibonacci": {
        "title": "Fibonacci Number",
        "description": "Return the nth Fibonacci number (0-indexed). F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2)",
        "template": "def solution(n):\n    # Return nth Fibonacci number\n    pass",
        "test_cases": [
            {"input": 0, "expected": 0},
            {"input": 1, "expected": 1},
            {"input": 5, "expected": 5},
            {"input": 10, "expected": 55},
            {"input": 15, "expected": 610},
        ]
    },
    "palindrome": {
        "title": "Palindrome Check",
        "description": "Check if the given string is a palindrome (reads same forwards and backwards)",
        "template": "def solution(s):\n    # Return True if palindrome, False otherwise\n    pass",
        "test_cases": [
            {"input": "racecar", "expected": True},
            {"input": "hello", "expected": False},
            {"input": "a", "expected": True},
            {"input": "ab", "expected": False},
            {"input": "abba", "expected": True},
        ]
    },
    "two_sum": {
        "title": "Two Sum (Simplified)",
        "description": "Given a sorted list of numbers and a target, return True if any two numbers sum to target",
        "template": "def solution(data):\n    # data = {'nums': [...], 'target': X}\n    # Return True if two nums sum to target\n    pass",
        "test_cases": [
            {"input": {"nums": [1, 2, 3, 4], "target": 5}, "expected": True},
            {"input": {"nums": [1, 2, 3, 4], "target": 10}, "expected": False},
            {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected": True},
            {"input": {"nums": [1, 1, 1, 1], "target": 2}, "expected": True},
        ]
    },
    "reverse_words": {
        "title": "Reverse Words",
        "description": "Reverse the order of words in a sentence",
        "template": "def solution(s):\n    # Return string with words in reverse order\n    pass",
        "test_cases": [
            {"input": "hello world", "expected": "world hello"},
            {"input": "the quick brown fox", "expected": "fox brown quick the"},
            {"input": "a", "expected": "a"},
        ]
    }
}


def demo_execute():
    """Demo the code executor"""
    sandbox = CodeSandbox()
    
    # Test fibonacci solution
    code = """
def solution(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
"""
    
    q = DEMO_QUESTIONS["fibonacci"]
    evidence = sandbox.execute_python(
        code=code,
        test_cases=q["test_cases"],
        question_id="q1_fibonacci",
        question_title=q["title"]
    )
    
    logger.info("=== Code Execution Results ===")
    logger.info(f"Question: {evidence.question_title}")
    logger.info(f"Pass Rate: {evidence.pass_rate}%")
    logger.info(f"Avg Time: {evidence.avg_time_ms}ms")
    logger.info("\nTest Cases:")
    for tc in evidence.test_cases:
        status = "✓" if tc.passed else "✗"
        logger.info(f"  {status} Input: {tc.input} | Expected: {tc.expected} | Got: {tc.actual}")
    
    return evidence


if __name__ == "__main__":
    demo_execute()
