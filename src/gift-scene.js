import * as THREE from "three";
import { createWrappedGift } from "./gift.js";
import { createSakeDelivery, SAKE_PHASES } from "./sake-delivery.js";
import { createGiftSequence, sampleGiftSequence } from "./gift-sequence.js";

export function createGiftScene(toro, room, onPhaseChange) {
  const delivery = createSakeDelivery(toro, room);
  const sequence = createGiftSequence((phase) => {
    if (phase === "stand_at_center") delivery.hide();
    onPhaseChange?.(phase);
  });
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
  const widePosition = new THREE.Vector3(0, 3.0, 12);
  const wideTarget = new THREE.Vector3(0, 2.05, 1.2);
  const cameraMatrix = new THREE.Matrix4();
  const cameraRotation = new THREE.Quaternion();
  let frame = sampleGiftSequence("turn_to_fridge", 0);
  let expression;

  return {
    get active() {
      return sequence.active;
    },
    get phase() {
      return sequence.phase;
    },
    get danceExpression() {
      return sequence.phase === "dancing" ? expression : undefined;
    },
    get expression() {
      return expression;
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
    startDance() {
      return sequence.startDance();
    },
    startSakeDelivery() {
      return sequence.startSakeDelivery();
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
      if (Object.hasOwn(SAKE_PHASES, sequence.phase)) {
        expression = delivery.animate(sequence.phase, sequence.progress, time, motion);
        return 0;
      }
      frame = sampleGiftSequence(sequence.phase, sequence.progress);
      expression = toro.animate(
        time,
        sequence.phase === "dancing" ? "dance" : frame.walking ? "walk" : "stand",
        motion,
        1,
        frame.cameraProgress,
        frame.locomotion,
        sequence.progress,
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
        .lerp(carryPosition, frame.giftTransfer)
        .lerp(room.fridge.giftPosition, frame.setDown);
      gift.root.quaternion
        .copy(originalRotation)
        .slerp(carryRotation, frame.giftTransfer)
        .slerp(originalRotation, frame.setDown);
      gift.root.updateMatrixWorld(true);
      gift.reveal(frame.reveal);
      if (frame.handleReach > 0) {
        room.fridge.getHandlePosition(rightTarget);
        const hand = sequence.phase === "close_fridge" ? toro.hands.L : toro.hands.R;
        hand.solve(rightTarget, frame.handleReach);
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
      if (Object.hasOwn(SAKE_PHASES, sequence.phase)) {
        delivery.frameCamera(camera, width, height);
        return;
      }
      const blend = frame.giftCamera + frame.wideCamera;
      if (blend <= 0) return;
      const availableHeight = Math.max(160, height - panelHeight - 12);
      const closeFov =
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
      const wideHeight = THREE.MathUtils.lerp(5.55, 3.8, frame.fridgeFocus);
      const wideFov = 2 * Math.atan(Math.max(wideHeight, 6.2 / camera.aspect) / 10.7);
      const fov = THREE.MathUtils.lerp(closeFov, wideFov, frame.wideCamera);
      cameraPosition.lerp(widePosition, frame.wideCamera);
      cameraTarget.lerp(wideTarget, frame.wideCamera);
      // Watch from the open side so Toro's head doesn't hide the cake as it goes in.
      const fridge = room.fridge.root.position;
      cameraPosition.x += fridge.x * 0.28 * frame.fridgeFocus;
      cameraPosition.z -= 3.5 * frame.fridgeFocus;
      cameraTarget.x += fridge.x * frame.fridgeFocus;
      cameraTarget.z += (fridge.z + 0.7 - wideTarget.z) * frame.fridgeFocus;
      cameraMatrix.lookAt(cameraPosition, cameraTarget, up);
      cameraRotation.setFromRotationMatrix(cameraMatrix);
      camera.position.lerp(cameraPosition, blend);
      camera.quaternion.slerp(cameraRotation, blend);
      camera.fov = THREE.MathUtils.lerp(
        camera.fov,
        THREE.MathUtils.radToDeg(fov),
        blend,
      );
      const offsetY = THREE.MathUtils.lerp(camera.view.offsetY, (1 - frame.wideCamera) * panelHeight / 2, blend);
      camera.setViewOffset(width, height, 0, offsetY, width, height);
      camera.updateProjectionMatrix();
    },
  };
}
