import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { addWrist } from "../src/wrist.js";
import { loadToro } from "../src/toro.js";
import { createGreetingSequence } from "../src/greeting.js";
import { START_TORO_Z, CLOSEUP_TORO_Z } from "../src/greeting.js";
import { updateCameraFraming } from "../src/camera-framing.js";
import { createRoom } from "../src/room.js";
import { fridgeLayout } from "../src/fridge-layout.js";
import { createGiftScene } from "../src/gift-scene.js";
import { CHEER_DANCE_DURATION } from "../src/cheer-dance.js";
import {
  createGreetingMotion,
  GREETING_DURATION,
} from "../src/greeting-motion.js";

globalThis.self = globalThis;
globalThis.document = {
  baseURI: "https://nacha4.github.io/toro/",
  createElement: () => createCanvas(1, 1),
};
globalThis.createImageBitmap = async (blob) =>
  loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.ProgressEvent = class {
  constructor(type, data) {
    Object.assign(this, data);
    this.type = type;
  }
};

async function loadModel() {
  const bytes = await readFile(new URL("../public/toro.glb", import.meta.url));
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}

async function loadTestToro() {
  const model = await loadModel();
  const originalLoad = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => model;
  try {
    return await loadToro();
  } finally {
    GLTFLoader.prototype.loadAsync = originalLoad;
  }
}

function worldVertices(mesh) {
  return Array.from(
    { length: mesh.geometry.attributes.position.count },
    (_, index) =>
      mesh
        .getVertexPosition(index, new THREE.Vector3())
        .applyMatrix4(mesh.matrixWorld),
  );
}

test("added wrists preserve the supplied model's bind pose and skin weights", async () => {
  const { scene } = await loadModel();
  scene.updateMatrixWorld(true);
  for (const side of ["L", "R"]) {
    const mesh = scene.getObjectByName(`toro_${side.toLowerCase()}arm`);
    const before = worldVertices(mesh);
    addWrist(scene, side);
    scene.updateMatrixWorld(true);
    const after = worldVertices(mesh);
    after.forEach((point, index) =>
      assert.ok(point.distanceTo(before[index]) < 1e-6),
    );
    const weights = mesh.geometry.attributes.skinWeight;
    const indices = mesh.geometry.attributes.skinIndex;
    for (let vertex = 0; vertex < weights.count; vertex++) {
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights.getComponent(vertex, slot);
        assert.ok(weight >= 0 && weight <= 1);
        assert.ok(
          indices.getComponent(vertex, slot) < mesh.skeleton.bones.length,
        );
        total += weight;
      }
      assert.ok(Math.abs(total - 1) < 1e-6);
    }
  }
});

test("the greeting keeps feet grounded and restores the neutral pose", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  toro.root.position.z = 0.9;
  toro.animate(0, "stand", false);
  const joints = [
    "Pelvis",
    "Spine",
    "Head",
    "L_Thigh",
    "L_Calf",
    "R_Thigh",
    "R_Calf",
    "L_UpperArm",
    "L_ForeArm",
    "R_UpperArm",
    "R_ForeArm",
    "L_Wrist",
    "R_Wrist",
  ].map((name) => toro.root.getObjectByName(`Bip01_toro_${name}`));
  const neutral = joints.map((joint) => joint.quaternion.toArray());
  const moved = joints.map(() => false);
  const feet = ["toro_lleg", "toro_rleg"].map((name) =>
    toro.root.getObjectByName(name),
  );
  for (let frame = 0; frame < 720; frame++) {
    toro.animate(1 + frame / 60, "wave");
    toro.root.updateMatrixWorld(true);
    const floor = Math.min(
      ...feet.flatMap((mesh) => worldVertices(mesh).map((point) => point.y)),
    );
    assert.ok(Math.abs(floor) < 0.005);
    joints.forEach((joint, index) => {
      const values = joint.quaternion.toArray();
      assert.ok(values.every(Number.isFinite));
      moved[index] ||= values.some(
        (value, component) =>
          Math.abs(value - neutral[index][component]) > 0.005,
      );
    });
  }
  assert.ok(moved.every(Boolean));
  for (let frame = 0; frame <= 240; frame++) {
    const progress = frame / 240;
    toro.animate(13 + frame / 60, "walk", true, 1, progress);
    toro.root.position.z = THREE.MathUtils.lerp(
      START_TORO_Z,
      CLOSEUP_TORO_Z,
      progress,
    );
    toro.root.updateMatrixWorld(true);
    const floor = Math.min(
      ...feet.flatMap((mesh) => worldVertices(mesh).map((point) => point.y)),
    );
    assert.ok(Math.abs(floor) < 0.005);
  }
  toro.animate(15, "stand");
  joints.forEach((joint, index) => {
    joint.quaternion
      .toArray()
      .forEach((value, component) =>
        assert.ok(Math.abs(value - neutral[index][component]) < 1e-10),
      );
  });
  assert.equal(toro.root.position.x, 0);
  assert.equal(toro.root.position.y, 0);
});

