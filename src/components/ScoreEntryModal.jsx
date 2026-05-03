import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

const MODEL_PATH = import.meta.env.BASE_URL + 'yolov5_custom/model.json';
const CONFIDENCE_THRESHOLD = 0.8;
const NMS_SCORE_THRESHOLD = 0.8;
const NMS_IOU_THRESHOLD = 0.3;
const TILE_OVERLAP = 0.25;

const LABEL_MAP = {
  0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6,
  6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12,
};

const PIP_COLORS = [
  '#8b5cf6', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#16a34a',
  '#d946ef', '#7c3aed', '#06b6d4', '#ec4899', '#2563eb', '#dc2626',
];

// Shared model singleton (same as PipTracker)
let modelPromise = null;
let loadedModel = null;

function getModel() {
  if (loadedModel) return Promise.resolve(loadedModel);
  if (!modelPromise) {
    modelPromise = (async () => {
      tf.enableProdMode();
      const model = await tf.loadGraphModel(MODEL_PATH);
      const [mw, mh] = model.inputs[0].shape.slice(1, 3);
      const dummy = tf.zeros([1, mw, mh, 3]);
      model.execute(dummy);
      dummy.dispose();
      await tf.nextFrame();
      loadedModel = model;
      return model;
    })();
  }
  return modelPromise;
}

function runTile(tileTensor) {
  const model = loadedModel;
  const [mw, mh] = model.inputs[0].shape.slice(1, 3);
  return tf.tidy(() => {
    const resized = tf.image.resizeBilinear(tileTensor, [mw, mh]);
    const norm = resized.div(255.0).expandDims(0);
    const out = model.execute(norm).squeeze();
    const [x, y, w, h] = out.slice([0, 0], [-1, 4]).split(4, -1);
    const score = out.slice([0, 4], [-1, 1]).squeeze();
    const bbox = tf.concat([x.sub(w.div(2)), y.sub(h.div(2)), x.add(w.div(2)), y.add(h.div(2))], -1);
    const { selectedIndices, selectedScores } = tf.image.nonMaxSuppressionWithScore(bbox, score, 100, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
    return [bbox.gather(selectedIndices), selectedScores, out.slice([0, 5], [-1, -1]).argMax(-1).gather(selectedIndices)];
  });
}

function getTiles(w, h) {
  const size = Math.min(w, h);
  if (w <= size * 1.2 && h <= size * 1.2) return [{ x: 0, y: 0, w, h }];
  const tiles = [];
  const step = 1 - TILE_OVERLAP;
  const cols = Math.ceil((w / size - TILE_OVERLAP) / step) || 1;
  const rows = Math.ceil((h / size - TILE_OVERLAP) / step) || 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = Math.max(0, Math.min(Math.round(c * size * step), w - size));
      const ty = Math.max(0, Math.min(Math.round(r * size * step), h - size));
      tiles.push({ x: tx, y: ty, w: Math.min(size, w - tx), h: Math.min(size, h - ty) });
    }
  }
  tiles.push({ x: 0, y: 0, w, h });
  return tiles;
}

function mergeBoxes(all, iou = 0.25) {
  const sorted = [...all].sort((a, b) => b.confidence - a.confidence);
  const keep = [];
  for (const box of sorted) {
    const dup = keep.some((k) => {
      const x1 = Math.max(box.x, k.x), y1 = Math.max(box.y, k.y);
      const x2 = Math.min(box.x + box.w, k.x + k.w), y2 = Math.min(box.y + box.h, k.y + k.h);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = box.w * box.h + k.w * k.h - inter;
      return union > 0 && inter / union > iou;
    });
    if (!dup) keep.push(box);
  }
  return keep;
}

async function detect(source, imgW, imgH) {
  if (!loadedModel) return [];
  const full = tf.browser.fromPixels(source);
  const all = [];
  let id = 0;
  for (const tile of getTiles(imgW, imgH)) {
    const t = tf.tidy(() => full.slice([tile.y, tile.x, 0], [tile.h, tile.w, 3]));
    const r = runTile(t);
    const [boxes, scores, classes] = await Promise.all([r[0].array(), r[1].data(), r[2].data()]);
    tf.dispose(r);
    t.dispose();
    for (let i = 0; i < boxes.length; i++) {
      if (scores[i] < CONFIDENCE_THRESHOLD) continue;
      let [x1, y1, x2, y2] = boxes[i];
      const pip = LABEL_MAP[classes[i]];
      if (!pip) continue;
      all.push({ id: id++, pipValue: pip, confidence: scores[i],
        x: x1 * tile.w + tile.x, y: y1 * tile.h + tile.y,
        w: (x2 - x1) * tile.w, h: (y2 - y1) * tile.h,
        color: PIP_COLORS[pip % PIP_COLORS.length] });
    }
  }
  full.dispose();
  return mergeBoxes(all);
}

