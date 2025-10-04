# Touch Pitch Control Debugging Log

## Problem Statement

**Issue:** Two-finger vertical drag gesture does NOT update camera pitch on iPhone
- **Expected:** Moving two fingers vertically together (up/down) should tilt the camera (change pitch)
- **Actual:** Two-finger gestures only zoom (pinch) and rotate (twist), pitch does not respond
- **Works on:** MapLibre GL JS with identical gesture
- **Fails on:** Our Three.js camera controls implementation

## MapLibre Implementation Analysis

### Architecture
MapLibre uses **separate independent handlers** that run concurrently:
- `TwoFingersTouchPitchHandler` - dedicated pitch handler
- `TwoFingersTouchZoomHandler` - zoom only
- `TwoFingersTouchRotateHandler` - rotate only

**Key file:** `maplibre_camera_controls/src/ui/handler/two_fingers_touch.ts`

### Pitch Detection Logic (Lines 286-334)
```typescript
_move(points: [Point, Point], center: Point | null, e: TouchEvent): HandlerResult | void {
    const vectorA = points[0].sub(this._lastPoints![0]);
    const vectorB = points[1].sub(this._lastPoints![1]);

    this._valid = this.gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
    if (!this._valid) return;

    this._lastPoints = points;
    this._active = true;
    const yDeltaAverage = (vectorA.y + vectorB.y) / 2;
    const degreesPerPixelMoved = -0.5;
    return {
        pitchDelta: yDeltaAverage * degreesPerPixelMoved
    };
}

gestureBeginsVertically(vectorA: Point, vectorB: Point, timeStamp: number): boolean | undefined {
    if (this._valid !== undefined) return this._valid;

    const threshold = 2;
    const movedA = vectorA.mag() >= threshold;
    const movedB = vectorB.mag() >= threshold;

    // neither finger has moved a meaningful amount, wait
    if (!movedA && !movedB) return;

    // One finger has moved and the other has not - timing gate
    if (!movedA || !movedB) {
        if (this._firstMove === undefined) {
            this._firstMove = timeStamp;
        }
        if (timeStamp - this._firstMove < ALLOWED_SINGLE_TOUCH_TIME) {
            return undefined; // still waiting
        } else {
            return false;
        }
    }

    const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
    return isVertical(vectorA) && isVertical(vectorB) && isSameDirection;
}

function isVertical(vector: Point): boolean {
    return Math.abs(vector.y) > Math.abs(vector.x);
}
```

**Critical MapLibre Features:**
1. **Returns `pitchDelta` directly** - no anchor point, no mode switching
2. **Timing gate:** 100ms window between first and second finger movement
3. **Per-finger movement check:** Both fingers must move ≥2px AND be more vertical than horizontal AND same Y direction
4. **Sensitivity:** -0.5 degrees per pixel (negative for natural direction)
5. **Initial orientation check:** If fingers start in vertical line (one above other), pitch is disabled

### Handler Manager Integration
**File:** `maplibre_camera_controls/src/ui/handler_manager.ts`

- Line 263-264: Pitch handler registered separately
- Line 490-493: All handler deltas are **merged** (pitch + zoom + rotate can all apply in same frame)
- Handlers run independently, all return their deltas, manager combines them

## Our Implementation Analysis

### Architecture
**File:** `src/handlers/touchMultiHandler.ts`

**Single unified handler** with mode switching:
- Uses PointerEvents (not TouchEvents)
- Tracks mode: `'idle' | 'pan' | 'zoomRotate'`
- Attempts to apply pitch concurrently with zoom/rotate

### Current Pitch Detection (Lines 255-270)
```typescript
// Per-finger movement vectors since last frame
const vA = this.lastP0 ? { x: p0.x - this.lastP0.x, y: p0.y - this.lastP0.y } : { x: 0, y: 0 };
const vB = this.lastP1 ? { x: p1.x - this.lastP1.x, y: p1.y - this.lastP1.y } : { x: 0, y: 0 };
const movedA = Math.hypot(vA.x, vA.y) >= 2;
const movedB = Math.hypot(vB.x, vB.y) >= 2;
const verticalA = Math.abs(vA.y) > Math.abs(vA.x);
const verticalB = Math.abs(vB.y) > Math.abs(vB.x);
const sameDir = (vA.y > 0) === (vB.y > 0);
const avgDy = (vA.y + vB.y) / 2;
const dpCand = -avgDy * (this.opts.pitchPerPx ?? 0.5);

// Pitch detection
let pitchStrong = this.opts.enablePitch && movedA && movedB && verticalA && verticalB && sameDir;
// Timing gate (effectively disabled with 999ms default)
if (this.opts.allowedSingleTouchTimeMs < 999 && !this.allowPitchThisGesture) pitchStrong = false;
```

