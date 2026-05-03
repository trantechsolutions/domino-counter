import * as tf from '@tensorflow/tfjs';

const MODEL_PATH = import.meta.env.BASE_URL + 'yolov5_custom/model.json';

// Combined score = objectness × class_confidence (standard YOLOv5 decode)
export const CONFIDENCE_THRESHOLD = 0.25;
const NMS_SCORE_THRESHOLD = 0.25;
const NMS_IOU_THRESHOLD = 0.45;
const TILE_OVERLAP = 0.25;

const LABEL_MAP = {
  0: { value: 1 }, 1: { value: 2 }, 2: { value: 3 }, 3: { value: 4 },
  4: { value: 5 }, 5: { value: 6 }, 6: { value: 7 }, 7: { value: 8 },
  8: { value: 9 }, 9: { value: 10 }, 10: { value: 11 }, 11: { value: 12 },
};

export const PIP_COLORS = [
  '#8b5cf6', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#16a34a',
  '#d946ef', '#7c3aed', '#06b6d4', '#ec4899', '#2563eb', '#dc2626',
];

let modelPromise = null;
let loadedModel = null;

export function getModel() {
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

export function isModelLoaded() {
  return !!loadedModel;
}

function runInferenceOnTile(tileTensor) {
  const model = loadedModel;
  const [modelWidth, modelHeight] = model.inputs[0].shape.slice(1, 3);
  return tf.tidy(() => {
    const resized = tf.image.resizeBilinear(tileTensor, [modelWidth, modelHeight]);
    const normalized = resized.div(255.0).expandDims(0);
    const squeezed = model.execute(normalized).squeeze(); // [N, 17]

    const [x, y, w, h] = squeezed.slice([0, 0], [-1, 4]).split(4, -1);
    const obj = squeezed.slice([0, 4], [-1, 1]);           // [N, 1] objectness
    const cls = squeezed.slice([0, 5], [-1, -1]);          // [N, 12] class scores

    // Combined score = objectness × class_score (standard YOLOv5 post-process)
    const combined = obj.mul(cls);                         // [N, 12]
    const classScores = combined.max(-1);                  // [N] best class score
    const classIds = combined.argMax(-1);                  // [N] best class index

    const bbox = tf.concat([
      x.sub(w.div(2)), y.sub(h.div(2)),
      x.add(w.div(2)), y.add(h.div(2)),
    ], -1);

    const { selectedIndices, selectedScores } = tf.image.nonMaxSuppressionWithScore(
      bbox, classScores, 300, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD
    );

    return [
      bbox.gather(selectedIndices),
      selectedScores,
      classIds.gather(selectedIndices),
    ];
  });
}

function getTileRegions(imgWidth, imgHeight) {
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
      tiles.push({ x: Math.max(0, x), y: Math.max(0, y), w: Math.min(tileSize, imgWidth - x), h: Math.min(tileSize, imgHeight - y) });
    }
  }
  tiles.push({ x: 0, y: 0, w: imgWidth, h: imgHeight });
  return tiles;
}

function mergeDetections(allResults, iouThreshold = 0.25) {
  const sorted = [...allResults].sort((a, b) => b.confidence - a.confidence);
  const keep = [];
  for (const box of sorted) {
    const dominated = keep.some((kept) => {
      const x1 = Math.max(box.x, kept.x), y1 = Math.max(box.y, kept.y);
      const x2 = Math.min(box.x + box.w, kept.x + kept.w), y2 = Math.min(box.y + box.h, kept.y + kept.h);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = box.w * box.h + kept.w * kept.h - inter;
      return union > 0 && inter / union > iouThreshold;
    });
    if (!dominated) keep.push(box);
  }
  return keep;
}

// Final confidence gate applied after cross-tile merge
const FINAL_CONFIDENCE_THRESHOLD = 0.4;

export async function detectDominoes(source, imgWidth, imgHeight) {
  if (!loadedModel) return [];
  const tiles = getTileRegions(imgWidth, imgHeight);
  const fullImg = tf.browser.fromPixels(source);
  const allResults = [];
  let idCounter = 0;
  for (const tile of tiles) {
    const tileTensor = tf.tidy(() => fullImg.slice([tile.y, tile.x, 0], [tile.h, tile.w, 3]));
    const r = runInferenceOnTile(tileTensor);
    const [boxes, scores, classes] = await Promise.all([r[0].array(), r[1].data(), r[2].data()]);
    tf.dispose(r);
    tileTensor.dispose();
    for (let i = 0; i < boxes.length; i++) {
      if (scores[i] < CONFIDENCE_THRESHOLD) continue;
      let [x1, y1, x2, y2] = boxes[i];
      x1 = x1 * tile.w + tile.x;
      x2 = x2 * tile.w + tile.x;
      y1 = y1 * tile.h + tile.y;
      y2 = y2 * tile.h + tile.y;
      const label = LABEL_MAP[classes[i]];
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
  const merged = mergeDetections(allResults);
  return merged.filter(d => d.confidence >= FINAL_CONFIDENCE_THRESHOLD);
}
