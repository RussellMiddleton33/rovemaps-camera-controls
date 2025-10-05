## Examples

### Live Demos
- **Y-up demo**: https://russellmiddleton33.github.io/rovemaps-camera-controls/demo/
- **Z-up demo**: https://russellmiddleton33.github.io/rovemaps-camera-controls/demo/zup.html

### Vite demo site
- Located at `examples/site/`
- Two versions available:
  - `index.html` - Y-up coordinate system (standard Three.js)
  - `zup.html` - Z-up coordinate system (GIS-friendly)
- Showcases:
  - Pointer-around zoom, rotate, pitch
  - Rubberband strength slider
  - Fit bounds with padding and rotated offset
  - flyTo demos (constant px-speed and hyperbolic path)
  - Event logs and debug overlay

Run locally:
```
cd examples/site
npm i
npm run dev       # Opens Y-up demo
# Then navigate to http://localhost:5173/zup.html for Z-up demo
```

### Minimal Three.js scene
- Grid helper plane + boxes to orient movement and fit tests.
- Toggle handlers and options via UI buttons.