## Attempted Fixes (Chronological)

### Attempt 1: Lower Pitch Threshold
**Date:** Initial attempt
**Change:** Reduced `pitchThresholdPx` from 14px → 5px
**Reasoning:** High threshold might prevent pitch detection
**Result:** ❌ Did not fix issue
**File:** Line 93

### Attempt 2: Increase Pitch Sensitivity
**Change:** Increased `pitchPerPx` from 0.25 → 0.5 deg/px to match MapLibre
**Reasoning:** Match MapLibre's exact sensitivity
**Result:** ❌ Did not fix issue
**File:** Line 89

### Attempt 3: Remove Timing Gate
**Change:** Set `allowedSingleTouchTimeMs` from 200ms → 999ms (effectively disabled)
**Reasoning:** Strict timing window might block legitimate pitch gestures
**Result:** ❌ Did not fix issue
**File:** Line 107

### Attempt 4: Allow Pitch During Zoom/Rotate Mode
**Change:** Removed mode exclusivity - pitch applies even when in `zoomRotate` mode
**Reasoning:** Original code only applied pitch in dedicated `pitch` mode, which was never entered
**Result:** ❌ Did not fix issue
**Code:**
```typescript
// Lines 286-290: Apply pitch independently of mode
if (pitchStrong && dpCand && this.opts.enablePitch) {
  this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dpCand, 0, 0, 'center');
  this.vp = dpCand / dt;
  axes.pitch = true;
}
```

### Attempt 5: Add Pitch to Mode Switching
**Change:** Added `pitchStrong` to mode transition condition
**Reasoning:** When only pitch detected (no zoom/rotate), mode stayed `idle` and nothing happened
**Result:** ❌ Did not fix issue
**Code:**
```typescript
// Line 276
if (zoomStrong || rotateStrong || pitchStrong) {
  this.mode = 'zoomRotate';
}
```

### Attempt 6: Remove Anchor Correction for Pitch
**Date:** Latest attempt
**Change:** Moved `groundBefore` calculation AFTER pitch application to prevent anchor correction from undoing pitch
**Reasoning:** Pitch changes viewing angle, so anchor-to-pointer was calculating wrong ground point and "correcting" it back, cancelling the pitch
**Result:** ❌ Did not fix issue
**Code:**
```typescript
// Lines 284-294
// PITCH: Apply independently WITHOUT anchor correction
if (pitchStrong && dpCand && this.opts.enablePitch) {
  this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dpCand, 0, 0, 'center');
  this.vp = dpCand / dt;
  axes.pitch = true;
}

// Calculate anchor point AFTER pitch (for zoom/rotate only)
const ptr = this.opts.around === 'pinch' ? center : null;
const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;
```

## Current State

### What Works
✅ Zoom (two-finger pinch)
✅ Rotate (two-finger twist)
✅ Single-finger pan
✅ Build compiles without errors
✅ All tests pass

### What Doesn't Work
❌ Two-finger vertical drag does NOT change pitch

## Key Differences Still Present

### 1. Event System
- **MapLibre:** Uses native `TouchEvent` API
- **Ours:** Uses `PointerEvent` API
- **Concern:** Pointer events might handle multi-touch differently?

### 2. Coordinate Tracking
- **MapLibre:** Uses `Point` class with `sub()`, `mag()`, `add()`, `div()` methods
- **Ours:** Uses plain objects `{ x, y }` with manual calculations
- **Concern:** Potential for calculation differences?

### 3. Touch Tracking
- **MapLibre:** Stores touch identifiers, looks them up each frame
- **Ours:** Uses `Map<pointerId, Pt>`
- **Concern:** PointerEvent IDs might not match TouchEvent identifiers?

### 4. Handler Registration
- **MapLibre:** Multiple handlers registered separately, deltas merged by manager
- **Ours:** Single handler with internal mode switching
- **Concern:** Might be missing something about gesture precedence?

### 5. Initial Finger Orientation Check
- **MapLibre:** Checks if fingers form vertical line at start (lines 280-283)
  ```typescript
  if (isVertical(points[0].sub(points[1]))) {
      this._valid = false; // disable pitch if fingers vertically aligned
  }
  ```
