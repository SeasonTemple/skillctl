import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applyAdapterTransform } from "./plan.mjs";
import { AdapterError, ERR_TRANSFORM_FAILED } from "./errors.mjs";

const baseAsset = (over = {}) => ({
  assetType: "agent",
  id: "sample-example-agent",
  sourceRelPath: "agents/sample-example-agent.md",
  sourceBuf: Buffer.from("---\nname: x\ndescription: a\n---\nbody\n", "utf8"),
  ...over,
});

// ---- applyAdapterTransform (SPI v1.1 compose primitive) ----

test("applyAdapterTransform: no transformFn → identity, transformed:false, same Buffer ref", () => {
  const asset = baseAsset();
  const { resultBuf, transformed } = applyAdapterTransform(asset, undefined, { stage: "plan" });
  assert.equal(transformed, false);
  assert.equal(resultBuf, asset.sourceBuf, "identity must return the SAME Buffer instance");
});

test("applyAdapterTransform: identity fn returning input → transformed:false (ref equality)", () => {
  const asset = baseAsset();
  const idFn = (a, body) => body;
  const { resultBuf, transformed } = applyAdapterTransform(asset, idFn, { adapterId: "x", stage: "stage" });
  assert.equal(transformed, false);
  assert.equal(resultBuf, asset.sourceBuf);
});

test("applyAdapterTransform: non-identity fn → transformed:true, new bytes", () => {
  const asset = baseAsset();
  const xf = (a, body) => Buffer.concat([body, Buffer.from("!")]);
  const { resultBuf, transformed } = applyAdapterTransform(asset, xf, { adapterId: "oc", stage: "stage" });
  assert.equal(transformed, true);
  assert.notEqual(resultBuf, asset.sourceBuf);
  assert.equal(resultBuf.toString("utf8"), asset.sourceBuf.toString("utf8") + "!");
});

test("applyAdapterTransform: hook receives only {assetType,id,sourceRelPath}", () => {
  const asset = baseAsset();
  let seen;
  applyAdapterTransform(asset, (a, body) => { seen = a; return body; }, { stage: "plan" });
  assert.deepEqual(Object.keys(seen).sort(), ["assetType", "id", "sourceRelPath"]);
  assert.equal(seen.id, "sample-example-agent");
});

test("applyAdapterTransform: hook throws → AdapterError(ERR_TRANSFORM_FAILED) with details", () => {
  const asset = baseAsset();
  const boom = new Error("nope");
  try {
    applyAdapterTransform(asset, () => { throw boom; }, { adapterId: "oc", stage: "stage" });
    assert.fail("should have thrown");
  } catch (e) {
    assert.ok(e instanceof AdapterError);
    assert.equal(e.code, ERR_TRANSFORM_FAILED);
    assert.equal(e.details.stage, "stage");
    assert.equal(e.details.adapterId, "oc");
    assert.equal(e.details.assetId, "sample-example-agent");
    assert.equal(e.details.assetType, "agent");
    assert.equal(e.details.cause, boom);
  }
});

test("applyAdapterTransform: non-Buffer return → AdapterError(ERR_TRANSFORM_FAILED)", () => {
  const asset = baseAsset();
  try {
    applyAdapterTransform(asset, () => "i am a string", { adapterId: "oc", stage: "plan" });
    assert.fail("should have thrown");
  } catch (e) {
    assert.ok(e instanceof AdapterError);
    assert.equal(e.code, ERR_TRANSFORM_FAILED);
    assert.equal(e.details.stage, "plan");
  }
});

test("applyAdapterTransform: reads sourceAbs when no sourceBuf provided", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-"));
  try {
    const p = path.join(dir, "a.md");
    fs.writeFileSync(p, "disk-bytes");
    const asset = { assetType: "rule", id: "rules/x.md", sourceRelPath: "rules/x.md", sourceAbs: p };
    const { resultBuf, transformed } = applyAdapterTransform(asset, undefined, { stage: "plan" });
    assert.equal(transformed, false);
    assert.equal(resultBuf.toString("utf8"), "disk-bytes");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
