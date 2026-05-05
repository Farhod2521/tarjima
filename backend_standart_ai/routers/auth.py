"""
Auth endpointlari: register, login, me.
"""
import re
import datetime
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = "standart_tahlil_ai_secret_2024"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("998"):
        digits = digits[3:]
    digits = digits[-9:] if len(digits) > 9 else digits
    return f"+998{digits}"


def _make_password(first_name: str, phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    last4 = digits[-4:] if len(digits) >= 4 else digits
    return f"{first_name}_{last4}"


def _create_token(user_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role,
        "password": u.password,
        "can_grammar": bool(u.can_grammar),
        "can_tarjima": bool(u.can_tarjima),
        "can_hujjat": bool(u.can_hujjat),
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── Auth dependency ────────────────────────────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not authorization:
        return None
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(401, "Autentifikatsiya talab qilinadi")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role not in ("admin", "director"):
        raise HTTPException(403, "Ruxsat yo'q — faqat admin yoki direktor")
    return user


# ── Schemas ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str


class LoginRequest(BaseModel):
    phone: str
    password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    phone = _clean_phone(data.phone)

    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(400, "Bu telefon raqam allaqachon ro'yxatdan o'tgan")
    if db.query(User).filter(User.email == data.email.strip()).first():
        raise HTTPException(400, "Bu elektron pochta allaqachon ro'yxatdan o'tgan")

    password = _make_password(data.first_name.strip(), phone)
    is_first = db.query(User).count() == 0
    role = "admin" if is_first else "employee"

    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.strip(),
        phone=phone,
        password=password,
        role=role,
        can_grammar=1 if is_first else 0,
        can_tarjima=1,
        can_hujjat=1 if is_first else 0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _create_token(user.id, user.role)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    phone = _clean_phone(data.phone)
    user = db.query(User).filter(User.phone == phone).first()
    if not user or user.password != data.password:
        raise HTTPException(401, "Telefon raqam yoki parol noto'g'ri")

    token = _create_token(user.id, user.role)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
def get_me(user: User = Depends(require_user)):
    return _user_dict(user)
