from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "Homtel Property Rental Management Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment & Host
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Security & Tokens
    SECRET_KEY: str = "homtel-super-secure-production-jwt-secret-key-2026-danang"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database Configuration (PostgreSQL with asyncpg fallback or SQLite for local dev test)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/homtel_db"
    # Local fallback option when PostgreSQL is not yet running
    SQLITE_FALLBACK_URL: str = "sqlite+aiosqlite:///./data/homtel_dev.db"
    USE_SQLITE_FALLBACK: bool = False

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://homtel.vn",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
