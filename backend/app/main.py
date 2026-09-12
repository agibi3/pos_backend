import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, update, delete
from sqlalchemy.orm import Session
from .database import Base, engine, get_db, SessionLocal
from .deps import current_user, admin_only
from .models import User, Product, SalesHistory, ReceiptCounter
from .schemas import *
from .security import create_token, hash_password, verify_password

ENV = os.getenv("ENV", "development").lower()

# Only auto-create tables outside production — in prod, schema changes should
# go through migrations (Alembic), not an implicit create_all on import.
if ENV != "production":
    Base.metadata.create_all(bind=engine)

with SessionLocal() as _db:
    if not _db.get(ReceiptCounter, 1):
        _db.add(ReceiptCounter(id=1, next_no=1001))
        _db.commit()

app = FastAPI(title="Mai_Ganima POS API", version="1.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def user_out(u: User):
    return {"userId": u.user_id, "fullName": u.full_name, "userName": u.user_name, "role": u.role, "created_at": u.created_at}


def row_out(r: SalesHistory):
    return {"id": r.id, "receipt_no": r.receipt_no, "date": r.date, "pmt_type": r.pmt_type, "customer": r.customer, "cashier": r.cashier, "prod": r.prod, "price": r.price, "qty": r.qty, "total": r.total, "status": r.status}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    normalized_username = body.userName.replace(" ", "").lower()
    user = db.scalar(
        select(User).where(func.replace(func.lower(User.user_name), " ", "") == normalized_username)
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"access_token": create_token(user.user_id, user.role), "user": user_out(user)}


@app.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user_out(user)


@app.get("/products")
def products(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Product).order_by(Product.prod_name)).all()
    return [{"prod_id": p.prod_id, "prod_name": p.prod_name, "unit_type": p.unit_type, "prod_price": p.prod_price} for p in rows]


