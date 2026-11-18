import * as THREE from "three";
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

function disc(parent, name, radius, depth, position, material) {
  const mesh = cylinder(
    parent,
    name,
    radius,
    radius,
    depth,
    position,
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function texture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

function panel(parent, name, width, height, position, map) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    surface(0xffffff, map),
  );
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function woodTexture() {
  return texture(256, 512, (ctx, width, height) => {
    ctx.fillStyle = "#866247";
    ctx.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x += 1) {
      ctx.strokeStyle = `rgba(39,24,13,${0.03 + (x % 17) * 0.008})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 9 * Math.sin(x), 140, x - 7, 340, x, height);
      ctx.stroke();
    }
    ctx.strokeStyle = "#d0a67e30";
    for (let y = 0; y < height; y += 37) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 4);
      ctx.stroke();
    }
  });
}

function plasterTexture() {
  return texture(256, 256, (ctx, width, height) => {
    const pixels = ctx.createImageData(width, height);
    let seed = 1763;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 4294967296) * 7 - 3.5;
      pixels.data[i] = 221 + grain;
      pixels.data[i + 1] = 212 + grain;
      pixels.data[i + 2] = 186 + grain;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
}

function tatamiTexture() {
  return texture(512, 1024, (ctx, width, height) => {
    ctx.fillStyle = "#c3bd87";
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 3) {
      ctx.fillStyle = y % 12 === 0 ? "#a8a574" : "#b2af7e";
      ctx.fillRect(0, y, width, 1.2);
      ctx.fillStyle = "#d3cc96";
      ctx.fillRect(0, y + 1, width, 1);
    }
    for (let x = 0; x < width; x += 12) {
      ctx.fillStyle = "#d4cf9926";
      ctx.fillRect(x, 0, 1, height);
    }
  });
}

function makeWindow(parent, wood) {
  const window = new THREE.Group();
  window.position.set(-6.1, 4.15, -0.25);
  window.rotation.y = Math.PI / 2;
  parent.add(window);
  box(window, "Window recess", [3.9, 3.15, 0.12], [0, 0, 0], surface(0x6b6750));
  const scenery = texture(320, 256, (ctx, width, height) => {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#9cbcc4");
    sky.addColorStop(0.65, "#dce0bd");
    sky.addColorStop(1, "#7e9770");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#789276";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, 190);
    ctx.bezierCurveTo(70, 120, 110, 190, 170, 160);
    ctx.bezierCurveTo(230, 120, 260, 150, width, 115);
    ctx.lineTo(width, height);
    ctx.fill();
    ctx.fillStyle = "#ffffef9c";
    ctx.fillRect(25, 25, 60, 14);
    ctx.fillRect(165, 51, 77, 10);
  });
  panel(window, "Daylight outside", 3.65, 2.9, [0, 0, 0.08], scenery);
  for (const x of [-1.95, 0, 1.95])
    box(window, "Wooden window frame", [0.105, 3.2, 0.16], [x, 0, 0.17], wood);
  for (const y of [-1.6, 0, 1.6])
    box(window, "Wooden window frame", [4, 0.105, 0.16], [0, y, 0.17], wood);
  box(window, "Window sill", [4.2, 0.17, 0.45], [0, -1.67, 0.2], wood);
  for (const side of [-1, 1]) {
    const curtain = new THREE.Group();
    curtain.position.set(side * 1.68, 0, 0.32);
    window.add(curtain);
    const cloth = surface(0xc9bc7f);
    for (let i = 0; i < 5; i += 1) {
      box(
        curtain,
        "Folded curtain",
        [0.13, 3.25, 0.12],
        [(i - 2) * 0.12, 0, Math.sin(i * 2) * 0.07],
        cloth,
        0.035,
      );
    }
  }
}

function makeChest(parent, wood, darkWood) {
  const chest = new THREE.Group();
  chest.position.set(-4.25, 0, -3.75);
  parent.add(chest);
  box(
    chest,
    "Wooden chest of drawers",
    [2.9, 2.5, 1.3],
    [0, 1.3, 0],
    darkWood,
    0.04,
  );
  box(chest, "Chest top", [3.02, 0.13, 1.4], [0, 2.58, 0], wood, 0.025);
  for (let row = 0; row < 4; row += 1) {
    const y = 0.37 + row * 0.56;
    box(chest, "Drawer front", [2.68, 0.5, 0.11], [0, y, 0.68], wood, 0.015);
    for (const x of [-0.77, 0.77]) {
      box(
        chest,
        "Brass drawer handle",
        [0.33, 0.055, 0.08],
        [x, y + 0.04, 0.78],
        surface(0xc6a86c),
        0.02,
      );
    }
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.17, 10, 48),
    surface(0xd7e4e9),
  );
  ring.position.set(-0.1, 3.53, 0.08);
  chest.add(ring);
  for (let i = 0; i < 4; i += 1) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.724, 0.175, 10, 10, Math.PI / 4),
      surface(0x638db4),
    );
    arc.position.copy(ring.position);
    arc.rotation.z = (i * Math.PI) / 2;
    chest.add(arc);
  }
}

function makeStereo(parent, wood) {
  const stereo = new THREE.Group();
  stereo.position.set(-0.65, 0, -3.9);
  parent.add(stereo);
  const black = surface(0x30332f);
  const panelGrey = surface(0x474a45);
  for (let row = 0; row < 4; row += 1) {
    const y = 0.3 + row * 0.47;
    box(
      stereo,
      "Stereo component",
      [1.75, 0.44, 0.88],
      [0, y, 0],
      black,
      0.025,
    );
    box(
      stereo,
      "Stereo front panel",
      [1.62, 0.34, 0.04],
      [0, y, 0.46],
      panelGrey,
    );
    box(
      stereo,
      "Stereo display",
      [0.52, 0.105, 0.015],
      [-0.1, y + 0.025, 0.49],
      surface(0x81937d),
    );
    for (const x of [-0.63, 0.62])
      disc(
        stereo,
        "Stereo control knob",
        0.065,
        0.04,
        [x, y, 0.5],
        surface(0x96988a),
      );
    box(
      stereo,
      "Stereo cassette slot",
      [0.38, 0.028, 0.02],
      [0.34, y - 0.08, 0.495],
      black,
    );
  }
  for (const side of [-1, 1]) {
    const x = side * 1.5;
    box(stereo, "Wooden speaker", [1.1, 2.08, 1], [x, 1.07, 0], wood, 0.025);
    box(
      stereo,
      "Speaker front",
      [0.99, 1.94, 0.03],
      [x, 1.07, 0.515],
      surface(0x5f5038),
    );
    disc(
      stereo,
      "Woofer surround",
      0.41,
      0.03,
      [x, 0.81, 0.55],
      surface(0x202824),
    );
    const cone = disc(
      stereo,
      "Speaker cone",
      0.34,
      0.04,
      [x, 0.81, 0.57],
      surface(0x535951),
    );
    cone.scale.z = 0.6;
    disc(stereo, "Speaker dust cap", 0.105, 0.07, [x, 0.81, 0.61], black);
    disc(
      stereo,
      "Tweeter trim",
      0.18,
      0.04,
      [x, 1.62, 0.55],
      surface(0xbfc0a9),
    );
    disc(stereo, "Tweeter", 0.115, 0.05, [x, 1.62, 0.59], black);
  }
  const basket = surface(0x74915d);
  box(stereo, "Green cassette basket", [0.76, 0.35, 0.5], [0, 2.19, 0], basket);
  for (const x of [-0.3, 0.3])
    box(stereo, "Basket handle", [0.05, 0.26, 0.05], [x, 2.48, 0], basket);
  box(stereo, "Basket handle top", [0.65, 0.045, 0.05], [0, 2.6, 0], basket);
}

function makeBookshelf(parent, wood, darkWood) {
  const shelf = new THREE.Group();
  shelf.position.set(-5.72, 0, -0.55);
  shelf.rotation.y = Math.PI / 2;
  parent.add(shelf);
  box(shelf, "Bookcase back", [2.5, 3.2, 0.09], [0, 1.65, -0.3], darkWood);
  for (const x of [-1.25, 1.25])
    box(shelf, "Bookcase side", [0.12, 3.35, 0.75], [x, 1.67, 0], wood);
  for (let i = 0; i < 4; i += 1)
    box(
      shelf,
      "Bookshelf board",
      [2.6, 0.1, 0.8],
      [0, 0.1 + i * 1.06, 0],
      wood,
    );
  const colors = [
    0x8b5146, 0x668078, 0xd1c49a, 0x555b62, 0xc39a60, 0x89977c, 0xc5c8b9,
  ];
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 11; i += 1) {
      const x = -1.09 + i * 0.198;
      const height = 0.66 + ((i * 7 + row * 3) % 5) * 0.055;
      const book = box(
        shelf,
        "Book",
        [0.15, height, 0.46],
        [x, 0.18 + row * 1.06 + height / 2, 0.06],
        surface(colors[(i + row * 2) % colors.length]),
      );
      if (i === 9) book.rotation.z = 0.09;
      box(
        shelf,
        "Book spine label",
        [0.08, 0.2, 0.012],
        [x, 0.51 + row * 1.06, 0.302],
        surface(0xe8e0c9),
      );
    }
  }
  disc(
    shelf,
    "Alarm clock case",
    0.28,
    0.13,
    [0.5, 3.55, 0],
    surface(0x984b43),
  );
  disc(
    shelf,
    "Alarm clock face",
    0.235,
    0.015,
    [0.5, 3.55, 0.08],
    surface(0xf3ead1),
  );
  const hour = box(
    shelf,
    "Clock hour hand",
    [0.027, 0.15, 0.02],
    [0.46, 3.59, 0.1],
    darkWood,
  );
  hour.rotation.z = 0.8;
  const minute = box(
    shelf,
    "Clock minute hand",
    [0.02, 0.21, 0.02],
    [0.56, 3.61, 0.105],
    darkWood,
  );
  minute.rotation.z = -0.8;
}

function makeFan(parent) {
  const fan = new THREE.Group();
  fan.position.set(-3.1, 0, -0.65);
  fan.rotation.y = 0.17;
  parent.add(fan);
  const enamel = surface(0xb7c6bc);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x9eaaa1,
    metalness: 0.55,
    roughness: 0.5,
  });
  box(fan, "Fan base", [0.91, 0.16, 0.72], [0, 0.1, 0.06], enamel, 0.07);
  cylinder(fan, "Fan stand", 0.065, 0.075, 1.25, [0, 0.77, 0], enamel);
  disc(fan, "Fan motor", 0.19, 0.36, [0, 1.64, -0.08], enamel);
  const blades = new THREE.Group();
  blades.position.set(0, 1.64, 0.18);
  fan.add(blades);
  for (let i = 0; i < 3; i += 1) {
    const blade = box(
      blades,
      "Fan blade",
      [0.24, 0.54, 0.04],
      [
        Math.sin((i * Math.PI * 2) / 3) * 0.24,
        Math.cos((i * Math.PI * 2) / 3) * 0.24,
        0,
      ],
      surface(0x839494),
      0.09,
    );
    blade.rotation.z = (-i * Math.PI * 2) / 3 - 0.3;
  }
  for (const radius of [0.2, 0.39, 0.58, 0.68]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012, 4, 48),
      metal,
    );
    ring.position.set(0, 1.64, 0.25);
    fan.add(ring);
  }
  for (let i = 0; i < 12; i += 1) {
    const spoke = box(
      fan,
      "Fan grille spoke",
      [0.012, 1.33, 0.012],
      [0, 1.64, 0.26],
      metal,
    );
    spoke.rotation.z = (i * Math.PI) / 12;
  }
  disc(fan, "Fan central cap", 0.105, 0.065, [0, 1.64, 0.29], enamel);
  return blades;
}

function makeTelevision(parent, wood) {
  const tv = new THREE.Group();
  tv.position.set(-3.9, 0, 2.7);
  tv.rotation.y = 0.3;
  parent.add(tv);
  for (const x of [-0.83, 0.83]) {
    for (const z of [-0.35, 0.35])
      box(tv, "TV stand leg", [0.12, 0.63, 0.12], [x, 0.32, z], wood);
  }
  box(tv, "Low TV stand", [2.15, 0.23, 1.08], [0, 0.73, 0], wood, 0.04);
  box(
    tv,
    "CRT television cabinet",
    [1.93, 1.46, 1.12],
    [0, 1.57, 0],
    surface(0x514d3d),
    0.12,
  );
  box(
    tv,
    "CRT bezel",
    [1.66, 1.18, 0.13],
    [-0.07, 1.59, 0.59],
    surface(0x242e2a),
    0.1,
  );
  const screen = texture(256, 192, (ctx, width, height) => {
    const glow = ctx.createRadialGradient(125, 70, 5, 125, 90, 180);
    glow.addColorStop(0, "#779a9a");
    glow.addColorStop(1, "#263e40");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#c0d5cb16";
    for (let y = 0; y < height; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#dbe5d82b";
    ctx.beginPath();
    ctx.moveTo(20, 12);
    ctx.lineTo(160, 12);
    ctx.lineTo(50, 75);
    ctx.lineTo(20, 75);
    ctx.fill();
  });
  box(
    tv,
    "Rounded CRT screen",
    [1.35, 0.95, 0.065],
    [-0.17, 1.62, 0.685],
    surface(0xffffff, screen),
    0.09,
  );
  for (const y of [1.34, 1.76])
    disc(
      tv,
      "Television tuning knob",
      0.073,
      0.05,
      [0.72, y, 0.69],
      surface(0xb0a690),
    );
  for (const side of [-1, 1]) {
    const antenna = cylinder(
      tv,
      "TV antenna",
      0.013,
      0.013,
      1.0,
      [side * 0.23, 2.66, -0.18],
      surface(0x8f9488),
      8,
    );
    antenna.rotation.z = side * 0.48;
  }
}

function makeFridge(parent) {
  const fridge = new THREE.Group();
  fridge.position.set(4.82, 0, -3.67);
  parent.add(fridge);
  const enamel = surface(0xe5e4cf);
  box(
    fridge,
    "Small refrigerator",
    [1.7, 3.38, 1.5],
    [0, 1.75, 0],
    enamel,
    0.075,
  );
  box(
    fridge,
    "Freezer door",
    [1.59, 0.88, 0.095],
    [0, 2.9, 0.79],
    surface(0xf0edda),
    0.035,
  );
  box(
    fridge,
    "Fridge door",
    [1.59, 2.14, 0.095],
    [0, 1.33, 0.79],
    enamel,
    0.04,
  );
  for (const y of [2.67, 2.0])
    box(
      fridge,
      "Refrigerator handle",
      [0.34, 0.055, 0.07],
      [-0.44, y, 0.9],
      surface(0xb7b9a6),
      0.02,
    );
  const note = texture(96, 128, (ctx, width, height) => {
    ctx.fillStyle = "#e8d5a0";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#8f5949";
    ctx.font = "22px serif";
    ctx.fillText("お", 35, 37);
    ctx.fillText("や", 35, 64);
    ctx.fillText("つ", 35, 91);
  });
  const sticker = panel(
    fridge,
    "Paper note",
    0.33,
    0.43,
    [-0.39, 1.24, 0.853],
    note,
  );
  sticker.rotation.z = -0.08;
  cylinder(
    fridge,
    "Tea tin on fridge",
    0.17,
    0.17,
    0.4,
    [0.3, 3.64, 0.14],
    surface(0x67745a),
  );
}

function makeWallDecor(parent, wood) {
  const ice = texture(160, 240, (ctx, width, height) => {
    ctx.fillStyle = "#f0ebda";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#a25141";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);
    ctx.fillStyle = "#b74234";
    ctx.font = "bold 124px serif";
    ctx.textAlign = "center";
    ctx.fillText("氷", 80, 150);
    ctx.fillStyle = "#55798b";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(14, 178 + i * 9, 132, 3);
    }
  });
  panel(parent, "Shaved ice poster", 1.0, 1.5, [-3.25, 5.45, -4.58], ice);
  const calendar = texture(192, 256, (ctx, width, height) => {
    ctx.fillStyle = "#f2edde";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#a2b4a0";
    ctx.fillRect(10, 10, 172, 89);
    ctx.fillStyle = "#58755a";
    ctx.beginPath();
    ctx.moveTo(10, 99);
    ctx.lineTo(75, 25);
    ctx.lineTo(150, 99);
    ctx.fill();
    ctx.fillStyle = "#444c3f";
    ctx.font = "bold 24px serif";
    ctx.textAlign = "center";
    ctx.fillText("8", 96, 126);
    ctx.font = "13px sans-serif";
    for (let n = 1; n <= 31; n += 1) {
      ctx.fillStyle = n % 7 === 1 ? "#a95041" : "#55594c";
      ctx.fillText(
        String(n),
        20 + ((n - 1) % 7) * 25,
        152 + Math.floor((n - 1) / 7) * 21,
      );
    }
  });
  panel(parent, "Wall calendar", 0.95, 1.27, [2.5, 5.5, -4.58], calendar);
  const scroll = texture(160, 400, (ctx, width, height) => {
    ctx.fillStyle = "#a7ac92";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#eae3cc";
    ctx.fillRect(13, 53, 134, 286);
    ctx.fillStyle = "#454b3e";
    ctx.font = "31px serif";
    ctx.textAlign = "center";
    Array.from("どこでも").forEach((letter, i) =>
      ctx.fillText(letter, 107, 97 + i * 47),
    );
    Array.from("いっしょ").forEach((letter, i) =>
      ctx.fillText(letter, 53, 139 + i * 47),
    );
    ctx.fillStyle = "#ad6c53";
    ctx.fillRect(47, 303, 17, 17);
  });
  panel(parent, "Hanging scroll", 1.33, 3.35, [0.65, 5.4, -4.57], scroll);
  for (const y of [3.71, 7.09])
    cylinder(
      parent,
      "Scroll rod",
      0.045,
      0.045,
      1.5,
      [0.65, y, -4.53],
      wood,
      12,
    ).rotation.z = Math.PI / 2;
  const pennantMap = texture(384, 160, (ctx, width, height) => {
    ctx.fillStyle = "#d1ae5b";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 80);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a04c3b";
    ctx.beginPath();
    ctx.moveTo(9, 10);
    ctx.lineTo(width - 25, 80);
    ctx.lineTo(9, height - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#91b6bc";
    ctx.fillRect(12, 13, 137, 133);
    ctx.fillStyle = "#d8e5db";
    ctx.beginPath();
    ctx.moveTo(15, 112);
    ctx.lineTo(78, 27);
    ctx.lineTo(147, 112);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f1ecd8";
    ctx.beginPath();
    ctx.moveTo(78, 27);
    ctx.lineTo(52, 63);
    ctx.lineTo(74, 55);
    ctx.lineTo(85, 64);
    ctx.lineTo(96, 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8dcb5";
    ctx.font = "bold 35px serif";
    ctx.fillText("富士山", 164, 92);
  });
  const pennant = panel(
    parent,
    "Mount Fuji pennant",
    2.45,
    1.02,
    [4.25, 5.86, -4.57],
    pennantMap,
  );
  pennant.material.transparent = true;
  pennant.material.alphaTest = 0.4;
}

function makeTelephone(parent) {
  const phone = new THREE.Group();
  phone.position.set(2.65, 0, -3.96);
  phone.rotation.y = -0.12;
  parent.add(phone);
  const black = surface(0x292c26);
  box(
    phone,
    "Rotary telephone base",
    [0.89, 0.24, 0.7],
    [0, 0.19, 0],
    black,
    0.1,
  );
  cylinder(
    phone,
    "Telephone rotary dial",
    0.24,
    0.24,
    0.035,
    [0, 0.327, 0.07],
    surface(0xc1bda2),
  );
  for (let i = 0; i < 10; i += 1) {
    cylinder(
      phone,
      "Dial finger hole",
      0.03,
      0.03,
      0.007,
      [
        Math.sin((i * Math.PI) / 5) * 0.16,
        0.35,
        0.07 + Math.cos((i * Math.PI) / 5) * 0.16,
      ],
      black,
      12,
    );
  }
  box(
    phone,
    "Telephone handset",
    [1.01, 0.13, 0.15],
    [0, 0.51, -0.16],
    black,
    0.06,
  );
  for (const side of [-1, 1])
    box(
      phone,
      "Handset receiver",
      [0.2, 0.23, 0.22],
      [side * 0.4, 0.43, -0.16],
      black,
      0.05,
    );
  const cordPoints = [];
  for (let i = 0; i < 96; i += 1) {
    const t = i / 95;
    cordPoints.push(
      new THREE.Vector3(
        0.5 + t * 0.35 + Math.sin(t * 70) * 0.02,
        0.03 + (1 - t) * 0.25,
        0.06 + Math.cos(t * 70) * 0.02,
      ),
    );
  }
  phone.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(cordPoints),
        96,
        0.009,
        4,
        false,
      ),
      black,
    ),
  );
}

function makeLowTable(parent, wood) {
  const table = new THREE.Group();
  table.position.set(3.25, 0, 1.5);
  table.rotation.y = -0.1;
  parent.add(table);
  box(
    table,
    "Low wooden tea table",
    [2.2, 0.14, 1.55],
    [0, 0.92, 0],
    wood,
    0.13,
  );
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.52, 0.52])
      box(table, "Low table leg", [0.16, 0.84, 0.16], [x, 0.45, z], wood, 0.02);
  }
  const ceramic = surface(0xa8b395);
  cylinder(table, "Tea cup", 0.135, 0.095, 0.25, [-0.53, 1.13, 0.14], ceramic);
  cylinder(
    table,
    "Tea surface",
    0.115,
    0.115,
    0.01,
    [-0.53, 1.257, 0.14],
    surface(0x665f33),
  );
  cylinder(
    table,
    "Tea cup saucer",
    0.21,
    0.21,
    0.035,
    [-0.53, 1.012, 0.14],
    surface(0x7c8969),
  );
  box(
    table,
    "Tissue box",
    [0.62, 0.25, 0.37],
    [0.46, 1.11, -0.22],
    surface(0xa6b7a8),
    0.025,
  );
  box(
    table,
    "Tissue box slot",
    [0.34, 0.008, 0.03],
    [0.46, 1.24, -0.22],
    surface(0x637d72),
  );
  const tissue = box(
    table,
    "Folded white tissue",
    [0.25, 0.23, 0.018],
    [0.45, 1.33, -0.22],
    surface(0xf5f1df),
  );
  tissue.rotation.z = 0.2;
}

function makeCeilingLamp(parent) {
  const lamp = new THREE.Group();
  lamp.position.set(0, 0, 0.1);
  parent.add(lamp);
  const cord = surface(0x555449);
  cylinder(
    lamp,
    "Ceiling light cord",
    0.018,
    0.018,
    1.04,
    [0, 6.69, 0],
    cord,
    8,
  );
  cylinder(
    lamp,
    "Ceiling rose",
    0.11,
    0.13,
    0.06,
    [0, 7.2, 0],
    surface(0xd7d3bb),
  );
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.73, 0.38, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x557364,
      roughness: 0.75,
      side: THREE.DoubleSide,
    }),
  );
  shade.name = "Green pendant lamp shade";
  shade.position.set(0, 6.08, 0);
  shade.castShadow = true;
  lamp.add(shade);
  const diffuser = new THREE.Mesh(
    new THREE.CircleGeometry(0.68, 48),
    new THREE.MeshStandardMaterial({
      color: 0xfff0ca,
      emissive: 0xffe7b4,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
    }),
  );
  diffuser.name = "Warm ceiling light diffuser";
  diffuser.rotation.x = -Math.PI / 2;
  diffuser.position.set(0, 5.885, 0);
  lamp.add(diffuser);
}

export function createRoom() {
  const root = new THREE.Group();
  root.name = "Toro's tatami room";
  const wood = surface(0xffffff, woodTexture());
  wood.bumpMap = wood.map;
  wood.bumpScale = 0.025;
  const darkWood = surface(0x695039);
  const plaster = plasterTexture();
  const wall = surface(0xffffff, plaster);
  wall.bumpMap = plaster;
  wall.bumpScale = 0.005;
  box(
    root,
    "Raised wooden room floor",
    [12.6, 0.25, 9.6],
    [0, -0.2, 0],
    darkWood,
  );
  box(root, "Back plaster wall", [12.6, 7.25, 0.18], [0, 3.57, -4.73], wall);
  box(
    root,
    "Left wall below window",
    [0.18, 2.55, 15.6],
    [-6.27, 1.275, 3],
    wall,
  );
  box(
    root,
    "Left wall above window",
    [0.18, 1.55, 15.6],
    [-6.27, 6.525, 3],
    wall,
  );
  box(
    root,
    "Left wall behind window",
    [0.18, 3.2, 2.6],
    [-6.27, 4.15, -3.5],
    wall,
  );
  box(
    root,
    "Left wall in front of window",
    [0.18, 3.2, 9.1],
    [-6.27, 4.15, 6.25],
    wall,
  );
  box(root, "Right plaster wall", [0.18, 7.25, 15.6], [6.27, 3.57, 3], wall);
  const ceiling = box(
    root,
    "Ceiling",
    [12.7, 0.15, 15.6],
    [0, 7.3, 3],
    surface(0xe2d9bf),
  );
  ceiling.castShadow = true;
  for (const x of [-6.1, 6.1]) {
    for (const y of [0.18, 3.05, 7.15])
      box(root, "Side wall beam", [0.2, 0.13, 15.4], [x, y, 3], wood);
  }
  for (const x of [-6.12, 0, 6.12])
    box(root, "Back wall post", [0.17, 7.3, 0.22], [x, 3.6, -4.56], wood);
  for (const z of [-4.55, 4.57])
    box(root, "Left wall post", [0.2, 7.3, 0.16], [-6.1, 3.6, z], wood);
  for (const y of [0.18, 3.05, 7.15]) {
    box(root, "Back wall beam", [12.4, 0.13, 0.2], [0, y, -4.57], wood);
    box(root, "Left wall beam", [0.2, 0.13, 9.3], [-6.1, y, 0], wood);
  }
  const woven = tatamiTexture();
  const border = surface(0x566346);
  const mats = [
    { x: -3, z: -3, w: 6, d: 3 },
    { x: 1.5, z: -1.5, w: 3, d: 6 },
    { x: 4.5, z: -1.5, w: 3, d: 6 },
    { x: -4.5, z: 1.5, w: 3, d: 6 },
    { x: -1.5, z: 1.5, w: 3, d: 6 },
    { x: 3, z: 3, w: 6, d: 3 },
  ];
  for (const [index, mat] of mats.entries()) {
    const material = surface(index % 2 === 0 ? 0xffffff : 0xf1eddc, woven);
    material.bumpMap = woven;
    material.bumpScale = 0.018;
    box(
      root,
      "Woven tatami mat",
      [mat.w - 0.025, 0.08, mat.d - 0.025],
      [mat.x, -0.04, mat.z],
      material,
    );
    if (mat.w > mat.d) {
      for (const z of [mat.z - mat.d / 2 + 0.055, mat.z + mat.d / 2 - 0.055])
        box(
          root,
          "Tatami cloth edge",
          [mat.w, 0.012, 0.11],
          [mat.x, 0.008, z],
          border,
        );
    } else {
      for (const x of [mat.x - mat.w / 2 + 0.055, mat.x + mat.w / 2 - 0.055])
        box(
          root,
          "Tatami cloth edge",
          [0.11, 0.012, mat.d],
          [x, 0.008, mat.z],
          border,
        );
    }
  }
  const extraFloor = surface(0xf5efdb, woven);
  extraFloor.bumpMap = woven;
  extraFloor.bumpScale = 0.018;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = -4.5 + col * 3;
      const z = 6 + row * 3;
      box(
        root,
        "Front tatami mat",
        [2.98, 0.08, 2.98],
        [x, -0.04, z],
        extraFloor,
      );
      box(
        root,
        "Front tatami border",
        [0.11, 0.012, 3],
        [x - 1.45, 0.008, z],
        border,
      );
    }
  }
  makeWindow(root, wood);
  makeChest(root, wood, darkWood);
  makeStereo(root, wood);
  makeBookshelf(root, wood, darkWood);
  const fanBlades = makeFan(root);
  makeTelevision(root, wood);
  makeFridge(root);
  makeWallDecor(root, wood);
  makeTelephone(root);
  makeLowTable(root, wood);
  makeCeilingLamp(root);
  return {
    root,
    animate(time, motion) {
      fanBlades.rotation.z = motion ? time * 4 : 0;
    },
  };
}
