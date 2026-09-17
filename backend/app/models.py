from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Branch(Base):
    """A physical branch/outlet. Lives in the shared `public` schema so it can
    be looked up before we know which branch-specific schema to switch to.
    Each branch also owns its own Postgres schema (see branching.py) holding
    its own copies of products / sales_history / receipt_counter, so one
    branch's catalogue and sales never mix with another's."""
    __tablename__ = "branches"
    branch_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    schema_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_name: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    # "overall_admin" (sees/edits every branch), "admin" (branch-scoped), "cashier"
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="cashier")
    # null only for overall_admin accounts, which aren't tied to one branch
    branch_id: Mapped[str | None] = mapped_column(String(30), ForeignKey("branches.branch_id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


# --- The three tables below are intentionally schema-less (no `schema=` set).
# They are never created directly under `public` — instead, a copy of this
# same table definition is stood up inside each branch's own Postgres schema
# when the branch is created (see branching.create_branch_schema). Per
# request, the session's `search_path` is pointed at the caller's branch
# schema (see deps.get_branch_context), so these unqualified table names
# transparently resolve to that branch's own data. ---

class Product(Base):
    __tablename__ = "products"
    prod_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    prod_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(String(40), nullable=False)
    # End-user / retail price.
    prod_price: Mapped[float] = mapped_column(Float, nullable=False)
    # Bulk-sale price — offered as an alternative at the point of sale, e.g.
    # for wholesale customers buying in quantity.
    bulk_price: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # Inventory. stock_level is intentionally allowed to go negative — a sale
    # is never blocked for insufficient stock, it's just carried as a
    # backorder until the next restock brings it positive again.
    stock_level: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # Cost of the most recent restock batch.
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # Average cost, recomputed on every restock as
    # (previous unit_cost + new batch's unit_cost) / 2. This is what gross
    # profit and sales_history.avg_cost are based on.
    avg_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0)


class ReceiptCounter(Base):
    __tablename__ = "receipt_counter"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    next_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1001)


class SalesHistory(Base):
    __tablename__ = "sales_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_no: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    pmt_type: Mapped[str] = mapped_column(String(30), nullable=False)
    customer: Mapped[str] = mapped_column(String(160), nullable=False)
    cashier: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    prod: Mapped[str] = mapped_column(String(160), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    # "order" (just rung up, not yet settled) / "paid" / "not_paid" / "cancelled"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="order", index=True)
    # Snapshot of the product's avg_cost at the moment of sale, so gross
    # profit on old receipts doesn't shift later when costs/restocks change.
    avg_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0)


Index("ix_sales_history_date_status", SalesHistory.date, SalesHistory.status)
Index("ix_sales_history_receipt_date", SalesHistory.receipt_no, SalesHistory.date)

SALE_STATUSES = {"order", "paid", "not_paid", "cancelled"}