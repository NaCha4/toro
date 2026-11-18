import test from "node:test";
import assert from "node:assert/strict";
import { CHEER_DANCE_DURATION } from "../src/cheer-dance.js";
import { SAKE_PHASES } from "../src/sake-delivery.js";
import {
  createGiftSequence,
  GIFT_PHASE_DURATIONS,
  sampleGiftSequence,
} from "../src/gift-sequence.js";

test("Okurimono branches straight into delivery and can be replayed from the menu", () => {
  for (const reducedMotion of [false, true]) {
    const visited = [];
    const story = createGiftSequence(phase => visited.push(phase));
    assert.equal(story.startSakeDelivery(), false);
    story.start();
    story.update(120, reducedMotion);
    assert.equal(story.startSakeDelivery(), false);
    story.openPresent();
    story.update(120, reducedMotion);
    for (let run = 0; run < 2; run++) {
      visited.length = 0;
      assert.equal(story.startSakeDelivery(), true);
      assert.equal(story.phase, "sake_arrives");
      assert.equal(story.startSakeDelivery(), false);
      assert.equal(story.startDance(), false);
      story.update(150, reducedMotion);
      assert.deepEqual(visited, [...Object.keys(SAKE_PHASES), "stand_at_center", "dance_ready"]);
    }
    assert.equal(story.startDance(), true);
    story.update(60, reducedMotion);
    assert.equal(story.phase, "dance_ready");
  }
});

test("the reward starts with the turn to the fridge and completes its phases exactly once", () => {
  const visited = [];
  const sequence = createGiftSequence((phase) => visited.push(phase));
  assert.equal(sequence.active, false);
  assert.equal(sequence.start(), true);
  assert.equal(sequence.start(), false);
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

test("the pickup, storage and door routes join without jumps", () => {
  const phases = [...Object.keys(GIFT_PHASE_DURATIONS), "presenting", "gift_burst",
    "celebrating", "turn_back_to_fridge", "carry_to_fridge", "shelve_gift",
    "release_gift", "step_to_door", "close_fridge", "return_to_center", "stand_at_center"];
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
    }
  }
  const final = sampleGiftSequence("presenting", 1);
  assert.equal(final.cameraProgress, 0);
  assert.equal(final.offering, 1);
  assert.equal(final.doorOpen, 1);
  assert.equal(final.giftCamera, 1);
  assert.equal(sampleGiftSequence("celebrating", 1).reveal, 1);
});

test("cleanup starts at three seconds and each selection returns to the same menu", () => {
  for (const reducedMotion of [false, true]) {
    const visited = [];
    const sequence = createGiftSequence((phase) => visited.push(phase));
    sequence.start();
    sequence.update(60, reducedMotion);
    sequence.openPresent();
    sequence.update(reducedMotion ? 0 : 1.4, reducedMotion);
    sequence.update(2.99, reducedMotion);
    assert.equal(sequence.phase, "celebrating");
    assert.equal(sequence.startDance(), false);
    sequence.update(0.01, reducedMotion);
    if (!reducedMotion) {
      assert.equal(sequence.phase, "turn_back_to_fridge");
      assert.equal(sequence.startDance(), false);
    }
    sequence.update(120, reducedMotion);
    assert.equal(sequence.phase, "dance_ready");
    assert.deepEqual(visited.slice(-9), [
      "turn_back_to_fridge", "carry_to_fridge", "shelve_gift", "release_gift",
      "step_to_door", "close_fridge", "return_to_center", "stand_at_center", "dance_ready",
    ]);
    const visitCount = visited.length;
    for (let selection = 0; selection < 3; selection++) {
      assert.equal(sequence.startDance(), true);
      assert.equal(sequence.phase, "dancing");
      assert.equal(sequence.progress, 0);
      assert.equal(sequence.startDance(), false);
      sequence.update((reducedMotion ? 1 : CHEER_DANCE_DURATION) - 0.05, reducedMotion);
      assert.equal(sequence.phase, "dancing");
      sequence.update(60, reducedMotion);
      assert.equal(sequence.phase, "dance_ready");
    }
    assert.deepEqual(visited.slice(visitCount), [
      "dancing", "stand_at_center", "dance_ready",
      "dancing", "stand_at_center", "dance_ready",
      "dancing", "stand_at_center", "dance_ready",
    ]);
  }
});
