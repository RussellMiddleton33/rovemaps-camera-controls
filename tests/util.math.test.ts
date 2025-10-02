import { describe, it, expect } from 'vitest';
import { clamp, lerp, mod, normalizeAngleDeg, zoomScale, scaleZoom } from '../src/util/math';

describe('math utils', () => {
  it('clamp works', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp works', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('mod is positive', () => {
    expect(mod(-1, 360)).toBe(359);
    expect(mod(361, 360)).toBe(1);
  });

  it('normalizeAngleDeg to (-180,180]', () => {
    expect(normalizeAngleDeg(0)).toBe(0);
    expect(normalizeAngleDeg(180)).toBe(180);
    expect(normalizeAngleDeg(-180)).toBe(180);
    expect(normalizeAngleDeg(190)).toBe(-170);
  });

  it('zoomScale and scaleZoom are inverses', () => {
    const deltas = [-4, -1, 0, 0.5, 1, 3.2];
    for (const d of deltas) {
      const s = zoomScale(d);
      expect(scaleZoom(s)).toBeCloseTo(d, 10);
    }
  });
});

