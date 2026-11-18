import * as THREE from "three";
import { fridgeLayout, doorGrip } from "./fridge-layout.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

function surface(color, map = null) {
  return new THREE.MeshStandardMaterial({ color, map, roughness: 0.88 });
}

function box(parent, name, size, position, material, radius = 0) {
  const geometry = radius
    ? new RoundedBoxGeometry(...size, 3, radius)
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent,
  name,
  top,
  bottom,
  height,
  position,
  material,
  segments = 32,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Each tile is a rectified prop face, not an entire room view. Geometry
// supplies the depth and occlusion when the camera or refrigerator moves.
function tileMaterial(atlas, index, fallback, repeatX = 1, repeatY = 1) {
  if (!atlas) return surface(fallback);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 138;
  canvas.getContext("2d").drawImage(atlas,
    (index % 4) * 144 + 3, Math.floor(index / 4) * 144 + 3, 138, 138,
    0, 0, 138, 138);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map });
}

function panel(parent, name, w, h, pos, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

function group(parent, name, x, z) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

const halfWidth = 11.1;
const backZ = -4.9;
const frontZ = 11.94;
const ceilingY = 13.0;
const entryZ = -0.57, entryHalfWidth = 4.04, entryHeight = 10.46;

function makeShell(root, wall, timber, ceiling, straw) {
  const depth = frontZ - backZ;
  const midZ = (backZ + frontZ) / 2;
  const sideWall = wall.clone();
  sideWall.color.multiplyScalar(0.30);
  box(root, "Back plaster wall", [2 * halfWidth, ceilingY, 0.16], [0, ceilingY / 2, backZ - 0.08], wall);
  box(root, "Dark wooden ceiling", [2 * halfWidth, 0.14, depth], [0, ceilingY + 0.07, midZ], ceiling);
  for (const side of [-1, 1]) {
    const x = side * halfWidth;
    const spans = side < 0 ? [[backZ, frontZ]] :
      [[backZ, entryZ - entryHalfWidth], [entryZ + entryHalfWidth, frontZ]];
    for (const [from, to] of spans) {
      box(root, "Side plaster wall", [0.16, ceilingY, to - from], [x + side * 0.08, ceilingY / 2, (from + to) / 2], sideWall);
      box(root, "Side wall rail", [0.12, 0.27, to - from], [x - side * 0.06, 0.13, (from + to) / 2], timber);
    }
    if (side > 0) box(root, "Plaster above entrance", [0.16, ceilingY - entryHeight, 2 * entryHalfWidth],
      [x + 0.08, (ceilingY + entryHeight) / 2, entryZ], sideWall);
    box(root, "Back corner post", [0.42, ceilingY, 0.36], [x - side * 0.19, ceilingY / 2, backZ + 0.15], timber);
    box(root, "Side wall rail", [0.12, 0.27, depth], [x - side * 0.06, 10.69, midZ], timber);
  }
  for (const y of [0.13, 10.69])
    box(root, "Back wall rail", [2 * halfWidth, 0.27, 0.14], [0, y, backZ + 0.06], timber);

  box(root, "Woven tatami floor", [2 * halfWidth, 0.12, depth], [0, -0.06, midZ], straw);
  const shadows = new THREE.Mesh(new THREE.PlaneGeometry(2 * halfWidth, depth),
    new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }));
  shadows.rotation.x = -Math.PI / 2;
  shadows.position.set(0, 0.003, midZ);
  shadows.receiveShadow = true;
  root.add(shadows);
  const edging = surface(0x342724);
  // The two long borders frame the central mat in the front view.
  const middleZ = -1.85;
  const crossZ = 0.40;
  for (const x of [-5.35, 5.35])
    box(root, "Tatami cloth edge", [0.17, 0.012, crossZ - backZ], [x, 0.006, (crossZ + backZ) / 2], edging);
  box(root, "Central mat seam", [10.7, 0.012, 0.14], [0, 0.007, middleZ], edging);
  box(root, "Tatami cross seam", [2 * halfWidth, 0.012, 0.14], [0, 0.007, crossZ], edging);
  box(root, "Front tatami seam", [0.1, 0.012, frontZ - crossZ], [0, 0.006, (frontZ + crossZ) / 2], edging);
}

