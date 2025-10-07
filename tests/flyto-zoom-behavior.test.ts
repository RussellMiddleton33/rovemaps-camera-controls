import { describe, it, expect } from 'vitest';

// Minimal DOM polyfills
const g: any = globalThis as any;
if (!g.window) {
  g.window = {
    requestAnimationFrame: (cb: any) => setTimeout(() => cb(performance.now()), 16),
    cancelAnimationFrame: (h: any) => clearTimeout(h),
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    devicePixelRatio: 1,
  };
}
if (!g.navigator) g.navigator = { maxTouchPoints: 0 } as any;
if (!g.document) {
  g.document = {
    body: { appendChild() {} },
    createElement: (_tag: string) => ({
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      style: {},
    }),
  } as any;
}

import { CameraController } from '../src/core/cameraController';

class FakePerspectiveCamera {
  isPerspectiveCamera = true;
  fov = 60;
  position = { set: (_x: number, _y: number, _z: number) => {} };
  quaternion = { x: 0, y: 0, z: 0, w: 1 };
  lookAt(_x: number, _y: number, _z: number) {}
  rotateOnWorldAxis(_axis: any, _angle: number) {}
  updateProjectionMatrix() {}
  updateMatrixWorld() {}
}

function makeElement(): HTMLElement {
  const el = global.document!.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  global.document!.body.appendChild(el);
  return el;
}

describe('flyTo zoom behavior', () => {
  it('preserves zoom when zoom is omitted', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el, minZoom: -100, maxZoom: 100 });
    ctl.jumpTo({ center: { x: 0, y: 0 }, zoom: 3, bearing: 0, pitch: 30 });

    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.flyTo({ center: { x: 100, y: 50 }, duration: 30, curve: 1.4, speed: 1.2 });
    });
    expect(ctl.getZoom()).toBeCloseTo(3, 6);
  });

  it('clamps zoom to constraints when provided beyond maxZoom', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el, minZoom: -5, maxZoom: 3 });
    ctl.jumpTo({ center: { x: 0, y: 0 }, zoom: 2, bearing: 0, pitch: 30 });

    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.flyTo({ center: { x: 50, y: -20 }, zoom: 7, duration: 30, curve: 1.4, speed: 1.2 });
    });
    expect(ctl.getZoom()).toBeCloseTo(3, 6); // clamped to maxZoom
  });
});
