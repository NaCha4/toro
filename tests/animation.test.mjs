import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadImage } from "@napi-rs/canvas";
import { addWrist } from "../src/wrist.js";
import { loadToro } from "../src/toro.js";
import { createGreetingSequence } from "../src/greeting.js";
import {
  createGreetingMotion,
  GREETING_DURATION,
} from "../src/greeting-motion.js";

globalThis.self = globalThis;
globalThis.document = { baseURI: "https://nacha4.github.io/toro/" };
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
  const model = await loadModel();
  const originalLoad = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => model;
  let toro;
  try {
    toro = await loadToro();
  } finally {
    GLTFLoader.prototype.loadAsync = originalLoad;
  }
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

test("the intro waits three seconds and accepts a single greeting", () => {
  let completed = 0;
  const sequence = createGreetingSequence(() => completed++);
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
  sequence.update(10);
  assert.equal(completed, 1);
  const reduced = createGreetingSequence(() => completed++);
  reduced.start(true);
  assert.equal(reduced.phase, "greeting");
  assert.equal(reduced.waveBlend, 1);
  assert.equal(completed, 2);
});
