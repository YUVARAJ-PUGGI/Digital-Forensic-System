from __future__ import annotations

import librosa
import numpy as np

from app.models.schemas import Indicator, ModuleResult


class AudioForensicsService:
    def analyze(self, file_path: str) -> ModuleResult:
        y, sr = librosa.load(file_path, sr=16000, mono=True)
        if y.size == 0:
            return ModuleResult(module="audio", confidence=0.5, indicators=[
                Indicator(name="audio_decode_failure", severity="high", score=0.8, detail="Audio could not be decoded for forensic analysis.")
            ], raw={})

        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        spectral_flatness = librosa.feature.spectral_flatness(y=y)
        pitch, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"))

        mfcc_var = float(np.mean(np.var(mfcc, axis=1)))
        flatness_mean = float(np.mean(spectral_flatness))
        voiced_ratio = float(np.mean(voiced_flag)) if voiced_flag is not None else 0.0

        indicators: list[Indicator] = []
        if flatness_mean < 0.02:
            indicators.append(Indicator(name="spectral_artifact_low_flatness", severity="medium", score=0.65, detail="Low spectral flatness can indicate over-smoothed or synthetic source characteristics."))
        if mfcc_var < 30.0:
            indicators.append(Indicator(name="mfcc_low_variability", severity="medium", score=0.62, detail="MFCC temporal variability is abnormally low."))
        if voiced_ratio > 0.95:
            indicators.append(Indicator(name="voice_contour_regularization", severity="low", score=0.52, detail="Voiced ratio is unusually stable; may suggest generated speech post-processing."))

        confidence = 0.2 if not indicators else min(0.95, sum(i.score for i in indicators) / len(indicators))
        return ModuleResult(module="audio", confidence=confidence, indicators=indicators, raw={
            "sample_rate": sr,
            "duration_sec": float(len(y) / sr),
            "mfcc_variance": mfcc_var,
            "spectral_flatness_mean": flatness_mean,
            "voiced_ratio": voiced_ratio,
        })