function makeSideWalls(root, materials) {
  const window = group(root, "Left wooden window", -halfWidth + 0.1, 0.65);
  window.rotation.y = Math.PI / 2;
  panel(window, "Windowpanes and landscape", 6.65, 5.25, [0, 6.68, 0.07], materials.window);
  for (const x of [-3.42, 0, 3.42])
    box(window, "Window stile", [0.19, 5.66, 0.21], [x, 6.68, 0.13], materials.wood);
  for (const y of [3.94, 9.42])
    box(window, "Window frame", [7.03, 0.21, 0.24], [0, y, 0.13], materials.wood);

  const doors = group(root, "Right sliding entrance", halfWidth - 0.09, entryZ);
  doors.rotation.y = -Math.PI / 2;
  const frame = surface(0x3c271f), paper = surface(0x99978d);
  let moving, handle;
  for (const side of [-1, 1]) {
    const leaf = group(doors, side > 0 ? "Moving entrance door" : "Fixed entrance door", side * 2, side < 0 ? 0.08 : 0.27);
    box(leaf, "Sliding door panel", [3.98, 10.25, 0.12], [0, 5.17, 0], paper);
    box(leaf, "Door lower wood band", [3.98, 0.55, 0.045], [0, 2.44, 0.08], materials.wood);
    const pull = box(leaf, "Recessed sliding pull", [0.26, 0.68, 0.04], [side * 1.17, 2.47, 0.1], frame);
    box(leaf, "Door meeting stile", [0.09, 10.25, 0.16], [-side * 1.94, 5.17, 0], frame);
    if (side > 0) { moving = leaf; handle = pull; }
  }
  for (const x of [-4.04, 4.04])
    box(doors, "Cupboard jamb", [0.2, 10.61, 0.35], [x, 5.3, 0.17], materials.wood);
  for (const y of [0.10, 10.46])
    box(doors, "Sliding track", [8.28, 0.21, 0.38], [0, y, 0.17], frame);
  box(doors, "Wall switch", [0.38, 0.66, 0.08], [4.84, 3.05, 0.11], surface(0xb2a37a));
  box(doors, "Switch toggle", [0.1, 0.22, 0.07], [4.84, 3.06, 0.18], frame);
  box(doors, "Hallway floorboards", [14, 0.16, 6.4], [0, -0.08, -3.10], materials.wood);
  box(doors, "Hallway plaster", [14, 11, 0.14], [0, 5.5, -6.23], surface(0xbcb18d));
  box(doors, "Hallway skirting", [14, 1.5, 0.18], [0, 0.75, -6.19], materials.wood);
  for (const x of [-5, 0, 5])
    box(doors, "Hallway post", [0.14, 11, 0.16], [x, 5.5, -6.13], materials.wood);
  return {
    stance: doors.localToWorld(new THREE.Vector3(1.95, 0, 1.12)),
    outside: doors.localToWorld(new THREE.Vector3(4.8, 0, -3.2)),
    setOpen(amount) { moving.position.x = 2 - 4 * amount; },
    getPullPosition(target) { return handle.getWorldPosition(target); },
  };
}

