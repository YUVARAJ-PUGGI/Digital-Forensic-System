from __future__ import annotations

import mimetypes
import os
from datetime import datetime

from app.models.schemas import AnalysisResponse, ModuleResult
from app.services.audio_forensics import AudioForensicsService
from app.services.deepfake_model import DeepfakeModelService
from app.services.fusion_engine import ConfidenceFusionEngine
from app.services.metadata_forensics import MetadataForensicsService
from app.services.multimodal_consistency import MultimodalConsistencyService
from app.services.pixel_forensics import PixelForensicsService
from app.services.report_generator import ForensicReportGenerator
from app.services.video_temporal_forensics import VideoTemporalForensicsService
from app.utils.hashing import sha256_file


class ForensicOrchestrator:
    def __init__(self) -> None:
        self.metadata = MetadataForensicsService()
        self.pixel = PixelForensicsService()
        self.deepfake = DeepfakeModelService()
        self.video_temporal = VideoTemporalForensicsService()
        self.audio = AudioForensicsService()
        self.multimodal = MultimodalConsistencyService()
        self.fusion = ConfidenceFusionEngine()
        self.report_gen = ForensicReportGenerator()

    def analyze(self, file_path: str, case_id: str | None = None) -> AnalysisResponse:
        mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        media_type = self._normalize_media_type(mime_type)
        evidence_hash = sha256_file(file_path)

        results: list[ModuleResult] = []

        metadata_res = self.metadata.analyze(file_path, mime_type)
        results.append(metadata_res)

        video_res: ModuleResult | None = None
        audio_res: ModuleResult | None = None

        if media_type == "image":
            results.append(self.pixel.analyze_image(file_path))
            results.append(self.deepfake.analyze_image(file_path))

        elif media_type == "video":
            video_res = self.video_temporal.analyze(file_path)
            results.append(video_res)
            frames = self.video_temporal.sample_frames(file_path, max_frames=32)
            results.append(self.deepfake.analyze_video(frames))

        elif media_type == "audio":
            audio_res = self.audio.analyze(file_path)
            results.append(audio_res)

        elif media_type == "social":
            # Social media content can map to image/video/audio payloads after collector pre-processing.
            pass

        if media_type == "video":
            # Optional cross-modal check when extracted audio is available.
            results.append(self.multimodal.analyze(video_res, audio_res))

        fusion = self.fusion.fuse(results)

        response = AnalysisResponse(
            case_id=case_id,
            evidence_hash_sha256=evidence_hash,
            media_type=media_type,
            analyzed_at=datetime.utcnow(),
            fusion=fusion,
            module_results=results,
            report_path="",
        )

        report = self.report_gen.generate(response)
        response.report_path = os.path.abspath(report)
        return response

    def _normalize_media_type(self, mime_type: str) -> str:
        if mime_type.startswith("image/"):
            return "image"
        if mime_type.startswith("video/"):
            return "video"
        if mime_type.startswith("audio/"):
            return "audio"
        return "social"
