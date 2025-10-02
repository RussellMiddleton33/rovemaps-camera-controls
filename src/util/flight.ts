export type FlyParams = {
  rho: number;
  w0: number;
  w1: number;
  u1: number;
  b: number;
  r0: number;
  r1: number;
  S: number;
};

export function computeFlyParams(w0: number, w1: number, u1: number, rho: number): FlyParams {
  const rho2 = rho * rho;
  // Guard small movement
  if (u1 < 1e-9) {
    const S = 0;
    return { rho, w0, w1, u1, b: 0, r0: 0, r1: 0, S };
  }
  const b = (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
  const sqrtTerm = Math.sqrt(Math.max(0, b * b + 1));
  const r0 = Math.log(sqrtTerm - b);
  const r1 = Math.log(sqrtTerm + b);
  const S = r1 - r0;
  return { rho, w0, w1, u1, b, r0, r1, S };
}

// Width (w) along the path at arc-length s in [0, S]
export function widthAt(params: FlyParams, s: number) {
  const r = params.r0 + s;
  const coshr0 = Math.cosh(params.r0);
  const coshr = Math.cosh(r);
  return params.w0 * (coshr0 / coshr);
}

// Pixel distance u(s) traveled along the ground line at arc-length s
export function uAt(params: FlyParams, s: number) {
  const r = params.r0 + s;
  const coshr0 = Math.cosh(params.r0);
  const tanhr = Math.tanh(r);
  const sinhr0 = Math.sinh(params.r0);
  const rho2 = params.rho * params.rho;
  return (params.w0 * (coshr0 * tanhr - sinhr0)) / rho2;
}

