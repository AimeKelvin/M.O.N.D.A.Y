# Deploying to Vercel

MONDAY produces static assets. No Node server, serverless function, paid backend, API key, environment variable, or database is necessary.

1. Push this repository to your Git hosting provider.
2. Import the repository into Vercel. Use the Vite framework preset and Node 24.
3. Keep the committed configuration: install `npm ci`, build `npm run build`, output `dist`.
4. Deploy, then open the resulting HTTPS URL in a top-level browser tab.

The configuration follows [Vercel's Vite deployment workflow](https://vercel.com/docs/frameworks/frontend/vite). No live deployment URL is included until one has actually been published.

`postinstall` copies the pinned MediaPipe WASM distribution and fetches the fixed hand model. The build machine must be able to reach the npm registry and `storage.googleapis.com`. The model is verified against its committed hash; an unexpected response fails installation. If install scripts were disabled, run `npm run assets:tracking` before building. For an offline build, populate the generated files through the same verified script before disconnecting.

The application has one route (`/`), so no catch-all rewrite is required. Real static assets retain their normal file responses; a missing WASM asset should not be rewritten to HTML. Vite's production build has no dependency on the development server.

The included headers enforce same-origin resources, block framing, require explicit same-origin camera access, and deny microphone and geolocation. `wasm-unsafe-eval` permits WebAssembly compilation. Inline styles are allowed for Three.js/React layout. JavaScript evaluation is not broadly enabled. These headers are also applied to the local production preview, and camera initialization is covered by Playwright there.

## Production checks

- Confirm the example renders and mouse orbit, zoom, and reset work.
- Import a valid GLB and a complete GLTF dependency set.
- Open the Network panel and enable the camera. Runtime WASM and model requests must go to this deployment only.
- Verify actual tracking and each gesture with a physical webcam, including release and tracking loss.
- Deny camera permission, reload, and recover through site settings.
- Disable tracking and verify that the camera indicator turns off.
- Test the intended browser/device matrix and run the manual QA sheet in `testing.md`.

HTTPS is required for camera access outside localhost. Frame embedding is intentionally blocked; if you later support embedding, review both camera Permissions Policy and CSP deliberately. Hosting is prepared here; this repository is not claimed to be deployed by default.

Local production preview:

```sh
npm run build
npm run preview
```
