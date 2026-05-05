"""
Foydalanuvchi harakatlari tarixi endpointlari.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import GrammarHistory, TranslationHistory, FormattingHistory, User, get_db
from routers.auth import require_user

router = APIRouter(prefix="/history", tags=["history"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class GrammarHistoryRequest(BaseModel):
    filename: str
    standard_name: Optional[str] = None
    issues_count: int = 0
    file_id: Optional[str] = None


class TranslationHistoryRequest(BaseModel):
    filename: str
    from_lang: str
    to_lang: str
    file_id: Optional[str] = None


class FormattingHistoryRequest(BaseModel):
    filename: str
    font: Optional[str] = None
    font_size: Optional[int] = None
    file_id: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/grammar")
def add_grammar(
    data: GrammarHistoryRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    record = GrammarHistory(
        user_id=user.id,
        filename=data.filename,
        standard_name=data.standard_name,
        issues_count=data.issues_count,
        file_id=data.file_id,
    )
    db.add(record)
    db.commit()
    return {"ok": True}


@router.post("/translation")
def add_translation(
    data: TranslationHistoryRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    record = TranslationHistory(
        user_id=user.id,
        filename=data.filename,
        from_lang=data.from_lang,
        to_lang=data.to_lang,
        file_id=data.file_id,
    )
    db.add(record)
    db.commit()
    return {"ok": True}


@router.post("/formatting")
def add_formatting(
    data: FormattingHistoryRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    record = FormattingHistory(
        user_id=user.id,
        filename=data.filename,
        font=data.font,
        font_size=data.font_size,
        file_id=data.file_id,
    )
    db.add(record)
    db.commit()
    return {"ok": True}
