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
    VIETQR_WEBHOOK_SECRET: str = "vqr_secret_homtel_dev_2026"
    
    # Feature Flags (Disabled pending corporate entity establishment)
    PAYMENT_GATEWAY_ENABLED: bool = False
    ZALO_ENABLED: bool = False
    
    # Database Configuration (Strictly PostgreSQL with asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/homtel_db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://homtel.vn",
    ]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        # In production environment, enforce non-default secret key
        env = info.data.get("ENVIRONMENT", "development") if hasattr(info, "data") else "development"
        if env == "production" and v == "homtel-super-secure-production-jwt-secret-key-2026-danang":
            raise ValueError("Production SECRET_KEY must be securely injected via environment variable!")
        return v

    @field_validator("VIETQR_WEBHOOK_SECRET")
    @classmethod
    def validate_webhook_secret(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development") if hasattr(info, "data") else "development"
        if env == "production" and (v == "vqr_secret_homtel_dev_2026" or not v or len(v) < 16):
            raise ValueError("Production VIETQR_WEBHOOK_SECRET must be securely injected via environment variable (min 16 chars)!")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
