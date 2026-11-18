import * as THREE from "three";
import { createSakeSet } from "./sake-set.js";

const drinkCount = 5;
const drinkSeconds = 7.25;
// The catalogue is skipped. These beats follow the delivery, five cups and tray return.
export const SAKE_PHASES = {
  sake_arrives: 1.0,
  sake_to_door: 4.6,
  sake_open_door: 2.2,
  sake_go_out: 2.4,
  sake_receive: 3.4,
  sake_step_in: 3.1,
  sake_close_with_parcel: 7.2,
  sake_carry_home: 7.0,
  sake_unpack: 7.6,
  sake_drink: drinkSeconds * drinkCount,
  sake_thanks: 2.8,
  sake_lift_tray: 2.1,
  sake_carry_tray: 7.0,
  sake_open_with_tray: 7.2,
  sake_take_tray_out: 2.4,
  sake_leave_tray: 4.0,
  sake_step_back_in: 2.1,
  sake_close_door: 2.2,
  sake_return: 4.6,
};

export const SAKE_REDUCED_SECONDS = {
  sake_arrives: 0.6, sake_step_in: 1.2, sake_unpack: 1, sake_drink: 2.8, sake_thanks: 1, sake_take_tray_out: 0.9,
};

const ease = (t, from = 0, to = 1) => THREE.MathUtils.smoothstep(t, from, to);
const mix = THREE.MathUtils.lerp;
function turn(a, b, p) { return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p; }

export function sampleSakeDrink(progress) {
  const beat = (Math.min(progress * drinkCount, drinkCount - 1e-8) % 1);
  const pour = ease(beat, 0.06, 0.22) - ease(beat, 0.36, 0.48);
  const lift = ease(beat, 0.50, 0.68) - ease(beat, 0.86, 0.98);
  const sip = ease(beat, 0.66, 0.74) - ease(beat, 0.82, 0.9);
  return {
    pour, lift, sip,
    fill: ease(beat, 0.19, 0.39) - ease(beat, 0.70, 0.84),
    expression: lift > 0.5 ? "content" : pour > 0.1 ? "delighted" : "cheerful",
  };
}

