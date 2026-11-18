import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const expressions = [
  { id: "normal", label: "방긋", tile: 0 },
  { id: "smile", label: "활짝", tile: 1 },
  { id: "content", label: "흐뭇", tile: 2 },
  { id: "laugh", label: "행복", tile: 3 },
  { id: "surprised", label: "깜짝", tile: 4 },
  { id: "shocked", label: "경악", tile: 5 },
  { id: "worried", label: "곤란", tile: 6 },
  { id: "upset", label: "속상", tile: 7 },
  { id: "sleepy", label: "졸려", tile: 8 },
  { id: "dazed", label: "멍함", tile: 9 },
  { id: "excited", label: "신나", tile: 10 },
  { id: "delighted", label: "꺄아", tile: 11 },
  { id: "sad", label: "시무룩", tile: 12 },
  { id: "pleading", label: "울먹", tile: 13 },
  { id: "calm", label: "차분", tile: 14 },
  { id: "cheerful", label: "싱긋", tile: 15 },
];

export async function loadToro() {
  const gltf = await new GLTFLoader().loadAsync(
    new URL("toro.glb", document.baseURI).href,
  );
  const root = gltf.scene;
  const faces = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const surface of materials) {
      if (surface.userData.textureRole === "faceAtlas") faces.add(surface);
    }
  });
  if (!faces.size) throw new Error("The supplied model has no face atlas");
  for (const surface of faces) {
    surface.map = surface.map.clone();
    surface.map.anisotropy = 4;
    surface.map.needsUpdate = true;
  }
  root.updateMatrixWorld(true);
  const armBones = [];
  const delta = new THREE.Quaternion();
  for (const side of ["L", "R"]) {
    for (const part of ["UpperArm", "ForeArm"]) {
      const bone = root.getObjectByName(`Bip01_toro_${side}_${part}`);
      if (!bone) throw new Error("The supplied arm rig is incomplete");
      const parentRotation = bone.parent.getWorldQuaternion(
        new THREE.Quaternion(),
      );
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(
        parentRotation.invert(),
      );
      const position = bone.getWorldPosition(new THREE.Vector3());
      armBones.push({
        bone,
        part,
        side: Math.sign(position.x),
        rest: bone.quaternion.clone(),
        axis,
      });
    }
  }

  function setExpression(id) {
    const expression = expressions.find((item) => item.id === id);
    if (!expression) return;
    const column = expression.tile % 4;
    const row = Math.floor(expression.tile / 4);
    for (const surface of faces) {
      surface.map.offset.set(column / 4, -row / 4);
      surface.map.updateMatrix();
    }
  }

  function animate(time, pose, motion = true) {
    const sway = motion ? Math.sin(time * 1.8) : 0;
    root.rotation.y = pose === "dance" ? sway * 0.1 : 0;
    root.position.y = pose === "dance" ? Math.abs(sway) * 0.04 : 0;
    for (const arm of armBones) {
      let angle = arm.part === "UpperArm" ? -arm.side * 1.35 : 0;
      if (pose === "wave" && arm.side > 0) {
        angle =
          arm.part === "UpperArm"
            ? arm.side * 0.15
            : arm.side * (1.1 + sway * 0.22);
      }
      if (pose === "dance") {
        angle =
          arm.part === "UpperArm"
            ? arm.side * (0.25 + sway * 0.3)
            : arm.side * 0.65;
      }
      arm.bone.quaternion
        .copy(arm.rest)
        .premultiply(delta.setFromAxisAngle(arm.axis, angle));
    }
  }

  return { root, setExpression, animate };
}
