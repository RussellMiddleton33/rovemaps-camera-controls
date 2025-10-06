## Handlers

### Scroll Zoom
- Trackpad vs wheel detection with `onWheelModeChange(mode)`
- `around: 'center'|'pointer'` keeps target under cursor during zoom
- Inertia smoothing with reduced tiny deltas on high-DPR devices

### Mouse Pan / Rotate / Pitch
- Pan: left drag with rubberband resistance near pan bounds and inertia
- Rotate: right drag; `around: 'pointer'` preserves world point under cursor
- Pitch: Shift + drag; `around: 'pointer'` preserves world point

### Touch (Two-finger)
- Pinch (zoom) + rotate: locks mode and preserves centroid when `around: 'pinch'`
- Two-finger pitch: vertical movement maps to pitch; centroid preserved
- Rubberband resistance during pan mode and during inertia

#### Rotation Sensitivity
- `touch.rotateStartThresholdDeg`: degrees to START rotation; higher = less sensitive (default: `1.0`).
- `touch.rotateContinueThresholdDeg`: degrees to CONTINUE rotation after it has started (default: `0.5` or `touch.rotateThresholdDeg` if provided).
- `touch.rotateDebounceMs`: suppress rotation for the first N ms of a two‑finger gesture, letting zoom establish first (default: `100`).

Example:

```ts
new HandlerManager(el, transform, helper, {
  touch: {
    rotateStartThresholdDeg: 1.0,
    rotateContinueThresholdDeg: 0.5,
    rotateDebounceMs: 100,
  },
});
```

### Keyboard
- Arrow pan, +/- zoom, Q/E rotate, PageUp/Down pitch

### Dblclick / Double-tap, Box Zoom
- Dblclick/tap zoom around pointer; Shift invert
- Box zoom with Shift + drag; fit bounds via projection-based solver
