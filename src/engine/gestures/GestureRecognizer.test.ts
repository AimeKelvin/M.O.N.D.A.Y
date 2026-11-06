import { describe, expect, it } from 'vitest';
import { GestureRecognizer, handFeatures } from './GestureRecognizer';
import { frame, hand } from '../../tests/hands';
const settings = { sensitivity: 1, smoothing: 0.2 };
const activate = (engine: GestureRecognizer, hands = [hand()], start = 100) => {
  for (let t = start; t <= start + 300; t += 50) engine.update(frame(t, ...hands), settings);
  return start + 300;
};
describe('anatomical gesture features', () => {
  it('detects an open palm, a stable point, and a disengaged fist', () => {
    expect(handFeatures(hand())?.open).toBe(true);
    expect(handFeatures(hand('point'))?.point).toBe(true);
    expect(handFeatures(hand('neutral'))?.open).toBe(false);
  });
  it('normalizes pinch by hand size', () => {
    const small = hand('pinch');
    small.landmarks = small.landmarks.map((p) => ({ x: p.x * 0.5, y: p.y * 0.5, z: p.z }));
    expect(handFeatures(small)?.pinch).toBeCloseTo(handFeatures(hand('pinch'))!.pinch);
  });
  it('rejects incomplete and non-finite landmarks', () => {
    const h = hand();
    h.landmarks.pop();
    expect(handFeatures(h)).toBeNull();
    const b = hand();
    b.landmarks[2].x = NaN;
    expect(handFeatures(b)).toBeNull();
  });
});
describe('temporal state machine', () => {
  it('requires a stable entry and begins without a jump', () => {
    const e = new GestureRecognizer();
    expect(e.update(frame(100, hand()), settings).gesture).toBe('neutral');
    expect(e.update(frame(200, hand('open', 0.05)), settings).gesture).toBe('neutral');
    const out = e.update(frame(270, hand('open', 0.1)), settings);
    expect(out.gesture).toBe('rotate');
    expect(out.dx).toBe(0);
    expect(e.update(frame(320, hand('open', 0.12)), settings).dx).toBeGreaterThan(0);
  });
  it('immediately stops on release and requires reacquisition', () => {
    const e = new GestureRecognizer();
    activate(e);
    expect(e.update(frame(450, hand('neutral')), settings).gesture).toBe('neutral');
    expect(e.update(frame(500, hand()), settings).gesture).toBe('neutral');
  });
  it('detects pinch motion and gives it priority over open fingers', () => {
    const e = new GestureRecognizer();
    activate(e, [hand('pinch')]);
    const out = e.update(frame(450, hand('pinch', 0.03)), settings);
    expect(out.gesture).toBe('move');
    expect(out.dx).toBeGreaterThan(0);
  });
  it('has distinct pinch entry and release thresholds', () => {
    const e = new GestureRecognizer();
    activate(e, [hand('pinch', 0, 'Right', 0.35)]);
    expect(e.update(frame(450, hand('pinch', 0, 'Right', 0.35)), settings).gesture).not.toBe(
      'move',
    );
    e.reset();
    activate(e, [hand('pinch')]);
    expect(e.update(frame(450, hand('pinch', 0, 'Right', 0.37)), settings).gesture).toBe('move');
    expect(e.update(frame(500, hand('pinch', 0, 'Right', 0.5)), settings).gesture).toBe('neutral');
  });
  it('only enables two-hand zoom with two deliberate pinches', () => {
    const e = new GestureRecognizer();
    activate(e, [hand('pinch', -0.2, 'Left'), hand('open', 0.2)]);
    expect(
      e.update(frame(450, hand('pinch', -0.2, 'Left'), hand('open', 0.2)), settings).gesture,
    ).toBe('neutral');
    e.reset();
    activate(e, [hand('pinch', -0.2, 'Left'), hand('pinch', 0.2)]);
    const out = e.update(frame(450, hand('pinch', -0.23, 'Left'), hand('pinch', 0.23)), settings);
    expect(out.gesture).toBe('zoom');
    expect(out.zoom).toBeGreaterThan(0);
  });
  it('prevents one/two-hand conflicts and stops after a hand exits', () => {
    const e = new GestureRecognizer();
    activate(e, [hand('pinch', -0.2, 'Left'), hand('pinch', 0.2)]);
    expect(e.update(frame(450, hand('pinch', -0.2, 'Left')), settings).gesture).toBe('neutral');
  });
  it('cancels on lost tracking and ignores reacquired absolute position', () => {
    const e = new GestureRecognizer();
    activate(e);
    expect(e.update(frame(450), settings).dx).toBe(0);
    expect(e.update(frame(500, hand('open', 0.3)), settings).gesture).toBe('neutral');
    activate(e, [hand('open', 0.3)], 550);
    expect(e.update(frame(900, hand('open', 0.3)), settings).dx).toBe(0);
  });
  it('suspends on stale timestamps and sudden position discontinuities', () => {
    const e = new GestureRecognizer();
    activate(e);
    expect(e.update(frame(900, hand()), settings).gesture).toBe('neutral');
    activate(e, [hand()], 1000);
    expect(e.update(frame(1350, hand('open', 0.4)), settings).gesture).toBe('neutral');
  });
  it('requires a longer pointing dwell and emits a normalized pointer', () => {
    const e = new GestureRecognizer();
    activate(e, [hand('point')]);
    const out = e.update(frame(450, hand('point')), settings);
    expect(out.gesture).toBe('inspect');
    expect(out.pointer).toEqual({ x: 0.39, y: 0.28 });
  });
  it('does not accumulate momentum after release', () => {
    const e = new GestureRecognizer();
    activate(e);
    expect(e.update(frame(450, hand('open', 0.04)), settings).dx).toBeGreaterThan(0);
    const released = e.update(frame(500, hand('neutral')), settings);
    expect(released).toMatchObject({ gesture: 'neutral', dx: 0, dy: 0, zoom: 0 });
    expect(e.update(frame(550), settings).dx).toBe(0);
  });
});

