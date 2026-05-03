import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

const MODEL_PATH = import.meta.env.BASE_URL + 'yolov5_custom/model.json';
const CONFIDENCE_THRESHOLD = 0.8;
const NMS_SCORE_THRESHOLD = 0.8;
const NMS_IOU_THRESHOLD = 0.5;
const TILE_OVERLAP = 0.25; // 25% overlap between tiles

const LABEL_MAP = {
  0: { name: 'pip-1', value: 1 },
  1: { name: 'pip-2', value: 2 },
  2: { name: 'pip-3', value: 3 },
  3: { name: 'pip-4', value: 4 },
  4: { name: 'pip-5', value: 5 },
  5: { name: 'pip-6', value: 6 },
  6: { name: 'pip-7', value: 7 },
  7: { name: 'pip-8', value: 8 },
  8: { name: 'pip-9', value: 9 },
  9: { name: 'pip-10', value: 10 },
  10: { name: 'pip-11', value: 11 },
  11: { name: 'pip-12', value: 12 },
};

const PIP_COLORS = [
  '#8b5cf6', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#16a34a',
  '#d946ef', '#7c3aed', '#06b6d4', '#ec4899', '#2563eb', '#dc2626',
];

// Singleton model loader with warmup
let modelPromise = null;
let loadedModel = null;

