import { describe, it, expect } from 'vitest';
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

describe('SSR dispose safety', () => {
  it('dispose does not throw when window is undefined (SSR path)', () => {
    // Ensure window is undefined in this test file (Vitest node env)
    expect(typeof (globalThis as any).window).toBe('undefined');
    const cam = new FakePerspectiveCamera() as any;
    // domElement is unused on SSR path but required by types
    const ctl = new CameraController({ camera: cam, domElement: {} as any, width: 800, height: 600 });
    expect(() => ctl.dispose()).not.toThrow();
  });
});

