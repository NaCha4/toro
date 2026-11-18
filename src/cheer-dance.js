import { MathUtils } from "three";

// Seconds relative to 17:38 in the reference. After the cheek accent, the
// raised paw opens out again before the single-play version returns to rest.
export const CHEER_DANCE_DURATION = 9.68;
const restArm = -1.35 * MathUtils.RAD2DEG;

// Pelvis travel follows the feet: alternate, tap four times on one side,
// answer on the other, then hold the longer accents with both palms up.
const weightKeys = [
  [0, 0], [1.32, 0], [1.52, -1], [1.62, -1], [1.84, 0],
  [2.00, 1], [2.10, 1], [2.30, 0], [2.50, -1], [2.59, -1],
  [2.81, 0], [2.99, 1], [3.27, 0], [3.49, 1], [3.76, 0],
  [3.96, 1], [4.23, 0], [4.43, 1], [4.70, 0],
  [4.91, -1], [5.19, 0], [5.41, -1], [5.68, 0],
  [5.90, -1], [6.16, 0], [6.37, -1], [6.67, -1], [6.96, -0.55],
  [7.09, 0], [7.30, 1], [7.40, 1], [7.76, 0], [7.93, -1],
  [8.07, -1], [8.39, 0], [8.56, 1], [8.75, -0.32], [9.12, -0.32], [9.32, 0],
  [CHEER_DANCE_DURATION, 0],
];

// Absolute segment directions traced in the frontal view, in degrees from
// the outward horizontal. Columns are right upper/forearm, then left.
const armKeys = [
  [0, restArm, restArm, restArm, restArm],
  [1.03, restArm, restArm, restArm, restArm],
  [1.12, -54, -52, -65, -89],
  [1.24, -27, 12, -45, -113],
  [1.40, -22, 62, -39, -129],
  [2.50, -22, 62, -39, -129],
  [2.60, -8, 10, -39, -129],
  [2.69, -24, -65, -39, -129],
  [2.80, -39, -140, -39, -133],
  [5.94, -39, -140, -39, -133],
  [6.03, -24, -91, -24, -91],
  [6.12, -4, 13, -4, 13],
  [6.23, -11, 78, -11, 78],
  [6.36, -20, 70, -20, 70],
  [8.38, -20, 70, -20, 70],
  [8.56, -65, 0, -22, 65],
  [8.64, -10, 34, -46, 36],
  [8.72, 46, 87, -58, 18],
  [8.80, 56, 83, -64, -27],
  [9.09, 56, 83, -64, -27],
  [9.16, 47, 90, -59, -11],
  [9.24, -9, 85, -47, -74],
  [9.32, -19, 71, -39, -129],
  [9.40, -19, 71, -39, -129],
  [CHEER_DANCE_DURATION, restArm, restArm, restArm, restArm],
];

function sampleKeys(keys, t) {
  const index = keys.findIndex(([time]) => time >= t);
  if (index <= 0) return keys[index === 0 ? 0 : keys.length - 1].slice(1);
  const from = keys[index - 1], to = keys[index];
  const blend = MathUtils.smoothstep(t, from[0], to[0]);
  return to.slice(1).map((value, i) => MathUtils.lerp(from[i + 1], value, blend));
}

export function sampleCheerDance(progress) {
  const t = MathUtils.clamp(progress, 0, 1) * CHEER_DANCE_DURATION;
  const ramp = (start, end) => MathUtils.smoothstep(t, start, end);
  const [weight] = sampleKeys(weightKeys, t);
  const [rightUpper, rightFore, leftUpper, leftFore] = sampleKeys(armKeys, t);
  const stance = ramp(1.04, 1.36) - ramp(9.15, CHEER_DANCE_DURATION);
  const finish = ramp(8.55, 8.76) - ramp(9.12, 9.30);
  const turnIn = ramp(0, 0.13) - ramp(0.25, 0.50);
  const step = ramp(0, 0.14) - ramp(0.24, 0.43);
  // On the way up the paws first reach towards the camera, then open out.
  const forward = ramp(5.94, 6.12) - ramp(6.12, 6.34);
  return {
    weight, stance, finish, turnIn, step,
    // At the last accent the right paw reaches in front of the cheek while
    // the left arm swings down behind the turned torso.
    leftForward: forward - 0.62 * finish,
    rightForward: forward + 0.7 * (ramp(2.50, 2.60) - ramp(2.60, 2.80)),
    rightUpper: rightUpper * MathUtils.DEG2RAD,
    rightFore: rightFore * MathUtils.DEG2RAD,
    leftUpper: leftUpper * MathUtils.DEG2RAD,
    leftFore: leftFore * MathUtils.DEG2RAD,
    expression: t >= 8.76 && t < 9.22 ? "excited"
      : (t >= 2.60 && t < 4.78) || (t >= 6.24 && t < 8.61) ? "smile" : "normal",
  };
}
