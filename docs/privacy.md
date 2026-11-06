# Privacy and resource security

MONDAY adds no analytics, telemetry, recording, login, uploads, or remote model fetches. The camera is requested only on an explicit enable action, with audio disabled. Files remain in memory and camera images are passed only to a local detector. The normal network surface is the host's own HTML, JavaScript, fonts, WASM, hand model, and demonstration GLB.

MediaPipe's upstream [privacy notice](https://github.com/google-ai-edge/mediapipe#privacy-notice) describes on-device input processing and API utilization metrics across its products. Do not assume that every upstream runtime has identical telemetry behavior. MONDAY's production and preview Content Security Policies restrict connections to the same origin, blob, and data resources; third-party telemetry connections are not permitted. Automated browser tests check for off-origin HTTP requests during the camera lifecycle. The development policy additionally permits local Vite WebSockets and its inline preamble. No application-generated performance metrics leave the page.

The build/install process contacts the npm registry and Google's versioned model storage. The checked model hash is in `scripts/setup-tracking.mjs` and `THIRD_PARTY_NOTICES.md`. Once built, the deployment does not depend on a runtime CDN. The host can log ordinary static requests. That is separate from sending models or camera footage.

GLTF resource URIs are checked before invoking the loader. External network URLs, absolute filesystem paths, parent traversal, unsupported embedded MIME types, missing local files, and ambiguous dependency basenames fail with a recovery message. Temporary local object URLs are revoked. Imported metadata is displayed as text, never HTML.

Size, accessor memory, mesh, vertex, triangle, node hierarchy, image header, and aggregate texture budgets are enforced. A malicious file might still trigger a browser or decoder bug, or stall parsing within these budgets; this project does not replace browser security isolation. Keep dependencies and browsers patched.

Turning the camera off, pressing Escape, unmounting, or a fatal tracking error stops tracks. Hiding only the preview keeps tracking on. Switching to a hidden tab suspends detection and clears the current intent but does not turn the camera off; use the stop control to release the camera device. Preferences and imports are not persisted after reload.
