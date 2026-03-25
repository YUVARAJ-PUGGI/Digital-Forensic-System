from __future__ import annotations

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    evidence_hash_sha256: Mapped[str] = mapped_column(String(128), index=True)
    media_type: Mapped[str] = mapped_column(String(32), index=True)
    classification: Mapped[str] = mapped_column(String(32), index=True)
    authenticity_score: Mapped[float] = mapped_column(Float)
    manipulation_likelihood: Mapped[float] = mapped_column(Float)
    explanation: Mapped[str] = mapped_column(Text)
    report_path: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