function getModel() {
  if (loadedModel) return Promise.resolve(loadedModel);
  if (!modelPromise) {
    modelPromise = (async () => {
      tf.enableProdMode();
      const model = await tf.loadGraphModel(MODEL_PATH);
      // Warmup: run a dummy inference to compile WebGL shaders
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

// Run inference on a single tile, returning results in tile-local coords (0-1 normalized)
function runInferenceOnTile(tileTensor) {
  const model = loadedModel;
  const [modelWidth, modelHeight] = model.inputs[0].shape.slice(1, 3);

  return tf.tidy(() => {
    const resized = tf.image.resizeBilinear(tileTensor, [modelWidth, modelHeight]);
    const normalized = resized.div(255.0).expandDims(0);
    const output = model.execute(normalized);
    const squeezed = output.squeeze();

    const [x, y, w, h] = squeezed.slice([0, 0], [-1, 4]).split(4, -1);
    const score = squeezed.slice([0, 4], [-1, 1]).squeeze();
    const bbox = tf.concat([
      x.sub(w.div(2)), y.sub(h.div(2)),
      x.add(w.div(2)), y.add(h.div(2)),
    ], -1);

    const { selectedIndices, selectedScores } = tf.image.nonMaxSuppressionWithScore(
      bbox, score, 100, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD
    );

    return [
      bbox.gather(selectedIndices),
      selectedScores,
      squeezed.slice([0, 5], [-1, -1]).argMax(-1).gather(selectedIndices),
    ];
  });
}

// Generate tile regions with overlap
function getTileRegions(imgWidth, imgHeight) {
  // For small images or close-up shots, single tile is fine
  // Use 2x2 grid for wider shots to catch more dominoes
  const tileSize = Math.min(imgWidth, imgHeight);
  if (imgWidth <= tileSize * 1.2 && imgHeight <= tileSize * 1.2) {
    return [{ x: 0, y: 0, w: imgWidth, h: imgHeight }];
  }

  const tiles = [];
  const step = 1 - TILE_OVERLAP;
  const cols = Math.ceil((imgWidth / tileSize - TILE_OVERLAP) / step) || 1;
  const rows = Math.ceil((imgHeight / tileSize - TILE_OVERLAP) / step) || 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.min(Math.round(c * tileSize * step), imgWidth - tileSize);
      const y = Math.min(Math.round(r * tileSize * step), imgHeight - tileSize);
      const w = Math.min(tileSize, imgWidth - x);
      const h = Math.min(tileSize, imgHeight - y);
      tiles.push({ x: Math.max(0, x), y: Math.max(0, y), w, h });
    }
  }

  // Always include full image as a tile too (catches things at tile boundaries)
  tiles.push({ x: 0, y: 0, w: imgWidth, h: imgHeight });
  return tiles;
}

// Client-side NMS to merge results across tiles
function mergeDetections(allResults, iouThreshold = 0.4) {
  const sorted = [...allResults].sort((a, b) => b.confidence - a.confidence);
  const keep = [];
  for (const box of sorted) {
    const dominated = keep.some((kept) => {
      const x1 = Math.max(box.x, kept.x);
      const y1 = Math.max(box.y, kept.y);
      const x2 = Math.min(box.x + box.w, kept.x + kept.w);
      const y2 = Math.min(box.y + box.h, kept.y + kept.h);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = box.w * box.h + kept.w * kept.h - inter;
      return union > 0 && inter / union > iouThreshold;
    });
    if (!dominated) keep.push(box);
  }
  return keep;
}

// Run YOLOv5 inference with tiling for wider detection range
async function detectDominoes(source, imgWidth, imgHeight) {
  if (!loadedModel) return [];

  const tiles = getTileRegions(imgWidth, imgHeight);
  const fullImg = tf.browser.fromPixels(source);
  const allResults = [];
  let idCounter = 0;

  for (const tile of tiles) {
    const tileTensor = tf.tidy(() =>
      fullImg.slice([tile.y, tile.x, 0], [tile.h, tile.w, 3])
    );

    const r = runInferenceOnTile(tileTensor);
    const [boxes, scores, classes] = await Promise.all([
      r[0].array(), r[1].data(), r[2].data(),
    ]);
    tf.dispose(r);
    tileTensor.dispose();

    for (let i = 0; i < boxes.length; i++) {
      if (scores[i] < CONFIDENCE_THRESHOLD) continue;
      let [x1, y1, x2, y2] = boxes[i];
      // Scale from normalized (0-1) to tile coords, then offset to full image
      x1 = x1 * tile.w + tile.x;
      x2 = x2 * tile.w + tile.x;
      y1 = y1 * tile.h + tile.y;
      y2 = y2 * tile.h + tile.y;
      const cls = classes[i];
      const label = LABEL_MAP[cls];
      if (!label) continue;
      allResults.push({
        id: idCounter++,
        pipValue: label.value,
        confidence: scores[i],
        x: x1, y: y1,
        w: x2 - x1, h: y2 - y1,
        color: PIP_COLORS[label.value % PIP_COLORS.length],
      });
    }
  }

  fullImg.dispose();
  return mergeDetections(allResults);
}

export default function PipTracker({ gameData, onApplyScore }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Live detections (updated every frame while camera is on)
  const [liveDetections, setLiveDetections] = useState([]);
  const [fps, setFps] = useState(0);

  // Frozen capture state
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedDims, setCapturedDims] = useState({ w: 0, h: 0 });
  const [detections, setDetections] = useState([]);

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [appliedToast, setAppliedToast] = useState('');

  // Load model on mount
  useEffect(() => {
    setStatus('Loading AI model...');
    getModel()
      .then(() => { setModelReady(true); setStatus(''); })
      .catch((err) => {
        console.error('Model load error:', err);
        setError(`Failed to load AI model: ${err?.message || String(err)}`);
        setStatus('');
      });
  }, []);

  useEffect(() => {
    if (gameData?.players?.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(gameData.players[0].id);
    }
  }, [gameData?.players, selectedPlayerId]);

  const totalPips = detections.reduce((sum, d) => sum + d.pipValue, 0);
  const liveTotalPips = liveDetections.reduce((sum, d) => sum + d.pipValue, 0);

  // --- Live detection loop ---
  const runLiveLoop = useCallback(async () => {
    let lastFpsTime = performance.now();
    let frameCount = 0;

    while (loopRef.current) {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !loadedModel) {
        await tf.nextFrame();
        continue;
      }

      try {
        const results = await detectDominoes(video, video.videoWidth, video.videoHeight);
        if (!loopRef.current) break;
        setLiveDetections(results);

        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastFpsTime = now;
        }
      } catch (err) {
        console.error('Live detection error:', err);
      }

      await tf.nextFrame();
    }
  }, []);

  // Draw live bounding boxes on overlay canvas
  useEffect(() => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video || !cameraOn) return;

    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    liveDetections.forEach((d) => {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);

      const text = `pip-${d.pipValue} ${(d.confidence * 100).toFixed(0)}%`;
      ctx.fillStyle = d.color;
      const tw = ctx.measureText(text).width;
      ctx.fillRect(d.x, d.y - 18, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(text, d.x + 4, d.y - 4);
    });
  }, [liveDetections, cameraOn]);

  // --- Camera ---
  const startCamera = async () => {
    setError('');
    setCapturedImage(null);
    setDetections([]);
    setLiveDetections([]);
    setStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      // Set cameraOn first so the fullscreen video element renders,
      // then attach stream on next tick when videoRef points to new element
      setCameraOn(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : err?.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : `Camera error: ${err?.message || err?.name || 'Unknown error'}`
      );
    }
  };

  // Attach stream to video element once cameraOn renders the fullscreen view
  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().then(() => {
      loopRef.current = true;
      runLiveLoop();
    }).catch((err) => {
      console.error('Video play error:', err);
      setError(`Camera error: ${err?.message || 'Could not play video'}`);
      setCameraOn(false);
    });
  }, [cameraOn, runLiveLoop]);

  const stopCamera = useCallback(() => {
    loopRef.current = false;
    setCameraOn(false);
    setLiveDetections([]);
    setFps(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => {
    loopRef.current = false;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // --- Capture (freeze current frame + detections) ---
  const capture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
    setCapturedDims({ w: video.videoWidth, h: video.videoHeight });
    // Freeze current live detections as the editable list
    setDetections(liveDetections.map((d, i) => ({ ...d, id: i })));
    stopCamera();
  };

  // --- Edit detections ---
  const updatePipValue = (id, newValue) => {
    setDetections((prev) => prev.map((d) => (d.id === id ? { ...d, pipValue: newValue } : d)));
  };

  const removeDetection = (id) => {
    setDetections((prev) => prev.filter((d) => d.id !== id));
  };

  const addManualPip = () => {
    setDetections((prev) => [
      ...prev,
      { id: Date.now(), pipValue: 0, confidence: 1, x: 0, y: 0, w: 0, h: 0, color: PIP_COLORS[0], manual: true },
    ]);
  };

  const handleApply = () => {
    if (!selectedPlayerId) return;
    const playerName = gameData?.players?.find((p) => p.id === selectedPlayerId)?.name || 'player';
    onApplyScore(selectedPlayerId, totalPips.toString());
    setAppliedToast(`${totalPips} pips → ${playerName}`);
    setTimeout(() => setAppliedToast(''), 2000);
  };

  const retake = () => {
    setCapturedImage(null);
    setDetections([]);
    setStatus('');
    setError('');
    startCamera();
  };

  // --- Review screen (after capture) ---
  if (capturedImage) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="relative">
            <img src={capturedImage} alt="Captured dominoes" className="w-full h-auto block" />
            <svg className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${capturedDims.w} ${capturedDims.h}`} preserveAspectRatio="xMidYMid meet">
              {detections.filter((d) => !d.manual).map((d) => (
                <g key={d.id}>
                  <rect x={d.x} y={d.y} width={d.w} height={d.h}
                    fill="none" stroke={d.color} strokeWidth={Math.max(2, capturedDims.w / 300)} />
                  <rect x={d.x} y={d.y - Math.max(20, capturedDims.h / 30)}
                    width={Math.max(60, capturedDims.w / 8)} height={Math.max(20, capturedDims.h / 30)}
                    fill={d.color} />
                  <text x={d.x + 4} y={d.y - 4} fill="white"
                    fontSize={Math.max(14, capturedDims.h / 40)} fontFamily="sans-serif">
                    pip-{d.pipValue} ({(d.confidence * 100).toFixed(0)}%)
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="p-4 sm:p-5 flex items-center justify-between border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Pips</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-indigo-600 leading-none mt-1">{totalPips}</p>
            </div>
            <button onClick={retake}
              className="bg-gray-600 text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-gray-700 active:bg-gray-800 transition">
              Retake
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-700">Detected Dominoes</h3>
            <button onClick={addManualPip}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 transition">
              + Add manually
            </button>
          </div>
          {detections.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              No dominoes detected. Add manually or retake.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {detections.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <select value={d.pipValue}
                        onChange={(e) => updatePipValue(d.id, parseInt(e.target.value, 10))}
                        className="p-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                        {Array.from({ length: 13 }, (_, i) => (
                          <option key={i} value={i}>pip-{i} ({i} pts)</option>
                        ))}
                      </select>
                      {!d.manual && (
                        <span className="text-xs text-gray-400">{(d.confidence * 100).toFixed(0)}% conf</span>
                      )}
                      {d.manual && <span className="text-xs text-gray-400 italic">manual</span>}
                    </div>
                  </div>
                  <button onClick={() => removeDetection(d.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {gameData?.players?.length > 0 && (
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
            <label className="text-sm font-medium text-gray-600 block mb-2">Apply score to player</label>
            <div className="flex gap-2">
              <select value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="flex-1 min-w-0 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm">
                {gameData.players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button onClick={handleApply} disabled={!selectedPlayerId || detections.length === 0}
                className="bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-green-700 active:bg-green-800 transition shrink-0 disabled:opacity-50 relative overflow-hidden">
                {appliedToast ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Added!
                  </span>
                ) : (
                  `Apply ${totalPips}`
                )}
              </button>
            </div>
            {appliedToast && (
              <p className="text-green-600 text-xs font-medium mt-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                {appliedToast} — switching to Score Tracker
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Live camera screen (fullscreen on mobile when active) ---
  if (cameraOn) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 min-h-0">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Live pip count overlay */}
          <div className="absolute top-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-3 safe-area-top">
            <span className="text-2xl font-extrabold text-indigo-400">{liveTotalPips}</span>
            <span className="text-xs text-gray-300">pips</span>
            {fps > 0 && <span className="text-xs text-gray-500">{fps} fps</span>}
          </div>

          {/* Stop button */}
          <button onClick={stopCamera}
            className="absolute top-3 right-3 bg-black/70 text-white font-semibold py-1.5 px-4 rounded-lg hover:bg-red-600 active:bg-red-700 transition text-sm">
            Close
          </button>

          {/* Capture button */}
          <div className="absolute bottom-6 inset-x-0 flex justify-center">
            <button onClick={capture}
              className="w-18 h-18 rounded-full bg-white/90 border-4 border-white shadow-2xl hover:border-indigo-400 active:scale-90 transition-all flex items-center justify-center"
              style={{ width: 72, height: 72 }}>
              <div className="rounded-full bg-indigo-600" style={{ width: 56, height: 56 }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Idle camera screen ---
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="relative bg-gray-900 aspect-[3/4] sm:aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              {!modelReady ? (
                <>
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">{status || 'Loading AI model...'}</p>
                </>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">Tap Start Camera to begin</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {modelReady ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Model ready
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading model...
              </span>
            )}
          </div>
          <button onClick={startCamera} disabled={!modelReady}
            className="bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50">
            Start Camera
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}
    </div>
  );
}