test("head petting follows the stroke without moving the legs or model root", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  toro.root.position.z = CLOSEUP_TORO_Z;
  toro.animate(0, "stand", true, 1, 1);
  toro.root.updateMatrixWorld(true);
  const baseline = worldVertices(toro.head);
  const baselineCenter = baseline
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .divideScalar(baseline.length);
  const leg = toro.root.getObjectByName("Bip01_toro_L_Thigh");
  const legRotation = leg.quaternion.toArray();
  const rootPosition = toro.root.position.toArray();
  toro.applyPetting({ x: 1, y: 0.3, pressure: 1 });
  toro.root.updateMatrixWorld(true);
  const right = worldVertices(toro.head)
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .divideScalar(baseline.length);
  assert.ok(right.x > baselineCenter.x + 0.05);
  assert.deepEqual(leg.quaternion.toArray(), legRotation);
  assert.deepEqual(toro.root.position.toArray(), rootPosition);
  toro.animate(0, "stand", true, 1, 1);
  toro.applyPetting({ x: -1, y: 0, pressure: 1 });
  toro.root.updateMatrixWorld(true);
  const left = worldVertices(toro.head)
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .divideScalar(baseline.length);
  assert.ok(left.x < baselineCenter.x - 0.05);
  toro.animate(0, "stand", true, 1, 1);
  toro.applyPetting({ x: 0, y: 0, pressure: 0 });
  toro.root.updateMatrixWorld(true);
  worldVertices(toro.head).forEach((point, index) =>
    assert.ok(point.distanceTo(baseline[index]) < 1e-8),
  );
});

test("the present stays inside the closed fridge and follows both paws after pickup", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  const room = createRoom();
  const scene = new THREE.Scene();
  scene.add(toro.root, room.root);
  const story = createGiftScene(toro, room, () => {});
  scene.updateMatrixWorld(true);
  const present = room.root.getObjectByName("Ribbon wrapped present");
  const bounds = new THREE.Box3().setFromObject(present);
  assert.ok(bounds.max.z < fridgeLayout.frontZ - 0.065);
  story.start();
  let worstGripError = 0;
  for (let frame = 0; frame < 660; frame++) {
    story.animate(1 / 30, frame / 30);
    assert.ok(toro.root.position.toArray().every(Number.isFinite));
    if (
      [
        "take_gift",
        "turn_with_gift",
        "return_with_gift",
        "offer_gift",
        "presenting",
      ].includes(story.phase)
    ) {
      for (const [side, x] of [
        ["L", -0.47],
        ["R", 0.47],
      ]) {
        const expected = new THREE.Vector3(x, 0.03, 0.19).applyMatrix4(
          present.matrixWorld,
        );
        const actual = toro.hands[side].getPosition(new THREE.Vector3());
        worstGripError = Math.max(worstGripError, expected.distanceTo(actual));
      }
    }
  }
  assert.equal(story.phase, "presenting");
  assert.ok(worstGripError < 0.06, `Paw grip error ${worstGripError}`);
  assert.equal(story.open(), true);
  assert.equal(story.open(), false);
  story.animate(1.5, 24);
  assert.equal(story.phase, "celebrating");
  const card = room.root.getObjectByName("수능 응원카드").children[0];
  for (const [width, height, panelHeight] of [
    [812, 375, 0],
    [1440, 760, 0],
    [1440, 760, 180],
  ]) {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    updateCameraFraming(camera, width, height, panelHeight, 0);
    story.frameCamera(camera, width, height, panelHeight);
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    for (const point of worldVertices(card)) {
      point.project(camera);
      assert.ok(point.x > -1 && point.x < 1);
      assert.ok(point.y < 1 && point.y > -1 + (panelHeight / height) * 2);
    }
  }
});

