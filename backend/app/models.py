from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_name: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="cashier")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Product(Base):
    __tablename__ = "products"
    prod_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    prod_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(String(40), nullable=False)
    prod_price: Mapped[float] = mapped_column(Float, nullable=False)

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
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid", index=True)

Index("ix_sales_history_date_status", SalesHistory.date, SalesHistory.status)
Index("ix_sales_history_receipt_date", SalesHistory.receipt_no, SalesHistory.date)
