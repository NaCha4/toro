import assert from "node:assert/strict";
import test from "node:test";
import { createPettingMotion } from "../src/petting.js";

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
