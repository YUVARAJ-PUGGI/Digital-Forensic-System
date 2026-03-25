import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import exifr from 'exifr';
import Evidence from '../models/Evidence.js';
import { authMiddleware } from './auth.js';
import { logAudit } from './cases.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(clamp(scaled, 0, 100) * 100) / 100;
};

const normalizeVerdict = (verdict) => {
  const raw = String(verdict || 'INCONCLUSIVE').trim().toUpperCase();

  if (raw === 'LIKELY_AI_GENERATED') return 'AI_GENERATED';
  if (raw === 'LIKELY_CAMERA_CAPTURE') return 'AUTHENTIC';
  if (raw === 'NOT_APPLICABLE') return 'INCONCLUSIVE';

  if (raw === 'AI_GENERATED' || raw === 'AUTHENTIC' || raw === 'INCONCLUSIVE') {
    return raw;
  }

  return 'INCONCLUSIVE';
};

const toLegacyVerdict = (verdict) => {
  if (verdict === 'AI_GENERATED') return 'likely_ai_generated';
  if (verdict === 'AUTHENTIC') return 'likely_camera_capture';
  return 'inconclusive';
};

const toMethodLabel = (method) => (method === 'ML_MODEL' ? 'ML Model' : 'Heuristic Fallback');

const generatorKeywords = [
  'gemini',
  'dall-e',
  'dalle',
  'midjourney',
  'stable diffusion',
  'stable-diffusion',
  'sdxl',
  'adobe firefly',
  'firefly',
  'ai generated',
  'generated',
  'synthetic'
];

const analyzeImageAIGenerationHeuristic = async ({ filePath, mimeType, originalName }) => {
  if (!mimeType?.startsWith('image/')) {
    return {
      ai_probability: 0,
      verdict: 'INCONCLUSIVE',
      confidence: 0,
      sub_scores: {},
      method: 'HEURISTIC_FALLBACK',
      reasons: ['AI image detection is only run for image files.']
    };
  }

  let metadata = {};
  try {
    metadata = (await exifr.parse(filePath, true)) || {};
  } catch {
    metadata = {};
  }

  let score = 0;
  const reasons = [];
  const lowerName = (originalName || '').toLowerCase();
  const software = String(metadata.Software || metadata.ProcessingSoftware || '').toLowerCase();

  if (generatorKeywords.some((k) => lowerName.includes(k))) {
    score += 25;
    reasons.push('Filename includes terms often associated with synthetic image generation.');
  }

  if (generatorKeywords.some((k) => software.includes(k))) {
    score += 45;
    reasons.push('Image software metadata references known AI generation tooling.');
  }

  const hasCameraInfo = Boolean(metadata.Make || metadata.Model);
  const hasCaptureTimestamp = Boolean(metadata.DateTimeOriginal || metadata.CreateDate);
  if (!hasCameraInfo && !hasCaptureTimestamp) {
    score += 15;
    reasons.push('No camera model or capture timestamp metadata was found.');
  }

  const width = Number(metadata.ExifImageWidth || metadata.ImageWidth || metadata.width || 0);
  const height = Number(metadata.ExifImageHeight || metadata.ImageHeight || metadata.height || 0);
  if (width >= 512 && height >= 512 && width % 64 === 0 && height % 64 === 0) {
    score += 10;
    reasons.push('Image dimensions align with common AI model generation block sizes.');
  }

  const likelyCameraSoftware = /(iphone|samsung|google camera|canon|nikon|sony|xiaomi|oppo|vivo)/i.test(software);
  if (likelyCameraSoftware && hasCameraInfo) {
    score -= 30;
    reasons.push('Metadata resembles camera-native capture software and hardware.');
  }

  score = clamp(score, 0, 100);

  let heuristicVerdict = 'inconclusive';
  if (score >= 60) heuristicVerdict = 'likely_ai_generated';
  if (score <= 25) heuristicVerdict = 'likely_camera_capture';

  const confidence = clamp(45 + Math.abs(score - 45), 45, 95);

  if (reasons.length === 0) {
    reasons.push('No strong metadata indicators were detected.');
  }

  return {
    ai_probability: score,
    verdict: normalizeVerdict(heuristicVerdict),
    confidence,
    sub_scores: {
      metadata_signal_score: score
    },
    method: 'HEURISTIC_FALLBACK',
    reasons
  };
};

const analyzeImageAIGeneration = async ({ filePath, mimeType, originalName }) => {
  if (!mimeType?.startsWith('image/')) {
    return analyzeImageAIGenerationHeuristic({ filePath, mimeType, originalName });
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001/analyze';

  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath), {
      filename: originalName || path.basename(filePath),
      contentType: mimeType || 'application/octet-stream'
    });

    const response = await axios.post(mlServiceUrl, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    const subScores = (response.data && typeof response.data.sub_scores === 'object' && response.data.sub_scores !== null)
      ? response.data.sub_scores
      : {};

    return {
      ai_probability: toPercent(response.data?.ai_probability),
      verdict: normalizeVerdict(response.data?.verdict),
      confidence: toPercent(response.data?.confidence),
      sub_scores: subScores,
      method: 'ML_MODEL',
      reasons: ['Result generated by local ML inference service.']
    };
  } catch (error) {
    console.error('ML service request failed, using heuristic fallback:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return analyzeImageAIGenerationHeuristic({ filePath, mimeType, originalName });
  }
};

