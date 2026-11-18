import test from "node:test";
import assert from "node:assert/strict";
import {
  createGiftSequence,
  GIFT_PHASE_DURATIONS,
  sampleGiftSequence,
} from "../src/gift-sequence.js";

test("the reward waits one second and completes its phases exactly once", () => {
  const visited = [];
  const sequence = createGiftSequence((phase) => visited.push(phase));
  assert.equal(sequence.active, false);
  assert.equal(sequence.start(), true);
  assert.equal(sequence.start(), false);
  assert.equal(sequence.phase, "after_pet");
  sequence.update(0.99);
  assert.equal(sequence.phase, "after_pet");
  sequence.update(0.01);
  assert.equal(sequence.phase, "turn_to_fridge");
  sequence.update(100);
  assert.equal(sequence.phase, "presenting");
  assert.deepEqual(visited, [
    ...Object.keys(GIFT_PHASE_DURATIONS),
    "presenting",
  ]);
  sequence.update(100);
  assert.equal(visited.length, Object.keys(GIFT_PHASE_DURATIONS).length + 1);
  assert.equal(sequence.openPresent(), true);
  assert.equal(sequence.openPresent(), false);
  assert.equal(sequence.phase, "gift_burst");
  sequence.update(1.4);
  assert.equal(sequence.phase, "celebrating");
});

test("the fridge route and return route remain continuous and avoid the table", () => {
  const phases = Object.keys(GIFT_PHASE_DURATIONS);
  for (let index = 0; index < phases.length - 1; index++) {
    const before = sampleGiftSequence(phases[index], 1);
    const after = sampleGiftSequence(phases[index + 1], 0);
    assert.ok(before.position.distanceTo(after.position) < 1e-6, phases[index]);
    assert.ok(Math.abs(before.cameraProgress - after.cameraProgress) < 1e-6);
  }
  for (const phase of ["walk_to_fridge", "return_with_gift"]) {
    for (let index = 0; index <= 100; index++) {
      const frame = sampleGiftSequence(phase, index / 100);
      assert.ok(frame.position.toArray().every(Number.isFinite));
      if (frame.position.z > 0.35 && frame.position.z < 2.7)
        assert.ok(frame.position.x < 1.8);
    }
  }
  const final = sampleGiftSequence("presenting", 1);
  assert.equal(final.cameraProgress, 0);
  assert.equal(final.offering, 1);
  assert.equal(final.doorOpen, 1);
  assert.equal(final.giftCamera, 1);
  assert.equal(sampleGiftSequence("celebrating", 1).reveal, 1);
});
