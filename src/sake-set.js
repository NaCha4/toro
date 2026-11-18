import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

function paint(color, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function piece(parent, name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function printedLabel(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

function pottery(parent, name, profile, glaze) {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y));
  return piece(parent, name, new THREE.LatheGeometry(points, 40), glaze);
}

export function createSakeSet(parent) {
  const parcel = new THREE.Group();
  parcel.name = "Green sake delivery parcel";
  const paper = paint(0xf3eed9);
  const green = paint(0x237659);
  piece(parcel, "Printed carton", new RoundedBoxGeometry(0.96, 0.58, 0.67, 2, 0.025), paper, 0, 0.30);
  const lid = piece(parcel, "Green carton lid", new THREE.BoxGeometry(0.99, 0.105, 0.70), green, 0, 0.60);
  const label = printedLabel(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#f6f2dc";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#226d53";
    ctx.fillRect(0, 2, w, 11);
    ctx.fillRect(0, h - 16, w, 14);
    ctx.font = "bold 65px serif";
    ctx.fillText("清酒", 9, 83);
    ctx.fillStyle = "#a84542";
    ctx.beginPath();
    ctx.arc(201, 61, 23, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#528e99";
    ctx.beginPath();
    ctx.moveTo(143, 94);
    ctx.lineTo(182, 51);
    ctx.lineTo(223, 94);
    ctx.fill();
  });
  for (const side of [-1, 1]) {
    const face = piece(parcel, "Sake shipping label", new THREE.PlaneGeometry(0.93, 0.46), label, 0, 0.30, side * 0.339);
    if (side < 0) face.rotation.y = Math.PI;
  }

  const tray = new THREE.Group();
  tray.name = "Sake serving tray";
  const lacquer = paint(0x984c2b, 0.38);
  piece(tray, "Lacquered tray base", new RoundedBoxGeometry(1.27, 0.065, 0.72, 2, 0.03), lacquer, 0, 0.035);
  for (const z of [-0.34, 0.34])
    piece(tray, "Tray rim", new THREE.BoxGeometry(1.26, 0.055, 0.035), lacquer, 0, 0.080, z);
  for (const x of [-0.62, 0.62])
    piece(tray, "Tray rim", new THREE.BoxGeometry(0.035, 0.055, 0.67), lacquer, x, 0.080);

  const ivory = paint(0xf2e8d7, 0.26);
  const pink = paint(0xb45a7a, 0.30);
  const flask = pottery(tray, "Ceramic sake flask", [
    [0, 0], [0.17, 0], [0.22, 0.06], [0.24, 0.22], [0.20, 0.39],
    [0.12, 0.55], [0.072, 0.66], [0.083, 0.70], [0.102, 0.72],
    [0.096, 0.75], [0.066, 0.75], [0.060, 0.68],
  ], ivory);
  // Five petals painted onto the belly, facing the close-up camera.
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const petal = piece(flask, "Plum blossom", new THREE.SphereGeometry(0.048, 12, 8), pink,
      Math.sin(a) * 0.055, 0.26 + Math.cos(a) * 0.055, 0.228);
    petal.scale.set(0.70, 1, 0.21);
    petal.rotation.z = -a;
  }
  const cup = pottery(tray, "Sake cup", [
    [0, 0], [0.08, 0], [0.085, 0.035], [0.06, 0.055], [0.085, 0.09],
    [0.16, 0.17], [0.185, 0.24], [0.162, 0.24], [0.14, 0.19], [0.065, 0.12], [0, 0.12],
  ], ivory);
  pottery(cup, "Plum glaze around cup", [
    [0.148, 0.155], [0.165, 0.171], [0.188, 0.235],
  ], pink);
  const sake = paint(0xeddbad, 0.18);
  const liquid = piece(cup, "Sake in cup", new THREE.CircleGeometry(1, 32), sake);
  liquid.rotation.x = -Math.PI / 2;
  const stream = piece(tray, "Pouring sake", new THREE.CylinderGeometry(0.012, 0.019, 1, 10), sake);
  parcel.visible = tray.visible = false;
  parent.add(parcel, tray);
  return { parcel, lid, tray, flask, cup, liquid, stream };
}
