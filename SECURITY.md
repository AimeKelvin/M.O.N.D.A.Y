# Security policy

The current maintained release is the version in package.json. Use the latest fixes and a current browser. MONDAY processes imported graphics and webcam frames locally; it does not require a backend, account, analytics, or remote assets at runtime.

Report vulnerabilities through the repository host's private vulnerability reporting feature when enabled, or contact a listed maintainer privately. Include the affected revision, browser, minimal reproduction, impact, and a harmless sample when possible. Do not put exploit payloads, private models, or camera images in public issues. Before public launch, the repository owner should enable private vulnerability reporting and provide a private reporting contact.

Model inputs are untrusted. File/memory/geometry/image limits, resource URL restrictions, hierarchy validation, and texture header inspection are defense in depth. They are not a complete security audit or a guarantee against browser/decoder vulnerabilities. Keep Three.js, MediaPipe, browsers, and build dependencies current.

The production Content Security Policy blocks off-origin requests and framing. The WASM-specific evaluation permission supports MediaPipe without enabling arbitrary JavaScript evaluation. Camera permission is scoped to this origin; microphone and location are disabled. Imported metadata is rendered as text.

The build downloads a versioned model and checks its SHA-256; npm dependency versions and integrity hashes are locked. Track third-party licenses in THIRD_PARTY_NOTICES.md. No secrets or environment variables are required.
