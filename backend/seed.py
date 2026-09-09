from app.database import Base, engine, SessionLocal
from app.models import User
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db=SessionLocal()
try:
    if not db.query(User).filter(User.user_name=="admin").first():
        db.add(User(user_id="ADM001",full_name="Administrator",user_name="admin",password_hash=hash_password("admin123"),role="admin"))
        db.commit()
        print("Created admin: admin / admin123")
    else:
        print("Admin already exists")
finally:
    db.close()
