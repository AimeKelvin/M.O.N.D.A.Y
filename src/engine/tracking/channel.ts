import type { GestureOutput, TrackingFrame } from '../../types/tracking';
import { neutralOutput } from '../gestures/GestureRecognizer';
/** High-frequency data lives outside React and is consumed once per inference. */
export const trackingChannel: { frame: TrackingFrame; intent: GestureOutput; sequence: number } = {
  frame: { hands: [], timestamp: 0, inferenceMs: 0 }, intent: neutralOutput(), sequence: 0,
};
export function clearTracking() {
  trackingChannel.frame = { hands: [], timestamp: performance.now(), inferenceMs: 0 };
  trackingChannel.intent = neutralOutput(performance.now());
  trackingChannel.sequence++;
}
