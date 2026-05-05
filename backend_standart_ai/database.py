"""
SQLite ma'lumotlar bazasi — SQLAlchemy orqali.
"""
import datetime
from pathlib import Path

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_DIR = Path("/data")
DB_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_DIR}/standart_tahlil.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Employee(Base):
    __tablename__ = "employees"

    id         = Column(Integer, primary_key=True, index=True)
    full_name  = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


REPORTS_DIR = Path("/data/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class Report(Base):
    __tablename__ = "reports"

    id            = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String(255), nullable=False)
    standard_name = Column(String(500), nullable=False)
    docx_filename = Column(String(255), nullable=False)
    issues_json   = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    first_name   = Column(String(100), nullable=False)
    last_name    = Column(String(100), nullable=False)
    email        = Column(String(255), nullable=False, unique=True)
    phone        = Column(String(20), nullable=False, unique=True)
    role         = Column(String(20), nullable=False, default="employee")
    password     = Column(String(255), nullable=False)
    can_grammar  = Column(Integer, default=0)
    can_tarjima  = Column(Integer, default=1)
    can_hujjat   = Column(Integer, default=0)
    created_at   = Column(DateTime, default=datetime.datetime.utcnow)


class GrammarHistory(Base):
    __tablename__ = "grammar_history"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, nullable=False, index=True)
    filename      = Column(String(500), nullable=False)
    standard_name = Column(String(500), nullable=True)
    issues_count  = Column(Integer, default=0)
    file_id       = Column(String(100), nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)


class TranslationHistory(Base):
    __tablename__ = "translation_history"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, nullable=False, index=True)
    filename   = Column(String(500), nullable=False)
    from_lang  = Column(String(50), nullable=False)
    to_lang    = Column(String(50), nullable=False)
    file_id    = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FormattingHistory(Base):
    __tablename__ = "formatting_history"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, nullable=False, index=True)
    filename   = Column(String(500), nullable=False)
    font       = Column(String(100), nullable=True)
    font_size  = Column(Integer, nullable=True)
    file_id    = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def _safe_alter(conn, sql: str) -> None:
    try:
        conn.execute(__import__("sqlalchemy").text(sql))
        conn.commit()
    except Exception:
        pass


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        _safe_alter(conn, "ALTER TABLE reports ADD COLUMN issues_json TEXT")
        _safe_alter(conn, "ALTER TABLE users ADD COLUMN can_grammar INTEGER DEFAULT 0")
        _safe_alter(conn, "ALTER TABLE users ADD COLUMN can_tarjima INTEGER DEFAULT 1")
        _safe_alter(conn, "ALTER TABLE users ADD COLUMN can_hujjat INTEGER DEFAULT 0")
        _safe_alter(conn, "ALTER TABLE grammar_history ADD COLUMN file_id TEXT")
        _safe_alter(conn, "ALTER TABLE translation_history ADD COLUMN file_id TEXT")
        _safe_alter(conn, "ALTER TABLE formatting_history ADD COLUMN file_id TEXT")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
