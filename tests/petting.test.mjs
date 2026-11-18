import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createPettingMotion, bindHeadPetting } from "../src/petting.js";

test("the petting guide waits for an idle closeup", () => {
  const motion = createPettingMotion();
  motion.update(10);
  assert.equal(motion.hintVisible, false);
  assert.equal(motion.begin(1, 100, 100, 400, 400), false);
  motion.setEnabled(true);
  motion.update(2.99);
  assert.equal(motion.hintVisible, false);
  motion.update(0.01);
  assert.equal(motion.hintVisible, true);
  motion.begin(1, 100, 100, 400, 400);
  assert.equal(motion.hintVisible, false);
  motion.end(1);
  motion.update(3);
  assert.equal(motion.hintVisible, true);
  motion.setEnabled(false);
  motion.update(10);
  assert.equal(motion.hintVisible, false);
});

test("a real drag starts one stroke and tracks both directions", () => {
  const motion = createPettingMotion();
  motion.setEnabled(true);
  motion.begin(1, 100, 100, 400, 400);
  assert.equal(motion.move(1, 102, 101), false);
  assert.equal(motion.rubbing, false);
  assert.equal(motion.move(1, 180, 150), true);
  assert.equal(motion.move(1, 200, 160), false);
  motion.update(0.25);
  assert.ok(motion.pose.x > 0.4);
  assert.ok(motion.pose.y > 0.2);
  assert.ok(motion.pose.pressure > 0.8);
  motion.move(1, 0, 40);
  motion.update(0.3);
  assert.ok(motion.pose.x < 0);
  assert.ok(motion.pose.y < 0);
});

test("extra pointers cannot interrupt a stroke and release settles the head", () => {
  const motion = createPettingMotion();
  motion.setEnabled(true);
  motion.begin(1, 100, 100, 400, 400);
  assert.equal(motion.begin(2, 100, 100, 400, 400), false);
  assert.equal(motion.move(2, 500, 500), false);
  motion.move(1, 5000, -5000);
  motion.update(1);
  assert.ok(motion.pose.x <= 1 && motion.pose.y >= -1);
  motion.end(2);
  assert.equal(motion.rubbing, true);
  motion.end(1);
  motion.update(1);
  assert.equal(motion.pointerId, null);
  assert.equal(motion.rubbing, false);
  assert.ok(Math.abs(motion.pose.x) < 0.0001);
  assert.ok(Math.abs(motion.pose.y) < 0.0001);
  assert.ok(Math.abs(motion.pose.pressure) < 0.0001);
});

test("petting smoothing is consistent across different frame rates", () => {
  const samples = [30, 60, 120].map((rate) => {
    const motion = createPettingMotion();
    motion.setEnabled(true);
    motion.begin(1, 100, 100, 400, 400);
    motion.move(1, 240, 160);
    for (let frame = 0; frame < rate; frame++) motion.update(1 / rate);
    return motion.pose;
  });
  for (const value of samples) {
    assert.ok(Math.abs(value.x - samples[0].x) < 1e-10);
    assert.ok(Math.abs(value.y - samples[0].y) < 1e-10);
  }
});

test("the head follows a reversal at the limit and settles with a small rebound", () => {
  const motion = createPettingMotion();
  motion.setEnabled(true);
  motion.begin(1, 100, 100, 400, 400);
  motion.move(1, 900, 100);
  motion.update(0.3);
  assert.ok(motion.pose.x > 0.95);
  motion.move(1, 800, 100);
  motion.update(0.15);
  assert.ok(motion.pose.x < 0.6);
  motion.end(1);
  const rebound = [];
  for (let frame = 0; frame < 60; frame++) {
    motion.update(1 / 60);
    rebound.push(motion.pose.x);
  }
  assert.ok(rebound.some((value) => value < -0.001));
  assert.ok(rebound.every((value) => Math.abs(value) < 1.15));
  assert.ok(Math.abs(motion.pose.x) < 0.0001);
});

test("three seconds of movement qualifies only on release", () => {
  const motion = createPettingMotion();
  motion.setEnabled(true);
  motion.begin(1, 100, 100, 400, 400);
  for (let frame = 0; frame < 190; frame++) {
    motion.move(1, 100 + Math.sin(frame * 0.2) * 60, 100);
    motion.update(1 / 60);
  }
  assert.ok(motion.rubDuration >= 3);
  assert.equal(motion.rubbing, true);
  assert.equal(motion.end(1), true);
  assert.equal(motion.end(1), false);
});

test("a short stroke, stationary hold or canceled stroke does not qualify", () => {
  const motion = createPettingMotion();
  motion.setEnabled(true);
  motion.begin(1, 100, 100, 400, 400);
  motion.move(1, 140, 100);
  motion.update(4);
  assert.ok(motion.rubDuration <= 0.2);
  assert.equal(motion.end(1), false);
  for (let attempt = 0; attempt < 2; attempt++) {
    motion.begin(1, 100, 100, 400, 400);
    for (let frame = 0; frame < 110; frame++) {
      motion.move(1, 100 + Math.sin(frame * 0.2) * 60, 100);
      motion.update(1 / 60);
    }
    assert.equal(motion.end(1), false);
  }
  motion.begin(1, 100, 100, 400, 400);
  for (let frame = 0; frame < 190; frame++) {
    motion.move(1, 100 + Math.sin(frame * 0.2) * 60, 100);
    motion.update(1 / 60);
  }
  motion.cancel();
  assert.equal(motion.end(1), false);
});

test("a completed pointer stroke locks interaction once and cancellation never triggers a reward", () => {
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();
  globalThis.window = windowEvents;
  globalThis.document = documentEvents;
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 400,
  });
  canvas.setPointerCapture = () => {};
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const count = geometry.attributes.position.count;
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(weights, 4),
  );
  const head = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const bone = new THREE.Bone();
  head.add(bone);
  head.bind(new THREE.Skeleton([bone]));
  head.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
  camera.position.z = 5;
  camera.updateMatrixWorld();
  const motion = createPettingMotion();
  motion.setEnabled(true);
  let rewards = 0;
  bindHeadPetting({
    canvas,
    head,
    camera,
    motion,
    canInteract: () => motion.enabled,
    onStroke() {},
    onComplete() {
      rewards++;
      motion.setEnabled(false);
    },
  });
  const dispatch = (target, type, x = 200) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: 200,
    });
    target.dispatchEvent(event);
  };
  const rub = () => {
    dispatch(canvas, "pointerdown");
    for (let frame = 0; frame < 190; frame++) {
      dispatch(windowEvents, "pointermove", 225 + Math.sin(frame * 0.2) * 20);
      motion.update(1 / 60);
    }
  };
  rub();
  dispatch(windowEvents, "pointerup");
  dispatch(canvas, "lostpointercapture");
  assert.equal(rewards, 1);
  assert.equal(motion.enabled, false);
  motion.setEnabled(true);
  rub();
  dispatch(windowEvents, "pointercancel");
  dispatch(windowEvents, "pointerup");
  assert.equal(rewards, 1);
});