function makeBackFurniture(root, m) {
  const olive = surface(0x796d29), drawer = surface(0x949044), dark = surface(0x33251e);
  const cabinet = group(root, "Olive drawer cabinet", -9.05, -3.93);
  box(cabinet, "Cabinet carcass", [3.25, 4.62, 1.64], [0, 2.31, 0], olive);
  for (let row = 0; row < 3; row++) {
    const y = 0.8 + row * 1.5;
    box(cabinet, "Olive drawer", [3.04, 1.38, 0.09], [0, y, 0.84], drawer);
    box(cabinet, "Drawer knob", [0.29, 0.24, 0.19], [0, y + 0.33, 0.96], olive, 0.045);
  }
  function speaker(parent, x, y, z) {
    box(parent, "Cloth-covered loudspeaker", [1.86, 2.58, 1.50], [x, y + 1.29, z], dark);
    panel(parent, "Speaker grille", 1.86, 2.58, [x, y + 1.29, z + 0.754], m.speaker);
  }
  speaker(cabinet, -0.48, 4.62, -0.08);
  const chest = group(root, "Dark lacquer chest", -4.62, -3.88);
  box(chest, "Chest case", [5.48, 4.46, 1.65], [0, 2.23, 0], surface(0x341e19));
  panel(chest, "Chest doors and lower drawer", 5.48, 4.46, [0, 2.23, 0.831], m.chest);
  const stereo = group(root, "Silver component stereo", -0.49, -3.89);
  box(stereo, "Stereo chassis", [2.8, 3.27, 1.59], [0, 1.635, 0], surface(0x888b83));
  panel(stereo, "Stacked hi-fi components", 2.8, 3.27, [0, 1.635, 0.80], m.stereo);
  speaker(root, 1.86, 0, -3.86);
  const bag = group(root, "Red school satchel", 4.11, -3.52);
  const leather = surface(0x87253c);
  box(bag, "Leather satchel body", [2.42, 1.43, 0.90], [0, 0.74, 0], leather, 0.12);
  panel(bag, "Flap, buckles and straps", 2.36, 1.37, [0, 0.75, 0.455], m.bag);
  for (const x of [-0.34, 0.34]) box(bag, "Handle end", [0.11, 0.22, 0.14], [x, 1.52, 0], leather);
  box(bag, "Satchel handle", [0.76, 0.1, 0.14], [0, 1.65, 0], leather, 0.035);
}

function makeTelevision(root, wood) {
  const tv = group(root, "Wooden leg television", -7.1, 2.22);
  tv.rotation.y = -0.62;
  const shell = surface(0x53371e), dark = surface(0x1d1915);
  box(tv, "Television housing", [2.48, 1.91, 1.60], [0, 2.6, 0], shell, 0.045);
  box(tv, "CRT screen", [1.77, 1.22, 0.085], [-0.14, 2.66, 0.81], surface(0x141a19), 0.095);
  for (const x of [-0.90, 0.90]) for (const z of [-0.55, 0.55]) {
    const leg = cylinder(tv, "Splayed television leg", 0.12, 0.065, 1.77, [x * 1.12, 0.84, z * 1.14], wood, 8);
    leg.rotation.z = x * 0.13;
    leg.rotation.x = -z * 0.22;
  }
  const consoleSet = group(root, "Console and controller", -6.65, 1.28);
  box(consoleSet, "Low black console", [1.40, 0.23, 0.94], [0, 0.13, 0], dark, 0.045);
  box(consoleSet, "Console cartridge cover", [0.83, 0.09, 0.60], [-0.06, 0.28, 0], dark, 0.04);
  const wire = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.47, 0.13, -0.40), new THREE.Vector3(0.86, 0.04, -0.79),
    new THREE.Vector3(1.16, 0.04, -0.86), new THREE.Vector3(1.39, 0.06, -0.99),
  ]);
  consoleSet.add(new THREE.Mesh(new THREE.TubeGeometry(wire, 20, 0.025, 5, false), dark));
  box(consoleSet, "Wired controller", [0.55, 0.12, 0.29], [1.6, 0.085, -0.99], dark, 0.045);
}

function makeWallArt(root, m) {
  const z = backZ + 0.15;
  panel(root, "Small framed animal print", 3.57, 2.02, [-7.75, 8.76, z], m.print);
  panel(root, "Blue Hand poster", 3.35, 4.28, [5.53, 8.05, z], m.poster);
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 4.32, 0.90, 0, 0, 1.82, 0], 3));
  pennant.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0.48, 0, 1], 2));
  const flag = new THREE.Mesh(pennant, m.pennant);
  flag.name = "Triangular souvenir pennant";
  flag.position.set(-10.73, 10.98, z);
  root.add(flag);
}

