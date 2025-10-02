import type { ICameraHelper, EaseOptions, FlyToOptions, CameraForBoundsOptions } from './icameraHelper';
import type { ITransform, Padding } from '../transform/interfaces';
import { clamp, lerp, normalizeAngleDeg } from '../util/math';

export class PlanarCameraHelper implements ICameraHelper {
  handleMapControlsPan(transform: ITransform, dx: number, dy: number): void {
    // Interpret dx/dy in screen pixels mapped to world units via zoom scale.
    const scale = Math.pow(2, transform.zoom);
    transform.setCenter({
      x: transform.center.x - dx / scale,
      y: transform.center.y + dy / scale,
      z: transform.center.z,
    });
  }

  handleMapControlsRollPitchBearingZoom(
    transform: ITransform,
    dRoll: number,
    dPitch: number,
    dBearing: number,
    dZoom: number
  ): void {
    transform.setRoll(normalizeAngleDeg(transform.roll + dRoll));
    transform.setPitch(clamp(transform.pitch + dPitch, 0, 85));
    transform.setBearing(normalizeAngleDeg(transform.bearing + dBearing));
    transform.setZoom(transform.zoom + dZoom);
  }

  handleJumpToCenterZoom(transform: ITransform, center?: { x: number; y: number; z?: number }, zoom?: number): void {
    if (center) transform.setCenter(center);
    if (typeof zoom === 'number') transform.setZoom(zoom);
  }

  handleEaseTo(_transform: ITransform, _opts: EaseOptions): void {
    // Placeholder: actual path/around-point handling orchestrated by controller per frame.
  }

  handleFlyTo(_transform: ITransform, _opts: FlyToOptions): void {
    // Placeholder: compute curve/speed-based trajectory
  }

  handlePanInertia(_transform: ITransform, _vx: number, _vy: number): void {
    // Placeholder
  }

  cameraForBoxAndBearing(
    transform: ITransform,
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
    options?: CameraForBoundsOptions
  ) {
    const bearing = options?.bearing ?? transform.bearing;
    const padding: Padding = { ...{ top: 0, right: 0, bottom: 0, left: 0 }, ...(options?.padding as any) };
    const offset = options?.offset ?? { x: 0, y: 0 };
    const targetCenter = { x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.min.y + bounds.max.y) / 2 };
    const worldCorners = [
      { x: bounds.min.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.max.y },
      { x: bounds.min.x, y: bounds.max.y },
    ];

    // Projection-based zoom solve via binary search without emitting events
    const saved = {
      center: transform.center,
      zoom: transform.zoom,
      bearing: transform.bearing,
      pitch: transform.pitch,
      roll: transform.roll,
    };
    const viewW = Math.max(1, transform.width - (padding.left + padding.right));
    const viewH = Math.max(1, transform.height - (padding.top + padding.bottom));
    // Initialize search bounds for zoom
    let lo = -24, hi = 32; // generous
    const fitAtZoom = (z: number) => {
      transform.setCenter({ x: targetCenter.x, y: targetCenter.y, z: saved.center.z ?? 0 });
      transform.setBearing(bearing);
      transform.setPitch(saved.pitch);
      transform.setRoll(saved.roll);
      transform.setZoom(z);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of worldCorners) {
        const sp = transform.worldToScreen({ x: (c as any).x, y: 0, z: (c as any).y } as any) || transform.worldToScreen({ x: c.x, y: saved.center.z ?? 0, z: c.y } as any);
        // Fallback maps planar (x,y)→(x,z)
        const p = sp ?? { x: 0, y: 0 };
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      const w = maxX - minX;
      const h = maxY - minY;
      return { w, h };
    };
    // Binary search to fit within padded viewport
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const { w, h } = fitAtZoom(mid);
      if (w <= viewW && h <= viewH) {
        lo = mid; // can zoom in more
      } else {
        hi = mid; // too big, zoom out
      }
    }
    const zoom = lo;
    // Restore
    transform.setCenter(saved.center);
    transform.setZoom(saved.zoom);
    transform.setBearing(saved.bearing);
    transform.setPitch(saved.pitch);
    transform.setRoll(saved.roll);

    // Adjust center by padding centroid offset (screen-space) and offset in rotated screen-space
    const center = { ...targetCenter };
    const s = Math.pow(2, zoom);
    const padCx = (padding.right - padding.left) / 2;
    const padCy = (padding.top - padding.bottom) / 2;
    if (padCx !== 0 || padCy !== 0) {
      center.x += -padCx / s;
      center.y += padCy / s;
    }
    if (offset.x !== 0 || offset.y !== 0) {
      const rad2 = (bearing * Math.PI) / 180;
      const cos2 = Math.cos(rad2), sin2 = Math.sin(rad2);
      const rx = offset.x * cos2 + offset.y * sin2;
      const ry = -offset.x * sin2 + offset.y * cos2;
      center.x += (-rx) / s;
      center.y += (ry) / s;
    }
    return { center, zoom, bearing, pitch: transform.pitch };
  }
}
