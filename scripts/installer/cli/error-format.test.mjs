import test from "node:test";
import assert from "node:assert/strict";

import { handleError } from "./error-format.mjs";
import { CommandError } from "./commands/index.mjs";

// Stream stubs — handleError accepts injected { stdout, stderr, env }.
function caps() {
  const out = [], err = [];
  return {
    stdout: { write: (c) => { out.push(String(c)); return true; } },
    stderr: { write: (c) => { err.push(String(c)); return true; } },
    env: {},
    out, err,
  };
}
const jsonOut = (c) => JSON.parse(c.out.join("").trim());

// --- The uniform --json error-envelope contract (AGENT-CLI-CONTRACT.md §3):
// every error path, in --json mode, emits {ok:false,error,message,details}
// on STDOUT and nothing on stderr. Text mode writes to stderr only. ---

test("CommandError: --json → uniform stdout envelope, stderr clean", () => {
  const c = caps();
  handleError(new CommandError("boom", "ERR_X", { a: 1 }), { json: true }, c);
  assert.deepEqual(jsonOut(c), { ok: false, error: "ERR_X", message: "boom", details: { a: 1 } });
  assert.equal(c.err.join(""), "");
});

test("CommandError: text mode → stderr only, stdout clean", () => {
  const c = caps();
  handleError(new CommandError("boom", "ERR_X", {}), { json: false }, c);
  assert.equal(c.out.join(""), "");
  assert.match(c.err.join(""), /error\[ERR_X\]: boom/);
});

test("ERR_DIRECT_UNSUPPORTED: --json → stdout envelope incl. install instructions in details", () => {
  const c = caps();
  const e = Object.assign(new Error("direct mode unsupported"), {
    code: "ERR_DIRECT_UNSUPPORTED", pluginInstallInstructions: "run X",
  });
  handleError(e, { json: true }, c);
  const env = jsonOut(c);
  assert.equal(env.ok, false);
  assert.equal(env.error, "ERR_DIRECT_UNSUPPORTED");
  assert.equal(env.details.pluginInstallInstructions, "run X");
  assert.equal(c.err.join(""), "", "json mode must not leak to stderr");
});

test("ERR_DIRECT_UNSUPPORTED: text mode → stderr instructions, stdout clean", () => {
  const c = caps();
  const e = Object.assign(new Error("nope"), {
    code: "ERR_DIRECT_UNSUPPORTED", pluginInstallInstructions: "run X",
  });
  handleError(e, { json: false }, c);
  assert.equal(c.out.join(""), "");
  assert.match(c.err.join(""), /run X/);
});

test("ERR_AGENT_CLI_MISSING: --json → stdout envelope, stderr clean", () => {
  const c = caps();
  const e = Object.assign(new Error("no cli"), {
    code: "ERR_AGENT_CLI_MISSING", adapterId: "codex", cliBinary: "codex", cliInstallUrl: "u",
  });
  handleError(e, { json: true }, c);
  assert.equal(jsonOut(c).error, "ERR_AGENT_CLI_MISSING");
  assert.equal(c.err.join(""), "");
});

test("ERR_LOCKED: --json → uniform stdout envelope, stderr clean", () => {
  const c = caps();
  const e = Object.assign(new Error("locked"), { code: "ERR_LOCKED" });
  handleError(e, { json: true }, c);
  assert.deepEqual(jsonOut(c), { ok: false, error: "ERR_LOCKED", message: "locked", details: {} });
  assert.equal(c.err.join(""), "");
});

test("ERR_LOCKED: text mode → stderr only", () => {
  const c = caps();
  handleError(Object.assign(new Error("locked"), { code: "ERR_LOCKED" }), { json: false }, c);
  assert.equal(c.out.join(""), "");
  assert.match(c.err.join(""), /error: locked/);
});

test("generic untyped throw: --json → uniform envelope with ERR_UNKNOWN", () => {
  const c = caps();
  handleError(new Error("kaboom"), { json: true }, c);
  assert.deepEqual(jsonOut(c), { ok: false, error: "ERR_UNKNOWN", message: "kaboom", details: {} });
  assert.equal(c.err.join(""), "", "the generic path was the primary contract leak — must be stdout-only in json");
});

test("generic typed-but-unrecognized code: --json → envelope carries the code", () => {
  const c = caps();
  handleError(Object.assign(new Error("weird"), { code: "ERR_WEIRD" }), { json: true }, c);
  assert.equal(jsonOut(c).error, "ERR_WEIRD");
  assert.equal(c.err.join(""), "");
});

test("generic: text mode → stderr, DEBUG appends stack", () => {
  const c = caps();
  c.env = { DEBUG: "1" };
  const e = new Error("kaboom");
  handleError(e, { json: false }, c);
  assert.equal(c.out.join(""), "");
  const errText = c.err.join("");
  assert.match(errText, /error: kaboom/);
  assert.match(errText, /at /, "DEBUG must append the stack in text mode");
});

test("generic: json mode does NOT append stack even under DEBUG (envelope stays parseable)", () => {
  const c = caps();
  c.env = { DEBUG: "1" };
  handleError(new Error("kaboom"), { json: true }, c);
  // stdout must be exactly one JSON line; stderr untouched.
  assert.deepEqual(jsonOut(c), { ok: false, error: "ERR_UNKNOWN", message: "kaboom", details: {} });
  assert.equal(c.err.join(""), "");
});
