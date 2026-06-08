import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = process.argv[2];
if (!sourceRoot) {
  throw new Error("Usage: node scripts/import-attached-assets.mjs <expanded-zip-folder>");
}

const imageExtensions = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const flagRoot = path.join(projectRoot, "public", "images", "region-flags", "imported");
const imageRoot = path.join(projectRoot, "public", "images", "region-images", "imported");
const metroRoot = path.join(projectRoot, "public", "metro-images");

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function uniquePath(dir, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  let candidate = path.join(dir, `${base}${ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function countryForFile(filePath) {
  const lower = filePath.toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  if (["greece", "greek", "attica", "crete", "macedonia", "thrace", "epirus", "ionian", "aegean", "peloponnese", "thessaly", "athos"].some((token) => fileName.includes(token))) return "greece";
  if (lower.includes("romania")) return "romania";
  if (lower.includes("norway")) return "norway";
  if (lower.includes("turkish") || lower.includes("turkey")) return "turkey";
  if (lower.includes("uk flags") || lower.includes("united kingdom") || lower.includes("\\uk") || lower.includes("/uk")) return "united-kingdom";
  if (lower.includes("ukranian") || lower.includes("ukrainian") || lower.includes("ukraine")) return "ukraine";
  return "";
}

function looksLikeFlag(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return /\b(flag|coa|coat|arms|stema|emblem|logo|actual|county_coa|judet|judetului|rou_|ro_)/i.test(name);
}

function cleanAssetName(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, ext)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(40px|actual|county|judetul|judetului|coa|coat|arms|of|romania|romanian|stema|flag|emblem|logo|rou|ro)\b/gi, " ");
  return `${slugify(base) || slugify(path.basename(filePath, ext))}${ext}`;
}

let copiedMetro = 0;
let copiedRegional = 0;
for (const filePath of walk(sourceRoot)) {
  const ext = path.extname(filePath).toLowerCase();
  if (!imageExtensions.has(ext)) continue;
  const lower = filePath.toLowerCase();
  if (lower.includes("metro images")) {
    ensureDir(metroRoot);
    fs.copyFileSync(filePath, uniquePath(metroRoot, cleanAssetName(filePath)));
    copiedMetro += 1;
    continue;
  }
  const country = countryForFile(filePath);
  if (!country) continue;
  const targetRoot = looksLikeFlag(filePath) ? flagRoot : imageRoot;
  const targetDir = path.join(targetRoot, country);
  ensureDir(targetDir);
  fs.copyFileSync(filePath, uniquePath(targetDir, cleanAssetName(filePath)));
  copiedRegional += 1;
}

function manifestKey(fileName) {
  const ext = path.extname(fileName);
  return slugify(path.basename(fileName, ext)
    .replace(/\b(flag|coa|coat|arms|county|region|province|actual|stema|emblem|logo|city|municipality)\b/gi, " "));
}

function buildManifest(root, publicPrefix) {
  const manifest = {};
  if (!fs.existsSync(root)) return manifest;
  for (const country of fs.readdirSync(root).sort()) {
    const countryDir = path.join(root, country);
    if (!fs.statSync(countryDir).isDirectory()) continue;
    manifest[country] = {};
    for (const filePath of walk(countryDir).sort()) {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExtensions.has(ext)) continue;
      const rel = path.relative(path.join(projectRoot, "public", "images", publicPrefix), filePath).replaceAll(path.sep, "/");
      const key = manifestKey(path.basename(filePath));
      if (key && !manifest[country][key]) manifest[country][key] = rel;
    }
  }
  return manifest;
}

fs.writeFileSync(
  path.join(projectRoot, "src", "regionFlagManifest.json"),
  `${JSON.stringify(buildManifest(flagRoot, "region-flags"), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(projectRoot, "src", "regionImageManifest.json"),
  `${JSON.stringify(buildManifest(imageRoot, "region-images"), null, 2)}\n`,
);

console.log(`Copied ${copiedRegional} regional assets and ${copiedMetro} metro images.`);
