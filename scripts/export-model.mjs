import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DOMParser } from "linkedom";
import { Canvas, Image, loadImage } from "@napi-rs/canvas";
import { unzipSync, strFromU8 } from "fflate";
import * as THREE from "three";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// The asset pipeline supplies the browser image APIs used by Three.js in Node.
globalThis.DOMParser = DOMParser;
globalThis.OffscreenCanvas = Canvas;
globalThis.HTMLImageElement = Image;
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((result) => {
        this.result = result;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
};

const archive = unzipSync(
  await readFile(
    new URL("../toro-inoue/source/Toro Inoue.zip", import.meta.url),
  ),
);
const images = new Map();
for (const name of ["CH_toro_body01.png", "CH_toro_face01.png"]) {
  if (!archive[name]) throw new Error(`Missing source texture: ${name}`);
  images.set(name, await loadImage(archive[name]));
}

const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function loadLocalTexture(path) {
  const name = path.replaceAll("\\", "/").split("/").at(-1);
  const image = images.get(name);
  if (!image) throw new Error(`Unknown texture reference: ${name}`);
  const texture = new THREE.Texture(image);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

let asset;
try {
  asset = new ColladaLoader().parse(
    strFromU8(archive["ToroHigh fixed.dae"]),
    "",
  );
} finally {
  THREE.TextureLoader.prototype.load = originalLoad;
}
if (!asset?.scene) throw new Error("Could not parse supplied model");

const materialCache = new Map();
let meshCount = 0;
asset.scene.traverse((object) => {
  if (!object.isMesh) return;
  const sourceMaterials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  const materials = sourceMaterials.map((source) => {
    if (!materialCache.has(source)) {
      const surface = new THREE.MeshStandardMaterial({
        name:
          source.map?.name === "CH_toro_face01.png"
            ? "Toro face atlas"
            : source.name,
        color: 0xffffff,
        map: source.map,
        roughness: 0.87,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      surface.userData.textureRole =
        source.map?.name === "CH_toro_face01.png" ? "faceAtlas" : "body";
      materialCache.set(source, surface);
    }
    return materialCache.get(source);
  });
  object.material = Array.isArray(object.material) ? materials : materials[0];
  if (!sourceMaterials.some((surface) => surface.vertexColors)) {
    object.geometry.deleteAttribute("color");
  }
  const skinIndex = object.geometry.getAttribute("skinIndex");
  if (skinIndex)
    object.geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndex.array, 4),
    );
  object.castShadow = true;
  object.receiveShadow = true;
  for (const value of object.geometry.attributes.position.array) {
    if (!Number.isFinite(value))
      throw new Error(`Invalid vertex in ${object.name}`);
  }
  meshCount += 1;
});
asset.scene.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(asset.scene, true);
let boneCount = 0;
asset.scene.traverse((object) => {
  if (object.isBone) boneCount += 1;
});
if (!Number.isFinite(bounds.min.y) || !boneCount || !meshCount)
  throw new Error("Invalid model structure");

const model = new THREE.Group();
model.name = "Toro Inoue";
model.userData.source = "User-supplied ToroHigh fixed.dae";
model.add(asset.scene);
const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
const scale = 4.4 / size.y;
asset.scene.position.add(
  new THREE.Vector3(-center.x, -bounds.min.y + 0.015 / scale, -center.z),
);
model.scale.setScalar(scale);
model.updateMatrixWorld(true);

const result = await new GLTFExporter().parseAsync(model, { binary: true });
const bytes = Buffer.from(result);
if (
  bytes.toString("utf8", 0, 4) !== "glTF" ||
  bytes.readUInt32LE(8) !== bytes.length
)
  throw new Error("Invalid exported GLB");
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/toro.glb", import.meta.url), bytes);
await writeFile(
  new URL("../public/toro-expressions.png", import.meta.url),
  archive["CH_toro_face01.png"],
);
console.log(
  `Supplied Toro GLB verified · ${meshCount} meshes · ${boneCount} bones · ${(bytes.length / 1024).toFixed(0)} KB`,
);
