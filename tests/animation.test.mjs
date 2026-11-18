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
import { createGiftScene } from "../src/gift-scene.js";
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
  assert.ok(bounds.max.z < -2.927);
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

test("closeup framing keeps the camera frontal and widens the lens", () => {
  for (const [width, height, panelHeight] of [
    [812, 375, 0],
    [1440, 760, 180],
    [447, 447, 0],
  ]) {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    updateCameraFraming(camera, width, height, panelHeight, 0);
    const initialFov = camera.fov;
    updateCameraFraming(camera, width, height, panelHeight, 1);
    assert.deepEqual(camera.position.toArray(), [0, 3.8, 12]);
    assert.equal(camera.rotation.y, 0);
    assert.equal(camera.rotation.z, 0);
    assert.ok(camera.fov > initialFov);
    assert.ok(camera.fov < 95);
    assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
  }
});
