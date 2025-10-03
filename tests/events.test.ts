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

describe('CameraController events', () => {
  it('emits start/move/end around easeTo', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el, bearingSnap: 10 });
    const events: string[] = [];
    ctl.on('movestart', () => events.push('movestart'));
    ctl.on('zoomstart', () => events.push('zoomstart'));
    ctl.on('zoomend', () => events.push('zoomend'));
    ctl.on('moveend', () => events.push('moveend'));
    let zoomStartIsZooming = false;
    let zoomEndIsZooming = true;
    ctl.on('zoomstart', () => { zoomStartIsZooming = ctl.isZooming(); });
    ctl.on('zoomend', () => { zoomEndIsZooming = ctl.isZooming(); });
    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.easeTo({ zoom: 2, duration: 30 });
    });
    expect(events[0]).toBe('movestart');
    expect(events).toContain('zoomstart');
    const iStart = events.indexOf('zoomstart');
    const iEnd = events.indexOf('zoomend');
    const iMoveEnd = events.lastIndexOf('moveend');
    expect(iStart).toBeGreaterThanOrEqual(0);
    expect(iEnd).toBeGreaterThan(iStart);
    expect(iMoveEnd).toBeGreaterThan(iEnd);
    expect(zoomStartIsZooming).toBe(true);
    expect(zoomEndIsZooming).toBe(false);
  });

  it('bearingSnap snaps to 0 on rotate end within threshold', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el, bearingSnap: 7, bearingSnapEpsilon: 0.5 });
    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.easeTo({ bearing: 5, duration: 20 });
    });
    expect(Math.abs(ctl.getBearing())).toBeLessThanOrEqual(0.001);
  });

  it('bearingSnap handles wrap-around near 360/-0', async () => {
    const cam = new FakePerspectiveCamera() as any;
    const el = makeElement();
    const ctl = new CameraController({ camera: cam, domElement: el, bearingSnap: 7, bearingSnapEpsilon: 0.5 });
    await new Promise<void>((resolve) => {
      ctl.on('moveend', () => resolve());
      ctl.easeTo({ bearing: 359, duration: 20 });
    });
    expect(Math.abs(ctl.getBearing())).toBeLessThanOrEqual(0.001);
  });
});
