# Digital Forensic Analysis Service

Production-style FastAPI service for hybrid forensic analysis of digital evidence.

## Capabilities

- Metadata forensics: EXIF, parser metadata, software signatures, timestamp consistency.
- Pixel forensics: ELA, JPEG artifact blockiness, residual noise profile, lighting inconsistency.
- Deepfake model layer: PyTorch CNN inference interface with pluggable checkpoints.
- Video temporal forensics: frame transition and interpolation anomaly scoring.
- Audio forensics: MFCC, spectral flatness, pitch contour-derived indicators.
- Cross-modal consistency: audio-video confidence mismatch checks.
- Evidence integrity: SHA-256 hashing for chain-of-custody integrity.
- Confidence fusion engine: weighted aggregation into final authenticity assessment.
- Legal report output: structured PDF report.

## Classification Output

- authentic
- ai_generated
- manipulated
- inconclusive

## Quick Start

1. Create and activate a Python environment.
2. Install dependencies:
   pip install -r requirements.txt
3. Configure persistence backend.

SQL (default):
  set PERSISTENCE_BACKEND=sql
  set DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/forensics

MongoDB:
  set PERSISTENCE_BACKEND=mongodb
  set MONGODB_URI=mongodb://localhost:27017
  set MONGODB_DB=forensics
  set MONGODB_COLLECTION=analysis_records
3. Run API:
   uvicorn app.main:app --reload --port 8100

## Analyze Endpoint

- POST `/api/forensics/analyze`
- multipart form fields:
  - `evidence_file`: binary file
  - `case_id`: optional string

Example curl:

```bash
curl -X POST "http://localhost:8100/api/forensics/analyze" \
  -F "evidence_file=@/path/to/evidence.jpg" \
  -F "case_id=CASE-2026-001"
```

## Social Content Endpoint

- POST `/api/forensics/analyze/social`

Example payload:

```json
{
  "case_id": "CASE-2026-002",
  "platform": "X",
  "post_text": "Breaking footage from downtown",
  "posted_at": "2026-03-25T10:30:00Z",
  "claimed_location": "Bengaluru"
}
```

The service stores each analysis result in the configured SQL or MongoDB backend and returns a `record_id`.

## Notes on Deep Learning Models

The included CNN is a deployable placeholder architecture for inference wiring.
For courtroom-grade operation:

- train and validate with FaceForensics++, DFDC, Celeb-DF
- measure AUC/EER/FPR at fixed TPR on held-out and out-of-domain sets
- log model card, training lineage, and calibration outputs
- plug trained weights via `DeepfakeModelService(weights_path=...)`

## React Dashboard Integration

Use your existing React app to call:

- `POST http://localhost:8100/api/forensics/analyze`
- `POST http://localhost:8100/api/forensics/analyze/social`

Render these response fields in the dashboard:

- `fusion.authenticity_score`
- `fusion.manipulation_likelihood`
- `fusion.classification`
- `module_results[*].indicators`
- `report_path`

## Suggested Production Additions

- async job queue for long-running video analysis
- signed audit logs and immutable evidence ledger
- role-based access control and chain-of-custody event API
- CI with deterministic forensic regression tests