// Helper function to calculate SHA-256 hash of a file
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

// Handle Evidence Upload & AI Analysis
router.post('/upload', authMiddleware, upload.single('evidenceFile'), async (req, res) => {
  try {
    const { caseId, deviceSeized, witnessPresent, photographedInSitu, tamperEvidentBag, notes } = req.body;
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // 1. Generate SHA-256 Hash for Chain of Custody
    const fileHash = await calculateFileHash(req.file.path);

    // 2. Run ML detection with heuristic fallback
    const aiImageDetection = await analyzeImageAIGeneration({
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    const persistedAI = {
      overallConfidence: aiImageDetection.confidence,
      metadataAnomalies: aiImageDetection.ai_probability,
      status: 'completed',
      aiGeneratedVerdict: toLegacyVerdict(aiImageDetection.verdict),
      aiGeneratedConfidence: aiImageDetection.confidence,
      aiGeneratedReasons: aiImageDetection.reasons,
      ai_probability: aiImageDetection.ai_probability,
      verdict: aiImageDetection.verdict,
      confidence: aiImageDetection.confidence,
      sub_scores: aiImageDetection.sub_scores,
      method: aiImageDetection.method
    };

    // 3. Save to Database
    const newEvidence = new Evidence({
      caseId,
      uploadedBy: req.user.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      hashSha256: fileHash,
      storagePath: req.file.path,
      sopChecklist: {
        deviceSeized: deviceSeized === 'true',
        witnessPresent: witnessPresent === 'true',
        photographedInSitu: photographedInSitu === 'true',
        tamperEvidentBag: tamperEvidentBag === 'true',
        notes
      },
      aiAnalysis: persistedAI
    });

    const savedEvidence = await newEvidence.save();

    // 4. Log Audit Event
    await logAudit(req.user.id, 'UPLOAD_EVIDENCE', savedEvidence._id, 'Evidence', { fileHash });

    res.status(201).json(savedEvidence);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path); // Cleanup on fail
    res.status(500).json({ error: error.message });
  }
});

// Lightweight endpoint for checking if an uploaded image is AI-generated
router.post('/detect-ai', upload.single('evidenceFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const detection = await analyzeImageAIGeneration({
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    });

    res.json({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      ...detection,
      methodLabel: toMethodLabel(detection.method),
      disclaimer: detection.method === 'ML_MODEL'
        ? 'Result generated by local ML model inference service.'
        : 'ML service unavailable. Result generated by metadata heuristic fallback.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Endpoint to fetch evidence for a case
router.get('/case/:caseId', authMiddleware, async (req, res) => {
  try {
    const evidenceList = await Evidence.find({ caseId: req.params.caseId })
      .populate('uploadedBy', 'name badgeNumber')
      .sort({ createdAt: -1 });
    
    // Log view event
    await logAudit(req.user.id, 'VIEW_CASE_EVIDENCE', req.params.caseId, 'Case', {});
    res.json(evidenceList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for Tamper Detection (Re-hash and verify)
router.get('/:id/verify', authMiddleware, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

    // Re-hash the file currently on disk
    if (!fs.existsSync(evidence.storagePath)) {
      await logAudit(req.user.id, 'TAMPER_CHECK_FAILED', evidence._id, 'Evidence', { reason: 'FILE_MISSING' });
      return res.status(404).json({ error: 'FILE_MISSING', message: 'The physical file is missing from storage.' });
    }

    const currentHash = await calculateFileHash(evidence.storagePath);
    const isIntact = currentHash === evidence.hashSha256;

    // Log the verification attempt
    await logAudit(req.user.id, isIntact ? 'VERIFY_INTEGRITY_SUCCESS' : 'VERIFY_INTEGRITY_FAILED', evidence._id, 'Evidence', { expected: evidence.hashSha256, actual: currentHash });

    res.json({
      evidenceId: evidence._id,
      originalHash: evidence.hashSha256,
      currentHash,
      isIntact,
      message: isIntact ? 'File integrity verified. No tampering detected.' : 'WARNING: File tamper detected! Hashes do not match.'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoint for dashboard
router.get('/analytics/summary', async (req, res) => {
  try {
    const totalCount = await Evidence.countDocuments();
    
    const verdictCounts = await Evidence.aggregate([
      {
        $group: {
          _id: '$aiAnalysis.verdict',
          count: { $sum: 1 }
        }
      }
    ]);

    const verdictMap = {
      AI_GENERATED: 0,
      AUTHENTIC: 0,
      INCONCLUSIVE: 0
    };

    verdictCounts.forEach((item) => {
      if (item._id && verdictMap.hasOwnProperty(item._id)) {
        verdictMap[item._id] = item.count;
      }
    });

    const recentEvidence = await Evidence.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('originalName aiAnalysis.verdict aiAnalysis.confidence createdAt')
      .lean();

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const dailyStats = await Evidence.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const avgConfidence = await Evidence.aggregate([
      {
        $match: {
          'aiAnalysis.confidence': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgConf: { $avg: '$aiAnalysis.confidence' }
        }
      }
    ]);

    res.json({
      total: totalCount,
      verdicts: verdictMap,
      recent: recentEvidence,
      dailyStats: dailyStats,
      averageConfidence: avgConfidence.length > 0 ? Math.round(avgConfidence[0].avgConf) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
