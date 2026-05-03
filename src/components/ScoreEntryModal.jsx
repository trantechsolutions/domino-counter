import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { getModel, isModelLoaded, detectDominoes, PIP_COLORS } from '../lib/pipDetect';

export default function ScoreEntryModal({ player, pendingWinner, onConfirm, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(false);

  const [mode, setMode] = useState('choose'); // 'choose' | 'camera' | 'review' | 'manual'
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

  // Draw live detection overlay on canvas
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
      ctx.font = 'bold 12px sans-serif';
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

  // ── Choose mode ──────────────────────────────────────────────────────────────
  const ChooseScreen = () => {
    const anotherPlayerIsWinner = pendingWinner && pendingWinner !== player.id;
    const thisPlayerIsWinner = pendingWinner === player.id;
    return (
      <div className="p-5 space-y-2.5">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">
          How would you like to enter <span className="font-bold text-slate-800 dark:text-slate-100">{player.name}'s</span> score?
        </p>
        <button onClick={() => !anotherPlayerIsWinner && confirm(0, true)}
          disabled={anotherPlayerIsWinner}
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left active:scale-[0.99] ${
            thisPlayerIsWinner
              ? 'border-amber-400 dark:border-amber-600/80 bg-amber-100 dark:bg-amber-950/40'
              : anotherPlayerIsWinner
              ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-40 cursor-not-allowed'
              : 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-600/80 hover:bg-amber-100 dark:hover:bg-amber-950/40'
          }`}>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 text-xl">🏆</div>
          <div>
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-400">Round Winner — 0 pts</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              {anotherPlayerIsWinner ? 'Another player already won this round' : `${player.name} went out first`}
            </p>
          </div>
        </button>
        <button onClick={startCamera} disabled={!modelReady}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-violet-200 dark:border-violet-900/50 hover:border-violet-400 dark:hover:border-violet-600/80 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition disabled:opacity-50 text-left active:scale-[0.99]">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 text-xl">📷</div>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Scan Dominoes</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{modelReady ? 'AI pip detection' : 'Loading model...'}</p>
          </div>
        </button>
        <button onClick={() => setMode('manual')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left active:scale-[0.99]">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xl">✏️</div>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Enter Manually</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Type the pip count</p>
          </div>
        </button>
      </div>
    );
  };

  // ── Camera mode (fullscreen) — always black, no dark: needed ─────────────────
  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 min-h-0">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-xl font-extrabold text-indigo-400">{livePips}</span>
            <span className="text-xs text-gray-300">pips — {player.name}</span>
            {fps > 0 && <span className="text-xs text-gray-500">{fps}fps</span>}
          </div>
          <button onClick={() => { stopCamera(); setMode('choose'); }}
            className="absolute top-3 right-3 bg-black/70 text-white text-sm font-semibold py-1.5 px-4 rounded-lg hover:bg-red-700 transition">
            Cancel
          </button>
          <div className="absolute bottom-6 inset-x-0 flex justify-center">
            <button onClick={capture}
              style={{ width: 72, height: 72 }}
              className="rounded-full bg-white/90 border-4 border-white shadow-2xl active:scale-90 transition-all flex items-center justify-center">
              <div className="rounded-full bg-indigo-600" style={{ width: 56, height: 56 }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review mode (fullscreen) — always black, no dark: needed ─────────────────
  const ReviewScreen = () => (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 min-h-0">
        <img src={capturedImage} alt="capture" className="w-full h-full object-contain" />
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${capturedDims.w} ${capturedDims.h}`} preserveAspectRatio="xMidYMid meet">
          {detections.filter(d => !d.manual).map(d => (
            <g key={d.id}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="none" stroke={d.color} strokeWidth={Math.max(3, capturedDims.w / 200)} />
              <rect x={d.x} y={d.y - Math.max(22, capturedDims.h / 28)} width={Math.max(60, capturedDims.w / 8)} height={Math.max(22, capturedDims.h / 28)} fill={d.color} />
              <text x={d.x + 4} y={d.y - 4} fill="white" fontSize={Math.max(14, capturedDims.h / 36)} fontFamily="sans-serif" fontWeight="bold">
                pip-{d.pipValue}
              </text>
            </g>
          ))}
        </svg>
        <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-xl font-extrabold text-indigo-400">{reviewPips}</span>
          <span className="text-xs text-gray-300">pips — {player.name}</span>
        </div>
        <button onClick={() => { setCapturedImage(null); setDetections([]); startCamera(); }}
          className="absolute top-3 right-3 bg-black/70 text-white text-sm font-semibold py-1.5 px-4 rounded-lg hover:bg-gray-700 transition">
          Retake
        </button>
      </div>

      <div className="bg-gray-950 text-white flex flex-col max-h-[45vh]">
        <div className="overflow-y-auto flex-1 divide-y divide-gray-800">
          {detections.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <select value={d.pipValue}
                onChange={e => setDetections(prev => prev.map(x => x.id === d.id ? { ...x, pipValue: +e.target.value } : x))}
                className="bg-gray-800 text-white p-1.5 border border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>pip-{i} ({i} pts)</option>)}
              </select>
              {!d.manual && <span className="text-xs text-gray-400">{(d.confidence * 100).toFixed(0)}%</span>}
              <button onClick={() => setDetections(prev => prev.filter(x => x.id !== d.id))} className="ml-auto text-gray-500 hover:text-red-400 p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button onClick={() => setDetections(prev => [...prev, { id: Date.now(), pipValue: 0, confidence: 1, x: 0, y: 0, w: 0, h: 0, color: PIP_COLORS[0], manual: true }])}
            className="w-full text-xs text-indigo-400 font-semibold py-2.5 hover:bg-gray-800 transition">
            + Add manually
          </button>
        </div>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => confirm(reviewPips)}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-green-500 active:bg-green-700 transition">
            Apply {reviewPips} pips → {player.name}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Manual entry ─────────────────────────────────────────────────────────────
  const ManualScreen = () => (
    <div className="p-5 space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
        Enter pip count for <span className="font-bold text-slate-800 dark:text-slate-100">{player.name}</span>
      </p>
      <input autoFocus type="number" min="0" value={manualValue}
        onChange={e => setManualValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && manualValue !== '') confirm(+manualValue); }}
        placeholder="0"
        className="w-full text-center text-5xl font-extrabold py-5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 tabular-nums transition" />
      <button onClick={() => confirm(+manualValue)} disabled={manualValue === ''}
        className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-500 active:bg-emerald-700 transition disabled:opacity-50 shadow-md shadow-emerald-500/20">
        Apply {manualValue || 0} to {player.name}
      </button>
      <button onClick={() => setMode('choose')} className="w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition py-1">
        ← Back
      </button>
    </div>
  );

  // ── Review short-circuit (fullscreen) ────────────────────────────────────────
  if (mode === 'review') return <ReviewScreen />;

  // ── Modal wrapper ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden slide-up sm:scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag pill (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{player.name}'s Score</h2>
          </div>
          <button onClick={onCancel} aria-label="Close"
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && (
          <div className="mx-4 mt-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-sm">
            {error}
          </div>
        )}
        {mode === 'choose' && <ChooseScreen />}
        {mode === 'manual' && <ManualScreen />}
      </div>
    </div>
  );
}
