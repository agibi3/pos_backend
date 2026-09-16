from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .branching import set_branch_search_path
from .database import get_db
from .models import Branch, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "overall_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def overall_admin_only(user: User = Depends(current_user)) -> User:
    if user.role != "overall_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Overall admin access required")
    return user


def get_branch_context(
    branch_id: str | None = Query(None, description="Required for overall_admin; ignored/validated for branch-scoped users"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Branch:
    """Resolves which branch this request operates on and points the DB
    session's search_path at that branch's own schema. overall_admin must
    say which branch via ?branch_id=; everyone else is locked to their own
    branch and gets a 403 if they try to pass a different one."""
    if user.role == "overall_admin":
        if not branch_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select a branch (branch_id) to continue")
        branch = db.get(Branch, branch_id)
    else:
        if not user.branch_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account isn't assigned to a branch yet")
        if branch_id and branch_id != user.branch_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only access your own branch")
        branch = db.get(Branch, user.branch_id)

    if not branch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found")

    set_branch_search_path(db, branch.schema_name)
    return branch
