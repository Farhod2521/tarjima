"""
Foydalanuvchilar boshqaruvi: ro'yxat, ruxsatlar, role.
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    User, GrammarHistory, TranslationHistory, FormattingHistory, get_db
)
from routers.auth import require_admin, _user_dict

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = ("admin", "director", "employee")


def _fmt(dt: Optional[datetime.datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


# ── Schemas ────────────────────────────────────────────────────────────────────

class PermissionsRequest(BaseModel):
    can_grammar: bool
    can_tarjima: bool
    can_hujjat: bool


class RoleRequest(BaseModel):
    role: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_dict(u) for u in users]


@router.get("/{user_id}")
def get_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Foydalanuvchi topilmadi")

    grammar = (
        db.query(GrammarHistory)
        .filter(GrammarHistory.user_id == user_id)
        .order_by(GrammarHistory.created_at.desc())
        .all()
    )
    translation = (
        db.query(TranslationHistory)
        .filter(TranslationHistory.user_id == user_id)
        .order_by(TranslationHistory.created_at.desc())
        .all()
    )
    formatting = (
        db.query(FormattingHistory)
        .filter(FormattingHistory.user_id == user_id)
        .order_by(FormattingHistory.created_at.desc())
        .all()
    )

    return {
        **_user_dict(user),
        "grammar_history": [
            {
                "id": h.id,
                "filename": h.filename,
                "standard_name": h.standard_name,
                "issues_count": h.issues_count,
                "file_id": h.file_id,
                "created_at": _fmt(h.created_at),
            }
            for h in grammar
        ],
        "translation_history": [
            {
                "id": h.id,
                "filename": h.filename,
                "from_lang": h.from_lang,
                "to_lang": h.to_lang,
                "file_id": h.file_id,
                "created_at": _fmt(h.created_at),
            }
            for h in translation
        ],
        "formatting_history": [
            {
                "id": h.id,
                "filename": h.filename,
                "font": h.font,
                "font_size": h.font_size,
                "file_id": h.file_id,
                "created_at": _fmt(h.created_at),
            }
            for h in formatting
        ],
    }


@router.patch("/{user_id}/permissions")
def update_permissions(
    user_id: int,
    data: PermissionsRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    user.can_grammar = 1 if data.can_grammar else 0
    user.can_tarjima = 1 if data.can_tarjima else 0
    user.can_hujjat = 1 if data.can_hujjat else 0
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.patch("/{user_id}/role")
def update_role(
    user_id: int,
    data: RoleRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if data.role not in VALID_ROLES:
        raise HTTPException(400, f"Role faqat: {', '.join(VALID_ROLES)}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    user.role = data.role
    if data.role in ("admin", "director"):
        user.can_grammar = 1
        user.can_tarjima = 1
        user.can_hujjat = 1
    db.commit()
    db.refresh(user)
    return _user_dict(user)
