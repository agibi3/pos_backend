import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session
from .branching import create_branch_schema, make_schema_name
from .database import Base, engine, get_db, SessionLocal
from .deps import admin_only, current_user, get_branch_context, overall_admin_only
from .models import Branch, Product, ReceiptCounter, SalesHistory, User, SALE_STATUSES
from .schemas import *
from .security import create_token, hash_password, verify_password

# Auto-create the shared (public-schema) tables on startup. This only adds
# tables that don't exist yet and never alters or drops existing ones.
# Product / SalesHistory / ReceiptCounter are deliberately excluded here —
# they only ever get created per-branch, inside that branch's own schema
# (see branching.create_branch_schema), the first time a branch is added.
Base.metadata.create_all(bind=engine, tables=[Branch.__table__, User.__table__])


def _ensure_inventory_columns() -> None:
    """One-time, idempotent migration: adds the stock/cost columns to every
    *existing* branch's products/sales_history tables. New branches already
    get these columns automatically, since create_branch_schema clones the
    current Product/SalesHistory model definitions — this just backfills
    branches that were created before inventory tracking existed."""
    with SessionLocal() as db:
        schema_names = [b.schema_name for b in db.scalars(select(Branch)).all()]
    with engine.begin() as conn:
        for schema in schema_names:
            conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS stock_level DOUBLE PRECISION NOT NULL DEFAULT 0'))
            conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0'))
            conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS avg_cost DOUBLE PRECISION NOT NULL DEFAULT 0'))
            conn.execute(text(f'ALTER TABLE "{schema}".products ADD COLUMN IF NOT EXISTS bulk_price DOUBLE PRECISION NOT NULL DEFAULT 0'))
            conn.execute(text(f'ALTER TABLE "{schema}".sales_history ADD COLUMN IF NOT EXISTS avg_cost DOUBLE PRECISION NOT NULL DEFAULT 0'))


try:
    _ensure_inventory_columns()
except Exception:
    # Don't block app startup on this — e.g. first-ever run, before the
    # `branches` table has any rows, or a DB user without ALTER rights.
    pass