// ── Modal component ──────────────────────────────────────────────────────────
export default function ScoreEntryModal({ player, onConfirm, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(false);

  const [mode, setMode] = useState('choose'); // 'choose' | 'camera' | 'review' | 'manual'
  const [modelReady, setModelReady] = useState(!!loadedModel);
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
    if (!loadedModel) {
      getModel().then(() => setModelReady(true)).catch(console.error);
    }
  }, []);

  // Draw overlay
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
      if (!v || v.readyState < 2 || !loadedModel) { await tf.nextFrame(); continue; }
      try {
        const r = await detect(v, v.videoWidth, v.videoHeight);
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

  // Attach stream once camera mode renders
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

  const confirm = (value) => { onConfirm(String(value)); };

  // ── Choose mode ────────────────────────────────────────────────────────────
  const ChooseScreen = () => (
    <div className="p-6 space-y-3">
      <p className="text-sm text-gray-500 text-center mb-4">How would you like to enter <span className="font-bold text-gray-800">{player.name}'s</span> score?</p>
      <button onClick={startCamera} disabled={!modelReady}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 transition disabled:opacity-50 text-left">
        <span className="text-2xl">📷</span>
        <div>
          <p className="font-semibold text-gray-800">Scan Dominoes</p>
          <p className="text-xs text-gray-400">{modelReady ? 'AI pip detection' : 'Loading model...'}</p>
        </div>
      </button>
      <button onClick={() => setMode('manual')}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition text-left">
        <span className="text-2xl">✏️</span>
        <div>
          <p className="font-semibold text-gray-800">Enter Manually</p>
          <p className="text-xs text-gray-400">Type the pip count</p>
        </div>
      </button>
    </div>
  );

  // ── Camera mode (fullscreen) ───────────────────────────────────────────────
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

  // ── Review mode ────────────────────────────────────────────────────────────
  const ReviewScreen = () => (
    <div className="flex flex-col max-h-[85vh]">
      <div className="relative overflow-hidden rounded-t-2xl">
        <img src={capturedImage} alt="capture" className="w-full h-auto block max-h-52 object-contain bg-gray-900" />
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${capturedDims.w} ${capturedDims.h}`} preserveAspectRatio="xMidYMid meet">
          {detections.filter(d => !d.manual).map(d => (
            <g key={d.id}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="none" stroke={d.color} strokeWidth={Math.max(2, capturedDims.w / 300)} />
              <rect x={d.x} y={d.y - Math.max(18, capturedDims.h / 35)} width={Math.max(50, capturedDims.w / 10)} height={Math.max(18, capturedDims.h / 35)} fill={d.color} />
              <text x={d.x + 3} y={d.y - 3} fill="white" fontSize={Math.max(12, capturedDims.h / 45)} fontFamily="sans-serif">
                pip-{d.pipValue}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Pips</p>
          <p className="text-4xl font-extrabold text-indigo-600">{reviewPips}</p>
        </div>
        <button onClick={() => { setCapturedImage(null); setDetections([]); startCamera(); }}
          className="text-sm text-gray-500 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition">
          Retake
        </button>
      </div>

      <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
        {detections.map(d => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <select value={d.pipValue} onChange={e => setDetections(prev => prev.map(x => x.id === d.id ? { ...x, pipValue: +e.target.value } : x))}
              className="p-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>pip-{i} ({i} pts)</option>)}
            </select>
            {!d.manual && <span className="text-xs text-gray-400">{(d.confidence * 100).toFixed(0)}%</span>}
            <button onClick={() => setDetections(prev => prev.filter(x => x.id !== d.id))} className="ml-auto text-gray-300 hover:text-red-500 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        <button onClick={() => setDetections(prev => [...prev, { id: Date.now(), pipValue: 0, confidence: 1, x: 0, y: 0, w: 0, h: 0, color: PIP_COLORS[0], manual: true }])}
          className="w-full text-xs text-indigo-600 font-semibold py-2.5 hover:bg-indigo-50 transition">
          + Add manually
        </button>
      </div>

      <div className="p-4 border-t border-gray-100">
        <button onClick={() => confirm(reviewPips)}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 active:bg-green-800 transition">
          Apply {reviewPips} to {player.name}
        </button>
      </div>
    </div>
  );

  // ── Manual entry ───────────────────────────────────────────────────────────
  const ManualScreen = () => (
    <div className="p-6 space-y-4">
      <p className="text-sm text-gray-500 text-center">Enter pip count for <span className="font-bold text-gray-800">{player.name}</span></p>
      <input autoFocus type="number" min="0" value={manualValue} onChange={e => setManualValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && manualValue !== '') confirm(+manualValue); }}
        placeholder="0"
        className="w-full text-center text-4xl font-bold p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
      <button onClick={() => confirm(+manualValue)} disabled={manualValue === ''}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 active:bg-green-800 transition disabled:opacity-50">
        Apply {manualValue || 0} to {player.name}
      </button>
      <button onClick={() => setMode('choose')} className="w-full text-sm text-gray-400 hover:text-gray-600 transition py-1">
        ← Back
      </button>
    </div>
  );

  // ── Modal wrapper ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{player.name}'s Score</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {error && <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
        {mode === 'choose' && <ChooseScreen />}
        {mode === 'review' && <ReviewScreen />}
        {mode === 'manual' && <ManualScreen />}
      </div>
    </div>
  );
}
