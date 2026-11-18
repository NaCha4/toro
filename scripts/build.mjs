import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(root, "docs");
if (path.relative(root, output) !== "docs")
  throw new Error("Invalid build output directory");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "public"), output, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: { app: "src/main.js" },
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  outdir: "docs/assets",
  entryNames: "[name]-[hash]",
  metafile: true,
  logLevel: "info",
});
const outputs = Object.keys(result.metafile.outputs);
const script = path.basename(outputs.find((name) => name.endsWith(".js")));
const stylesheet = path.basename(outputs.find((name) => name.endsWith(".css")));
const html = (await readFile(path.join(root, "index.html"), "utf8"))
  .replace("/src/main.js", `./assets/${script}`)
  .replace(
    "</head>",
    `<link rel="stylesheet" href="./assets/${stylesheet}" />\n</head>`,
  );
await writeFile(path.join(output, "index.html"), html);
console.log("Static GitHub Pages build ready in docs/");
