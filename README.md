# ThreeJS RoveMaps Camera Controls (WIP)

Drop-in GL JS camera controls for Three.js scenes with (jumpTo/easeTo/flyTo/fitBounds, pan/zoom/rotate/pitch/roll, around-point, padding/offset, events, inertia, reduced motion).


- In progress / next up:
- Not started (planned):
  - Globe/spherical projection helper.
  

## Quick Start (conceptual)

- Install: `npm i three three-rovemaps-camera-controls` (WIP)
- Use:

```ts
import { createController } from 'three-rovemaps-camera-controls';
const controller = createController({ camera, domElement, width, height });
controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 2 });
```

SSR/Next.js:

```ts
import { createControllerForNext } from 'three-rovemaps-camera-controls';
const controller = createControllerForNext(() => ({ camera, domElement }));
```

## Goals

- Maping parity for camera API, gestures, events, inertia, and semantics.
- Projection-agnostic design with a Planar helper first; optional spherical/globe.
- SSR hardened; Next.js examples (Pages and App Router) with ResizeObserver wiring.

## Repository Structure

- `src/core`: controller, event system
- `src/transform`: interfaces + ThreePlanarTransform
- `src/helpers`: projection-specific camera helpers
- `src/handlers`: input handlers + manager (TBD)
- `src/util`: math, easing, browser, dom helpers
- `examples/`: Next.js stubs
- `tests/`: unit tests (vitest)

## Roadmap

- M1: Core abstractions (ITransform, Evented, utils) + PlanarCameraHelper stub
- M2: CameraController (jump/ease) + baseline handlers + examples
- M3: Full handlers (rotate/pitch/roll, touch, dbl/tap/box) + inertia
- M4: flyTo, fitBounds rigor, around-point invariants, cooperative gestures
- M5: Tests, docs, packaging; first beta
- M6: Optional spherical/globe projection

## Types & Packaging

- ESM + CJS with types, `sideEffects:false`, `three` as peerDependency.
- Strict TS; no `any` in public APIs.

## License

MIT
