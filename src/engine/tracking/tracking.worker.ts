/// <reference lib="webworker" />
import { createLandmarker, normalizeResult } from './landmarker';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
let detector: HandLandmarker | null = null;
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<{type: 'init'; base: string} | {type: 'frame'; bitmap: ImageBitmap; timestamp: number} | {type: 'close'}>) => {
  const message = event.data;
  try {
    if (message.type === 'init') { detector = await createLandmarker(message.base); scope.postMessage({ type: 'ready' }); }
    if (message.type === 'frame') {
      const start = performance.now();
      try { if (!detector) throw new Error('Detector not initialized'); const result = detector.detectForVideo(message.bitmap, message.timestamp); scope.postMessage({ type: 'result', frame: { hands: normalizeResult(result), timestamp: message.timestamp, inferenceMs: performance.now() - start } }); }
      finally { message.bitmap.close(); }
    }
    if (message.type === 'close') { detector?.close(); detector = null; scope.close(); }
  } catch { scope.postMessage({ type: 'error' }); }
};
