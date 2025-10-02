import { describe, it, expect } from 'vitest';
import { computeFlyParams, widthAt, uAt } from '../src/util/flight';

describe('flight math', () => {
  it('width and distance satisfy endpoints', () => {
    const w0 = 800; // px
    const w1 = 400; // px after zoom in by 1 level
    const u1 = 2000; // px ground distance
    const rho = 1.42;
    const p = computeFlyParams(w0, w1, u1, rho);
    // Endpoints
    expect(widthAt(p, 0)).toBeCloseTo(w0, 6);
    expect(widthAt(p, p.S)).toBeGreaterThan(0);
    // u(0) ~ 0, u(S) ~ u1
    expect(uAt(p, 0)).toBeCloseTo(0, 6);
    const uEnd = uAt(p, p.S);
    // Allow small relative error due to simplified math
    const relErr = Math.abs(uEnd - u1) / u1;
    expect(relErr).toBeLessThanOrEqual(0.05);
  });

  it('S grows with u1', () => {
    const rho = 1.42;
    const base = computeFlyParams(800, 600, 1000, rho).S;
    const more = computeFlyParams(800, 600, 2000, rho).S;
    expect(more).toBeGreaterThan(base);
  });
});
