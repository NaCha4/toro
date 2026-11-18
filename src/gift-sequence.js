import * as THREE from "three";
import { CLOSEUP_TORO_Z } from "./greeting.js";
import { CHEER_DANCE_DURATION } from "./cheer-dance.js";
import { SAKE_PHASES, SAKE_REDUCED_SECONDS } from "./sake-delivery.js";
import { fridgeLayout, gripOnSwing } from "./fridge-layout.js";

export const GIFT_PHASE_DURATIONS = {
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
const durations = {
  ...GIFT_PHASE_DURATIONS,
  presenting: Infinity,
  gift_burst: 1.4,
  celebrating: 3,
  turn_back_to_fridge: 1,
  carry_to_fridge: 4.2,
  shelve_gift: 1.15,
  release_gift: 0.55,
  step_to_door: 1.8,
  close_fridge: 1.9,
  return_to_center: 3.5,
  stand_at_center: 0.35,
  dance_ready: Infinity,
  dancing: CHEER_DANCE_DURATION,
  ...SAKE_PHASES,
};
const phases = Object.keys(durations);
const start = new THREE.Vector3(0, 0, CLOSEUP_TORO_Z);
function doorStance(open) {
  const grip = gripOnSwing(open);
  return grip.set(grip.x - 0.32 - 0.48 * open, 0, grip.z + 0.89 - 0.47 * open);
}
const opening = doorStance(0);
const pickup = new THREE.Vector3(fridgeLayout.x - 0.12, 0, fridgeLayout.frontZ + 0.70);
const presentation = new THREE.Vector3(0, 0, 1.3);
const openDoorStance = doorStance(1);
const reachOpenDoorHeading = 1.95;
const reachClosedDoorHeading = 2.9;
const outward = new THREE.CatmullRomCurve3([
  start,
  new THREE.Vector3(0, 0, 6.2),
  new THREE.Vector3(2.5, 0, 2.3),
  new THREE.Vector3(4.8, 0, 0.35),
  opening,
]);
const returning = new THREE.CatmullRomCurve3([
  pickup,
  new THREE.Vector3(7.5, 0, -0.65),
  new THREE.Vector3(3.4, 0, 0.65),
  presentation,
]);
const backToCenter = new THREE.CatmullRomCurve3([
  opening, new THREE.Vector3(5.8, 0, -0.48), ...returning.points.slice(2),
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
  let reduced = false;
  function phaseDuration(phase) {
    const duration = durations[phase];
    if (!reduced || !Number.isFinite(duration) || phase === "celebrating") return duration;
    return phase === "dancing" ? 1 : (SAKE_REDUCED_SECONDS[phase] ?? 0);
  }
  function advanceOnInput(requiredPhase, nextPhase) {
    if (phases[index] !== requiredPhase) return false;
    elapsed = 0;
    index = phases.indexOf(nextPhase);
    onPhaseChange(nextPhase);
    return true;
  }
  return {
    get active() {
      return index >= 0;
    },
    get phase() {
      return index < 0 ? "idle" : phases[index];
    },
    get progress() {
      const duration = phaseDuration(phases[index]);
      return Number.isFinite(duration) && duration > 0 ? Math.min(1, elapsed / duration) : 1;
    },
    start() {
      if (index >= 0) return false;
      index = 0;
      elapsed = 0;
      onPhaseChange(phases[index]);
      return true;
    },
    openPresent() {
      return advanceOnInput("presenting", "gift_burst");
    },
    startDance() {
      return advanceOnInput("dance_ready", "dancing");
    },
    startSakeDelivery() {
      return advanceOnInput("dance_ready", "sake_arrives");
    },
    update(delta, reducedMotion = false) {
      if (!Number.isFinite(durations[phases[index]])) return;
      if (reducedMotion !== reduced) {
        const progress = this.progress;
        reduced = reducedMotion;
        elapsed = progress * phaseDuration(phases[index]);
      }
      elapsed += Math.max(0, delta);
      while (true) {
        const phase = phases[index];
        const duration = phaseDuration(phase);
        if (!Number.isFinite(duration)) break;
        if (elapsed < duration) break;
        elapsed -= duration;
        index = phase === "dancing" || phase === "sake_return" ? phases.indexOf("stand_at_center") : index + 1;
        onPhaseChange(phases[index]);
      }
    },
  };
}

export function sampleGiftSequence(phase, progress) {
  const p = smooth(progress);
  const index = phases.indexOf(phase);
  // Each property can ramp up in one phase and stay there until its release.
  const ramp = (name) => phase === name ? p : Number(index > phases.indexOf(name));
  const moving =
    phase === "walk_to_fridge" ||
    phase === "open_fridge" ||
    phase === "move_to_gift" ||
    phase === "return_with_gift" ||
    phase === "carry_to_fridge" ||
    phase === "step_to_door" ||
    phase === "close_fridge" ||
    phase === "return_to_center";
  let gaitProgress = progress;
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
  const opened = phase === "open_fridge" ? smooth((progress - 0.22) / 0.56) : ramp("open_fridge");
  if (phase === "open_fridge") {
    position = doorStance(opened);
    heading = turn(2.6, reachOpenDoorHeading, opened);
    gaitProgress = opened;
    distance = openDoorStance.distanceTo(opening) * opened;
  }
  if (phase === "move_to_gift") {
    position = openDoorStance.clone().lerp(pickup, p);
    heading = turn(reachOpenDoorHeading, Math.PI, progress);
    distance = openDoorStance.distanceTo(pickup) * p;
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
  if (index >= phases.indexOf("offer_gift")) position = presentation.clone();
  if (phase === "turn_back_to_fridge") {
    const direction = returning.getTangentAt(1).negate();
    heading = turn(0, Math.atan2(direction.x, direction.z), progress);
  }
  if (phase === "carry_to_fridge") {
    position = returning.getPointAt(1 - p);
    const tangent = returning.getTangentAt(1 - p).negate();
    heading = turn(Math.atan2(tangent.x, tangent.z), Math.PI, (progress - 0.76) / 0.24);
    distance = returning.getLength() * p;
  }
  if (phase === "shelve_gift" || phase === "release_gift") {
    position = pickup.clone();
    heading = Math.PI;
  }
  if (phase === "step_to_door") {
    const direction = openDoorStance.clone().sub(pickup);
    position = pickup.clone().lerp(openDoorStance, p);
    heading = turn(Math.PI, Math.atan2(direction.x, direction.z), progress / 0.23);
    heading = turn(heading, reachOpenDoorHeading, (progress - 0.75) / 0.25);
    distance = direction.length() * p;
  }
  const closing = phase === "close_fridge" ? smooth((progress - 0.2) / 0.58) : ramp("close_fridge");
  if (phase === "close_fridge") {
    // Step around the outside of the swinging door while guiding the handle.
    position = doorStance(1 - closing);
    heading = turn(reachOpenDoorHeading, reachClosedDoorHeading, closing);
    gaitProgress = closing;
    distance = openDoorStance.distanceTo(opening) * closing;
  }
  if (phase === "return_to_center") {
    position = backToCenter.getPointAt(p);
    const tangent = backToCenter.getTangentAt(p);
    heading = turn(reachClosedDoorHeading, Math.atan2(tangent.x, tangent.z), progress / 0.22);
    heading = turn(heading, 0, (progress - 0.76) / 0.24);
    distance = backToCenter.getLength() * p;
  }
  const release = ramp("release_gift");
  const setDown = ramp("shelve_gift");
  return {
    position,
    heading,
    cameraProgress: 1 - ramp("walk_to_fridge"),
    doorOpen: opened - closing,
    handleReach:
      phase === "open_fridge"
        ? smooth(progress / 0.22) * (1 - smooth((progress - 0.78) / 0.22))
        : phase === "close_fridge"
          ? smooth(progress / 0.2) * (1 - smooth((progress - 0.78) / 0.22))
          : 0,
    giftReach: ramp("reach_gift") - release,
    giftTransfer: ramp("take_gift"),
    offering: ramp("offer_gift") - ramp("turn_back_to_fridge"),
    giftCamera: ramp("gift_closeup") - ramp("turn_back_to_fridge"),
    wideCamera: ramp("turn_back_to_fridge"),
    fridgeFocus: ramp("carry_to_fridge") - ramp("return_to_center"),
    reveal: ramp("gift_burst"),
    setDown,
    locomotion: {
      phase: (distance / 1.25) * Math.PI * 2,
      blend: moving
        ? smooth(gaitProgress / 0.1) * (1 - smooth((gaitProgress - 0.9) / 0.1))
        : 0,
    },
    walking: moving,
    lean:
      phase === "reach_gift" || phase === "take_gift"
        ? 0.075
        : 0.025 * (ramp("take_gift") - release) + 0.15 * (setDown - release),
  };
}
