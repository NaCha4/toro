import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadToro, expressions } from "./toro.js";
import { createRoom } from "./room.js";
import { setupDisplayMode } from "./display.js";
import {
  createGreetingSequence,
  START_TORO_Z,
  CLOSEUP_TORO_Z,
} from "./greeting.js";
import { updateCameraFraming } from "./camera-framing.js";
import { createPettingMotion, bindHeadPetting } from "./petting.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import "./style.css";

const viewport = document.querySelector("#viewport");
const loading = document.querySelector("#loading");
const controlsPanel = document.querySelector(".controls");
const state = { expression: "normal", pose: "stand" };
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
setupDisplayMode();

function selectButton(attribute, value) {
  document.querySelectorAll(`[data-${attribute}]`).forEach((button) => {
    const selected = button.dataset[attribute] === value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

async function startViewer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xe8e3d7);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "등을 보인 토로. 터치하거나 Enter 키를 눌러 인사해 주세요.",
  );
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  const environment = pmrem.fromScene(studio, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.22;
  studio.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff0d5, 0x817759, 0.75));
  const key = new THREE.SpotLight(0xffedca, 90, 25, 1.3, 0.85, 2);
  key.position.set(0, 5.88, 0.1);
  key.target.position.set(0, 0, 0.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.blurSamples = 8;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 35;
  key.shadow.normalBias = 0.02;
  key.shadow.bias = -0.0001;
  scene.add(key);
  scene.add(key.target);
  RectAreaLightUniformsLib.init();
  const windowLight = new THREE.RectAreaLight(0xe7eddf, 2.6, 3.65, 2.9);
  windowLight.position.set(-5.98, 4.15, -0.25);
  windowLight.lookAt(0, 3, -0.25);
  scene.add(windowLight);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 3.8, 12);
  camera.lookAt(0, 2.5, -0.7);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const ambientOcclusion = new SSAOPass(scene, camera, 1, 1, 16);
  ambientOcclusion.kernelRadius = 0.42;
  ambientOcclusion.minDistance = 0.001;
  ambientOcclusion.maxDistance = 0.06;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(ambientOcclusion);
  composer.addPass(new OutputPass());

  let closeupProgress = 0;
  let panelHeight = 0;
  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const panelBounds = controlsPanel.getBoundingClientRect();
    panelHeight = controlsPanel.hidden
      ? 0
      : height - panelBounds.top + viewport.getBoundingClientRect().top;
    updateCameraFraming(camera, width, height, panelHeight, closeupProgress);
    renderer.setSize(width, height);
    composer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(viewport);
  new ResizeObserver(resize).observe(controlsPanel);
  window.visualViewport?.addEventListener("resize", resize);
  resize();

  const toro = await loadToro();
  const petting = createPettingMotion();
  toro.root.scale.multiplyScalar(0.91);
  toro.root.position.z = START_TORO_Z;
  scene.add(toro.root);
  const room = createRoom();
  scene.add(room.root);
  const expressionControls = document.querySelector("#expression-controls");
  for (const expression of expressions) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.dataset.expression = expression.id;
    button.dataset.expressionNumber = String(expression.number);
    button.setAttribute(
      "aria-label",
      `${expression.number}번 ${expression.label}`,
    );
    button.title = `${expression.number}번 ${expression.label}`;
    const preview = document.createElement("span");
    preview.className = "expression-preview";
    preview.style.backgroundImage = `url("${new URL("toro-expressions.png", document.baseURI).href}")`;
    preview.style.backgroundPosition = `${((expression.tile % 4) * 100) / 3}% ${(Math.floor(expression.tile / 4) * 100) / 3}%`;
    preview.setAttribute("aria-hidden", "true");
    const number = document.createElement("span");
    number.className = "expression-number";
    number.textContent = String(expression.number);
    number.setAttribute("aria-hidden", "true");
    button.append(preview, number);
    button.addEventListener("click", () => {
      petting.cancel();
      state.expression = expression.id;
      toro.setExpression(state.expression);
      selectButton("expression", state.expression);
    });
    expressionControls.append(button);
  }
  selectButton("expression", state.expression);
  document.querySelectorAll("[data-pose]").forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", () => {
      petting.cancel();
      state.pose = button.dataset.pose;
      selectButton("pose", state.pose);
    });
  });

  const viewer = document.querySelector("#viewer");
  const hint = document.querySelector("#tap-hint");
  const petHint = document.querySelector("#pet-hint");
  const previewButtons = document.querySelectorAll(
    "[data-pose], [data-expression]",
  );
  const phasePoses = {
    turning: "stand",
    greeting: "wave",
    pause: "stand",
    approaching: "walk",
    closeup: "stand",
  };
  const phaseLabels = {
    turning: "토로가 돌아서고 있어요",
    greeting: "2번 표정으로 인사하는 토로",
    pause: "1번 표정으로 잠시 기다리는 토로",
    approaching: "카메라 앞으로 걸어오는 토로",
    closeup:
      "카메라 가까이에서 바라보는 토로 얼굴. 머리를 누른 채 움직여 쓰다듬어 주세요.",
  };
  const greeting = createGreetingSequence((phase) => {
    petting.setEnabled(phase === "closeup");
    state.pose = phasePoses[phase];
    state.expression =
      phase === "turning" || phase === "greeting" ? "smile" : "normal";
    toro.setExpression(state.expression);
    selectButton("expression", state.expression);
    selectButton("pose", state.pose);
    previewButtons.forEach((button) => {
      button.disabled = phase !== "closeup";
    });
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", phaseLabels[phase]);
  });
  viewer.dataset.greetingState = greeting.phase;
  renderer.domElement.setAttribute("role", "button");
  toro.animate(0, "stand", false);
  toro.root.rotation.y = greeting.heading;

  function beginGreeting() {
    if (
      document.documentElement.dataset.viewerState !== "ready" ||
      greeting.phase !== "waiting"
    )
      return;
    greeting.start(reducedMotion.matches);
    hint.hidden = true;
    viewer.dataset.greetingState = greeting.phase;
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.isPrimary !== false && event.button === 0) beginGreeting();
  });
  bindHeadPetting({
    canvas: renderer.domElement,
    head: toro.head,
    camera,
    motion: petting,
    canInteract: () =>
      greeting.phase === "closeup" &&
      document.documentElement.dataset.viewerState === "ready" &&
      !document.hidden,
    onStroke: () => {
      state.expression = "content";
      state.pose = "stand";
      toro.setExpression(3);
      selectButton("expression", state.expression);
      selectButton("pose", state.pose);
    },
  });
  hint.addEventListener("click", beginGreeting);
  renderer.domElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      beginGreeting();
    }
  });
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    loading.textContent = "3D 연결이 끊겼습니다. 페이지를 새로고침해 주세요.";
    loading.hidden = false;
  });

  const timer = new THREE.Timer();
  timer.connect(document);
  let activeTime = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    if (
      document.documentElement.dataset.viewerState !== "ready" ||
      document.hidden
    )
      return;
    const delta = timer.getDelta();
    activeTime += delta;
    petting.update(delta);
    greeting.update(delta, reducedMotion.matches);
    closeupProgress = greeting.approachProgress;
    viewer.dataset.greetingState = greeting.phase;
    hint.hidden = !greeting.hintVisible;
    petHint.hidden = !petting.hintVisible;
    viewer.dataset.pettingState = petting.rubbing ? "rubbing" : "idle";
    toro.animate(
      activeTime,
      state.pose,
      !reducedMotion.matches,
      greeting.phase === "greeting" && !reducedMotion.matches
        ? greeting.waveBlend
        : 1,
      closeupProgress,
    );
    toro.applyPetting(petting.pose, reducedMotion.matches ? 0.55 : 1);
    toro.root.position.z = THREE.MathUtils.lerp(
      START_TORO_Z,
      CLOSEUP_TORO_Z,
      closeupProgress,
    );
    toro.root.rotation.y += greeting.heading;
    updateCameraFraming(
      camera,
      viewport.clientWidth,
      viewport.clientHeight,
      panelHeight,
      closeupProgress,
    );
    room.animate(activeTime, !reducedMotion.matches);
    composer.render();
  });
  loading.hidden = true;
  document.documentElement.dataset.studioReady = "true";
}

startViewer().catch((error) => {
  console.error("Unable to load Toro", error);
  loading.textContent =
    "모델을 불러오지 못했습니다. 새로고침하거나 WebGL 지원 브라우저에서 열어 주세요.";
});
