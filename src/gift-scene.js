import * as THREE from "three";
import { createWrappedGift } from "./gift.js";
import { createGiftSequence, sampleGiftSequence } from "./gift-sequence.js";

export function createGiftScene(toro, room, onPhaseChange) {
  const sequence = createGiftSequence(onPhaseChange);
  const gift = createWrappedGift();
  gift.root.position.copy(room.fridge.giftPosition);
  room.root.add(gift.root);
  const carryPosition = new THREE.Vector3();
  const carryRotation = new THREE.Quaternion();
  const originalRotation = new THREE.Quaternion();
  const leftTarget = new THREE.Vector3();
  const rightTarget = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const cameraMatrix = new THREE.Matrix4();
  const cameraRotation = new THREE.Quaternion();
  let frame = sampleGiftSequence("after_pet", 0);

  return {
    get active() {
      return sequence.active;
    },
    get phase() {
      return sequence.phase;
    },
    start() {
      return sequence.start();
    },
    get canOpen() {
      return sequence.phase === "presenting";
    },
    open() {
      return sequence.openPresent();
    },
    openAt(event, canvas, camera) {
      if (sequence.phase !== "presenting") return false;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.intersectObjects(gift.pickables, true).length)
        return false;
      return sequence.openPresent();
    },
    animate(delta, time, motion = true) {
      sequence.update(delta, !motion);
      frame = sampleGiftSequence(sequence.phase, sequence.progress);
      toro.animate(
        time,
        frame.walking ? "walk" : "stand",
        motion,
        1,
        frame.cameraProgress,
        frame.locomotion,
      );
      toro.root.position.x += frame.position.x;
      toro.root.position.z = frame.position.z;
      toro.root.rotation.y += frame.heading;
      toro.applyActing(frame.lean, frame.giftReach * 0.025);
      toro.root.updateMatrixWorld(true);
      room.fridge.setOpen(frame.doorOpen);

      carryPosition.set(
        0,
        THREE.MathUtils.lerp(1.43, 2.05, frame.offering),
        THREE.MathUtils.lerp(0.58, 1.03, frame.offering),
      );
      carryPosition
        .applyQuaternion(toro.root.quaternion)
        .add(toro.root.position);
      carryRotation.setFromAxisAngle(up, toro.root.rotation.y + Math.PI);
      gift.root.position
        .copy(room.fridge.giftPosition)
        .lerp(carryPosition, frame.giftTransfer);
      gift.root.quaternion
        .copy(originalRotation)
        .slerp(carryRotation, frame.giftTransfer);
      gift.root.updateMatrixWorld(true);
      gift.reveal(frame.reveal);
      if (frame.handleReach > 0) {
        room.fridge.getHandlePosition(rightTarget);
        toro.hands.R.solve(rightTarget, frame.handleReach);
      }
      if (frame.giftReach > 0) {
        leftTarget.copy(gift.leftGrip).applyMatrix4(gift.root.matrixWorld);
        rightTarget.copy(gift.rightGrip).applyMatrix4(gift.root.matrixWorld);
        toro.hands.L.solve(leftTarget, frame.giftReach);
        toro.hands.R.solve(rightTarget, frame.giftReach);
      }
      return frame.cameraProgress;
    },
    frameCamera(camera, width, height, panelHeight) {
      if (frame.giftCamera <= 0) return;
      const availableHeight = Math.max(160, height - panelHeight - 12);
      const fov =
        2 *
        Math.atan(
          (Math.tan(THREE.MathUtils.degToRad(25 + frame.reveal * 2.5)) *
            height) /
            availableHeight,
        );
      cameraPosition.set(
        0,
        2.62 + frame.reveal * 0.1,
        4.15 + frame.reveal * 0.35,
      );
      cameraTarget.set(0, 2.28 + frame.reveal * 0.3, 1.9);
      cameraMatrix.lookAt(cameraPosition, cameraTarget, up);
      cameraRotation.setFromRotationMatrix(cameraMatrix);
      camera.position.lerp(cameraPosition, frame.giftCamera);
      camera.quaternion.slerp(cameraRotation, frame.giftCamera);
      camera.fov = THREE.MathUtils.lerp(
        camera.fov,
        THREE.MathUtils.radToDeg(fov),
        frame.giftCamera,
      );
      camera.updateProjectionMatrix();
    },
  };
}
