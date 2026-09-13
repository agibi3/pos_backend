
from app.database import Base, engine, SessionLocal
from app.models import User
from app.security import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    admin = (
        db.query(User)
        .filter(User.user_name == "admin")
        .first()
    )

    if admin:
        # Reset existing admin account
        admin.password_hash = hash_password("admin123")
        admin.role = "admin"
        admin.full_name = "Administrator"

        db.commit()

        print("Admin password reset successfully")
        print("Username: admin")
        print("Password: admin123")

    else:
        # Create new admin account
        admin = User(
            user_id="ADM001",
            full_name="Administrator",
            user_name="admin",
            password_hash=hash_password("admin123"),
            role="admin",
        )

        db.add(admin)
        db.commit()

        print("Created admin: admin / admin123")

finally:
    db.close()
