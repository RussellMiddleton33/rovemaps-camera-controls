import { describe, it, expect } from 'vitest';
// Lightweight DOM + RAF polyfill to avoid jsdom
const g: any = globalThis as any;
if (!g.window) {
  g.window = {
    requestAnimationFrame: (cb: any) => setTimeout(() => cb(performance.now()), 16),
    cancelAnimationFrame: (h: any) => clearTimeout(h),
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  };
}
if (!g.navigator) {
  g.navigator = { maxTouchPoints: 0 } as any;
}
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

describe('cancelation semantics', () => {
  it('starting a new ease cancels the previous and still emits *end events', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el });
    const seen: string[] = [];
    ctl.on('zoomstart', () => seen.push('zoomstart'));
    ctl.on('zoomend', () => seen.push('zoomend'));
    ctl.on('moveend', () => seen.push('moveend'));
    // Kick off a long ease
    ctl.easeTo({ zoom: 5, duration: 200 });
    // Shortly after, start a new ease
    await new Promise((r) => setTimeout(r, 30));
    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.easeTo({ zoom: 6, duration: 40 });
    });
    // We should still see a zoomend and a moveend by the time second ease ends
    expect(seen.filter((e) => e === 'zoomstart').length).toBeGreaterThanOrEqual(1);
    expect(seen).toContain('zoomend');
    expect(seen.lastIndexOf('moveend')).toBeGreaterThan(seen.indexOf('zoomend'));
  });
});
