# Platform reference

[← Back to the README](../readme.md)

## Supported files

Prefer a self-contained **GLB (GLTF 2.0)**. For **GLTF**, select or drop exactly one `.gltf` file together with every referenced `.bin`, PNG, JPEG, and WebP file. When file pickers flatten folders, dependency filenames must be unique. For ambiguous filenames or parent-relative paths, export a self-contained GLB. ZIP files and dropped directories are not unpacked.

External HTTP/HTTPS, file, and parent-directory resource paths are blocked. Missing dependencies produce an actionable error while preserving the current model. Draco, Meshopt, and KTX2 compression are explicitly rejected; re-export uncompressed. Static geometry from animated models is viewable; animation playback is not provided.

Limits: 50 MiB per file, 100 MiB total, 128 files, 512 meshes, 3,000 nodes, 2 million vertices, 1 million triangles, 8,192-pixel texture dimensions, and 64 megapixels of combined image data. Geometry memory and hierarchy limits are also checked. Image headers are inspected before decoding. These safeguards reduce risk; loading untrusted complex graphics can still stress a browser.

Dimensions are reported in source model units. Part names and metadata come from the file; MONDAY does not infer part semantics. Only the prepared demo has authored explosion directions.

## Stack and architecture

React 19, strict TypeScript, Vite 8, Three.js, React Three Fiber, Drei, MediaPipe Tasks Vision, Tailwind CSS 4, Lucide React, and Zustand. Vitest, React Testing Library, Playwright, ESLint, and Prettier provide verification.

```text
src/
  app/                       Workspace orchestration and keyboard/drop handling
  components/                Camera preview, dialogs, shared controls, error boundary
  engine/
    camera/                  Permission requests, errors, stream cleanup
    tracking/                MediaPipe initialization, worker, scheduler, live channel
    gestures/                Framework-independent temporal gesture recognizer
    interactions/            Camera-space intent → Three.js transforms and raycasting
  features/
    model-import/            Preflight, textures, GLTF resolution, normalization, disposal
    model-viewer/            R3F scene, lighting, mouse controls, camera-linked gizmo
    model-inspection/        Object hierarchy and metadata
  stores/                    Low-frequency workspace state
  styles/                    Design system and responsive layout
  tests/                     Test setup and synthetic hand fixtures
public/
  models/                    Original demo GLB and its license
  mediapipe/                 Generated, self-hosted runtime assets
  licenses/                  Third-party license texts
scripts/                     Asset generation and verified tracking setup
tests/e2e/                   Production-browser acceptance tests
docs/                        Architecture, gestures, QA, privacy, troubleshooting, deployment
```

Tracking frames live outside React. UI summaries update at roughly six times per second or on a gesture transition. The R3F frame loop consumes each intent once; gestures do not accumulate momentum. Read [architecture](architecture.md) and [gesture design](gestures.md).

## Browser and hardware

A current desktop browser with WebGL 2, WebAssembly, and camera APIs is required. HTTPS is required outside localhost. Desktop Chrome/Chromium is the automated browser target. Safari, Firefox, and Edge are intended targets but require their own release testing, particularly the worker fallback and camera permissions.

A webcam is optional for viewing. A modern laptop, a well-lit face-on camera, and adequate space for two hands are recommended. Touch controls and a collapsible inspector support small screens; hand interaction is most practical on desktop. No constant frame-rate or hardware performance claim is made. Inference is capped at 30 starts/second in the worker and 24 on the main thread, with additional backoff based on inference cost, and adapts naturally to available decoded frames; the UI reports measured inference time and detection rate.

## Privacy

Files are read using browser File APIs and retained only in memory. Camera frames are processed locally and are never recorded or sent to a server. Tracks stop when disabled, on Escape, or when the app unmounts. Hidden tabs suspend inference; disabling the camera releases the device. Reloading loses the current import and gesture settings. The theme preference is saved locally.

The hosting provider receives normal requests for application assets, not models or video. The build machine downloads npm packages and the fixed MediaPipe model. Runtime JavaScript, WASM, fonts, and the demo are served from the same origin. See [privacy and security](privacy.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

## Quality checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
# Or unit tests + production build + browser tests:
npm test
```

On macOS with Google Chrome installed, the browser tests use it; otherwise they use Playwright Chromium. Browser tests exercise the production build on port 4173. Tests may use synthetic landmarks, permission mocks, and Chromium's synthetic camera; production never uses them. The real MediaPipe runtime is exercised with the synthetic test camera. This does not replace physical hand-gesture testing. See the [browser acceptance tests](../tests/e2e/workspace.spec.ts) for automated coverage. Physical hand gestures still need hands-on testing across devices and lighting conditions.

## Deploy to Vercel

Push the repository to your Git host, import it into Vercel, and use the included `vercel.json`. Installation is `npm ci`, build is `npm run build`, and output is `dist`. Select Node 24. No environment variables, functions, database, or paid backend are required. [Deployment instructions](deployment.md) include production checks and security headers.

## Limits and next steps

Gestures can be affected by lighting, occlusion, motion blur, hand orientation, and detector handedness changes. These cause safe disengagement and reacquisition. Initial tracking downloads are substantial (the hand model is about 7.8 MB plus WASM); the first camera start may take several seconds. Heavy GLTF parsing still happens on the main thread. Very slow inference is discarded to avoid applying stale movement.

Future work: physical usability studies across devices and hand shapes, worker-based model parsing, optional compressed-model decoders, camera device selection, and richer accessible model navigation. No component semantics, engineering accuracy, or universal tracking reliability is claimed.

## Contribute and license

Read [CONTRIBUTING](../CONTRIBUTING.md), [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md), and [SECURITY](../SECURITY.md). Source code and the original demonstration model are MIT licensed. Third-party dependencies retain their own licenses; see [LICENSE](../LICENSE) and [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md).
