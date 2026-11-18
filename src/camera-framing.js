import * as THREE from "three";
import { CLOSEUP_TORO_Z } from "./greeting.js";

export function updateCameraFraming(
  camera,
  width,
  height,
  panelHeight,
  progress,
) {
  camera.aspect = width / height;
  const availableHeight = Math.max(160, height - panelHeight - 12);
  // The gameplay image occupies 568 × 386 pixels in the capture. Its
  // horizon sits 45 pixels below center and the wall posts stay vertical.
  const roomSlope = Math.max((193 / 375) * height / Math.max(160, height - panelHeight), (284 / 375) / camera.aspect);
  const faceHalfHeight = Math.max(
    (0.73 * height) / availableHeight,
    1.05 / camera.aspect,
  );
  const roomFov = 2 * Math.atan(roomSlope);
  const faceFov = 2 * Math.atan(faceHalfHeight / 1.5);
  const framingBlend = THREE.MathUtils.smoothstep(progress, 0.35, 1);
  camera.fov = THREE.MathUtils.radToDeg(
    THREE.MathUtils.lerp(roomFov, faceFov, framingBlend),
  );
  camera.position.set(0, THREE.MathUtils.lerp(3.65, 3.8, framingBlend), 12);
  const facePitch = Math.atan2(0.8, 12 - CLOSEUP_TORO_Z - 0.5);
  camera.rotation.set(
    -facePitch * framingBlend,
    0,
    0,
  );
  const horizonOffset = (45 / 375) * height / (2 * roomSlope);
  camera.setViewOffset(width, height, 0, panelHeight / 2 - horizonOffset * (1 - framingBlend), width, height);
  camera.updateProjectionMatrix();
}
