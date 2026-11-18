import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadToro, expressions } from "./toro.js";
import { createRoom } from "./room.js";
import { setupDisplayMode } from "./display.js";
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
    "다다미 방 안에 서 있는 토로. 드래그 또는 방향키로 둘러보기, 스크롤로 확대, R 키로 시점 초기화.",
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
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 9;
  orbit.maxDistance = 15;
  orbit.minPolarAngle = 1.2;
  orbit.maxPolarAngle = 1.52;
  orbit.minAzimuthAngle = -0.2;
  orbit.maxAzimuthAngle = 0.33;
  orbit.target.set(0, 2.5, -0.7);
  camera.position.set(2.6, 4.1, 12.0);
  orbit.update();
  orbit.saveState();
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

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    camera.aspect = width / height;
    const panelBounds = controlsPanel.getBoundingClientRect();
    const panelHeight = controlsPanel.hidden
      ? 0
      : height - panelBounds.top + viewport.getBoundingClientRect().top;
    const shortLandscape = width > height && height <= 500;
    const availableHeight = Math.max(160, height - panelHeight - 12);
    const halfHeight = Math.max(
      ((shortLandscape ? 3.1 : 3.7) * height) / availableHeight,
      3.6 / camera.aspect,
    );
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / 13.1));
    camera.setViewOffset(width, height, 0, panelHeight / 2, width, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(viewport);
  new ResizeObserver(resize).observe(controlsPanel);
  window.visualViewport?.addEventListener("resize", resize);
  resize();

  const toro = await loadToro();
  toro.root.scale.multiplyScalar(0.91);
  toro.root.position.z = 0.9;
  scene.add(toro.root);
  const room = createRoom();
  scene.add(room.root);
  const expressionControls = document.querySelector("#expression-controls");
  for (const expression of expressions) {
    const button = document.createElement("button");
    button.type = "button";
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
      state.expression = expression.id;
      toro.setExpression(state.expression);
      selectButton("expression", state.expression);
    });
    expressionControls.append(button);
  }
  selectButton("expression", state.expression);
  document.querySelectorAll("[data-pose]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pose = button.dataset.pose;
      selectButton("pose", state.pose);
    });
  });

  renderer.domElement.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      orbit.reset();
      event.preventDefault();
      return;
    }
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(orbit.target),
    );
    const increments = {
      ArrowLeft: [-0.12, 0],
      ArrowRight: [0.12, 0],
      ArrowUp: [0, -0.12],
      ArrowDown: [0, 0.12],
    };
    if (!increments[event.key]) return;
    event.preventDefault();
    spherical.theta += increments[event.key][0];
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + increments[event.key][1],
      orbit.minPolarAngle,
      orbit.maxPolarAngle,
    );
    spherical.theta = THREE.MathUtils.clamp(
      spherical.theta,
      orbit.minAzimuthAngle,
      orbit.maxAzimuthAngle,
    );
    camera.position
      .copy(orbit.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    orbit.update();
  });
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    loading.textContent = "3D 연결이 끊겼습니다. 페이지를 새로고침해 주세요.";
    loading.hidden = false;
  });

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    if (document.documentElement.dataset.viewerState !== "ready") return;
    timer.update();
    toro.animate(timer.getElapsed(), state.pose, !reducedMotion.matches);
    room.animate(timer.getElapsed(), !reducedMotion.matches);
    orbit.update();
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
