export interface Landmark { x: number; y: number; z: number }
export interface TrackedHand {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right' | 'Unknown';
  /** Classification score for handedness, NOT landmark/tracking confidence. */
  handednessScore: number;
}
export interface TrackingFrame { hands: TrackedHand[]; timestamp: number; inferenceMs: number }
export type Gesture = 'neutral' | 'rotate' | 'move' | 'zoom' | 'inspect';
export interface GestureOutput {
  gesture: Gesture;
  pending: Gesture;
  dx: number;
  dy: number;
  zoom: number;
  pointer: { x: number; y: number } | null;
  timestamp: number;
}
export interface GestureSettings { sensitivity: number; smoothing: number }
export type CameraStatus = 'off' | 'requesting' | 'loading' | 'ready' | 'error';
export interface TrackingStatus {
  camera: CameraStatus;
  hands: number;
  gesture: Gesture;
  pending: Gesture;
  inferenceMs: number;
  fps: number;
  backend: 'worker' | 'main' | null;
  error: string | null;
}