test("back-wall furnishings line up in the front room shot", async () => {
  const atlas = await loadImage(await readFile(new URL("../public/room-furnishings.png", import.meta.url)));
  const room = createRoom(atlas);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  // Pixel centers in the 568 by 386 gameplay area of the 10:50 frame.
  updateCameraFraming(camera, 568, 386, 0, 0);
  camera.updateMatrixWorld(true);
  for (const [name, x, y] of [
    ["Chest doors and lower drawer", 167, 270], ["Stacked hi-fi components", 271, 284],
    ["Flap, buckles and straps", 387, 308], ["Refrigerator enamel face", 499, 265],
    ["Blue Hand poster", 406, 138],
  ]) {
    const panel = room.root.getObjectByName(name);
    const point = panel.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs((1 + point.x) * 284 - x) < 7, name);
    assert.ok(Math.abs((1 - point.y) * 193 - y) < 7, name);
  }
});

test("motion curves overlap, loop smoothly and respect reduced motion", () => {
  const sample = createGreetingMotion();
  const waving = sample(1.35);
  assert.notEqual(waving.shoulderSwing, waving.elbowSwing);
  assert.notEqual(waving.elbowSwing, waving.wristSwing);
  const start = sample(0);
  const end = sample(GREETING_DURATION - 0.00001);
  for (const field of Object.keys(start))
    assert.ok(Math.abs(start[field] - end[field]) < 0.0001);
  assert.deepEqual(sample(1, false), sample(20, false));
  assert.ok(Object.values(sample(2, true, 0)).every((value) => value === 0));
});

test("Toro shelves the open gift, guides the fridge shut, then dances from the centered menu", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  toro.animate(0, "stand");
  const joints = [];
  toro.root.traverse((node) => { if (node.isBone) joints.push(node); });
  const standing = joints.map((joint) => joint.quaternion.clone());
  const room = createRoom();
  const story = createGiftScene(toro, room);
  const gift = room.root.getObjectByName("Ribbon wrapped present");
  const base = gift.getObjectByName("Gift base");
  const card = gift.getObjectByName("Exam cake and encouragement card");
  const door = room.root.getObjectByName("Hinged refrigerator door");
  const foot = (side) => Math.min(...worldVertices(toro.root.getObjectByName("toro_" + side + "leg")).map((p) => p.y));
  story.start();
  story.animate(60, 60);
  story.open();
  story.animate(5, 65);
  assert.equal(story.phase, "turn_back_to_fridge");
  assert.equal(story.startDance(), false);
  let danceFrames = 0;
  let sawKick = false;
  let startedDance = false;
  let closingFrames = 0;
  let lastDoorAngle = door.rotation.y;
  let previousPan;
  const hand = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  for (let i = 0; i < 950; i++) {
    story.animate(1 / 30, 65 + (i + 1) / 30);
    assert.ok(card.visible);
    if (story.phase === "carry_to_fridge" || story.phase === "shelve_gift") {
      assert.equal(door.rotation.y, fridgeLayout.swing);
      for (const [side, x] of [["L", -0.47], ["R", 0.47]]) {
        const grip = gift.localToWorld(new THREE.Vector3(x, 0.03, 0.19));
        assert.ok(toro.hands[side].getPosition(hand).distanceTo(grip) < 0.06);
      }
    }
    if (["release_gift", "step_to_door", "close_fridge", "return_to_center", "dancing", "dance_ready"].includes(story.phase)) {
      const bounds = new THREE.Box3().setFromObject(base);
      assert.ok(Math.abs(bounds.min.y - fridgeLayout.shelfY) < 0.001);
      assert.ok(gift.position.distanceTo(room.fridge.giftPosition) < 1e-8);
      bounds.expandByObject(card);
      assert.ok(bounds.min.x > fridgeLayout.x - fridgeLayout.width / 2 + 0.11);
      assert.ok(bounds.max.x < fridgeLayout.x + fridgeLayout.width / 2 - 0.11);
      assert.ok(bounds.max.z < fridgeLayout.frontZ - 0.065);
      assert.ok(bounds.min.z > fridgeLayout.frontZ - fridgeLayout.depth + 0.1);
      assert.ok(bounds.max.y < 3.04);
    }
    if (story.phase === "close_fridge") {
      assert.ok(door.rotation.y <= lastDoorAngle);
      if (door.rotation.y > 0.001 && door.rotation.y < fridgeLayout.swing - 0.001) {
        const handle = room.fridge.getHandlePosition(new THREE.Vector3());
        const error = toro.hands.L.getPosition(hand).distanceTo(handle);
        assert.ok(error < 0.06, `Closing paw is ${error} from the handle`);
        closingFrames++;
      }
    }
    lastDoorAngle = door.rotation.y;
    if (["return_to_center", "dance_ready", "dancing"].includes(story.phase)) {
      assert.equal(door.rotation.y, 0);
    }
    if (story.phase === "close_fridge" || story.phase === "return_to_center") {
      updateCameraFraming(camera, 812, 375, 0, 0);
      story.frameCamera(camera, 812, 375, 0);
      const pan = camera.position.x;
      if (story.phase === "close_fridge") assert.ok(pan > 2);
      else assert.ok(pan >= 0 && pan <= previousPan && previousPan - pan < fridgeLayout.x * 0.02);
      previousPan = pan;
    }
    if (story.phase === "dance_ready") {
      assert.deepEqual(toro.root.position.toArray(), [0, 0, 1.3]);
      assert.equal(toro.root.rotation.y, 0);
      for (const [width, height, panel] of [[375, 812, 0], [812, 375, 0], [1440, 760, 180]]) {
        updateCameraFraming(camera, width, height, panel, 0);
        story.frameCamera(camera, width, height, panel);
        camera.updateMatrixWorld(true);
        const visible = new THREE.Box2();
        toro.root.traverse((mesh) => {
          if (!mesh.isSkinnedMesh) return;
          for (const point of worldVertices(mesh)) visible.expandByPoint(point.project(camera));
        });
        const center = visible.getCenter(new THREE.Vector2());
        assert.ok(Math.abs(center.x) < 0.01 && Math.abs(center.y) < 0.03);
      }
      joints.forEach((joint, i) => assert.deepEqual(joint.quaternion.toArray(), standing[i].toArray(), joint.name));
      if (startedDance) break;
      startedDance = story.startDance();
      continue;
    }
    if (story.phase !== "dancing") continue;
    danceFrames++;
    toro.root.updateMatrixWorld(true);
    const left = foot("l"), right = foot("r");
    assert.ok(Math.abs(Math.min(left, right)) < 0.005);
    sawKick ||= left > 0.15 && story.danceExpression === "excited";
    if (danceFrames % 22 !== 1) continue;
    for (const [width, height, panel] of [[812, 375, 0], [1440, 760, 180]]) {
      updateCameraFraming(camera, width, height, panel, 0);
      story.frameCamera(camera, width, height, panel);
      camera.updateMatrixWorld();
      toro.root.traverse((mesh) => {
        if (!mesh.isSkinnedMesh) return;
        for (const point of worldVertices(mesh)) {
          point.project(camera);
          assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1);
        }
      });
    }
  }
  assert.ok(Math.abs(danceFrames / 30 - CHEER_DANCE_DURATION) < 1 / 30);
  assert.ok(sawKick);
  assert.ok(closingFrames > 25);
  assert.equal(story.phase, "dance_ready");
  story.animate(120, 220);
  assert.deepEqual(toro.root.position.toArray(), [0, 0, 1.3]);
  joints.forEach((joint, i) => assert.deepEqual(joint.quaternion.toArray(), standing[i].toArray(), joint.name));
});

