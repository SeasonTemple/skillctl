import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { whichSync } from "./which.mjs";

test("whichSync: finds an executable on PATH", () => {
  // `node` is guaranteed present (it runs this test).
  const found = whichSync("node");
  assert.ok(found && fs.existsSync(found), `node should resolve, got ${found}`);
});

test("whichSync: returns null for a non-existent binary", () => {
  assert.equal(whichSync("definitely-not-a-real-binary-xyz-123"), null);
});

test("whichSync: respects an injected PATH via env", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "which-"));
  try {
    const bin = path.join(dir, "mybin");
    fs.writeFileSync(bin, "#!/bin/sh\n");
    fs.chmodSync(bin, 0o755);
    const found = whichSync("mybin", { env: { PATH: dir }, platform: "linux" });
    assert.equal(found, bin);
    // Not on the default empty PATH.
    assert.equal(whichSync("mybin", { env: { PATH: "" }, platform: "linux" }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
