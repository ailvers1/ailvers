import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);

const dom = {
  startScreen: $("startScreen"),
  startBtnBig: $("startBtnBig"),
  previewBtnBig: $("previewBtnBig"),
  photoPreviewBg: $("photoPreviewBg"),
  photoInput: $("photoInput"),
  photoPreviewHint: $("photoPreviewHint"),
  topBar: $("topBar"),
  uiFoldBtn: $("uiFoldBtn"),
  productSelect: $("productSelect"),
  loadBtn: $("loadBtn"),
  placeBtn: $("placeBtn"),
  savePhotoBtn: $("savePhotoBtn"),
  undoBtn: $("undoBtn"),
  redoBtn: $("redoBtn"),
  clearBtn: $("clearBtn"),
  lockScale: $("lockScale"),
  scaleRange: $("scaleRange"),
  scaleValue: $("scaleValue"),
  dimensionToggle: $("dimensionToggle"),
  reticle: $("reticle"),
  arPlacementGuide: $("arPlacementGuide"),
  placementStatusText: $("placementStatusText"),
  placementDistance: $("placementDistance"),
  placementProductSize: $("placementProductSize"),
  placementStability: $("placementStability"),
  placementHelp: $("placementHelp"),
  editPanel: $("editPanel"),
  editHeader: $("editHeader"),
  editTitle: $("editTitle"),
  editDistance: $("editDistance"),
  editDoneBtn: $("editDoneBtn"),
  editStepBtn: $("editStepBtn"),
  placementResetBtn: $("placementResetBtn"),
  editControls: $("editControls"),
  toast: $("toast"),
  captureHint: $("captureHint"),
  captureHintBtn: $("captureHintBtn"),
  captureModeHint: $("captureModeHint"),
  captureStrip: $("captureStrip"),
  loadingOverlay: $("loadingOverlay"),
  loadingText: $("loadingText"),
  calibrationLayer: $("calibrationLayer"),
  calibrationSvg: $("calibrationSvg"),
  calibrationLine: $("calibrationLine"),
  calibrationPanel: $("calibrationPanel"),
  calibrationBody: $("calibrationBody"),
  calibrationToggleBtn: $("calibrationToggleBtn"),
  calibrationSummary: $("calibrationSummary"),
  calibrationPickBtn: $("calibrationPickBtn"),
  calibrationRepickBtn: $("calibrationRepickBtn"),
  calibrationLength: $("calibrationLength"),
  calibrationUnit: $("calibrationUnit"),
  calibrationApplyBtn: $("calibrationApplyBtn"),
  calibrationResetBtn: $("calibrationResetBtn"),
  calibrationReadout: $("calibrationReadout"),
  calibrationFineTune: $("calibrationFineTune"),
  calibrationFineTuneValue: $("calibrationFineTuneValue"),
  calibrationRestoreBtn: $("calibrationRestoreBtn"),
  objectControlsOverlay: $("objectControlsOverlay"),
  objectSelectionBox: $("objectSelectionBox"),
  objectToolbar: $("objectToolbar"),
  objectRotateHandle: $("objectRotateHandle"),
  objectTiltHandle: $("objectTiltHandle"),
  objectTransformReadout: $("objectTransformReadout"),
  objectResetBtn: $("objectResetBtn"),
  objectScaleHandle: $("objectScaleHandle"),

  moveForward: $("moveForward"),
  moveBack: $("moveBack"),
  moveLeft: $("moveLeft"),
  moveRight: $("moveRight"),
  rotateLeft: $("rotateLeft"),
  rotateRight: $("rotateRight"),
  tiltUp: $("tiltUp"),
  tiltDown: $("tiltDown"),
  heightUp: $("heightUp"),
  heightDown: $("heightDown")
};

let renderer;
let scene;
let camera;
let controller;
let orbitControls;
let reticleObject;
let placementGhost;
let placementGhostMaterial;
let previewGrid;

let hitTestSource = null;
let hitTestSourceRequested = false;
let arReferenceSpaceType = "local";
const smoothedReticlePosition = new THREE.Vector3();
let hasSmoothedReticlePosition = false;
let placementSamples = [];
let placementStable = false;
let placementDistanceMeters = 0;
let placementStabilityProgress = 0;
let currentHitTestResult = null;
let pendingAnchorObject = null;
let anchorRequestInFlight = false;
const lastStablePlacementMatrix = new THREE.Matrix4();
const lastViewerPosition = new THREE.Vector3();
let hasViewerPosition = false;
let previewMode = false;
let photoPreviewMode = false;
let photoPreviewObjectUrl = null;

let products = [];
let currentProduct = null;
let selectedObject = null;
let dimensionGroup = null;
let placedObjects = [];
let historyStack = [];
let redoStack = [];
let isRestoringHistory = false;
let editPanelExpanded = false;
let editMoveStepMeters = 0.05;
let uiFolded = false;
const previewPointers = new Map();
let previewGesture = null;
let previewGestureBefore = null;
let objectControlGesture = null;
let wheelScaleBefore = null;
let wheelScaleTimer = null;
const calibration = {
  points: [],
  isPicking: false,
  draggingIndex: null,
  applied: false,
  referenceMeters: 0,
  pixelLength: 0,
  pixelsPerMeter: 0,
  autoUserScale: 1,
  fineTune: 1
};

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const modelCache = new Map();
const textureCache = new Map();

const TEXTURE_SWAP_MS = 3000;
const TEXTURE_FADE_MS = 320;
const CAPTURE_HINT_MS = 4200;
const DIMENSION_COLOR = 0x38bdf8;
const FLOOR_NORMAL_MIN = Math.cos(THREE.MathUtils.degToRad(18));
const PLACEMENT_WINDOW_MS = 650;
const PLACEMENT_STABLE_MS = 450;
const PLACEMENT_MAX_DEVIATION = 0.035;
const PLACEMENT_JUMP_DISTANCE = 0.25;
// Field calibration: a detected 1.8 m floor hit measured about 1.2 m in reality.
const AR_FLOOR_DISTANCE_CORRECTION = 1.2 / 1.8;
const PLACEMENT_NEAR_DISTANCE = 1;
const PLACEMENT_FAR_DISTANCE = 4;
let captureHintTimer = null;
let captureModeHintTimer = null;
let captureUiHidden = false;
let captureUiArmedAt = 0;
const AI_KIOSK_TEXTURES = {
  screenMeshNames: new Set([
    "Object_5",
    "151_Object_5",
    "Object_6",
    "152_Object_6",
    "Object_7",
    "153_Object_7"
  ]),
  speakerMeshNames: new Set(["Object", "0_Object"]),
  screenFiles: [
    "textures/ai-kiosk-screen-1.jpg"
  ],
  speakerFile: "textures/speaker-side-vertical.png"
};

const PHOTO_KIOSK_TEXTURES = {
  screenMeshNames: new Set([
    "Plane009",
    "60_Plane009"
  ]),
  screenFiles: [
    "textures/photo-kiosk-screen-start.jpg"
  ]
};

const AI_KIOSK_OVERLAYS = {
  screen: {
    center: new THREE.Vector3(-0.1069, 1.265, -0.004),
    width: 0.678,
    height: 1.208
  },
  speaker: {
    center: new THREE.Vector3(0.3697, 1.1769, 0.006),
    width: 0.165,
    height: 0.356
  }
};

init();

async function init() {
  setupThree();
  setupLights();
  setupReticle();
  setupPreviewHelpers();
  bindEvents();
  await loadManifest();
  updateHistoryButtons();
  animate();
}

function setupThree() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1.35, 3);

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enabled = false;
  orbitControls.enableDamping = true;
  orbitControls.target.set(0, 0.95, 0);
  orbitControls.minDistance = 1.2;
  orbitControls.maxDistance = 5;
  orbitControls.maxPolarAngle = Math.PI * 0.48;

  controller = renderer.xr.getController(0);
  scene.add(controller);

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => {
    setTimeout(onResize, 250);
  });

  window.visualViewport?.addEventListener("resize", onResize);
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.35);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(1, 2, 1);
  scene.add(dir);
}

function setupReticle() {
  reticleObject = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.22, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9
    })
  );

  reticleObject.matrixAutoUpdate = false;
  reticleObject.visible = false;
  scene.add(reticleObject);

  placementGhost = new THREE.Group();
  placementGhost.name = "AR real-size placement preview";
  placementGhost.visible = false;
  scene.add(placementGhost);
}

function updatePlacementGhostDimensions() {
  if (!placementGhost) return;

  for (const child of [...placementGhost.children]) {
    placementGhost.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  if (!currentProduct) return;

  const width = Math.max(Number(currentProduct.width) || 0.5, 0.05);
  const height = Math.max(Number(currentProduct.height) || 1, 0.05);
  const depth = Math.max(Number(currentProduct.depth) || 0.5, 0.05);
  const boxGeometry = new THREE.BoxGeometry(width, height, depth);
  boxGeometry.translate(0, height / 2, 0);
  const edges = new THREE.EdgesGeometry(boxGeometry);

  placementGhostMaterial = new THREE.LineBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.78,
    depthTest: false
  });

  const outline = new THREE.LineSegments(edges, placementGhostMaterial);
  outline.renderOrder = 250;
  placementGhost.add(outline);
}

function setupPreviewHelpers() {
  previewGrid = new THREE.GridHelper(4, 20, 0x38bdf8, 0x334155);
  previewGrid.material.transparent = true;
  previewGrid.material.opacity = 0.35;
  previewGrid.visible = false;
  scene.add(previewGrid);
}

