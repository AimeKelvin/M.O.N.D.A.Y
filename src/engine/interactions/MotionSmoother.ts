import type { GestureOutput } from '../../types/tracking';
import { neutralOutput } from '../gestures/GestureRecognizer';

/** Distributes measured motion across render frames; never predicts or repeats a detection. */
export class MotionSmoother {
  private pending = { x: 0, y: 0, zoom: 0 };
  private intent = neutralOutput();

  reset() {
    this.pending = { x: 0, y: 0, zoom: 0 };
    this.intent = neutralOutput();
  }

  push(intent: GestureOutput) {
    if (intent.gesture !== this.intent.gesture || intent.gesture === 'neutral') this.reset();
    this.intent = intent;
    this.pending.x += intent.dx;
    this.pending.y += intent.dy;
    this.pending.zoom += intent.zoom;
  }

  step(seconds: number, now: number, smoothing: number, reducedMotion = false): GestureOutput {
    if (now - this.intent.timestamp >= 180 || seconds > 0.18) {
      this.reset();
      return neutralOutput(now);
    }
    const alpha = reducedMotion
      ? 1
      : 1 - Math.exp(-Math.max(0, seconds) / (0.025 + smoothing * 0.035));
    const output = {
      ...this.intent,
      dx: this.pending.x * alpha,
      dy: this.pending.y * alpha,
      zoom: this.pending.zoom * alpha,
    };
    this.pending.x -= output.dx;
    this.pending.y -= output.dy;
    this.pending.zoom -= output.zoom;
    return output;
  }
}
