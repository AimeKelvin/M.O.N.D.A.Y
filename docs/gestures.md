# Gesture recognition and interaction

Recognition is temporal. `handFeatures()` estimates finger extension from joint alignment and tip distance relative to the wrist. Pinch distance is thumb-tip to index-tip distance divided by wrist-to-middle-MCP distance. This supports different apparent hand sizes; the geometry still depends on viewpoint and detector quality.

The image x coordinate is mirrored once in the tracking adapter. The video uses CSS mirroring and overlay coordinates are drawn without a second mirror. Handedness comes from MediaPipe's unmirrored input; outputs are sorted to stabilize hand order.

| State   | Entry                                                     | Sustain / exit                                                                            | Output                                  |
| ------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Rotate  | One open palm for 160 ms                                  | All four fingers remain extended; a slightly looser sustain threshold avoids pose flicker | Relative palm-center delta              |
| Move    | One hand, normalized pinch below 0.29 for 160 ms          | Release at 0.44 or above                                                                  | Relative pinch-midpoint delta           |
| Zoom    | Two pinches, span above 0.12, stable 220 ms               | Both remain below 0.44                                                                    | Logarithmic change in hand separation   |
| Inspect | Index extended, other three fingers folded, stable 280 ms | Pointing remains valid                                                                    | Index fingertip projected into viewport |
| Neutral | No valid intentional pose                                 | Requires stable re-entry                                                                  | Zero deltas                             |

Priority is two-hand zoom, one-hand pinch, pointing, open palm, neutral. Two hands that are not both pinched force neutral. A second hand never silently becomes one-hand manipulation. The first invalid frame stops motion; pinch hysteresis reduces flicker near release without introducing release latency.

The first active frame establishes a baseline and produces no motion. Hand identity changes, gaps over 180 ms, and per-frame jumps above 0.18 normalized units trigger reacquisition. Zoom span jumps above 0.2 also stop. Movement uses speed-adaptive filtering of palm/pinch positions and logarithmic hand separation. Still hands receive more smoothing; deliberate motion raises the filter cutoff to reduce lag. Pointer coordinates use the same adaptive filter. Two-hand motion uses the midpoint of both hands, so detector ordering cannot introduce a discontinuity. The render loop distributes each measured delta across display frames with frame-rate-independent exponential easing. It never predicts motion or replays a detection. Release, stale input, mouse manipulation, dialogs, and reset discard pending interpolation immediately rather than allowing it to coast. Reduced-motion preferences bypass render interpolation and explosion easing. Large zoom increments and final camera distance are clamped.

Rotation uses camera up/right axes. Translation uses camera right/up and the current frustum's visible height, so motion stays in the viewing plane at different zoom levels. Zoom dollies the camera about the OrbitControls target. Pointing casts a ray through normalized viewport coordinates; a further 300 ms dwell on the same mesh selects it. Hidden objects and their descendants are excluded.

The guide is a positioning and gesture exercise, not biometric calibration. It asks for a visible hand, open palm, pinch, and release, each sustained for 900 ms. It stores no biometric measurements. Sensitivity and smoothing are manual session settings.

Check `GestureRecognizer.test.ts` before changing thresholds. Add multi-frame regression sequences for transitions and conflicts. Tests establish deterministic mechanics, not hand detection accuracy. Test actual left/right hands, orientations, light levels, and camera latencies before changing release behavior.
