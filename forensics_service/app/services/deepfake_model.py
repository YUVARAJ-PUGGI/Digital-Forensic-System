from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from torch import nn

from app.models.schemas import Indicator, ModuleResult


class DeepfakeBackbone(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(128, 1), nn.Sigmoid())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


class DeepfakeModelService:
    def __init__(self, weights_path: str | None = None) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = DeepfakeBackbone().to(self.device)
        self.model.eval()

        if weights_path and Path(weights_path).exists():
            state = torch.load(weights_path, map_location=self.device)
            self.model.load_state_dict(state)

    def analyze_image(self, file_path: str) -> ModuleResult:
        frame = cv2.imread(file_path)
        if frame is None:
            return ModuleResult(module="deepfake_model", confidence=0.5, indicators=[
                Indicator(name="model_input_error", severity="high", score=0.8, detail="Could not decode image for deepfake model inference.")
            ], raw={})

        prob = self._infer_frame(frame)
        indicators = []
        if prob > 0.65:
            indicators.append(Indicator(name="model_detected_synthetic_artifacts", severity="high", score=float(prob), detail="CNN model predicts high likelihood of synthetic/manipulated image."))

        return ModuleResult(
            module="deepfake_model",
            confidence=float(prob),
            indicators=indicators,
            raw={"ai_probability": float(prob)},
        )

    def analyze_video(self, frames: list[np.ndarray]) -> ModuleResult:
        if not frames:
            return ModuleResult(module="deepfake_model", confidence=0.5, indicators=[], raw={"ai_probability": 0.5})
        probs = [self._infer_frame(f) for f in frames]
        p = float(np.mean(probs))
        indicators = []
        if p > 0.65:
            indicators.append(Indicator(name="model_detected_video_deepfake_pattern", severity="high", score=p, detail="Frame-wise CNN inference indicates deepfake-like artifacts."))
        return ModuleResult(module="deepfake_model", confidence=p, indicators=indicators, raw={"ai_probability": p, "frame_probs": probs[:20]})

    def _infer_frame(self, frame_bgr: np.ndarray) -> float:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (256, 256)).astype(np.float32) / 255.0
        tensor = torch.from_numpy(resized).permute(2, 0, 1).unsqueeze(0).to(self.device)
        with torch.no_grad():
            pred = self.model(tensor).squeeze().item()
        return float(pred)


def training_blueprint() -> dict[str, Any]:
    return {
        "recommended_architectures": ["XceptionNet", "EfficientNet-B4", "ResNet50"],
        "datasets": ["FaceForensics++", "DFDC", "Celeb-DF"],
        "target_signals": ["facial artifacts", "skin texture irregularities", "reflection anomalies", "GAN priors"],
        "note": "Integrate a trained checkpoint by passing weights_path to DeepfakeModelService.",
    }
