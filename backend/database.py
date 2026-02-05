"""
Cygnusa Guardian - Database Layer
SQLAlchemy for cross-database support (SQLite/PostgreSQL)
"""

import os
import json
from typing import Optional, List
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, DateTime, ForeignKey, Index, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from models import CandidateProfile, IntegrityEvent, JobDescription, User, UserRole

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
        """Initialize database tables"""
        Base.metadata.create_all(self.engine)
        
    def check_connection(self) -> bool:
        """Verify database connectivity"""
        try:
            from sqlalchemy import text
            with self.session_factory() as session:
                session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            # Import logger here to avoid circular imports if any
            import logging
            logging.getLogger("cygnusa-db").error(f"Database connection check failed: {e}")
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
                return CandidateProfile.model_validate(db_candidate.data)
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
        """Fetch only essential candidate columns for list views (Dashboard)"""
        session = self.Session()
        try:
            query = session.query(
                CandidateModel.id,
                CandidateModel.name,
                CandidateModel.email,
                CandidateModel.job_title,
                CandidateModel.status,
                CandidateModel.created_at
            )
            
            if status:
                query = query.filter(CandidateModel.status == status)
            
            rows = query.order_by(CandidateModel.created_at.desc()).all()
            
            return [
                {
                    "id": row.id,
                    "name": row.name,
                    "email": row.email,
                    "job_title": row.job_title,
                    "status": row.status,
                    "created_at": row.created_at.isoformat() if hasattr(row.created_at, 'isoformat') else str(row.created_at)
                }
                for row in rows
            ]
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
    
    def save_user(self, user: User) -> None:
        """Insert or update user"""
        session = self.Session()
        try:
            db_user = UserModel(
                id=user.id,
                email=user.email,
                role=user.role.value if hasattr(user.role, 'value') else user.role,
                name=user.name,
                created_at=datetime.fromisoformat(user.created_at) if hasattr(user, 'created_at') and user.created_at else datetime.utcnow()
            )
            session.merge(db_user)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
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
