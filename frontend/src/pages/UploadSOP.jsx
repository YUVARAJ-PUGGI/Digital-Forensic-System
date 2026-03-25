import { useState } from 'react';
import { UploadCloud, CheckCircle, ShieldAlert, FileText, ArrowRight } from 'lucide-react';

const UploadSOP = () => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiDetection, setAiDetection] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [checklist, setChecklist] = useState({
    deviceSeized: false,
    witnessPresent: false,
    photographedInSitu: false,
    tamperEvidentBag: false,
  });
  const [notes, setNotes] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 3));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

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
      setSubmitError(err.message || 'Unable to analyze file');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Evidence Ingestion & SOP Protocol</h2>
        <p className="text-slate-400">Secure upload with automated cryptographic hashing</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative z-0">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-dark-700 -z-10 rounded-full">
          <div className="h-full bg-neon-blue rounded-full transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            step >= i ? 'bg-neon-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-dark-800 text-slate-500 border border-dark-600'
          }`}>
            {i}
          </div>
        ))}
      </div>

      <div className="glass-panel p-8 relative overflow-hidden">
        
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <UploadCloud className="text-neon-cyan" />
              <span>Step 1: Digital Evidence Upload</span>
            </h3>
            
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-dark-600 hover:border-neon-blue bg-dark-900/50 rounded-2xl p-12 text-center cursor-pointer transition-all group"
            >
              <UploadCloud className="w-16 h-16 mx-auto text-slate-500 group-hover:text-neon-blue transition-colors mb-4" />
              {file ? (
                <div>
                  <p className="text-lg font-medium text-neon-blue">{file.name}</p>
                  <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium text-slate-300">Drag & drop evidence file here</p>
                  <p className="text-sm text-slate-500 mt-2">Supports MP4, AVI, JPEG, PNG, WAV (Max 500MB)</p>
                </div>
              )}
              <input type="file" className="hidden" id="file-upload" onChange={e => setFile(e.target.files[0])} />
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => { if(file) handleNext(); }} disabled={!file} className={`btn-primary flex items-center space-x-2 ${!file && 'opacity-50 cursor-not-allowed'}`}>
                <span>Proceed to SOP</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <ShieldAlert className="text-rose-500" />
              <span>Step 2: Chain of Custody SOP</span>
            </h3>
            
            <div className="space-y-4">
              {Object.entries(checklist).map(([key, val]) => (
                <label key={key} className="flex items-center space-x-4 p-4 bg-dark-900/40 rounded-xl border border-dark-700/50 hover:border-dark-600 cursor-pointer transition-all">
                  <input type="checkbox" checked={val} onChange={() => setChecklist({...checklist, [key]: !val})} className="w-5 h-5 rounded border-dark-500 text-neon-blue focus:ring-neon-blue bg-dark-800" />
                  <span className="font-medium text-slate-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Additional Field Notes (Required for Exceptions)</label>
                <textarea 
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="glass-input min-h-[100px] resize-none"
                  placeholder="E.g., Device screen was cracked prior to seizure..."
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-outline">Back</button>
              <button onClick={handleNext} className="btn-primary flex items-center space-x-2">
                <span>Final Review</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <FileText className="text-emerald-500" />
              <span>Step 3: Verification & Sign-off</span>
            </h3>

            <div className="bg-dark-900/60 p-6 rounded-xl border border-dark-700/50 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">File Name</p>
                  <p className="font-medium">{file?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">File Size</p>
                  <p className="font-medium">{(file?.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">Pending SHA-256 Hash</p>
                  <p className="font-mono text-neon-blue bg-dark-800 p-2 rounded mt-1 overflow-x-auto text-xs">
                    (Will be cryptographically generated by backend upon submission)
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start space-x-3">
              <CheckCircle className="text-rose-500 w-6 h-6 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-300">
                By submitting this form, I, <span className="text-white font-bold">Offc. John Doe (A-1102)</span>, swear under penalty of perjury that this digital evidence was collected in accordance with department standard operating procedures and the details provided are true and accurate to the best of my knowledge.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={handleBack} className="btn-outline">Back</button>
              <button onClick={handleSubmitForDetection} disabled={isSubmitting || !file} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>{isSubmitting ? 'Analyzing...' : 'Sign & Submit Evidence'}</span>
              </button>
            </div>

            {submitError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-sm text-rose-200">
                {submitError}
              </div>
            )}

            {aiDetection && (
              <div className="bg-dark-900/60 p-6 rounded-xl border border-dark-700/50 space-y-3">
                <p className="text-slate-400 text-sm">AI Generation Assessment</p>
                <p className="text-lg font-semibold text-white">
                  Verdict: <span className="text-neon-blue">{aiDetection.verdict.replaceAll('_', ' ')}</span>
                </p>
                <p className="text-sm text-slate-300">Confidence: {aiDetection.confidence}%</p>
                <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
                  {aiDetection.reasons?.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">{aiDetection.disclaimer}</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default UploadSOP;
