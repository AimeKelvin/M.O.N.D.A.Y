# Troubleshooting

| Symptom | Recovery |
| --- | --- |
| Camera permission denied | Allow camera access in your browser's site settings, then choose Try again. No permission request happens on page load. |
| No camera found | Connect a camera and try again. Continue with the mouse if no camera is available. |
| Camera busy/unavailable | Close other camera apps/tabs, reconnect the camera, and retry. |
| Camera works on localhost but not another host | Use HTTPS and a top-level tab. An ordinary HTTP LAN address is not a secure context. |
| Tracking initialization fails | Check same-origin `/mediapipe/` JS, WASM, and task responses. Run `npm run assets:tracking` and rebuild. Do not rewrite missing assets to index.html. |
| Hand count stays at zero | Improve even lighting, show the whole hand, avoid occlusion, and keep hands face-on. Close graphics-heavy apps. |
| Gesture keeps disengaging | Move more slowly and keep the same hand visible. Hand identity changes and excessive latency intentionally require reacquisition. Try lower sensitivity. |
| Two hands do nothing | Zoom requires a thumb–index pinch on both hands. Other two-hand combinations are neutral. |
| Preview hidden, camera indicator still on | Collapse only hides the preview. Use the Gestures toggle, stop-camera icon, or Escape to release the device. |
| Model import says missing dependency | Select the GLTF plus every BIN and texture file together. Prefer a single GLB. Unique basenames are required when paths are flattened. |
| Compressed model rejected | Export without Draco, Meshopt, or KTX2. These decoders are not included in this release. |
| Texture or geometry budget exceeded | Reduce texture resolution or model complexity. See README for actual limits. |
| Model appears misplaced | Use Reset scene to restore the model and camera; use Frame model to restore the camera around the current model position. |
| WebGL unavailable | Enable browser hardware acceleration and use a current WebGL 2 browser. |
| Graphics context interrupted | Close other graphics-intensive tabs and reload with a smaller model. Context restoration is observed, but full recovery may require reload. |
| Playwright cannot find Chromium | Run `npx playwright install chromium`. On macOS the suite uses installed Google Chrome when available. |
| npm cannot download the model | Check network/proxy access to Google's versioned model storage, then retry `npm run assets:tracking`. Do not bypass hash verification. |

The hierarchy reports source names and metadata. A generic name such as `mesh_0` means the exporter did not provide a more meaningful name; MONDAY does not recognize parts from geometry. Dimensions are source model units, not validated manufacturing measurements.
