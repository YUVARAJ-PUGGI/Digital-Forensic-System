from __future__ import annotations

import cv2
import numpy as np

from app.models.schemas import Indicator, ModuleResult


class VideoTemporalForensicsService:
    def sample_frames(self, file_path: str, max_frames: int = 120) -> list[np.ndarray]:
        cap = cv2.VideoCapture(file_path)
        frames: list[np.ndarray] = []
        if not cap.isOpened():
            return frames

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total <= 0:
            total = max_frames
        step = max(1, total // max_frames)

        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % step == 0:
                frames.append(frame)
                if len(frames) >= max_frames:
                    break
            idx += 1
        cap.release()
        return frames

    def analyze(self, file_path: str) -> ModuleResult:
        frames = self.sample_frames(file_path)
        if len(frames) < 3:
            return ModuleResult(module="video_temporal", confidence=0.5, indicators=[
                Indicator(name="insufficient_frames", severity="medium", score=0.5, detail="Not enough frames for temporal analysis.")
            ], raw={"frames": len(frames)})

        gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0 for f in frames]
        diffs = [float(np.mean(np.abs(gray[i] - gray[i - 1]))) for i in range(1, len(gray))]
        accel = [abs(diffs[i] - diffs[i - 1]) for i in range(1, len(diffs))]

        jitter_score = float(np.percentile(accel, 95)) if accel else 0.0
        interpolation_score = float(np.mean([d for d in diffs if d < 0.01]))

        indicators: list[Indicator] = []
        if jitter_score > 0.06:
            indicators.append(Indicator(name="motion_anomaly", severity="medium", score=min(1.0, jitter_score * 8), detail="Unnatural temporal acceleration detected in frame transitions."))
        if interpolation_score > 0.35:
            indicators.append(Indicator(name="frame_interpolation_pattern", severity="medium", score=min(1.0, interpolation_score), detail="High proportion of nearly-identical adjacent frames detected."))

        confidence = 0.2 if not indicators else min(0.95, sum(i.score for i in indicators) / len(indicators))
        return ModuleResult(module="video_temporal", confidence=confidence, indicators=indicators, raw={
            "frames_analyzed": len(frames),
            "jitter_score": jitter_score,
            "interpolation_score": interpolation_score,
            "frame_delta_mean": float(np.mean(diffs)) if diffs else 0.0,
        })
