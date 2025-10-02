# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript library providing MapLibre GL JS-compatible camera controls for Three.js scenes. Offers drop-in map-style camera API (jumpTo/easeTo/flyTo/fitBounds) with gestures, events, inertia, and projection-agnostic design.

## Essential Commands

```bash
# Development
npm run build        # Build ESM + CJS with tsup
npm run typecheck    # Type check without emit
npm run test         # Run all tests with vitest
npm run lint         # Run ESLint
npm run format       # Format with Prettier

# Documentation
npm run docs:dev     # Start VitePress dev server
npm run docs:build   # Build documentation
npm run docs:preview # Preview built docs

# Testing specific files
npm test -- tests/flight.test.ts        # Run single test file
npm test -- --watch                     # Watch mode
```

## Architecture Overview

### Core Components

**CameraController** (`src/core/cameraController.ts`)
- Main entry point; orchestrates transform, helper, and handlers
- Implements camera methods: `jumpTo()`, `easeTo()`, `flyTo()`, `fitBounds()`
- Event system via `Evented` base class
- Animation loop management with RAF and frame events
- SSR-safe guard for Next.js compatibility

**ThreePlanarTransform** (`src/transform/threePlanarTransform.ts`)
- State container: center `{x, y, z}`, zoom, bearing, pitch, roll, padding
- Applies state to Three.js camera matrices (position, quaternion, projection)
- `deferApply()` pattern for batched updates
- Zoom modes: `fov` (perspective) or `dolly` (ortho)
- Ground raycasting for screen-to-world coordinate mapping

**PlanarCameraHelper** (`src/helpers/planarCameraHelper.ts`)
- Projection-specific camera operations
- Pan mapping: rotates screen deltas by bearing before applying to ground
- Binary search for `fitBounds()` zoom calculation
- Designed for future spherical/globe projection extension (interface in `icameraHelper.ts`)

**HandlerManager** (`src/handlers/handlerManager.ts`)
- Registers and coordinates input handlers:
  - `ScrollZoomHandler`: Wheel/trackpad zoom with anchor-to-pointer
  - `MousePanHandler`: Left-drag pan, optional right-drag pan
  - `MouseRotatePitchHandler`: Right-drag rotate+pitch (dx/dy)
  - `TouchMultiHandler`: Multi-touch pan/pinch/rotate/pitch
  - `SafariGestureHandler`: Native Safari gesturestart/gesturechange events
  - `KeyboardHandler`: Arrow keys for pan/zoom/rotate
  - `DblclickHandler`: Double-click zoom
  - `BoxZoomHandler`: Shift+drag box zoom
- Context menu suppression for uninterrupted gestures
- Global `anchorTightness` option (0-1) for pointer-lock strength

### Key Patterns

**Pointer Anchoring**
- Ground-based anchoring: tracks world point under pointer/centroid
- Preserves screen position via `setLocationAtPoint(screenPt, groundPt)` during zoom/rotate/pitch
- `anchorTightness` parameter (default 1.0): `0` = no correction, `1` = perfect lock
- Eliminates drift on trackpad pinch/twist gestures

**Inertia in Ground Space**
- Maps last screen velocity to ground velocity (accounts for bearing + scale)
- Applies updates directly in world coordinates to avoid axis reversal
- Direction-aware damping respects invert toggles (Pan-Y, Inertia-X/Y)

**Sign Inversion Toggles**
- Exposed in demo: Invert Zoom, Pitch, Twist, Pan-Y, Inertia-X, Inertia-Y
- Allows per-platform/per-device calibration (macOS trackpad vs external mouse)
- Not yet formalized as library options (planned "platform profiles")

**Deferred Apply Pattern**
```typescript
transform.deferApply(() => {
  transform.setZoom(newZoom);
  transform.setBearing(newBearing);
  transform.setPitch(newPitch);
}); // Camera updated once after all changes
```

### Data Flow

