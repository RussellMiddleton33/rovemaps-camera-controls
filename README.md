# ThreeJS RoveMaps Camera Controls (WIP)

Quick links
- Live Demo: https://russellmiddleton33.github.io/rovemaps-camera-controls/demo/
- Documentation: https://russellmiddleton33.github.io/rovemaps-camera-controls/

Drop-in GL JS camera controls for Three.js scenes with (jumpTo/easeTo/flyTo/fitBounds, pan/zoom/rotate/pitch/roll, around-point, padding/offset, events, inertia, reduced motion).

Recent changes:


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

- Maping Camera For Three.JS with camera API, gestures, events, inertia, and semantics.
- Projection-agnostic design with a Planar helper first; optional spherical/globe.
- SSR hardened; 
-Next.js examples (Pages and App Router) with ResizeObserver wiring.

## Repository Structure

- `src/core`: controller, event system
- `src/transform`: interfaces + ThreePlanarTransform
- `src/helpers`: projection-specific camera helpers
- `src/handlers`: input handlers + manager (TBD)
- `src/util`: math, easing, browser, dom helpers
- `examples/`: Next.js stubs
- `tests/`: unit tests (vitest)

# Test Commands
npm run -s typecheck
npm run -s test

## Publish Commands

git status -sb
git add -A
git commit -m 'Fix Errors'
git push origin HEAD:main

## Updating NPM


 Make sure you're logged into npm first (npm whoami to check).

 # Update version
  npm version 0.3.0

  # Publish to npm (will auto-run typecheck, tests, and build)
  npm publish

  # Push version tag to GitHub
  git push && git push --tags

## Roadmap

- M6: Optional spherical/globe projection

## Types & Packaging

- ESM + CJS with types, `sideEffects:false`, `three` as peerDependency.
- Strict TS; no `any` in public APIs.

## License

MIT

## Notes on Parity, Anchoring, and Inertia (Ongoing)


**Open Issues (Touch)**

