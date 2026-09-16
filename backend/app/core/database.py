import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func
from datetime import datetime

from .config import settings

logger = logging.getLogger("homtel.database")

os.makedirs("./data", exist_ok=True)

# Try connecting or fallback gracefully for local development
if settings.USE_SQLITE_FALLBACK or "sqlite" in settings.DATABASE_URL:
    active_url = settings.SQLITE_FALLBACK_URL
    engine = create_async_engine(active_url, echo=False, future=True)
else:
    # Use postgresql by default with SQLite dev fallback option
    try:
        active_url = settings.DATABASE_URL
        engine = create_async_engine(
            active_url,
            echo=False,
            future=True,
            pool_size=10,
            max_overflow=5,
            pool_pre_ping=True,
        )
    except Exception as e:
        logger.warning(f"Failed to initialize PostgreSQL engine: {e}. Falling back to SQLite.")
        active_url = settings.SQLITE_FALLBACK_URL
        engine = create_async_engine(active_url, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
