import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createGiftContents } from "./gift-contents.js";

function part(parent, name, size, position, material, radius = 0.02) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(...size, 3, radius),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ribbonLoop(parent, side, material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.025, 0.39, 0),
    new THREE.Vector3(side * 0.22, 0.57, -0.02),
    new THREE.Vector3(side * 0.38, 0.52, 0.035),
    new THREE.Vector3(side * 0.25, 0.39, 0.085),
    new THREE.Vector3(side * 0.025, 0.39, 0.015),
  ]);
  const positions = [],
    normals = [],
    uvs = [],
    indices = [];
  for (let step = 0; step <= 32; step++) {
    const t = step / 32;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const across = new THREE.Vector3(0, 0, 1)
      .cross(tangent)
      .normalize()
      .multiplyScalar(0.038);
    for (const edge of [-1, 1]) {
      positions.push(
        point.x + across.x * edge,
        point.y + across.y * edge,
        point.z + across.z * edge,
      );
      normals.push(0, 0, 1);
      uvs.push(t, (edge + 1) / 2);
    }
    if (step < 32) {
      const i = step * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Satin ribbon bow loop";
  mesh.castShadow = true;
  parent.add(mesh);
}

export function createWrappedGift() {
  const root = new THREE.Group();
  root.name = "Ribbon wrapped present";
  const paper = new THREE.MeshStandardMaterial({
    color: 0xf3dcc0,
    roughness: 0.72,
  });
  const ribbon = new THREE.MeshStandardMaterial({
    color: 0xa82e3d,
    roughness: 0.32,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd1a34e,
    roughness: 0.4,
    metalness: 0.5,
  });
  part(root, "Gift base", [0.88, 0.06, 0.76], [0, -0.29, 0], paper, 0.018);
  for (const x of [-0.4175, 0.4175])
    part(
      root,
      "Gift side wall",
      [0.045, 0.6, 0.76],
      [x, 0.01, 0],
      paper,
      0.015,
    );
  for (const z of [-0.3575, 0.3575])
    part(
      root,
      "Gift front wall",
      [0.8, 0.6, 0.045],
      [0, 0.01, z],
      paper,
      0.015,
    );
  for (const z of [-0.386, 0.386])
    part(
      root,
      "Vertical wrapping ribbon",
      [0.115, 0.64, 0.012],
      [0, 0, z],
      ribbon,
      0.004,
    );
  const lid = new THREE.Group();
  lid.name = "Gift lid and bow";
  root.add(lid);
  part(lid, "Gift lid", [0.92, 0.09, 0.8], [0, 0.325, 0], paper, 0.025);
  part(
    lid,
    "Top wrapping ribbon",
    [0.115, 0.014, 0.8],
    [0, 0.378, 0],
    ribbon,
    0.004,
  );
  part(lid, "Crossed ribbon", [0.93, 0.018, 0.1], [0, 0.382, 0], ribbon, 0.007);
  for (const x of [-0.452, 0.452])
    part(root, "Side ribbon", [0.014, 0.66, 0.1], [x, 0.01, 0], ribbon, 0.004);
  ribbonLoop(lid, -1, ribbon);
  ribbonLoop(lid, 1, ribbon);
  part(lid, "Ribbon knot", [0.16, 0.09, 0.12], [0, 0.41, 0.02], ribbon, 0.025);
  const tag = part(
    root,
    "Golden gift tag",
    [0.16, 0.2, 0.015],
    [0.18, 0.13, 0.39],
    gold,
    0.014,
  );
  tag.rotation.z = -0.22;
  const pickables = [...root.children];
  const contents = createGiftContents();
  contents.visible = false;
  root.add(contents);
  const burst = new THREE.Group();
  burst.name = "Gift pop confetti";
  burst.visible = false;
  root.add(burst);
  const confettiMaterials = [0xc3505c, 0xdfbb62, 0xf8f0db, 0x839e72].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
      }),
  );
  for (let index = 0; index < 24; index++) {
    const flake = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.075),
      confettiMaterials[index % 4],
    );
    burst.add(flake);
  }
  return {
    root,
    pickables,
    leftGrip: new THREE.Vector3(-0.47, 0.03, 0.19),
    rightGrip: new THREE.Vector3(0.47, 0.03, 0.19),
    reveal(progress) {
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      lid.visible = p < 0.9;
      lid.position.set(-0.85 * p, Math.sin((p * Math.PI) / 2) * 1.5, -0.2 * p);
      lid.rotation.set(-0.7 * p, -1.2 * p, -1.4 * p);
      contents.visible = p > 0;
      const t = Math.min(1, p / 0.7) - 1;
      const spring = 1 + 2.7 * t * t * t + 1.7 * t * t;
      contents.position.y = -0.35 * (1 - spring);
      contents.scale.setScalar(0.35 + 0.65 * spring);
      burst.visible = p > 0 && p < 1;
      confettiMaterials.forEach((material) => {
        material.opacity = 1 - p * p;
      });
      burst.children.forEach((flake, index) => {
        const angle = index * 2.39996;
        const radius = p * (0.65 + (index % 5) * 0.12);
        flake.position.set(
          Math.cos(angle) * radius,
          0.4 + p * (1.15 + (index % 4) * 0.2) - p * p * 1.1,
          Math.sin(angle) * radius * 0.6,
        );
        flake.rotation.set(p * (index + 2), angle + p * 3, p * 5);
      });
    },
  };
}
