import * as THREE from 'three';
import { CameraController } from '../../../src/core/cameraController';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const overlay = document.getElementById('overlay')!;

let renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);

const grid = new THREE.GridHelper(1000, 100, 0x444444, 0x222222);
scene.add(grid);

// Debug gizmos: world axes at center, camera axes at center, pointer anchor, velocity arrow
const gizmoGroup = new THREE.Group();
scene.add(gizmoGroup);

function makeArrow(dir: THREE.Vector3, color: number, len = 80) {
  return new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(), len, color, 12, 6);
}

const worldXArrow = makeArrow(new THREE.Vector3(1, 0, 0), 0xff0000);
const worldZArrow = makeArrow(new THREE.Vector3(0, 0, 1), 0x0000ff);
const camRightArrow = makeArrow(new THREE.Vector3(1, 0, 0), 0xff00ff); // magenta
const camFwdArrow = makeArrow(new THREE.Vector3(0, 0, 1), 0xffaa00);   // orange (distinct from green)
gizmoGroup.add(worldXArrow, worldZArrow, camRightArrow, camFwdArrow);

const anchorSphere = new THREE.Mesh(
  new THREE.SphereGeometry(3, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
scene.add(anchorSphere);

const velArrow = makeArrow(new THREE.Vector3(1, 0, 0), 0x00ff00, 60);
scene.add(velArrow);

const boxGeo = new THREE.BoxGeometry(20, 20, 20);
for (let i = 0; i < 30; i++) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 30, 0.6, 0.5) });
  const mesh = new THREE.Mesh(boxGeo, m);
  mesh.position.set((Math.random() - 0.5) * 500, 10, (Math.random() - 0.5) * 500);
  scene.add(mesh);
}

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(100, 200, 100);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

let controller: CameraController;
let currentHandlers = {
  around: true,
  coop: false,
  keyboard: true,
  dblclick: true,
  boxzoom: true,
  rubber: 0,
  invertZoom: false,
  invertPitch: false,
  // Default to natural clockwise twist on trackpads
  invertTwist: true,
  invertPanY: false,
  recenterOnDown: false,
  invertInertiaY: false,
  invertInertiaX: false,
  anchorTightness: 1,
  antialias: true,
  maxPitch: 80,
  maxZoom: 12,
  minZoom: 0,
  rightDragPan: true,
};

function buildController() {
  // Preserve current camera state when rebuilding handlers/renderer
  const prev = controller ? {
    center: controller.getCenter(),
    zoom: controller.getZoom(),
    bearing: controller.getBearing(),
    pitch: controller.getPitch(),
    roll: controller.getRoll(),
    padding: controller.getPadding(),
  } : null;

  if (controller) controller.dispose();
  // Rebuild renderer based on current handlers (avoid referencing toolbar before init)
  rebuildRenderer(currentHandlers.antialias);
  // Detect touch-capable device; always favor Touch Profile when touch is present
  const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
  if (isTouch) currentHandlers.mobileProfile = true;
  const touchProfile = currentHandlers.mobileProfile ? {
    rotateThresholdDeg: 0.5,
    pitchThresholdPx: 12,
    zoomThreshold: 0.04,
  } : {} as any;
  controller = new CameraController({
    camera,
    domElement: renderer.domElement,
    maxPitch: currentHandlers.maxPitch,
    maxZoom: currentHandlers.maxZoom,
    minZoom: currentHandlers.minZoom,
    handlers: {
      scrollZoom: {
        around: currentHandlers.around ? 'pointer' : 'center',
        cooperative: currentHandlers.coop,
        onCoopGestureHint: showCoopHint,
        zoomSign: currentHandlers.invertZoom ? -1 : 1,
        anchorTightness: currentHandlers.anchorTightness,
      },
      rightButtonPan: currentHandlers.rightDragPan,
      mousePan: {
        panYSign: currentHandlers.invertPanY ? -1 : 1,
        recenterOnPointerDown: currentHandlers.recenterOnDown,
        inertiaPanYSign: currentHandlers.invertInertiaY ? -1 : 1,
        inertiaPanXSign: currentHandlers.invertInertiaX ? -1 : 1,
        anchorTightness: currentHandlers.anchorTightness,
      },
      // Enable right-drag rotate/pitch when rightButtonPan is false
      mouseRotatePitch: {
        pitchSign: currentHandlers.invertPitch ? -1 : 1,
        rotateSign: currentHandlers.invertTwist ? -1 : 1,
        recenterOnPointerDown: currentHandlers.recenterOnDown && currentHandlers.around,
        anchorTightness: currentHandlers.anchorTightness,
      },
      touch: {
        panYSign: currentHandlers.invertPanY ? -1 : 1,
        recenterOnGestureStart: currentHandlers.recenterOnDown,
        anchorTightness: currentHandlers.anchorTightness,
        inertiaPanYSign: currentHandlers.invertInertiaY ? -1 : 1,
        inertiaPanXSign: currentHandlers.invertInertiaX ? -1 : 1,
        // Keep touch rotation default unchanged regardless of invertTwist toggle
        rotateSign: 1,
        ...(touchProfile as any),
      },
      // Safari trackpad twist: event.rotation is clockwise-positive.
      // Use the opposite mapping from mouse: default to +1 so clockwise rotates clockwise,
      // and let the invert toggle flip it if desired.
      safariGestures: { enabled: true, rotateSign: currentHandlers.invertTwist ? 1 : -1, zoomSign: currentHandlers.invertZoom ? -1 : 1 },
      keyboard: currentHandlers.keyboard,
      dblclick: currentHandlers.dblclick,
      boxZoom: currentHandlers.boxzoom,
      rubberbandStrength: currentHandlers.rubber,
    },
    bearingSnap: 7,
  });
  // Restore previous camera if available; otherwise use a sensible default
  if (prev) {
    controller.jumpTo({ center: prev.center, zoom: prev.zoom, bearing: prev.bearing, pitch: prev.pitch, roll: prev.roll, padding: prev.padding });
  } else {
    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 4, bearing: 0, pitch: 45 });
  }
  controller.on('renderFrame', () => updateOverlay());
  controller.on('move', () => updateOverlay());
}
buildController();

