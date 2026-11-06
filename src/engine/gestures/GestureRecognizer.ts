import { AdaptiveFilter } from './AdaptiveFilter';
import type {
  Gesture,
  GestureOutput,
  GestureSettings,
  Landmark,
  TrackedHand,
  TrackingFrame,
} from '../../types/tracking';
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function handFeatures(hand: TrackedHand) {
  const p = hand.landmarks;
  if (p.length !== 21 || p.some((v) => !Number.isFinite(v.x + v.y + v.z))) return null;
  const size = distance(p[0], p[9]);
  if (size < 0.025) return null;
  const fingers = [8, 12, 16, 20].map((tip) => {
    const a = p[tip - 3],
      b = p[tip - 2],
      c = p[tip];
    const ux = a.x - b.x,
      uy = a.y - b.y,
      uz = a.z - b.z;
    const vx = c.x - b.x,
      vy = c.y - b.y,
      vz = c.z - b.z;
    const cos =
      (ux * vx + uy * vy + uz * vz) / (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1);
    const reach = distance(p[tip], p[0]) / (distance(p[tip - 2], p[0]) || 1);
    return { extended: cos < -0.55 && reach > 1.15, relaxed: cos < -0.35 && reach > 1.08 };
  });
  const extended = fingers.map((finger) => finger.extended);
  return {
    openSustain: fingers.every((finger) => finger.relaxed),
    pinch: distance(p[4], p[8]) / size,
    open: extended.every(Boolean),
    point: extended[0] && extended.slice(1).every((v) => !v),
    center: {
      x: (p[0].x + p[5].x + p[9].x + p[17].x) / 4,
      y: (p[0].y + p[5].y + p[9].y + p[17].y) / 4,
    },
    pinchCenter: { x: (p[4].x + p[8].x) / 2, y: (p[4].y + p[8].y) / 2 },
  };
}
export const neutralOutput = (timestamp = 0): GestureOutput => ({
  gesture: 'neutral',
  pending: 'neutral',
  dx: 0,
  dy: 0,
  zoom: 0,
  pointer: null,
  timestamp,
});
/** Pure temporal recognizer. Mirrored, normalized coordinates enter; relative intent leaves. */
export class GestureRecognizer {
  private active: Gesture = 'neutral';
  private candidate: Gesture = 'neutral';
  private since = 0;
  private lastTimestamp = 0;
  private identity = '';
  private previous: { x: number; y: number; span: number } | null = null;
  private filters = {
    x: new AdaptiveFilter(),
    y: new AdaptiveFilter(),
    span: new AdaptiveFilter(),
    pointerX: new AdaptiveFilter(),
    pointerY: new AdaptiveFilter(),
  };
  private smoothed: { x: number; y: number; span: number } | null = null;
  private clearMotion() {
    this.previous = this.smoothed = null;
    Object.values(this.filters).forEach((filter) => filter.reset());
  }
  reset() {
    this.active = this.candidate = 'neutral';
    this.clearMotion();
    this.identity = '';
    this.lastTimestamp = 0;
  }
  update(frame: TrackingFrame, settings: GestureSettings): GestureOutput {
    const { hands, timestamp } = frame;
    const dt = timestamp - this.lastTimestamp;
    if (this.lastTimestamp && dt <= 0) {
      this.reset();
      return neutralOutput(timestamp);
    }
    if (dt > 180) this.reset();
    this.lastTimestamp = timestamp;
    const output = neutralOutput(timestamp);
    const features = hands.map(handFeatures);
    if (!hands.length || hands.length > 2 || features.some((f) => !f)) {
      this.reset();
      return output;
    }
    const identity = hands
      .map((h) => h.handedness)
      .sort()
      .join(':');
    if (identity !== this.identity) {
      this.active = this.candidate = 'neutral';
      this.clearMotion();
      this.identity = identity;
    }
    const a = features[0]!;
    const pinchThreshold = this.active === 'move' || this.active === 'zoom' ? 0.44 : 0.29;
    let desired: Gesture = 'neutral';
    let span = 0;
    if (hands.length === 2) {
      const b = features[1]!;
      span = Math.hypot(a.pinchCenter.x - b.pinchCenter.x, a.pinchCenter.y - b.pinchCenter.y);
      if (a.pinch < pinchThreshold && b.pinch < pinchThreshold && span > 0.12) desired = 'zoom';
    } else if (a.pinch < pinchThreshold) desired = 'move';
    else if (a.point) desired = 'inspect';
    else if (a.open || (this.active === 'rotate' && a.openSustain)) desired = 'rotate';
    if (desired !== this.active) {
      // Stop on the FIRST invalid frame. Re-entry always requires stable intent.
      this.active = 'neutral';
      this.clearMotion();
      if (desired !== this.candidate) {
        this.candidate = desired;
        this.since = timestamp;
      }
      const hold = desired === 'inspect' ? 280 : desired === 'zoom' ? 220 : 160;
      if (desired !== 'neutral' && timestamp - this.since >= hold) this.active = desired;
    } else {
      this.candidate = desired;
    }
    output.pending = desired;
    output.gesture = this.active;
    if (this.active === 'neutral') return output;
    const center =
      this.active === 'zoom'
        ? {
            x: (a.pinchCenter.x + features[1]!.pinchCenter.x) / 2,
            y: (a.pinchCenter.y + features[1]!.pinchCenter.y) / 2,
          }
        : this.active === 'move'
          ? a.pinchCenter
          : a.center;
    const next = { ...center, span };
    if (
      this.previous &&
      (Math.hypot(next.x - this.previous.x, next.y - this.previous.y) > 0.18 ||
        (this.active === 'zoom' && Math.abs(span - this.previous.span) > 0.2))
    ) {
      this.reset();
      return neutralOutput(timestamp);
    }
    const filtered = {
      x: this.filters.x.update(next.x, dt, settings.smoothing),
      y: this.filters.y.update(next.y, dt, settings.smoothing),
      span: this.filters.span.update(Math.log(Math.max(span, 0.001)), dt, settings.smoothing),
    };
    if (this.active === 'inspect')
      output.pointer = {
        x: clamp(
          this.filters.pointerX.update(hands[0].landmarks[8].x, dt, settings.smoothing),
          0,
          1,
        ),
        y: clamp(
          this.filters.pointerY.update(hands[0].landmarks[8].y, dt, settings.smoothing),
          0,
          1,
        ),
      };
    if (this.smoothed) {
      output.dx = (filtered.x - this.smoothed.x) * settings.sensitivity;
      output.dy = (filtered.y - this.smoothed.y) * settings.sensitivity;
      output.zoom =
        this.active === 'zoom'
          ? clamp((filtered.span - this.smoothed.span) * settings.sensitivity, -0.1, 0.1)
          : 0;
    }
    this.smoothed = filtered;
    this.previous = next;
    return output;
  }
}
