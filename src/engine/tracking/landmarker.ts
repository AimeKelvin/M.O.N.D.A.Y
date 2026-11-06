import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { TrackedHand } from '../../types/tracking';
export async function createLandmarker(base: string) {
  const files = await FilesetResolver.forVisionTasks(base, typeof document === 'undefined');
  return HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${base}/hand_landmarker.task`, delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
  });
}
export function normalizeResult(result: HandLandmarkerResult): TrackedHand[] {
  const hands: TrackedHand[] = result.landmarks.map((landmarks, i) => ({
    landmarks: landmarks.map(p => ({ x: 1 - p.x, y: p.y, z: p.z })),
    handedness: result.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : result.handedness[i]?.[0]?.categoryName === 'Right' ? 'Right' : 'Unknown',
    handednessScore: result.handedness[i]?.[0]?.score ?? 0,
  }));
  return hands.sort((a,b) => a.handedness.localeCompare(b.handedness));
}
