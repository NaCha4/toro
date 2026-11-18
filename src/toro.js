import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createGreetingMotion } from "./greeting-motion.js";
import { addWrist } from "./wrist.js";
import { createArmIK } from "./arm-ik.js";

export const expressions = [
  { number: 1, id: "normal", label: "방긋", tile: 0 },
  { number: 2, id: "smile", label: "활짝", tile: 1 },
  { number: 3, id: "content", label: "흐뭇", tile: 2 },
  { number: 4, id: "laugh", label: "행복", tile: 3 },
  { number: 5, id: "surprised", label: "깜짝", tile: 4 },
  { number: 6, id: "shocked", label: "경악", tile: 5 },
  { number: 7, id: "worried", label: "곤란", tile: 6 },
  { number: 8, id: "upset", label: "속상", tile: 7 },
  { number: 9, id: "sleepy", label: "졸려", tile: 8 },
  { number: 10, id: "dazed", label: "멍함", tile: 9 },
  { number: 11, id: "excited", label: "신나", tile: 10 },
  { number: 12, id: "delighted", label: "꺄아", tile: 11 },
  { number: 13, id: "sad", label: "시무룩", tile: 12 },
  { number: 14, id: "pleading", label: "울먹", tile: 13 },
  { number: 15, id: "calm", label: "차분", tile: 14 },
  { number: 16, id: "cheerful", label: "싱긋", tile: 15 },
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
  addWrist(root, "L");
  addWrist(root, "R");
  const delta = new THREE.Quaternion();
  function captureJoint(name) {
    const bone = root.getObjectByName(`Bip01_toro_${name}`);
    if (!bone) throw new Error(`The supplied rig is missing ${name}`);
    const parentRotation = bone.parent
      .getWorldQuaternion(new THREE.Quaternion())
      .invert();
    return {
      bone,
      rest: bone.quaternion.clone(),
      pitchAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(parentRotation),
      yawAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(parentRotation),
      rollAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(parentRotation),
    };
  }

  const armBones = [];
  for (const side of ["L", "R"]) {
    for (const part of ["UpperArm", "ForeArm"]) {
      const joint = captureJoint(`${side}_${part}`);
      const position = joint.bone.getWorldPosition(new THREE.Vector3());
      armBones.push({
        ...joint,
        part,
        side: Math.sign(position.x),
      });
    }
  }
  const body = {
    pelvis: captureJoint("Pelvis"),
    spine: captureJoint("Spine"),
    neck: captureJoint("Neck"),
    head: captureJoint("Head"),
    leftShoulder: captureJoint("L_Clavicle"),
    rightShoulder: captureJoint("R_Clavicle"),
    leftWrist: captureJoint("L_Wrist"),
    rightWrist: captureJoint("R_Wrist"),
    leftThigh: captureJoint("L_Thigh"),
    leftCalf: captureJoint("L_Calf"),
    rightThigh: captureJoint("R_Thigh"),
    rightCalf: captureJoint("R_Calf"),
  };
  const bodyJoints = Object.values(body);
  const hands = { L: createArmIK(root, "L"), R: createArmIK(root, "R") };
  const footPoint = new THREE.Vector3();
  const feet = ["toro_lleg", "toro_rleg"].map((name) => {
    const mesh = root.getObjectByName(name);
    if (!mesh?.isSkinnedMesh)
      throw new Error(`The supplied rig is missing ${name}`);
    const positions = mesh.geometry.attributes.position;
    const heights = [];
    for (let index = 0; index < positions.count; index++) {
      mesh.getVertexPosition(index, footPoint).applyMatrix4(mesh.matrixWorld);
      heights.push(footPoint.y);
    }
    const bottom = Math.min(...heights);
    return {
      mesh,
      // Keep the sole vertices so knee bends can stay in contact with the floor.
      vertices: heights.flatMap((height, index) =>
        height < bottom + 0.08 ? [index] : [],
      ),
    };
  });

  function rotateJoint(joint, pitch, yaw, roll) {
    joint.bone.quaternion
      .premultiply(delta.setFromAxisAngle(joint.pitchAxis, pitch))
      .premultiply(delta.setFromAxisAngle(joint.yawAxis, yaw))
      .premultiply(delta.setFromAxisAngle(joint.rollAxis, roll));
  }

  function groundFeet() {
    root.updateMatrixWorld(true);
    let bottom = Infinity;
    for (const { mesh, vertices } of feet) {
      for (const index of vertices) {
        mesh.getVertexPosition(index, footPoint).applyMatrix4(mesh.matrixWorld);
        bottom = Math.min(bottom, footPoint.y);
      }
    }
    root.position.y -= bottom;
  }

  function setExpression(id) {
    const expression = expressions.find(
      (item) => item.id === id || item.number === id,
    );
    if (!expression) return;
    const column = expression.tile % 4;
    const row = Math.floor(expression.tile / 4);
    for (const surface of faces) {
      surface.map.offset.set(column / 4, -row / 4);
      surface.map.updateMatrix();
    }
  }

  let previousPose;
  let poseStartedAt = 0;
  const sampleGreeting = createGreetingMotion();
  function animate(
    time,
    pose,
    motion = true,
    poseBlend = 1,
    approachProgress = 0,
    locomotion = null,
  ) {
    if (pose !== previousPose) {
      previousPose = pose;
      poseStartedAt = time;
    }
    const sway = motion ? Math.sin(time * 1.8) : 0;
    const greeting = sampleGreeting(time - poseStartedAt, motion, poseBlend);
    const stepPhase = locomotion?.phase ?? approachProgress * Math.PI * 16;
    const walkBlend = motion
      ? (locomotion?.blend ??
        THREE.MathUtils.smoothstep(approachProgress, 0, 0.06) *
          (1 - THREE.MathUtils.smoothstep(approachProgress, 0.91, 1)))
      : 0;
    const stride = Math.sin(stepPhase) * walkBlend;
    root.rotation.y = pose === "dance" ? sway * 0.1 : 0;
    root.position.x = 0;
    root.position.y = pose === "dance" ? Math.abs(sway) * 0.04 : 0;
    for (const joint of bodyJoints) joint.bone.quaternion.copy(joint.rest);

    if (pose === "wave") {
      root.rotation.y =
        greeting.weight * 0.065 + greeting.shoulderSwing * 0.008;
      root.position.x = greeting.weight * -0.035;
      rotateJoint(
        body.pelvis,
        greeting.weight * 0.02,
        0,
        greeting.weight * 0.015,
      );
      rotateJoint(
        body.spine,
        greeting.chest * -0.015 + greeting.nod * 0.04,
        0,
        greeting.chest * 0.065 + greeting.shoulderSwing * 0.012,
      );
      rotateJoint(body.neck, greeting.head * 0.03, greeting.head * -0.035, 0);
      rotateJoint(
        body.head,
        greeting.head * 0.03 + greeting.nod * 0.12,
        0,
        greeting.head * -0.13 - greeting.wristSwing * 0.022,
      );
      rotateJoint(
        body.leftShoulder,
        greeting.lift * -0.04,
        greeting.lift * -0.07,
        greeting.lift * 0.025 + greeting.shoulderSwing * 0.015,
      );
      rotateJoint(body.rightShoulder, 0, 0, greeting.chest * -0.015);
      rotateJoint(
        body.leftWrist,
        greeting.wristLift * 0.06 + greeting.palmTwist * 0.1,
        greeting.wristLift * -0.1 + greeting.palmTwist * 0.14,
        greeting.wristLift * 0.04 + greeting.wristSwing * 0.42,
      );
      rotateJoint(
        body.rightWrist,
        0,
        0,
        greeting.chest * -0.09 - greeting.elbowSwing * 0.025,
      );
      const leftKnee = greeting.weight * 0.16 + greeting.nod * 0.08;
      const rightKnee = greeting.weight * 0.1 + greeting.nod * 0.06;
      rotateJoint(body.leftThigh, -leftKnee * 0.5, 0, greeting.weight * -0.01);
      rotateJoint(body.leftCalf, leftKnee, 0, 0);
      rotateJoint(body.rightThigh, -rightKnee * 0.5, 0, greeting.weight * 0.01);
      rotateJoint(body.rightCalf, rightKnee, 0, 0);
    }
    if (pose === "walk") {
      root.position.x = stride * 0.018;
      root.rotation.y = stride * 0.025;
      rotateJoint(
        body.pelvis,
        walkBlend * 0.02,
        stride * 0.025,
        stride * 0.018,
      );
      rotateJoint(
        body.spine,
        walkBlend * 0.045,
        -stride * 0.02,
        -stride * 0.012,
      );
      rotateJoint(body.head, -walkBlend * 0.025, 0, stride * 0.01);
      rotateJoint(body.leftThigh, -stride * 0.44, 0, 0);
      rotateJoint(body.rightThigh, stride * 0.44, 0, 0);
      rotateJoint(
        body.leftCalf,
        walkBlend * 0.04 + Math.max(0, stride) * 0.5,
        0,
        0,
      );
      rotateJoint(
        body.rightCalf,
        walkBlend * 0.04 + Math.max(0, -stride) * 0.5,
        0,
        0,
      );
    }
    const closeupLean = THREE.MathUtils.smoothstep(approachProgress, 0.75, 1);
    rotateJoint(body.head, closeupLean * 0.07, 0, 0);

    for (const arm of armBones) {
      const restingAngle = arm.part === "UpperArm" ? -arm.side * 1.35 : 0;
      let angle = restingAngle;
      if (pose === "wave" && arm.side > 0) {
        const raisedAngle =
          arm.part === "UpperArm"
            ? 0.04 + greeting.shoulderSwing * 0.07
            : 0.92 + greeting.elbowSwing * 0.12;
        const lift =
          arm.part === "UpperArm" ? greeting.lift : greeting.elbowLift;
        angle = THREE.MathUtils.lerp(restingAngle, raisedAngle, lift);
      } else if (pose === "wave") {
        angle +=
          greeting.chest * (arm.part === "UpperArm" ? -0.11 : -0.2) -
          greeting.elbowSwing * 0.02;
      }
      if (pose === "dance") {
        angle =
          arm.part === "UpperArm"
            ? arm.side * (0.25 + sway * 0.3)
            : arm.side * 0.65;
      }
      arm.bone.quaternion
        .copy(arm.rest)
        .premultiply(delta.setFromAxisAngle(arm.rollAxis, angle));
      if (pose === "wave" && arm.side > 0) {
        rotateJoint(
          arm,
          greeting.lift * -0.035,
          greeting.elbowLift * -0.085 + greeting.shoulderSwing * 0.025,
          0,
        );
      }
      if (pose === "walk") {
        const swing =
          arm.part === "UpperArm"
            ? stride * 0.24
            : Math.sin(stepPhase - 0.3) * walkBlend * 0.1;
        rotateJoint(arm, swing * arm.side, 0, 0);
      }
    }
    if (pose === "wave" || pose === "walk") groundFeet();
  }

  function applyPetting(pose, amount = 1) {
    const x = pose.x * amount;
    const y = pose.y * amount;
    const pressure = pose.pressure * amount;
    rotateJoint(body.neck, y * 0.04, x * 0.055, -x * 0.04);
    rotateJoint(body.head, y * 0.17 + pressure * 0.04, x * 0.23, -x * 0.21);
  }

  function applyActing(lean = 0, headPitch = 0) {
    rotateJoint(body.spine, lean, 0, 0);
    rotateJoint(body.head, headPitch, 0, 0);
  }

  return {
    root,
    head: root.getObjectByName("toro_head"),
    setExpression,
    animate,
    applyPetting,
    applyActing,
    hands,
  };
}
