import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateManifest, exitCodeFor, formatFindings } from "./validator.mjs";
import { loadManifest } from "./loader.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_MANIFEST = path.resolve(HERE, "../../../../examples/sample-product/sample.install.json");

test("validateManifest: the shipped sample.install.json is valid (zero findings)", () => {
  const m = loadManifest(SAMPLE_MANIFEST);
  const findings = validateManifest(m);
  assert.deepEqual(findings, [], `sample manifest should validate clean: ${JSON.stringify(findings)}`);
  assert.equal(exitCodeFor(findings), 0);
});

test("validateManifest: non-object → error finding, exit 1", () => {
  const findings = validateManifest(null);
  assert.ok(findings.length > 0);
  assert.equal(exitCodeFor(findings), 1);
});

test("validateManifest: wrong schemaVersion → error finding", () => {
  const m = loadManifest(SAMPLE_MANIFEST);
  const bad = { ...m, schemaVersion: 999 };
  const findings = validateManifest(bad);
  assert.ok(findings.some((f) => /schemaVersion/.test(f.message)), JSON.stringify(findings));
  assert.notEqual(exitCodeFor(findings), 0);
});

test("formatFindings: text and json modes", () => {
  const findings = validateManifest({});
  const text = formatFindings(findings, "text");
  assert.equal(typeof text, "string");
  const json = JSON.parse(formatFindings(findings, "json"));
  assert.equal(json.pass, false);
  assert.ok(Array.isArray(json.findings));
});

test("formatFindings: json pass:true on clean manifest", () => {
  const m = loadManifest(SAMPLE_MANIFEST);
  const json = JSON.parse(formatFindings(validateManifest(m), "json"));
  assert.equal(json.pass, true);
  assert.deepEqual(json.findings, []);
});
