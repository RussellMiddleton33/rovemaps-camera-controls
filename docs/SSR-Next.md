## SSR and Next.js

### SSR-safe factory
- Use `createControllerForNext(() => ({ camera, domElement, ... }))` in client components or after mount.
- On server, it returns a no-op stub; on client, it constructs the real controller.

### Guards
- All DOM/window access is guarded; controller constructors avoid accessing DOM on server.

### Resize
- Use `setViewport({ width, height, devicePixelRatio })` wired via `ResizeObserver` on your canvas/container.

