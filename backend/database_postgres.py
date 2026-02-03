"""
Cygnusa Guardian - PostgreSQL Database Adapter
Supports both SQLite (default) and PostgreSQL via environment variable
"""

import os
import json
from typing import Optional, List
from datetime import datetime
from abc import ABC, abstractmethod
from models import CandidateProfile, IntegrityEvent, JobDescription

# Check for PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False


class DatabaseAdapter(ABC):
    """Abstract base class for database operations"""
    
    @abstractmethod
    def save_candidate(self, candidate: CandidateProfile) -> None:
        pass
    
    @abstractmethod
    def get_candidate(self, candidate_id: str) -> Optional[CandidateProfile]:
        pass
    
    @abstractmethod
    def get_all_candidates(self, status: Optional[str] = None) -> List[CandidateProfile]:
        pass
    
    @abstractmethod
    def delete_candidate(self, candidate_id: str) -> bool:
        pass
    
    @abstractmethod
    def log_integrity_event(self, candidate_id: str, event: IntegrityEvent) -> None:
        pass
    
    @abstractmethod
    def get_integrity_logs(self, candidate_id: str) -> List[IntegrityEvent]:
        pass
    
    @abstractmethod
    def get_integrity_summary(self, candidate_id: str) -> dict:
        pass
    
    @abstractmethod
    def save_job_description(self, jd: JobDescription) -> None:
        pass
    
    @abstractmethod
    def get_job_description(self, jd_id: str) -> Optional[JobDescription]:
        pass
    
    @abstractmethod
    def get_all_job_descriptions(self) -> List[JobDescription]:
        pass


class PostgreSQLDatabase(DatabaseAdapter):
    """PostgreSQL implementation of the database adapter"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.init_db()
    
    def _get_connection(self):
        return psycopg2.connect(self.connection_string)
    
    def init_db(self):
        """Initialize PostgreSQL tables"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                # Candidates table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS candidates (
                        id VARCHAR(50) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        job_title VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'pending',
                        data JSONB,
                        created_at TIMESTAMP WITH TIME ZONE,
                        updated_at TIMESTAMP WITH TIME ZONE
                    )
                """)
                
                # Integrity logs
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS integrity_logs (
                        id SERIAL PRIMARY KEY,
                        candidate_id VARCHAR(50) NOT NULL,
                        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                        event_type VARCHAR(100) NOT NULL,
                        severity VARCHAR(50) NOT NULL,
                        context TEXT,
                        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
                    )
                """)
                
                # Job descriptions
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS job_descriptions (
                        id VARCHAR(50) PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        data JSONB,
                        created_at TIMESTAMP WITH TIME ZONE
                    )
                """)
                
                # Indexes
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_pg_candidates_status ON candidates(status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_pg_integrity_candidate ON integrity_logs(candidate_id)")
                
                conn.commit()
    
    def save_candidate(self, candidate: CandidateProfile) -> None:
        """Insert or update candidate profile"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO candidates (id, name, email, job_title, status, data, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        job_title = EXCLUDED.job_title,
                        status = EXCLUDED.status,
                        data = EXCLUDED.data,
                        updated_at = EXCLUDED.updated_at
                """, (
                    candidate.id,
                    candidate.name,
                    candidate.email,
                    candidate.job_title,
                    candidate.status,
                    candidate.model_dump_json(),
                    candidate.created_at,
                    datetime.now().isoformat()
                ))
                conn.commit()
    
    def get_candidate(self, candidate_id: str) -> Optional[CandidateProfile]:
        """Retrieve candidate by ID"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT data FROM candidates WHERE id = %s", (candidate_id,))
                row = cursor.fetchone()
                if row:
                    return CandidateProfile.model_validate_json(row[0])
                return None
    
    def get_all_candidates(self, status: Optional[str] = None) -> List[CandidateProfile]:
        """Get all candidates, optionally filtered by status"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                if status:
                    cursor.execute(
                        "SELECT data FROM candidates WHERE status = %s ORDER BY created_at DESC",
                        (status,)
                    )
                else:
                    cursor.execute("SELECT data FROM candidates ORDER BY created_at DESC")
                
                return [CandidateProfile.model_validate_json(row[0]) for row in cursor.fetchall()]
    
    def delete_candidate(self, candidate_id: str) -> bool:
        """Delete candidate and associated logs"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM integrity_logs WHERE candidate_id = %s", (candidate_id,))
                cursor.execute("DELETE FROM candidates WHERE id = %s", (candidate_id,))
                conn.commit()
                return cursor.rowcount > 0
    
    def log_integrity_event(self, candidate_id: str, event: IntegrityEvent) -> None:
        """Log a single integrity violation"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO integrity_logs (candidate_id, timestamp, event_type, severity, context)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    candidate_id,
                    event.timestamp,
                    event.event_type,
                    event.severity,
                    event.context
                ))
                conn.commit()
    
    def get_integrity_logs(self, candidate_id: str) -> List[IntegrityEvent]:
        """Get all integrity events for a candidate"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT timestamp, event_type, severity, context
                    FROM integrity_logs 
                    WHERE candidate_id = %s
                    ORDER BY timestamp ASC
                """, (candidate_id,))
                
                return [
                    IntegrityEvent(
                        timestamp=str(row[0]),
                        event_type=row[1],
                        severity=row[2],
                        context=row[3]
                    )
                    for row in cursor.fetchall()
                ]
    
    def get_integrity_summary(self, candidate_id: str) -> dict:
        """Get aggregated integrity stats"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT severity, COUNT(*) as count
                    FROM integrity_logs
                    WHERE candidate_id = %s
                    GROUP BY severity
                """, (candidate_id,))
                
                counts = {row[0]: row[1] for row in cursor.fetchall()}
                return {
                    "total": sum(counts.values()),
                    "by_severity": counts
                }
    
    def save_job_description(self, jd: JobDescription) -> None:
        """Save job description"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO job_descriptions (id, title, data, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        title = EXCLUDED.title,
                        data = EXCLUDED.data
                """, (jd.id, jd.title, jd.model_dump_json(), datetime.now().isoformat()))
                conn.commit()
    
    def get_job_description(self, jd_id: str) -> Optional[JobDescription]:
        """Get job description by ID"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT data FROM job_descriptions WHERE id = %s", (jd_id,))
                row = cursor.fetchone()
                if row:
                    return JobDescription.model_validate_json(row[0])
                return None
    
    def get_all_job_descriptions(self) -> List[JobDescription]:
        """Get all job descriptions"""
        with self._get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT data FROM job_descriptions ORDER BY created_at DESC")
                return [JobDescription.model_validate_json(row[0]) for row in cursor.fetchall()]


def create_database() -> DatabaseAdapter:
    """
    Factory function to create the appropriate database adapter.
    Uses DATABASE_URL environment variable if set, otherwise falls back to SQLite.
    """
    database_url = os.getenv("DATABASE_URL")
    
    if database_url and POSTGRES_AVAILABLE:
        print(f"🐘 Using PostgreSQL database")
        return PostgreSQLDatabase(database_url)
    else:
        if database_url and not POSTGRES_AVAILABLE:
            print("⚠️ DATABASE_URL set but psycopg2 not installed, falling back to SQLite")
        else:
            print("📦 Using SQLite database (cygnusa.db)")
        
        # Import and use existing SQLite database
        from database import Database
        return Database()
