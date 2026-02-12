"""
Cygnusa Guardian - Backend Configuration
Centralizes all environment variables and settings for clean configuration management
"""

import os
from typing import Optional
from functools import lru_cache


class Settings:
    """
    Centralized configuration management.
    All environment variables are loaded here with sensible defaults.
    """
    
    # ===========================================
    # Application Settings
    # ===========================================
    APP_NAME: str = "Cygnusa Guardian"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # ===========================================
    # Server Settings
    # ===========================================
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "true").lower() == "true"
    
    # ===========================================
    # Database Settings
    # ===========================================
    DATABASE_URL: str = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URI") or "sqlite:///./cygnusa.db"
    
    # ===========================================
    # Supabase Configuration
    # ===========================================
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "snapshots")
    
    # ===========================================
    # AI Provider Configuration
    # ===========================================
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    
    # AI Model Selection
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-pro")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    
    # ===========================================
    # Security Settings
    # ===========================================
    JWT_SECRET: str = os.getenv("JWT_SECRET", "cygnusa-guardian-dev-secret-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
    
    # ===========================================
    # CORS Settings
    # ===========================================
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://cygnusa-guardian.vercel.app",
        "https://cygnusa-guardian-one.vercel.app",
        os.getenv("FRONTEND_URL", ""),
    ]
    
    # ===========================================
    # Code Execution Sandbox Settings
    # ===========================================
    CODE_EXECUTION_TIMEOUT: int = int(os.getenv("CODE_EXECUTION_TIMEOUT", "10"))  # seconds
    CODE_MAX_OUTPUT_SIZE: int = int(os.getenv("CODE_MAX_OUTPUT_SIZE", "10000"))  # bytes
    
    # ===========================================
    # Caching Settings
    # ===========================================
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "30"))  # seconds
    
    # ===========================================
    # File Upload Settings
    # ===========================================
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB
    ALLOWED_RESUME_TYPES: list = ["application/pdf", "application/msword", 
                                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    # ===========================================
    # Logging Settings
    # ===========================================
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "cygnusa_guardian.log")
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production environment"""
        return cls.ENVIRONMENT.lower() == "production"
    
    @classmethod
    def has_gemini(cls) -> bool:
        """Check if Gemini API is configured"""
        return bool(cls.GEMINI_API_KEY)
    
    @classmethod
    def has_openai(cls) -> bool:
        """Check if OpenAI API is configured"""
        return bool(cls.OPENAI_API_KEY)
    
    @classmethod
    def has_supabase(cls) -> bool:
        """Check if Supabase is configured"""
        return bool(cls.SUPABASE_URL and cls.SUPABASE_KEY)
    
    @classmethod
    def get_cors_origins(cls) -> list:
        """Get clean CORS origins list (removes empty strings)"""
        return [origin for origin in cls.CORS_ORIGINS if origin]


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings instance.
    Use this function to get settings throughout the application.

    Example::

        from config import get_settings
        settings = get_settings()
    """
    return Settings()


# Convenience export
settings = get_settings()