export function createSakeDelivery(toro, room) {
  const props = createSakeSet(room.root);
  const door = room.entrance;
  const center = new THREE.Vector3(0, 0, 1.3);
  const { stance, outside } = door;
  // Cross the central tatami in front of the stereo, satchel and fridge.
  const roomPath = new THREE.CatmullRomCurve3([
    center, new THREE.Vector3(3.6, 0, 1.36), new THREE.Vector3(7.4, 0, 1.42), stance,
  ]);
  const hallPath = new THREE.CatmullRomCurve3([
    stance, new THREE.Vector3(stance.x + 1.7, 0, stance.z), new THREE.Vector3(outside.x - 1.6, 0, stance.z + 0.5), outside,
  ]);
  const position = new THREE.Vector3(), tangent = new THREE.Vector3();
  const pull = new THREE.Vector3(), target = new THREE.Vector3();
  const lip = new THREE.Vector3(), rim = new THREE.Vector3(), streamAxis = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const look = new THREE.Vector3();
  let pan = 0, close = 0;

  function animate(phase, progress, time, motion) {
    let p = progress;
    if (!motion) {
      // Show the parcel and both drinking poses as stills.
      if (phase === "sake_drink") p = progress < 0.5 ? 0.056 : 0.15;
      else if (phase === "sake_take_tray_out") p = 0.13;
      else if (phase === "sake_thanks") p = 0.52;
      else p = 1;
    }
    position.copy(center);
    let heading = 0, open = 0, handle = 0, distance = 0, walk = 0;
    let cargo = null, lift = 1, grip = 0, kneel = 0, bow = 0, palms = 0;
    let cargoYaw, floorAtDoor = false, unpack = 0;
    let drink = { pour: 0, lift: 0, sip: 0, fill: 0 };
    let serving = 0, expression = "normal";
    pan = close = 0;

    function follow(path, reverse, startHeading, endHeading) {
      const u = ease(p);
      const t = reverse ? 1 - u : u;
      path.getPointAt(t, position);
      path.getTangentAt(t, tangent);
      if (reverse) tangent.negate();
      heading = turn(startHeading, Math.atan2(tangent.x, tangent.z), ease(p, 0, 0.19));
      heading = turn(heading, endHeading, ease(p, 0.78, 1));
      distance = path.getLength() * u;
      walk = ease(p, 0, 0.12) - ease(p, 0.88, 1);
    }

    function slide(t, opening) {
      const travel = ease(t, 0.23, 0.78);
      open = opening ? travel : 1 - travel;
      door.setOpen(open);
      door.getPullPosition(pull);
      handle = ease(t, 0, 0.23) - ease(t, 0.78, 1);
      position.z = mix(stance.z, pull.z - 0.24, handle);
      distance = Math.abs(position.z - stance.z);
      walk = handle * Math.min(1, distance * 3);
    }

    function carry(item) { cargo = item; grip = 1; }
    switch (phase) {
      case "sake_arrives":
        heading = turn(0, 0.68, ease(p));
        expression = "surprised";
        break;
      case "sake_to_door":
      case "sake_carry_tray":
        if (phase === "sake_carry_tray") carry(props.tray);
        follow(roomPath, false, cargo ? 0 : 0.68, cargo ? 0 : Math.PI / 2);
        pan = ease(p);
        break;
      case "sake_open_door":
      case "sake_close_door":
        pan = 1;
        position.copy(stance);
        heading = Math.PI / 2;
        slide(p, phase === "sake_open_door");
        break;
      case "sake_go_out":
      case "sake_take_tray_out":
        if (phase === "sake_take_tray_out") carry(props.tray);
        pan = open = 1;
        follow(hallPath, false, cargo ? 0 : Math.PI / 2, Math.PI / 2);
        break;
      case "sake_receive":
      case "sake_leave_tray":
        pan = open = 1;
        position.copy(outside);
        heading = Math.PI / 2;
        carry(phase === "sake_receive" ? props.parcel : props.tray);
        lift = phase === "sake_receive" ? ease(p) : 1 - ease(p);
        kneel = 1 - lift;
        break;
      case "sake_step_in":
      case "sake_step_back_in":
        pan = open = 1;
        if (phase === "sake_step_in") carry(props.parcel);
        follow(hallPath, true, Math.PI / 2, cargo ? 0 : Math.PI / 2);
        break;
      case "sake_close_with_parcel":
      case "sake_open_with_tray": {
        pan = 1;
        position.copy(stance);
        const opening = phase === "sake_open_with_tray";
        carry(opening ? props.tray : props.parcel);
        floorAtDoor = true;
        cargoYaw = 0;
        lift = 1 - ease(p, 0, 0.16) + ease(p, 0.85, 1);
        grip = 1 - ease(p, 0.16, 0.24) + ease(p, 0.79, 0.86);
        kneel = (1 - lift) * grip;
        heading = Math.PI / 2 * (ease(p, 0.2, 0.36) - ease(p, 0.69, 0.81));
        slide((p - 0.28) / 0.45, opening);
        break;
      }
      case "sake_carry_home":
      case "sake_return":
        if (phase === "sake_carry_home") carry(props.parcel);
        follow(roomPath, true, cargo ? 0 : Math.PI / 2, 0);
        pan = 1 - ease(p);
        break;
      case "sake_unpack":
        carry(props.parcel);
        lift = 1 - ease(p, 0, 0.35);
        kneel = 1 - lift;
        close = ease(p, 0.34, 0.70);
        unpack = ease(p, 0.68, 0.84);
        grip = 1 - unpack;
        expression = unpack > 0 && unpack < 1 ? "surprised" : "cheerful";
        break;
      case "sake_drink":
        cargo = props.tray;
        close = kneel = serving = 1;
        lift = 0;
        drink = sampleSakeDrink(p);
        expression = drink.expression;
        break;
      case "sake_thanks":
        cargo = props.tray;
        kneel = 1;
        lift = 0;
        close = 1 - ease(p, 0.58, 1);
        palms = ease(p, 0, 0.22) - ease(p, 0.79, 1);
        serving = 1 - ease(p, 0, 0.22);
        bow = ease(p, 0.20, 0.48) - ease(p, 0.68, 0.9);
        expression = "content";
        break;
      case "sake_lift_tray":
        carry(props.tray);
        lift = ease(p);
        kneel = 1 - lift;
        break;
    }
    door.setOpen(open);
    toro.animate(time, walk ? "walk" : "stand", motion, 1, 0, {
      phase: distance / 1.25 * Math.PI * 2, blend: walk,
    });
    toro.applySakePose(kneel, bow, drink.sip);
    toro.root.position.x += position.x;
    toro.root.position.z = position.z;
    toro.root.rotation.y += heading;
    toro.root.updateMatrixWorld(true);
    props.parcel.visible = cargo === props.parcel && unpack < 0.82;
    props.tray.visible = cargo === props.tray || unpack >= 0.82;
    props.lid.position.y = 0.60 + unpack * 0.48;
    props.lid.rotation.z = unpack * 0.28;
    if (cargo) {
      const origin = floorAtDoor ? stance : position;
      const yaw = cargoYaw ?? heading;
      const reach = 0.68;
      const item = props.tray.visible ? props.tray : props.parcel;
      item.rotation.y = yaw;
      item.position.set(origin.x + Math.sin(yaw) * reach, mix(0.02, cargo === props.parcel ? 1.01 : 1.19, lift),
        origin.z + Math.cos(yaw) * reach);
      item.updateWorldMatrix(true, false);
      if (grip > 0) {
        for (const [side, sign] of [["L", 1], ["R", -1]]) {
          target.set(sign * (cargo === props.parcel ? 0.48 : 0.60), cargo === props.parcel ? 0.25 : 0.055, -0.09);
          toro.hands[side].solve(item.localToWorld(target), grip);
        }
      }
    }
    if (handle > 0) toro.hands.R.solve(pull, handle);
    if (props.tray.visible) {
      const { flask, cup, tray, liquid, stream } = props;
      flask.position.set(-0.30, 0.074 + 0.30 * drink.pour, 0.025);
      flask.rotation.z = -1.18 * drink.pour;
      cup.position.set(0.37, 0.074, 0.035);
      cup.rotation.x = -0.60 * drink.sip;
      if (drink.lift > 0) {
        // Place the back lip against the animated mouth, leaving room for the paw below.
        tray.worldToLocal(toro.mouth.getWorldPosition(target));
        rim.set(0, 0.24, -0.16).applyQuaternion(cup.quaternion);
        cup.position.lerp(target.sub(rim), drink.lift);
      }
      tray.updateWorldMatrix(true, true);
      liquid.visible = drink.fill > 0.01;
      liquid.scale.setScalar(mix(0.07, 0.158, drink.fill));
      liquid.position.y = mix(0.125, 0.227, drink.fill);
      stream.visible = drink.pour > 0.83;
      if (stream.visible) {
        lip.set(0, 0.73, 0).applyQuaternion(flask.quaternion).add(flask.position);
        rim.copy(cup.position);
        rim.y += liquid.position.y;
        stream.position.copy(lip).lerp(rim, 0.5);
        streamAxis.subVectors(lip, rim);
        stream.scale.y = streamAxis.length();
        stream.quaternion.setFromUnitVectors(up, streamAxis.normalize());
      }
      if (serving) {
        toro.hands.R.solve(flask.localToWorld(target.set(-0.12, 0.36, -0.025)), serving);
        toro.hands.L.solve(cup.localToWorld(target.set(0.08, 0.12, -0.015)), serving);
      }
    }
    if (palms > 0) {
      const chestY = toro.root.position.y + 1.57;
      for (const [side, sign] of [["L", 1], ["R", -1]])
        toro.hands[side].solve(target.set(sign * 0.09, chestY, center.z + 0.54), palms);
    }
    return expression;
  }

  return {
    animate,
    hide() {
      props.parcel.visible = props.tray.visible = false;
      door.setOpen(0);
    },
    frameCamera(camera, width, height) {
      // Pan across the back wall and keep the entrance on the right of the shot.
      const sideMargin = Math.min(5.5, Math.max(6.2, 5.55 * camera.aspect) * 0.65);
      const panX = (stance.x - sideMargin) * pan;
      camera.position.set(panX - 0.3 * pan, mix(3, 2.68, close), mix(12, 8.95, close));
      look.set(panX, mix(2.05 + 2.45 * pan, 2.02, close), mix(1.2, 1.55, close));
      camera.lookAt(look);
      const distance = camera.position.distanceTo(look);
      const halfHeight = Math.max(mix(5.55, 3.45, close), mix(6.2, 2.25, close) / camera.aspect);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / mix(10.7, distance, Math.max(pan, close))));
      camera.setViewOffset(width, height, 0, 0, width, height);
      camera.updateProjectionMatrix();
    },
  };
}
