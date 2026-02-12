"""
Cygnusa Guardian - Shared Dependencies

Centralizes all service instances, shared state, and utility functions
used across router modules. Import from here instead of initializing
services in individual routers to ensure singleton behavior.
"""

import os
import logging
import time
from typing import Optional

from supabase import create_client, Client
from dotenv import load_dotenv

from database import Database
from code_executor import CodeSandbox
from decision_engine import ExplainableDecisionEngine, ShadowProctorEngine, KeystrokeDynamicsAnalyzer
from resume_validator import ResumeValidator

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

ENV = os.getenv("ENV", "development")

logger = logging.getLogger("cygnusa-api")

# ---------------------------------------------------------------------------
# Service singletons
# ---------------------------------------------------------------------------

db = Database()
code_sandbox = CodeSandbox()
decision_engine = ExplainableDecisionEngine(use_gemini=True)
shadow_proctor = ShadowProctorEngine()
keystroke_analyzer = KeystrokeDynamicsAnalyzer()
resume_validator = ResumeValidator()

# ---------------------------------------------------------------------------
# Supabase client (cloud storage)
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase.client import ClientOptions
        supabase = create_client(
            SUPABASE_URL,
            SUPABASE_KEY,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
            ),
        )
        logger.info("Supabase client initialized")
    except Exception as e:
        logger.error(f"Supabase init failed (trying fallback): {e}")
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Supabase client initialized (fallback)")
        except Exception as e2:
            logger.error(f"Supabase fallback also failed: {e2}")

# ---------------------------------------------------------------------------
# In-memory shared state
# ---------------------------------------------------------------------------

active_sessions: dict = {}
"""Fast-access cache for candidate profiles currently being assessed."""

share_tokens: dict = {}
"""Mapping of share_token -> {candidate_id, expires_at, created_at}."""

# ---------------------------------------------------------------------------
# Response cache (simple TTL cache for dashboard endpoints)
# ---------------------------------------------------------------------------

_response_cache: dict = {}
_cache_ttl = 30  # seconds


def cache_response(key: str, data: dict, ttl: int = _cache_ttl) -> None:
    """Store a response in the TTL cache."""
    _response_cache[key] = {"data": data, "expires": time.time() + ttl}


def get_cached_response(key: str) -> Optional[dict]:
    """Retrieve a cached response if it hasn't expired, else None."""
    if key in _response_cache:
        entry = _response_cache[key]
        if time.time() < entry["expires"]:
            return entry["data"]
        del _response_cache[key]
    return None


def clear_cache(pattern: Optional[str] = None) -> None:
    """Clear cache entries. If *pattern* is given, only matching keys."""
    if pattern:
        for k in [k for k in _response_cache if pattern in k]:
            del _response_cache[k]
    else:
        _response_cache.clear()


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def add_decision_node(
    candidate_id: str,
    node_type: str,
    title: str,
    description: str,
    impact: str = "neutral",
    evidence_id: str = None,
    predicted_rank: float = None,
) -> None:
    """Record a decision node on the candidate's forensic timeline.

    Automatically persists the updated candidate to the database and
    refreshes the in-memory session cache.
    """
    from models import DecisionNode

    candidate = active_sessions.get(candidate_id) or db.get_candidate(candidate_id)
    if candidate:
        node = DecisionNode(
            node_type=node_type,
            title=title,
            description=description,
            impact=impact,
            evidence_id=evidence_id,
            predicted_rank=predicted_rank,
        )
        if candidate.decision_nodes is None:
            candidate.decision_nodes = []
        candidate.decision_nodes.append(node)
        db.save_candidate(candidate)
        active_sessions[candidate_id] = candidate
        logger.info(f"Decision node recorded: {title} for {candidate_id}")
