from __future__ import annotations

import os
import tempfile

from flask import Flask, jsonify, request
from flask_cors import CORS

from model import MODEL_LOADED, MODEL_REPO, run_inference

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health() -> tuple:
    return jsonify(
        {
            "status": "ok" if MODEL_LOADED else "degraded",
            "model_loaded": MODEL_LOADED,
            "model_repo": MODEL_REPO,
        }
    ), 200


@app.post("/analyze")
def analyze() -> tuple:
    if "image" not in request.files:
        return jsonify({"error": "Missing file field 'image'"}), 400

    image_file = request.files["image"]
    if not image_file.filename:
        return jsonify({"error": "Empty filename"}), 400

    suffix = os.path.splitext(image_file.filename)[1] or ".jpg"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            image_file.save(temp_file)
            temp_path = temp_file.name

        result = run_inference(temp_path)
        return jsonify(result), 200
    except Exception as exc:  # pragma: no cover - defensive API guard
        return jsonify({"error": f"Model inference failed: {exc}"}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
