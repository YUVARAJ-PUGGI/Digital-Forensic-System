import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  hashSha256: { type: String, required: true }, // For chain of custody / tamper detection
  storagePath: { type: String, required: true },
  sopChecklist: {
    deviceSeized: { type: Boolean, default: false },
    witnessPresent: { type: Boolean, default: false },
    photographedInSitu: { type: Boolean, default: false },
    tamperEvidentBag: { type: Boolean, default: false },
    notes: { type: String }
  },
  aiAnalysis: {
    overallConfidence: { type: Number },
    faceConsistency: { type: Number },
    audioVideoSync: { type: Number },
    compressionArtifacts: { type: Number },
    metadataAnomalies: { type: Number },
    aiGeneratedVerdict: { type: String, enum: ['likely_ai_generated', 'inconclusive', 'likely_camera_capture', 'not_applicable'], default: 'inconclusive' },
    aiGeneratedConfidence: { type: Number },
    aiGeneratedReasons: [{ type: String }],
    ai_probability: { type: Number },
    verdict: { type: String },
    confidence: { type: Number },
    sub_scores: { type: mongoose.Schema.Types.Mixed },
    method: { type: String, enum: ['ML_MODEL', 'HEURISTIC_FALLBACK'] },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
  }
}, { timestamps: true });

export default mongoose.model('Evidence', evidenceSchema);