function bindEvents() {
  safeClick("startBtnBig", startAR);
  safeClick("previewBtnBig", () => {
    requestPhotoPreview();
  });

  safeClick("loadBtn", async () => {
    await preloadCurrentProduct();
  });

  safeClick("placeBtn", () => {
    placeCurrentProduct();
  });
  safeClick("savePhotoBtn", captureScreen);

  safeClick("undoBtn", undoLastAction);
  safeClick("redoBtn", redoLastAction);
  safeClick("editDoneBtn", completeEdit);
  safeClick("editStepBtn", toggleEditMoveStep);
  safeClick("placementResetBtn", resetSelectedPlacement);
  safeClick("uiFoldBtn", toggleUiFold);
  safeClick("captureHintBtn", captureScreen);
  window.addEventListener("pointerdown", restoreCaptureUiOnPointer, true);

  safeClick("clearBtn", clearAll);

  bindHoldTranslate("moveForward", "forward");
  bindHoldTranslate("moveBack", "back");
  bindHoldTranslate("moveLeft", "left");
  bindHoldTranslate("moveRight", "right");

  bindHoldRotate("rotateLeft", 1, "y");
  bindHoldRotate("rotateRight", -1, "y");
  bindHoldRotate("tiltUp", -1, "x");
  bindHoldRotate("tiltDown", 1, "x");

  bindHoldTranslate("heightUp", "up", "vertical");
  bindHoldTranslate("heightDown", "down", "vertical");

  if (dom.productSelect) {
    dom.productSelect.addEventListener("change", () => {
      const id = dom.productSelect.value;
      currentProduct = products.find((p) => p.id === id) || null;
      updatePlacementGhostDimensions();
      updatePlacementGuideUi("searching");
      showToast(`${currentProduct?.name || "제품"} 선택됨`);

      if (previewMode) {
        placePreviewProduct();
      }
    });
  }

  if (dom.lockScale && dom.scaleRange) {
    dom.lockScale.addEventListener("change", () => {
      dom.scaleRange.disabled = dom.lockScale.checked;

      if (selectedObject) {
        const before = snapshotScene();
        const userScale = dom.lockScale.checked ? 1 : Number(dom.scaleRange.value) / 100;
        applyUserScale(selectedObject, userScale);
        updateDimensionOverlay();
        recordHistory(before);
      }
    });
  }

  if (dom.scaleRange) {
    dom.scaleRange.addEventListener("input", () => {
      const pct = Number(dom.scaleRange.value);
      dom.scaleValue.textContent = `${pct}%`;

      if (selectedObject && !dom.lockScale.checked) {
        applyUserScale(selectedObject, pct / 100);
        updateDimensionOverlay();
      }
    });
  }

  dom.dimensionToggle?.addEventListener("change", updateDimensionOverlay);

  renderer.domElement.addEventListener("pointerdown", selectByPointer);
  renderer.domElement.addEventListener("pointerdown", onPhotoPreviewPointerDown);
  renderer.domElement.addEventListener("pointermove", onPhotoPreviewPointerMove);
  renderer.domElement.addEventListener("pointerup", onPhotoPreviewPointerEnd);
  renderer.domElement.addEventListener("pointercancel", onPhotoPreviewPointerEnd);
  renderer.domElement.addEventListener("wheel", onPhotoPreviewWheel, { passive: false });

  dom.objectRotateHandle?.addEventListener("pointerdown", (event) => startObjectControlGesture(event, "rotate"));
  dom.objectTiltHandle?.addEventListener("pointerdown", (event) => startObjectControlGesture(event, "tilt"));
  dom.objectScaleHandle?.addEventListener("pointerdown", (event) => startObjectControlGesture(event, "scale"));
  safeClick("objectResetBtn", resetSelectedObjectTransform);
  window.addEventListener("pointermove", onObjectControlPointerMove);
  window.addEventListener("pointerup", endObjectControlGesture);
  window.addEventListener("pointercancel", endObjectControlGesture);

  dom.photoInput?.addEventListener("change", handlePhotoPreviewFile);
  bindCalibrationEvents();
}

function safeClick(id, handler) {
  const el = document.getElementById(id);

  if (!el) {
    console.warn(`[버튼 없음] #${id}`);
    return;
  }

  el.addEventListener("click", handler);
}

function bindCalibrationEvents() {
  if (!dom.calibrationPanel || !dom.calibrationLayer) return;

  safeClick("calibrationToggleBtn", () => {
    const collapsed = dom.calibrationPanel.classList.toggle("collapsed");
    dom.calibrationToggleBtn.textContent = collapsed ? "열기" : "접기";
  });
  safeClick("calibrationPickBtn", startCalibrationPicking);
  safeClick("calibrationRepickBtn", startCalibrationPicking);
  safeClick("calibrationApplyBtn", () => applyReferenceCalibration(true));
  safeClick("calibrationResetBtn", () => resetCalibration(true));
  safeClick("calibrationRestoreBtn", () => {
    calibration.fineTune = 1;
    dom.calibrationFineTune.value = "100";
    dom.calibrationFineTuneValue.textContent = "100%";
    applyReferenceCalibration(true);
  });

  dom.calibrationFineTune?.addEventListener("input", () => {
    calibration.fineTune = Number(dom.calibrationFineTune.value) / 100;
    dom.calibrationFineTuneValue.textContent = `${dom.calibrationFineTune.value}%`;

    if (calibration.applied) {
      applyReferenceCalibration(false, false);
    }
  });

  document.querySelectorAll("[data-reference-cm]").forEach((button) => {
    button.addEventListener("click", () => {
      dom.calibrationLength.value = button.dataset.referenceCm;
      dom.calibrationUnit.value = "cm";
      refreshCalibrationReadout();
    });
  });

  dom.calibrationLayer.addEventListener("pointerdown", onCalibrationPointerDown);
  window.addEventListener("pointermove", onCalibrationPointerMove);
  window.addEventListener("pointerup", onCalibrationPointerUp);
  window.addEventListener("pointercancel", onCalibrationPointerUp);
}

function startCalibrationPicking() {
  if (!photoPreviewMode) {
    showToast("사진 배치 모드에서 기준 길이를 설정할 수 있습니다.");
    return;
  }

  calibration.points = [];
  calibration.isPicking = true;
  calibration.draggingIndex = null;
  calibration.applied = false;
  dom.calibrationLayer.classList.add("is-picking");
  dom.calibrationSummary.textContent = "기준 물체의 첫 번째 점을 선택하세요.";
  renderCalibrationOverlay();
  refreshCalibrationReadout();
}

function onCalibrationPointerDown(event) {
  const handle = event.target.closest?.(".calibrationHandle");

  if (handle) {
    calibration.draggingIndex = Number(handle.dataset.pointIndex);
    event.preventDefault();
    return;
  }

  if (!calibration.isPicking) return;

  event.preventDefault();
  const point = normalizeCalibrationPoint(event.clientX, event.clientY);
  calibration.points.push(point);

  if (calibration.points.length >= 2) {
    calibration.points = calibration.points.slice(0, 2);
    calibration.isPicking = false;
    dom.calibrationLayer.classList.remove("is-picking");
    dom.calibrationSummary.textContent = "두 점 선택 완료. 실제 길이를 입력해 주세요.";
  } else {
    dom.calibrationSummary.textContent = "두 번째 점을 선택하세요.";
  }

  renderCalibrationOverlay();
  refreshCalibrationReadout();
}

function onCalibrationPointerMove(event) {
  if (calibration.draggingIndex === null) return;

  event.preventDefault();
  calibration.points[calibration.draggingIndex] = normalizeCalibrationPoint(event.clientX, event.clientY);
  renderCalibrationOverlay();
  refreshCalibrationReadout();

  if (calibration.applied) {
    applyReferenceCalibration(false, false);
  }
}

function onCalibrationPointerUp() {
  calibration.draggingIndex = null;
}

function normalizeCalibrationPoint(clientX, clientY) {
  return {
    x: THREE.MathUtils.clamp(clientX / Math.max(window.innerWidth, 1), 0, 1),
    y: THREE.MathUtils.clamp(clientY / Math.max(window.innerHeight, 1), 0, 1)
  };
}

function renderCalibrationOverlay() {
  if (!dom.calibrationLayer) return;

  dom.calibrationLayer.classList.toggle("has-point-1", calibration.points.length >= 1);
  dom.calibrationLayer.classList.toggle("has-point-2", calibration.points.length >= 2);
  dom.calibrationLayer.classList.toggle("has-line", calibration.points.length >= 2);

  const handles = dom.calibrationLayer.querySelectorAll(".calibrationHandle");
  calibration.points.forEach((point, index) => {
    const handle = handles[index];
    if (!handle) return;
    handle.style.left = `${point.x * 100}%`;
    handle.style.top = `${point.y * 100}%`;
  });

  if (calibration.points.length >= 2 && dom.calibrationLine) {
    const [point1, point2] = calibration.points;
    dom.calibrationLine.setAttribute("x1", String(point1.x * 100));
    dom.calibrationLine.setAttribute("y1", String(point1.y * 100));
    dom.calibrationLine.setAttribute("x2", String(point2.x * 100));
    dom.calibrationLine.setAttribute("y2", String(point2.y * 100));
  }
}

function getCalibrationPixelLength() {
  if (calibration.points.length < 2) return 0;

  const [point1, point2] = calibration.points;
  return Math.hypot(
    (point2.x - point1.x) * window.innerWidth,
    (point2.y - point1.y) * window.innerHeight
  );
}

function getCalibrationReferenceMeters() {
  const value = Number(dom.calibrationLength?.value);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return dom.calibrationUnit?.value === "mm" ? value / 1000 : value / 100;
}

function applyReferenceCalibration(record = true, notify = true) {
  if (!photoPreviewMode) {
    if (notify) showToast("사진 배치 모드에서만 기준 길이를 적용할 수 있습니다.");
    return false;
  }

  if (!selectedObject || !currentProduct) {
    if (notify) showToast("제품을 먼저 배치해 주세요.");
    return false;
  }

  const pixelLength = getCalibrationPixelLength();
  const referenceMeters = getCalibrationReferenceMeters();

  if (calibration.points.length < 2) {
    if (notify) showToast("기준점 두 개를 먼저 선택해 주세요.");
    return false;
  }

  if (pixelLength < 24) {
    if (notify) showToast("기준점 사이를 더 넓게 지정해 주세요.");
    return false;
  }

  if (referenceMeters <= 0) {
    if (notify) showToast("실제 길이를 0보다 크게 입력해 주세요.");
    return false;
  }

  const before = record ? snapshotScene() : null;
  const productHeight = Number(selectedObject.userData.dimensions?.height || currentProduct.height);
  const productPixelHeight = (productHeight / referenceMeters) * pixelLength;
  const worldPosition = selectedObject.getWorldPosition(new THREE.Vector3());
  const objectDistance = Math.max(camera.position.distanceTo(worldPosition), 0.1);
  const targetWorldHeight = pixelHeightToWorldHeight(
    productPixelHeight,
    objectDistance,
    camera,
    window.innerHeight
  );
  const autoUserScale = targetWorldHeight / Math.max(productHeight, 0.0001);

  calibration.referenceMeters = referenceMeters;
  calibration.pixelLength = pixelLength;
  calibration.pixelsPerMeter = pixelLength / referenceMeters;
  calibration.autoUserScale = autoUserScale;
  calibration.applied = true;

  applyUserScale(selectedObject, autoUserScale * calibration.fineTune);
  updateDimensionOverlay();
  refreshCalibrationReadout();

  dom.calibrationSummary.textContent = `기준 ${formatReferenceLength(referenceMeters)} 적용됨`;
  if (record) recordHistory(before);
  if (notify) showToast("기준 길이에 맞춰 제품 크기를 보정했습니다.");
  return true;
}

function pixelHeightToWorldHeight(pixelHeight, objectDistance, perspectiveCamera, viewportHeight) {
  const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const visibleWorldHeight = 2 * Math.tan(verticalFov / 2) * objectDistance;
  return visibleWorldHeight * (pixelHeight / Math.max(viewportHeight, 1));
}

