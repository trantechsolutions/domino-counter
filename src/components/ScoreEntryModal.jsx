import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { getModel, isModelLoaded, detectDominoes, PIP_COLORS } from '../lib/pipDetect';
import { CrownIcon } from './Icons';

export default function ScoreEntryModal({ player, pendingWinner, onConfirm, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(false);

  const [mode, setMode] = useState('choose');
  const [modelReady, setModelReady] = useState(isModelLoaded());
  const [liveDetections, setLiveDetections] = useState([]);
  const [fps, setFps] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedDims, setCapturedDims] = useState({ w: 0, h: 0 });
  const [detections, setDetections] = useState([]);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');

  const livePips = liveDetections.reduce((s, d) => s + d.pipValue, 0);
  const reviewPips = detections.reduce((s, d) => s + d.pipValue, 0);

  useEffect(() => {
    if (!isModelLoaded()) {
      getModel().then(() => setModelReady(true)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video || mode !== 'camera') return;
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    liveDetections.forEach((d) => {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      const text = `${d.pipValue} (${(d.confidence * 100).toFixed(0)}%)`;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y - 18, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, d.x + 4, d.y - 4);
    });
  }, [liveDetections, mode]);

  const runLoop = useCallback(async () => {
    let lastFps = performance.now(), frames = 0;
    while (loopRef.current) {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !isModelLoaded()) { await tf.nextFrame(); continue; }
      try {
        const r = await detectDominoes(v, v.videoWidth, v.videoHeight);
        if (!loopRef.current) break;
        setLiveDetections(r);
        frames++;
        const now = performance.now();
        if (now - lastFps >= 1000) { setFps(frames); frames = 0; lastFps = now; }
      } catch (e) { console.error(e); }
      await tf.nextFrame();
    }
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setMode('camera');
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Camera permission denied.' : `Camera error: ${err?.message}`);
    }
  };

  useEffect(() => {
    if (mode !== 'camera' || !streamRef.current || !videoRef.current) return;
    const v = videoRef.current;
    v.srcObject = streamRef.current;
    v.play().then(() => { loopRef.current = true; runLoop(); }).catch(console.error);
  }, [mode, runLoop]);

  const stopCamera = useCallback(() => {
    loopRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setCapturedImage(c.toDataURL('image/jpeg', 0.9));
    setCapturedDims({ w: v.videoWidth, h: v.videoHeight });
    setDetections(liveDetections.map((d, i) => ({ ...d, id: i })));
    stopCamera();
    setMode('review');
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const confirm = (value, isWinner = false) => { onConfirm(String(value), isWinner); };

  // ── Choose mode ──────────────────────────────────────────────
  const ChooseScreen = () => {
    const anotherPlayerIsWinner = pendingWinner && pendingWinner !== player.id;
    const thisPlayerIsWinner = pendingWinner === player.id;
    return (
      <div className="p-5 space-y-3">
        <p className="t-small text-[rgb(var(--ink-muted))] text-center mb-2">
          How would you like to enter <span className="font-bold text-[rgb(var(--ink))]">{player.name}'s</span> score?
        </p>

        {/* Round winner — branded as the celebratory option */}
        <button onClick={() => !anotherPlayerIsWinner && confirm(0, true)}
          disabled={anotherPlayerIsWinner}
          className={`tap w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left active:scale-[0.99] ${
            thisPlayerIsWinner
              ? 'border-brand bg-[rgb(var(--brand-soft))]'
              : anotherPlayerIsWinner
              ? 'border-[rgb(var(--rule-soft))] opacity-40 cursor-not-allowed'
              : 'border-[rgb(var(--rule))] hover:border-brand hover:bg-[rgb(var(--brand-soft))]'
          }`}>
          <div className="w-11 h-11 rounded-xl bg-[rgb(var(--brand-soft))] flex items-center justify-center shrink-0">
            <CrownIcon className="w-5 h-5 text-[rgb(var(--brand))]" />
          </div>
          <div>
            <p className="t-body font-bold text-[rgb(var(--brand))]">Round winner — 0 pts</p>
            <p className="t-small text-[rgb(var(--ink-muted))] mt-0.5">
              {anotherPlayerIsWinner ? 'Another player already won this round' : `${player.name} went out first`}
            </p>
          </div>
        </button>

        {/* Scan — uses pip-grid as the icon */}
        <button onClick={startCamera} disabled={!modelReady}
          className="tap w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-[rgb(var(--rule))] hover:border-[rgb(var(--ink))] hover:bg-[rgb(var(--rule-soft))] transition disabled:opacity-50 text-left active:scale-[0.99]">
          <div className="w-11 h-11 rounded-xl surface-paper border border-[rgb(var(--rule))] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[rgb(var(--ink-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="t-body font-bold text-[rgb(var(--ink))]">Scan dominoes</p>
            <p className="t-small text-[rgb(var(--ink-muted))] mt-0.5">{modelReady ? 'AI pip detection' : 'Loading model…'}</p>
          </div>
        </button>

        {/* Manual */}
        <button onClick={() => setMode('manual')}
          className="tap w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-[rgb(var(--rule))] hover:border-[rgb(var(--ink))] hover:bg-[rgb(var(--rule-soft))] transition text-left active:scale-[0.99]">
          <div className="w-11 h-11 rounded-xl surface-paper border border-[rgb(var(--rule))] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[rgb(var(--ink-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <p className="t-body font-bold text-[rgb(var(--ink))]">Enter manually</p>
            <p className="t-small text-[rgb(var(--ink-muted))] mt-0.5">Type the pip count</p>
          </div>
        </button>
      </div>
    );
  };

  // ── Camera (intentionally dark, for ML overlay contrast) ─────
  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 min-h-0">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="font-num text-xl font-bold text-[rgb(var(--brand))]">{livePips}</span>
            <span className="t-small text-white/80">pips — {player.name}</span>
            {fps > 0 && <span className="font-num text-xs text-white/40">{fps}fps</span>}
          </div>
          <button onClick={() => { stopCamera(); setMode('choose'); }}
            className="tap absolute top-3 right-3 bg-black/70 text-white t-small font-semibold px-4 rounded-lg hover:bg-[rgb(var(--brand))] transition">
            Cancel
          </button>
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <button onClick={capture}
              aria-label="Capture"
              style={{ width: 76, height: 76 }}
              className="rounded-full bg-white/95 border-4 border-white shadow-2xl active:scale-90 transition-all flex items-center justify-center">
              <div className="rounded-full bg-[rgb(var(--brand))]" style={{ width: 58, height: 58 }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review (dark for ML overlay) ─────────────────────────────
  const ReviewScreen = () => (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 min-h-0">
        <img src={capturedImage} alt="Captured dominoes" className="w-full h-full object-contain" />
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${capturedDims.w} ${capturedDims.h}`} preserveAspectRatio="xMidYMid meet">
          {detections.filter(d => !d.manual).map(d => (
            <g key={d.id}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="none" stroke={d.color} strokeWidth={Math.max(3, capturedDims.w / 200)} />
              <rect x={d.x} y={d.y - Math.max(22, capturedDims.h / 28)} width={Math.max(60, capturedDims.w / 8)} height={Math.max(22, capturedDims.h / 28)} fill={d.color} />
              <text x={d.x + 4} y={d.y - 4} fill="white" fontSize={Math.max(14, capturedDims.h / 36)} fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                pip-{d.pipValue}
              </text>
            </g>
          ))}
        </svg>
        <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="font-num text-xl font-bold text-[rgb(var(--brand))]">{reviewPips}</span>
          <span className="t-small text-white/80">pips — {player.name}</span>
        </div>
        <button onClick={() => { setCapturedImage(null); setDetections([]); startCamera(); }}
          className="tap absolute top-3 right-3 bg-black/70 text-white t-small font-semibold px-4 rounded-lg hover:bg-white/20 transition">
          Retake
        </button>
      </div>

      <div className="bg-[#0f0d0b] text-white flex flex-col max-h-[45vh]">
        <div className="overflow-y-auto flex-1">
          {detections.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <select value={d.pipValue}
                onChange={e => setDetections(prev => prev.map(x => x.id === d.id ? { ...x, pipValue: +e.target.value } : x))}
                className="tap bg-white/10 text-white px-2 border border-white/20 rounded-lg t-small focus:border-[rgb(var(--brand))] outline-none font-num">
                {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>pip-{i} ({i} pts)</option>)}
              </select>
              {!d.manual && <span className="font-num t-small text-white/50">{(d.confidence * 100).toFixed(0)}%</span>}
              <button onClick={() => setDetections(prev => prev.filter(x => x.id !== d.id))}
                className="tap ml-auto text-white/50 hover:text-[rgb(var(--brand))] p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button onClick={() => setDetections(prev => [...prev, { id: Date.now(), pipValue: 0, confidence: 1, x: 0, y: 0, w: 0, h: 0, color: PIP_COLORS[0], manual: true }])}
            className="tap w-full t-small text-[rgb(var(--brand))] font-semibold py-3 hover:bg-white/5 transition">
            + Add manually
          </button>
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => confirm(reviewPips)}
            className="tap w-full fill-brand t-body font-bold py-4 rounded-2xl shadow-pip-brand transition">
            Apply {reviewPips} pips → {player.name}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Manual ────────────────────────────────────────────────────
  const ManualScreen = () => (
    <div className="p-5 space-y-4">
      <p className="t-small text-[rgb(var(--ink-muted))] text-center">
        Enter pip count for <span className="font-bold text-[rgb(var(--ink))]">{player.name}</span>
      </p>
      <input autoFocus type="number" min="0" value={manualValue}
        onChange={e => setManualValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && manualValue !== '') confirm(+manualValue); }}
        placeholder="0"
        className="w-full text-center font-num n-mega py-5 border-2 border-[rgb(var(--rule))] rounded-2xl focus:border-brand outline-none surface-paper text-[rgb(var(--ink))] transition" />
      <button onClick={() => confirm(+manualValue)} disabled={manualValue === ''}
        className="tap w-full fill-brand t-body font-bold py-3.5 rounded-2xl hover:opacity-95 transition disabled:opacity-50 shadow-pip-brand">
        Apply {manualValue || 0} to {player.name}
      </button>
      <button onClick={() => setMode('choose')}
        className="tap w-full t-small text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink))] transition py-2">
        ← Back
      </button>
    </div>
  );

  if (mode === 'review') return <ReviewScreen />;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-[rgba(20,17,15,0.55)]" />
      <div
        className="relative w-full sm:max-w-md surface-bone rounded-t-3xl sm:rounded-3xl shadow-pip-lg overflow-hidden slide-up sm:scale-in border-t border-[rgb(var(--rule))] sm:border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[rgb(var(--rule))]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgb(var(--rule-soft))]">
          <h2 className="t-body font-bold text-[rgb(var(--ink))]">{player.name}'s score</h2>
          <button onClick={onCancel} aria-label="Close"
            className="tap text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink))] transition p-2 rounded-xl hover:bg-[rgb(var(--rule-soft))]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && (
          <div className="mx-4 mt-3 bg-[rgb(var(--brand-soft))] border border-[rgb(var(--brand))] text-[rgb(var(--brand))] px-3 py-2 rounded-xl t-small">
            {error}
          </div>
        )}
        {mode === 'choose' && <ChooseScreen />}
        {mode === 'manual' && <ManualScreen />}
      </div>
    </div>
  );
}
