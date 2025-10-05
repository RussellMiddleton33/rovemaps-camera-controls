/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createController } from '../src/index';
import type { CameraController } from '../src/core/cameraController';

describe('Z-Up Coordinate System', () => {
  let camera: THREE.PerspectiveCamera;
  let canvas: HTMLCanvasElement;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  test('camera positioned above ground looking down with Z-up', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      upAxis: 'z'
    });

    // Use small non-zero pitch to test standard up vector (pitch=0 triggers special handling)
    controller.jumpTo({ center: { x: 0, y: 0, z: 0 }, zoom: 15, pitch: 0.1 });

    // Camera should be above ground (positive Z)
    expect(camera.position.z).toBeGreaterThan(0);
    // Camera up vector should be Z-axis
    expect(camera.up.z).toBe(1);
    expect(camera.up.x).toBe(0);
    expect(camera.up.y).toBe(0);

    controller.dispose();
  });

  test('camera positioned above ground looking down with Y-up (default)', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      upAxis: 'y' // explicit Y-up
    });

    // Use small non-zero pitch to test standard up vector (pitch=0 triggers special handling)
    controller.jumpTo({ center: { x: 0, y: 0, z: 0 }, zoom: 15, pitch: 0.1 });

    // Camera should be above ground (positive Y)
    expect(camera.position.y).toBeGreaterThan(0);
    // Camera up vector should be Y-axis
    expect(camera.up.y).toBe(1);
    expect(camera.up.x).toBe(0);
    expect(camera.up.z).toBe(0);

    controller.dispose();
  });

  test('Z-up: panning changes XY, not Z', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      upAxis: 'z',
      minZoom: 0,
      maxZoom: 20
    });

    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0 });
    const initialZ = camera.position.z;

    // Pan the camera
    controller.panBy({ x: 100, y: 100 });

    // Z position should remain the same (we're moving horizontally)
    // Allow small floating point error
    expect(Math.abs(camera.position.z - initialZ)).toBeLessThan(0.1);

    controller.dispose();
  });

  test('Z-up: pitch rotates camera angle, affecting Z height', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      upAxis: 'z',
      minPitch: 0,
      maxPitch: 85
    });

    // Start with bird's eye view (pitch=0)
    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 0 });
    const birdsEyeZ = camera.position.z;

    // Tilt camera (pitch=45)
    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 15, pitch: 45 });
    const tiltedZ = camera.position.z;

    // With pitch, camera should be lower (but still above ground)
    expect(tiltedZ).toBeLessThan(birdsEyeZ);
    expect(tiltedZ).toBeGreaterThan(0);

    controller.dispose();
  });

  test('Z-up: bearing rotates around Z axis', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      upAxis: 'z'
    });

    controller.jumpTo({ center: { x: 100, y: 100 }, zoom: 10, pitch: 45, bearing: 0 });
    const north = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    controller.jumpTo({ center: { x: 100, y: 100 }, zoom: 10, pitch: 45, bearing: 90 });
    const east = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    // With bearing change, X and Y should change, but Z should stay roughly the same
    expect(Math.abs(north.z - east.z)).toBeLessThan(1.0);
    // Position should have changed in XY plane (lower zoom = higher distance)
    const horizontalChange = Math.hypot(north.x - east.x, north.y - east.y);
    expect(horizontalChange).toBeGreaterThan(0.1);

    controller.dispose();
  });
});