@app.post("/products")
def add_product(body: ProductCreate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    if db.get(Product, body.prod_id):
        raise HTTPException(409, "Product ID already exists")
    p = Product(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"prod_id": p.prod_id, "prod_name": p.prod_name, "unit_type": p.unit_type, "prod_price": p.prod_price}


@app.patch("/products/{prod_id}")
def edit_product(prod_id: str, body: ProductUpdate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    p = db.get(Product, prod_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return {"prod_id": p.prod_id, "prod_name": p.prod_name, "unit_type": p.unit_type, "prod_price": p.prod_price}


@app.post("/sales")
def create_sale(body: SaleCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not body.items:
        raise HTTPException(400, "Sale must contain at least one item")
    if body.status not in {"pending", "paid", "not_paid", "cancelled"}:
        raise HTTPException(400, "Invalid sale status")
    if user.role != "admin" and body.cashier != user.full_name:
        body.cashier = user.full_name

    # Recompute each line's total server-side instead of trusting the client's
    # `total` field directly — otherwise a client could submit any price/qty
    # with an arbitrary total and the sale would record whatever it sent.
    for item in body.items:
        if item.price < 0 or item.qty <= 0:
            raise HTTPException(400, f"Invalid price/qty for item '{item.product}'")
        item.total = round(item.price * item.qty, 2)

    now = datetime.now(timezone.utc)
    if not body.receipt_no:
        counter = db.scalar(select(ReceiptCounter).where(ReceiptCounter.id == 1).with_for_update())
        if not counter:
            counter = ReceiptCounter(id=1, next_no=1001)
            db.add(counter)
            db.flush()
        body.receipt_no = str(counter.next_no)
        counter.next_no += 1

    rows = [
        SalesHistory(
            receipt_no=body.receipt_no, date=now, pmt_type=body.pmt_type, customer=body.customer,
            cashier=body.cashier, prod=i.product, price=i.price, qty=i.qty, total=i.total, status=body.status,
        )
        for i in body.items
    ]
    db.add_all(rows)
    db.commit()
    return {"receipt_no": body.receipt_no, "date": now, "status": body.status, "items": len(rows), "total": sum(i.total for i in body.items)}


@app.get("/sales")
def sales(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), receipt_no: str | None = None, status: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    base = select(SalesHistory)
    count_q = select(func.count()).select_from(SalesHistory)
    if receipt_no:
        base = base.where(SalesHistory.receipt_no == receipt_no)
        count_q = count_q.where(SalesHistory.receipt_no == receipt_no)
    if status:
        base = base.where(SalesHistory.status == status)
        count_q = count_q.where(SalesHistory.status == status)
    total_count = db.scalar(count_q) or 0
    rows = db.scalars(base.order_by(SalesHistory.date.desc(), SalesHistory.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [row_out(r) for r in rows], "page": page, "page_size": page_size, "total": total_count, "pages": (total_count + page_size - 1) // page_size}


@app.get("/sales/{receipt_no}")
def sale(receipt_no: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(SalesHistory).where(SalesHistory.receipt_no == receipt_no).order_by(SalesHistory.id)).all()
    if not rows:
        raise HTTPException(404, "Sale not found")
    return {
        "receipt_no": receipt_no, "date": rows[0].date, "pmt_type": rows[0].pmt_type, "customer": rows[0].customer,
        "cashier": rows[0].cashier, "status": rows[0].status,
        "items": [{"product": r.prod, "price": r.price, "qty": r.qty, "total": r.total} for r in rows],
        "total": sum(r.total for r in rows),
    }


@app.patch("/sales/{receipt_no}/status")
def sale_status(receipt_no: str, body: SaleStatusUpdate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    if body.status not in {"pending", "paid", "not_paid", "cancelled"}:
        raise HTTPException(400, "Invalid status")
    result = db.execute(update(SalesHistory).where(SalesHistory.receipt_no == receipt_no).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(404, "Sale not found")
    db.commit()
    return {"receipt_no": receipt_no, "status": body.status}


@app.get("/summary")
def summary(period: str = Query("weekly", pattern="^(weekly|monthly|yearly)$"), db: Session = Depends(get_db), user: User = Depends(admin_only)):
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start = now - timedelta(days=7)
        bucket = "day"
    elif period == "monthly":
        start = now - timedelta(days=30)
        bucket = "day"
    else:
        start = now - timedelta(days=365)
        bucket = "month"

    # NOTE: func.date_trunc is Postgres-specific. If SQLite support is still
    # needed anywhere (dev/tests), this endpoint will break there — either
    # drop SQLite for this route or branch on db.bind.dialect.name.
    bucket_expr = func.date_trunc(bucket, SalesHistory.date)
    rows = db.execute(
        select(bucket_expr.label("bucket"), func.sum(SalesHistory.total).label("value"))
        .where(SalesHistory.date >= start, SalesHistory.status != "cancelled")
        .group_by(bucket_expr)
        .order_by(bucket_expr)
    ).all()
    total_sales = sum(float(r.value or 0) for r in rows)
    paid = db.scalar(select(func.coalesce(func.sum(SalesHistory.total), 0)).where(SalesHistory.date >= start, SalesHistory.status == "paid")) or 0
    outstanding = max(total_sales - float(paid), 0)
    chart = [{"label": r.bucket.strftime("%d %b" if bucket == "day" else "%b %Y"), "value": float(r.value or 0)} for r in rows]
    return {"period": period, "total_sales": total_sales, "paid_sales": float(paid), "outstanding": outstanding, "chart": chart}


@app.get("/payments/summary")
def payment_summary(db: Session = Depends(get_db), user: User = Depends(admin_only)):
    rows = db.execute(select(SalesHistory.pmt_type, func.sum(SalesHistory.total)).where(SalesHistory.status == "paid").group_by(SalesHistory.pmt_type)).all()
    return [{"name": name or "Unknown", "value": float(value or 0)} for name, value in rows]


@app.get("/users")
def users(db: Session = Depends(get_db), user: User = Depends(admin_only)):
    rows = db.scalars(select(User).order_by(User.created_at)).all()
    return [user_out(u) for u in rows]


@app.post("/users")
def add_user(body: UserCreate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    if db.get(User, body.userId):
        raise HTTPException(409, "User ID already exists")
    if db.scalar(select(User).where(func.lower(User.user_name) == body.userName.lower())):
        raise HTTPException(409, "Username already exists")

    # Only trust the explicitly-requested role — do NOT infer admin status
    # from the username. The previous "startswith('adm')" rule meant anyone
    # who chose a username like "administrator" or "admissions" would be
    # silently granted admin rights regardless of the role they were assigned.
    role = body.role if body.role in {"admin", "cashier"} else "cashier"

    u = User(user_id=body.userId, full_name=body.fullName, user_name=body.userName, password_hash=hash_password(body.password), role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return user_out(u)


@app.patch("/users/{user_id}")
def edit_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    data = body.model_dump(exclude_unset=True)
    if "userName" in data and data["userName"] != u.user_name:
        if db.scalar(select(User).where(func.lower(User.user_name) == data["userName"].lower())):
            raise HTTPException(409, "Username already exists")
        u.user_name = data["userName"]
    if "fullName" in data:
        u.full_name = data["fullName"]
    if "role" in data and data["role"] in {"admin", "cashier"}:
        u.role = data["role"]
    if "password" in data and data["password"]:
        u.password_hash = hash_password(data["password"])
    db.commit()
    db.refresh(u)
    return user_out(u)
