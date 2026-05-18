import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectDrift, formatDrift } from "./drift.mjs";
import { loadManifest } from "./loader.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, "../../../../examples/sample-product");
const SAMPLE_MANIFEST = path.join(SAMPLE, "sample.install.json");

test("detectDrift: pristine sample-product tree is clean (pass:true)", () => {
  const manifest = loadManifest(SAMPLE_MANIFEST);
  const result = detectDrift({ repoRoot: SAMPLE, manifest });
  assert.equal(result.pass, true, `sample tree should be drift-free: ${JSON.stringify({
    missingFromManifest: result.missingFromManifest,
    missingFromDisk: result.missingFromDisk,
  })}`);
  assert.deepEqual(result.missingFromManifest, []);
  assert.deepEqual(result.missingFromDisk, []);
});

test("detectDrift: manifest skill dir absent on disk → missingFromDisk, pass:false", () => {
  // Copy the fixture, then declare an extra skill the disk does not have.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-"));
  try {
    for (const e of ["sample.install.json", "skills", "agents", "rules"]) {
      fs.cpSync(path.join(SAMPLE, e), path.join(root, e), { recursive: true });
    }
    const manifest = loadManifest(path.join(root, "sample.install.json"));
    manifest.skills["sample:ghost"] = {
      id: "sample:ghost",
      dirname: "ghost",
      sourcePath: "skills/ghost",
      category: "best-practice",
      profile: "standalone",
      description: "a skill with no directory on disk",
    };
    const result = detectDrift({ repoRoot: root, manifest });
    assert.equal(result.pass, false);
    assert.ok(result.missingFromDisk.includes("ghost"), JSON.stringify(result.missingFromDisk));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("formatDrift: text + json modes render", () => {
  const manifest = loadManifest(SAMPLE_MANIFEST);
  const result = detectDrift({ repoRoot: SAMPLE, manifest });
  assert.equal(typeof formatDrift(result, "text"), "string");
  const json = JSON.parse(formatDrift(result, "json"));
  assert.equal(json.pass, true);
});

test("rebuilt suite binds to the sample-product fixture", () => {
  // U8 intent: the layered rebuild is bound to examples/sample-product/ with
  // the sample: prefix and sample.install.json — no upstream product fixture.
  const manifest = loadManifest(SAMPLE_MANIFEST);
  assert.ok(Object.keys(manifest.skills).every((id) => id.startsWith("sample:")),
    `manifest must use the sample: prefix; got ${Object.keys(manifest.skills)}`);
  assert.equal(path.basename(SAMPLE_MANIFEST), "sample.install.json");
});
