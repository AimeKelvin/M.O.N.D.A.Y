import { MotionSmoother } from '../../engine/interactions/MotionSmoother';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Box3,
  Box3Helper,
  Color,
  MOUSE,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useWorkspace } from '../../stores/workspace';
import { trackingChannel } from '../../engine/tracking/channel';
import { applyInteraction, MAX_DISTANCE, MIN_DISTANCE } from '../../engine/interactions/controller';
import { applyExplode, disposeModel, resetTransform } from '../model-import/model';
import type { PreparedModel } from '../model-import/model';
import { ErrorBoundary } from '../../components/ErrorBoundary';
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.9;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 7, 5]} intensity={3} color="#e1e9f2" />
      <directionalLight position={[-5, 1, -3]} intensity={2.5} color="#a2d3ce" />
    </>
  );
}
function LoadedModel({
  model,
  controls,
}: {
  model: PreparedModel;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const selected = useWorkspace((s) => s.selected),
    hidden = useWorkspace((s) => s.hidden),
    wireframe = useWorkspace((s) => s.wireframe),
    exploded = useWorkspace((s) => s.exploded);
  const reset = useWorkspace((s) => s.resetVersion),
    cameraReset = useWorkspace((s) => s.cameraResetVersion);
  const { camera, size } = useThree();
  const reducedMotion = useReducedMotion();
  const motion = useRef(new MotionSmoother());
  const explosion = useRef(0);
  const fitted = useRef('');
  const fitSine = useRef(0);
  const lastSequence = useRef(-1);
  const lastPick = useRef<string | null>(null);
  const pickSince = useRef(0);
  const mouseActive = useRef(false);
  const box = useMemo(() => new Box3(), []);
  const helper = useMemo(() => new Box3Helper(box, new Color('#9fdfda')), [box]);
  const selectedObject = useMemo(
    () => (selected ? model.scene.getObjectByProperty('uuid', selected) : null),
    [selected, model],
  );
  useEffect(
    () => () => {
      disposeModel(model.root);
      helper.geometry.dispose();
      (helper.material as MeshStandardMaterial).dispose();
    },
    [model, helper],
  );
  useLayoutEffect(() => {
    model.scene.traverse((o) => {
      o.visible = !hidden.includes(o.uuid);
    });
  }, [hidden, model]);
  useLayoutEffect(() => {
    model.scene.traverse((o) => {
      if (o instanceof Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if ('wireframe' in m) {
            m.wireframe = wireframe;
          }
    });
  }, [model, wireframe]);

  useLayoutEffect(() => {
    resetTransform(model);
    motion.current.reset();
    explosion.current = 0;
    applyExplode(model, 0);
    lastSequence.current = trackingChannel.sequence;
  }, [model, reset]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const fitKey = `${model.id}:${reset}:${cameraReset}`;
    // Bounding sphere fits both portrait and landscape viewports.
    const aspect = size.width / size.height;
    const fov = Math.min(
      (camera.fov * Math.PI) / 180,
      2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect),
    );
    const sine = Math.sin(fov / 2);
    if (fitted.current === fitKey) {
      // Keep the user's orientation and zoom level when panels or viewport dimensions change.
      if (fitSine.current && Math.abs(fitSine.current - sine) > 0.000001) {
        const offset = camera.position.clone().sub(controls.current.target);
        const distance = Math.max(
          MIN_DISTANCE,
          Math.min(MAX_DISTANCE, (offset.length() * fitSine.current) / sine),
        );
        camera.position.copy(controls.current.target).add(offset.setLength(distance));
        controls.current.update();
      }
      fitSine.current = sine;
      return;
    }
    fitted.current = fitKey;
    fitSine.current = sine;
    motion.current.reset();
    const distance = Math.min(MAX_DISTANCE, 2.65 / sine);
    camera.position
      .copy(new Vector3(0.65, 0.38, 1).normalize().multiplyScalar(distance))
      .add(model.root.position);
    controls.current.target.copy(model.root.position);
    controls.current.update();
  }, [camera, model, reset, cameraReset, controls, size.width, size.height]);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const start = () => {
      mouseActive.current = true;
    };
    const end = () => {
      mouseActive.current = false;
      lastSequence.current = trackingChannel.sequence;
    };
    orbit.addEventListener('start', start);
    orbit.addEventListener('end', end);
    return () => {
      orbit.removeEventListener('start', start);
      orbit.removeEventListener('end', end);
    };
  }, [controls]);
  useFrame((_, delta) => {
    const state = useWorkspace.getState();
    const { intent, sequence } = trackingChannel;
    const orbit = controls.current;
    const fresh = sequence !== lastSequence.current;
    lastSequence.current = sequence;
    if (
      !orbit ||
      !(camera instanceof PerspectiveCamera) ||
      state.dialog ||
      mouseActive.current ||
      state.loading ||
      performance.now() - intent.timestamp >= 180
    ) {
      motion.current.reset();
      lastPick.current = null;
      pickSince.current = performance.now();
    } else {
      if (fresh) motion.current.push(intent);
      const smooth = motion.current.step(
        delta,
        performance.now(),
        state.settings.smoothing,
        reducedMotion,
      );
      if (smooth.gesture !== 'inspect' || fresh) {
        const picked = applyInteraction(smooth, model, camera, orbit);
        if (picked !== undefined) {
          if (picked !== lastPick.current) {
            lastPick.current = picked;
            pickSince.current = performance.now();
          } else if (performance.now() - pickSince.current > 300 && picked !== state.selected)
            state.select(picked);
        } else {
          lastPick.current = null;
          pickSince.current = performance.now();
        }
      }
    }
    if (explosion.current !== exploded) {
      explosion.current +=
        (exploded - explosion.current) * (reducedMotion ? 1 : 1 - Math.exp(-delta * 12));
      if (Math.abs(exploded - explosion.current) < 0.0001) explosion.current = exploded;
      applyExplode(model, explosion.current);
    }
    if (selectedObject) {
      box.setFromObject(selectedObject);
      helper.visible = !box.isEmpty() && selectedObject.visible;
    } else helper.visible = false;
  });
  return (
    <>
      <primitive
        object={model.root}
        dispose={null}
        onClick={(event: {
          stopPropagation: () => void;
          delta: number;
          object: { uuid: string };
        }) => {
          if (event.delta < 4) {
            event.stopPropagation();
            useWorkspace.getState().select(event.object.uuid);
          }
        }}
      />
      <primitive object={helper} />
    </>
  );
}
function Scene() {
  const model = useWorkspace((s) => s.model),
    grid = useWorkspace((s) => s.grid),
    tool = useWorkspace((s) => s.tool);
  const controls = useRef<OrbitControlsImpl>(null);
  const theme = useWorkspace((s) => s.theme);
  const light = theme === 'light';
  const width = useThree((s) => s.size.width);
  return (
    <>
      <color attach="background" args={[light ? '#edf3f5' : '#141719']} />
      <Studio />
      {grid && (
        <Grid
          position={[0, -2.04, 0]}
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor={light ? '#c4d2d8' : '#30373a'}
          sectionSize={2.5}
          sectionThickness={0.6}
          sectionColor={light ? '#a6bcc6' : '#424a4d'}
          fadeDistance={24}
          fadeStrength={1.8}
          infiniteGrid
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping={false}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        maxPolarAngle={Math.PI * 0.96}
        mouseButtons={{
          LEFT: tool === 'move' ? MOUSE.PAN : tool === 'zoom' ? MOUSE.DOLLY : MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
      />
      {width > 650 && (
        <GizmoHelper alignment="top-right" margin={[58, 115]}>
          <GizmoViewport
            axisColors={['#ad938a', '#a6bfb3', '#8babb4']}
            labelColor="#192425"
            hideNegativeAxes
          />
        </GizmoHelper>
      )}
      {model && <LoadedModel key={model.id} model={model} controls={controls} />}
    </>
  );
}
function WebGLGuard({ children }: { children: React.ReactNode }) {
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      const result = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return result;
    } catch {
      return false;
    }
  });
  if (!supported)
    return (
      <div className="viewport-failure">
        <strong>3D rendering is unavailable</strong>
        <p>Enable hardware acceleration or use a browser with WebGL 2 support, then reload.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    );
  return children;
}
export default function Viewer() {
  const [lost, setLost] = useState(false);
  return (
    <ErrorBoundary message="The 3D viewer could not render this model.">
      <WebGLGuard>
        <Canvas
          camera={{ position: [5, 3, 8], fov: 38, near: 0.05, far: 100 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#141719');
            gl.domElement.addEventListener(
              'webglcontextlost',
              (e) => {
                e.preventDefault();
                setLost(true);
              },
              { once: true },
            );
            gl.domElement.addEventListener('webglcontextrestored', () => setLost(false), {
              once: true,
            });
          }}
          onPointerMissed={() => useWorkspace.getState().select(null)}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
        {lost && (
          <div className="viewport-failure">
            <strong>Graphics connection interrupted</strong>
            <p>Try reloading with a smaller model or closing other graphics apps.</p>
            <button className="button" onClick={() => location.reload()}>
              Reload workspace
            </button>
          </div>
        )}
      </WebGLGuard>
    </ErrorBoundary>
  );
}