test("Toro crosses the open entrance, pours five cups to his mouth and takes the tray back out", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  const room = createRoom();
  const story = createGiftScene(toro, room);
  const get = (name) => room.root.getObjectByName(name);
  const parcel = get("Green sake delivery parcel"), tray = get("Sake serving tray");
  const flask = get("Ceramic sake flask"), cup = get("Sake cup");
  const probe = new THREE.Vector3(), hand = new THREE.Vector3();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(room.entrance.stance.x, 2.3, room.entrance.stance.z), new THREE.Vector3(1, 0, 0), 0, 3,
  );
  const blocked = () => {
    room.root.updateMatrixWorld(true);
    return ray.intersectObject(room.root, true).some(hit => hit.object.name === "Sliding door panel" || hit.object.name === "Side plaster wall");
  };
  assert.equal(blocked(), true);
  story.start();
  story.animate(120, 0);
  story.open();
  story.animate(120, 0);
  assert.equal(story.startSakeDelivery(), true);
  let time = 0, pours = 0, sips = 0, pouring = false, sipping = false;
  let carriedIn = false, trayTakenOut = false, returnedEmpty = false;
  for (; time < 150 && story.phase !== "dance_ready"; time += 0.08) {
    story.animate(0.08, time);
    if (story.phase === "sake_receive" || story.phase === "sake_leave_tray") {
      assert.equal(blocked(), false);
      assert.ok(toro.root.position.x > room.entrance.stance.x + 3);
      if (story.phase === "sake_leave_tray") trayTakenOut ||= tray.visible;
    }
    if (story.phase === "sake_carry_home") {
      assert.ok(parcel.visible && !tray.visible);
      for (const [side, x] of [["R", -0.48], ["L", 0.48]]) {
        parcel.localToWorld(probe.set(x, 0.25, -0.09));
        assert.ok(toro.hands[side].getPosition(hand).distanceTo(probe) < 0.04);
      }
      carriedIn = true;
    }
    if (story.phase === "sake_drink") {
      assert.ok(tray.visible && !parcel.visible);
      assert.ok(toro.hands.R.getPosition(hand).distanceTo(flask.localToWorld(probe.set(-0.12, 0.36, -0.025))) < 0.04);
      assert.ok(toro.hands.L.getPosition(hand).distanceTo(cup.localToWorld(probe.set(0.08, 0.12, -0.015))) < 0.04);
      const atMouth = cup.localToWorld(probe.set(0, 0.24, -0.16)).distanceTo(toro.mouth.getWorldPosition(hand)) < 0.02;
      const stream = get("Pouring sake").visible;
      if (atMouth && !sipping) sips++;
      if (stream && !pouring) pours++;
      sipping = atMouth;
      pouring = stream;
    }
    if (story.phase === "sake_return") returnedEmpty ||= !tray.visible && !parcel.visible;
  }
  assert.ok(carriedIn && trayTakenOut && returnedEmpty);
  assert.equal(pours, 5);
  assert.equal(sips, 5);
  assert.equal(blocked(), true);
  assert.equal(story.phase, "dance_ready");
  assert.deepEqual(toro.root.position.toArray(), [0, 0, 1.3]);
  assert.ok(!tray.visible && !parcel.visible);
});

