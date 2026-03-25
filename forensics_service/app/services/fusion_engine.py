from __future__ import annotations

from app.core.config import settings
from app.models.schemas import FusionResult, ModuleResult


class ConfidenceFusionEngine:
    def fuse(self, module_results: list[ModuleResult]) -> FusionResult:
        by_module = {m.module: m for m in module_results}

        weighted_risk = 0.0
        total_weight = 0.0

        for name, weight in (
            ("metadata", settings.w_metadata),
            ("pixel", settings.w_pixel),
            ("deepfake_model", settings.w_deepfake),
            ("video_temporal", settings.w_video_temporal),
            ("audio", settings.w_audio),
            ("multimodal", settings.w_multimodal),
        ):
            if name in by_module:
                weighted_risk += by_module[name].confidence * weight
                total_weight += weight

        if total_weight == 0:
            return FusionResult(
                authenticity_score=50.0,
                manipulation_likelihood=50.0,
                classification="inconclusive",
                explanation="No usable forensic modules were available.",
            )

        manipulation_likelihood = (weighted_risk / total_weight) * 100.0
        authenticity_score = max(0.0, 100.0 - manipulation_likelihood)

        if manipulation_likelihood >= 75:
            classification = "ai_generated"
            explanation = "Multiple forensic modules indicate strong synthetic/manipulation signals."
        elif manipulation_likelihood >= 55:
            classification = "manipulated"
            explanation = "Evidence shows moderate-to-high manipulation indicators."
        elif manipulation_likelihood <= 30:
            classification = "authentic"
            explanation = "Most forensic modules indicate authentic capture characteristics."
        else:
            classification = "inconclusive"
            explanation = "Forensic indicators are mixed and do not meet strong decision thresholds."

        return FusionResult(
            authenticity_score=round(authenticity_score, 2),
            manipulation_likelihood=round(manipulation_likelihood, 2),
            classification=classification,
            explanation=explanation,
        )
