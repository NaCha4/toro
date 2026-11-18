import * as THREE from "three";

export function createArmIK(root, side) {
  const shoulder = root.getObjectByName(`Bip01_toro_${side}_UpperArm`);
  const elbow = root.getObjectByName(`Bip01_toro_${side}_ForeArm`);
  const wrist = root.getObjectByName(`Bip01_toro_${side}_Wrist`);
  const grip = new THREE.Object3D();
  grip.name = `${side} paw grip`;
  grip.position.y = wrist.position.y * (0.25 / 0.7);
  wrist.add(grip);
  const shoulderPosition = new THREE.Vector3();
  const elbowPosition = new THREE.Vector3();
  const handPosition = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const elbowGoal = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const rotation = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();
  const rootRotation = new THREE.Quaternion();

  function aim(joint, current, desired) {
    rotation.setFromUnitVectors(current.normalize(), desired.normalize());
    joint.parent.getWorldQuaternion(parentRotation);
    inverse.copy(parentRotation).invert();
    rotation.premultiply(inverse).multiply(parentRotation);
    joint.quaternion.premultiply(rotation).normalize();
    joint.updateWorldMatrix(true, true);
  }

  return {
    getPosition(target) {
      return grip.getWorldPosition(target);
    },
    solve(target, amount = 1) {
      if (amount <= 0) return;
      root.updateMatrixWorld(true);
      const shoulderRest = shoulder.quaternion.clone();
      const elbowRest = elbow.quaternion.clone();
      shoulder.getWorldPosition(shoulderPosition);
      elbow.getWorldPosition(elbowPosition);
      grip.getWorldPosition(handPosition);
      const upperLength = shoulderPosition.distanceTo(elbowPosition);
      const lowerLength = elbowPosition.distanceTo(handPosition);
      direction.copy(target).sub(shoulderPosition);
      const distance = THREE.MathUtils.clamp(
        direction.length(),
        Math.abs(upperLength - lowerLength) + 0.001,
        upperLength + lowerLength - 0.001,
      );
      direction.normalize();
      goal.copy(shoulderPosition).addScaledVector(direction, distance);
      root.getWorldQuaternion(rootRotation);
      bend.set(side === "L" ? 1 : -1, -0.65, 0.1).applyQuaternion(rootRotation);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const cosine = THREE.MathUtils.clamp(
        (upperLength * upperLength +
          distance * distance -
          lowerLength * lowerLength) /
          (2 * upperLength * distance),
        -1,
        1,
      );
      elbowGoal
        .copy(shoulderPosition)
        .addScaledVector(direction, upperLength * cosine)
        .addScaledVector(bend, upperLength * Math.sqrt(1 - cosine * cosine));
      aim(
        shoulder,
        from.copy(elbowPosition).sub(shoulderPosition),
        to.copy(elbowGoal).sub(shoulderPosition),
      );
      elbow.getWorldPosition(elbowPosition);
      grip.getWorldPosition(handPosition);
      aim(
        elbow,
        from.copy(handPosition).sub(elbowPosition),
        to.copy(goal).sub(elbowPosition),
      );
      shoulder.quaternion.copy(shoulderRest.slerp(shoulder.quaternion, amount));
      elbow.quaternion.copy(elbowRest.slerp(elbow.quaternion, amount));
      root.updateMatrixWorld(true);
    },
  };
}
