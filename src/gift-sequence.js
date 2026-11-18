import * as THREE from "three";
import { CLOSEUP_TORO_Z } from "./greeting.js";

export const GIFT_PHASE_DURATIONS = {
  after_pet: 1,
  turn_to_fridge: 0.8,
  walk_to_fridge: 7,
  open_fridge: 1.8,
  move_to_gift: 1.2,
  reach_gift: 1.2,
  take_gift: 1,
  turn_with_gift: 0.9,
  return_with_gift: 3.8,
  offer_gift: 1.2,
  gift_closeup: 1.3,
};
const phases = [
  ...Object.keys(GIFT_PHASE_DURATIONS),
  "presenting",
  "gift_burst",
  "celebrating",
];
function durationOf(phase) {
  return phase === "gift_burst" ? 1.4 : GIFT_PHASE_DURATIONS[phase];
}
const start = new THREE.Vector3(0, 0, CLOSEUP_TORO_Z);
const opening = new THREE.Vector3(3.85, 0, -1.82);
const pickup = new THREE.Vector3(4.65, 0, -2.05);
const presentation = new THREE.Vector3(0, 0, 1.3);
const outward = new THREE.CatmullRomCurve3([
  start,
  new THREE.Vector3(0, 0, 6.2),
  new THREE.Vector3(0.7, 0, 2.3),
  new THREE.Vector3(1.45, 0, -0.15),
  new THREE.Vector3(3, 0, -1.15),
  opening,
]);
const returning = new THREE.CatmullRomCurve3([
  pickup,
  new THREE.Vector3(3.05, 0, -0.65),
  new THREE.Vector3(1.35, 0, -0.25),
  presentation,
]);

export function smooth(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function turn(from, to, progress) {
  return (
    from +
    Math.atan2(Math.sin(to - from), Math.cos(to - from)) * smooth(progress)
  );
}

export function createGiftSequence(onPhaseChange = () => {}) {
  let index = -1;
  let elapsed = 0;
  return {
    get active() {
      return index >= 0;
    },
    get phase() {
      return index < 0 ? "idle" : phases[index];
    },
    get progress() {
      const duration = durationOf(phases[index]);
      return duration ? Math.min(1, elapsed / duration) : 1;
    },
    start() {
      if (index >= 0) return false;
      index = 0;
      elapsed = 0;
      onPhaseChange(phases[index]);
      return true;
    },
    openPresent() {
      if (phases[index] !== "presenting") return false;
      index++;
      elapsed = 0;
      onPhaseChange(phases[index]);
      return true;
    },
    update(delta, reducedMotion = false) {
      if (index < 0) return;
      elapsed += Math.max(0, delta);
      while (index < phases.length - 1) {
        if (phases[index] === "presenting") break;
        const duration =
          reducedMotion && index > 0 ? 0 : durationOf(phases[index]);
        if (elapsed < duration) break;
        elapsed -= duration;
        onPhaseChange(phases[++index]);
      }
    },
  };
}

export function sampleGiftSequence(phase, progress) {
  const p = smooth(progress);
  const moving =
    phase === "walk_to_fridge" ||
    phase === "move_to_gift" ||
    phase === "return_with_gift";
  let position = start.clone(),
    heading = 0,
    distance = 0;
  const returnHeading = Math.atan2(
    returning.getTangentAt(0).x,
    returning.getTangentAt(0).z,
  );
  if (phase === "turn_to_fridge") heading = turn(0, Math.PI, progress);
  if (phase === "walk_to_fridge") {
    position = outward.getPointAt(p);
    const tangent = outward.getTangentAt(p);
    heading = turn(Math.atan2(tangent.x, tangent.z), 2.6, (p - 0.83) / 0.17);
    distance = outward.getLength() * p;
  }
  if (phase === "open_fridge") {
    position = opening.clone();
    heading = 2.6;
  }
  if (phase === "move_to_gift") {
    position = opening.clone().lerp(pickup, p);
    heading = turn(2.6, Math.PI, progress);
    distance = opening.distanceTo(pickup) * p;
  }
  if (phase === "reach_gift" || phase === "take_gift") {
    position = pickup.clone();
    heading = Math.PI;
  }
  if (phase === "turn_with_gift") {
    position = pickup.clone();
    heading = turn(Math.PI, returnHeading, progress);
  }
  if (phase === "return_with_gift") {
    position = returning.getPointAt(p);
    const tangent = returning.getTangentAt(p);
    heading = turn(Math.atan2(tangent.x, tangent.z), 0, (p - 0.72) / 0.28);
    distance = returning.getLength() * p;
  }
  if (
    [
      "offer_gift",
      "gift_closeup",
      "presenting",
      "gift_burst",
      "celebrating",
    ].includes(phase)
  )
    position = presentation.clone();
  const index = phases.indexOf(phase);
  const offering =
    phase === "offer_gift"
      ? p
      : index >= phases.indexOf("gift_closeup")
        ? 1
        : 0;
  return {
    position,
    heading,
    cameraProgress: index <= 1 ? 1 : phase === "walk_to_fridge" ? 1 - p : 0,
    doorOpen:
      phase === "open_fridge"
        ? smooth((progress - 0.22) / 0.75)
        : index > 3
          ? 1
          : 0,
    handleReach:
      phase === "open_fridge"
        ? smooth(progress / 0.25) * (1 - smooth((progress - 0.48) / 0.25))
        : 0,
    giftReach: phase === "reach_gift" ? p : index >= 6 ? 1 : 0,
    giftTransfer: phase === "take_gift" ? p : index >= 7 ? 1 : 0,
    offering,
    giftCamera:
      phase === "gift_closeup"
        ? p
        : index >= phases.indexOf("presenting")
          ? 1
          : 0,
    reveal: phase === "gift_burst" ? p : phase === "celebrating" ? 1 : 0,
    locomotion: {
      phase: (distance / 1.25) * Math.PI * 2,
      blend: moving
        ? smooth(progress / 0.1) * (1 - smooth((progress - 0.9) / 0.1))
        : 0,
    },
    walking: moving,
    lean:
      phase === "reach_gift" || phase === "take_gift"
        ? 0.075
        : index >= 7
          ? 0.025
          : 0,
  };
}