function resetCalibration(notify = true, resetProduct = true) {
  const before = selectedObject ? snapshotScene() : null;

  calibration.points = [];
  calibration.isPicking = false;
  calibration.draggingIndex = null;
  calibration.applied = false;
  calibration.referenceMeters = 0;
  calibration.pixelLength = 0;
  calibration.pixelsPerMeter = 0;
  calibration.autoUserScale = 1;
  calibration.fineTune = 1;

  dom.calibrationLayer?.classList.remove("is-picking");
  if (dom.calibrationFineTune) dom.calibrationFineTune.value = "100";
  if (dom.calibrationFineTuneValue) dom.calibrationFineTuneValue.textContent = "100%";
  if (dom.calibrationSummary) dom.calibrationSummary.textContent = "기준점이 설정되지 않았습니다.";

  if (resetProduct && selectedObject && photoPreviewMode) {
    applyUserScale(selectedObject, 1);
    updateDimensionOverlay();
    recordHistory(before);
  }

  renderCalibrationOverlay();
  refreshCalibrationReadout();
  if (notify) showToast("기준 길이 설정을 초기화했습니다.");
}

function refreshCalibrationReadout() {
  if (!dom.calibrationReadout) return;

  const pixelLength = getCalibrationPixelLength();
  const referenceMeters = getCalibrationReferenceMeters();
  const pixelsPerCm = referenceMeters > 0 ? pixelLength / (referenceMeters * 100) : 0;
  const productHeightMeters = Number(selectedObject?.userData?.dimensions?.height || currentProduct?.height || 0);
  const productPixelHeight = pixelsPerCm > 0 ? productHeightMeters * 100 * pixelsPerCm : 0;
  const rows = dom.calibrationReadout.querySelectorAll("span");

  if (rows[0]) rows[0].textContent = `화면 길이: ${pixelLength ? `${Math.round(pixelLength)} px` : "-"}`;
  if (rows[1]) rows[1].textContent = `환산값: ${pixelsPerCm ? `${pixelsPerCm.toFixed(2)} px/cm` : "-"}`;
  if (rows[2]) {
    rows[2].textContent = `제품 높이: ${productHeightMeters ? `${Math.round(productHeightMeters * 100)} cm${productPixelHeight ? ` → ${Math.round(productPixelHeight)} px` : ""}` : "-"}`;
  }
}

function formatReferenceLength(meters) {
  const centimeters = meters * 100;
  return `${Number.isInteger(centimeters) ? centimeters : centimeters.toFixed(1)} cm`;
}

function bindHoldRotate(id, direction, axis = "y") {
  const el = document.getElementById(id);

  if (!el) {
    console.warn(`[버튼 없음] #${id}`);
    return;
  }

  let frameId = null;
  let lastTime = 0;
  let beforeRotate = null;
  const speed = THREE.MathUtils.degToRad(45);

  const step = (time) => {
    if (!lastTime) {
      lastTime = time;
    }

    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    rotateSelected(direction * speed * delta, true, axis);
    frameId = requestAnimationFrame(step);
  };

  const start = (event) => {
    event.preventDefault();

    if (!selectedObject) {
      rotateSelected(0, false, axis);
      return;
    }

    if (frameId !== null) return;

    beforeRotate = snapshotScene();
    lastTime = 0;
    frameId = requestAnimationFrame(step);

    try {
      el.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is helpful, but not required for hold-to-rotate.
    }
  };

  const stop = (event) => {
    if (frameId === null) return;

    cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = 0;
    recordHistory(beforeRotate);
    beforeRotate = null;

    try {
      el.releasePointerCapture?.(event.pointerId);
    } catch {
      // Some mobile browsers release pointer capture automatically.
    }
  };

  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("pointerleave", stop);
}

function bindHoldTranslate(id, direction, mode = "plane") {
  const el = document.getElementById(id);
  if (!el) return;

  let holdTimer = null;
  let frameId = null;
  let lastTime = 0;
  let beforeMove = null;

  const applyStep = (distance) => {
    if (mode === "vertical") {
      applySelectedHeight(direction === "up" ? distance : -distance);
    } else {
      applySelectedMovement(direction, distance);
    }
    updateDimensionOverlay();
  };

  const animateHold = (time) => {
    if (!lastTime) lastTime = time;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    const speed = editMoveStepMeters === 0.01 ? 0.08 : 0.35;
    applyStep(speed * delta);
    frameId = requestAnimationFrame(animateHold);
  };

  const start = (event) => {
    event.preventDefault();
    if (!selectedObject) {
      showToast("이동할 제품을 먼저 선택하세요.");
      return;
    }

    beforeMove = snapshotScene();
    applyStep(editMoveStepMeters);
    holdTimer = window.setTimeout(() => {
      lastTime = 0;
      frameId = requestAnimationFrame(animateHold);
    }, 280);

    try {
      el.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional on mobile AR browsers.
    }
  };

  const stop = (event) => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    lastTime = 0;

    if (beforeMove) {
      recordHistory(beforeMove);
      beforeMove = null;
    }

    try {
      el.releasePointerCapture?.(event.pointerId);
    } catch {
      // Some browsers release pointer capture automatically.
    }
  };

  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("pointerleave", stop);
}

async function loadManifest() {
  try {
    const res = await fetch("manifest.json", { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`manifest.json 로드 실패: ${res.status}`);
    }

    const data = await res.json();
    products = data.products || [];

    dom.productSelect.innerHTML = "";

    for (const product of products) {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = `${product.name} (${Math.round(product.height * 1000)}mm)`;
      dom.productSelect.appendChild(option);
    }

    currentProduct = products[0] || null;

    if (currentProduct) {
      dom.productSelect.value = currentProduct.id;
    }

    updatePlacementGhostDimensions();
    updatePlacementGuideUi("searching");

    showToast("제품 목록 로드 완료");
  } catch (err) {
    console.error(err);
    showToast("manifest.json을 불러오지 못했습니다.");
  }
}

function resetPlacementTracking(state = "searching") {
  placementSamples = [];
  placementStable = false;
  placementDistanceMeters = 0;
  placementStabilityProgress = 0;
  currentHitTestResult = null;
  hasSmoothedReticlePosition = false;
  reticleObject.visible = false;
  if (placementGhost) placementGhost.visible = false;
  if (dom.reticle) dom.reticle.style.display = "none";
  updatePlacementGuideUi(state);
}

function updatePlacementGuideUi(state = "searching") {
  const guideVisible = isArSessionActive() && !previewMode && !selectedObject;
  const states = ["searching", "wrong-surface", "unstable", "stable", "near", "far"];

  dom.arPlacementGuide?.classList.remove(...states);
  dom.arPlacementGuide?.classList.add(state);
  dom.arPlacementGuide?.classList.toggle("show", guideVisible);
  dom.reticle?.classList.remove(...states);
  dom.reticle?.classList.add(state);

  const labels = {
    searching: ["바닥을 찾는 중", "휴대폰을 천천히 움직여 바닥을 인식해 주세요."],
    "wrong-surface": ["바닥이 아닙니다", "화면 중앙을 설치할 바닥 쪽으로 이동해 주세요."],
    unstable: ["위치를 확인하는 중", "초록색이 될 때까지 휴대폰을 잠시 고정해 주세요."],
    stable: ["배치 위치 확인 완료", "실측 윤곽을 확인한 뒤 배치하세요."],
    near: ["배치 가능 · 거리가 가깝습니다", "1~4m 거리에서 보면 실제 크기를 더 쉽게 비교할 수 있습니다."],
    far: ["배치 가능 · 거리가 멉니다", "4m 이내에서 배치하면 크기 확인이 더 정확합니다."]
  };
  const [title, help] = labels[state] || labels.searching;

  if (dom.placementStatusText) dom.placementStatusText.textContent = title;
  if (dom.placementHelp) dom.placementHelp.textContent = help;
  if (dom.placementDistance) {
    dom.placementDistance.textContent = placementDistanceMeters > 0
      ? `설치 거리 ${placementDistanceMeters.toFixed(1)}m`
      : "설치 거리 -";
  }
  if (dom.placementProductSize) {
    const heightCm = Math.round((Number(currentProduct?.height) || 0) * 100);
    dom.placementProductSize.textContent = heightCm ? `제품 높이 ${heightCm}cm` : "제품 높이 -";
  }

  const stabilityFill = dom.placementStability?.querySelector("i");
  if (stabilityFill) stabilityFill.style.width = `${Math.round(placementStabilityProgress * 100)}%`;

  if (placementGhostMaterial) {
    const color = state === "stable"
      ? 0x34d399
      : state === "near" || state === "far" || state === "unstable"
        ? 0xfbbf24
        : 0xfb7185;
    placementGhostMaterial.color.setHex(color);
  }

  if (dom.placeBtn && isArSessionActive() && !previewMode) {
    dom.placeBtn.disabled = !placementStable;
    dom.placeBtn.textContent = placementStable ? "📍 이 위치에 배치" : "바닥 인식 중";
  }
}

