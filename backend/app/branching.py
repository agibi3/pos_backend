import re
from sqlalchemy import MetaData, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from .models import Product, SalesHistory, ReceiptCounter, Expense, ExpenseType

# Schema names are always derived server-side from a validated branch_id,
# never taken from a request body directly — this keeps them safe to
# interpolate into raw `SET search_path` / `CREATE SCHEMA` statements
# (identifiers can't be bound as query params in Postgres).
_SCHEMA_RE = re.compile(r"^branch_[a-z0-9_]+$")


def make_schema_name(branch_id: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", branch_id.lower()).strip("_")
    if not slug:
        raise ValueError("Branch ID must contain at least one letter or number")
    return f"branch_{slug}"


def create_branch_schema(engine: Engine, schema_name: str) -> None:
    """Creates a fresh Postgres schema for a new branch and dynamically
    stands up its own products / sales_history / receipt_counter tables in
    it, cloned from the shared model definitions. Called once, at branch
    creation time."""
    if not _SCHEMA_RE.match(schema_name):
        raise ValueError("Invalid schema name")
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        branch_meta = MetaData()
        for table in (Product.__table__, SalesHistory.__table__, ReceiptCounter.__table__, Expense.__table__, ExpenseType.__table__):
            table.to_metadata(branch_meta, schema=schema_name)
        branch_meta.create_all(bind=conn)
        conn.execute(
            text(f'INSERT INTO "{schema_name}".receipt_counter (id, next_no) VALUES (1, 1001) ON CONFLICT (id) DO NOTHING')
        )


def set_branch_search_path(db: Session, schema_name: str) -> None:
    """Points this request's DB session at one branch's schema, so every
    unqualified query against Product / SalesHistory / ReceiptCounter
    transparently hits that branch's own tables."""
    if not _SCHEMA_RE.match(schema_name):
        raise ValueError("Invalid schema name")
    db.execute(text(f'SET search_path TO "{schema_name}", public'))