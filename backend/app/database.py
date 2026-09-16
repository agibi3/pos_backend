import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
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

@event.listens_for(engine, "checkout")
def _reset_search_path(dbapi_conn, connection_record, connection_proxy):
    # Every connection starts back on the default `public` search_path the
    # moment it's checked out of the pool — regardless of which branch
    # schema a previous request may have pointed it at. Per-request branch
    # scoping (deps.get_branch_context) then opts a connection into one
    # branch's schema only for the duration of that request.
    cursor = dbapi_conn.cursor()
    try:
        cursor.execute("SET search_path TO public")
    finally:
        cursor.close()


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