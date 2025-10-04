/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createController } from '../src/index';
import type { CameraController } from '../src/core/cameraController';

describe('Event Suppression', () => {
  let camera: THREE.PerspectiveCamera;
  let canvas: HTMLCanvasElement;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  test('silent option prevents events on jumpTo', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600
    });

    const moveHandler = vi.fn();
    const renderHandler = vi.fn();

    controller.on('move', moveHandler);
    controller.on('renderFrame', renderHandler);

    // Jump with silent option
    controller.jumpTo({ zoom: 10 }, { silent: true });

    // Events should not have fired
    expect(moveHandler).not.toHaveBeenCalled();
    expect(renderHandler).not.toHaveBeenCalled();

    controller.dispose();
  });

  test('normal setZoom fires renderFrame event', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600
    });

    const renderHandler = vi.fn();

    controller.on('renderFrame', renderHandler);

    // Set zoom directly, which triggers render
    controller.setZoom(10);

    // RenderFrame event should have fired
    expect(renderHandler).toHaveBeenCalled();

    controller.dispose();
  });

  test('global suppressEvents option prevents all events', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600,
      suppressEvents: true // Global suppression
    });

    const moveHandler = vi.fn();
    const zoomHandler = vi.fn();
    const renderHandler = vi.fn();

    controller.on('move', moveHandler);
    controller.on('zoom', zoomHandler);
    controller.on('renderFrame', renderHandler);

    // Perform various operations
    controller.jumpTo({ zoom: 10 });
    controller.setZoom(15);
    controller.setBearing(45);

    // No events should have fired
    expect(moveHandler).not.toHaveBeenCalled();
    expect(zoomHandler).not.toHaveBeenCalled();
    expect(renderHandler).not.toHaveBeenCalled();

    controller.dispose();
  });

  test('setStateSnapshot with silent option', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600
    });

    const moveHandler = vi.fn();

    controller.on('move', moveHandler);

    // Use setStateSnapshot with silent
    controller.setStateSnapshot({
      center: { x: 100, y: 200 },
      zoom: 12,
      bearing: 90
    }, { silent: true });

    // Events should not fire
    expect(moveHandler).not.toHaveBeenCalled();

    // But state should be updated
    const state = controller.getStateSnapshot();
    expect(state.center.x).toBe(100);
    expect(state.center.y).toBe(200);
    expect(state.zoom).toBe(12);
    expect(state.bearing).toBe(90);

    controller.dispose();
  });

  test('getStateSnapshot returns current camera state', () => {
    controller = createController({
      camera,
      domElement: canvas,
      width: 800,
      height: 600
    });

    controller.jumpTo({
      center: { x: 50, y: 75 },
      zoom: 14,
      bearing: 180,
      pitch: 45,
      roll: 10
    });

    const snapshot = controller.getStateSnapshot();

    expect(snapshot.center.x).toBe(50);
    expect(snapshot.center.y).toBe(75);
    expect(snapshot.zoom).toBe(14);
    expect(snapshot.bearing).toBe(180);
    expect(snapshot.pitch).toBe(45);
    expect(snapshot.roll).toBe(10);

    controller.dispose();
  });
});
