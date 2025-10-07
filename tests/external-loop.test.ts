import { describe, it, expect, beforeEach, vi } from 'vitest';

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
      clientWidth: 800,
      clientHeight: 600,
    }),
  } as any;
}

import * as THREE from 'three';
import { CameraController } from '../src/core/cameraController';

describe('External Animation Loop', () => {
  let camera: THREE.PerspectiveCamera;
  let domElement: HTMLElement;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    domElement = document.createElement('div') as any;
  });

  describe('useExternalAnimationLoop option', () => {
    it('should not start internal RAF loop when useExternalAnimationLoop is true', () => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

      controller.easeTo({ zoom: 5, duration: 100 });

      // Should not have called RAF (external code will call update())
      expect(rafSpy).not.toHaveBeenCalled();

      rafSpy.mockRestore();
      controller.dispose();
    });

    it('should start internal RAF loop when useExternalAnimationLoop is false', () => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: false,
      });

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

      controller.easeTo({ zoom: 5, duration: 100 });

      // Should have called RAF
      expect(rafSpy).toHaveBeenCalled();

      rafSpy.mockRestore();
      controller.dispose();
    });

    it('should default to internal RAF loop when option not specified', () => {
      controller = new CameraController({
        camera,
        domElement,
      });

      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

      controller.easeTo({ zoom: 5, duration: 100 });

      // Should have called RAF (default behavior)
      expect(rafSpy).toHaveBeenCalled();

      rafSpy.mockRestore();
      controller.dispose();
    });
  });

  describe('update() method', () => {
    beforeEach(() => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });
    });

    it('should advance easeTo animation when called', () => {
      const initialZoom = controller.getZoom();
      const targetZoom = 10;

      controller.easeTo({ zoom: targetZoom, duration: 100 });

      // Call update() to advance animation
      controller.update();

      // Zoom should have changed
      const currentZoom = controller.getZoom();
      expect(currentZoom).not.toBe(initialZoom);
      expect(currentZoom).not.toBe(targetZoom); // Not complete yet

      controller.dispose();
    });

    it('should complete easeTo animation after multiple update() calls', () => {
      const targetZoom = 10;
      const targetBearing = 45;

      controller.easeTo({ zoom: targetZoom, bearing: targetBearing, duration: 100 });

      // Simulate external loop calling update() every 16ms for ~150ms
      const startTime = performance.now();
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return startTime;
      });

      for (let i = 0; i < 10; i++) {
        vi.spyOn(performance, 'now').mockReturnValue(startTime + i * 16);
        controller.update();
      }

      // Animation should complete after duration
      vi.spyOn(performance, 'now').mockReturnValue(startTime + 150);
      controller.update();

      expect(controller.getZoom()).toBeCloseTo(targetZoom, 1);
      expect(controller.getBearing()).toBeCloseTo(targetBearing, 1);

      vi.restoreAllMocks();
      controller.dispose();
    });

    it('should advance flyTo animation when called', () => {
      const initialZoom = controller.getZoom();

      controller.flyTo({
        zoom: 10,
        center: { x: 1000, y: 1000 }, // Larger distance to ensure flyTo path
        duration: 100
      });

      // Advance time to middle of animation
      const startTime = performance.now();
      vi.spyOn(performance, 'now').mockReturnValue(startTime + 50);

      // Call update() to advance animation
      controller.update();

      // Zoom should have changed
      const currentZoom = controller.getZoom();
      expect(currentZoom).not.toBe(initialZoom);

      vi.restoreAllMocks();
      controller.dispose();
    });

    it('should do nothing when no animation is active', () => {
      const initialZoom = controller.getZoom();

      // Call update() with no active animation
      controller.update();

      // State should not change
      expect(controller.getZoom()).toBe(initialZoom);

      controller.dispose();
    });

    it('should return controller for chaining', () => {
      const result = controller.update();
      expect(result).toBe(controller);

      controller.dispose();
    });
  });

  describe('event handling with external loop', () => {
    beforeEach(() => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });
    });

    it('should fire movestart/moveend events', () => {
      const moveStartSpy = vi.fn();
      const moveEndSpy = vi.fn();

      controller.on('movestart', moveStartSpy);
      controller.on('moveend', moveEndSpy);

      controller.easeTo({ zoom: 10, duration: 50 });

      // movestart should fire immediately
      expect(moveStartSpy).toHaveBeenCalled();
      expect(moveEndSpy).not.toHaveBeenCalled();

      // Advance to completion
      const startTime = performance.now();
      vi.spyOn(performance, 'now').mockReturnValue(startTime + 100);
      controller.update();

      // moveend should fire after completion
      expect(moveEndSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
      controller.dispose();
    });

    it('should fire zoom events during animation', () => {
      const zoomSpy = vi.fn();

      controller.on('zoom', zoomSpy);

      controller.easeTo({ zoom: 10, duration: 100 });

      // Call update() multiple times
      for (let i = 0; i < 5; i++) {
        controller.update();
      }

      // zoom event should fire multiple times
      expect(zoomSpy.mock.calls.length).toBeGreaterThan(0);

      controller.dispose();
    });
  });

  describe('animation cancellation with external loop', () => {
    beforeEach(() => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });
    });

    it('should cancel animation when new animation starts', () => {
      controller.easeTo({ zoom: 10, duration: 100 });
      controller.update();

      const midZoom = controller.getZoom();

      // Start new animation
      controller.easeTo({ zoom: 5, duration: 100 });
      controller.update();

      // Should be animating toward new target, not old one
      const newZoom = controller.getZoom();
      expect(newZoom).not.toBe(midZoom);

      controller.dispose();
    });

    it('should clean up animation state on dispose', () => {
      controller.easeTo({ zoom: 10, duration: 100 });

      controller.dispose();

      // update() should do nothing after dispose
      const zoom = controller.getZoom();
      controller.update();
      expect(controller.getZoom()).toBe(zoom);
    });
  });

  describe('mixed internal/external animations', () => {
    it('should handle switching from internal to external loop', () => {
      // Start with internal loop
      let ctrl1 = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: false,
      });

      ctrl1.jumpTo({ zoom: 5 });
      ctrl1.dispose();

      // Switch to external loop
      let ctrl2 = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });

      ctrl2.easeTo({ zoom: 10, duration: 100 });
      ctrl2.update();

      expect(ctrl2.getZoom()).not.toBe(5);

      ctrl2.dispose();
    });
  });

  describe('animation completion', () => {
    beforeEach(() => {
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
      });
    });

    it('should apply bearing snap on rotation completion', () => {
      // Enable bearing snap explicitly for this test
      controller.dispose();
      controller = new CameraController({
        camera,
        domElement,
        useExternalAnimationLoop: true,
        bearingSnap: 7,
        bearingSnapEpsilon: 0.5,
      });
      controller.easeTo({
        bearing: 3, // Within snap range (default 7 degrees)
        duration: 50
      });

      // Advance to completion
      const startTime = performance.now();
      vi.spyOn(performance, 'now').mockReturnValue(startTime + 100);
      controller.update();

      // Should snap to 0
      expect(controller.getBearing()).toBeCloseTo(0, 1);

      vi.restoreAllMocks();
      controller.dispose();
    });

    it('should reach exact target values on completion', () => {
      const target = {
        zoom: 12.5,
        bearing: 45,
        pitch: 30,
      };

      controller.easeTo({ ...target, duration: 50 });

      // Advance past completion
      const startTime = performance.now();
      vi.spyOn(performance, 'now').mockReturnValue(startTime + 200);
      controller.update();

      expect(controller.getZoom()).toBeCloseTo(target.zoom, 2);
      expect(controller.getPitch()).toBeCloseTo(target.pitch, 2);

      vi.restoreAllMocks();
      controller.dispose();
    });
  });
});
