import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Hand,
  Maximize2,
  Move,
  Rotate3D,
  ScanLine,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { IconButton } from './IconButton';
const gestures = [
  {
    icon: Hand,
    title: 'Open palm · Rotate',
    description: 'Hold one open hand steady, then move it gently left, right, up, or down.',
  },
  {
    icon: Move,
    title: 'Pinch · Move',
    description:
      'Touch your thumb and index finger, hold briefly, and drag the model in the viewing plane.',
  },
  {
    icon: Maximize2,
    title: 'Two pinches · Zoom',
    description:
      'Pinch with both hands. Spread them apart to zoom in, or bring them together to zoom out.',
  },
  {
    icon: ScanLine,
    title: 'Point · Inspect',
    description:
      'Extend only your index finger. Aim the on-screen pointer at a part and hold to select.',
  },
];
function Calibration({ enable }: { enable: () => void }) {
  const tracking = useWorkspace((s) => s.tracking);
  const [step, setStep] = useState(0),
    [complete, setComplete] = useState(false);
  const matches =
    tracking.camera === 'ready' &&
    (step === 0
      ? tracking.hands === 1
      : step === 1
        ? tracking.gesture === 'rotate'
        : step === 2
          ? tracking.gesture === 'move'
          : tracking.hands === 0);
  useEffect(() => {
    if (!matches || complete) return;
    const timer = window.setTimeout(() => {
      if (step < 3) setStep((s) => s + 1);
      else setComplete(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [matches, step, complete]);
  return (
    <>
      <div className="calibration-progress">
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={step >= n ? 'done' : ''} />
        ))}
      </div>
      <div className="calibration-stage">
        {complete ? <Check size={38} /> : <Hand size={38} strokeWidth={1.3} />}
        <h3>
          {complete
            ? 'You’re ready to explore.'
            : ['Find your frame', 'Open your palm', 'Make a gentle pinch', 'Let go'][step]}
        </h3>
        <p>
          {complete
            ? 'Your gestures are connected. The model will respond after you close this guide.'
            : [
                'Sit about an arm’s length from your camera in even light. Show one whole hand and hold for a second.',
                'Spread four fingers and keep your hand open. Hold steady until the step advances.',
                'Bring your thumb and index fingertip together. Keep the other hand outside the frame.',
                'Lower your hand out of view. Releasing or losing tracking always stops the interaction.',
              ][step]}
        </p>
        {tracking.camera === 'ready' ? (
          <span className="tracking-chip">
            <span className="status-dot active" />
            {tracking.hands} hands · {tracking.gesture}
          </span>
        ) : (
          <button className="button primary" onClick={enable}>
            <Camera size={14} /> Enable camera
          </button>
        )}
      </div>
      <p className="dialog-note">
        Camera positioning check. No biometric profile is saved. Model movement is paused during
        setup.
      </p>
      <button
        className="button primary full-width"
        onClick={() => useWorkspace.getState().set({ dialog: null })}
      >
        {complete ? 'Enter workspace' : 'Finish setup later'}
      </button>
    </>
  );
}
export function Dialogs({ enable }: { enable: () => void }) {
  const dialog = useWorkspace((s) => s.dialog),
    settings = useWorkspace((s) => s.settings),
    landmarks = useWorkspace((s) => s.landmarks),
    grid = useWorkspace((s) => s.grid);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    else if (!dialog && element.open) element.close();
  }, [dialog]);
  const close = () => useWorkspace.getState().set({ dialog: null });
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MONDAY / WORKSPACE</span>
            <h2 id="dialog-title">
              {dialog === 'settings'
                ? 'Make it feel like you.'
                : dialog === 'calibrate'
                  ? 'A moment to get acquainted.'
                  : 'A little movement. A new perspective.'}
            </h2>
          </div>
          <IconButton label="Close dialog" onClick={close}>
            <X size={18} />
          </IconButton>
        </div>
        {dialog === 'settings' ? (
          <>
            <div className="setting-row">
              <label htmlFor="sensitivity">
                <Settings2 size={16} />
                <span>
                  Sensitivity<small>How far the model moves with your hand</small>
                </span>
                <b>{settings.sensitivity.toFixed(1)}×</b>
              </label>
              <input
                id="sensitivity"
                type="range"
                min="0.3"
                max="2.5"
                step="0.1"
                value={settings.sensitivity}
                onChange={(e) =>
                  useWorkspace
                    .getState()
                    .set({ settings: { ...settings, sensitivity: Number(e.target.value) } })
                }
              />
            </div>
            <div className="setting-row">
              <label htmlFor="smoothing">
                <Rotate3D size={16} />
                <span>
                  Motion smoothing<small>Higher values soften hand movement</small>
                </span>
                <b>{Math.round(settings.smoothing * 100)}%</b>
              </label>
              <input
                id="smoothing"
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={settings.smoothing}
                onChange={(e) =>
                  useWorkspace
                    .getState()
                    .set({ settings: { ...settings, smoothing: Number(e.target.value) } })
                }
              />
            </div>
            <label className="checkbox-row">
              <span>Show hand landmarks</span>
              <input
                type="checkbox"
                checked={landmarks}
                onChange={(e) => useWorkspace.getState().set({ landmarks: e.target.checked })}
              />
            </label>
            <label className="checkbox-row">
              <span>Show environment grid</span>
              <input
                type="checkbox"
                checked={grid}
                onChange={(e) => useWorkspace.getState().set({ grid: e.target.checked })}
              />
            </label>
            <button
              className="button full-width"
              onClick={() => useWorkspace.getState().set({ dialog: 'calibrate' })}
            >
              <Hand size={15} /> Camera positioning & gesture setup
            </button>
            <p className="dialog-note">
              <ShieldCheck size={13} /> Camera frames and models stay in your browser. No accounts,
              analytics, or remote processing.
            </p>
          </>
        ) : dialog === 'calibrate' ? (
          <Calibration enable={enable} />
        ) : (
          <>
            <p className="modal-intro">
              The future of 3D interaction is in your hands.
              <br />
              Enable your camera when you’re ready. A mouse works anytime.
            </p>
            <div className="gesture-reference">
              {gestures.map((g) => (
                <div key={g.title}>
                  <g.icon size={21} strokeWidth={1.4} />
                  <div>
                    <h3>{g.title}</h3>
                    <p>{g.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="neutral-hint">
              Rest your hand or lower it out of view to stop. Two hands only control zoom when both
              are pinching.
            </p>
            <div className="shortcut-grid">
              <span>
                Rotate <kbd>R</kbd>
              </span>
              <span>
                Move <kbd>M</kbd>
              </span>
              <span>
                Zoom <kbd>Z</kbd>
              </span>
              <span>
                Inspect <kbd>I</kbd>
              </span>
              <span>
                Reset <kbd>0</kbd>
              </span>
              <span>
                Focus mode <kbd>F</kbd>
              </span>
              <span>
                Camera off <kbd>Esc</kbd>
              </span>
            </div>
            <button
              className="button primary full-width"
              onClick={() => useWorkspace.getState().set({ dialog: 'calibrate' })}
            >
              Set up gesture controls
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
