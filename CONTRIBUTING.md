# Contributing to MONDAY

Start with Node 22.12+ (24 recommended), run `npm ci`, and then `npm run dev`. The first install downloads the verified MediaPipe model. You do not need an API key or camera for ordinary viewer work.

Open an issue describing the concrete behavior before a large change. For bug reports include browser/OS, steps, expected behavior, and console errors with private filenames removed. Share only models you have permission to redistribute. Camera footage is not required.

Keep camera ownership, tracking, pure gesture recognition, and rendering separate. High-frequency frames belong outside React state. Gesture changes must include temporal regression tests and a manual release/tracking-loss check. Every interaction needs a reliable mouse fallback. Do not add remote model loading, analytics, or recording by default.

Before submitting:

```sh
npm run format
npm run lint
npm test
```

Install Playwright Chromium with `npx playwright install chromium` where needed. `npm test` runs unit/component tests, a production build, and browser tests. If hardware testing is unavailable, say so in the pull request. Do not describe mock-based tests as physical webcam validation.

Describe the user-visible change, its rationale, test results, and remaining limitations. Include actual before/after screenshots for interface changes. Keep the original demo source and exported GLB synchronized with `npm run assets:demo`. Update provenance when adding assets.

By contributing, you agree to license your contributions under the project's MIT license and to follow the code of conduct.