test("the standalone animation and menu share the same dance poses and timing", async () => {
  const preview = await loadTestToro();
  const menu = await loadTestToro();
  preview.animate(21, "dance");
  const names = ["Pelvis", "Head", "R_UpperArm", "R_ForeArm", "L_Thigh", "L_Calf"];
  for (const t of [0.16, 1.52, 3, 4.91, 6.12, 7.32, 8.88]) {
    const face = preview.animate(21 + t, "dance");
    assert.equal(face, menu.animate(68 + t, "dance", true, 1, 0, null, t / CHEER_DANCE_DURATION));
    for (const name of names) {
      const bone = "Bip01_toro_" + name;
      const a = preview.root.getObjectByName(bone).quaternion;
      const b = menu.root.getObjectByName(bone).quaternion;
      assert.ok(a.toArray().every((value, i) => Math.abs(value - b.toArray()[i]) < 1e-8), bone);
    }
  }
});

test("the reference accents plant one leg, change the arm shapes and end with a cheek pose", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  const joint = (name) => toro.root.getObjectByName("Bip01_toro_" + name).getWorldPosition(new THREE.Vector3());
  const paw = (side) => toro.hands[side].getPosition(new THREE.Vector3());
  function pose(seconds) {
    const face = toro.animate(seconds, "dance", true, 1, 0, null, seconds / CHEER_DANCE_DURATION);
    toro.root.updateMatrixWorld(true);
    return face;
  }
  pose(1.52);
  assert.ok(paw("R").y > joint("R_UpperArm").y && paw("L").y < joint("L_ForeArm").y);
  assert.ok(Math.abs(joint("R_Calf").x - joint("R_Thigh").x) < 0.03);
  assert.ok(joint("L_Calf").x - joint("L_Thigh").x > 0.15);
  pose(3);
  assert.ok(paw("R").x > joint("R_ForeArm").x && paw("L").x < joint("L_ForeArm").x);
  assert.ok(Math.abs(joint("L_Calf").x - joint("L_Thigh").x) < 0.03);
  pose(6.12);
  assert.ok(paw("R").z > 0.7 && paw("L").z > 0.7);
  pose(6.44);
  assert.ok(paw("R").y > joint("R_UpperArm").y && paw("L").y > joint("L_UpperArm").y);
  pose(8.64);
  assert.ok(joint("R_UpperArm").x - paw("R").x > 0.9);
  assert.equal(pose(8.88), "excited");
  const shoulder = joint("R_UpperArm"), elbow = joint("R_ForeArm"), hand = paw("R");
  const armLength = shoulder.distanceTo(elbow) + elbow.distanceTo(hand);
  assert.ok(shoulder.distanceTo(hand) > 0.94 * armLength);
  assert.ok(hand.z > shoulder.z + 0.5);
  assert.ok(paw("R").y > joint("Head").y + 0.3);
  assert.ok(paw("L").y < joint("L_UpperArm").y - 0.7 && paw("L").z < joint("L_UpperArm").z - 0.5);
  assert.ok(joint("L_Calf").y > joint("R_Calf").y + 0.25);
  pose(9.32);
  assert.ok(paw("R").x < joint("R_ForeArm").x && paw("R").y > joint("R_ForeArm").y);
});