const toolbar = {
  zoomIn: document.getElementById('btn-zoom-in')!,
  zoomOut: document.getElementById('btn-zoom-out')!,
  rotateLeft: document.getElementById('btn-rotate-left')!,
  rotateRight: document.getElementById('btn-rotate-right')!,
  pitchUp: document.getElementById('btn-pitch-up')!,
  pitchDown: document.getElementById('btn-pitch-down')!,
  rubber: document.getElementById('rubberband') as HTMLInputElement,
  aroundPointer: document.getElementById('around-pointer') as HTMLInputElement,
  cooperative: document.getElementById('cooperative') as HTMLInputElement,
  keyboard: document.getElementById('keyboard') as HTMLInputElement,
  dblclick: document.getElementById('dblclick') as HTMLInputElement,
  boxzoom: document.getElementById('boxzoom') as HTMLInputElement,
  antialias: document.getElementById('antialias') as HTMLInputElement,
  invertZoom: document.getElementById('invert-zoom') as HTMLInputElement,
  invertPitch: document.getElementById('invert-pitch') as HTMLInputElement,
  invertTwist: document.getElementById('invert-twist') as HTMLInputElement,
  rightDragPan: document.getElementById('right-drag-pan') as HTMLInputElement,
  invertPanY: document.getElementById('invert-pany') as HTMLInputElement,
  recenterOnDown: document.getElementById('recenter-down') as HTMLInputElement,
  invertInertiaY: document.getElementById('invert-inertia-y') as HTMLInputElement,
  invertInertiaX: document.getElementById('invert-inertia-x') as HTMLInputElement,
  anchorTight: document.getElementById('anchor-tight') as HTMLInputElement,
  showDebug: document.getElementById('show-debug') as HTMLInputElement,
  fly: document.getElementById('btn-fly')!,
  fit: document.getElementById('btn-fit')!,
  maxPitch: document.getElementById('max-pitch') as HTMLInputElement,
  maxZoom: document.getElementById('max-zoom') as HTMLInputElement,
  minZoom: document.getElementById('min-zoom') as HTMLInputElement,
  mobileProfile: document.getElementById('mobile-profile') as HTMLInputElement,
};

// Sync initial UI state with defaults so toggling works as expected
toolbar.invertTwist.checked = currentHandlers.invertTwist;

