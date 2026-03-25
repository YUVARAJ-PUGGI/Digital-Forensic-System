from __future__ import annotations

from datetime import datetime

from dateutil.parser import parse as dt_parse

from app.models.schemas import Indicator, ModuleResult


class SocialMediaForensicsService:
    def analyze(self, platform: str, post_text: str, posted_at: str | None, claimed_location: str | None) -> ModuleResult:
        indicators: list[Indicator] = []

        lower_text = (post_text or "").lower()
        suspicious_terms = ("ai generated", "deepfake", "synthetic", "recreated", "staged")
        if any(term in lower_text for term in suspicious_terms):
            indicators.append(
                Indicator(
                    name="self_declared_synthetic_content",
                    severity="medium",
                    score=0.65,
                    detail="Post text includes terms indicating synthetic/manipulated media.",
                )
            )

        if posted_at:
            try:
                posted = dt_parse(posted_at)
                if posted > datetime.utcnow():
                    indicators.append(
                        Indicator(
                            name="future_timestamp",
                            severity="high",
                            score=0.85,
                            detail="Social post timestamp is in the future.",
                        )
                    )
            except Exception:
                indicators.append(
                    Indicator(
                        name="invalid_timestamp_format",
                        severity="medium",
                        score=0.6,
                        detail="Social post timestamp could not be parsed.",
                    )
                )

        if claimed_location and len(claimed_location.strip()) < 3:
            indicators.append(
                Indicator(
                    name="weak_location_claim",
                    severity="low",
                    score=0.45,
                    detail="Claimed location value appears too short/incomplete.",
                )
            )

        confidence = 0.2 if not indicators else min(0.95, sum(i.score for i in indicators) / len(indicators))
        return ModuleResult(
            module="social_media",
            confidence=confidence,
            indicators=indicators,
            raw={"platform": platform, "posted_at": posted_at, "claimed_location": claimed_location},
        )