function updatePlacementCandidate(timestamp, frame, referenceSpace, hitTestResults) {
  const viewerPose = frame.getViewerPose(referenceSpace);

  if (viewerPose) {
    const p = viewerPose.transform.position;
    lastViewerPosition.set(p.x, p.y, p.z);
    hasViewerPosition = true;
  }

  const candidates = [];
  for (const result of hitTestResults) {
    const pose = result.getPose(referenceSpace);
    if (!pose) continue;

    const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    const normal = new THREE.Vector3(
      matrix.elements[4],
      matrix.elements[5],
      matrix.elements[6]
    ).normalize();
    const floorLevelOk = arReferenceSpaceType !== "local-floor" || Math.abs(position.y) <= 0.35;

    if (normal.y < FLOOR_NORMAL_MIN || !floorLevelOk) continue;

    if (hasViewerPosition) {
      position.x = lastViewerPosition.x
        + (position.x - lastViewerPosition.x) * AR_FLOOR_DISTANCE_CORRECTION;
      position.z = lastViewerPosition.z
        + (position.z - lastViewerPosition.z) * AR_FLOOR_DISTANCE_CORRECTION;
      matrix.setPosition(position);
    }

    const distance = hasViewerPosition
      ? Math.hypot(position.x - lastViewerPosition.x, position.z - lastViewerPosition.z)
      : position.length() * AR_FLOOR_DISTANCE_CORRECTION;
    candidates.push({ result, matrix, position, distance });
  }

  if (!candidates.length) {
    placementSamples = [];
    placementStable = false;
    placementStabilityProgress = 0;
    currentHitTestResult = null;
    reticleObject.visible = false;
    if (placementGhost) placementGhost.visible = false;
    dom.reticle.style.display = "none";
    updatePlacementGuideUi(hitTestResults.length ? "wrong-surface" : "searching");
    return;
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const candidate = candidates[0];
  placementDistanceMeters = candidate.distance;
  currentHitTestResult = candidate.result;

  const previous = placementSamples[placementSamples.length - 1];
  if (previous && previous.position.distanceTo(candidate.position) > PLACEMENT_JUMP_DISTANCE) {
    placementSamples = [];
  }

  placementSamples.push({ time: timestamp, position: candidate.position.clone() });
  placementSamples = placementSamples.filter((sample) => timestamp - sample.time <= PLACEMENT_WINDOW_MS);

  const mean = new THREE.Vector3();
  for (const sample of placementSamples) mean.add(sample.position);
  mean.multiplyScalar(1 / placementSamples.length);

  let squaredError = 0;
  for (const sample of placementSamples) squaredError += sample.position.distanceToSquared(mean);
  const rmsDeviation = Math.sqrt(squaredError / placementSamples.length);
  const sampleDuration = placementSamples.length > 1
    ? timestamp - placementSamples[0].time
    : 0;
  const timeProgress = THREE.MathUtils.clamp(sampleDuration / PLACEMENT_STABLE_MS, 0, 1);
  const qualityProgress = THREE.MathUtils.clamp(1 - rmsDeviation / PLACEMENT_MAX_DEVIATION, 0, 1);
  placementStabilityProgress = Math.min(timeProgress, qualityProgress);
  placementStable = placementSamples.length >= 8
    && sampleDuration >= PLACEMENT_STABLE_MS
    && rmsDeviation <= PLACEMENT_MAX_DEVIATION;

  if (
    !hasSmoothedReticlePosition ||
    smoothedReticlePosition.distanceToSquared(candidate.position) > PLACEMENT_JUMP_DISTANCE ** 2
  ) {
    smoothedReticlePosition.copy(candidate.position);
    hasSmoothedReticlePosition = true;
  } else {
    smoothedReticlePosition.lerp(candidate.position, placementStable ? 0.18 : 0.3);
  }

  const hitMatrix = candidate.matrix.clone();
  hitMatrix.setPosition(smoothedReticlePosition);
  const previewVisible = !selectedObject;
  reticleObject.visible = previewVisible;
  reticleObject.matrix.copy(hitMatrix);
  dom.reticle.style.display = previewVisible ? "block" : "none";

  if (placementStable) lastStablePlacementMatrix.copy(hitMatrix);

  if (placementGhost) {
    placementGhost.visible = previewVisible;
    placementGhost.position.copy(smoothedReticlePosition);
    if (hasViewerPosition) {
      placementGhost.rotation.set(
        0,
        Math.atan2(
          lastViewerPosition.x - smoothedReticlePosition.x,
          lastViewerPosition.z - smoothedReticlePosition.z
        ),
        0
      );
    }
  }

  let state = "unstable";
  if (placementStable) {
    if (placementDistanceMeters < PLACEMENT_NEAR_DISTANCE) state = "near";
    else if (placementDistanceMeters > PLACEMENT_FAR_DISTANCE) state = "far";
    else state = "stable";
  }
  updatePlacementGuideUi(state);
}

function queuePlacementAnchor(model) {
  pendingAnchorObject = model;
}

function requestPendingPlacementAnchor(hitResult) {
  if (!pendingAnchorObject || anchorRequestInFlight) return;
  if (!hitResult || typeof hitResult.createAnchor !== "function") {
    pendingAnchorObject = null;
    return;
  }

  const target = pendingAnchorObject;
  pendingAnchorObject = null;
  anchorRequestInFlight = true;

  hitResult.createAnchor().then((anchor) => {
    if (!placedObjects.includes(target)) {
      anchor.delete?.();
      return;
    }
    target.userData.xrAnchor = anchor;
    target.userData.anchorOffset = null;
  }).catch((err) => {
    console.warn("AR anchor unavailable; keeping local placement.", err);
  }).finally(() => {
    anchorRequestInFlight = false;
  });
}

function updateAnchoredObjects(frame, referenceSpace) {
  for (const object of placedObjects) {
    const anchor = object.userData.xrAnchor;
    if (!anchor?.anchorSpace) continue;
    const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
    if (!pose) continue;

    const anchorMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    if (!object.userData.anchorOffset) {
      object.updateMatrix();
      object.userData.anchorOffset = anchorMatrix.clone().invert().multiply(object.matrix.clone());
    }

    const worldMatrix = anchorMatrix.clone().multiply(object.userData.anchorOffset);
    worldMatrix.decompose(object.position, object.quaternion, object.scale);
  }
}

function releaseObjectAnchor(object) {
  const anchor = object?.userData?.xrAnchor;
  if (!anchor) return;
  try {
    anchor.delete?.();
  } catch {
    // The XR session may already have released the anchor.
  }
  object.userData.xrAnchor = null;
  object.userData.anchorOffset = null;
}

function rememberInitialPlacement(object) {
  object.userData.initialPlacement = {
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray()
  };
}

function resetSelectedPlacement() {
  const initial = selectedObject?.userData?.initialPlacement;
  if (!selectedObject || !initial) {
    showToast("처음 배치 위치가 없습니다.");
    return;
  }

  const before = snapshotScene();
  releaseObjectAnchor(selectedObject);
  selectedObject.position.fromArray(initial.position);
  selectedObject.quaternion.fromArray(initial.quaternion);
  selectedObject.scale.fromArray(initial.scale);
  updateDimensionOverlay();
  updateSelectedDistanceLabel();
  recordHistory(before);
  showToast("처음 배치 위치로 되돌렸습니다.");
}

function updateSelectedDistanceLabel() {
  if (!dom.editDistance) return;
  if (!selectedObject || !hasViewerPosition || photoPreviewMode) {
    dom.editDistance.textContent = photoPreviewMode && selectedObject ? "사진 위 배치" : "현재 거리 -";
    return;
  }

  const position = selectedObject.getWorldPosition(new THREE.Vector3());
  const distance = Math.hypot(
    position.x - lastViewerPosition.x,
    position.z - lastViewerPosition.z
  );
  dom.editDistance.textContent = `현재 거리 ${distance.toFixed(1)}m`;
}

async function startAR() {
  console.log("AR 시작 버튼 클릭됨");

  if (!navigator.xr) {
    alert("이 브라우저에서는 AR 배치가 지원되지 않습니다.\n\n3D 미리보기를 사용하거나 Android Chrome에서 다시 시도해주세요.");
    showToast("AR 미지원 브라우저입니다.");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");

    if (!supported) {
      alert("현재 기기/브라우저에서는 WebXR AR이 지원되지 않습니다.\n\n3D 미리보기로 제품을 확인하거나, Android Chrome + ARCore 지원 기기에서 다시 시도해주세요.");
      showToast("현재 기기에서 AR이 지원되지 않습니다.");
      return;
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor", "anchors"],
      domOverlay: { root: document.body }
    });

    arReferenceSpaceType = await chooseReferenceSpaceType(session);
    renderer.xr.setReferenceSpaceType(arReferenceSpaceType);
    await renderer.xr.setSession(session);

    previewMode = false;
    photoPreviewMode = false;
    document.body.classList.remove("photo-calibration-available");
    calibration.isPicking = false;
    calibration.draggingIndex = null;
    dom.calibrationLayer?.classList.remove("is-picking");
    uiFolded = false;
    updateUiFoldState();
    resetPlacementTracking("searching");
    dom.photoPreviewBg?.classList.remove("show");
    dom.photoPreviewHint?.classList.remove("show");
    orbitControls.enabled = false;
    previewGrid.visible = false;
    dom.startScreen.classList.add("hidden");
    dom.topBar.classList.add("show");
    dom.reticle.style.display = "none";
    if (dom.savePhotoBtn) dom.savePhotoBtn.textContent = "UI 숨기기";

    showToast(`AR 시작됨. 바닥을 비춰주세요. (${arReferenceSpaceType})`);

    session.addEventListener("end", () => {
      hitTestSourceRequested = false;
      hitTestSource = null;
      pendingAnchorObject = null;
      anchorRequestInFlight = false;
      for (const object of placedObjects) releaseObjectAnchor(object);
      resetPlacementTracking("searching");
      dom.reticle.style.display = "none";
      dom.arPlacementGuide?.classList.remove("show");
      exitCaptureUiMode(false);
      if (dom.placeBtn) {
        dom.placeBtn.disabled = false;
        dom.placeBtn.textContent = "📍 배치";
      }
      uiFolded = false;
      updateUiFoldState();
      dom.topBar.classList.remove("show");
      dom.startScreen.classList.remove("hidden");
    });

  } catch (err) {
    console.error("AR 시작 실패:", err);
    if (isReferenceSpaceError(err) && currentProduct) {
      alert("이 기기는 WebXR AR 기준 좌표계를 지원하지 않아 기본 AR 뷰어로 전환합니다.\n\n기본 AR 뷰어에서는 제품 확인은 가능하지만 앱 안의 이동/회전 버튼은 사용할 수 없습니다.");
      openNativeArFallback(currentProduct);
      showToast("기본 AR 뷰어로 전환합니다.");
      return;
    }

    alert("AR 시작 실패: " + err.message + "\n\n3D 미리보기 버튼으로 제품을 확인할 수 있습니다.");
    showToast("AR 시작 실패");
  }
}

function isReferenceSpaceError(err) {
  return String(err?.message || err).includes("reference space");
}