function makeBasket(root) {
  const g = group(root, "Woven basket by the sliding door", 10.03, 4.59);
  const wicker = surface(0xb59361), weave = surface(0x755935);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.73, 0.75, 20, 1, true), weave);
  body.position.y = 0.40;
  g.add(body);
  cylinder(g, "Basket interior", 0.74, 0.73, 0.05, [0, 0.10, 0], surface(0x4b3726), 20);
  for (let n = 0; n < 20; n++) {
    const angle = n * Math.PI / 10;
    const stave = box(g, "Wicker upright", [0.085, 0.70, 0.055],
      [0.77 * Math.sin(angle), 0.42, 0.77 * Math.cos(angle)], wicker);
    stave.rotation.y = angle;
  }
  for (const y of [0.13, 0.32, 0.52, 0.74]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.735 + y * 0.085, 0.052, 5, 24), wicker);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    g.add(hoop);
  }
}

function makeFridge(parent, front) {
  const { x, frontZ, width, depth, height, shelfY, swing } = fridgeLayout;
  const fridge = group(parent, "Refrigerator", x, frontZ);
  const enamel = surface(0xbec2b6), liner = surface(0xe2e2d2);
  const cabinetSide = surface(0x737870);
  for (const side of [-1, 1])
    box(fridge, "Refrigerator side", [0.11, height, depth], [side * (width - 0.11) / 2, height / 2, -depth / 2],
      [side > 0 ? cabinetSide : liner, side < 0 ? cabinetSide : liner, enamel, enamel, enamel, enamel]);
  for (const y of [0.07, height - 0.07])
    box(fridge, "Refrigerator end panel", [width - 0.18, 0.14, depth], [0, y, -depth / 2], enamel);
  box(fridge, "Refrigerator back", [width - 0.18, height - 0.24, 0.10], [0, height / 2, -depth + 0.05], liner);
  for (const y of [shelfY, 3.10, 4.12])
    box(fridge, "Interior shelf", [width - 0.22, 0.06, depth - 0.21], [0, y - 0.03, -depth / 2], liner, 0.02);

  const door = group(fridge, "Hinged refrigerator door", width / 2, 0);
  box(door, "Fridge door", [width, height, 0.13], [-width / 2, height / 2, 0], enamel, 0.035);
  panel(door, "Refrigerator enamel face", width - 0.04, height - 0.04, [-width / 2, height / 2, 0.068], front);
  box(door, "Raised vertical pull", [0.24, 1.32, 0.14], [doorGrip.x + 0.14, 4.08, 0.14], surface(0xd5d7c9), 0.065);
  const grip = box(door, "Lower door edge grip", [0.09, 0.32, 0.09], doorGrip.toArray(), enamel, 0.03);
  const light = new THREE.PointLight(0xfff1d9, 0, 3.4, 2);
  light.position.set(0, 2.65, -0.48);
  fridge.add(light);
  return {
    root: fridge,
    giftPosition: new THREE.Vector3(x - 0.1, shelfY + 0.32, frontZ - 0.57),
    setOpen(amount) {
      door.rotation.y = amount * swing;
      light.intensity = amount * 3;
      door.updateWorldMatrix(true, true);
    },
    getHandlePosition(target) { return grip.getWorldPosition(target); },
  };
}

export function createRoom(atlas) {
  const root = new THREE.Group();
  root.name = "Toro's tatami room";
  const m = {
    chest: tileMaterial(atlas, 0, 0x44241b), stereo: tileMaterial(atlas, 1, 0x9c9d93),
    speaker: tileMaterial(atlas, 2, 0x38332d), bag: tileMaterial(atlas, 3, 0x982e49),
    poster: tileMaterial(atlas, 4, 0x234566), print: tileMaterial(atlas, 5, 0xb9a677),
    pennant: tileMaterial(atlas, 6, 0x9b6431), enamel: tileMaterial(atlas, 7, 0xbec2b6),
    window: tileMaterial(atlas, 11, 0x88a9ae), wood: surface(0x795033),
  };
  const wall = tileMaterial(atlas, 8, 0xb6aa8b, 12, 5);
  const straw = tileMaterial(atlas, 9, 0xaa9972, 12, 12);
  makeShell(root, wall, m.wood, tileMaterial(atlas, 10, 0x51362a, 8, 6), straw);
  const entrance = makeSideWalls(root, m);
  makeBackFurniture(root, m);
  makeTelevision(root, m.wood);
  makeWallArt(root, m);
  makeBasket(root);
  const fridge = makeFridge(root, m.enamel);
  return { root, fridge, entrance };
}
