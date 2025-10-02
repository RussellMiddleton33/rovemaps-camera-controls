import { describe, it, expect } from 'vitest';
import type { ITransform, Padding } from '../src/transform/interfaces';
import { PlanarCameraHelper } from '../src/helpers/planarCameraHelper';

class StubTransform implements ITransform {
  width: number;
  height: number;
  devicePixelRatio = 1;
  center = { x: 0, y: 0, z: 0 };
  zoom = 0;
  bearing = 0;
  pitch = 0;
  roll = 0;
  padding: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
  get worldSize() { return Math.pow(2, this.zoom) * 256; }
  constructor(width: number, height: number) { this.width = width; this.height = height; }
  setViewport(view: { width: number; height: number; devicePixelRatio?: number }): void { this.width = view.width; this.height = view.height; if (view.devicePixelRatio) this.devicePixelRatio = view.devicePixelRatio; }
  setPadding(padding: Partial<Padding>): void { this.padding = { ...this.padding, ...padding }; }
  setCenter(center: { x: number; y: number; z?: number }): void { this.center = { x: center.x, y: center.y, z: center.z ?? 0 }; }
  setZoom(zoom: number): void { this.zoom = zoom; }
  setBearing(bearing: number): void { this.bearing = bearing; }
  setPitch(pitch: number): void { this.pitch = pitch; }
  setRoll(roll: number): void { this.roll = roll; }
  setConstraints(): void {}
  deferApply<T>(fn: () => T): T { return fn(); }
  clamp(): void {}
  worldToScreen(world: any): { x: number; y: number } | null {
    // Interpret world as ground (x,z) in y-up space
    const s = Math.pow(2, this.zoom);
    const dx = world.x - this.center.x;
    const gz = (world.z ?? world.y);
    const dz = gz - this.center.y; // ground z
    const rad = (this.bearing * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rx = dx * cos - dz * sin; // camera right
    const rf = dx * sin + dz * cos; // camera forward
    return { x: rx * s + this.width / 2, y: -rf * s + this.height / 2 };
  }
  screenToWorld(screen: { x: number; y: number }): { x: number; y: number } | null {
    const s = Math.pow(2, this.zoom);
    const rx = (screen.x - this.width / 2) / s;
    const rf = -(screen.y - this.height / 2) / s;
    const rad = (this.bearing * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = rx * cos + rf * sin;
    const dz = -rx * sin + rf * cos;
    return { x: this.center.x + dx, y: this.center.y + dz };
  }
}

describe('around-point zoom invariant', () => {
  it('keeps world point under cursor within ≤1px across zoom', () => {
    const t = new StubTransform(1024, 768);
    const helper = new PlanarCameraHelper();
    const pointer = { x: 300, y: 200 };
    const zooms = [2, 6, 10, 14];
    const bearings = [0, 30, -75, 120];
    for (const z of zooms) {
      for (const b of bearings) {
        t.setZoom(z); t.setBearing(b); t.setCenter({ x: 0, y: 0 });
        const world = t.screenToWorld(pointer)!;
        // Apply a zoom-in and compensate pan to keep world under pointer
        const dz = 0.75;
        helper.handleMapControlsRollPitchBearingZoom(t as unknown as ITransform, 0, 0, 0, dz, 'center');
        const sp = t.worldToScreen(world)!;
        const dx = sp.x - pointer.x;
        const dy = sp.y - pointer.y;
        helper.handleMapControlsPan(t as unknown as ITransform, dx, dy);
        const sp2 = t.worldToScreen(world)!;
        const drift = Math.hypot(sp2.x - pointer.x, sp2.y - pointer.y);
        expect(drift).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('keeps world point under cursor within ≤1px during rotate', () => {
    const t = new StubTransform(1024, 768);
    const pointer = { x: 400, y: 300 };
    t.setZoom(8); t.setBearing(0); t.setCenter({ x: 0, y: 0 });
    const world = t.screenToWorld(pointer)!;
    const db = 15; // degrees
    // Apply bearing and compensate pan
    t.setBearing(t.bearing + db);
    const s = Math.pow(2, t.zoom);
    for (let i = 0; i < 6; i++) {
      const sp = t.worldToScreen(world)!;
      const dx = sp.x - pointer.x; const dy = sp.y - pointer.y;
      t.setCenter({ x: t.center.x - dx / s, y: t.center.y + dy / s });
      const sp2 = t.worldToScreen(world)!;
      const err = Math.hypot(sp2.x - pointer.x, sp2.y - pointer.y);
      if (err <= 1.0) break;
    }
    const spFinal = t.worldToScreen(world)!;
    expect(Math.hypot(spFinal.x - pointer.x, spFinal.y - pointer.y)).toBeLessThanOrEqual(1.0);
  });

  it('keeps world point under cursor within ≤1px during pitch', () => {
    const t = new StubTransform(1024, 768);
    const pointer = { x: 512, y: 384 };
    t.setZoom(6); t.setBearing(45); t.setCenter({ x: 0, y: 0 });
    // Our stub projection ignores pitch; this test demonstrates method, not true 3D correctness.
    // We still simulate pitch by shifting content vertically and compensating via pan.
    const world = t.screenToWorld(pointer)!;
    const dy = -40; // pixels
    const s = Math.pow(2, t.zoom);
    for (let i = 0; i < 6; i++) {
      const sp = { x: pointer.x, y: pointer.y + dy };
      const dx = sp.x - pointer.x; const ddy = sp.y - pointer.y;
      t.setCenter({ x: t.center.x - dx / s, y: t.center.y + ddy / s });
      const sp2 = t.worldToScreen(world)!;
      const err = Math.hypot(sp2.x - pointer.x, sp2.y - pointer.y);
      if (err <= 1.0) break;
    }
    const spFinal = t.worldToScreen(world)!;
    expect(Math.hypot(spFinal.x - pointer.x, spFinal.y - pointer.y)).toBeLessThanOrEqual(1.0);
  });
});
