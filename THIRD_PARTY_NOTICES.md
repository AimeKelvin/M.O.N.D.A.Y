# Third-party notices

MONDAY source code and the original orbital-drive demonstration are MIT licensed. This does not relicense dependencies or machine-learning models.

| Component | Attribution / license | Source |
| --- | --- | --- |
| MediaPipe Tasks Vision 1.2.2 and WASM | Copyright Google LLC; Apache-2.0 | https://github.com/google-ai-edge/mediapipe |
| Hand Landmarker float16, version 1 | Google MediaPipe model, distributed for the MediaPipe Hand Landmarker task; Apache-2.0 | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task |
| Three.js | Three.js authors; MIT | https://github.com/mrdoob/three.js |
| React / React DOM | Meta and contributors; MIT | https://github.com/facebook/react |
| React Three Fiber / Drei / Zustand | pmndrs contributors; MIT | https://github.com/pmndrs |
| Inter | The Inter Project Authors; SIL Open Font License 1.1 | https://github.com/rsms/inter |
| Lucide icons | Lucide contributors; ISC | https://github.com/lucide-icons/lucide |
| Tailwind CSS | Tailwind Labs; MIT | https://github.com/tailwindlabs/tailwindcss |

License texts for MediaPipe (Apache-2.0), Inter, and Three.js are included in `public/licenses/` and the production output. Package distributions and the lockfile identify remaining transitive dependencies and their licenses. MediaPipe packages and model files are unmodified; MONDAY adds its own lifecycle, scheduling, normalization, and gesture interpretation.

Pinned hand model SHA-256:

```text
fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1
```

Build-time download and verification live in `scripts/setup-tracking.mjs`. There are no runtime CDN downloads. The demo's provenance and regeneration instructions are in `docs/demo-model.md`.
