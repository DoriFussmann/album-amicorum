import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const guidePath = join(siteRoot, "Design Guide.md");
const presetsDir = join(siteRoot, "design-presets");
const original = readFileSync(guidePath, "utf8");
const fence = /```tokens\r?\n[\s\S]*?\r?\n```/;

if (!fence.test(original)) {
  throw new Error("Design Guide.md is missing a ```tokens fence.");
}

function withTokens(jsonText) {
  return original.replace(fence, "```tokens\n" + jsonText.trim() + "\n```");
}

function build(label) {
  console.log(`\n=== theme:test ${label} ===\n`);
  const result = spawnSync("npm", ["run", "build"], {
    cwd: siteRoot,
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

const files = readdirSync(presetsDir)
  .filter((name) => name.endsWith(".json"))
  .sort();
let failed = null;

try {
  for (const file of files) {
    const json = readFileSync(join(presetsDir, file), "utf8");
    writeFileSync(guidePath, withTokens(json));
    if (!build(file)) {
      failed = file;
      break;
    }
  }
} finally {
  writeFileSync(guidePath, original);
}

if (failed) {
  console.error(`theme:test failed for ${failed}`);
  process.exit(1);
}

if (!build("restored guide")) {
  console.error("theme:test failed while restoring the design guide");
  process.exit(1);
}

console.log("theme:test: all presets passed");
