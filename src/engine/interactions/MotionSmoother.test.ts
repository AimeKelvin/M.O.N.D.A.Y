import { describe, expect, it } from 'vitest';
import { MotionSmoother } from './MotionSmoother';
import { neutralOutput } from '../gestures/GestureRecognizer';

const motion = (timestamp = 100) => ({
  ...neutralOutput(timestamp),
  gesture: 'rotate' as const,
  dx: 0.08,
  dy: -0.03,
});
describe('render-frame motion', () => {
  it('spreads one detection over several frames without repeating or overshooting it', () => {
    const smoother = new MotionSmoother();
    smoother.push(motion());
    let sum = 0;
    const first = smoother.step(1 / 60, 116, 0.4).dx;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.08);
    sum += first;
    for (let time = 132; time < 275; time += 16) sum += smoother.step(0.016, time, 0.4).dx;
    expect(sum).toBeGreaterThan(0.078);
    expect(sum).toBeLessThanOrEqual(0.08);
    expect(smoother.step(0.016, 300, 0.4).dx).toBe(0);
  });
  it('is independent of render refresh rate', () => {
    const run = (hz: number) => {
      const smoother = new MotionSmoother();
      smoother.push(motion());
      let sum = 0;
      for (let index = 0; index < hz / 10; index++)
        sum += smoother.step(1 / hz, 100 + (index * 1000) / hz, 0.6).dx;
      return sum;
    };
    expect(run(60)).toBeCloseTo(run(120), 8);
  });
  it('discards residual movement immediately on release, mode changes and suspended tabs', () => {
    const smoother = new MotionSmoother();
    smoother.push(motion());
    smoother.step(0.016, 116, 0.4);
    smoother.push(neutralOutput(125));
    expect(smoother.step(0.016, 130, 0.4).dx).toBe(0);
    smoother.push(motion(140));
    smoother.push({ ...neutralOutput(150), gesture: 'zoom', zoom: 0.04 });
    expect(smoother.step(0.016, 155, 0.4).dx).toBe(0);
    expect(smoother.step(0.5, 655, 0.4)).toMatchObject({ gesture: 'neutral', dx: 0, zoom: 0 });
  });
  it('honors reduced motion without losing or replaying intent', () => {
    const smoother = new MotionSmoother();
    smoother.push(motion());
    expect(smoother.step(0.016, 116, 0.4, true).dx).toBe(0.08);
    expect(smoother.step(0.016, 132, 0.4, true).dx).toBe(0);
  });
});
