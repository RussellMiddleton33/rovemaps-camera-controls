import { describe, it, expect } from 'vitest';
import { PlanarCameraHelper } from '../src/helpers/planarCameraHelper';
import type { ITransform, Padding } from '../src/transform/interfaces';

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
  screenToWorld(): any { return null; }
  worldToScreen(world: any): { x: number; y: number } | null {
    // Simple rotated/translated/scale projection with origin at viewport center
    const s = Math.pow(2, this.zoom);
    const dx = (world.x - this.center.x);
    const dy = (world.y - this.center.y);
    const rad = (this.bearing * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const x = rx * s + this.width / 2;
    const y = -ry * s + this.height / 2;
    return { x, y };
  }
  clamp(): void {}
}

describe('PlanarCameraHelper.cameraForBoxAndBearing', () => {
  it('fits bounds within padded viewport and applies offset', () => {
    const t = new StubTransform(800, 600);
    const helper = new PlanarCameraHelper();
    const bounds = { min: { x: -100, y: -50 }, max: { x: 100, y: 50 } };
    const padding = { top: 20, right: 40, bottom: 20, left: 40 };
    const offset = { x: 50, y: -30 };
    const bearing = 30;
    const cam = helper.cameraForBoxAndBearing(t as unknown as ITransform, bounds, { padding, bearing, offset });
    // Apply returned state to stub and project corners
    t.setCenter(cam.center);
    t.setZoom(cam.zoom);
    t.setBearing(cam.bearing);
    const corners = [
      { x: bounds.min.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.max.y },
      { x: bounds.min.x, y: bounds.max.y },
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      const sp = t.worldToScreen({ x: c.x, y: c.y });
      minX = Math.min(minX, sp!.x); maxX = Math.max(maxX, sp!.x);
      minY = Math.min(minY, sp!.y); maxY = Math.max(maxY, sp!.y);
    }
    const viewW = t.width - (padding.left + padding.right);
    const viewH = t.height - (padding.top + padding.bottom);
    expect(maxX - minX).toBeLessThanOrEqual(viewW + 1);
    expect(maxY - minY).toBeLessThanOrEqual(viewH + 1);
  });
});

