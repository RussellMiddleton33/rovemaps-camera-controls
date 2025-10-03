import { describe, it, expect } from 'vitest';
import { ScrollZoomHandler } from '../src/handlers/scrollZoomHandler';
import type { ITransform, Padding } from '../src/transform/interfaces';

// Minimal transform stub: zoom change is enough to trigger onChange; anchoring won't be used.
class StubTransform implements ITransform {
  width = 800; height = 600; devicePixelRatio = 1;
  center = { x: 0, y: 0, z: 0 };
  zoom = 0; bearing = 0; pitch = 0; roll = 0;
  padding: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
  get worldSize() { return Math.pow(2, this.zoom) * 256; }
  setViewport(v: any) { this.width = v.width; this.height = v.height; if (v.devicePixelRatio) this.devicePixelRatio = v.devicePixelRatio; }
  setPadding(p: Partial<Padding>) { this.padding = { ...this.padding, ...p }; }
  setCenter(c: any) { this.center = { x: c.x, y: c.y, z: c.z ?? 0 }; }
  setZoom(z: number) { this.zoom = z; }
  setBearing(b: number) { this.bearing = b; }
  setPitch(p: number) { this.pitch = p; }
  setRoll(r: number) { this.roll = r; }
  setConstraints(): void {}
  getPanBounds() { return undefined; }
  deferApply<T>(fn: () => T): T { return fn(); }
  screenToWorld(): any { return null; }
  worldToScreen(): any { return null; }
  groundFromScreen(): any { return null; }
  adjustCenterByGroundDelta(): void {}
  getGroundCenter(): any { return { gx: this.center.x, gz: this.center.y }; }
  setGroundCenter(): any {}
  clamp(): void {}
}

function makeEl(): HTMLElement {
  const el = global.document!.createElement('div');
  (el as any).getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  return el as any;
}

// Provide minimal DOM/Window for wheel event dispatch
const g: any = globalThis as any;
if (!g.window) {
  g.window = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) } as any;
}
if (!g.document) {
  g.document = { createElement: (_: string) => ({ addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }) } as any;
}

describe('ScrollZoom inertia default is off', () => {
  it('does not schedule inertia by default (onChange fires once)', async () => {
    const el = makeEl();
    const t = new StubTransform();
    let count = 0;
    const handler = new ScrollZoomHandler(el, t as unknown as ITransform, {
      handleMapControlsPan() {},
      handleMapControlsRollPitchBearingZoom(tr: ITransform, _0: number, _1: number, _2: number, dz: number) {
        tr.setZoom(tr.zoom + dz);
      },
      handleJumpToCenterZoom() {}, handleEaseTo() {}, handleFlyTo() {}, handlePanInertia() {}, cameraForBoxAndBearing() { return { center: { x:0,y:0 }, zoom: 0, bearing: 0, pitch: 0 }; }
    } as any, { onChange: () => { count++; } });
    handler.enable();
    // Simulate wheel event
    const evt = { deltaY: -120, deltaMode: 0, preventDefault() {}, currentTarget: el, clientX: 100, clientY: 100 } as any;
    (handler as any)._onWheel(evt);
    // Allow any inertia frames to schedule (if they would)
    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(1);
    handler.destroy();
  });
});

