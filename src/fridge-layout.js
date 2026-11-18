import { Vector3 } from "three";

// World coordinates of the cabinet against the back wall. The door and
// Toro's reach use the same hinge and grip through the entire swing.
export const fridgeLayout = {
  x: 8.48,
  frontZ: -2.9,
  width: 3.28,
  depth: 1.83,
  height: 5.08,
  shelfY: 1.11,
  swing: 1.68,
};
export const doorGrip = new Vector3(-2.98, 2.02, 0.11);

export function gripOnSwing(open, target = new Vector3()) {
  const angle = open * fridgeLayout.swing;
  return target.set(
    fridgeLayout.x + fridgeLayout.width / 2 +
      doorGrip.x * Math.cos(angle) + doorGrip.z * Math.sin(angle),
    doorGrip.y,
    fridgeLayout.frontZ - doorGrip.x * Math.sin(angle) + doorGrip.z * Math.cos(angle),
  );
}