function openNativeArFallback(product) {
  const fileUrl = new URL(product.file, window.location.href).href;
  const fallbackUrl = new URL(window.location.href);
  fallbackUrl.searchParams.set("mode", "preview");

  const sceneViewerUrl =
    "intent://arvr.google.com/scene-viewer/1.0" +
    `?file=${encodeURIComponent(fileUrl)}` +
    "&mode=ar_preferred" +
    `&title=${encodeURIComponent(product.name)}` +
    "#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;" +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl.href)};end;`;

  window.location.href = sceneViewerUrl;
}

async function chooseReferenceSpaceType(session) {
  for (const type of ["local-floor", "local"]) {
    try {
      await session.requestReferenceSpace(type);
      return type;
    } catch (err) {
      console.warn(`Reference space not available: ${type}`, err);
    }
  }

  throw new Error("이 기기에서 사용할 수 있는 AR 기준 좌표계를 찾지 못했습니다.");
}

async function startPreview(message) {
  previewMode = true;
  photoPreviewMode = true;
  hitTestSourceRequested = false;
  hitTestSource = null;
  resetPlacementTracking("searching");
  previewGrid.visible = false;
  orbitControls.enabled = false;
  uiFolded = false;
  updateUiFoldState();

  dom.startScreen.classList.add("hidden");
  dom.topBar.classList.add("show");
  if (dom.savePhotoBtn) dom.savePhotoBtn.textContent = "이미지 저장";
  dom.reticle.style.display = "none";
  dom.arPlacementGuide?.classList.remove("show");
  if (dom.placeBtn) {
    dom.placeBtn.disabled = false;
    dom.placeBtn.textContent = "📍 배치";
  }
  dom.photoPreviewBg?.classList.add("show");
  dom.photoPreviewHint?.classList.add("show");
  document.body.classList.add("photo-calibration-available");
  renderCalibrationOverlay();
  refreshCalibrationReadout();

  await placePreviewProduct();
  showToast(message);
}

function requestPhotoPreview() {
  if (!dom.photoInput) {
    startPreview("사진 배경 3D 배치 모드입니다.");
    return;
  }

  dom.photoInput.value = "";
  dom.photoInput.click();
}

function handlePhotoPreviewFile(event) {
  const file = event.target.files?.[0];

  if (!file) {
    showToast("갤러리에서 사진을 선택하거나 새로 촬영해 주세요.");
    return;
  }

  resetCalibration(false, true);

  if (photoPreviewObjectUrl) {
    URL.revokeObjectURL(photoPreviewObjectUrl);
  }

  photoPreviewObjectUrl = URL.createObjectURL(file);

  if (dom.photoPreviewBg) {
    dom.photoPreviewBg.style.backgroundImage = `url("${photoPreviewObjectUrl}")`;
  }

  startPreview("선택한 사진 위에 제품을 올렸습니다.");
}

async function preloadCurrentProduct() {
  if (!currentProduct) {
    showToast("제품을 먼저 선택하세요.");
    return;
  }

  try {
    setLoading(true, "모델 불러오는 중...");
    showToast("모델 불러오는 중...");
    await loadModel(currentProduct);
    showToast("모델 준비 완료");
  } catch (err) {
    console.error(err);
    showToast("모델 로드 실패. 경로와 파일명을 확인하세요.");
  } finally {
    setLoading(false);
  }
}

async function placeCurrentProduct() {
  if (!currentProduct) {
    showToast("제품을 먼저 선택하세요.");
    return;
  }

  if (previewMode) {
    await placePreviewProduct();
    return;
  }

  if (!reticleObject.visible || !placementStable) {
    showToast("초록색 배치 위치가 표시될 때까지 잠시 기다려주세요.");
    return;
  }

  try {
    const before = snapshotScene();
    setLoading(true, `${currentProduct.name} 불러오는 중...`);
    const model = await loadModel(currentProduct);

    model.matrixAutoUpdate = true;
    model.position.setFromMatrixPosition(lastStablePlacementMatrix);
    faceModelToCamera(model);

    if (currentProduct.rotationYDeg) {
      model.rotation.y += THREE.MathUtils.degToRad(currentProduct.rotationYDeg);
    }

    rememberDefaultRotation(model);

    applyUserScale(model, dom.lockScale.checked ? 1 : Number(dom.scaleRange.value) / 100);

    model.userData.productId = currentProduct.id;
    model.userData.productName = currentProduct.name;
    model.userData.placementDistance = placementDistanceMeters;
    rememberInitialPlacement(model);

    scene.add(model);
    placedObjects.push(model);
    queuePlacementAnchor(model);
    recordHistory(before);
    uiFolded = true;
    updateUiFoldState();
    selectObject(model);
    if (!uiFolded) {
      showCapturePrompt();
    }

    showToast(`${currentProduct.name} 배치 완료. 화면저장을 눌러 촬영하세요.`);
  } catch (err) {
    console.error(err);
    showToast("모델 배치 실패");
  } finally {
    setLoading(false);
  }
}

async function placePreviewProduct() {
  if (!currentProduct) {
    showToast("제품을 먼저 선택하세요.");
    return;
  }

  try {
    const before = snapshotScene();
    setLoading(true, `${currentProduct.name} 불러오는 중...`);
    clearPlacedObjects();

    const model = await loadModel(currentProduct);
    model.matrixAutoUpdate = true;
    model.position.set(0, 0, 0);

    if (currentProduct.rotationYDeg) {
      model.rotation.y += THREE.MathUtils.degToRad(currentProduct.rotationYDeg);
    }

    rememberDefaultRotation(model);

    applyUserScale(model, dom.lockScale.checked ? 1 : Number(dom.scaleRange.value) / 100);

    model.userData.productId = currentProduct.id;
    model.userData.productName = currentProduct.name;

    scene.add(model);
    placedObjects.push(model);
    framePhotoPreviewCamera(model);
    selectObject(model);
    if (calibration.applied) {
      applyReferenceCalibration(false, false);
    }
    recordHistory(before);
    uiFolded = true;
    updateUiFoldState();
  } catch (err) {
    console.error(err);
    showToast("3D 미리보기 로드 실패");
  } finally {
    setLoading(false);
  }
}

function framePreviewCamera(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);

  orbitControls.target.copy(center);
  camera.position.set(center.x, center.y + radius * 0.35, center.z + radius * 1.8);
  camera.lookAt(center);
  orbitControls.update();
}

function framePhotoPreviewCamera(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);

  model.position.sub(center);
  model.position.y -= 0.12;
  model.rotation.x = 0;

  camera.position.set(0, 0.95, Math.max(4.2, maxSize * 2.2));
  camera.lookAt(0, 0.95, 0);
  camera.updateProjectionMatrix();
}

function faceModelToCamera(model) {
  const cameraPosition = new THREE.Vector3();
  camera.getWorldPosition(cameraPosition);

  const dx = cameraPosition.x - model.position.x;
  const dz = cameraPosition.z - model.position.z;

  if (dx * dx + dz * dz < 0.0001) {
    return;
  }

  model.rotation.set(0, Math.atan2(dx, dz), 0);
}

function rememberDefaultRotation(model) {
  model.userData.defaultRotation = {
    x: model.rotation.x,
    y: model.rotation.y,
    z: model.rotation.z
  };
}

function loadModel(product) {
  if (modelCache.has(product.id)) {
    const visualRoot = cloneModel(modelCache.get(product.id));
    safelyApplyProductTextures(product, visualRoot);
    const model = createPlacementAnchor(visualRoot, product);
    prepareProductScale(model, product);
    return Promise.resolve(model);
  }

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      product.file,
      (gltf) => {
        const root = gltf.scene;

        root.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(prepareMaterial);
            } else {
              prepareMaterial(child.material);
            }
          }
        });

        modelCache.set(product.id, root);
        const visualRoot = cloneModel(root);
        safelyApplyProductTextures(product, visualRoot);
        const model = createPlacementAnchor(visualRoot, product);
        prepareProductScale(model, product);
        resolve(model);
      },
      undefined,
      reject
    );
  });
}

function createPlacementAnchor(visualRoot, product) {
  visualRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(visualRoot);
  const center = box.getCenter(new THREE.Vector3());
  const anchor = new THREE.Group();

  anchor.name = `${product.name || product.id || "product"} placement anchor`;

  // GLB 파일마다 원점 위치가 달라도 AR 감지점에는 항상 제품의 바닥 중앙이 놓이게 한다.
  visualRoot.position.x -= center.x;
  visualRoot.position.y -= box.min.y;
  visualRoot.position.z -= center.z;
  visualRoot.updateMatrixWorld(true);

  anchor.add(visualRoot);
  anchor.userData.placementAnchor = "floor-center";
  return anchor;
}

function prepareProductScale(model, product) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetWidth = Number(product.width) || size.x;
  const targetHeight = Number(product.height) || size.y;
  const targetDepth = Number(product.depth) || size.z;
  const baseScale = {
    x: targetWidth / Math.max(size.x, 0.0001),
    y: targetHeight / Math.max(size.y, 0.0001),
    z: targetDepth / Math.max(size.z, 0.0001)
  };

  model.userData.baseScale = baseScale;
  model.userData.userScale = 1;
  model.userData.dimensions = {
    width: targetWidth,
    height: targetHeight,
    depth: targetDepth
  };
}

function getScaleBasis(size, axis) {
  if (axis === "x") return Math.max(size.x, 0.0001);
  if (axis === "y") return Math.max(size.y, 0.0001);
  if (axis === "z") return Math.max(size.z, 0.0001);

  return Math.max(size.x, size.y, size.z, 0.0001);
}

function applyUserScale(model, userScale = 1) {
  if (model?.userData?.xrAnchor) releaseObjectAnchor(model);
  const baseScale = getBaseScale(model);
  const nextUserScale = THREE.MathUtils.clamp(userScale, 0.25, 5);
  model.userData.userScale = nextUserScale;
  model.scale.set(
    baseScale.x * nextUserScale,
    baseScale.y * nextUserScale,
    baseScale.z * nextUserScale
  );
}

function getBaseScale(model) {
  const value = model?.userData?.baseScale;

  if (typeof value === "number") {
    return { x: value, y: value, z: value };
  }

  return {
    x: Number(value?.x) || 1,
    y: Number(value?.y) || 1,
    z: Number(value?.z) || 1
  };
}

function getUserScale(model) {
  return model?.userData?.userScale || 1;
}

function safelyApplyProductTextures(product, model) {
  try {
    applyProductTextures(product, model);
  } catch (err) {
    console.warn("Product texture application skipped.", err);
  }
}

function prepareMaterial(material) {
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.needsUpdate = true;
  }

  material.needsUpdate = true;
}

function applyProductTextures(product, root) {
  if (product.id === "ai_kiosk_white") {
    applyAiKioskTextures(root);
    return;
  }

  if (product.id === "photo_kiosk_black") {
    applyPhotoKioskTextures(root);
  }
}

function applyAiKioskTextures(root) {
  const screenTextures = AI_KIOSK_TEXTURES.screenFiles.map(loadAppTexture);
  const speakerTexture = loadAppTexture(AI_KIOSK_TEXTURES.speakerFile);

  root.traverse((child) => {
    if (!child.isMesh) return;

    const names = new Set([child.name, child.geometry?.name].filter(Boolean));
    const isScreen = [...names].some((name) => AI_KIOSK_TEXTURES.screenMeshNames.has(name));
    const isSpeaker = [...names].some((name) => AI_KIOSK_TEXTURES.speakerMeshNames.has(name));

    if (isScreen) {
      child.geometry = child.geometry.clone();
      ensurePlanarUv(child.geometry, "xy");
      child.material = new THREE.MeshBasicMaterial({
        map: screenTextures[0],
        toneMapped: false,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1
      });
      child.userData.screenTextures = screenTextures;
      child.userData.textureSwapMs = TEXTURE_SWAP_MS;
    }

    if (isSpeaker) {
      child.geometry = child.geometry.clone();
      ensurePlanarUv(child.geometry, "xy");
      child.material = new THREE.MeshStandardMaterial({
        map: speakerTexture,
        roughness: 0.72,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }
  });

  addAiKioskTextureOverlays(root, screenTextures, speakerTexture);
}

function applyPhotoKioskTextures(root) {
  const screenTextures = PHOTO_KIOSK_TEXTURES.screenFiles.map(loadAppTexture);

  root.traverse((child) => {
    if (!child.isMesh) return;

    const names = new Set([child.name, child.geometry?.name].filter(Boolean));
    const isScreen = [...names].some((name) => PHOTO_KIOSK_TEXTURES.screenMeshNames.has(name));

    if (isScreen) {
      child.geometry = child.geometry.clone();
      ensurePlanarUv(child.geometry, "yz");
      flipUv(child.geometry, true, true);
      child.material = new THREE.MeshBasicMaterial({
        map: screenTextures[0],
        toneMapped: false,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1
      });
      child.userData.screenTextures = screenTextures;
      child.userData.textureSwapMs = TEXTURE_SWAP_MS;
    }
  });
}

function addAiKioskTextureOverlays(root, screenTextures, speakerTexture) {
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(AI_KIOSK_OVERLAYS.screen.width, AI_KIOSK_OVERLAYS.screen.height),
    new THREE.MeshBasicMaterial({
      map: screenTextures[0],
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 1
    })
  );
  screen.name = "AI kiosk visible screen texture";
  screen.position.copy(AI_KIOSK_OVERLAYS.screen.center);
  screen.rotation.y = Math.PI;
  screen.renderOrder = 30;
  screen.userData.screenTextures = screenTextures;
  screen.userData.textureSwapMs = TEXTURE_SWAP_MS;
  root.add(screen);

  const speaker = new THREE.Mesh(
    new THREE.PlaneGeometry(AI_KIOSK_OVERLAYS.speaker.width, AI_KIOSK_OVERLAYS.speaker.height),
    new THREE.MeshBasicMaterial({
      map: speakerTexture,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      alphaTest: 0.08
    })
  );
  speaker.name = "AI kiosk visible speaker texture";
  speaker.position.copy(AI_KIOSK_OVERLAYS.speaker.center);
  speaker.rotation.y = Math.PI;
  speaker.renderOrder = 31;
  root.add(speaker);
}

function loadAppTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);

  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(url, texture);
  return texture;
}

function ensurePlanarUv(geometry, axes = "xy") {
  if (geometry.getAttribute("uv")) return;

  const position = geometry.getAttribute("position");
  if (!position) return;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;

  const uv = [];

  const axisA = axes[0];
  const axisB = axes[1];
  const indexA = axisA === "x" ? 0 : axisA === "y" ? 1 : 2;
  const indexB = axisB === "x" ? 0 : axisB === "y" ? 1 : 2;
  const min = [box.min.x, box.min.y, box.min.z];
  const max = [box.max.x, box.max.y, box.max.z];
  const sizeA = Math.max(max[indexA] - min[indexA], 0.0001);
  const sizeB = Math.max(max[indexB] - min[indexB], 0.0001);

  for (let i = 0; i < position.count; i += 1) {
    const a = position.getComponent(i, indexA);
    const b = position.getComponent(i, indexB);
    uv.push((a - min[indexA]) / sizeA, 1 - (b - min[indexB]) / sizeB);
  }

  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

function flipUv(geometry, flipU = false, flipV = false) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return;

  for (let i = 0; i < uv.count; i += 1) {
    if (flipU) uv.setX(i, 1 - uv.getX(i));
    if (flipV) uv.setY(i, 1 - uv.getY(i));
  }

  uv.needsUpdate = true;
}

function cloneModel(source) {
  const clone = source.clone(true);

  clone.traverse((child) => {
    if (!child.isMesh) return;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => m.clone());
    } else if (child.material) {
      child.material = child.material.clone();
    }
  });

  return clone;
}

function updateDynamicTextures(timestamp = 0) {
  const phase = timestamp % TEXTURE_SWAP_MS;
  const fadeOut = phase > TEXTURE_SWAP_MS - TEXTURE_FADE_MS
    ? (TEXTURE_SWAP_MS - phase) / TEXTURE_FADE_MS
    : 1;
  const fadeIn = phase < TEXTURE_FADE_MS ? phase / TEXTURE_FADE_MS : 1;
  const opacity = Math.max(0.18, Math.min(fadeOut, fadeIn, 1));

  for (const obj of placedObjects) {
    obj.traverse((child) => {
      if (!child.isMesh || !child.userData.screenTextures?.length || !child.material) return;

      const textureIndex = Math.floor(timestamp / TEXTURE_SWAP_MS) % child.userData.screenTextures.length;
      const nextTexture = child.userData.screenTextures[textureIndex];
      child.material.transparent = true;
      child.material.opacity = opacity;

      if (child.material.map !== nextTexture) {
        child.material.map = nextTexture;
        child.material.needsUpdate = true;
      }
    });
  }
}


function selectObject(obj) {
  selectedObject = obj;
  if (!obj) clearDimensionOverlay();

  if (!obj) {
    dom.editPanel.classList.remove("show");
    dom.editTitle.textContent = "선택된 제품 없음";
    updateSelectedDistanceLabel();
    updatePlacementGuideUi(placementStable ? "stable" : "unstable");
    hideObjectControlsOverlay();
    refreshCalibrationReadout();
    return;
  }

  dom.editPanel.classList.add("show");
  dom.editTitle.textContent = obj.userData.productName || "선택된 제품";
  updateSelectedDistanceLabel();
  dom.arPlacementGuide?.classList.remove("show");
  editPanelExpanded = !photoPreviewMode;
  updateEditPanelState();

  const scalePct = Math.round(getUserScale(obj) * 100);
  dom.scaleRange.value = scalePct;
  dom.scaleValue.textContent = `${scalePct}%`;
  updateDimensionOverlay();
  refreshCalibrationReadout();
  updateObjectControlsOverlay();
}

function onPhotoPreviewPointerDown(event) {
  if (!photoPreviewMode) return;

  const target = getPhotoObjectAt(event.clientX, event.clientY);
  if (!target) {
    selectObject(null);
    renderer.domElement.style.cursor = "default";
    return;
  }

  if (target !== selectedObject) selectObject(target);

  event.preventDefault();
  if (previewPointers.size === 0) previewGestureBefore = snapshotScene();
  previewPointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    startY: event.clientY,
    startScale: getUserScale(selectedObject),
    mode: event.shiftKey ? "scale" : "drag"
  });
  renderer.domElement.style.cursor = event.shiftKey ? "ns-resize" : "grabbing";

  try {
    renderer.domElement.setPointerCapture?.(event.pointerId);
  } catch {
    // Some mobile browsers manage capture automatically.
  }

  previewGesture = getPhotoPreviewGestureState();
}

function onPhotoPreviewPointerMove(event) {
  if (!photoPreviewMode) return;

  if (!previewPointers.has(event.pointerId)) {
    const hovered = getPhotoObjectAt(event.clientX, event.clientY);
    renderer.domElement.style.cursor = hovered ? "grab" : "default";
    dom.objectControlsOverlay?.classList.toggle("hovered", hovered === selectedObject && Boolean(selectedObject));
    return;
  }

  if (!selectedObject) return;

  event.preventDefault();
  const point = previewPointers.get(event.pointerId);
  point.x = event.clientX;
  point.y = event.clientY;

  const pointers = [...previewPointers.values()];

  if (pointers.length >= 2 && previewGesture?.type === "pinch") {
    const current = getTwoPointerMetrics(pointers[0], pointers[1]);
    const scaleRatio = current.distance / Math.max(previewGesture.distance, 1);
    const nextScale = THREE.MathUtils.clamp(previewGesture.scale * scaleRatio, 0.25, 2.6);
    const delta = screenDeltaToWorld(
      current.center.x - previewGesture.center.x,
      current.center.y - previewGesture.center.y,
      selectedObject.position
    );

    selectedObject.position.copy(previewGesture.position).add(delta);
    applyInteractiveScale(nextScale);
    selectedObject.rotation.z = previewGesture.rotationZ + current.angle - previewGesture.angle;
    updateDimensionOverlay();
  } else if (pointers.length === 1 && point.mode === "scale") {
    const deltaY = point.startY - point.y;
    const nextScale = point.startScale * Math.exp(deltaY * 0.006);
    applyInteractiveScale(nextScale);
  } else if (pointers.length === 1) {
    const dx = point.x - point.lastX;
    const dy = point.y - point.lastY;
    selectedObject.position.add(screenDeltaToWorld(dx, dy, selectedObject.position));
    updateDimensionOverlay();
  }

  point.lastX = point.x;
  point.lastY = point.y;
  updateObjectControlsOverlay();
}

function onPhotoPreviewPointerEnd(event) {
  if (!photoPreviewMode) return;

  previewPointers.delete(event.pointerId);

  try {
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture may already be released.
  }

  previewGesture = getPhotoPreviewGestureState();
  if (!previewPointers.size) {
    recordHistory(previewGestureBefore);
    previewGestureBefore = null;
    renderer.domElement.style.cursor = selectedObject ? "grab" : "default";
  }
}

function getPhotoPreviewGestureState() {
  if (!selectedObject) return null;

  const pointers = [...previewPointers.values()];

  if (pointers.length >= 2) {
    const metrics = getTwoPointerMetrics(pointers[0], pointers[1]);
    return {
      type: "pinch",
      ...metrics,
      position: selectedObject.position.clone(),
      scale: getUserScale(selectedObject),
      rotationZ: selectedObject.rotation.z
    };
  }

  return { type: "drag" };
}

function getPhotoObjectAt(clientX, clientY) {
  if (!photoPreviewMode || !placedObjects.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(placedObjects, true);
  if (!hits.length) return null;
  let target = hits[0].object;
  while (target.parent && !placedObjects.includes(target)) target = target.parent;
  return placedObjects.includes(target) ? target : null;
}

function applyInteractiveScale(requestedScale) {
  if (!selectedObject) return;
  let nextScale = THREE.MathUtils.clamp(requestedScale, 0.25, 3);

  if (calibration.applied) {
    calibration.fineTune = THREE.MathUtils.clamp(nextScale / Math.max(calibration.autoUserScale, 0.0001), 0.7, 1.3);
    nextScale = calibration.autoUserScale * calibration.fineTune;
    if (dom.calibrationFineTune) dom.calibrationFineTune.value = String(Math.round(calibration.fineTune * 100));
    if (dom.calibrationFineTuneValue) dom.calibrationFineTuneValue.textContent = `${Math.round(calibration.fineTune * 100)}%`;
  }

  applyUserScale(selectedObject, nextScale);
  syncScaleControl(nextScale);
  updateDimensionOverlay();
  updateObjectControlsOverlay();
}

function onPhotoPreviewWheel(event) {
  if (!photoPreviewMode || !selectedObject || !event.altKey) return;
  if (!getPhotoObjectAt(event.clientX, event.clientY)) return;
  event.preventDefault();
  if (!wheelScaleBefore) wheelScaleBefore = snapshotScene();
  const nextScale = getUserScale(selectedObject) * Math.exp(-event.deltaY * 0.0015);
  applyInteractiveScale(nextScale);
  clearTimeout(wheelScaleTimer);
  wheelScaleTimer = setTimeout(() => {
    recordHistory(wheelScaleBefore);
    wheelScaleBefore = null;
  }, 220);
}

function startObjectControlGesture(event, type) {
  if (!photoPreviewMode || !selectedObject) return;
  event.preventDefault();
  event.stopPropagation();
  objectControlGesture = {
    type,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScale: getUserScale(selectedObject),
    startRotationX: selectedObject.rotation.x,
    startRotationY: selectedObject.rotation.y,
    before: snapshotScene()
  };
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture is optional; window listeners continue the gesture.
  }
}

function onObjectControlPointerMove(event) {
  if (!objectControlGesture || event.pointerId !== objectControlGesture.pointerId || !selectedObject) return;
  event.preventDefault();
  const dx = event.clientX - objectControlGesture.startX;
  const dy = event.clientY - objectControlGesture.startY;

  if (objectControlGesture.type === "rotate") {
    selectedObject.rotation.y = objectControlGesture.startRotationY + dx * 0.012;
  } else if (objectControlGesture.type === "tilt") {
    const tiltLimit = THREE.MathUtils.degToRad(60);
    selectedObject.rotation.x = THREE.MathUtils.clamp(
      objectControlGesture.startRotationX - dy * 0.01,
      -tiltLimit,
      tiltLimit
    );
  } else if (objectControlGesture.type === "scale") {
    applyInteractiveScale(objectControlGesture.startScale * Math.exp((dx - dy) * 0.005));
  }

  updateDimensionOverlay();
  updateObjectControlsOverlay();
}

function endObjectControlGesture(event) {
  if (!objectControlGesture || event.pointerId !== objectControlGesture.pointerId) return;
  recordHistory(objectControlGesture.before);
  objectControlGesture = null;
}

function resetSelectedObjectTransform() {
  if (!photoPreviewMode || !selectedObject) return;
  const before = snapshotScene();
  const rotation = selectedObject.userData.defaultRotation || { x: 0, y: 0, z: 0 };
  selectedObject.rotation.set(rotation.x, rotation.y, rotation.z);

  if (calibration.applied) {
    calibration.fineTune = 1;
    if (dom.calibrationFineTune) dom.calibrationFineTune.value = "100";
    if (dom.calibrationFineTuneValue) dom.calibrationFineTuneValue.textContent = "100%";
    applyReferenceCalibration(false, false);
  } else {
    applyUserScale(selectedObject, 1);
    syncScaleControl(1);
  }

  updateDimensionOverlay();
  updateObjectControlsOverlay();
  recordHistory(before);
  showToast("제품 각도와 크기를 초기화했습니다.");
}

function updateObjectControlsOverlay() {
  if (!dom.objectControlsOverlay || !photoPreviewMode || !selectedObject || !camera) {
    hideObjectControlsOverlay();
    return;
  }

  const box = new THREE.Box3().setFromObject(selectedObject);
  if (box.isEmpty()) {
    hideObjectControlsOverlay();
    return;
  }

  const corners = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    corner.project(camera);
    const x = (corner.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-corner.y * 0.5 + 0.5) * window.innerHeight;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < 0 || minX > window.innerWidth || maxY < 0 || minY > window.innerHeight) {
    hideObjectControlsOverlay();
    return;
  }

  minX = THREE.MathUtils.clamp(minX, 6, window.innerWidth - 6);
  maxX = THREE.MathUtils.clamp(maxX, 6, window.innerWidth - 6);
  minY = THREE.MathUtils.clamp(minY, 6, window.innerHeight - 6);
  maxY = THREE.MathUtils.clamp(maxY, 6, window.innerHeight - 6);
  const width = Math.max(maxX - minX, 28);
  const height = Math.max(maxY - minY, 28);

  dom.objectControlsOverlay.classList.add("show");
  dom.objectControlsOverlay.setAttribute("aria-hidden", "false");
  if (dom.objectSelectionBox) {
    Object.assign(dom.objectSelectionBox.style, {
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${width}px`,
      height: `${height}px`
    });
  }
  if (dom.objectToolbar) {
    dom.objectToolbar.style.left = `${THREE.MathUtils.clamp((minX + maxX) / 2, 150, Math.max(window.innerWidth - 150, 150))}px`;
    dom.objectToolbar.style.top = `${Math.max(minY - 9, 48)}px`;
  }
  if (dom.objectScaleHandle) {
    dom.objectScaleHandle.style.left = `${maxX}px`;
    dom.objectScaleHandle.style.top = `${maxY}px`;
  }
  if (dom.objectTransformReadout) {
    const scalePercent = Math.round(getUserScale(selectedObject) * 100);
    const tiltDegrees = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.x));
    dom.objectTransformReadout.textContent = `${scalePercent}% · 상하 ${tiltDegrees}°`;
  }
}