```
User Input → Handler (screen coords)
           ↓
Ground Anchoring (screen→world raycasting)
           ↓
Transform State Updates (center, zoom, bearing, pitch, roll)
           ↓
Apply to Camera (position, quaternion, projection matrix)
           ↓
Render Frame Event
```

## Coordinate System

- **World Space**: Planar projection with configurable up-axis (`y` or `z`-up)
- **Zoom**: Semantic zoom level (0 = world size 256, each +1 doubles world size)
- **Bearing**: Rotation in degrees (0 = north)
- **Pitch**: Tilt in degrees (0 = top-down, 85 = near-horizon)
- **Roll**: Camera roll in degrees
- **Screen-to-World**: Raycast from NDC through camera to ground plane (y=0 or z=0)

## Testing Strategy

- **Unit tests** (`tests/*.test.ts`): Transform operations, easing, math utilities
- **Integration tests**: fitBounds, around-point anchoring, inertia, rubberband, cancelation
- **Flight path tests**: Van Wijk curve (currently using approximation; exact formula planned)
- Run `npm test` before feature work to ensure baseline passes

## File Structure

```
src/
├── core/
│   ├── cameraController.ts    # Main controller + animation loop
│   └── evented.ts              # Event system base class
├── transform/
│   ├── interfaces.ts           # ITransform, options, types
│   └── threePlanarTransform.ts # Planar projection transform
├── helpers/
│   ├── icameraHelper.ts        # Projection-agnostic interface
│   └── planarCameraHelper.ts   # Planar-specific operations
├── handlers/
│   ├── handlerManager.ts       # Coordinates all input handlers
│   ├── scrollZoomHandler.ts    # Wheel/trackpad zoom
│   ├── mousePanHandler.ts      # Mouse drag pan
│   ├── mouseRotatePitchHandler.ts  # Right-drag rotate+pitch
│   ├── touchMultiHandler.ts    # Multi-touch gestures
│   ├── safariGestureHandler.ts # Safari native gestures
│   ├── keyboardHandler.ts      # Arrow key navigation
│   ├── dblclickHandler.ts      # Double-click zoom
│   └── boxZoomHandler.ts       # Shift+drag box zoom
├── util/
│   ├── math.ts                 # Clamp, lerp, angle normalization
│   ├── easing.ts               # Easing functions (quad, cubic, expo)
│   ├── flight.ts               # Van Wijk flyTo curve
│   ├── browser.ts              # RAF/CAF, reduced motion detection
│   └── dom.ts                  # DOM helpers (mousePos, etc.)
└── public.ts                   # SSR-safe factory functions

tests/                          # Vitest unit/integration tests
docs/                           # VitePress documentation
examples/                       # Next.js integration examples
```

## Known Issues & Next Steps

**Touch Gestures (iOS)**
- Single-finger pan may exhibit resistance/counter-drift on some devices
- Two-finger pitch reliability varies; detection thresholds under review
- Planned: MapLibre-verbatim touch inertia aggregator, explicit visualViewport handling

**Flight Path Math**
- Currently uses approximation; exact MapLibre Van Wijk formula (rho/minZoom) planned
- Some flight tests use loosened tolerances as workaround

**Platform Defaults**
- Invert toggles currently demo-only; will become library options with platform profiles
- Default sign/anchor behavior for macOS trackpad vs mouse vs touch

**Anchor Policy**
- MapLibre defaults: wheel/dblclick zoom anchors to pointer, drag pan anchors to pointer, mouse rotate/pitch anchors to center
- Touch rotate anchors around centroid
- Library will lock these as defaults; rotate/pitch pointer-anchoring as opt-in

## SSR & Next.js

Use `createControllerForNext()` for SSR-safe initialization:
```typescript
import { createControllerForNext } from 'three-rovemaps-camera-controls';
const controller = createControllerForNext(() => ({ camera, domElement, width, height }));
```

Returns no-op stub on server; real controller on client.