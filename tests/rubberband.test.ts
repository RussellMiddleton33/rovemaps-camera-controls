import { describe, it, expect } from 'vitest';

function damp(overshootWorld: number, strength: number) {
  return overshootWorld > 0 ? 1 / (1 + overshootWorld * strength) : 1;
}

describe('rubberband damping', () => {
  it('reduces delta with overshoot and strength', () => {
    const dx = 10;
    const overs = 0; // inside bounds
    expect(dx * damp(overs, 0.5)).toBeCloseTo(10, 6);
    const o1 = 1;
    expect(dx * damp(o1, 0.5)).toBeLessThan(10);
    const o2 = 2;
    expect(dx * damp(o2, 0.5)).toBeLessThan(dx * damp(o1, 0.5));
    // higher strength yields more damping
    expect(dx * damp(o1, 1.0)).toBeLessThan(dx * damp(o1, 0.5));
  });
});

