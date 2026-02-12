"""
Cygnusa Guardian - FastAPI Application Entry Point

Initializes the FastAPI application, configures middleware, and
includes all domain-specific routers. Service singletons and shared
state are managed in ``dependencies.py``; endpoint logic lives in
the ``routers/`` package.
"""

import os
import uuid
import time
import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from datetime import datetime

# ---------------------------------------------------------------------------
# Environment & Logging
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("cygnusa_guardian.log"),
    ],
)
logger = logging.getLogger("cygnusa-api")

ENV = os.getenv("ENV", "development")

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Cygnusa Guardian API",
    description="Glass-Box AI Hiring System - Every decision is explainable",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://cygnusa-guardian.vercel.app",
        "https://cygnusa-guardian-one.vercel.app",
    ],
    allow_origin_regex=r"https://cygnusa-guardian.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log non-trivial requests with timing. Slow requests (>500ms) are always logged."""
    skip_paths = ["/health", "/api/health", "/snapshots"]
    should_log = not any(request.url.path.startswith(p) for p in skip_paths)

    if should_log and ENV != "production":
        logger.info(f"{request.method} {request.url.path}")

    start = time.time()
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        if duration_ms > 500 or (should_log and ENV != "production"):
            logger.info(f"{response.status_code} {request.url.path} ({duration_ms:.0f}ms)")
        return response
    except Exception as e:
        logger.error(f"Request failed: {e}", exc_info=True)
        raise


# ---------------------------------------------------------------------------
# Static files & directories
# ---------------------------------------------------------------------------

os.makedirs("uploads", exist_ok=True)
os.makedirs("snapshots", exist_ok=True)

app.mount("/snapshots", StaticFiles(directory="snapshots"), name="snapshots")

# ---------------------------------------------------------------------------
# Health endpoints (kept in main for simplicity)
# ---------------------------------------------------------------------------

from dependencies import db, decision_engine  # noqa: E402


@app.get("/")
def root():
    """API root health check."""
    return {
        "service": "Cygnusa Guardian",
        "tagline": "Glass-Box Hiring Intelligence",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/health")
def health_check():
    """Detailed health check with database and AI engine status."""
    db_ok = False
    user_count = candidate_count = 0
    db_error = None

    try:
        db_ok = db.check_connection()
        if db_ok:
            try:
                user_count = len(db.get_all_users())
                candidate_count = len(db.get_all_candidates())
            except Exception as e:
                db_error = f"count_error: {e}"
    except Exception as e:
        db_error = str(e)

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else f"connection_failed ({db_error})" if db_error else "not_configured",
        "counts": {"users": user_count, "candidates": candidate_count},
        "ai_engine": "gemini" if decision_engine.use_gemini else "fallback",
        "timestamp": datetime.now().isoformat(),
        "env": ENV,
    }


# ---------------------------------------------------------------------------
# Include routers
# ---------------------------------------------------------------------------

from routers.auth import router as auth_router  # noqa: E402
from routers.candidates import router as candidates_router  # noqa: E402
from routers.resume import router as resume_router  # noqa: E402
from routers.assessment import router as assessment_router  # noqa: E402
from routers.integrity import router as integrity_router  # noqa: E402
from routers.reports import router as reports_router  # noqa: E402
from routers.dashboard import router as dashboard_router  # noqa: E402

app.include_router(auth_router)
app.include_router(candidates_router)
app.include_router(resume_router)
app.include_router(assessment_router)
app.include_router(integrity_router)
app.include_router(reports_router)
app.include_router(dashboard_router)

# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler. Masks internal details in production."""
    logger.error(f"Unhandled exception: {exc}\n{traceback.format_exc()}")

    if ENV == "production":
        return JSONResponse(
            status_code=500,
            content={
                "error": "An internal server error occurred. Please contact support.",
                "request_id": uuid.uuid4().hex[:8],
            },
        )

    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "path": str(request.url),
        },
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
