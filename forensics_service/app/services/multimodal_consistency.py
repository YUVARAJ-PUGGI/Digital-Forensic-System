from __future__ import annotations

from app.models.schemas import Indicator, ModuleResult


class MultimodalConsistencyService:
    def analyze(self, video_result: ModuleResult | None, audio_result: ModuleResult | None) -> ModuleResult:
        indicators: list[Indicator] = []

        if video_result is None or audio_result is None:
            return ModuleResult(
                module="multimodal",
                confidence=0.5,
                indicators=[
                    Indicator(
                        name="multimodal_unavailable",
                        severity="low",
                        score=0.5,
                        detail="Cross-modal analysis unavailable because audio/video pair is incomplete.",
                    )
                ],
                raw={},
            )

        # Surrogate consistency check: if one modality strongly indicates manipulation
        # while the other appears highly authentic, flag mismatch.
        delta = abs(video_result.confidence - audio_result.confidence)
        if delta > 0.45:
            indicators.append(
                Indicator(
                    name="audio_video_signal_mismatch",
                    severity="high",
                    score=min(1.0, delta),
                    detail="Audio and video forensic confidence differ significantly.",
                )
            )

        confidence = 0.2 if not indicators else min(0.95, sum(i.score for i in indicators) / len(indicators))
        return ModuleResult(module="multimodal", confidence=confidence, indicators=indicators, raw={"modality_delta": delta})
