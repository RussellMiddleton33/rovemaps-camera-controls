import type { Camera } from 'three';
import { CameraController } from './core/cameraController';

export type ControllerOptions = ConstructorParameters<typeof CameraController>[0];

export function createController(options: ControllerOptions) {
  return new CameraController(options);
}

// SSR-safe factory for Next.js
export function createControllerForNext(options: ControllerOptions | (() => ControllerOptions)) {
  if (typeof window === 'undefined') {
    return {
      // no-op stub API for server
      dispose() {},
      setViewport() {},
      isSSRStub: true as const,
    } as unknown as CameraController;
  }
  const resolved = typeof options === 'function' ? (options as () => ControllerOptions)() : options;
  return new CameraController(resolved);
}

export type { Camera };

