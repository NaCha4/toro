import * as THREE from "three";

export const GREETING_DURATION = 5.8;

function curve(keys) {
  const interpolation = new THREE.CubicInterpolant(
    new Float32Array(keys.map(([time]) => time)),
    new Float32Array(keys.map(([, value]) => value)),
    1,
  );
  interpolation.settings = {
    endingStart: THREE.ZeroSlopeEnding,
    endingEnd: THREE.ZeroSlopeEnding,
  };
  return (time) => interpolation.evaluate(Math.max(0, time))[0];
}

export function createGreetingMotion() {
  const lift = curve([
    [0, 0],
    [0.18, -0.035],
    [0.48, 0.52],
    [0.83, 1.035],
    [1.1, 1],
    [3.45, 1],
    [3.85, 0.94],
    [4.45, 0.08],
    [4.75, -0.025],
    [5.1, 0],
    [5.35, 0],
    [5.8, 0],
  ]);
  const weight = curve([
    [0, 0],
    [0.28, -0.12],
    [0.75, 1],
    [1.3, 0.9],
    [2, 1.03],
    [2.65, 0.84],
    [3.35, 0.96],
    [3.9, 0.6],
    [4.6, 0],
    [4.95, -0.04],
    [5.2, 0],
    [5.4, 0],
    [5.8, 0],
  ]);
  const swing = curve([
    [0, 0],
    [0.9, 0],
    [1.14, -0.45],
    [1.39, 1],
    [1.66, -0.88],
    [1.96, 0.86],
    [2.28, -0.72],
    [2.61, 0.66],
    [2.94, -0.48],
    [3.28, 0.3],
    [3.58, -0.12],
    [3.9, 0],
    [4.35, 0],
    [5.8, 0],
  ]);
  const nod = curve([
    [0, 0],
    [0.25, 0.35],
    [0.63, -0.12],
    [1.03, 0.15],
    [1.55, 0],
    [2.4, 0.06],
    [3.5, 0.22],
    [4.1, 0.03],
    [4.55, -0.06],
    [5.05, 0],
    [5.35, 0],
    [5.8, 0],
  ]);

  // Offset the FK chain so the wrist trails the elbow and shoulder.
  return (elapsed, motion = true, blend = 1) => {
    const time = motion ? elapsed % GREETING_DURATION : 1.05;
    const wave = (offset) => (motion ? swing(time - offset) * blend : 0);
    return {
      lift: lift(time) * blend,
      elbowLift: lift(time - 0.065) * blend,
      wristLift: lift(time - 0.13) * blend,
      weight: weight(time) * blend,
      chest: weight(time - 0.09) * blend,
      head: weight(time - 0.19) * blend,
      nod: nod(time - 0.12) * blend,
      shoulderSwing: wave(0),
      elbowSwing: wave(0.065),
      wristSwing: wave(0.145),
      palmTwist: wave(0.23),
    };
  };
}
