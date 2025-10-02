import { describe, it, expect } from 'vitest';
import type { ITransform, Padding } from '../src/transform/interfaces';

const DEG = Math.PI / 180;

function vec3(x: number, y: number, z: number) { return { x, y, z }; }
function add(a: any, b: any) { return vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a: any, b: any) { return vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
function dot(a: any, b: any) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: any, b: any) { return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
function mul(a: any, s: number) { return vec3(a.x * s, a.y * s, a.z * s); }
function norm(a: any) { const l = Math.hypot(a.x, a.y, a.z); return l ? mul(a, 1 / l) : vec3(0, 0, 0); }

class PerspectiveStubTransform implements ITransform {
  width: number; height: number; devicePixelRatio = 1;
  center = { x: 0, y: 0, z: 0 };
  zoom = 6; bearing = 0; pitch = 0; roll = 0;
  padding: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
  fovDeg = 60;
  get worldSize() { return Math.pow(2, this.zoom) * 256; }
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  setViewport(v: { width: number; height: number; devicePixelRatio?: number; }): void { this.width = v.width; this.height = v.height; if (v.devicePixelRatio) this.devicePixelRatio = v.devicePixelRatio; }
  setPadding(p: Partial<Padding>): void { this.padding = { ...this.padding, ...p }; }
  setCenter(c: { x: number; y: number; z?: number }): void { this.center = { x: c.x, y: c.y, z: c.z ?? 0 }; }
  setZoom(z: number): void { this.zoom = z; }
  setBearing(b: number): void { this.bearing = b; }
  setPitch(p: number): void { this.pitch = p; }
  setRoll(r: number): void { this.roll = r; }
  setConstraints(): void {}
  clamp(): void {}

  private cameraState() {
    const s = Math.pow(2, this.zoom);
    const worldHeight = this.height / s;
    const dist = (worldHeight / 2) / Math.tan((this.fovDeg * DEG) / 2);
    const target = vec3(this.center.x, 0, this.center.y);
    const br = this.bearing * DEG;
    const pr = this.pitch * DEG;
    const horiz = dist * Math.sin(pr);
    const y = dist * Math.cos(pr);
    const ox = horiz * Math.sin(br);
    const oz = horiz * Math.cos(br);
    const C = vec3(target.x + ox, y, target.z + oz);
    // Basis
    const F = norm(sub(target, C));
    const up = vec3(0, 1, 0);
    let R = norm(cross(up, F));
    let U = cross(F, R);
    if (this.roll !== 0) {
      const rr = this.roll * DEG;
      // rotate R and U around F by rr
      // Rodrigues' rotation formula
      const k = F; const cos = Math.cos(rr), sin = Math.sin(rr);
      const rot = (v: any) => add(add(mul(v, cos), mul(cross(k, v), sin)), mul(k, dot(k, v) * (1 - cos)));
      R = rot(R); U = rot(U);
    }
    const f = (this.height / 2) / Math.tan((this.fovDeg * DEG) / 2);
    return { C, R, U, F, f };
  }

  worldToScreen(world: { x: number; y: number; z?: number } | any): { x: number; y: number } | null {
    const P = vec3(world.x, 0, (world.z ?? world.y));
    const { C, R, U, F, f } = this.cameraState();
    const PC = sub(P, C);
    const x = dot(PC, R);
    const y = dot(PC, U);
    const z = -dot(PC, F);
    // Be tolerant near horizon/degenerate view; clamp to near plane epsilon
    const zp = z <= 1e-6 ? 1e-6 : z;
    const sx = (x * f) / zp + this.width / 2;
    const sy = (-y * f) / zp + this.height / 2;
    return { x: sx, y: sy };
    }

  screenToWorld(screen: { x: number; y: number }): { x: number; y: number } | null {
    const { C, R, U, F, f } = this.cameraState();
    const nx = screen.x - this.width / 2;
    const ny = -(screen.y - this.height / 2);
    // Ray in camera space direction
    const dCam = norm(vec3(nx / f, ny / f, 1));
    // Convert to world dir
    const dWorld = add(add(mul(R, dCam.x), mul(U, dCam.y)), mul(F, -dCam.z));
    // Intersect with ground plane y=0: C.y + t*d.y = 0 => t = -C.y/d.y
    if (Math.abs(dWorld.y) < 1e-6) return null;
    const t = -C.y / dWorld.y;
    const hit = add(C, mul(dWorld, t));
    return { x: hit.x, y: hit.z };
  }
}

describe('around-point invariants with perspective stub', () => {
  it('keeps world point under cursor ≤1px during rotate and pitch', () => {
    const t = new PerspectiveStubTransform(1024, 768);
    const pointer = { x: 480, y: 360 };
    t.setCenter({ x: 10, y: 5 });
    t.setZoom(8);
    t.setBearing(25);
    t.setPitch(45);
    const world = t.screenToWorld(pointer)!;
    // Apply rotate by +20 and compensate via pan (iterate to converge)
    t.setBearing(t.bearing + 20);
    const s = Math.pow(2, t.zoom);
    for (let i = 0; i < 8; i++) {
      const sp1 = t.worldToScreen(world)!; const dx1 = sp1.x - pointer.x; const dy1 = sp1.y - pointer.y;
      t.setCenter({ x: t.center.x - dx1 / s, y: t.center.y + dy1 / s });
      const drift = Math.hypot((t.worldToScreen(world)!.x - pointer.x), (t.worldToScreen(world)!.y - pointer.y));
      if (drift <= 1.0) break;
    }
    const driftRot = Math.hypot((t.worldToScreen(world)!.x - pointer.x), (t.worldToScreen(world)!.y - pointer.y));
    expect(driftRot).toBeLessThanOrEqual(1.0);
    // Apply pitch by -10 and compensate via pan (iterate)
    t.setPitch(t.pitch - 10);
    for (let i = 0; i < 8; i++) {
      const sp2 = t.worldToScreen(world)!; const dx2 = sp2.x - pointer.x; const dy2 = sp2.y - pointer.y;
      t.setCenter({ x: t.center.x - dx2 / s, y: t.center.y + dy2 / s });
      const drift = Math.hypot((t.worldToScreen(world)!.x - pointer.x), (t.worldToScreen(world)!.y - pointer.y));
      if (drift <= 1.0) break;
    }
    const driftPitch = Math.hypot((t.worldToScreen(world)!.x - pointer.x), (t.worldToScreen(world)!.y - pointer.y));
    expect(driftPitch).toBeLessThanOrEqual(1.0);
  });
});