app = FastAPI(title="Mai_Ganima POS API", version="2.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def branch_out(b: Branch):
    return {"branchId": b.branch_id, "name": b.name, "address": b.address, "phone": b.phone, "created_at": b.created_at}


def user_out(u: User, db: Session):
    branch = None
    if u.branch_id:
        b = db.get(Branch, u.branch_id)
        if b:
            branch = branch_out(b)
    return {"userId": u.user_id, "fullName": u.full_name, "userName": u.user_name, "role": u.role, "branchId": u.branch_id, "branch": branch, "created_at": u.created_at}


def row_out(r: SalesHistory):
    return {"id": r.id, "receipt_no": r.receipt_no, "date": r.date, "pmt_type": r.pmt_type, "customer": r.customer, "cashier": r.cashier, "prod": r.prod, "price": r.price, "qty": r.qty, "total": r.total, "status": r.status, "avg_cost": r.avg_cost}


def product_out(p: Product):
    return {
        "prod_id": p.prod_id, "prod_name": p.prod_name, "unit_type": p.unit_type, "prod_price": p.prod_price,
        "bulk_price": p.bulk_price, "stock_level": p.stock_level, "unit_cost": p.unit_cost, "avg_cost": p.avg_cost,
    }


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
    return {"access_token": create_token(user.user_id, user.role), "user": user_out(user, db)}


@app.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(user, db)


# ---------------------------------------------------------------- Branches
# Only an overall_admin can list/create/edit branches — branch-scoped admins
# and cashiers never see other branches at all.

@app.get("/branches")
def list_branches(db: Session = Depends(get_db), user: User = Depends(overall_admin_only)):
    rows = db.scalars(select(Branch).order_by(Branch.created_at)).all()
    return [branch_out(b) for b in rows]


@app.post("/branches")
def create_branch(body: BranchCreate, db: Session = Depends(get_db), user: User = Depends(overall_admin_only)):
    if db.get(Branch, body.branchId):
        raise HTTPException(409, "Branch ID already exists")
    try:
        schema_name = make_schema_name(body.branchId)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if db.scalar(select(Branch).where(Branch.schema_name == schema_name)):
        raise HTTPException(409, "A branch with a conflicting ID already exists")

    b = Branch(branch_id=body.branchId, name=body.name, address=body.address, phone=body.phone, schema_name=schema_name)
    db.add(b)
    db.commit()
    db.refresh(b)

    # Dynamically stand up this branch's own products / sales_history /
    # receipt_counter tables in a fresh Postgres schema of their own.
    try:
        create_branch_schema(engine, schema_name)
    except Exception as e:
        db.delete(b)
        db.commit()
        raise HTTPException(500, f"Branch record saved but its tables could not be created: {e}")

    return branch_out(b)


@app.patch("/branches/{branch_id}")
def edit_branch(branch_id: str, body: BranchUpdate, db: Session = Depends(get_db), user: User = Depends(overall_admin_only)):
    b = db.get(Branch, branch_id)
    if not b:
        raise HTTPException(404, "Branch not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return branch_out(b)


# ----------------------------------------------------------------- Products
# All product/sale endpoints below depend on get_branch_context, which both
# resolves + authorizes the branch AND points this request's DB session at
# that branch's own schema — so the plain `select(Product)` etc. below
# transparently reads/writes that one branch's own data.

@app.get("/products")
def products(branch: Branch = Depends(get_branch_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).order_by(Product.prod_name)).all()
    return [product_out(p) for p in rows]


@app.post("/products")
def add_product(body: ProductCreate, branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    if db.get(Product, body.prod_id):
        raise HTTPException(409, "Product ID already exists")
    data = body.model_dump()
    # A brand-new product's avg_cost simply starts at whatever unit_cost it
    # was created with (nothing to average against yet).
    p = Product(**data, avg_cost=data["unit_cost"])
    db.add(p)
    db.commit()
    db.refresh(p)
    return product_out(p)


@app.patch("/products/{prod_id}")
def edit_product(prod_id: str, body: ProductUpdate, branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    p = db.get(Product, prod_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return product_out(p)


@app.post("/products/{prod_id}/restock")
def restock_product(prod_id: str, body: RestockIn, branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    """The only way stock_level/unit_cost/avg_cost change outside of a sale.
    avg_cost = (previous unit_cost + this batch's unit_cost) / 2 — a plain
    average of the last two costs, not weighted by quantity."""
    p = db.get(Product, prod_id)
    if not p:
        raise HTTPException(404, "Product not found")
    # First-ever restock (or a product that's never had a cost recorded):
    # nothing to average against yet, so the new cost stands on its own.
    p.avg_cost = body.unit_cost if p.unit_cost == 0 else round((p.unit_cost + body.unit_cost) / 2, 4)
    p.unit_cost = body.unit_cost
    p.stock_level += body.quantity
    db.commit()
    db.refresh(p)
    return product_out(p)


# -------------------------------------------------------------------- Sales

@app.post("/sales")
def create_sale(body: SaleCreate, branch: Branch = Depends(get_branch_context), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.items:
        raise HTTPException(400, "Sale must contain at least one item")
    if body.status not in SALE_STATUSES:
        raise HTTPException(400, "Invalid sale status")
    if user.role == "cashier" and body.cashier != user.full_name:
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

    rows = []
    for i in body.items:
        # Resolve the catalogue product to pull its avg_cost (for gross
        # profit, frozen into this row at sale time) and to deduct stock.
        # Stock is never floored at zero — a sale that outruns stock just
        # carries the shortfall forward as a negative stock_level.
        prod = db.get(Product, i.prod_id) if i.prod_id else db.scalar(select(Product).where(Product.prod_name == i.product))
        line_avg_cost = prod.avg_cost if prod else 0.0
        if prod:
            prod.stock_level -= i.qty
        rows.append(SalesHistory(
            receipt_no=body.receipt_no, date=now, pmt_type=body.pmt_type, customer=body.customer,
            cashier=body.cashier, prod=i.product, price=i.price, qty=i.qty, total=i.total, status=body.status,
            avg_cost=line_avg_cost,
        ))
    db.add_all(rows)
    db.commit()
    return {"receipt_no": body.receipt_no, "date": now, "status": body.status, "items": len(rows), "total": sum(i.total for i in body.items)}


@app.get("/sales")
def sales(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), receipt_no: str | None = None, status: str | None = None, branch: Branch = Depends(get_branch_context), db: Session = Depends(get_db)):
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
def sale(receipt_no: str, branch: Branch = Depends(get_branch_context), db: Session = Depends(get_db)):
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
def sale_status(receipt_no: str, body: SaleStatusUpdate, branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Admin-only, full control — used by the "Update payment status" mini
    screen in the History tab (paid / not paid / cancel, from any starting
    status)."""
    if body.status not in SALE_STATUSES:
        raise HTTPException(400, "Invalid status")
    result = db.execute(update(SalesHistory).where(SalesHistory.receipt_no == receipt_no).values(status=body.status))
    if result.rowcount == 0:
        raise HTTPException(404, "Sale not found")
    db.commit()
    return {"receipt_no": receipt_no, "status": body.status}


@app.patch("/sales/{receipt_no}/payment-status")
def update_payment_status(receipt_no: str, body: SaleStatusUpdate, branch: Branch = Depends(get_branch_context), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Cashier-usable — this is the narrow transition available from the
    reprint screen: an "order" can be marked paid or not_paid, nothing
    else. Any other status change still requires admin_only /status."""
    if body.status not in {"paid", "not_paid"}:
        raise HTTPException(400, "This endpoint can only set status to paid or not_paid")
    rows = db.scalars(select(SalesHistory).where(SalesHistory.receipt_no == receipt_no)).all()
    if not rows:
        raise HTTPException(404, "Sale not found")
    if rows[0].status != "order":
        raise HTTPException(409, "Only receipts still marked 'order' can be updated here")
    db.execute(update(SalesHistory).where(SalesHistory.receipt_no == receipt_no).values(status=body.status))
    db.commit()
    return {"receipt_no": receipt_no, "status": body.status}


@app.get("/summary")
def summary(period: str = Query("weekly", pattern="^(weekly|monthly|quarterly|yearly)$"), branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start = now - timedelta(days=7)
        bucket = "day"
        label_fmt = "%d %b"
    elif period == "monthly":
        start = now - timedelta(days=30)
        bucket = "day"
        label_fmt = "%d %b"
    elif period == "quarterly":
        start = now - timedelta(days=90)
        bucket = "week"
        label_fmt = "%d %b"
    else:
        start = now - timedelta(days=365)
        bucket = "month"
        label_fmt = "%b %Y"

    # NOTE: func.date_trunc is Postgres-specific (this app is Postgres-only).
    bucket_expr = func.date_trunc(bucket, SalesHistory.date)
    # Gross profit per line = total charged minus (avg_cost * qty) — avg_cost
    # here is the value frozen onto the row at the moment of that sale.
    profit_expr = SalesHistory.total - SalesHistory.avg_cost * SalesHistory.qty
    rows = db.execute(
        select(bucket_expr.label("bucket"), func.sum(SalesHistory.total).label("value"), func.sum(profit_expr).label("profit"))
        .where(SalesHistory.date >= start, SalesHistory.status != "cancelled")
        .group_by(bucket_expr)
        .order_by(bucket_expr)
    ).all()
    total_sales = sum(float(r.value or 0) for r in rows)
    gross_profit = sum(float(r.profit or 0) for r in rows)
    paid = db.scalar(select(func.coalesce(func.sum(SalesHistory.total), 0)).where(SalesHistory.date >= start, SalesHistory.status == "paid")) or 0
    outstanding = max(total_sales - float(paid), 0)
    chart = [{"label": r.bucket.strftime(label_fmt), "value": float(r.value or 0), "profit": float(r.profit or 0)} for r in rows]
    return {
        "period": period, "total_sales": total_sales, "paid_sales": float(paid),
        "outstanding": outstanding, "gross_profit": gross_profit, "chart": chart,
    }


@app.get("/payments/summary")
def payment_summary(branch: Branch = Depends(get_branch_context), user: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.execute(select(SalesHistory.pmt_type, func.sum(SalesHistory.total)).where(SalesHistory.status == "paid").group_by(SalesHistory.pmt_type)).all()
    return [{"name": name or "Unknown", "value": float(value or 0)} for name, value in rows]


# -------------------------------------------------------------------- Users
# Users live in the shared `public` schema (not per-branch), scoped by the
# branch_id column instead — a branch-scoped admin only ever sees/edits
# users in their own branch_id; overall_admin sees/edits everyone.

@app.get("/users")
def users(branch_id: str | None = Query(None), db: Session = Depends(get_db), user: User = Depends(admin_only)):
    q = select(User).order_by(User.created_at)
    if user.role == "overall_admin":
        if branch_id:
            q = q.where(User.branch_id == branch_id)
    else:
        q = q.where(User.branch_id == user.branch_id)
    rows = db.scalars(q).all()
    return [user_out(u, db) for u in rows]


@app.post("/users")
def add_user(body: UserCreate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    if db.get(User, body.userId):
        raise HTTPException(409, "User ID already exists")
    if db.scalar(select(User).where(func.lower(User.user_name) == body.userName.lower())):
        raise HTTPException(409, "Username already exists")

    if user.role == "overall_admin":
        role = body.role if body.role in {"admin", "cashier", "overall_admin"} else "cashier"
        branch_id = None
        if role != "overall_admin":
            if not body.branchId or not db.get(Branch, body.branchId):
                raise HTTPException(400, "A valid branchId is required for admin/cashier accounts")
            branch_id = body.branchId
    else:
        # Branch-scoped admins can only ever create accounts inside their own branch.
        role = body.role if body.role in {"admin", "cashier"} else "cashier"
        branch_id = user.branch_id

    u = User(user_id=body.userId, full_name=body.fullName, user_name=body.userName, password_hash=hash_password(body.password), role=role, branch_id=branch_id)
    db.add(u)
    db.commit()
    db.refresh(u)
    return user_out(u, db)


@app.patch("/users/{user_id}")
def edit_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db), user: User = Depends(admin_only)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if user.role != "overall_admin" and u.branch_id != user.branch_id:
        raise HTTPException(403, "You can only edit users in your own branch")

    data = body.model_dump(exclude_unset=True)
    if "userName" in data and data["userName"] != u.user_name:
        if db.scalar(select(User).where(func.lower(User.user_name) == data["userName"].lower())):
            raise HTTPException(409, "Username already exists")
        u.user_name = data["userName"]
    if "fullName" in data:
        u.full_name = data["fullName"]
    if "role" in data and data["role"] in {"admin", "cashier"}:
        u.role = data["role"]
    if "branchId" in data and data["branchId"] and user.role == "overall_admin":
        if not db.get(Branch, data["branchId"]):
            raise HTTPException(400, "Branch not found")
        u.branch_id = data["branchId"]
    if "password" in data and data["password"]:
        u.password_hash = hash_password(data["password"])
    db.commit()
    db.refresh(u)
    return user_out(u, db)