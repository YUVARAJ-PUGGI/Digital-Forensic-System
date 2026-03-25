from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.models.schemas import AnalysisResponse
from app.services.orchestrator import ForensicOrchestrator
from app.services.persistence import PersistenceService
from app.services.social_media_forensics import SocialMediaForensicsService
from app.services.fusion_engine import ConfidenceFusionEngine

router = APIRouter(prefix="/api/forensics", tags=["forensics"])
engine = ForensicOrchestrator()
persist = PersistenceService()
social_engine = SocialMediaForensicsService()
fusion = ConfidenceFusionEngine()


class SocialAnalyzeRequest(BaseModel):
    case_id: str | None = None
    platform: str
    post_text: str
    posted_at: str | None = None
    claimed_location: str | None = None


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


@router.post("/analyze")
def analyze_evidence(
    evidence_file: UploadFile = File(...),
    case_id: str | None = Form(default=None),
) -> dict:
    os.makedirs(settings.temp_dir, exist_ok=True)

    ext = os.path.splitext(evidence_file.filename or "")[1]
    tmp_name = f"{uuid.uuid4().hex}{ext}"
    tmp_path = os.path.join(settings.temp_dir, tmp_name)

    with open(tmp_path, "wb") as out:
        shutil.copyfileobj(evidence_file.file, out)

    try:
        result = engine.analyze(tmp_path, case_id=case_id)
        record_id = persist.save_analysis(result)
        payload = result.model_dump(mode="json")
        payload["record_id"] = record_id
        return payload
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/analyze/social")
def analyze_social_content(req: SocialAnalyzeRequest) -> dict:
    social_result = social_engine.analyze(
        platform=req.platform,
        post_text=req.post_text,
        posted_at=req.posted_at,
        claimed_location=req.claimed_location,
    )
    fusion_result = fusion.fuse([social_result])

    response = AnalysisResponse(
        case_id=req.case_id,
        evidence_hash_sha256="N/A",
        media_type="social",
        analyzed_at=datetime.utcnow(),
        fusion=fusion_result,
        module_results=[social_result],
        report_path="",
    )
    response.report_path = engine.report_gen.generate(response)
    record_id = persist.save_analysis(response)

    payload = response.model_dump(mode="json")
    payload["record_id"] = record_id
    return payload
