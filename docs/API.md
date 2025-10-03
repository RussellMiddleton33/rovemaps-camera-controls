## API Reference

### new CameraController(options)

Options:
- `camera`: THREE.PerspectiveCamera | THREE.OrthographicCamera
- `domElement`: HTMLElement to attach input handlers
- `width`, `height`, `devicePixelRatio`: initial viewport (optional)
- `projection`: 'planar' (default)
- `bearingSnap`: number (deg, default 7)
- `bearingSnapEpsilon`: number (deg, default 0.001)
- `handlers`: input handler config (see Handlers)
- `minZoom`, `maxZoom`, `minPitch`, `maxPitch`, `panBounds`: constraints

Methods:
- Query: `getCenter`, `getZoom`, `getBearing`, `getPitch`, `getRoll`, `getPadding`
- Setters: `setCenter`, `setZoom`, `setBearing`, `setPitch`, `setRoll`, `setPadding`, `setConstraints`
- Jump: `jumpTo(options)`
- Ease: `easeTo(options)` with `duration`, `easing`, `padding`, `offset`, `around`, `essential`
  - `easeTo` anchoring: when `around: 'pointer'`, provide `aroundPoint: {x,y}` and optional `anchorTightness` (0..1) to preserve the ground point under that screen coordinate across the ease.
- Fly: `flyTo(options)` with `curve` (rho), `speed`, `screenSpeed`, `maxDuration`
- Fit: `fitBounds(bounds, options)`, `cameraForBounds(bounds, options)`
- Zoom: `zoomTo`, `zoomIn`, `zoomOut`
- Rotate/Pitch/Roll: `rotateTo/By`, `pitchTo/By`, `rollTo/By`
- Lifecycle: `dispose`, `setViewport`

All events include `{ originalEvent?: Event }` when gesture-driven.

- `movestart`, `move`, `moveend`
- `zoomstart`, `zoom`, `zoomend`
- `rotatestart`, `rotate`, `rotateend`
- `pitchstart`, `pitch`, `pitchend`
- `rollstart`, `roll`, `rollend`
- `dragstart`, `drag`, `dragend`
- `renderFrame`: `{}`
- `error`: `{ error: Error }`

### Handlers config (handlers)

- `scrollZoom?: { around?: 'center'|'pointer', maxDeltaPerEvent?: number, preventDefault?: boolean, onWheelModeChange?, onChange?, cooperative?: boolean, onCoopGestureHint? } | boolean`
  - `zoomInertia?: boolean` (default false) to enable post-wheel momentum-like zoom.
- `touch?: { enablePan?: boolean, enableZoom?: boolean, enableRotate?: boolean, enablePitch?: boolean, around?: 'center'|'pinch', pitchPerPx?: number, rotateThresholdDeg?: number, pitchThresholdPx?: number, zoomThreshold?: number, rubberbandStrength?: number } | boolean`
- `keyboard?: { panStepPx?: number, zoomDelta?: number, rotateStepDeg?: number, pitchStepDeg?: number, preventDefault?: boolean } | boolean`
- `dblclick?: { zoomDelta?: number, invertWithShift?: boolean, around?: 'center'|'pointer' } | boolean`
- `boxZoom?: { triggerModifier?: 'shift', minAreaPx?: number } | boolean`
- `rubberbandStrength?: number` (global damping strength for pan rubberband)

### Method Option Details

`jumpTo`, `easeTo`, `flyTo`, `fitBounds`, `cameraForBounds` share common fields for `center`, `zoom`, `bearing`, `pitch`, `roll`, and `padding`.

- `easeTo` extras: `duration`, `easing`, `animate`, `essential`, `around`, `offset` (in rotated screen-space)
- `flyTo` extras: `curve` (rho), `speed`, `screenSpeed`, `maxDuration`, `minZoom` (reserved)
- `fitBounds` extras: `padding`, `offset`, `bearing` (override)