it('attenuates stationary jitter without accumulating drift', () => {
  const engine = new GestureRecognizer();
  activate(engine);
  let total = 0,
    peak = 0;
  for (let index = 0; index < 100; index++) {
    const output = engine.update(
      frame(450 + index * 33, hand('open', index % 2 ? -0.003 : 0.003)),
      { sensitivity: 1, smoothing: 0.8 },
    );
    total += output.dx;
    peak = Math.max(peak, Math.abs(output.dx));
  }
  expect(peak).toBeLessThan(0.003);
  expect(Math.abs(total)).toBeLessThan(0.002);
});
it('preserves deliberate travel at different detection rates', () => {
  const travel = (interval: number) => {
    const engine = new GestureRecognizer();
    activate(engine);
    let total = 0;
    for (let time = interval; time <= 1000; time += interval) {
      const offset = Math.min(time / 500, 1) * 0.12;
      total += engine.update(frame(400 + time, hand('open', offset)), settings).dx;
    }
    return total;
  };
  expect(travel(25)).toBeCloseTo(0.12, 3);
  expect(travel(50)).toBeCloseTo(travel(25), 3);
});
it('does not cancel zoom when the detector swaps the order of two hands', () => {
  const engine = new GestureRecognizer();
  activate(engine, [hand('pinch', -0.25, 'Left'), hand('pinch', 0.25)]);
  const out = engine.update(
    frame(450, hand('pinch', 0.27), hand('pinch', -0.27, 'Left')),
    settings,
  );
  expect(out.gesture).toBe('zoom');
  expect(out.zoom).toBeGreaterThan(0);
  expect(out.dx).toBeCloseTo(0);
});
it('filters an inspection pointer and rejects duplicate timestamps', () => {
  const engine = new GestureRecognizer();
  activate(engine, [hand('point')]);
  const output = engine.update(frame(450, hand('point', 0.015)), {
    sensitivity: 1,
    smoothing: 0.8,
  });
  expect(output.pointer!.x).toBeGreaterThan(0.39);
  expect(output.pointer!.x).toBeLessThan(0.405);
  expect(engine.update(frame(450, hand('point')), settings).gesture).toBe('neutral');
});
