from datetime import datetime
from pydantic import BaseModel, Field

class LoginIn(BaseModel):
    userName: str
    password: str

class UserOut(BaseModel):
    userId: str
    fullName: str
    userName: str
    role: str
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

class UserUpdate(BaseModel):
    fullName: str | None = None
    userName: str | None = None
    password: str | None = None
    role: str | None = None

class ProductCreate(BaseModel):
    prod_id: str
    prod_name: str
    unit_type: str
    prod_price: float

class ProductUpdate(BaseModel):
    prod_name: str | None = None
    unit_type: str | None = None
    prod_price: float | None = None

class SaleItem(BaseModel):
    product: str
    price: float
    qty: float
    total: float

class SaleCreate(BaseModel):
    receipt_no: str = ""
    pmt_type: str
    customer: str = "Customer"
    cashier: str
    status: str = "paid"
    items: list[SaleItem]

class SaleStatusUpdate(BaseModel):
    status: str

class PaymentSummary(BaseModel):
    name: str
    value: float
