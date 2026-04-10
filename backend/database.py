"""
Cygnusa Guardian - Database Layer
SQLAlchemy for cross-database support (SQLite/PostgreSQL)
"""

import os
import json
import logging
from typing import Optional, List
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base
from models import CandidateProfile, IntegrityEvent, JobDescription, User, UserRole

logger = logging.getLogger("cygnusa-db")

Base = declarative_base()

class CandidateModel(Base):
    __tablename__ = "candidates"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    job_title = Column(String)
    status = Column(String, default='pending')
    data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (Index('idx_candidates_status', 'status'),)

class IntegrityLogModel(Base):
    __tablename__ = "integrity_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(String, ForeignKey('candidates.id'), nullable=False)
    timestamp = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    context = Column(Text)
    
    __table_args__ = (Index('idx_integrity_candidate', 'candidate_id'),)

class JobDescriptionModel(Base):
    __tablename__ = "job_descriptions"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserModel(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True)
    role = Column(String, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)  # nullable for migration safety
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (Index('idx_users_email', 'email'),)

class Database:
    def __init__(self, db_url: Optional[str] = None):
        if not db_url:
            db_url = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URI") or "sqlite:///./cygnusa.db"
        
        # Handle Heroku/Railway style postgres:// vs postgresql://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
            
        self.engine = create_engine(
            db_url, 
            connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {}
        )
        self.session_factory = sessionmaker(bind=self.engine)
        self.Session = scoped_session(self.session_factory)
        self.init_db()
    
    def init_db(self):
        """Initialize database tables and run safe column migrations."""
        Base.metadata.create_all(self.engine)
        self._migrate_add_password_hash()

    def _migrate_add_password_hash(self):
        """Safely add password_hash column to users table if it doesn't exist.
        Compatible with SQLite and PostgreSQL.
        """
        from sqlalchemy import text
        with self.engine.connect() as conn:
            try:
                # Check column exists first
                from sqlalchemy import inspect
                inspector = inspect(self.engine)
                columns = [c['name'] for c in inspector.get_columns('users')]
                if 'password_hash' not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))
                    conn.commit()
                    logger.info("DB migration: added password_hash column to users table")
            except Exception as e:
                # Column already exists or table doesn't exist yet — both are fine
                logger.debug(f"Migration skip (expected): {e}")
        
    def check_connection(self) -> bool:
        """Verify database connectivity"""
        try:
            from sqlalchemy import text
            with self.session_factory() as session:
                session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database connection check failed: {e}")
            return False
    
    @staticmethod
    def _deep_sanitize_nulls(obj):
        """Recursively strip null characters from any string in a dict/list structure"""
        if isinstance(obj, str):
            return obj.replace('\x00', '').replace('\u0000', '')
        if isinstance(obj, dict):
            return {k: Database._deep_sanitize_nulls(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [Database._deep_sanitize_nulls(i) for i in obj]
        return obj

    # ==================== Candidate Operations ====================
    
    def save_candidate(self, candidate: CandidateProfile) -> None:
        """Insert or update candidate profile"""
        session = self.Session()
        try:
            db_candidate = session.query(CandidateModel).filter(CandidateModel.id == candidate.id).first()
            sanitized_data = self._deep_sanitize_nulls(candidate.model_dump())
            
            if db_candidate:
                db_candidate.name = candidate.name
                db_candidate.email = candidate.email
                db_candidate.job_title = candidate.job_title
                db_candidate.status = candidate.status
                db_candidate.data = sanitized_data
                db_candidate.updated_at = datetime.utcnow()
            else:
                db_candidate = CandidateModel(
                    id=candidate.id,
                    name=candidate.name,
                    email=candidate.email,
                    job_title=candidate.job_title,
                    status=candidate.status,
                    data=sanitized_data,
                    created_at=datetime.fromisoformat(candidate.created_at) if hasattr(candidate, 'created_at') and candidate.created_at else datetime.utcnow()
                )
                session.add(db_candidate)
            
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()
    
    def get_candidate(self, candidate_id: str) -> Optional[CandidateProfile]:
        """Retrieve candidate by ID"""
        session = self.Session()
        try:
            db_candidate = session.query(CandidateModel).filter(CandidateModel.id == candidate_id).first()
            if db_candidate:
                try:
                    return CandidateProfile.model_validate(db_candidate.data)
                except Exception as ve:
                    # Forensic Recovery: If strict validation fails due to legacy schema mismatches,
                    # try to return a basic profile to avoid a 500 error.
                    logger.warning(f"Validation failed for {candidate_id}, using loose recovery: {ve}")
                    # Basic reconstruction
                    data = db_candidate.data or {}
                    return CandidateProfile(
                        id=data.get('id', candidate_id),
                        name=data.get('name', 'Unknown'),
                        email=data.get('email', 'unknown@example.com'),
                        status=data.get('status', 'pending'),
                        job_title=data.get('job_title', 'Software Engineer')
                    )
            return None
        finally:
            self.Session.remove()
    
    def get_all_candidates(self, status: Optional[str] = None) -> List[CandidateProfile]:
        """Get all candidates, optionally filtered by status"""
        session = self.Session()
        try:
            query = session.query(CandidateModel)
            if status:
                query = query.filter(CandidateModel.status == status)
            
            rows = query.order_by(CandidateModel.created_at.desc()).all()
            return [CandidateProfile.model_validate(row.data) for row in rows]
        finally:
            self.Session.remove()

    def get_candidates_summary(self, status: Optional[str] = None) -> List[dict]:
        """Fetch essential candidate columns + decoded JSON fields for list views (Dashboard).

        Extracts outcome, overall_score, and integrity_score from the data JSON blob
        so the dashboard can render verdict chips and score bars without loading every candidate.
        """
        session = self.Session()
        try:
            query = session.query(CandidateModel)
            if status:
                query = query.filter(CandidateModel.status == status)

            rows = query.order_by(CandidateModel.created_at.desc()).all()

            result = []
            for row in rows:
                data = row.data or {}

                # --- outcome ---
                final_decision = data.get("final_decision") or {}
                outcome = final_decision.get("outcome", "PENDING") if isinstance(final_decision, dict) else "PENDING"

                # --- overall_score (resume match_score) ---
                resume_evidence = data.get("resume_evidence") or {}
                overall_score = 0.0
                if isinstance(resume_evidence, dict):
                    overall_score = float(resume_evidence.get("match_score") or 0)

                # --- integrity_score (100 - violations*10, floored at 0) ---
                integrity_evidence = data.get("integrity_evidence") or {}
                integrity_score = 100
                if isinstance(integrity_evidence, dict):
                    violations = int(integrity_evidence.get("total_violations") or 0)
                    integrity_score = max(0, 100 - violations * 10)

                result.append({
                    "id": row.id,
                    "name": row.name,
                    "email": row.email,
                    "job_title": row.job_title,
                    "status": row.status,
                    "outcome": outcome,
                    "overall_score": round(overall_score, 1),
                    "integrity_score": integrity_score,
                    "created_at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
                })

            return result
        finally:
            self.Session.remove()
    
    def delete_candidate(self, candidate_id: str) -> bool:
        """Delete candidate and associated logs"""
        session = self.Session()
        try:
            session.query(IntegrityLogModel).filter(IntegrityLogModel.candidate_id == candidate_id).delete()
            count = session.query(CandidateModel).filter(CandidateModel.id == candidate_id).delete()
            session.commit()
            return count > 0
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()
    
    # ==================== Integrity Logging ====================
    
    def log_integrity_event(self, candidate_id: str, event: IntegrityEvent) -> None:
        """Log a single integrity violation"""
        session = self.Session()
        try:
            db_event = IntegrityLogModel(
                candidate_id=candidate_id,
                timestamp=event.timestamp,
                event_type=event.event_type,
                severity=event.severity,
                context=event.context
            )
            session.add(db_event)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()
    
    def get_integrity_logs(self, candidate_id: str) -> List[IntegrityEvent]:
        """Get all integrity events for a candidate"""
        session = self.Session()
        try:
            rows = session.query(IntegrityLogModel).filter(
                IntegrityLogModel.candidate_id == candidate_id
            ).order_by(IntegrityLogModel.timestamp.asc()).all()
            
            return [
                IntegrityEvent(
                    timestamp=row.timestamp,
                    event_type=row.event_type,
                    severity=row.severity,
                    context=row.context
                )
                for row in rows
            ]
        finally:
            self.Session.remove()
    
    def get_integrity_summary(self, candidate_id: str) -> dict:
        """Get aggregated integrity stats"""
        session = self.Session()
        try:
            results = session.query(
                IntegrityLogModel.severity, 
                func.count(IntegrityLogModel.id)
            ).filter(
                IntegrityLogModel.candidate_id == candidate_id
            ).group_by(IntegrityLogModel.severity).all()
            
            counts = {row[0]: row[1] for row in results}
            return {
                "total": sum(counts.values()),
                "by_severity": counts
            }
        finally:
            self.Session.remove()
    
    # ==================== Job Descriptions ====================
    
    def save_job_description(self, jd: JobDescription) -> None:
        """Save job description"""
        session = self.Session()
        try:
            db_jd = JobDescriptionModel(
                id=jd.id,
                title=jd.title,
                data=jd.model_dump(),
                created_at=datetime.utcnow()
            )
            session.merge(db_jd)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()
    
    def get_job_description(self, jd_id: str) -> Optional[JobDescription]:
        """Get job description by ID"""
        session = self.Session()
        try:
            db_jd = session.query(JobDescriptionModel).filter(JobDescriptionModel.id == jd_id).first()
            if db_jd:
                return JobDescription.model_validate(db_jd.data)
            return None
        finally:
            self.Session.remove()
    
    def get_all_job_descriptions(self) -> List[JobDescription]:
        """Get all job descriptions"""
        session = self.Session()
        try:
            rows = session.query(JobDescriptionModel).order_by(JobDescriptionModel.created_at.desc()).all()
            return [JobDescription.model_validate(row.data) for row in rows]
        finally:
            self.Session.remove()
    
    # ==================== User Operations ====================
    
    def save_user(self, user: User, password_hash: str = None) -> None:
        """Insert or update user, optionally with a password hash"""
        session = self.Session()
        try:
            existing = session.query(UserModel).filter(UserModel.id == user.id).first()
            if existing:
                existing.email = user.email
                existing.role = user.role.value if hasattr(user.role, 'value') else user.role
                existing.name = user.name
                if password_hash is not None:
                    existing.password_hash = password_hash
            else:
                db_user = UserModel(
                    id=user.id,
                    email=user.email,
                    role=user.role.value if hasattr(user.role, 'value') else user.role,
                    name=user.name,
                    password_hash=password_hash,
                    created_at=datetime.fromisoformat(user.created_at) if hasattr(user, 'created_at') and user.created_at else datetime.utcnow()
                )
                session.add(db_user)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()

    def get_user_with_hash(self, email: str) -> tuple:
        """Return (User, password_hash) tuple for login verification. Hash may be None for legacy accounts."""
        session = self.Session()
        try:
            row = session.query(UserModel).filter(UserModel.email == email).first()
            if row:
                user = User(
                    id=row.id,
                    email=row.email,
                    role=UserRole(row.role),
                    name=row.name,
                    created_at=row.created_at.isoformat()
                )
                return user, row.password_hash
            return None, None
        finally:
            self.Session.remove()

    def update_user_password(self, user_id: str, new_hash: str) -> bool:
        """Admin-initiated password reset."""
        session = self.Session()
        try:
            row = session.query(UserModel).filter(UserModel.id == user_id).first()
            if not row:
                return False
            row.password_hash = new_hash
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            self.Session.remove()

    def user_email_exists(self, email: str) -> bool:
        """Fast check whether an email is already registered."""
        session = self.Session()
        try:
            return session.query(UserModel.id).filter(UserModel.email == email).first() is not None
        finally:
            self.Session.remove()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        session = self.Session()
        try:
            row = session.query(UserModel).filter(UserModel.email == email).first()
            if row:
                return User(
                    id=row.id,
                    email=row.email,
                    role=UserRole(row.role),
                    name=row.name,
                    created_at=row.created_at.isoformat()
                )
            return None
        finally:
            self.Session.remove()
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        session = self.Session()
        try:
            row = session.query(UserModel).filter(UserModel.id == user_id).first()
            if row:
                return User(
                    id=row.id,
                    email=row.email,
                    role=UserRole(row.role),
                    name=row.name,
                    created_at=row.created_at.isoformat()
                )
            return None
        finally:
            self.Session.remove()
    
    def get_all_users(self) -> List[User]:
        """Get all users"""
        session = self.Session()
        try:
            rows = session.query(UserModel).order_by(UserModel.created_at.desc()).all()
            return [
                User(
                    id=row.id, 
                    email=row.email, 
                    role=UserRole(row.role), 
                    name=row.name, 
                    created_at=row.created_at.isoformat()
                )
                for row in rows
            ]
        finally:
            self.Session.remove()
