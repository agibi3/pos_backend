from app.database import Base, engine, SessionLocal
from app.models import Branch, User
from app.security import hash_password

# Only the shared (public-schema) tables — branches get their own
# products/sales_history/receipt_counter tables created dynamically
# when each branch is added via POST /branches.
Base.metadata.create_all(bind=engine, tables=[Branch.__table__, User.__table__])

db = SessionLocal()

try:
    admin = db.query(User).filter(User.user_name == "admin").first()

    if admin:
        admin.password_hash = hash_password("admin123")
        admin.role = "overall_admin"
        admin.branch_id = None
        admin.full_name = "Administrator"
        db.commit()
        print("Overall admin password reset successfully")
        print("Username: admin")
        print("Password: admin123")
    else:
        # This account has no branch_id — it's the overall_admin, the only
        # role that can create branches (POST /branches) and see all of
        # them. Once a branch exists, create branch-scoped admin/cashier
        # accounts for it from the Users tab.
        admin = User(
            user_id="ADM001",
            full_name="Administrator",
            user_name="admin",
            password_hash=hash_password("admin123"),
            role="overall_admin",
        )
        db.add(admin)
        db.commit()
        print("Created overall admin: admin / admin123")
        print("Sign in, then create your first branch from the Branches tab.")

finally:
    db.close()
