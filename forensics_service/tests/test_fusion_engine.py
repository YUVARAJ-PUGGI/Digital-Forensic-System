from app.models.schemas import ModuleResult
from app.services.fusion_engine import ConfidenceFusionEngine


def test_fusion_engine_returns_classification() -> None:
    engine = ConfidenceFusionEngine()
    result = engine.fuse([
        ModuleResult(module="metadata", confidence=0.8, indicators=[], raw={}),
        ModuleResult(module="pixel", confidence=0.7, indicators=[], raw={}),
    ])
    assert result.classification in {"authentic", "ai_generated", "manipulated", "inconclusive"}
    assert 0 <= result.authenticity_score <= 100
    assert 0 <= result.manipulation_likelihood <= 100
