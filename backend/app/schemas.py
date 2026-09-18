from datetime import datetime
from pydantic import BaseModel, Field


class BranchOut(BaseModel):
    branchId: str
    name: str
    address: str
    phone: str
    created_at: datetime


class BranchCreate(BaseModel):
    branchId: str = Field(min_length=2, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1)
    address: str = Field(min_length=1)
    phone: str = Field(min_length=1)


class BranchUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None


class LoginIn(BaseModel):
    userName: str
    password: str


class UserOut(BaseModel):
    userId: str
    fullName: str
    userName: str
    role: str
    branchId: str | None = None
    branch: BranchOut | None = None
    created_at: datetime


class LoginOut(BaseModel):
    access_token: str
    user: UserOut


class UserCreate(BaseModel):
    userId: str
    fullName: str
    userName: str
    password: str = Field(min_length=4)
    role: str = "cashier"
    branchId: str | None = None


class UserUpdate(BaseModel):
    fullName: str | None = None
    userName: str | None = None
    password: str | None = None
    role: str | None = None
    branchId: str | None = None


class ProductCreate(BaseModel):
    prod_id: str
    prod_name: str
    unit_type: str
    prod_price: float
    bulk_price: float = 0
    stock_level: float = 0
    unit_cost: float = 0


class ProductUpdate(BaseModel):
    prod_name: str | None = None
    unit_type: str | None = None
    prod_price: float | None = None
    bulk_price: float | None = None


class RestockIn(BaseModel):
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0)


class SaleItem(BaseModel):
    product: str
    prod_id: str | None = None
    price: float
    qty: float
    total: float


class SaleCreate(BaseModel):
    receipt_no: str = ""
    pmt_type: str
    customer: str = "Customer"
    cashier: str
    status: str = "order"
    items: list[SaleItem]


class SaleStatusUpdate(BaseModel):
    status: str


class PaymentSummary(BaseModel):
    name: str
    value: float


class ExpenseTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ExpenseTypeOut(BaseModel):
    id: int
    name: str


class ExpenseCreate(BaseModel):
    expense_type: str = Field(min_length=1, max_length=80)
    description: str = ""
    amount: float = Field(gt=0)


class ExpenseOut(BaseModel):
    id: int
    date: datetime
    expense_type: str
    description: str
    amount: float
    recorded_by: str


class ExpensePieSlice(BaseModel):
    name: str
    value: float