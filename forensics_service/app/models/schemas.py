from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class Indicator(BaseModel):
    name: str
    severity: str = Field(description="low|medium|high")
    score: float = Field(ge=0, le=1)
    detail: str


class ModuleResult(BaseModel):
    module: str
    confidence: float = Field(ge=0, le=1)
    indicators: list[Indicator] = []
    raw: dict[str, Any] = {}


class FusionResult(BaseModel):
    authenticity_score: float = Field(ge=0, le=100)
    manipulation_likelihood: float = Field(ge=0, le=100)
    classification: str = Field(description="authentic|ai_generated|manipulated|inconclusive")
    explanation: str


class AnalysisResponse(BaseModel):
    case_id: str | None = None
    evidence_hash_sha256: str
    media_type: str
    analyzed_at: datetime
    fusion: FusionResult
    module_results: list[ModuleResult]
    report_path: str
