import type { Landmark } from '../types/tracking';
import { useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Hand,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import type { TrackingService } from '../engine/tracking/TrackingService';
import { trackingChannel } from '../engine/tracking/channel';
import { IconButton } from './IconButton';
const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export const gestureNames = {
  neutral: 'Ready when you are',
  rotate: 'Rotating',
  move: 'Moving',
  zoom: 'Zooming',
  inspect: 'Inspecting',
};
export function CameraPanel({
  service,
  enable,
}: {
  service: TrackingService | null;
  enable: () => void;
}) {
  const tracking = useWorkspace((s) => s.tracking),
    preview = useWorkspace((s) => s.preview),
    landmarks = useWorkspace((s) => s.landmarks);
  const holder = useRef<HTMLDivElement>(null),
    overlay = useRef<HTMLCanvasElement>(null);
  const on = ['ready', 'loading', 'requesting'].includes(tracking.camera);
  useEffect(() => {
    const container = holder.current;
    if (!container || !service) return;
    container.prepend(service.video);
    return () => {
      service.video.remove();
    };
  }, [service, preview, on]);
  useEffect(() => {
    let id = 0,
      lastTime = 0;
    let identity = '';
    let points: Landmark[][] = [];
    const draw = () => {
      id = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 1;
      lastTime = now;
      const canvas = overlay.current,
        ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { frame, intent } = trackingChannel;
      if (!landmarks || now - frame.timestamp > 180 || !frame.hands.length) {
        points = [];
        identity = '';
        return;
      }
      const key = frame.hands.map((hand) => hand.handedness).join(':');
      if (key !== identity || points.length !== frame.hands.length) {
        identity = key;
        points = frame.hands.map((hand) => hand.landmarks.map((point) => ({ ...point })));
      }
      ctx.strokeStyle = intent.gesture === 'neutral' ? '#9fdfda' : '#72ffe0';
      ctx.fillStyle = '#effffc';
      ctx.lineWidth = 1.6;
      frame.hands.forEach((hand, index) => {
        const rendered = points[index];
        hand.landmarks.forEach((target, point) => {
          const p = rendered[point];
          const jump = Math.hypot(target.x - p.x, target.y - p.y);
          const alpha = jump > 0.18 ? 1 : 1 - Math.exp(-dt * (26 + jump * 100));
          p.x += (target.x - p.x) * alpha;
          p.y += (target.y - p.y) * alpha;
        });
        for (const [a, b] of connections) {
          const p = rendered[a],
            q = rendered[b];
          ctx.beginPath();
          ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
          ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
          ctx.stroke();
        }
        for (const p of rendered) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (intent.gesture === 'move' || intent.gesture === 'zoom') {
          const x = ((rendered[4].x + rendered[8].x) * canvas.width) / 2;
          const y = ((rendered[4].y + rendered[8].y) * canvas.height) / 2;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      if (intent.gesture === 'zoom' && points.length === 2) {
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        points.forEach((hand, index) => {
          const x = ((hand[4].x + hand[8].x) * canvas.width) / 2;
          const y = ((hand[4].y + hand[8].y) * canvas.height) / 2;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    if (on && preview) draw();
    return () => cancelAnimationFrame(id);
  }, [landmarks, on, preview]);
  return (
    <section className={`camera-panel ${!preview ? 'collapsed' : ''}`} aria-label="Camera controls">
      <div className="camera-title">
        <span>
          <span className={`status-dot ${tracking.camera === 'ready' ? 'active' : ''}`} /> HAND
          TRACKING
        </span>
        <div>
          {on && (
            <IconButton label="Disable webcam immediately" onClick={() => service?.stop()}>
              <CameraOff size={14} />
            </IconButton>
          )}
          <IconButton
            label={preview ? 'Collapse camera preview' : 'Expand camera preview'}
            onClick={() => useWorkspace.getState().set({ preview: !preview })}
          >
            {preview ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </IconButton>
        </div>
      </div>
      {preview && (
        <>
          {on ? (
            <>
              <div className="camera-video" ref={holder}>
                <canvas ref={overlay} width={640} height={480} />
                {tracking.camera !== 'ready' && (
                  <div className="camera-loading">
                    <ScanLine className="pulse" size={24} />
                    <span>
                      {tracking.camera === 'requesting'
                        ? 'Waiting for camera permission…'
                        : 'Loading hand tracking…'}
                    </span>
                    <button className="text-button" onClick={() => service?.stop()}>
                      Cancel
                    </button>
                  </div>
                )}
                <span className="camera-live">
                  {tracking.camera === 'ready' ? 'LIVE · MIRRORED' : 'INITIALIZING'}
                </span>
              </div>
              <div className="camera-feedback">
                <span>
                  {tracking.hands ? gestureNames[tracking.gesture] : 'Show your hand to begin'}
                </span>
                <span>{tracking.hands} / 2 hands</span>
              </div>
              {tracking.camera === 'ready' && (
                <div className="tracking-performance">
                  {Math.round(tracking.fps)} detections/s · {Math.round(tracking.inferenceMs)} ms ·{' '}
                  {tracking.backend === 'worker' ? 'Worker' : 'Main thread'}
                </div>
              )}
            </>
          ) : (
            <div className="camera-off">
              <div className="hand-symbol">
                <Hand size={27} strokeWidth={1.25} />
                <span />
              </div>
              <h3>Your hands. Your controls.</h3>
              <p>A new way to explore in 3D.</p>
              <button className="button camera-enable" onClick={enable}>
                <Camera size={14} /> Enable camera
              </button>
              <span className="privacy-note">
                <ShieldCheck size={11} /> Private. Local. Never recorded.
              </span>
            </div>
          )}
        </>
      )}
      {tracking.error && (
        <div className="camera-error" role="alert">
          <p>{tracking.error}</p>
          <button className="text-button" onClick={enable}>
            Try again
          </button>
          <IconButton
            label="Dismiss camera error"
            onClick={() => useWorkspace.getState().set({ tracking: { ...tracking, error: null } })}
          >
            <X size={12} />
          </IconButton>
        </div>
      )}
      {!preview && (
        <div className="camera-collapsed-status">
          {on ? (
            `${tracking.hands} hands · ${gestureNames[tracking.gesture]}`
          ) : (
            <button className="text-button" onClick={enable}>
              Enable camera
            </button>
          )}
        </div>
      )}
    </section>
  );
}
