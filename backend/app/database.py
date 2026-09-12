import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
ENV = os.getenv("ENV", "development").lower()

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Normalize PostgreSQL URL scheme for the psycopg2 driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Never echo SQL in production, regardless of SQL_ECHO — avoids leaking
# bound params (potentially PII) into logs.
sql_echo = os.getenv("SQL_ECHO", "false").lower() == "true" and ENV != "production"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # avoids stale-connection errors after idle periods
    pool_recycle=1800,       # recycle connections every 30 min
    pool_size=5,
    max_overflow=10,
    echo=sql_echo,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,  # avoids DetachedInstanceError on objects
                              # accessed after the request's session closes
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()