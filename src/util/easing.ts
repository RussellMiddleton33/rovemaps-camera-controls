export type Easing = (t: number) => number;

export const defaultEasing: Easing = (t) => t * (2 - t); // easeOutQuad, monotonic in [0,1]

// Cubic Bezier helper (0,0)-(p1x,p1y)-(p2x,p2y)-(1,1)
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): Easing {
  // Approximate via precomputed lookup for simplicity in baseline
  const NEWTON_ITER = 5;
  const NEWTON_EPS = 1e-6;

  function A(a1: number, a2: number) { return 1 - 3 * a2 + 3 * a1; }
  function B(a1: number, a2: number) { return 3 * a2 - 6 * a1; }
  function C(a1: number) { return 3 * a1; }

  function calcBezier(t: number, a1: number, a2: number) {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }
  function slope(t: number, a1: number, a2: number) {
    return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  }

  return function (x: number) {
    if (p1x === p1y && p2x === p2y) return x; // linear
    // Find t for x via Newton-Raphson
    let t = x;
    for (let i = 0; i < NEWTON_ITER; i++) {
      const s = slope(t, p1x, p2x);
      if (Math.abs(s) < NEWTON_EPS) break;
      const x2 = calcBezier(t, p1x, p2x) - x;
      t -= x2 / s;
    }
    const y = calcBezier(Math.max(0, Math.min(1, t)), p1y, p2y);
    return y;
  };
}

