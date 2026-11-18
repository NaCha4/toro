import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadToro, expressions } from "./toro.js";
import "./style.css";

const viewport = document.querySelector("#viewport");
const loading = document.querySelector("#loading");
const controlsPanel = document.querySelector(".controls");
const state = { expression: "normal", pose: "stand" };
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

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
  renderer.setClearColor(0xf5f5f3);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute(
    "aria-label",
    "토로 3D 모델. 드래그 또는 방향키로 회전, 스크롤로 확대, R 키로 시점 초기화.",
  );
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b8b3, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(4, 2, -3);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 4;
  orbit.maxDistance = 20;
  orbit.target.set(0, 2.2, 0);
  camera.position.set(0.6, 2.65, 10.5);
  orbit.update();
  orbit.saveState();

  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    camera.aspect = width / height;
    const panelHeight = controlsPanel.getBoundingClientRect().height + 38;
    const availableHeight = Math.max(220, height - panelHeight - 30);
    const halfHeight = Math.max(
      (2.4 * height) / availableHeight,
      1.9 / camera.aspect,
    );
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / 10.5));
    camera.setViewOffset(width, height, 0, panelHeight / 2, width, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(viewport);
  new ResizeObserver(resize).observe(controlsPanel);
  resize();

  const toro = await loadToro();
  scene.add(toro.root);
  const expressionControls = document.querySelector("#expression-controls");
  for (const expression of expressions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.expression = expression.id;
    button.setAttribute("aria-label", expression.label);
    button.title = expression.label;
    const preview = document.createElement("span");
    preview.className = "expression-preview";
    preview.style.backgroundImage = `url("${new URL("toro-expressions.png", document.baseURI).href}")`;
    preview.style.backgroundPosition = `${((expression.tile % 4) * 100) / 3}% ${(Math.floor(expression.tile / 4) * 100) / 3}%`;
    preview.setAttribute("aria-hidden", "true");
    button.append(preview);
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
      0.1,
      Math.PI - 0.1,
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
    timer.update();
    toro.animate(timer.getElapsed(), state.pose, !reducedMotion.matches);
    orbit.update();
    renderer.render(scene, camera);
  });
  loading.hidden = true;
  document.documentElement.dataset.studioReady = "true";
}

startViewer().catch((error) => {
  console.error("Unable to load Toro", error);
  loading.textContent =
    "모델을 불러오지 못했습니다. 새로고침하거나 WebGL 지원 브라우저에서 열어 주세요.";
});