- **Ours:** No initial orientation check
- **Concern:** Missing validation step?

## ✅ Debug Overlay Added

**ENABLED:** On-screen debug overlay now available for mobile testing!

### How to Enable

Pass `showDebugOverlay: true` when creating the TouchMultiHandler:

```typescript
const touchHandler = new TouchMultiHandler(
  element,
  transform,
  helper,
  {
    showDebugOverlay: true  // Enable debug overlay
  }
);
touchHandler.enable();
```

### What the Overlay Shows

The debug overlay appears as a black panel in the top-left corner showing:

- **Mode**: Current gesture mode (idle/pan/zoomRotate)
- **Fingers**: Number of active touch points
- **Detection Status**:
  - `PitchStrong`: Whether pitch gesture is detected (✓ or ✗)
  - `ZoomStrong`: Whether zoom is detected
  - `RotateStrong`: Whether rotate is detected
- **Per-Finger Movement**:
  - Finger A: dx, dy, magnitude, vertical?
  - Finger B: dx, dy, magnitude, vertical?
  - Same direction? YES/NO
- **Calculated Deltas**:
  - Pitch delta (in degrees) + whether it was applied
  - Zoom delta
  - Rotation delta (in degrees)
- **Current Pitch**: The actual current pitch value from transform

### What to Look For

When moving two fingers vertically:
1. `PitchStrong` should show `YES ✓`
2. Both fingers should show `vert: YES`
3. `SAME DIR` should show `YES ✓`
4. `Pitch` delta should show non-zero value (e.g., `2.50°`)
5. **Most important**: Look for `✓ APPLIED` next to the pitch delta
6. `CURRENT PITCH` should change

If `pitchStrong = YES` but `✗ NOT APPLIED`, that tells us pitch is detected but not being applied!

## Debugging Next Steps

### 1. ✅ Visual Debug Overlay (COMPLETED)
On-screen overlay shows real-time gesture detection data

### 2. Compare Event Data
Log PointerEvent vs TouchEvent data:
- [ ] clientX/clientY values
- [ ] Pointer IDs vs Touch identifiers
- [ ] Event timing/frequency

### 3. Test MapLibre Conditions Exactly
- [ ] Implement MapLibre's `_valid` state machine
- [ ] Add initial finger orientation check
- [ ] Use MapLibre's exact timing constants (100ms vs 999ms)
- [ ] Implement `_firstMove` timing tracking

### 4. Verify Transform Updates
- [ ] Check if `handleMapControlsRollPitchBearingZoom()` actually modifies pitch
- [ ] Verify Three.js camera quaternion changes
- [ ] Check if pitch limits are blocking updates

### 5. Test Event Capture
- [ ] Verify `preventDefault()` is called appropriately
- [ ] Check if other handlers are intercepting touches
- [ ] Test with Safari dev tools remote debugging

## Code Locations

### Key Files
- **Our implementation:** `src/handlers/touchMultiHandler.ts`
- **MapLibre pitch handler:** `maplibre_camera_controls/src/ui/handler/two_fingers_touch.ts`
- **MapLibre handler manager:** `maplibre_camera_controls/src/ui/handler_manager.ts`

### Critical Line Numbers (Our Code)
- Line 89: `pitchPerPx: 0.5`
- Line 93: `pitchThresholdPx: 5`
- Line 107: `allowedSingleTouchTimeMs: 999`
- Lines 255-270: Pitch detection logic
- Lines 274-279: Mode switching
- Lines 284-290: Pitch application
- Lines 292-294: Anchor calculation (moved after pitch)

## Test Procedure

1. Open app on iPhone
2. Place two fingers on map (not in vertical line)
3. Move both fingers vertically together (up or down)
4. **Expected:** Camera pitch changes (map tilts)
5. **Actual:** No pitch change, only zoom/rotate if fingers not perfectly parallel

## Questions to Answer

1. Is `pitchStrong` being set to `true`? (needs logging)
2. Is `dpCand` non-zero? (needs logging)
3. Is `handleMapControlsRollPitchBearingZoom()` being called? (needs logging)
4. Is the transform's pitch value actually changing? (needs logging)
5. Is PointerEvent multi-touch fundamentally different from TouchEvent?
6. Are we missing preventDefault() somewhere that's allowing browser to handle gesture?
7. Is there a pitch clamp/limit preventing movement?
8. Does the Three.js camera helper actually support pitch changes?
