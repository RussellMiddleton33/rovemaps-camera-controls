# TODOs

1) flyTo with target zoom (no end snap)
   - Problem: When a `zoom` is provided to `flyTo`, the path is currently solved with
     start/end scales and time reparameterization for center, but the end zoom may be
     clamped at completion, which looks like a snap.
   - Plan:
     - Pre‑clamp requested zoom to constraints at start; solve toward achievable end zoom.
     - Evolve zoom continuously over time: z(t) = z0 + (z1 − z0) * e(t).
     - Re‑derive center path to be consistent with the evolving zoom (or use a simpler
       center interpolation that keeps progress matched to e while zoom evolves).
     - Keep time reparameterization (u(s)/u_end ≈ e) so center progress matches easing.
     - Provide an explicit option to preserve current zoom (default when zoom omitted).

2) Demo polish
   - Consider one‑frame warm‑up (rAF) for the first Fly click in dev to avoid devtool/DPR settle noise.
   - Expose min/max zoom in UI to surface clamping during demo.

