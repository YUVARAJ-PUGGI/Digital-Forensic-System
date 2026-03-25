from __future__ import annotations

from datetime import datetime
from typing import Any

import exifread
from hachoir.metadata import extractMetadata
from hachoir.parser import createParser

from app.models.schemas import Indicator, ModuleResult


GENERATOR_KEYWORDS = (
    "stable diffusion",
    "midjourney",
    "dall-e",
    "dalle",
    "adobe firefly",
    "gemini",
    "runway",
    "comfyui",
)


class MetadataForensicsService:
    def analyze(self, file_path: str, mime_type: str) -> ModuleResult:
        indicators: list[Indicator] = []
        raw: dict[str, Any] = {}

        exif_tags = self._extract_exif(file_path)
        raw["exif"] = exif_tags

        hachoir_data = self._extract_hachoir(file_path)
        raw["hachoir"] = hachoir_data

        if mime_type.startswith("image/") and not exif_tags:
            indicators.append(
                Indicator(
                    name="missing_exif",
                    severity="medium",
                    score=0.55,
                    detail="Image has no EXIF metadata.",
                )
            )

        software = str(exif_tags.get("Image Software", "")).lower()
        if any(k in software for k in GENERATOR_KEYWORDS):
            indicators.append(
                Indicator(
                    name="generator_software_signature",
                    severity="high",
                    score=0.9,
                    detail=f"Software metadata suggests synthetic generation: {software}",
                )
            )

        dt_original = exif_tags.get("EXIF DateTimeOriginal")
        dt_digitized = exif_tags.get("EXIF DateTimeDigitized")
        if dt_original and dt_digitized and dt_original != dt_digitized:
            indicators.append(
                Indicator(
                    name="timestamp_inconsistency",
                    severity="medium",
                    score=0.65,
                    detail="Capture and digitized timestamps are inconsistent.",
                )
            )

        gps_lat = exif_tags.get("GPS GPSLatitude")
        gps_lon = exif_tags.get("GPS GPSLongitude")
        raw["gps_present"] = bool(gps_lat and gps_lon)

        confidence = self._confidence_from_indicators(indicators)
        return ModuleResult(module="metadata", confidence=confidence, indicators=indicators, raw=raw)

    def _extract_exif(self, file_path: str) -> dict[str, str]:
        with open(file_path, "rb") as f:
            tags = exifread.process_file(f, details=False)
        return {k: str(v) for k, v in tags.items()}

    def _extract_hachoir(self, file_path: str) -> dict[str, Any]:
        parser = createParser(file_path)
        if not parser:
            return {}
        with parser:
            metadata = extractMetadata(parser)
        if metadata is None:
            return {}
        out: dict[str, Any] = {}
        for item in metadata.exportPlaintext():
            if ":" in item:
                k, v = item.split(":", 1)
                out[k.strip()] = v.strip()
        out["analyzed_at"] = datetime.utcnow().isoformat()
        return out

    def _confidence_from_indicators(self, indicators: list[Indicator]) -> float:
        if not indicators:
            return 0.15
        return min(0.98, sum(i.score for i in indicators) / len(indicators))