toolbar.zoomIn.addEventListener('click', () => controller.zoomIn(0.5, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.zoomOut.addEventListener('click', () => controller.zoomOut(0.5, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.rotateLeft.addEventListener('click', () => controller.rotateBy(-10, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.rotateRight.addEventListener('click', () => controller.rotateBy(10, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.pitchUp.addEventListener('click', () => controller.pitchBy(5, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.pitchDown.addEventListener('click', () => controller.pitchBy(-5, { around: toolbar.aroundPointer.checked ? 'pointer' : 'center' }));
toolbar.rubber.addEventListener('input', () => { currentHandlers.rubber = parseFloat(toolbar.rubber.value); buildController(); });
toolbar.aroundPointer.addEventListener('change', () => { currentHandlers.around = toolbar.aroundPointer.checked; buildController(); });
toolbar.cooperative.addEventListener('change', () => { currentHandlers.coop = toolbar.cooperative.checked; buildController(); });
toolbar.keyboard.addEventListener('change', () => { currentHandlers.keyboard = toolbar.keyboard.checked; buildController(); });
toolbar.dblclick.addEventListener('change', () => { currentHandlers.dblclick = toolbar.dblclick.checked; buildController(); });
toolbar.boxzoom.addEventListener('change', () => { currentHandlers.boxzoom = toolbar.boxzoom.checked; buildController(); });
toolbar.antialias.addEventListener('change', () => { currentHandlers.antialias = toolbar.antialias.checked; buildController(); });
toolbar.invertZoom.addEventListener('change', () => { currentHandlers.invertZoom = toolbar.invertZoom.checked; buildController(); });
toolbar.invertPitch.addEventListener('change', () => { currentHandlers.invertPitch = toolbar.invertPitch.checked; buildController(); });
toolbar.invertTwist.addEventListener('change', () => { currentHandlers.invertTwist = toolbar.invertTwist.checked; buildController(); });
toolbar.rightDragPan.addEventListener('change', () => { currentHandlers.rightDragPan = toolbar.rightDragPan.checked; buildController(); });
toolbar.invertPanY.addEventListener('change', () => { currentHandlers.invertPanY = toolbar.invertPanY.checked; buildController(); });
toolbar.recenterOnDown.addEventListener('change', () => { currentHandlers.recenterOnDown = toolbar.recenterOnDown.checked; buildController(); });
toolbar.invertInertiaY.addEventListener('change', () => { currentHandlers.invertInertiaY = toolbar.invertInertiaY.checked; buildController(); });
toolbar.invertInertiaX.addEventListener('change', () => { currentHandlers.invertInertiaX = toolbar.invertInertiaX.checked; buildController(); });
toolbar.anchorTight.addEventListener('input', () => { currentHandlers.anchorTightness = parseFloat(toolbar.anchorTight.value); buildController(); });
toolbar.showDebug.addEventListener('change', () => { updateDebugVisibility(toolbar.showDebug.checked); });
toolbar.maxPitch.addEventListener('change', () => { currentHandlers.maxPitch = Math.max(1, Math.min(89, parseFloat(toolbar.maxPitch.value))); buildController(); });
toolbar.maxZoom.addEventListener('change', () => { currentHandlers.maxZoom = parseFloat(toolbar.maxZoom.value); buildController(); });
toolbar.minZoom.addEventListener('change', () => { currentHandlers.minZoom = parseFloat(toolbar.minZoom.value); buildController(); });
toolbar.mobileProfile.addEventListener('change', () => { currentHandlers.mobileProfile = toolbar.mobileProfile.checked; buildController(); });

toolbar.fly.addEventListener('click', () => {
  const target = { x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 };
  controller.flyTo({ center: target, zoom: 7, bearing: Math.random() * 360 - 180, pitch: 50, curve: 1.4, speed: 1.2, maxDuration: 2500 });
});

toolbar.fit.addEventListener('click', () => {
  const bounds = { min: { x: -150, y: -80 }, max: { x: 150, y: 80 } };
  controller.fitBounds(bounds, { padding: { top: 20, right: 60, bottom: 20, left: 60 }, offset: { x: 80, y: -40 } });
});

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  controller.setViewport({ width: rect.width, height: rect.height, devicePixelRatio: dpr });
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(rect.width, rect.height, false);
}

window.addEventListener('resize', resize);
resize();

// Mobile menu toggle
const menuBtn = document.getElementById('menu-toggle') as HTMLButtonElement;
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    document.body.classList.toggle('menu-open');
  });
  // Auto-close menu when interacting with canvas
  canvas.addEventListener('pointerdown', () => { document.body.classList.remove('menu-open'); }, { passive: true });
}

function updateOverlay() {
  const c = controller.getCenter();
  overlay.textContent = `center: ${c.x.toFixed(2)}, ${c.y.toFixed(2)}\nzoom: ${controller.getZoom().toFixed(2)}\n` +
    `bearing: ${controller.getBearing().toFixed(2)}\npitch: ${controller.getPitch().toFixed(2)}\n` +
    `roll: ${controller.getRoll().toFixed(2)}`;

  // Update gizmos at center
  const center3 = new THREE.Vector3(c.x, 0, c.y);
  worldXArrow.position.copy(center3);
  worldZArrow.position.copy(center3);
  camRightArrow.position.copy(center3);
  camFwdArrow.position.copy(center3);
  const br = controller.getBearing() * Math.PI / 180;
  const right = new THREE.Vector3(Math.cos(br), 0, Math.sin(br));
  const fwd = new THREE.Vector3(-Math.sin(br), 0, Math.cos(br));
  camRightArrow.setDirection(right);
  camFwdArrow.setDirection(fwd);
}

function frame() {
  // Guard against DPR or CSS size changes mid-gesture (prevents blurry rendering)
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const needResize =
    Math.abs(canvas.width - Math.floor(rect.width * dpr)) > 1 ||
    Math.abs(canvas.height - Math.floor(rect.height * dpr)) > 1;
  if (needResize) {
    controller.setViewport({ width: rect.width, height: rect.height, devicePixelRatio: dpr });
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// Expose for console debugging
(window as any).THREE = THREE;
(window as any).controller = controller;

function rebuildRenderer(aa: boolean) {
  // Dispose and recreate renderer with AA toggle
  try { renderer.dispose(); } catch {}
  renderer = new THREE.WebGLRenderer({ canvas, antialias: aa });
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  renderer.setPixelRatio(dpr);
  renderer.setSize(rect.width, rect.height, false);
}

// Cooperative gestures hint (auto-hide)
let coopTimer: number | null = null;
function showCoopHint() {
  const el = document.getElementById('coop-hint')!;
  el.removeAttribute('hidden');
  if (coopTimer) window.clearTimeout(coopTimer);
  coopTimer = window.setTimeout(() => { el.setAttribute('hidden', ''); }, 1400);
}

// Box zoom overlay via Shift+drag
const selectRect = document.getElementById('select-rect') as HTMLDivElement;
let selecting = false;
let startX = 0, startY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!toolbar.boxzoom.checked) return;
  if (!e.shiftKey || e.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  startX = e.clientX - rect.left; startY = e.clientY - rect.top;
  selecting = true;
  selectRect.style.left = `${startX}px`;
  selectRect.style.top = `${startY}px`;
  selectRect.style.width = '0px'; selectRect.style.height = '0px';
  selectRect.removeAttribute('hidden');
});

// Pointer anchor tracking and velocity visualization
let lastCenter = new THREE.Vector3(controller.getCenter().x, 0, controller.getCenter().y);
let lastTime = performance.now();
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const gp = (controller.transform as any).groundFromScreen?.(pt) ?? null;
  if (gp) anchorSphere.position.set(gp.gx, 0, gp.gz);
});

controller.on('renderFrame', () => {
  const now = performance.now();
  const dt = Math.max(1 / 120, (now - lastTime) / 1000);
  lastTime = now;
  const c = controller.getCenter();
  const curr = new THREE.Vector3(c.x, 0, c.y);
  const delta = curr.clone().sub(lastCenter);
  lastCenter.copy(curr);
  // Velocity arrow (scaled)
  const speed = delta.length() / dt;
  const dir = delta.lengthSq() > 1e-9 ? delta.clone().normalize() : new THREE.Vector3(1, 0, 0);
  velArrow.position.copy(curr);
  velArrow.setDirection(dir);
  velArrow.setLength(Math.min(200, speed * 50), 12, 6);
});

function updateDebugVisibility(show: boolean) {
  [gizmoGroup, anchorSphere, velArrow].forEach(obj => obj.visible = show);
}
// Default off
updateDebugVisibility(false);
window.addEventListener('pointermove', (e) => {
  if (!selecting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const left = Math.min(startX, x); const top = Math.min(startY, y);
  const w = Math.abs(x - startX); const h = Math.abs(y - startY);
  selectRect.style.left = `${left}px`; selectRect.style.top = `${top}px`;
  selectRect.style.width = `${w}px`; selectRect.style.height = `${h}px`;
});
window.addEventListener('pointerup', (e) => {
  if (!selecting) return;
  selecting = false;
  selectRect.setAttribute('hidden', '');
  const rect = renderer.domElement.getBoundingClientRect();
  const endX = e.clientX - rect.left; const endY = e.clientY - rect.top;
  const x0 = Math.min(startX, endX), y0 = Math.min(startY, endY);
  const x1 = Math.max(startX, endX), y1 = Math.max(startY, endY);
  const w0 = controller.transform.screenToWorld({ x: x0, y: y0 });
  const w1 = controller.transform.screenToWorld({ x: x1, y: y1 });
  if (w0 && w1) {
    controller.fitBounds({ min: { x: Math.min(w0.x, w1.x), y: Math.min(w0.y, w1.y) }, max: { x: Math.max(w0.x, w1.x), y: Math.max(w0.y, w1.y) } }, { padding: { top: 10, right: 10, bottom: 10, left: 10 } });
  }
});