test("the intro greets once, pauses for one second and approaches the camera", () => {
  const phases = [];
  const sequence = createGreetingSequence((phase) => phases.push(phase));
  assert.equal(sequence.heading, Math.PI);
  sequence.update(2.99);
  assert.equal(sequence.hintVisible, false);
  sequence.update(0.01);
  assert.equal(sequence.hintVisible, true);
  assert.equal(sequence.start(), true);
  assert.equal(sequence.start(), false);
  assert.equal(sequence.hintVisible, false);
  sequence.update(0.6);
  assert.ok(Math.abs(sequence.heading - Math.PI / 2) < 1e-10);
  sequence.update(0.6);
  assert.equal(sequence.heading, 0);
  assert.equal(sequence.phase, "greeting");
  sequence.update(GREETING_DURATION);
  assert.equal(sequence.phase, "pause");
  assert.equal(sequence.approachProgress, 0);
  sequence.update(0.99);
  assert.equal(sequence.phase, "pause");
  sequence.update(0.01);
  assert.equal(sequence.phase, "approaching");
  sequence.update(2.1);
  assert.ok(Math.abs(sequence.approachProgress - 0.5) < 1e-8);
  sequence.update(2.1);
  assert.equal(sequence.phase, "closeup");
  assert.equal(sequence.approachProgress, 1);
  sequence.update(100);
  assert.deepEqual(phases, [
    "turning",
    "greeting",
    "pause",
    "approaching",
    "closeup",
  ]);
  const reduced = createGreetingSequence();
  reduced.start(true);
  assert.equal(reduced.phase, "greeting");
  reduced.update(GREETING_DURATION, true);
  assert.equal(reduced.phase, "pause");
  reduced.update(1, true);
  assert.equal(reduced.phase, "closeup");
});

test("Toro clasps both paws at the LCD and lowers his head when a word is forgotten", async () => {
  const toro = await loadTestToro();
  toro.root.scale.multiplyScalar(0.91);
  const face = toro.root.getObjectByName("Bip01_toro_Head");
  function pose(gesture) {
    toro.animate(0, "stand", false);
    toro.applyConversation(gesture, 1, 1, false);
    toro.root.updateMatrixWorld(true);
    return face.getWorldQuaternion(new THREE.Quaternion());
  }
  const rest = pose(undefined);
  const paw = side => toro.hands[side].getPosition(new THREE.Vector3());
  const relaxed = paw("L").distanceTo(paw("R"));
  pose("paws");
  assert.ok(paw("L").distanceTo(paw("R")) < relaxed * 0.5);
  assert.ok(pose("droop").angleTo(rest) > 0.2);
  assert.ok(pose(undefined).angleTo(rest) < 0.001);
});

test("a delayed frame completes each sequence phase in order", () => {
  const phases = [];
  const sequence = createGreetingSequence((phase) => phases.push(phase));
  sequence.update(100);
  sequence.start();
  assert.equal(sequence.heading, Math.PI);
  sequence.update(30);
  assert.deepEqual(phases, [
    "turning",
    "greeting",
    "pause",
    "approaching",
    "closeup",
  ]);
});

test("the room fits the back wall and the closeup keeps the camera frontal", () => {
  for (const [width, height, panelHeight] of [
    [812, 375, 0],
    [1440, 760, 0],
    [1440, 760, 180],
    [447, 447, 0],
  ]) {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    updateCameraFraming(camera, width, height, panelHeight, 0);
    camera.updateMatrixWorld(true);
    for (const x of [-11.1, 11.1]) {
      const corner = new THREE.Vector3(x, 13, -4.9).project(camera);
      assert.ok(Math.abs(corner.x) <= 1 && corner.y <= 1);
    }
    updateCameraFraming(camera, width, height, panelHeight, 1);
    assert.deepEqual(camera.position.toArray(), [0, 3.8, 12]);
    assert.equal(camera.rotation.y, 0);
    assert.equal(camera.rotation.z, 0);
    assert.ok(camera.fov < 95);
    assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
  }
});
