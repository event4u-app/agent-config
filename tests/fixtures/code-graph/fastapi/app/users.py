from fastapi import APIRouter, Depends

from app.deps import current_user

router = APIRouter(prefix="/api", tags=["users"])
registry = {}


def audit_log():
    return "audit"


@router.get("/users")
def list_users(user=Depends(current_user)):
    return [user]


@router.delete("/users/{uid}")
def delete_user(uid: int, log=Depends(audit_log), extra=Depends(lambda: 1)):
    return uid


@registry.get("/not-a-route")
def not_routed():
    return None
