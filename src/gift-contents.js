import * as THREE from "three";

function mesh(parent, geometry, material, position) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function lettering(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

export function createGiftContents() {
  const root = new THREE.Group();
  root.name = "Exam cake and encouragement card";
  root.rotation.y = Math.PI;
  const cream = new THREE.MeshStandardMaterial({
    color: 0xfff7e9,
    roughness: 0.65,
  });
  const sponge = new THREE.MeshStandardMaterial({
    color: 0xf1bfbd,
    roughness: 0.78,
  });
  const plate = new THREE.MeshStandardMaterial({
    color: 0xf4e2ac,
    roughness: 0.35,
    metalness: 0.15,
  });
  const berry = new THREE.MeshStandardMaterial({
    color: 0xc94348,
    roughness: 0.32,
  });
  const leaf = new THREE.MeshStandardMaterial({
    color: 0x527a42,
    roughness: 0.8,
  });
  const cake = new THREE.Group();
  cake.name = "수능 케이크";
  cake.position.set(-0.09, 0.32, 0.1);
  root.add(cake);
  mesh(
    cake,
    new THREE.CylinderGeometry(0.39, 0.39, 0.035, 64),
    plate,
    [0, 0.02, 0],
  );
  mesh(
    cake,
    new THREE.CylinderGeometry(0.32, 0.32, 0.29, 64),
    sponge,
    [0, 0.18, 0],
  );
  mesh(
    cake,
    new THREE.CylinderGeometry(0.335, 0.32, 0.075, 64),
    cream,
    [0, 0.335, 0],
  );
  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2;
    const swirl = mesh(cake, new THREE.SphereGeometry(0.052, 16, 12), cream, [
      Math.cos(angle) * 0.3,
      0.305,
      Math.sin(angle) * 0.3,
    ]);
    swirl.scale.y = 0.8 + (index % 3) * 0.18;
  }
  for (let index = 0; index < 5; index++) {
    const angle = (index / 5) * Math.PI * 2;
    const x = Math.cos(angle) * 0.245,
      z = Math.sin(angle) * 0.245;
    const strawberry = mesh(
      cake,
      new THREE.SphereGeometry(0.06, 20, 16),
      berry,
      [x, 0.408, z],
    );
    strawberry.scale.set(0.8, 1.25, 0.8);
    for (let petal = 0; petal < 4; petal++) {
      const sprig = mesh(cake, new THREE.SphereGeometry(0.028, 10, 8), leaf, [
        x,
        0.47,
        z,
      ]);
      sprig.scale.set(0.4, 0.15, 1);
      sprig.rotation.y = (petal * Math.PI) / 2;
    }
  }
  const cakeMessage = lettering(512, 192, (ctx) => {
    ctx.fillStyle = "#713d34";
    ctx.textAlign = "center";
    ctx.font = "bold 68px 'Malgun Gothic', sans-serif";
    ctx.fillText("수능 대박", 256, 123);
  });
  mesh(cake, new THREE.PlaneGeometry(0.4, 0.15), cakeMessage, [0, 0.19, 0.325]);
  const card = new THREE.Group();
  card.name = "수능 응원카드";
  card.position.set(0.48, 0.82, -0.06);
  card.rotation.set(-0.08, -0.1, -0.08);
  root.add(card);
  mesh(card, new THREE.BoxGeometry(0.67, 0.88, 0.025), cream, [0, 0, 0]);
  const cardMessage = lettering(536, 704, (ctx, width, height) => {
    ctx.fillStyle = "#fff7e6";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#be7b70";
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.strokeStyle = "#ddc595";
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, width - 70, height - 70);
    ctx.textAlign = "center";
    ctx.fillStyle = "#a7494d";
    ctx.font = "bold 82px 'Malgun Gothic', sans-serif";
    ctx.fillText("수능 대박", width / 2, height / 2 + 28);
  });
  mesh(card, new THREE.PlaneGeometry(0.665, 0.875), cardMessage, [0, 0, 0.014]);
  return root;
}
