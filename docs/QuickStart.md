## Quick Start

Install (WIP publishing):

```
npm i three three-maplibre-camera-controls
```

Basic usage:

```ts
import * as THREE from 'three';
import { CameraController } from 'three-maplibre-camera-controls';

const renderer = new THREE.WebGLRenderer({ canvas });
const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
const controller = new CameraController({ camera, domElement: renderer.domElement, handlers: { scrollZoom: { around: 'pointer' }, rubberbandStrength: 0.5 } });

controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 4, bearing: 0, pitch: 45 });

// render loop
function frame() {
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
```

Next.js SSR-safe:

```ts
import { createControllerForNext } from 'three-maplibre-camera-controls';
const controller = createControllerForNext(() => ({ camera, domElement }));
```

