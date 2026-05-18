import test from "node:test";
import assert from "node:assert/strict";

import { assetTypes, getAssetType } from "./asset-types.mjs";

test("assetTypes: frozen registry with skill / agent / rule", () => {
  assert.equal(Object.isFrozen(assetTypes), true);
  assert.deepEqual(Object.keys(assetTypes).sort(), ["agent", "rule", "skill"]);
});

test("assetTypes: each entry exposes a defaultTargetMap function", () => {
  for (const id of ["skill", "agent", "rule"]) {
    assert.equal(typeof assetTypes[id].defaultTargetMap, "function", `${id}.defaultTargetMap`);
  }
});

test("getAssetType: returns the entry for a known type", () => {
  assert.equal(getAssetType("skill"), assetTypes.skill);
  assert.equal(getAssetType("agent"), assetTypes.agent);
  assert.equal(getAssetType("rule"), assetTypes.rule);
});

test("getAssetType: returns a falsy miss for an unknown type", () => {
  // nexel's getAssetType returns null (not undefined) on a miss.
  assert.equal(getAssetType("bundle"), null);
  assert.equal(getAssetType(""), null);
  assert.equal(getAssetType(undefined), null);
});