function hideObjectControlsOverlay() {
  dom.objectControlsOverlay?.classList.remove("show", "hovered");
  dom.objectControlsOverlay?.setAttribute("aria-hidden", "true");
}

function getTwoPointerMetrics(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  return {
    center: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    },
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx)
  };
}

function screenDeltaToWorld(dx, dy, referencePosition) {
  const distance = Math.max(camera.position.distanceTo(referencePosition), 0.5);
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
  const visibleWidth = visibleHeight * camera.aspect;

  return new THREE.Vector3(
    (dx / window.innerWidth) * visibleWidth,
    (-dy / window.innerHeight) * visibleHeight,
    0
  );
}

function syncScaleControl(scale) {
  const pct = Math.round(scale * 100);
  dom.scaleRange.value = pct;
  dom.scaleValue.textContent = `${pct}%`;
}

function toggleEditPanel() {
  if (!selectedObject) {
    showToast("조작할 제품을 먼저 선택하세요.");
    return;
  }

  editPanelExpanded = !editPanelExpanded;
  updateEditPanelState();
}

function toggleEditMoveStep() {
  editMoveStepMeters = editMoveStepMeters === 0.05 ? 0.01 : 0.05;
  updateEditMoveStepUi();
  showToast(`이동 단위 ${Math.round(editMoveStepMeters * 100)}cm`);
}

