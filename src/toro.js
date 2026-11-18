import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createGreetingMotion } from "./greeting-motion.js";
import { CHEER_DANCE_DURATION, sampleCheerDance } from "./cheer-dance.js";
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
  const mouth = new THREE.Object3D();
  // Anchor the rim to the mouth on the supplied face atlas as the head tilts.
  mouth.position.copy(body.head.bone.worldToLocal(new THREE.Vector3(0, 2.55, 0.78)));
  body.head.bone.add(mouth);
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
    danceProgress = null,
  ) {
    if (pose !== previousPose) {
      previousPose = pose;
      poseStartedAt = time;
    }
    const greeting = sampleGreeting(time - poseStartedAt, motion, poseBlend);
    const stepPhase = locomotion?.phase ?? approachProgress * Math.PI * 16;
    const walkBlend = motion
      ? (locomotion?.blend ??
        THREE.MathUtils.smoothstep(approachProgress, 0, 0.06) *
          (1 - THREE.MathUtils.smoothstep(approachProgress, 0.91, 1)))
      : 0;
    const stride = Math.sin(stepPhase) * walkBlend;
    root.rotation.y = 0;
    root.position.x = 0;
    root.position.y = 0;
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
    if (pose === "dance") {
      const previewProgress = ((time - poseStartedAt) % CHEER_DANCE_DURATION) / CHEER_DANCE_DURATION;
      const dance = sampleCheerDance(motion ? (danceProgress ?? previewProgress) : 0.34);
      applyCheerDance(dance);
      return dance.expression;
    }
  }

  function applyPetting(pose, amount = 1) {
    const x = pose.x * amount;
    const y = pose.y * amount;
    const pressure = pose.pressure * amount;
    rotateJoint(body.neck, y * 0.04, x * 0.055, -x * 0.04);
    rotateJoint(body.head, y * 0.17 + pressure * 0.04, x * 0.23, -x * 0.21);
  }

  function applyCheerDance(dance) {
    const { weight, stance, finish, turnIn, step } = dance;
    const hipRoll = 0.09 * weight;
    const chestRoll = 0.15 * weight * (1 - finish);
    root.position.x = weight * 0.20 - finish * 0.055 - step * 0.045;
    root.rotation.y = -1.5 * turnIn;
    rotateJoint(body.pelvis, 0, 0.59 * finish, hipRoll);
    rotateJoint(body.spine, -0.025 * stance, 0.08 * finish, chestRoll - hipRoll);
    // The chest counterbalances the tapping foot. The face tips the other way
    // and stays towards the viewer as the ribs turn for the cheek pose.
    rotateJoint(body.neck, 0, -0.28 * finish, -0.08 * weight);
    rotateJoint(body.head, -0.04 * finish, -0.35 * finish,
      -chestRoll - 0.055 * weight - 0.43 * finish);
    for (const arm of armBones) {
      const left = arm.side > 0;
      const upper = left ? dance.leftUpper : dance.rightUpper;
      const fore = left ? dance.leftFore : dance.rightFore;
      const isUpper = arm.part === "UpperArm";
      const roll = isUpper ? arm.side * (upper + 1.35) - chestRoll : arm.side * (fore - upper);
      rotateJoint(arm, isUpper ? arm.side * step * 0.24 : 0, 0, roll);
      if (isUpper) {
        const forward = left ? dance.leftForward : dance.rightForward;
        rotateJoint(arm, left ? 0 : 0.25 * finish, -arm.side * forward * 1.02, 0);
      }
    }
    const leftLeg = (0.23 * stance - 0.23 * weight) * (1 - finish);
    const rightLeg = (-0.25 * stance - 0.25 * weight) * (1 - finish);
    rotateJoint(body.leftThigh, -1.30 * finish - 0.61 * step, 0, leftLeg - hipRoll);
    rotateJoint(body.rightThigh, 0.61 * step, 0, rightLeg - hipRoll);
    rotateJoint(body.leftCalf, 1.32 * finish + 0.36 * step, 0, 0);
    groundFeet();
  }

  function applyActing(lean = 0, headPitch = 0) {
    rotateJoint(body.spine, lean, 0, 0);
    rotateJoint(body.head, headPitch, 0, 0);
  }

  const gestures = {
    // Head pitch, tilt, upper arm lift, forearm bend and bow.
    listen: [0, 0.015, 0.06, 0.09, 0],
    curious: [-0.055, 0.15, 0.34, 0.33, 0.055],
    proud: [-0.09, -0.055, 0.57, 0.31, -0.05],
    happy: [-0.11, 0.04, 0.93, 0.42, -0.035],
    shy: [0.12, -0.13, 0.10, 0.78, 0.08],
    paws: [0.08, -0.08, 0.14, 0.48, 0.045],
    droop: [0.24, 0.07, -0.025, 0.045, 0.14],
    wave: [-0.06, -0.09, 0.30, 0.22, 0],
  };
  const restGesture = [0, 0, 0, 0, 0];
  const gesturePose = [...restGesture];
  const chest = new THREE.Vector3();
  const pawTarget = new THREE.Vector3();
  const rightDirection = new THREE.Vector3(1, 0, 0);
  let pawsTogether = 0;
  let waveAmount = 0;
  function applyConversation(gesture, time, deltaTime, motion) {
    const target = gestures[gesture] ?? restGesture;
    for (let i = 0; i < target.length; i++)
      gesturePose[i] = motion ? THREE.MathUtils.damp(gesturePose[i], target[i], 8, deltaTime) : target[i];
    waveAmount = THREE.MathUtils.damp(waveAmount, Number(gesture === "wave"), 8, deltaTime);
    const clasp = Number(gesture === "paws" || gesture === "shy");
    pawsTogether = motion ? THREE.MathUtils.damp(pawsTogether, clasp, 7, deltaTime) : clasp;
    if (!gesture && Math.abs(gesturePose[2]) + Math.abs(gesturePose[4]) + waveAmount + pawsTogether < .001) return;
    const [pitch, tilt, lift, bend, bow] = gesturePose;
    const beat = gesture && motion ? Math.sin(time * 3.8) : 0;
    rotateJoint(body.spine, bow, 0, -tilt * 0.14);
    rotateJoint(body.head, pitch + beat * 0.021, tilt * 0.36, tilt);
    for (const arm of armBones) {
      const upper = arm.part === "UpperArm";
      const wave = arm.side > 0 ? waveAmount * (upper ? 0.94 : 0.60 + beat * 0.18) : 0;
      rotateJoint(arm, upper ? -bend * 0.46 : -bend * 0.72, 0,
        arm.side * ((upper ? lift : bend * 0.47) + wave));
    }
    if (pawsTogether > 0.001) {
      body.leftShoulder.bone.getWorldPosition(chest);
      body.rightShoulder.bone.getWorldPosition(pawTarget);
      chest.lerp(pawTarget, .5);
      chest.y -= .10;
      chest.z += .27;
      hands.L.solve(pawTarget.copy(chest).addScaledVector(rightDirection, .075), pawsTogether);
      hands.R.solve(pawTarget.copy(chest).addScaledVector(rightDirection, -.075), pawsTogether);
    }
  }

  function applySakePose(crouch, bow, sip) {
    for (const side of ["left", "right"]) {
      rotateJoint(body[side + "Thigh"], -1.50 * crouch, 0, 0);
      rotateJoint(body[side + "Calf"], 2.50 * crouch, 0, 0);
    }
    rotateJoint(body.spine, 0.23 * crouch + 0.28 * bow - 0.10 * sip, 0, 0);
    rotateJoint(body.neck, 0.16 * bow - 0.08 * sip, 0, 0);
    rotateJoint(body.head, 0.22 * bow - 0.20 * sip, 0, 0);
    if (crouch > 0) groundFeet();
  }

  return {
    root,
    head: root.getObjectByName("toro_head"),
    setExpression,
    animate,
    applyPetting,
    applyActing,
    applyConversation,
    applySakePose,
    mouth,
    hands,
  };
}
