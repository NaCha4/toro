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
import { createGiftScene } from "./gift-scene.js";
import { createWordRoom } from "./word-room.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import "./style.css";
import "./word-room.css";

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
  renderer.setClearColor(0x201b17);
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
  const key = new THREE.SpotLight(0xffedca, 175, 25, 1.3, 0.85, 2);
  key.position.set(0, 8.6, 3);
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
  const windowLight = new THREE.RectAreaLight(0xe7eddf, 3.4, 6.65, 5.25);
  windowLight.position.set(-10.85, 6.68, 0.65);
  windowLight.lookAt(0, 3, 0.65);
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

  const [toro, furnishings] = await Promise.all([
    loadToro(),
    new THREE.ImageLoader().loadAsync(new URL("room-furnishings.png", document.baseURI).href),
  ]);
  const petting = createPettingMotion();
  toro.root.scale.multiplyScalar(0.91);
  toro.root.position.z = START_TORO_Z;
  scene.add(toro.root);
  const room = createRoom(furnishings);
  scene.add(room.root);
  const cheerMenu = document.querySelector("#cheer-menu");
  const choices = [...cheerMenu.querySelectorAll("button")];
  const danceButton = document.querySelector("#cheer-dance");
  let previewUsesDanceFace = false;
  const giftLabels = {
    presenting: "리본 선물상자를 터치해서 열어 주세요",
    gift_burst: "선물상자에서 케이크와 응원카드가 나와요",
    celebrating: "수능 케이크와 응원카드를 선물하는 토로",
    dance_ready: "토로를 눌러 이야기하기. 메뉴에서 말 가르치기, 춤, 사케 배달을 선택할 수 있어요.",
    turn_back_to_fridge: "케이크와 카드를 들고 냉장고로 돌아서는 토로",
    carry_to_fridge: "열린 선물상자를 냉장고로 가져가는 토로",
    shelve_gift: "케이크와 카드가 든 상자를 냉장고 선반에 넣는 토로",
    release_gift: "선물상자에서 손을 떼는 토로",
    step_to_door: "냉장고 문을 닫으러 손잡이로 다가가는 토로",
    close_fridge: "냉장고 문을 닫는 토로",
    return_to_center: "방 가운데로 돌아오는 토로",
    stand_at_center: "방 가운데에서 정면을 보고 서 있는 토로",
    dancing: "수능 응원 춤을 추는 토로",
    sake_arrives: "사케 배달이 왔어요",
    sake_to_door: "배달을 받으러 오른쪽 문으로 가는 토로",
    sake_open_door: "미닫이문을 여는 토로",
    sake_go_out: "배달을 받으러 복도로 나가는 토로",
    sake_receive: "문밖에서 사케 상자를 받는 토로",
    sake_step_in: "초록색 사케 상자를 들고 들어오는 토로",
    sake_close_with_parcel: "상자를 잠시 내려놓고 미닫이문을 닫는 토로",
    sake_carry_home: "사케 상자를 방 가운데로 가져오는 토로",
    sake_unpack: "상자에서 술병과 잔이 담긴 술상을 꺼내는 토로",
    sake_drink: "술병을 기울여 잔에 사케를 따르고 마시는 토로",
    sake_thanks: "두 손을 모아 인사하는 토로",
    sake_lift_tray: "빈 술상을 드는 토로",
    sake_carry_tray: "빈 술상을 들고 문으로 가는 토로",
    sake_open_with_tray: "술상을 잠시 내려놓고 미닫이문을 여는 토로",
    sake_take_tray_out: "술상을 반납하러 나가는 토로",
    sake_leave_tray: "복도에 술상을 내려놓는 토로",
    sake_step_back_in: "빈손으로 방에 돌아오는 토로",
    sake_close_door: "미닫이문을 닫는 토로",
    sake_return: "방 가운데로 돌아오는 토로",
  };
  const giftScene = createGiftScene(toro, room, (phase) => {
    petting.setEnabled(false);
    state.expression = [
      "offer_gift",
      "gift_closeup",
      "presenting",
      "gift_burst",
      "celebrating",
    ].includes(phase) ? "delighted" : "normal";
    state.pose = phase === "dancing" ? "dance" : "stand";
    cheerMenu.hidden = phase !== "dance_ready";
    if (phase === "turn_back_to_fridge") viewer.classList.add("cheer-finale");
    if (!cheerMenu.hidden && document.activeElement === renderer.domElement)
      cheerMenu.querySelector(".current").focus({ preventScroll: true });
    toro.setExpression(state.expression);
    selectButton("expression", state.expression);
    selectButton("pose", state.pose);
    previewButtons.forEach((button) => {
      button.disabled = true;
    });
    viewer.dataset.inputLocked = "true";
    viewer.dataset.giftState = phase;
    renderer.domElement.setAttribute(
      "role",
      phase === "presenting" || phase === "dance_ready" ? "button" : "img",
    );
    renderer.domElement.setAttribute(
      "aria-label",
      giftLabels[phase] ?? "냉장고에서 선물을 꺼내는 토로",
    );
  });
  const teachButton = document.querySelector("#teach-word");
  const wordRoom = createWordRoom(document.querySelector("#word-room"), {
    reducedMotion: () => reducedMotion.matches,
    onReaction(face, gesture) {
      viewer.dataset.wordGesture = gesture;
      state.expression = face;
      toro.setExpression(face);
    },
    onClose(face) {
      delete viewer.dataset.wordGesture;
      state.expression = face;
      toro.setExpression(face);
      cheerMenu.hidden = false;
      renderer.domElement.inert = false;
      teachButton.focus({ preventScroll: true });
    },
  });
  function roomIsReady() {
    return giftScene.phase === "dance_ready" && !wordRoom.active && !document.hidden &&
      document.documentElement.dataset.viewerState === "ready";
  }
  function startConversation(mode) {
    if (!roomIsReady()) return;
    cheerMenu.hidden = true;
    renderer.domElement.inert = true;
    wordRoom.start(mode);
  }
  teachButton.addEventListener("click", () => startConversation("teach"));
  for (const choice of choices) {
    const highlight = () => {
      for (const item of choices) item.classList.toggle("current", item === choice);
    };
    choice.addEventListener("pointerenter", highlight);
    choice.addEventListener("focus", highlight);
    choice.addEventListener("click", highlight);
    choice.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      choices[(choices.indexOf(choice) + direction + choices.length) % choices.length].focus();
    });
  }
  danceButton.addEventListener("click", () => {
    if (roomIsReady() && giftScene.startDance())
      renderer.domElement.focus({ preventScroll: true });
  });
  document.querySelector("#sake-delivery").addEventListener("click", () => {
    if (roomIsReady() && giftScene.startSakeDelivery())
      renderer.domElement.focus({ preventScroll: true });
  });
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
      if (giftScene.active) return;
      previewUsesDanceFace = false;
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
      if (giftScene.active) return;
      state.pose = button.dataset.pose;
      previewUsesDanceFace = state.pose === "dance";
      petting.setEnabled(!previewUsesDanceFace);
      renderer.domElement.setAttribute("aria-label", previewUsesDanceFace
        ? "수능 응원 춤을 추는 토로" : phaseLabels.closeup);
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

  const chatRay = new THREE.Raycaster();
  const chatPointer = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    if (giftScene.active) {
      if (roomIsReady()) {
        const rect = renderer.domElement.getBoundingClientRect();
        chatPointer.set(2 * (event.clientX - rect.left) / rect.width - 1,
          1 - 2 * (event.clientY - rect.top) / rect.height);
        chatRay.setFromCamera(chatPointer, camera);
        if (chatRay.intersectObject(toro.root, true).length) startConversation("chat");
        return;
      }
      giftScene.openAt(event, renderer.domElement, camera);
      return;
    }
    beginGreeting();
  });
  bindHeadPetting({
    canvas: renderer.domElement,
    head: toro.head,
    camera,
    motion: petting,
    canInteract: () =>
      greeting.phase === "closeup" &&
      !giftScene.active &&
      document.documentElement.dataset.viewerState === "ready" &&
      !document.hidden,
    onStroke: () => {
      state.expression = "laugh";
      state.pose = "stand";
      toro.setExpression(4);
      selectButton("expression", state.expression);
      selectButton("pose", state.pose);
    },
    onComplete: () => giftScene.start(),
  });
  hint.addEventListener("click", beginGreeting);
  renderer.domElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (giftScene.canOpen) giftScene.open();
      else if (roomIsReady()) startConversation("chat");
      else beginGreeting();
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
  let conversationFrame = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    if (
      document.documentElement.dataset.viewerState !== "ready" ||
      document.hidden
    )
      return;
    const delta = timer.getDelta();
    activeTime += delta;
    wordRoom.update(delta);
    petting.update(delta);
    greeting.update(delta, reducedMotion.matches);
    closeupProgress = state.pose === "dance" && !giftScene.active ? 0 : greeting.approachProgress;
    viewer.dataset.greetingState = greeting.phase;
    hint.hidden = !greeting.hintVisible;
    petHint.hidden = !petting.hintVisible;
    viewer.dataset.pettingState = petting.rubbing ? "rubbing" : "idle";
    let animatedExpression;
    if (giftScene.active) {
      closeupProgress = giftScene.animate(
        delta,
        activeTime,
        !reducedMotion.matches,
      );
      animatedExpression = giftScene.expression;
    } else {
      const previewFace = toro.animate(
        activeTime,
        state.pose,
        !reducedMotion.matches,
        greeting.phase === "greeting" && !reducedMotion.matches
          ? greeting.waveBlend
          : 1,
        closeupProgress,
      );
      if (previewUsesDanceFace) animatedExpression = previewFace;
      toro.root.position.z = THREE.MathUtils.lerp(
        START_TORO_Z,
        CLOSEUP_TORO_Z,
        closeupProgress,
      );
      toro.root.rotation.y += greeting.heading;
    }
    if (animatedExpression && state.expression !== animatedExpression) {
      state.expression = animatedExpression;
      toro.setExpression(animatedExpression);
      selectButton("expression", animatedExpression);
    }
    toro.applyPetting(petting.pose, reducedMotion.matches ? 0.55 : 1);
    updateCameraFraming(
      camera,
      viewport.clientWidth,
      viewport.clientHeight,
      panelHeight,
      closeupProgress,
    );
    if (giftScene.active) {
      giftScene.frameCamera(
        camera,
        viewport.clientWidth,
        viewport.clientHeight,
        panelHeight,
      );
      toro.applyConversation(viewer.dataset.wordGesture, activeTime, delta, !reducedMotion.matches);
      conversationFrame = reducedMotion.matches ? Number(wordRoom.active) :
        THREE.MathUtils.damp(conversationFrame, Number(wordRoom.active), 7, delta);
      if (conversationFrame > 0.001) {
        camera.position.x += Math.min(1.15, 0.56 * camera.aspect) * conversationFrame;
        camera.fov *= 1 - 0.16 * conversationFrame;
        camera.updateProjectionMatrix();
      }
    }
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
