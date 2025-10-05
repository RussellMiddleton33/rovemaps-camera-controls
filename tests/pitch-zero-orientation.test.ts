import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createController } from '../src/index';
import type { CameraController } from '../src/core/cameraController';

describe('Pitch=0 orientation (no mirroring)', () => {
  let camera: THREE.PerspectiveCamera;
  let domElement: HTMLElement;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 50000);
    // Use SSR-like path (no jsdom), provide dummy element
    // Width/height are passed explicitly to controller
    domElement = {} as any;
  });

  test('Z-up: bearing 0 keeps north at top when pitch=0', () => {
    controller = createController({
      camera,
      domElement: domElement,
      width: 800,
      height: 600,
      upAxis: 'z',
    });

    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0, bearing: 0 });

    const north = new THREE.Vector3(0, 10, 0);
    const south = new THREE.Vector3(0, -10, 0);
    const ns = controller.transform.worldToScreen(north)!;
    const ss = controller.transform.worldToScreen(south)!;

    expect(ns.y).toBeLessThan(ss.y); // north appears higher on screen

    controller.dispose();
  });

  test('Z-up: bearing 180 flips north to bottom when pitch=0', () => {
    controller = createController({
      camera,
      domElement: domElement,
      width: 800,
      height: 600,
      upAxis: 'z',
    });

    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0, bearing: 180 });

    const north = new THREE.Vector3(0, 10, 0);
    const south = new THREE.Vector3(0, -10, 0);
    const ns = controller.transform.worldToScreen(north)!;
    const ss = controller.transform.worldToScreen(south)!;

    expect(ns.y).toBeGreaterThan(ss.y); // north appears lower on screen

    controller.dispose();
  });

  test('Y-up: bearing 0 keeps north at top when pitch=0', () => {
    controller = createController({
      camera,
      domElement: domElement,
      width: 800,
      height: 600,
      upAxis: 'y',
    });

    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0, bearing: 0 });

    // For Y-up, ground plane is XZ; north is +Z
    const north = new THREE.Vector3(0, 0, 10);
    const south = new THREE.Vector3(0, 0, -10);
    const ns = controller.transform.worldToScreen(north)!;
    const ss = controller.transform.worldToScreen(south)!;

    expect(ns.y).toBeLessThan(ss.y); // north appears higher on screen

    controller.dispose();
  });

  test('Y-up: bearing 180 flips north to bottom when pitch=0', () => {
    controller = createController({
      camera,
      domElement: domElement,
      width: 800,
      height: 600,
      upAxis: 'y',
    });

    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0, bearing: 180 });

    const north = new THREE.Vector3(0, 0, 10);
    const south = new THREE.Vector3(0, 0, -10);
    const ns = controller.transform.worldToScreen(north)!;
    const ss = controller.transform.worldToScreen(south)!;

    expect(ns.y).toBeGreaterThan(ss.y); // north appears lower on screen

    controller.dispose();
  });
});
