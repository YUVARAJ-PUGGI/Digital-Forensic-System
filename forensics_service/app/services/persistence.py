from __future__ import annotations

import os
from datetime import datetime, timezone

from pymongo import MongoClient

from app.core.db import get_session
from app.models.db_models import AnalysisRecord
from app.models.schemas import AnalysisResponse


class PersistenceService:
    def __init__(self) -> None:
        self.backend = os.getenv("PERSISTENCE_BACKEND", "sql").strip().lower()
        self.mongo_uri = os.getenv("MONGODB_URI", "").strip()
        self.mongo_db = os.getenv("MONGODB_DB", "forensics")
        self.mongo_collection = os.getenv("MONGODB_COLLECTION", "analysis_records")

        if self.backend == "mongodb" and not self.mongo_uri:
            raise ValueError("PERSISTENCE_BACKEND=mongodb requires MONGODB_URI")

    def save_analysis(self, analysis: AnalysisResponse) -> str:
        if self.backend == "mongodb":
            return self._save_mongodb(analysis)
        return self._save_sql(analysis)

    def _save_mongodb(self, analysis: AnalysisResponse) -> str:
        payload = {
            "case_id": analysis.case_id,
            "evidence_hash_sha256": analysis.evidence_hash_sha256,
            "media_type": analysis.media_type,
            "classification": analysis.fusion.classification,
            "authenticity_score": analysis.fusion.authenticity_score,
            "manipulation_likelihood": analysis.fusion.manipulation_likelihood,
            "explanation": analysis.fusion.explanation,
            "report_path": analysis.report_path,
            "analyzed_at": analysis.analyzed_at,
            "created_at": datetime.now(timezone.utc),
            "module_results": [m.model_dump(mode="json") for m in analysis.module_results],
        }

        client = MongoClient(self.mongo_uri)
        try:
            collection = client[self.mongo_db][self.mongo_collection]
            result = collection.insert_one(payload)
            return str(result.inserted_id)
        finally:
            client.close()

    def _save_sql(self, analysis: AnalysisResponse) -> str:
        with get_session() as session:
            row = AnalysisRecord(
                case_id=analysis.case_id,
                evidence_hash_sha256=analysis.evidence_hash_sha256,
                media_type=analysis.media_type,
                classification=analysis.fusion.classification,
                authenticity_score=analysis.fusion.authenticity_score,
                manipulation_likelihood=analysis.fusion.manipulation_likelihood,
                explanation=analysis.fusion.explanation,
                report_path=analysis.report_path,
            )
            session.add(row)
            session.flush()
            return str(row.id)
