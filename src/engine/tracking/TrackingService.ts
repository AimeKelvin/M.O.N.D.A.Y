import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { requestCamera, stopStream, cameraError } from '../camera/camera';
import { GestureRecognizer } from '../gestures/GestureRecognizer';
import { clearTracking, trackingChannel } from './channel';
import { initialTracking, useWorkspace } from '../../stores/workspace';
import type { TrackingFrame } from '../../types/tracking';
/** Owns one stream, one detector and at most one inference. No camera request on construction. */
export class TrackingService {
  readonly video = document.createElement('video');
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private detector: HandLandmarker | null = null;
  private mainInitialization: Promise<HandLandmarker> | null = null;
  private lastReset = -1;
  private normalize: (typeof import('./landmarker'))['normalizeResult'] | null = null;
  private recognizer = new GestureRecognizer();
  private session = 0;
  private raf = 0;
  private busy = false;
  private lastVideoTime = -1;
  private lastRun = 0;
  private averageInferenceMs = 0;
  private lastPublish = 0;
  private frames = 0;
  private fpsStart = 0;
  private fps = 0;
  private cancelInitialization: (() => void) | null = null;
  private wasSuppressed = false;
  private status(patch: Partial<typeof initialTracking>) {
    useWorkspace.getState().set({ tracking: { ...useWorkspace.getState().tracking, ...patch } });
  }
  constructor() {
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }
  async start() {
    this.stop();
    const token = this.session;
    this.status({ ...initialTracking, camera: 'requesting' });
    let stage: 'camera' | 'tracking' = 'camera';
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Camera access is not supported in this browser. Use a current browser over HTTPS or localhost.',
        );
      const stream = await requestCamera();
      if (token !== this.session) {
        stopStream(stream);
        return;
      }
      this.stream = stream;
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener(
          'ended',
          () => {
            if (token === this.session)
              this.fail('The camera was disconnected. Reconnect it and enable tracking again.');
          },
          { once: true },
        ),
      );
      this.video.srcObject = stream;
      await this.video.play();
      if (token !== this.session) return;
      stage = 'tracking';
      this.status({ camera: 'loading' });
      const base = new URL(`${import.meta.env.BASE_URL}mediapipe`, location.origin).href;
      let backend: 'worker' | 'main' = 'worker';
      try {
        if (!('OffscreenCanvas' in window) || !('createImageBitmap' in window))
          throw new Error('Worker image processing unavailable');
        await this.initWorker(base);
      } catch {
        this.worker?.terminate();
        this.worker = null;
        if (token !== this.session) return;
        backend = 'main';
        const runtime = await import('./landmarker');
        await this.mainInitialization?.catch(() => {});
        if (token !== this.session) return;
        const initialization = runtime.createLandmarker(base);
        this.mainInitialization = initialization;
        let detector: HandLandmarker;
        try {
          detector = await initialization;
        } finally {
          if (this.mainInitialization === initialization) this.mainInitialization = null;
        }
        if (token !== this.session) {
          detector.close();
          return;
        }
        this.detector = detector;
        this.normalize = runtime.normalizeResult;
      }
      if (token !== this.session) return;
      this.status({ camera: 'ready', backend });
      this.fpsStart = performance.now();
      this.worker?.addEventListener('message', (event) => {
        if (token !== this.session) return;
        this.busy = false;
        if (event.data.type === 'result') this.receive(event.data.frame as TrackingFrame);
        else if (event.data.type === 'error')
          this.fail(
            'Hand tracking stopped unexpectedly. Disable and re-enable the camera to try again.',
          );
      });
      this.worker?.addEventListener('error', () => {
        if (token === this.session)
          this.fail('The tracking engine stopped. Try enabling the camera again.');
      });
      this.loop(token);
    } catch (error) {
      if (token !== this.session) return;
      const message =
        stage === 'tracking'
          ? 'Hand tracking could not initialize. Check that the tracking assets loaded, then try again. Mouse controls remain available.'
          : !navigator.mediaDevices?.getUserMedia && error instanceof Error
            ? error.message
            : cameraError(error);
      this.fail(message);
    }
  }
  private initWorker(base: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./tracking.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker = worker;
      const finish = (success: boolean) => {
        clearTimeout(timer);
        worker.removeEventListener('message', ready);
        worker.removeEventListener('error', error);
        this.cancelInitialization = null;
        if (success) resolve();
        else reject(new Error('Worker initialization failed'));
      };
      const ready = (event: MessageEvent) => finish(event.data.type === 'ready');
      const error = () => finish(false);
      const timer = window.setTimeout(error, 20000);
      this.cancelInitialization = error;
      worker.addEventListener('message', ready);
      worker.addEventListener('error', error);
      worker.postMessage({ type: 'init', base });
    });
  }
  private loop = (token: number) => {
    if (token !== this.session) return;
    this.raf = requestAnimationFrame(() => this.loop(token));
    const now = performance.now();
    if (document.hidden) {
      this.recognizer.reset();
      clearTracking();
      return;
    }
    if (
      trackingChannel.frame.timestamp &&
      now - trackingChannel.frame.timestamp > 200 &&
      trackingChannel.frame.hands.length
    ) {
      this.recognizer.reset();
      clearTracking();
      this.status({ hands: 0, gesture: 'neutral', pending: 'neutral' });
    }
    if (this.busy && now - this.lastRun > 5000) {
      this.fail('Hand tracking took too long to respond. Try enabling the camera again.');
      return;
    }
    if (
      this.busy ||
      now - this.lastRun <
        Math.max(this.worker ? 1000 / 30 : 1000 / 24, this.averageInferenceMs * 1.15) ||
      this.video.readyState < 2 ||
      this.video.currentTime === this.lastVideoTime
    )
      return;
    this.lastRun = now;
    this.lastVideoTime = this.video.currentTime;
    this.busy = true;
    if (this.worker) {
      const worker = this.worker;
      void createImageBitmap(this.video)
        .then((bitmap) => {
          if (token !== this.session) {
            bitmap.close();
            return;
          }
          worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
        })
        .catch(() => {
          if (token === this.session)
            this.fail(
              'The camera frame could not be processed. Try another browser or reconnect the camera.',
            );
        });
    } else if (this.detector && this.normalize) {
      try {
        const start = performance.now();
        const result = this.detector.detectForVideo(this.video, now);
        this.receive({
          hands: this.normalize(result),
          timestamp: now,
          inferenceMs: performance.now() - start,
        });
      } catch {
        this.fail('Hand tracking stopped. Try enabling the camera again.');
      } finally {
        this.busy = false;
      }
    }
  };
  private receive(frame: TrackingFrame) {
    this.averageInferenceMs += (frame.inferenceMs - this.averageInferenceMs) * 0.2;
    const state = useWorkspace.getState();
    if (performance.now() - frame.timestamp > 180) {
      this.recognizer.reset();
      clearTracking();
      return;
    }
    const suppressed = !!state.dialog;
    if (this.lastReset !== state.resetVersion + state.cameraResetVersion) {
      this.lastReset = state.resetVersion + state.cameraResetVersion;
      this.recognizer.reset();
    }
    if (suppressed !== this.wasSuppressed) this.recognizer.reset();
    this.wasSuppressed = suppressed;
    const intent = this.recognizer.update(frame, state.settings);
    trackingChannel.frame = frame;
    trackingChannel.intent = intent;
    trackingChannel.sequence++;
    this.frames++;
    if (frame.timestamp - this.fpsStart > 1000) {
      this.fps = (this.frames * 1000) / (frame.timestamp - this.fpsStart);
      this.frames = 0;
      this.fpsStart = frame.timestamp;
    }
    if (frame.timestamp - this.lastPublish > 160 || intent.gesture !== state.tracking.gesture) {
      this.lastPublish = frame.timestamp;
      this.status({
        hands: frame.hands.length,
        gesture: intent.gesture,
        pending: intent.pending,
        inferenceMs: frame.inferenceMs,
        fps: this.fps,
      });
    }
  }
  private fail(message: string) {
    this.stop();
    this.status({ camera: 'error', error: message });
  }
  stop() {
    this.session++;
    cancelAnimationFrame(this.raf);
    this.cancelInitialization?.();
    this.cancelInitialization = null;
    this.worker?.terminate();
    this.worker = null;
    this.detector?.close();
    this.detector = null;
    this.normalize = null;
    stopStream(this.stream);
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.recognizer.reset();
    clearTracking();
    this.busy = false;
    this.averageInferenceMs = 0;
    this.lastRun = 0;
    this.lastVideoTime = -1;
    this.frames = 0;
    this.status({ ...initialTracking });
  }
}
