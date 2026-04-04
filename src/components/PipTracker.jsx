import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

const MODEL_PATH = import.meta.env.BASE_URL + 'yolov5_custom/model.json';
const CONFIDENCE_THRESHOLD = 0.65;

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

// Singleton model loader
let modelPromise = null;
let loadedModel = null;

function getModel() {
  if (loadedModel) return Promise.resolve(loadedModel);
  if (!modelPromise) {
    modelPromise = (async () => {
      tf.enableProdMode();
      const model = await tf.loadGraphModel(MODEL_PATH);
      loadedModel = model;
      return model;
    })();
  }
  return modelPromise;
}

// Run YOLOv5 inference with TF.js NMS
async function detectDominoes(canvas) {
  const model = await getModel();
  const [modelWidth, modelHeight] = model.inputs[0].shape.slice(1, 3);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const r = tf.tidy(() => {
    const img = tf.browser.fromPixels(canvas);
    const resized = tf.image.resizeBilinear(img, [modelWidth, modelHeight]);
    const normalized = resized.div(255.0).expandDims(0);
    const output = model.execute(normalized);
    const squeezed = output.squeeze();

    // Extract boxes and scores
    const [x, y, w, h] = squeezed.slice([0, 0], [-1, 4]).split(4, -1);
    const score = squeezed.slice([0, 4], [-1, 1]).squeeze();
    const bbox = tf.concat([
      x.sub(w.div(2)), y.sub(h.div(2)),
      x.add(w.div(2)), y.add(h.div(2)),
    ], -1);

    // TF.js built-in NMS (same as pip-tracker: iou=0.5, score=0.7)
    const { selectedIndices, selectedScores } = tf.image.nonMaxSuppressionWithScore(
      bbox, score, 100, 0.5, 0.7
    );

    return [
      bbox.gather(selectedIndices),
      selectedScores,
      squeezed.slice([0, 5], [-1, -1]).argMax(-1).gather(selectedIndices),
    ];
  });

  const [boxes, scores, classes] = await Promise.all([
    r[0].array(), r[1].data(), r[2].data(),
  ]);

  const results = [];
  for (let i = 0; i < boxes.length; i++) {
    if (scores[i] < CONFIDENCE_THRESHOLD) continue;
    let [x1, y1, x2, y2] = boxes[i];
    x1 *= imgWidth;
    x2 *= imgWidth;
    y1 *= imgHeight;
    y2 *= imgHeight;

    const cls = classes[i];
    const label = LABEL_MAP[cls];
    if (!label) continue;

    results.push({
      id: i,
      pipValue: label.value,
      confidence: scores[i],
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      color: PIP_COLORS[label.value % PIP_COLORS.length],
    });
  }

  tf.dispose(r);
  return results;
}

export default function PipTracker({ gameData, onApplyScore }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedDims, setCapturedDims] = useState({ w: 0, h: 0 });
  const [detections, setDetections] = useState([]);
  const [detecting, setDetecting] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  // Load model on mount
  useEffect(() => {
    setStatus('Loading AI model...');
    getModel()
      .then(() => {
        setModelReady(true);
        setStatus('');
      })
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

  const startCamera = async () => {
    setError('');
    setCapturedImage(null);
    setDetections([]);
    setStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
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

  const stopCamera = useCallback(() => {
    setCameraOn(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const captureAndDetect = async () => {
    if (!videoRef.current || !modelReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setCapturedDims({ w: video.videoWidth, h: video.videoHeight });
    stopCamera();

    setDetecting(true);
    setStatus('Detecting dominoes...');
    setError('');

    try {
      const results = await detectDominoes(canvas);
      setDetections(results);
      setStatus(results.length > 0
        ? `Found ${results.length} domino${results.length !== 1 ? 'es' : ''}`
        : 'No dominoes detected'
      );
    } catch (err) {
      console.error('Detection error:', err);
      setError(`Detection failed: ${err?.message || String(err)}`);
      setStatus('');
    } finally {
      setDetecting(false);
    }
  };

  const updatePipValue = (id, newValue) => {
    setDetections((prev) =>
      prev.map((d) => (d.id === id ? { ...d, pipValue: newValue } : d))
    );
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
    if (!selectedPlayerId) {
      alert('Please select a player first.');
      return;
    }
    onApplyScore(selectedPlayerId, totalPips.toString());
    const playerName = gameData?.players?.find((p) => p.id === selectedPlayerId)?.name || 'player';
    alert(`Score of ${totalPips} applied to ${playerName}. Check the Score Tracker tab.`);
  };

  const retake = () => {
    setCapturedImage(null);
    setDetections([]);
    setStatus('');
    setError('');
    startCamera();
  };

  // --- Review screen ---
  if (capturedImage) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="relative">
            <img src={capturedImage} alt="Captured dominoes" className="w-full h-auto block" />
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${capturedDims.w} ${capturedDims.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
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
            {detecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm">Detecting dominoes...</p>
                </div>
              </div>
            )}
            {status && !detecting && (
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                {status}
              </div>
            )}
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
              {detecting ? 'Analyzing image...' : 'No dominoes detected. Add manually or retake.'}
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
              <button onClick={handleApply} disabled={detections.length === 0}
                className="bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-green-700 active:bg-green-800 transition shrink-0 disabled:opacity-50">
                Apply {totalPips}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Camera screen ---
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="relative bg-gray-900 aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {!cameraOn && (
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
          )}

          {cameraOn && (
            <div className="absolute bottom-4 inset-x-0 flex justify-center">
              <button onClick={captureAndDetect} disabled={detecting || !modelReady}
                className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-lg hover:border-indigo-400 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center">
                {detecting ? (
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600" />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {modelReady ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Model ready — offline
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading model...
              </span>
            )}
          </div>
          {!cameraOn ? (
            <button onClick={startCamera} disabled={!modelReady}
              className="bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50">
              Start Camera
            </button>
          ) : (
            <button onClick={stopCamera}
              className="bg-red-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition">
              Stop
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}
    </div>
  );
}
