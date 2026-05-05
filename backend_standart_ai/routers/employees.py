"""
Xodimlar CRUD endpointlari.
"""
import datetime
from pathlib import Path

from pydantic import BaseModel, field_validator
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Employee, REPORTS_DIR, Report, get_db

router = APIRouter(prefix="/employees", tags=["employees"])


class EmployeeCreate(BaseModel):
    full_name: str

    @field_validator("full_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Ism bo'sh bo'lmasligi kerak")
        return v


class EmployeeOut(BaseModel):
    id: int
    full_name: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    return db.query(Employee).order_by(Employee.id.desc()).all()


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(full_name=data.full_name)
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Xodim topilmadi")

    reports = db.query(Report).filter(Report.employee_name == emp.full_name).all()
    filenames = {r.docx_filename for r in reports if r.docx_filename}
    for filename in filenames:
        (REPORTS_DIR / Path(filename).name).unlink(missing_ok=True)
    for report in reports:
        for path in REPORTS_DIR.glob(f"*_{report.id}.docx"):
            path.unlink(missing_ok=True)
    for report in reports:
        db.delete(report)

    db.delete(emp)
    db.commit()