function updateEditMoveStepUi() {
  const stepCm = Math.round(editMoveStepMeters * 100);

  if (dom.editStepBtn) {
    dom.editStepBtn.textContent = stepCm === 1 ? "미세 이동 1cm" : "이동 단위 5cm";
    dom.editStepBtn.classList.toggle("fine", stepCm === 1);
  }

  if (dom.heightUp) dom.heightUp.textContent = `+ ${stepCm}cm`;
  if (dom.heightDown) dom.heightDown.textContent = `− ${stepCm}cm`;
}

function completeEdit() {
  if (!selectedObject) return;

  selectObject(null);
  showToast("제품 조작 완료. 제품을 다시 누르면 조작 패널이 열립니다.");
}

function toggleUiFold() {
  uiFolded = !uiFolded;
  updateUiFoldState();
}

function updateUiFoldState() {
  dom.topBar?.classList.toggle("folded", uiFolded);
  document.body.classList.toggle("ui-clean", uiFolded);

  if (dom.uiFoldBtn) {
    dom.uiFoldBtn.textContent = uiFolded ? "화면 펼치기" : "화면 접기";
    dom.uiFoldBtn.setAttribute("aria-expanded", String(!uiFolded));
  }

  if (uiFolded && dom.editPanel?.classList.contains("show")) {
    editPanelExpanded = false;
    updateEditPanelState();
  }

  if (uiFolded) {
    hideCapturePrompt();
  }
}

function updateEditPanelState() {
  if (!dom.editPanel) return;
  dom.editPanel.classList.toggle("collapsed", !editPanelExpanded);
  updateEditMoveStepUi();
}

function selectByPointer(event) {
  if (photoPreviewMode) return;
  if (!placedObjects.length) return;

  const rect = renderer.domElement.getBoundingClientRect();

  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(placedObjects, true);

  if (!hits.length) {
    selectObject(null);
    return;
  }

  let target = hits[0].object;

  while (target.parent && !placedObjects.includes(target)) {
    target = target.parent;
  }

  selectObject(target);
}

function moveSelected(direction) {
  if (!selectedObject) {
    showToast("이동할 제품을 선택하세요.");
    return;
  }

  const before = snapshotScene();
  applySelectedMovement(direction, editMoveStepMeters);
  updateDimensionOverlay();
  recordHistory(before);
}

function applySelectedMovement(direction, distance) {
  if (!selectedObject) return;
  releaseObjectAnchor(selectedObject);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;

  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const delta = new THREE.Vector3();

  if (direction === "forward") {
    delta.copy(forward).multiplyScalar(distance);
  } else if (direction === "back") {
    delta.copy(forward).multiplyScalar(-distance);
  } else if (direction === "left") {
    delta.copy(right).multiplyScalar(-distance);
  } else if (direction === "right") {
    delta.copy(right).multiplyScalar(distance);
  }

  selectedObject.position.add(delta);
  updateSelectedDistanceLabel();
}

function rotateSelected(rad, silent = false, axis = "y") {
  if (!selectedObject) {
    if (!silent) {
      showToast("회전할 제품을 선택하세요.");
    }
    return;
  }

  releaseObjectAnchor(selectedObject);

  if (axis === "x") {
    const tiltLimit = THREE.MathUtils.degToRad(60);
    selectedObject.rotation.x = THREE.MathUtils.clamp(
      selectedObject.rotation.x + rad,
      -tiltLimit,
      tiltLimit
    );
  } else {
    selectedObject.rotation.y += rad;
  }
  updateDimensionOverlay();
}

function heightSelected(dy) {
  if (!selectedObject) {
    showToast("높이를 조정할 제품을 선택하세요.");
    return;
  }

  const before = snapshotScene();
  applySelectedHeight(dy);
  updateDimensionOverlay();
  recordHistory(before);
}

function applySelectedHeight(dy) {
  if (!selectedObject) return;
  releaseObjectAnchor(selectedObject);
  selectedObject.position.y += dy;
  updateSelectedDistanceLabel();
}

function updateDimensionOverlay() {
  clearDimensionOverlay();

  if (!dom.dimensionToggle?.checked || !selectedObject) return;

  const box = new THREE.Box3().setFromObject(selectedObject);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  const max = box.max;
  const pad = Math.max(Math.max(size.x, size.y, size.z) * 0.06, 0.045);
  const y = min.y + pad * 0.35;
  const width = size.x;
  const height = size.y;
  const depth = size.z;

  dimensionGroup = new THREE.Group();
  dimensionGroup.name = "Dimension overlay";
  dimensionGroup.renderOrder = 200;

  const x0 = min.x;
  const x1 = max.x;
  const z0 = min.z;
  const z1 = max.z;
  const rightX = max.x + pad;
  const frontZ = max.z + pad;

  addDimensionLine(
    new THREE.Vector3(x0, y, frontZ),
    new THREE.Vector3(x1, y, frontZ),
    formatMm(width),
    new THREE.Vector3((x0 + x1) / 2, y + pad * 0.55, frontZ)
  );
  addDimensionLine(
    new THREE.Vector3(rightX, min.y, z1),
    new THREE.Vector3(rightX, max.y, z1),
    formatMm(height),
    new THREE.Vector3(rightX + pad * 0.55, (min.y + max.y) / 2, z1)
  );
  addDimensionLine(
    new THREE.Vector3(rightX, y, z0),
    new THREE.Vector3(rightX, y, z1),
    formatMm(depth),
    new THREE.Vector3(rightX + pad * 0.55, y + pad * 0.55, (z0 + z1) / 2)
  );

  scene.add(dimensionGroup);
}

