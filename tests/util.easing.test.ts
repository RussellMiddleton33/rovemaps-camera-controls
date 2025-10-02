import { describe, it, expect } from 'vitest';
import { defaultEasing, cubicBezier } from '../src/util/easing';

describe('easing', () => {
  it('defaultEasing is monotonic in [0,1]', () => {
    let prev = 0;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const e = defaultEasing(t);
      expect(e).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = e;
    }
  });

  it('cubicBezier(0,0,1,1) is linear', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      expect(linear(t)).toBeCloseTo(t, 6);
    }
  });
});

