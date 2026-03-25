from __future__ import annotations

import cv2
import numpy as np
from skimage import filters

from app.models.schemas import Indicator, ModuleResult


class PixelForensicsService:
    def analyze_image(self, file_path: str) -> ModuleResult:
        img_bgr = cv2.imread(file_path)
        if img_bgr is None:
            return ModuleResult(module="pixel", confidence=0.5, indicators=[
                Indicator(name="image_decode_failure", severity="high", score=0.8, detail="Unable to decode image for pixel analysis.")
            ], raw={})

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        indicators: list[Indicator] = []
        raw: dict[str, float] = {}

        ela_score = self._ela_score(file_path)
        raw["ela_score"] = float(ela_score)
        if ela_score > 0.18:
            indicators.append(Indicator(name="ela_anomaly", severity="medium", score=min(1.0, ela_score * 2.2), detail="Error level analysis shows uneven recompression regions."))

        jpeg_score = self._jpeg_blockiness_score(img_rgb)
        raw["jpeg_blockiness"] = float(jpeg_score)
        if jpeg_score > 12.0:
            indicators.append(Indicator(name="jpeg_artifact_anomaly", severity="medium", score=min(1.0, jpeg_score / 20.0), detail="JPEG block artifacts are unusually strong."))

        noise_score = self._noise_residual_score(img_rgb)
        raw["noise_residual"] = float(noise_score)
        if noise_score < 0.010:
            indicators.append(Indicator(name="unnatural_noise_pattern", severity="high", score=0.78, detail="Noise residual appears too smooth for camera capture."))

        lighting_score = self._lighting_inconsistency(img_rgb)
        raw["lighting_inconsistency"] = float(lighting_score)
        if lighting_score > 0.20:
            indicators.append(Indicator(name="lighting_inconsistency", severity="medium", score=min(1.0, lighting_score * 2.0), detail="Patch-level illumination distribution appears inconsistent."))

        confidence = 0.2 if not indicators else min(0.97, sum(i.score for i in indicators) / len(indicators))
        return ModuleResult(module="pixel", confidence=confidence, indicators=indicators, raw=raw)

    def _ela_score(self, file_path: str, quality: int = 90) -> float:
        img = cv2.imread(file_path)
        if img is None:
            return 0.0
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        ok, enc = cv2.imencode(".jpg", img, encode_param)
        if not ok:
            return 0.0
        recompressed = cv2.imdecode(enc, cv2.IMREAD_COLOR)
        diff = cv2.absdiff(img, recompressed)
        return float(np.mean(diff) / 255.0)

    def _jpeg_blockiness_score(self, img_rgb: np.ndarray) -> float:
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
        h, w = gray.shape
        vertical = []
        for x in range(8, w, 8):
            vertical.append(np.mean(np.abs(gray[:, x] - gray[:, x - 1])))
        horizontal = []
        for y in range(8, h, 8):
            horizontal.append(np.mean(np.abs(gray[y, :] - gray[y - 1, :])))
        return float(np.mean(vertical + horizontal) if (vertical or horizontal) else 0.0)

    def _noise_residual_score(self, img_rgb: np.ndarray) -> float:
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        denoised = cv2.GaussianBlur(gray, (5, 5), 0)
        residual = gray - denoised
        return float(np.std(residual))

    def _lighting_inconsistency(self, img_rgb: np.ndarray) -> float:
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        edges = filters.sobel(gray)
        h, w = edges.shape
        ph, pw = max(16, h // 8), max(16, w // 8)
        means = []
        for y in range(0, h, ph):
            for x in range(0, w, pw):
                patch = edges[y:y + ph, x:x + pw]
                if patch.size > 0:
                    means.append(float(np.mean(patch)))
        if len(means) < 2:
            return 0.0
        return float(np.std(means))
