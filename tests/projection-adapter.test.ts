/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createController } from '../src/index';
import type { CameraController } from '../src/core/cameraController';
import type { ProjectionAdapter } from '../src/transform/interfaces';

describe('Projection Adapter', () => {
  let camera: THREE.PerspectiveCamera;
  let canvas: HTMLCanvasElement;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  test('uses custom projection for coordinate conversion', () => {
    const mockProjection: ProjectionAdapter = {
      project: vi.fn((lngLat: [number, number]) => {
        // Mock Mercator-like projection
        return { x: lngLat[0] * 1000, y: lngLat[1] * 1000 };
      }),
      unproject: vi.fn((point: { x: number; y: number }) => {
        return [point.x / 1000, point.y / 1000] as [number, number];
      }),
      lngLatToScene: vi.fn((lng: number, lat: number, z?: number) => {
        return [lng * 1000, lat * 1000, z ?? 0] as [number, number, number];
      }),
      sceneToLngLat: vi.fn((x: number, y: number) => {
        return [x / 1000, y / 1000] as [number, number];
      })
    };

    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      projection: mockProjection
    });

    // Access transform to test projection methods
    const transform = controller.transform as any;

    // Test projectLngLat
    const projected = transform.projectLngLat([10, 20]);
    expect(projected.x).toBe(10000);
    expect(projected.y).toBe(20000);

    // Test unprojectPoint
    const unprojected = transform.unprojectPoint({ x: 5000, y: 8000 });
    expect(unprojected[0]).toBe(5);
    expect(unprojected[1]).toBe(8);

    controller.dispose();
  });

  test('falls back to simple planar without projection', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      baseScale: 100 // Simple scale factor
    });

    const transform = controller.transform as any;

    // Test projectLngLat with base scale
    const projected = transform.projectLngLat([10, 20]);
    expect(projected.x).toBe(1000); // 10 * 100
    expect(projected.y).toBe(2000); // 20 * 100

    // Test unprojectPoint
    const unprojected = transform.unprojectPoint({ x: 500, y: 800 });
    expect(unprojected[0]).toBe(5);   // 500 / 100
    expect(unprojected[1]).toBe(8);   // 800 / 100

    controller.dispose();
  });

  test('projection adapter integrates with camera movements', () => {
    const scale = 1000;
    const mockProjection: ProjectionAdapter = {
      project: (lngLat: [number, number]) => ({ x: lngLat[0] * scale, y: lngLat[1] * scale }),
      unproject: (point: { x: number; y: number }) => [point.x / scale, point.y / scale] as [number, number]
    };

    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      projection: mockProjection,
      upAxis: 'z' // Use Z-up for clearer testing
    });

    // Jump to a position
    controller.jumpTo({ center: { x: 1000, y: 2000 }, zoom: 15 });

    // Verify camera is positioned correctly
    const state = controller.getStateSnapshot();
    expect(state.center.x).toBe(1000);
    expect(state.center.y).toBe(2000);

    controller.dispose();
  });
});
