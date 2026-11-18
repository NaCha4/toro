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
  const shortLandscape = width > height && height <= 500;
  const roomHalfHeight = Math.max(
    ((shortLandscape ? 3.1 : 3.7) * height) / availableHeight,
    3.6 / camera.aspect,
  );
  const faceHalfHeight = Math.max(
    (0.95 * height) / availableHeight,
    1.05 / camera.aspect,
  );
  const roomFov = 2 * Math.atan(roomHalfHeight / 13.1);
  const faceFov = 2 * Math.atan(faceHalfHeight / 1.5);
  const framingBlend = THREE.MathUtils.smoothstep(progress, 0.35, 1);
  camera.fov = THREE.MathUtils.radToDeg(
    THREE.MathUtils.lerp(roomFov, faceFov, framingBlend),
  );
  camera.position.set(0, 3.8, 12);
  const roomPitch = Math.atan2(1.3, 12.7);
  const facePitch = Math.atan2(0.8, 12 - CLOSEUP_TORO_Z - 0.5);
  camera.rotation.set(
    -THREE.MathUtils.lerp(roomPitch, facePitch, framingBlend),
    0,
    0,
  );
  camera.setViewOffset(width, height, 0, panelHeight / 2, width, height);
  camera.updateProjectionMatrix();
}
