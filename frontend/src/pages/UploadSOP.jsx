import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  CheckCircle,
  ShieldAlert,
  FileText,
  ArrowRight,
  Sparkles,
  Info,
  Activity,
  Download,
  FileDown,
  Hash,
  Image as ImageIcon,
  Video,
  AudioLines,
  Clock3,
} from 'lucide-react';

const HISTORY_KEY = 'veritrace_public_history';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 2)} ${units[i]}`;
};

const toPercentDisplay = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(Math.max(0, Math.min(100, scaled)) * 100) / 100;
};

const toDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'N/A';
  }
};

const shortHash = (hash) => {
  if (!hash || hash.length < 18) return hash || 'Pending';
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
};

const statusClass = (status) => {
  if (status === 'AI_GENERATED') return 'text-rose-300 bg-rose-500/20 border-rose-500/40';
  if (status === 'AUTHENTIC') return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
  return 'text-amber-300 bg-amber-500/20 border-amber-500/40';
};

const createImageMaps = async (file) => {
  const originalUrl = URL.createObjectURL(file);
  const img = new Image();

  const loadImage = new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  img.src = originalUrl;
  await loadImage;

  const maxSide = 680;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < src.length; i += 4, p += 1) {
    gray[p] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
  }

  const edgeData = ctx.createImageData(width, height);
  const noiseData = ctx.createImageData(width, height);
  const elaData = ctx.createImageData(width, height);

  const idx = (x, y) => y * width + x;
  const clamp = (v) => Math.max(0, Math.min(255, v));

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = idx(x, y);
      const gx =
        -gray[idx(x - 1, y - 1)] - 2 * gray[idx(x - 1, y)] - gray[idx(x - 1, y + 1)]
        + gray[idx(x + 1, y - 1)] + 2 * gray[idx(x + 1, y)] + gray[idx(x + 1, y + 1)];
      const gy =
        -gray[idx(x - 1, y - 1)] - 2 * gray[idx(x, y - 1)] - gray[idx(x + 1, y - 1)]
        + gray[idx(x - 1, y + 1)] + 2 * gray[idx(x, y + 1)] + gray[idx(x + 1, y + 1)];
      const edge = clamp(Math.sqrt(gx * gx + gy * gy));

      const avg = (
        gray[idx(x - 1, y - 1)] + gray[idx(x, y - 1)] + gray[idx(x + 1, y - 1)]
        + gray[idx(x - 1, y)] + gray[p] + gray[idx(x + 1, y)]
        + gray[idx(x - 1, y + 1)] + gray[idx(x, y + 1)] + gray[idx(x + 1, y + 1)]
      ) / 9;

      const noise = clamp(Math.abs(gray[p] - avg) * 8);
      const ela = clamp(Math.abs((gray[p] - avg) * 5 + edge * 0.35));

      const e = p * 4;
      edgeData.data[e] = edge;
      edgeData.data[e + 1] = edge;
      edgeData.data[e + 2] = edge;
      edgeData.data[e + 3] = 255;

      noiseData.data[e] = 40;
      noiseData.data[e + 1] = noise;
      noiseData.data[e + 2] = 180;
      noiseData.data[e + 3] = 255;

      elaData.data[e] = ela;
      elaData.data[e + 1] = 40;
      elaData.data[e + 2] = 40;
      elaData.data[e + 3] = 255;
    }
  }

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = width;
  mapCanvas.height = height;
  const mapCtx = mapCanvas.getContext('2d');

  const toUrl = (data) => {
    mapCtx.putImageData(data, 0, 0);
    return mapCanvas.toDataURL('image/png');
  };

  const edgeUrl = toUrl(edgeData);
  const noiseUrl = toUrl(noiseData);
  const elaUrl = toUrl(elaData);

  return {
    originalUrl,
    edgeUrl,
    noiseUrl,
    elaUrl,
    width: img.width,
    height: img.height,
  };
};

const computeSha256 = async (file) => {
  if (!window.crypto || !window.crypto.subtle) return null;
  const buffer = await file.arrayBuffer();
  const digest = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const UploadSOP = () => {
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [evidenceHash, setEvidenceHash] = useState('Pending');
  const [previewTab, setPreviewTab] = useState('original');
  const [previewMaps, setPreviewMaps] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiDetection, setAiDetection] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const [historyItems, setHistoryItems] = useState([]);
  const [systemStatus, setSystemStatus] = useState({ status: 'checking', model_loaded: false, model_repo: 'N/A' });

  const [checklist, setChecklist] = useState({
    deviceSeized: false,
    witnessPresent: false,
    photographedInSitu: false,
    tamperEvidentBag: false,
  });
  const [notes, setNotes] = useState('');

  const checklistLabels = {
    deviceSeized: 'Source device available and preserved',
    witnessPresent: 'Verification performed with witness or collaborator',
    photographedInSitu: 'Original context captured before transfer',
    tamperEvidentBag: 'File handling followed tamper-safe process',
  };

  const probability = toPercentDisplay(aiDetection && aiDetection.ai_probability);
  const probabilityBarClass = probability > 60
    ? 'bg-rose-500'
    : probability >= 40
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  const verdict = String((aiDetection && aiDetection.verdict) || 'INCONCLUSIVE').toUpperCase();
  const methodLabel = aiDetection && aiDetection.method === 'ML_MODEL' ? 'ML Model' : 'Heuristic Fallback';

  const previewSource = useMemo(() => {
    if (!previewMaps) return null;
    if (previewTab === 'edge') return previewMaps.edgeUrl;
    if (previewTab === 'noise') return previewMaps.noiseUrl;
    if (previewTab === 'ela') return previewMaps.elaUrl;
    return previewMaps.originalUrl;
  }, [previewMaps, previewTab]);

  const resetAnalysis = () => {
    setAiDetection(null);
    setSubmitError('');
  };

  const loadFileArtifacts = async (selectedFile) => {
    setIsPreparingFile(true);
    resetAnalysis();

    if (previewMaps && previewMaps.originalUrl) {
      URL.revokeObjectURL(previewMaps.originalUrl);
    }

    try {
      setFile(selectedFile);

      const meta = {
        name: selectedFile.name,
        type: selectedFile.type || 'unknown',
        size: selectedFile.size,
        sizeLabel: formatBytes(selectedFile.size),
        lastModified: toDateTime(selectedFile.lastModified),
        resolution: 'N/A',
      };

      if (selectedFile.type.startsWith('image/')) {
        const maps = await createImageMaps(selectedFile);
        setPreviewMaps(maps);
        setPreviewTab('original');
        meta.resolution = `${maps.width} x ${maps.height}`;
      } else {
        setPreviewMaps(null);
      }

      const sha = await computeSha256(selectedFile);
      setEvidenceHash(sha || 'Not available in this browser');
      setFileMeta(meta);
    } catch (err) {
      setSubmitError('Unable to read file metadata. Please try a different file.');
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFileArtifacts(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      loadFileArtifacts(e.target.files[0]);
    }
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmitForDetection = async () => {
    if (!file) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('evidenceFile', file);

      const res = await fetch('http://localhost:5000/api/evidence/detect-ai', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Detection failed');
      }

      setAiDetection(data);
    } catch (err) {
      setSubmitError((err && err.message) || 'Unable to analyze file');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAnalysis = () => {
    if (!aiDetection || !fileMeta) return;

    const payload = {
      generatedAt: new Date().toISOString(),
      file: fileMeta,
      evidenceHash,
      verdict: aiDetection.verdict,
      aiProbability: aiDetection.ai_probability,
      confidence: aiDetection.confidence,
      subScores: aiDetection.sub_scores,
      method: aiDetection.method,
      reasons: aiDetection.reasons,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${fileMeta.name || 'media'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGeneratePdf = () => {
    if (!aiDetection || !fileMeta) return;

    const w = window.open('', '_blank');
    if (!w) return;

    const rows = Object.entries(aiDetection.sub_scores || {})
      .map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #ddd;">${k.replace(/_/g, ' ')}</td><td style="padding:6px 0;border-bottom:1px solid #ddd;text-align:right;">${toPercentDisplay(v)}%</td></tr>`)
      .join('');

    w.document.write(`
      <html><head><title>Media Analysis Report</title></head>
      <body style="font-family:Arial, sans-serif;padding:24px;color:#0f172a;">
        <h1 style="margin:0 0 6px;">Media Authenticity Report</h1>
        <p style="margin:0 0 16px;color:#475569;">Generated ${new Date().toLocaleString()}</p>
        <h3>File Information</h3>
        <p><b>Name:</b> ${fileMeta.name}</p>
        <p><b>Type:</b> ${fileMeta.type}</p>
        <p><b>Size:</b> ${fileMeta.sizeLabel}</p>
        <p><b>Resolution:</b> ${fileMeta.resolution}</p>
        <p><b>SHA-256:</b> ${evidenceHash}</p>
        <h3>Detection Result</h3>
        <p><b>Verdict:</b> ${aiDetection.verdict}</p>
        <p><b>AI Probability:</b> ${toPercentDisplay(aiDetection.ai_probability)}%</p>
        <p><b>Confidence:</b> ${toPercentDisplay(aiDetection.confidence)}%</p>
        <h3>Forensic Signal Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </body></html>
    `);

    w.document.close();
    w.focus();
    w.print();
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setHistoryItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistoryItems([]);
    }
  }, []);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:5001/health');
        const data = await res.json();
        setSystemStatus(data);
      } catch {
        setSystemStatus({ status: 'offline', model_loaded: false, model_repo: 'unreachable' });
      }
    };

    fetchHealth();
  }, []);

  useEffect(() => {
    if (!aiDetection || !fileMeta) return;

    setHistoryItems((prev) => {
      const item = {
        id: `${Date.now()}`,
        fileName: fileMeta.name,
        verdict: aiDetection.verdict,
        probability: toPercentDisplay(aiDetection.ai_probability),
        timestamp: new Date().toISOString(),
      };
      const next = [item, ...prev].slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [aiDetection, fileMeta]);

  useEffect(() => () => {
    if (previewMaps && previewMaps.originalUrl) {
      URL.revokeObjectURL(previewMaps.originalUrl);
    }
  }, [previewMaps]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="glass-panel p-6 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Media Verification Workflow</h2>
            <p className="text-slate-400 mt-1">Upload media, complete verification checklist, and review AI authenticity assessment.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-neon-blue/30 bg-neon-blue/10 text-neon-blue font-semibold">
            <Sparkles className="w-4 h-4" />
            PUBLIC MODE
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 relative z-0">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-dark-700 -z-10 rounded-full">
          <div className="h-full bg-neon-blue rounded-full transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step >= i ? 'bg-neon-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-dark-800 text-slate-500 border border-dark-600'
            }`}
          >
            {i}
          </div>
        ))}
      </div>

      <div className="glass-panel p-8 relative overflow-hidden">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <UploadCloud className="text-neon-cyan" />
              <span>Step 1: Upload Media File</span>
            </h3>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="border-2 border-dashed border-dark-600 hover:border-neon-blue bg-dark-900/40 rounded-2xl p-12 text-center cursor-pointer transition-all group"
            >
              <UploadCloud className="w-16 h-16 mx-auto text-slate-500 group-hover:text-neon-blue transition-colors mb-4" />
              {file ? (
                <div>
                  <p className="text-lg font-medium text-neon-blue">{file.name}</p>
                  <p className="text-sm text-slate-400">{fileMeta ? fileMeta.sizeLabel : formatBytes(file.size)} • Ready for verification</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium text-slate-300">Drag and drop file here or click to browse</p>
                  <p className="text-sm text-slate-500 mt-2">Supported: MP4, AVI, JPEG, PNG, WAV • Max 500MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" id="file-upload" onChange={handleFileSelect} />
            </div>

            {fileMeta && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-dark-900/40 border border-dark-700/50">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">File Details</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-slate-400">Type:</span> {fileMeta.type}</p>
                    <p><span className="text-slate-400">Size:</span> {fileMeta.sizeLabel}</p>
                    <p><span className="text-slate-400">Resolution:</span> {fileMeta.resolution}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-dark-900/40 border border-dark-700/50">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Evidence Fingerprint</p>
                  <div className="flex items-start gap-2 text-sm">
                    <Hash className="w-4 h-4 text-neon-cyan mt-0.5" />
                    <p className="font-mono break-all text-slate-300">{shortHash(evidenceHash)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-dark-900/40 border border-dark-700/50 flex items-start gap-3">
              <Info className="w-5 h-5 text-neon-cyan mt-0.5" />
              <p className="text-sm text-slate-300">
                Files are analyzed for authenticity scoring only. Keep original source files unchanged for best reliability.
              </p>
            </div>

            {isPreparingFile && (
              <div className="text-sm text-slate-400">Preparing preview, metadata, and integrity fingerprint...</div>
            )}

            <div className="flex justify-end pt-4">
              <button onClick={() => { if (file) handleNext(); }} disabled={!file} className={`btn-primary flex items-center space-x-2 ${!file ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <ShieldAlert className="text-rose-500" />
              <span>Step 2: Verification Checklist</span>
            </h3>

            <div className="space-y-4">
              {Object.entries(checklist).map(([key, val]) => (
                <label key={key} className="flex items-center space-x-4 p-4 bg-dark-900/40 rounded-xl border border-dark-700/50 hover:border-dark-600 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => setChecklist({ ...checklist, [key]: !val })}
                    className="w-5 h-5 rounded border-dark-500 text-neon-blue focus:ring-neon-blue bg-dark-800"
                  />
                  <span className="font-medium text-slate-200">{checklistLabels[key]}</span>
                </label>
              ))}

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="glass-input min-h-[100px] resize-none"
                  placeholder="Add context for reviewers, source notes, or any verification caveats..."
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-outline">Back</button>
              <button onClick={handleNext} className="btn-primary flex items-center space-x-2">
                <span>Review and Analyze</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <FileText className="text-emerald-500" />
              <span>Step 3: Final Review and Detection</span>
            </h3>

            <div className="bg-dark-900/60 p-6 rounded-xl border border-dark-700/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">File Name</p>
                  <p className="font-medium">{file ? file.name : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">File Size</p>
                  <p className="font-medium">{fileMeta ? fileMeta.sizeLabel : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Media Type</p>
                  <p className="font-medium">{fileMeta ? fileMeta.type : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Resolution</p>
                  <p className="font-medium">{fileMeta ? fileMeta.resolution : 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-500">Evidence Fingerprint (SHA-256)</p>
                  <p className="font-mono text-neon-blue bg-dark-800 p-2 rounded mt-1 overflow-x-auto text-xs">
                    {evidenceHash}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start space-x-3">
              <CheckCircle className="text-rose-500 w-6 h-6 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-300">
                By submitting, you confirm this file can be processed for authenticity assessment and that the provided details are accurate to the best of your knowledge.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-outline">Back</button>
              <button
                onClick={handleSubmitForDetection}
                disabled={isSubmitting || !file}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{isSubmitting ? 'Analyzing...' : 'Run Authenticity Check'}</span>
              </button>
            </div>

            {submitError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-200">
                {submitError}
              </div>
            )}

            {aiDetection && (
              <div className="space-y-6">
                <div className="bg-dark-900/60 p-6 rounded-xl border border-dark-700/50 space-y-4">
                  <p className="text-slate-400 text-sm">AI Generation Assessment</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-dark-800/70 border border-dark-700/60">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">AI Probability</p>
                      <p className="text-2xl font-bold">{probability}%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-dark-800/70 border border-dark-700/60">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Verdict</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${statusClass(verdict)}`}>
                        {verdict}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-dark-800/70 border border-dark-700/60">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Confidence</p>
                      <p className="text-2xl font-bold">{toPercentDisplay(aiDetection.confidence)}%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Probability Visualization</span>
                      <span className="font-semibold text-white">{probability}%</span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-dark-700 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${probabilityBarClass}`} style={{ width: `${probability}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-xs text-slate-300 bg-dark-800 px-3 py-1 rounded-full border border-dark-600">
                      Detection Method: {methodLabel}
                    </span>
                    <span className="text-xs text-slate-300 bg-dark-800 px-3 py-1 rounded-full border border-dark-600">
                      Generated: {new Date().toLocaleString()}
                    </span>
                  </div>

                  {aiDetection.sub_scores && Object.keys(aiDetection.sub_scores).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-300 font-medium">Forensic Signal Breakdown</p>
                      <div className="rounded-xl border border-dark-700/60 overflow-hidden">
                        {Object.entries(aiDetection.sub_scores).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center px-4 py-3 text-sm border-b border-dark-700/60 last:border-b-0 bg-dark-800/40">
                            <span className="text-slate-300 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-semibold text-slate-100">{toPercentDisplay(value)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiDetection.reasons && aiDetection.reasons.length > 0 && (
                    <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                      {aiDetection.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}

                  <p className="text-xs text-slate-500">{aiDetection.disclaimer}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-700/50 space-y-4">
                    <h4 className="font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-neon-cyan" />Image Analysis Preview</h4>
                    {previewSource ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'original', label: 'Original' },
                            { key: 'edge', label: 'Edge Map' },
                            { key: 'noise', label: 'Noise Map' },
                            { key: 'ela', label: 'ELA Map' },
                          ].map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setPreviewTab(tab.key)}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${previewTab === tab.key ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40' : 'bg-dark-800 text-slate-300 border-dark-600 hover:border-dark-500'}`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="rounded-xl overflow-hidden border border-dark-700/60 bg-dark-900/70">
                          <img src={previewSource} alt="Analysis preview" className="w-full h-auto object-contain max-h-[360px]" />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Preview maps are available for image files only.</p>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-700/50 space-y-3">
                      <h4 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-neon-cyan" />Evidence Metadata</h4>
                      <div className="text-sm space-y-2">
                        <p><span className="text-slate-400">File Name:</span> {fileMeta ? fileMeta.name : 'N/A'}</p>
                        <p><span className="text-slate-400">File Size:</span> {fileMeta ? fileMeta.sizeLabel : 'N/A'}</p>
                        <p><span className="text-slate-400">Resolution:</span> {fileMeta ? fileMeta.resolution : 'N/A'}</p>
                        <p><span className="text-slate-400">Created Date:</span> {fileMeta ? fileMeta.lastModified : 'N/A'}</p>
                        <p><span className="text-slate-400">Type:</span> {fileMeta ? fileMeta.type : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-700/50 space-y-3">
                      <h4 className="font-semibold flex items-center gap-2"><Hash className="w-4 h-4 text-neon-cyan" />Evidence Hash (SHA-256)</h4>
                      <p className="font-mono text-xs break-all text-slate-300 bg-dark-800 p-3 rounded-lg border border-dark-700/60">{evidenceHash}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-700/50 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-neon-cyan" />System Status</h4>
                    <div className="text-sm space-y-2">
                      <p><span className="text-slate-400">Model Status:</span> <span className="font-semibold">{String(systemStatus.status || 'unknown').toUpperCase()}</span></p>
                      <p><span className="text-slate-400">Detector Version:</span> v1.0</p>
                      <p><span className="text-slate-400">Analysis Engine:</span> Hybrid AI + Forensic</p>
                      <p><span className="text-slate-400">Model Loaded:</span> {systemStatus.model_loaded ? 'Yes' : 'No'}</p>
                      <p><span className="text-slate-400">Model Repo:</span> {systemStatus.model_repo || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-700/50 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2"><Clock3 className="w-4 h-4 text-neon-cyan" />Case History</h4>
                    <div className="max-h-44 overflow-auto">
                      {historyItems.length === 0 ? (
                        <p className="text-sm text-slate-400">No recent checks yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {historyItems.slice(0, 5).map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-dark-800/50 border border-dark-700/50">
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium truncate pr-2">{item.fileName}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClass(item.verdict)}`}>{item.verdict}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{toDateTime(item.timestamp)} • {item.probability}%</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleGeneratePdf} className="btn-outline flex items-center gap-2">
                    <FileDown className="w-4 h-4" />
                    Generate PDF Report
                  </button>
                  <button type="button" onClick={handleDownloadAnalysis} className="btn-primary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="glass-panel p-4 flex items-center gap-3">
          <ImageIcon className="w-5 h-5 text-neon-cyan" />
          <span>Image verification ready</span>
        </div>
        <div className="glass-panel p-4 flex items-center gap-3">
          <Video className="w-5 h-5 text-neon-cyan" />
          <span>Video workflow supported</span>
        </div>
        <div className="glass-panel p-4 flex items-center gap-3">
          <AudioLines className="w-5 h-5 text-neon-cyan" />
          <span>Audio intake enabled</span>
        </div>
      </div>
    </div>
  );
};

export default UploadSOP;