function clearDimensionOverlay() {
  if (!dimensionGroup) return;

  scene.remove(dimensionGroup);
  dimensionGroup.traverse((child) => {
    child.geometry?.dispose?.();
    child.material?.map?.dispose?.();
    child.material?.dispose?.();
  });
  dimensionGroup = null;
}

function addDimensionLine(start, end, label, labelPosition) {
  const material = new THREE.LineBasicMaterial({
    color: DIMENSION_COLOR,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 200;
  dimensionGroup.add(line);

  const tickSize = Math.max(start.distanceTo(end) * 0.025, 0.035);
  addTick(start, end, tickSize);
  addTick(end, start, tickSize);
  dimensionGroup.add(createTextSprite(label, labelPosition));
}

function addTick(point, toward, size) {
  const dir = toward.clone().sub(point).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, up);
  if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
  side.normalize().multiplyScalar(size);

  const geometry = new THREE.BufferGeometry().setFromPoints([
    point.clone().sub(side),
    point.clone().add(side)
  ]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: DIMENSION_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    })
  );
  line.renderOrder = 200;
  dimensionGroup.add(line);
}

function createTextSprite(text, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
  ctx.lineWidth = 6;
  roundRect(ctx, 18, 30, 476, 92, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0f7ff";
  ctx.font = "700 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 78);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true
  }));
  sprite.position.copy(position);
  sprite.scale.set(0.34, 0.106, 1);
  sprite.renderOrder = 201;
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function formatMm(valueMeters) {
  return `${Math.round(valueMeters * 1000)}mm`;
}

function clearAll() {
  if (!placedObjects.length) {
    showToast("삭제할 제품이 없습니다.");
    return;
  }

  if (!confirm("배치된 제품을 모두 삭제할까요?")) {
    return;
  }

  const before = snapshotScene();
  clearPlacedObjects();
  selectObject(null);
  recordHistory(before);
  showToast("전체 삭제 완료");
}

function clearPlacedObjects() {
  clearDimensionOverlay();
  hideObjectControlsOverlay();
  selectedObject = null;
  dom.editPanel?.classList.remove("show");
  if (dom.editTitle) dom.editTitle.textContent = "선택된 제품 없음";

  for (const obj of placedObjects) {
    releaseObjectAnchor(obj);
    scene.remove(obj);
  }

  placedObjects = [];
  pendingAnchorObject = null;
}

function snapshotScene() {
  return placedObjects.map((obj) => ({
    productId: obj.userData.productId,
    productName: obj.userData.productName,
    position: obj.position.toArray(),
    quaternion: obj.quaternion.toArray(),
    scale: obj.scale.toArray()
  }));
}

function recordHistory(before) {
  if (isRestoringHistory || !before) return;

  const after = snapshotScene();

  if (JSON.stringify(before) === JSON.stringify(after)) {
    return;
  }

  historyStack.push(before);

  if (historyStack.length > 50) {
    historyStack.shift();
  }

  redoStack = [];
  updateHistoryButtons();
}

async function undoLastAction() {
  if (!historyStack.length || isRestoringHistory) {
    showToast("취소할 작업이 없습니다.");
    return;
  }

  const current = snapshotScene();
  const previous = historyStack.pop();
  redoStack.push(current);
  await restoreScene(previous);
  updateHistoryButtons();
  showToast("이전 작업으로 되돌렸습니다.");
}

async function redoLastAction() {
  if (!redoStack.length || isRestoringHistory) {
    showToast("복구할 작업이 없습니다.");
    return;
  }

  const current = snapshotScene();
  const next = redoStack.pop();
  historyStack.push(current);
  await restoreScene(next);
  updateHistoryButtons();
  showToast("작업을 다시 적용했습니다.");
}

async function restoreScene(snapshot) {
  isRestoringHistory = true;

  try {
    clearPlacedObjects();

    for (const item of snapshot) {
      const product = products.find((p) => p.id === item.productId);

      if (!product) continue;

      const model = await loadModel(product);
      if (product.rotationYDeg) {
        model.rotation.y += THREE.MathUtils.degToRad(product.rotationYDeg);
      }
      rememberDefaultRotation(model);
      model.position.fromArray(item.position);
      model.quaternion.fromArray(item.quaternion);
      model.scale.fromArray(item.scale);
      const baseScale = getBaseScale(model);
      model.userData.userScale = model.scale.x / baseScale.x;
      model.userData.productId = item.productId;
      model.userData.productName = item.productName || product.name;
      rememberInitialPlacement(model);

      scene.add(model);
      placedObjects.push(model);
    }

    selectObject(placedObjects[placedObjects.length - 1] || null);
  } finally {
    isRestoringHistory = false;
  }
}

function updateHistoryButtons() {
  if (dom.undoBtn) {
    dom.undoBtn.disabled = !historyStack.length;
  }

  if (dom.redoBtn) {
    dom.redoBtn.disabled = !redoStack.length;
  }
}

async function captureScreen() {
  if (isArSessionActive()) {
    enterCaptureUiMode();
    return;
  }

  try {
    const url = photoPreviewMode && photoPreviewObjectUrl
      ? await createPhotoCompositeDataUrl()
      : renderer.domElement.toDataURL("image/png");
    const blob = dataUrlToBlob(url);
    const file = new File([blob], `sysmate-ar-${Date.now()}.png`, { type: "image/png" });

    const img = document.createElement("img");
    img.src = url;
    img.addEventListener("click", () => {
      const win = window.open();
      win.document.write(`<img src="${url}" style="max-width:100%">`);
    });

    dom.captureStrip.prepend(img);

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "SYSMATE AR 화면"
      });
      showToast("화면저장 공유창을 열었습니다.");
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      showToast("화면저장 완료");
    }

    hideCapturePrompt();
  } catch (err) {
    console.error(err);

    if (err?.name === "AbortError") {
      showToast("화면저장을 취소했습니다.");
    } else {
      showToast("캡처 실패");
    }
  }
}

function isArSessionActive() {
  return Boolean(renderer?.xr?.isPresenting && !previewMode);
}

function enterCaptureUiMode() {
  if (!isArSessionActive() || captureUiHidden) return;

  captureUiHidden = true;
  captureUiArmedAt = performance.now() + 350;
  hideCapturePrompt();
  document.body.classList.add("capture-ui-hidden");
  dom.captureModeHint?.classList.remove("is-clear");

  clearTimeout(captureModeHintTimer);
  captureModeHintTimer = setTimeout(() => {
    dom.captureModeHint?.classList.add("is-clear");
  }, 1900);
}

function restoreCaptureUiOnPointer(event) {
  if (!captureUiHidden || performance.now() < captureUiArmedAt) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  exitCaptureUiMode(true);
}

function exitCaptureUiMode(showMessage = false) {
  if (!captureUiHidden && !document.body.classList.contains("capture-ui-hidden")) return;

  captureUiHidden = false;
  captureUiArmedAt = 0;
  document.body.classList.remove("capture-ui-hidden");
  dom.captureModeHint?.classList.add("is-clear");
  clearTimeout(captureModeHintTimer);
  captureModeHintTimer = null;

  if (showMessage) showToast("조작 화면을 다시 표시했습니다.");
}

function showPhoneScreenshotGuide() {
  alert(
    "AR 카메라 화면은 브라우저 보안 제한 때문에 앱 내부 저장으로는 하얗게 나올 수 있습니다.\n\n" +
    "지금 보이는 화면 그대로 저장하려면 휴대폰 자체 스크린샷을 사용해주세요.\n\n" +
    "갤럭시: 전원 버튼 + 볼륨 아래 버튼을 동시에 짧게 누르기"
  );
  showToast("전원 + 볼륨 아래 버튼으로 화면을 캡처하세요.");
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

async function createPhotoCompositeDataUrl() {
  const canvas = document.createElement("canvas");
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const bg = await loadImage(photoPreviewObjectUrl);
  drawImageCover(ctx, bg, width, height);
  ctx.drawImage(renderer.domElement, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageCover(ctx, img, width, height) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

function showCapturePrompt() {
  if (dom.captureHint?.querySelector("span")) {
    dom.captureHint.querySelector("span").textContent =
      "캡처: 휴대폰 전원 버튼 + 볼륨 아래 버튼";
  }

  if (dom.captureHint) {
    dom.captureHint.classList.add("show");
  }

  clearTimeout(captureHintTimer);
  captureHintTimer = setTimeout(hideCapturePrompt, CAPTURE_HINT_MS);
}

function hideCapturePrompt() {
  if (dom.captureHint) {
    dom.captureHint.classList.remove("show");
  }

  clearTimeout(captureHintTimer);
  captureHintTimer = null;
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (previewMode) {
    orbitControls.update();
  }

  updateDynamicTextures(timestamp);

  if (frame) {
    const session = renderer.xr.getSession();
    const referenceSpace = renderer.xr.getReferenceSpace();

    updateAnchoredObjects(frame, referenceSpace);
    updateSelectedDistanceLabel();

    if (!hitTestSourceRequested) {
      getHitTestReferenceSpace(session).then((referenceSpace) => {
        session.requestHitTestSource({ space: referenceSpace }).then((source) => {
          hitTestSource = source;
        });
      }).catch((err) => {
        console.error("Hit-test reference space failed:", err);
        showToast("바닥 인식 기준을 만들지 못했습니다.");
      });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      updatePlacementCandidate(timestamp, frame, referenceSpace, hitTestResults);
      if (pendingAnchorObject && placementStable) {
        requestPendingPlacementAnchor(currentHitTestResult);
      }
    }
  }

  renderer.render(scene, camera);
  updateObjectControlsOverlay();
}

async function getHitTestReferenceSpace(session) {
  try {
    return await session.requestReferenceSpace("viewer");
  } catch (err) {
    console.warn("Viewer reference space unavailable. Falling back to AR reference space.", err);
    return session.requestReferenceSpace(arReferenceSpaceType);
  }
}

function onResize() {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderCalibrationOverlay();
  updateObjectControlsOverlay();

  if (calibration.applied && photoPreviewMode && selectedObject) {
    applyReferenceCalibration(false, false);
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.style.display = "block";

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    dom.toast.style.display = "none";
  }, 1800);
}

function setLoading(show, message = "모델 불러오는 중...") {
  if (!dom.loadingOverlay) return;

  if (dom.loadingText) {
    dom.loadingText.textContent = message;
  }

  dom.loadingOverlay.classList.toggle("show", show);

  if (dom.loadBtn) dom.loadBtn.disabled = show;
  if (dom.placeBtn) dom.placeBtn.disabled = show;
  if (dom.productSelect) dom.productSelect.disabled = show;
}
