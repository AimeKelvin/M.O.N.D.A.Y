import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Minimize2,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  ChevronDown,
  CircleHelp,
  Expand,
  Grid2X2,
  Hand,
  LoaderCircle,
  Maximize,
  Move,
  MousePointer2,
  Rotate3D,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { importModel, loadDemo } from '../features/model-import/importModel';
import { disposeModel } from '../features/model-import/model';
import { Inspector } from '../features/model-inspection/Inspector';
import { CameraPanel, gestureNames } from '../components/CameraPanel';
import { Dialogs } from '../components/Dialogs';
import { IconButton } from '../components/IconButton';
import { TrackingService } from '../engine/tracking/TrackingService';
import { trackingChannel } from '../engine/tracking/channel';
import type { Tool } from '../stores/workspace';
const Viewer = lazy(() => import('../features/model-viewer/Viewer'));
const toolOptions = [
  { id: 'rotate', label: 'Rotate', key: 'R', icon: Rotate3D },
  { id: 'move', label: 'Move', key: 'M', icon: Move },
  { id: 'zoom', label: 'Zoom', key: 'Z', icon: ZoomIn },
  { id: 'inspect', label: 'Inspect', key: 'I', icon: ScanLine },
] as const;
function GesturePointer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    const update = () => {
      id = requestAnimationFrame(update);
      const p = ref.current,
        { intent } = trackingChannel;
      if (!p) return;
      const active =
        intent.gesture === 'inspect' &&
        intent.pointer &&
        performance.now() - intent.timestamp < 180 &&
        !useWorkspace.getState().dialog;
      p.style.display = active ? 'block' : 'none';
      if (active && intent.pointer) {
        p.style.left = `${intent.pointer.x * 100}%`;
        p.style.top = `${intent.pointer.y * 100}%`;
      }
    };
    update();
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div ref={ref} className="gesture-pointer" aria-hidden="true">
      <span />
    </div>
  );
}
function Toolbar({ toggleCamera }: { toggleCamera: () => void }) {
  const tool = useWorkspace((s) => s.tool),
    camera = useWorkspace((s) => s.tracking.camera);
  const on = ['ready', 'loading', 'requesting'].includes(camera);
  return (
    <div className="toolbar" role="toolbar" aria-label="Workspace tools">
      {toolOptions.map((item) => (
        <button
          key={item.id}
          aria-label={`${item.label} tool`}
          aria-pressed={tool === item.id}
          title={`${item.label} (${item.key})`}
          className={`tool-button ${tool === item.id ? 'active' : ''}`}
          onClick={() => useWorkspace.getState().set({ tool: item.id })}
        >
          <item.icon size={18} strokeWidth={1.6} />
          <span>{item.label}</span>
        </button>
      ))}
      <span className="toolbar-divider" />
      <button
        className="tool-button"
        title="Reset scene (0)"
        aria-label="Reset scene"
        onClick={() => useWorkspace.getState().reset()}
      >
        <RotateCcw size={17} />
        <span>Reset</span>
      </button>
      <span className="toolbar-divider" />
      <button
        className={`gesture-toggle ${on ? 'enabled' : ''}`}
        aria-pressed={on}
        aria-label={on ? 'Disable gesture controls' : 'Enable gesture controls'}
        onClick={toggleCamera}
      >
        <Hand size={18} />
        <span>Gestures</span>
        <span className="switch">
          <i />
        </span>
      </button>
    </div>
  );
}
export default function App() {
  const model = useWorkspace((s) => s.model),
    loading = useWorkspace((s) => s.loading),
    error = useWorkspace((s) => s.error),
    grid = useWorkspace((s) => s.grid),
    wireframe = useWorkspace((s) => s.wireframe),
    tracking = useWorkspace((s) => s.tracking),
    tool = useWorkspace((s) => s.tool);
  const theme = useWorkspace((s) => s.theme);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => matchMedia('(min-width: 1051px)').matches);
  useEffect(() => {
    const query = matchMedia('(min-width: 1051px)');
    const update = () => setSidebarOpen(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('monday-theme', theme);
    } catch {
      /* Storage may be disabled. */
    }
  }, [theme]);
  const toggleFocus = useCallback(() => {
    setFocusMode((value) => !value);
  }, []);
  const [service] = useState(() => new TrackingService());
  const [dragging, setDragging] = useState(false),
    [examples, setExamples] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    operation = useRef(0),
    dragDepth = useRef(0);
  const load = useCallback(async (files?: File[]) => {
    const token = ++operation.current;
    useWorkspace.getState().set({
      loading: files ? 'Reading and preparing your model…' : 'Opening demonstration model…',
      error: null,
    });
    try {
      const next = files ? await importModel(files) : await loadDemo();
      if (token !== operation.current) {
        disposeModel(next.root);
        return;
      }
      useWorkspace.getState().setModel(next);
    } catch (cause) {
      if (token === operation.current)
        useWorkspace.getState().set({
          loading: null,
          error:
            cause instanceof Error ? cause.message : 'Could not load this model. Try another file.',
        });
    }
  }, []);
  useEffect(() => {
    const requests = operation;
    void load();
    return () => {
      requests.current++;
      service.stop();
    };
  }, [load, service]);
  const enable = useCallback(() => {
    void service.start();
  }, [service]);
  const toggleCamera = useCallback(() => {
    if (['ready', 'loading', 'requesting'].includes(useWorkspace.getState().tracking.camera))
      service.stop();
    else enable();
  }, [service, enable]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        service.stop();
        setExamples(false);
        return;
      }
      const tag = (event.target as HTMLElement)?.tagName;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        useWorkspace.getState().dialog
      )
        return;
      const map: Record<string, Tool> = { r: 'rotate', m: 'move', z: 'zoom', i: 'inspect' };
      if (map[event.key.toLowerCase()])
        useWorkspace.getState().set({ tool: map[event.key.toLowerCase()] });
      if (event.key.toLowerCase() === 'f') toggleFocus();
      if (event.key === '0') useWorkspace.getState().reset();
      if (event.key === '?') useWorkspace.getState().set({ dialog: 'guide' });
      if (event.key === '/') {
        event.preventDefault();
        setFocusMode(false);
        setSidebarOpen(true);
        requestAnimationFrame(() =>
          document.querySelector<HTMLInputElement>('[aria-label="Find a component"]')?.focus(),
        );
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [service, toggleFocus]);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      useWorkspace.getState().set({
        error:
          'Fullscreen is unavailable in this browser window. You can still use the workspace normally.',
      });
    }
  };
  return (
    <div
      className={`app-shell ${focusMode ? 'focus-mode' : ''}`}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current--;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length) void load(Array.from(e.dataTransfer.files));
      }}
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          aria-label="MONDAY workspace"
          onClick={(e) => e.preventDefault()}
        >
          <svg viewBox="0 0 30 30" aria-hidden="true">
            <path d="M3 24V6h5l7 11 7-11h5v18h-5V14l-7 10-7-10v10z" fill="currentColor" />
          </svg>
          <span>
            MONDAY<span className="brand-period">.</span>
          </span>
        </a>
        <span className="brand-divider" />
        <span className="workspace-label">SPATIAL WORKSPACE</span>
        <div className="topbar-model">
          <Box size={13} />
          <span>{model?.name ?? 'Workspace'}</span>
          <span className="unsaved-dot" title="Local workspace" />
        </div>
        <div className="topbar-actions">
          <button className="button import-button" onClick={() => input.current?.click()}>
            <Upload size={14} />
            <span>Import model</span>
            <kbd>+</kbd>
          </button>
          <span className="action-divider" />
          <IconButton
            label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle"
            onClick={() =>
              useWorkspace.getState().set({ theme: theme === 'dark' ? 'light' : 'dark' })
            }
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
          <IconButton
            label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            aria-pressed={focusMode}
            className="focus-toggle"
            onClick={toggleFocus}
          >
            {focusMode ? <Minimize2 size={17} /> : <Maximize size={17} />}
          </IconButton>
          <IconButton
            label="Reset model and camera"
            className="reset-button"
            onClick={() => useWorkspace.getState().reset()}
          >
            <RotateCcw size={17} />
          </IconButton>
          <IconButton
            label="Workspace settings"
            onClick={() => useWorkspace.getState().set({ dialog: 'settings' })}
          >
            <Settings2 size={17} />
          </IconButton>
          <IconButton
            label="Toggle fullscreen"
            className="fullscreen-button"
            onClick={() => void fullscreen()}
          >
            <Expand size={17} />
          </IconButton>
        </div>
      </header>
      <input
        ref={input}
        data-testid="model-input"
        type="file"
        multiple
        accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        aria-label="Import model files"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void load(files);
        }}
      />
      <main className="workspace">
        <section
          className={`viewport ${tracking.gesture !== 'neutral' ? 'gesture-engaged' : ''}`}
          aria-label="Interactive 3D viewport"
        >
          <Suspense
            fallback={
              <div className="loading-overlay">
                <LoaderCircle className="spin" />
                <span>Preparing the 3D workspace…</span>
              </div>
            }
          >
            <Viewer />
          </Suspense>
          <div className="viewport-heading">
            <div className="eyebrow">
              <span className="small-cross">+</span> WORKSPACE <span className="slash">/</span> 01
            </div>
            <div className="model-heading">
              <h1>{model?.name.replace(/\.(glb|gltf)$/i, '') ?? 'Your spatial workspace'}</h1>
              <button
                className="model-menu-button"
                aria-label="Choose example model"
                aria-expanded={examples}
                onClick={() => setExamples(!examples)}
              >
                <ChevronDown size={15} />
              </button>
            </div>
            <p>
              {model?.demo
                ? 'A different perspective on every detail.'
                : 'Your model. A new perspective.'}
            </p>
            {examples && (
              <div className="example-menu">
                <button
                  onClick={() => {
                    setExamples(false);
                    void load();
                  }}
                >
                  <Box size={18} />
                  <span>
                    Orbital drive<small>Original · 80-part assembly</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
                <button
                  onClick={() => {
                    setExamples(false);
                    input.current?.click();
                  }}
                >
                  <Upload size={16} /> Import your own model
                </button>
              </div>
            )}
          </div>
          <div className="viewport-actions">
            <span className="view-label">PERSPECTIVE</span>
            <IconButton
              label="Frame model and reset camera"
              onClick={() => useWorkspace.getState().resetCamera()}
            >
              <Maximize size={15} />
            </IconButton>
            <IconButton
              label="Toggle environment grid"
              aria-pressed={grid}
              className={grid ? 'is-active' : ''}
              onClick={() => useWorkspace.getState().set({ grid: !grid })}
            >
              <Grid2X2 size={15} />
            </IconButton>
            <IconButton
              label="Toggle wireframe"
              aria-pressed={wireframe}
              className={wireframe ? 'is-active' : ''}
              onClick={() => useWorkspace.getState().set({ wireframe: !wireframe })}
            >
              <Box size={16} />
            </IconButton>
            <IconButton
              label={sidebarOpen && !focusMode ? 'Retract scene explorer' : 'Open scene explorer'}
              aria-expanded={sidebarOpen && !focusMode}
              aria-controls="scene-sidebar"
              className="sidebar-toggle"
              onClick={() => {
                if (focusMode) {
                  setFocusMode(false);
                  setSidebarOpen(true);
                } else setSidebarOpen(!sidebarOpen);
              }}
            >
              {sidebarOpen && !focusMode ? (
                <PanelRightClose size={16} />
              ) : (
                <PanelRightOpen size={16} />
              )}
            </IconButton>
          </div>
          <div className="canvas-mode">
            <span className={`status-dot ${tracking.gesture !== 'neutral' ? 'active' : ''}`} />
            {tracking.gesture !== 'neutral'
              ? gestureNames[tracking.gesture]
              : 'ready' === tracking.camera
                ? 'Gesture controls ready'
                : 'Mouse controls active'}
          </div>
          <GesturePointer />
          <CameraPanel service={service} enable={enable} />
          <div className="viewport-bottom">
            <div className="interaction-hint">
              <MousePointer2 size={12} />
              <span>
                {tool === 'move'
                  ? 'Drag to pan'
                  : tool === 'zoom'
                    ? 'Drag to zoom'
                    : tool === 'inspect'
                      ? 'Click a component to inspect'
                      : 'Drag to rotate'}
                <b>·</b>Scroll to zoom
              </span>
            </div>
            <Toolbar toggleCamera={toggleCamera} />
          </div>
          <button
            className="help-button"
            onClick={() => useWorkspace.getState().set({ dialog: 'guide' })}
          >
            <CircleHelp size={16} />
            <span>Gesture guide</span>
            <kbd>?</kbd>
          </button>
          {loading && (
            <div className="loading-overlay" role="status">
              <LoaderCircle className="spin" size={23} />
              <span>{loading}</span>
            </div>
          )}
          {error && (
            <div className="error-toast" role="alert">
              <div>
                <strong>Let’s try that again.</strong>
                <p>{error}</p>
                <div className="error-actions">
                  <button className="text-button" onClick={() => input.current?.click()}>
                    Choose files
                  </button>
                  <button className="text-button" onClick={() => void load()}>
                    Load example
                  </button>
                </div>
              </div>
              <IconButton
                label="Dismiss model error"
                onClick={() => useWorkspace.getState().set({ error: null })}
              >
                <X size={16} />
              </IconButton>
            </div>
          )}
          <div className="small-screen-note">
            <Hand size={12} /> Use a larger screen for comfortable hand gestures.
          </div>
        </section>
        <div
          id="scene-sidebar"
          className={`inspector-wrapper ${sidebarOpen && !focusMode ? 'is-open' : 'is-retracted'}`}
          aria-hidden={!sidebarOpen || focusMode}
          inert={!sidebarOpen || focusMode}
        >
          <Inspector onClose={() => setSidebarOpen(false)} />
        </div>
      </main>
      <footer className="statusbar">
        <span>
          <ShieldCheck size={12} />
          <span>LOCAL WORKSPACE</span>
          <i /> Your files stay yours.
        </span>
        <span className="footer-center">
          {model ? `${model.meshCount} meshes` : 'No model'}
          <i /> WebGL 2
        </span>
        <button onClick={() => useWorkspace.getState().set({ dialog: 'guide' })}>
          MADE FOR A NEW PERSPECTIVE <ArrowUpRight size={11} />
        </button>
      </footer>
      {dragging && (
        <div className="drop-overlay">
          <div>
            <ArrowDownToLine size={38} strokeWidth={1.3} />
            <h2>Give your model a new perspective.</h2>
            <p>Drop one GLB, or a GLTF with all of its dependencies.</p>
            <span>50 MB per file · 100 MB total · Files stay on your device</span>
          </div>
        </div>
      )}
      <Dialogs enable={enable} />
    </div>
  );
}
