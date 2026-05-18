import test from "node:test";
import assert from "node:assert/strict";

import * as E from "./errors.mjs";

test("errors: every ERR_* is a unique non-empty string equal to its own name", () => {
  const codes = Object.entries(E).filter(([k]) => k.startsWith("ERR_"));
  assert.ok(codes.length >= 30, `expected the kernel error catalog; got ${codes.length}`);
  const seen = new Set();
  for (const [k, v] of codes) {
    assert.equal(typeof v, "string");
    assert.equal(v, k, `${k} must equal its string value (stable public contract)`);
    assert.equal(seen.has(v), false, `duplicate error code ${v}`);
    seen.add(v);
  }
});

test("errors: SPI v1.1 ERR_TRANSFORM_FAILED present (public stability contract)", () => {
  assert.equal(E.ERR_TRANSFORM_FAILED, "ERR_TRANSFORM_FAILED");
});

test("errors: ERR_PIPELINE_* removed (U5 single-tier delete, ADR-0003)", () => {
  assert.equal("ERR_PIPELINE_STAGE" in E, false);
  assert.equal("ERR_PIPELINE_COMMIT" in E, false);
  assert.equal("ERR_PIPELINE_PERSIST" in E, false);
});

test("AdapterError: carries code + details, is an Error", () => {
  const cause = new Error("boom");
  const e = new E.AdapterError("bad adapter", E.ERR_ADAPTER_INVALID, { adapterId: "x", cause });
  assert.ok(e instanceof Error);
  assert.equal(e.name, "AdapterError");
  assert.equal(e.code, E.ERR_ADAPTER_INVALID);
  assert.equal(e.message, "bad adapter");
  assert.equal(e.details.adapterId, "x");
  assert.equal(e.details.cause, cause);
});

test("ProductConfigError: carries code, is an Error", () => {
  const e = new E.ProductConfigError("bad config", E.ERR_INVALID_PRODUCT_CONFIG);
  assert.ok(e instanceof Error);
  assert.equal(e.name, "ProductConfigError");
  assert.equal(e.code, E.ERR_INVALID_PRODUCT_CONFIG);
});
