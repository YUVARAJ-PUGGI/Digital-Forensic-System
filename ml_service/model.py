from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn.functional as F
from PIL import Image
from scipy.fft import dctn
from scipy.signal import convolve2d
from torchvision import transforms

MODEL_REPO = "efficientnet-b0-cifake-hybrid-v1"

LOGGER = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent
_WEIGHTS_DIR = _BASE_DIR / "weights"
_MODEL_PATH = _WEIGHTS_DIR / "best_model.pth"
_META_PATH = _WEIGHTS_DIR / "meta.json"

_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_MODEL = None
_FAKE_CLASS_INDEX = 0

_TRANSFORM = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


def _clip01(value: float) -> float:
    return float(np.clip(value, 0.0, 1.0))


def _safe_signal(name: str, fn) -> float:
    try:
        return _clip01(float(fn()))
    except Exception as exc:  # pragma: no cover - defensive fallback
        LOGGER.warning("Signal '%s' failed: %s", name, exc)
        return 0.5


def _load_meta() -> int:
    if not _META_PATH.exists():
        return 0

    try:
        with _META_PATH.open("r", encoding="utf-8") as f:
            meta = json.load(f)
        class_to_idx = meta.get("class_to_idx", {})
        return int(class_to_idx.get("FAKE", 0))
    except Exception as exc:  # pragma: no cover - defensive fallback
        LOGGER.warning("Could not read meta.json: %s", exc)
        return 0


def _load_model() -> bool:
    global _MODEL, _FAKE_CLASS_INDEX

    _FAKE_CLASS_INDEX = _load_meta()

    if not _MODEL_PATH.exists():
        LOGGER.error("Model weights not found at %s", _MODEL_PATH)
        _MODEL = None
        return False

    try:
        model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=2)
        state = torch.load(_MODEL_PATH, map_location=_DEVICE)

        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]

        model.load_state_dict(state, strict=True)
        model.to(_DEVICE)
        model.eval()

        _MODEL = model
        LOGGER.info("Loaded EfficientNet-B0 model from %s on %s", _MODEL_PATH, _DEVICE)
        return True
    except Exception as exc:  # pragma: no cover - defensive fallback
        LOGGER.exception("Failed to load model weights: %s", exc)
        _MODEL = None
        return False


def _efficientnet_score(image: Image.Image) -> float:
    if _MODEL is None:
        return 0.5

    tensor = _TRANSFORM(image).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        logits = _MODEL(tensor)
        probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    return float(probs[_FAKE_CLASS_INDEX])


def _frequency_artifacts_score(gray: np.ndarray) -> float:
    resized = np.asarray(
        Image.fromarray((gray * 255.0).astype(np.uint8), mode="L").resize((256, 256)),
        dtype=np.float32,
    )
    dct = dctn(resized, norm="ortho")
    energy = np.square(np.abs(dct))

    low_energy = float(np.sum(energy[:64, :64]))
    total_energy = float(np.sum(energy) + 1e-12)
    high_energy = max(total_energy - low_energy, 0.0)

    # AI images often have relatively weaker high-frequency components.
    high_share = high_energy / total_energy
    return _clip01(1.0 - high_share)


def _noise_pattern_score(gray: np.ndarray) -> float:
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    lap = convolve2d(gray, kernel, mode="same", boundary="symm")
    lap_std = float(np.std(lap))

    # Real images typically have richer sensor noise; lower std is more suspicious.
    return _clip01(1.0 - np.clip(lap_std / 0.12, 0.0, 1.0))


def run_inference(image_path: str) -> dict:
    image = Image.open(Path(image_path)).convert("RGB")
    gray = np.asarray(image.convert("L"), dtype=np.float32) / 255.0

    sub_scores = {
        "efficientnet_score": _safe_signal(
            "efficientnet_score", lambda: _efficientnet_score(image)
        ),
        "frequency_artifacts": _safe_signal(
            "frequency_artifacts", lambda: _frequency_artifacts_score(gray)
        ),
        "noise_pattern": _safe_signal("noise_pattern", lambda: _noise_pattern_score(gray)),
    }

    ai_probability = _clip01(
        0.70 * sub_scores["efficientnet_score"]
        + 0.15 * sub_scores["frequency_artifacts"]
        + 0.15 * sub_scores["noise_pattern"]
    )

    if ai_probability > 0.55:
        verdict = "AI_GENERATED"
    elif ai_probability < 0.35:
        verdict = "AUTHENTIC"
    else:
        verdict = "INCONCLUSIVE"

    confidence = _clip01(abs(ai_probability - 0.45) * 2.2)

    return {
        "ai_probability": round(ai_probability, 6),
        "verdict": verdict,
        "confidence": round(confidence, 6),
        "sub_scores": {k: round(v, 6) for k, v in sub_scores.items()},
    }


MODEL_LOADED = _load_model()

