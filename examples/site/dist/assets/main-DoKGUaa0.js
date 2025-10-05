import { W as WebGLRenderer, S as Scene, C as Color, P as PerspectiveCamera, G as GridHelper, a as Group, M as Mesh, b as SphereGeometry, c as MeshBasicMaterial, B as BoxGeometry, d as MeshStandardMaterial, D as DirectionalLight, A as AmbientLight, T as THREE, V as Vector3, e as ArrowHelper, f as CameraController } from "./cameraController-BaZfOMX1.js";
const canvas = document.getElementById("c");
const overlay = document.getElementById("overlay");
let renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
const scene = new Scene();
scene.background = new Color(1118481);
const camera = new PerspectiveCamera(60, 1, 0.1, 1e5);
const grid = new GridHelper(1e3, 100, 4473924, 2236962);
scene.add(grid);
const gizmoGroup = new Group();
scene.add(gizmoGroup);
function makeArrow(dir, color, len = 80) {
  return new ArrowHelper(dir.clone().normalize(), new Vector3(), len, color, 12, 6);
}
const worldXArrow = makeArrow(new Vector3(1, 0, 0), 16711680);
const worldZArrow = makeArrow(new Vector3(0, 0, 1), 255);
const camRightArrow = makeArrow(new Vector3(1, 0, 0), 16711935);
const camFwdArrow = makeArrow(new Vector3(0, 0, 1), 16755200);
gizmoGroup.add(worldXArrow, worldZArrow, camRightArrow, camFwdArrow);
const anchorSphere = new Mesh(
  new SphereGeometry(3, 16, 16),
  new MeshBasicMaterial({ color: 16776960 })
);
scene.add(anchorSphere);
const velArrow = makeArrow(new Vector3(1, 0, 0), 65280, 60);
scene.add(velArrow);
const boxGeo = new BoxGeometry(20, 20, 20);
for (let i = 0; i < 30; i++) {
  const m = new MeshStandardMaterial({ color: new Color().setHSL(i / 30, 0.6, 0.5) });
  const mesh = new Mesh(boxGeo, m);
  mesh.position.set((Math.random() - 0.5) * 500, 10, (Math.random() - 0.5) * 500);
  scene.add(mesh);
}
const light = new DirectionalLight(16777215, 1);
light.position.set(100, 200, 100);
scene.add(light);
scene.add(new AmbientLight(4210752));
let controller;
let currentHandlers = {
  around: true,
  coop: false,
  keyboard: true,
  dblclick: true,
  boxzoom: true,
  rubber: 0,
  invertZoom: false,
  invertPitch: false,
  // Default: natural clockwise twist; checkbox toggles invert
  invertTwist: false,
  invertPanY: false,
  recenterOnDown: false,
  invertInertiaY: false,
  invertInertiaX: false,
  anchorTightness: 1,
  antialias: true,
  maxPitch: 80,
  maxZoom: 12,
  minZoom: 0,
  rightDragPan: true
};
function buildController() {
  const prev = controller ? {
    center: controller.getCenter(),
    zoom: controller.getZoom(),
    bearing: controller.getBearing(),
    pitch: controller.getPitch(),
    roll: controller.getRoll(),
    padding: controller.getPadding()
  } : null;
  if (controller) controller.dispose();
  rebuildRenderer(currentHandlers.antialias);
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  if (isTouch) currentHandlers.mobileProfile = true;
  const touchProfile = currentHandlers.mobileProfile ? {
    rotateThresholdDeg: 0.5,
    pitchThresholdPx: 12,
    zoomThreshold: 0.04
  } : {};
  controller = new CameraController({
    camera,
    domElement: renderer.domElement,
    maxPitch: currentHandlers.maxPitch,
    maxZoom: currentHandlers.maxZoom,
    minZoom: currentHandlers.minZoom,
    handlers: {
      scrollZoom: {
        around: currentHandlers.around ? "pointer" : "center",
        cooperative: currentHandlers.coop,
        onCoopGestureHint: showCoopHint,
        zoomSign: currentHandlers.invertZoom ? -1 : 1,
        anchorTightness: currentHandlers.anchorTightness
      },
      rightButtonPan: currentHandlers.rightDragPan,
      mousePan: {
        panYSign: currentHandlers.invertPanY ? -1 : 1,
        recenterOnPointerDown: currentHandlers.recenterOnDown,
        inertiaPanYSign: currentHandlers.invertInertiaY ? -1 : 1,
        inertiaPanXSign: currentHandlers.invertInertiaX ? -1 : 1,
        anchorTightness: currentHandlers.anchorTightness
      },
      // Enable right-drag rotate/pitch when rightButtonPan is false
      mouseRotatePitch: {
        pitchSign: currentHandlers.invertPitch ? -1 : 1,
        rotateSign: currentHandlers.invertTwist ? -1 : 1,
        recenterOnPointerDown: currentHandlers.recenterOnDown && currentHandlers.around,
        anchorTightness: currentHandlers.anchorTightness
      },
      touch: {
        panYSign: currentHandlers.invertPanY ? -1 : 1,
        recenterOnGestureStart: currentHandlers.recenterOnDown,
        anchorTightness: currentHandlers.anchorTightness,
        inertiaPanYSign: currentHandlers.invertInertiaY ? -1 : 1,
        inertiaPanXSign: currentHandlers.invertInertiaX ? -1 : 1,
        // Make touch rotation respect the invert twist toggle
        rotateSign: currentHandlers.invertTwist ? -1 : 1,
        ...touchProfile
      },
      // Safari trackpad twist: now uses consistent sign convention with other handlers
      safariGestures: { enabled: true, rotateSign: currentHandlers.invertTwist ? -1 : 1, zoomSign: currentHandlers.invertZoom ? -1 : 1 },
      keyboard: currentHandlers.keyboard,
      dblclick: currentHandlers.dblclick,
      boxZoom: currentHandlers.boxzoom,
      rubberbandStrength: currentHandlers.rubber
    },
    bearingSnap: 7
  });
  if (prev) {
    controller.jumpTo({ center: prev.center, zoom: prev.zoom, bearing: prev.bearing, pitch: prev.pitch, roll: prev.roll, padding: prev.padding });
  } else {
    controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 4, bearing: 0, pitch: 45 });
  }
  controller.on("renderFrame", () => updateOverlay());
  controller.on("move", () => updateOverlay());
}
buildController();
const toolbar = {
  zoomIn: document.getElementById("btn-zoom-in"),
  zoomOut: document.getElementById("btn-zoom-out"),
  rotateLeft: document.getElementById("btn-rotate-left"),
  rotateRight: document.getElementById("btn-rotate-right"),
  pitchUp: document.getElementById("btn-pitch-up"),
  pitchDown: document.getElementById("btn-pitch-down"),
  rubber: document.getElementById("rubberband"),
  aroundPointer: document.getElementById("around-pointer"),
  cooperative: document.getElementById("cooperative"),
  keyboard: document.getElementById("keyboard"),
  dblclick: document.getElementById("dblclick"),
  boxzoom: document.getElementById("boxzoom"),
  antialias: document.getElementById("antialias"),
  invertZoom: document.getElementById("invert-zoom"),
  invertPitch: document.getElementById("invert-pitch"),
  invertTwist: document.getElementById("invert-twist"),
  rightDragPan: document.getElementById("right-drag-pan"),
  invertPanY: document.getElementById("invert-pany"),
  recenterOnDown: document.getElementById("recenter-down"),
  invertInertiaY: document.getElementById("invert-inertia-y"),
  invertInertiaX: document.getElementById("invert-inertia-x"),
  anchorTight: document.getElementById("anchor-tight"),
  showDebug: document.getElementById("show-debug"),
  fly: document.getElementById("btn-fly"),
  fit: document.getElementById("btn-fit"),
  maxPitch: document.getElementById("max-pitch"),
  maxZoom: document.getElementById("max-zoom"),
  minZoom: document.getElementById("min-zoom"),
  mobileProfile: document.getElementById("mobile-profile")
};
toolbar.invertTwist.checked = currentHandlers.invertTwist;
toolbar.zoomIn.addEventListener("click", () => controller.zoomIn(0.5, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.zoomOut.addEventListener("click", () => controller.zoomOut(0.5, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.rotateLeft.addEventListener("click", () => controller.rotateBy(-10, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.rotateRight.addEventListener("click", () => controller.rotateBy(10, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.pitchUp.addEventListener("click", () => controller.pitchBy(5, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.pitchDown.addEventListener("click", () => controller.pitchBy(-5, { around: toolbar.aroundPointer.checked ? "pointer" : "center" }));
toolbar.rubber.addEventListener("input", () => {
  currentHandlers.rubber = parseFloat(toolbar.rubber.value);
  buildController();
});
toolbar.aroundPointer.addEventListener("change", () => {
  currentHandlers.around = toolbar.aroundPointer.checked;
  buildController();
});
toolbar.cooperative.addEventListener("change", () => {
  currentHandlers.coop = toolbar.cooperative.checked;
  buildController();
});
toolbar.keyboard.addEventListener("change", () => {
  currentHandlers.keyboard = toolbar.keyboard.checked;
  buildController();
});
toolbar.dblclick.addEventListener("change", () => {
  currentHandlers.dblclick = toolbar.dblclick.checked;
  buildController();
});
toolbar.boxzoom.addEventListener("change", () => {
  currentHandlers.boxzoom = toolbar.boxzoom.checked;
  buildController();
});
toolbar.antialias.addEventListener("change", () => {
  currentHandlers.antialias = toolbar.antialias.checked;
  buildController();
});
toolbar.invertZoom.addEventListener("change", () => {
  currentHandlers.invertZoom = toolbar.invertZoom.checked;
  buildController();
});
toolbar.invertPitch.addEventListener("change", () => {
  currentHandlers.invertPitch = toolbar.invertPitch.checked;
  buildController();
});
toolbar.invertTwist.addEventListener("change", () => {
  currentHandlers.invertTwist = toolbar.invertTwist.checked;
  buildController();
});
toolbar.rightDragPan.addEventListener("change", () => {
  currentHandlers.rightDragPan = toolbar.rightDragPan.checked;
  buildController();
});
toolbar.invertPanY.addEventListener("change", () => {
  currentHandlers.invertPanY = toolbar.invertPanY.checked;
  buildController();
});
toolbar.recenterOnDown.addEventListener("change", () => {
  currentHandlers.recenterOnDown = toolbar.recenterOnDown.checked;
  buildController();
});
toolbar.invertInertiaY.addEventListener("change", () => {
  currentHandlers.invertInertiaY = toolbar.invertInertiaY.checked;
  buildController();
});
toolbar.invertInertiaX.addEventListener("change", () => {
  currentHandlers.invertInertiaX = toolbar.invertInertiaX.checked;
  buildController();
});
toolbar.anchorTight.addEventListener("input", () => {
  currentHandlers.anchorTightness = parseFloat(toolbar.anchorTight.value);
  buildController();
});
toolbar.showDebug.addEventListener("change", () => {
  updateDebugVisibility(toolbar.showDebug.checked);
});
toolbar.maxPitch.addEventListener("change", () => {
  currentHandlers.maxPitch = Math.max(1, Math.min(89, parseFloat(toolbar.maxPitch.value)));
  buildController();
});
toolbar.maxZoom.addEventListener("change", () => {
  currentHandlers.maxZoom = parseFloat(toolbar.maxZoom.value);
  buildController();
});
toolbar.minZoom.addEventListener("change", () => {
  currentHandlers.minZoom = parseFloat(toolbar.minZoom.value);
  buildController();
});
toolbar.mobileProfile.addEventListener("change", () => {
  currentHandlers.mobileProfile = toolbar.mobileProfile.checked;
  buildController();
});
toolbar.fly.addEventListener("click", () => {
  const target = { x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 };
  controller.flyTo({ center: target, zoom: 7, bearing: Math.random() * 360 - 180, pitch: 50, curve: 1.4, speed: 1.2, maxDuration: 2500 });
});
toolbar.fit.addEventListener("click", () => {
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
window.addEventListener("resize", resize);
resize();
const menuBtn = document.getElementById("menu-toggle");
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    document.body.classList.toggle("menu-open");
  });
  canvas.addEventListener("pointerdown", () => {
    document.body.classList.remove("menu-open");
  }, { passive: true });
}
function updateOverlay() {
  const c = controller.getCenter();
  overlay.textContent = `center: ${c.x.toFixed(2)}, ${c.y.toFixed(2)}
zoom: ${controller.getZoom().toFixed(2)}
bearing: ${controller.getBearing().toFixed(2)}
pitch: ${controller.getPitch().toFixed(2)}
roll: ${controller.getRoll().toFixed(2)}`;
  const center3 = new Vector3(c.x, 0, c.y);
  worldXArrow.position.copy(center3);
  worldZArrow.position.copy(center3);
  camRightArrow.position.copy(center3);
  camFwdArrow.position.copy(center3);
  const br = controller.getBearing() * Math.PI / 180;
  const right = new Vector3(Math.cos(br), 0, Math.sin(br));
  const fwd = new Vector3(-Math.sin(br), 0, Math.cos(br));
  camRightArrow.setDirection(right);
  camFwdArrow.setDirection(fwd);
}
function frame() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const needResize = Math.abs(canvas.width - Math.floor(rect.width * dpr)) > 1 || Math.abs(canvas.height - Math.floor(rect.height * dpr)) > 1;
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
window.THREE = THREE;
window.controller = controller;
function rebuildRenderer(aa) {
  try {
    renderer.dispose();
  } catch {
  }
  renderer = new WebGLRenderer({ canvas, antialias: aa });
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  renderer.setPixelRatio(dpr);
  renderer.setSize(rect.width, rect.height, false);
}
let coopTimer = null;
function showCoopHint() {
  const el = document.getElementById("coop-hint");
  el.removeAttribute("hidden");
  if (coopTimer) window.clearTimeout(coopTimer);
  coopTimer = window.setTimeout(() => {
    el.setAttribute("hidden", "");
  }, 1400);
}
const selectRect = document.getElementById("select-rect");
let selecting = false;
let startX = 0, startY = 0;
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!toolbar.boxzoom.checked) return;
  if (!e.shiftKey || e.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  selecting = true;
  selectRect.style.left = `${startX}px`;
  selectRect.style.top = `${startY}px`;
  selectRect.style.width = "0px";
  selectRect.style.height = "0px";
  selectRect.removeAttribute("hidden");
});
let lastCenter = new Vector3(controller.getCenter().x, 0, controller.getCenter().y);
let lastTime = performance.now();
canvas.addEventListener("pointermove", (e) => {
  var _a, _b, _c;
  const rect = canvas.getBoundingClientRect();
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const gp = (_c = (_b = (_a = controller.transform).groundFromScreen) == null ? void 0 : _b.call(_a, pt)) != null ? _c : null;
  if (gp) anchorSphere.position.set(gp.gx, 0, gp.gz);
});
controller.on("renderFrame", () => {
  const now = performance.now();
  const dt = Math.max(1 / 120, (now - lastTime) / 1e3);
  lastTime = now;
  const c = controller.getCenter();
  const curr = new Vector3(c.x, 0, c.y);
  const delta = curr.clone().sub(lastCenter);
  lastCenter.copy(curr);
  const speed = delta.length() / dt;
  const dir = delta.lengthSq() > 1e-9 ? delta.clone().normalize() : new Vector3(1, 0, 0);
  velArrow.position.copy(curr);
  velArrow.setDirection(dir);
  velArrow.setLength(Math.min(200, speed * 50), 12, 6);
});
function updateDebugVisibility(show) {
  [gizmoGroup, anchorSphere, velArrow].forEach((obj) => obj.visible = show);
}
updateDebugVisibility(false);
window.addEventListener("pointermove", (e) => {
  if (!selecting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const left = Math.min(startX, x);
  const top = Math.min(startY, y);
  const w = Math.abs(x - startX);
  const h = Math.abs(y - startY);
  selectRect.style.left = `${left}px`;
  selectRect.style.top = `${top}px`;
  selectRect.style.width = `${w}px`;
  selectRect.style.height = `${h}px`;
});
window.addEventListener("pointerup", (e) => {
  if (!selecting) return;
  selecting = false;
  selectRect.setAttribute("hidden", "");
  const rect = renderer.domElement.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  const x0 = Math.min(startX, endX), y0 = Math.min(startY, endY);
  const x1 = Math.max(startX, endX), y1 = Math.max(startY, endY);
  const w0 = controller.transform.screenToWorld({ x: x0, y: y0 });
  const w1 = controller.transform.screenToWorld({ x: x1, y: y1 });
  if (w0 && w1) {
    controller.fitBounds({ min: { x: Math.min(w0.x, w1.x), y: Math.min(w0.y, w1.y) }, max: { x: Math.max(w0.x, w1.x), y: Math.max(w0.y, w1.y) } }, { padding: { top: 10, right: 10, bottom: 10, left: 10 } });
  }
});
//# sourceMappingURL=main-DoKGUaa0.js.map
