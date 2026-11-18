import * as THREE from "three";

export function addWrist(root, side) {
  const mesh = root.getObjectByName(`toro_${side.toLowerCase()}arm`);
  const forearm = root.getObjectByName(`Bip01_toro_${side}_ForeArm`);
  if (!mesh?.isSkinnedMesh || !forearm) {
    throw new Error(`The supplied ${side} arm rig is incomplete`);
  }
  const skeleton = mesh.skeleton;
  const forearmIndex = skeleton.bones.indexOf(forearm);
  const indices = mesh.geometry.attributes.skinIndex;
  const weights = mesh.geometry.attributes.skinWeight;
  const elbow = forearm.getWorldPosition(new THREE.Vector3());
  const direction = new THREE.Vector3(0, 1, 0).transformDirection(
    forearm.matrixWorld,
  );
  const point = new THREE.Vector3();
  const projections = new Float32Array(weights.count);
  let length = 0;
  for (let vertex = 0; vertex < weights.count; vertex++) {
    mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
    projections[vertex] = point.sub(elbow).dot(direction);
    length = Math.max(length, projections[vertex]);
  }

  const wristDistance = length * 0.7;
  const wrist = new THREE.Bone();
  wrist.name = `Bip01_toro_${side}_Wrist`;
  wrist.position.copy(
    forearm.worldToLocal(elbow.addScaledVector(direction, wristDistance)),
  );
  forearm.add(wrist);
  root.updateMatrixWorld(true);
  const wristIndex = skeleton.bones.length;
  mesh.skeleton = new THREE.Skeleton(
    [...skeleton.bones, wrist],
    [
      ...skeleton.boneInverses,
      wrist.matrix
        .clone()
        .invert()
        .multiply(skeleton.boneInverses[forearmIndex]),
    ],
  );

  // Blend the existing forearm weights into the added wrist without changing its rest shape.
  for (let vertex = 0; vertex < weights.count; vertex++) {
    const blend = THREE.MathUtils.smoothstep(
      projections[vertex],
      wristDistance - length * 0.09,
      wristDistance + length * 0.13,
    );
    if (blend === 0) continue;
    let forearmSlot = -1;
    let spareSlot = -1;
    let smallestWeight = Infinity;
    for (let slot = 0; slot < 4; slot++) {
      const weight = weights.getComponent(vertex, slot);
      if (indices.getComponent(vertex, slot) === forearmIndex && weight > 0) {
        forearmSlot = slot;
      } else if (weight < smallestWeight) {
        spareSlot = slot;
        smallestWeight = weight;
      }
    }
    if (forearmSlot === -1) continue;
    const forearmWeight =
      weights.getComponent(vertex, forearmSlot) + smallestWeight;
    weights.setComponent(vertex, forearmSlot, forearmWeight * (1 - blend));
    weights.setComponent(vertex, spareSlot, forearmWeight * blend);
    indices.setComponent(vertex, spareSlot, wristIndex);
  }
  indices.needsUpdate = true;
  weights.needsUpdate = true;
  return wrist;
}
