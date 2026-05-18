// Differential characterization of the U5 / ADR-0003 D3 repair re-hash fix.
//
// Old behavior: repair re-copied from current source but did NOT record the
// staged hash, leaving state.json describing neither disk nor source. The
// NEXT `update` then false-flagged the just-repaired file as tampered and
// blocked (ok:false). New behavior: repair records the staged hash, so
// state.json == on-disk and the subsequent update is a clean no-op.
//
// Driven through the public createCli entry (the command functions use a
// module-scoped productConfig set by createCli — they are not callable
// standalone). A temp runner imports the kernel by ABSOLUTE path so the
// copied fixture is position-independent.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { readState, hashFile, stateDirFor, STATE_FILE } from "../../core/filesystem.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const SAMPLE = path.join(REPO, "examples/sample-product");

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rrh-fix-"));
  for (const entry of ["sample.install.json", "skills", "agents", "rules"]) {
    fs.cpSync(path.join(SAMPLE, entry), path.join(root, entry), { recursive: true });
  }
  const runner = `
import { createCli } from ${JSON.stringify(path.join(REPO, "scripts/installer/index.mjs"))};
import * as claude from ${JSON.stringify(path.join(REPO, "scripts/installer/adapters/claude.mjs"))};
import * as codex from ${JSON.stringify(path.join(REPO, "scripts/installer/adapters/codex.mjs"))};
import * as opencode from ${JSON.stringify(path.join(REPO, "scripts/installer/adapters/opencode.mjs"))};
import productConfig from ${JSON.stringify(path.join(SAMPLE, "agent-skills.config.mjs"))};
process.chdir(${JSON.stringify(root)});
const cli = createCli({ adapters: [claude, codex, opencode], productConfig, version: "test" });
await cli.run(process.argv);
`;
  fs.writeFileSync(path.join(root, "runner.mjs"), runner);
  return root;
}

function run(fixture, args) {
  return spawnSync("node", [path.join(fixture, "runner.mjs"), ...args], {
    encoding: "utf8",
    cwd: fixture,
  });
}

test("repair re-hash: state.json matches on-disk after repair; update is a clean no-op (ADR-0003 D3)", () => {
  const fixture = makeFixture();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "rrh-tgt-"));
  try {
    // 1. Install the standalone hello-world skill.
    const inst = run(fixture, ["install", "--agent", "claude-code", "--skill", "sample:hello-world", "--target", target, "--allow-no-cli"]);
    assert.equal(inst.status, 0, `install failed: ${inst.stdout}\n${inst.stderr}`);

    const st0 = readState(target);
    assert.ok(st0 && st0.managedFiles.length > 0, "state.json has managed files");
    const mf = st0.managedFiles.find((m) => m.relPath.includes("hello-world")) ?? st0.managedFiles[0];
    const installedAbs = path.join(target, mf.relPath);
    assert.ok(fs.existsSync(installedAbs), "skill file installed on disk");

    // 2. Drift the SOURCE and make the target repairable (delete → missing).
    fs.appendFileSync(path.join(fixture, mf.sourceRelPath), "\n<!-- drifted by test -->\n");
    fs.rmSync(installedAbs);

    // 3. Repair.
    const rep = run(fixture, ["repair", "--apply", "--agent", "claude-code", "--target", target]);
    assert.equal(rep.status, 0, `repair failed: ${rep.stdout}\n${rep.stderr}`);
    assert.ok(fs.existsSync(installedAbs), "repair restored the file");

    // 4. THE differential assertion: state.json sha256 == on-disk hash.
    //    New behavior TRUE; old behavior FALSE (state kept pre-drift hash).
    const st1 = readState(target);
    const mf1 = st1.managedFiles.find((m) => m.relPath === mf.relPath);
    assert.equal(mf1.sha256, hashFile(installedAbs).sha256,
      "ADR-0003 D3: repair must record the staged hash so state == on-disk");

    // 5. NEW-behavior consequence: follow-up update is a clean no-op, NOT a
    //    tamper-block. update()'s block return is
    //    { ok:false, reason:"modification-blocks", blockedByModification:[...] }
    //    — there is no `tampered` key, so assert the real shape.
    const upd = run(fixture, ["update", "--agent", "claude-code", "--target", target, "--json"]);
    assert.equal(upd.status, 0, `update after repair must exit 0; got status=${upd.status} stdout=${upd.stdout} stderr=${upd.stderr}`);
    const env = JSON.parse(upd.stdout);
    assert.notEqual(env.ok, false, `update must not report failure: ${upd.stdout}`);
    assert.notEqual(env.reason, "modification-blocks", `update must not tamper-block after a correct repair: ${upd.stdout}`);
    assert.ok(!env.blockedByModification || env.blockedByModification.length === 0,
      `no file may be blockedByModification after a correct repair: ${upd.stdout}`);

    // 6. OLD-behavior differential arm — prove the bug is real and the fix
    //    necessary. Simulate the pre-fix repair (which did NOT record the
    //    staged hash) by reverting state.json's sha256 for this file to a
    //    value that is neither the on-disk hash nor the current source hash.
    //    Under the old behavior the next `update` MUST tamper-block.
    const stateFile = path.join(stateDirFor(target), STATE_FILE);
    const stale = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const staleEntry = stale.managedFiles.find((m) => m.relPath === mf.relPath);
    staleEntry.sha256 = "0".repeat(64); // pre-fix: state describes neither disk nor source
    fs.writeFileSync(stateFile, JSON.stringify(stale, null, 2));
    const updOld = run(fixture, ["update", "--agent", "claude-code", "--target", target, "--json"]);
    const envOld = JSON.parse(updOld.stdout);
    assert.equal(envOld.ok, false, "old-behavior arm: stale state.sha256 must make update fail");
    assert.equal(envOld.reason, "modification-blocks",
      `old-behavior arm: update must tamper-block when state.sha256 is stale (this is the bug ADR-0003 D3 fixes): ${updOld.stdout}`);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("cross-stage invariant on the real command path with a NON-identity adapter (opencode agent transform)", () => {
  const fixture = makeFixture();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "rrh-oc-"));
  try {
    // sample-demo bundle pulls in agent example-agent; opencode's
    // transformAssetContent rewrites its Claude frontmatter (non-identity).
    const inst = run(fixture, ["install", "--agent", "opencode", "--bundle", "sample-demo", "--target", target, "--allow-no-cli"]);
    assert.equal(inst.status, 0, `opencode install failed: ${inst.stdout}\n${inst.stderr}`);

    const st = readState(target);
    const agentMf = st.managedFiles.find((m) => m.assetType === "agent");
    assert.ok(agentMf, `expected an installed agent managed file: ${JSON.stringify(st.managedFiles.map((m) => m.relPath))}`);
    const onDisk = path.join(target, agentMf.relPath);
    assert.ok(fs.existsSync(onDisk), "transformed agent on disk");

    // Cross-stage invariant on the COMMAND path (not just the unit witness):
    // state.json sha256 must equal the on-disk (transformed) bytes' hash...
    assert.equal(agentMf.sha256, hashFile(onDisk).sha256,
      "ADR-0002 D2: state.json sha256 == hashFile(transformed on-disk) via the install command path");
    // ...and must differ from the untransformed source (proof the transform ran).
    const srcHash = hashFile(path.join(fixture, agentMf.sourceRelPath)).sha256;
    assert.notEqual(agentMf.sha256, srcHash, "opencode transform must have changed the bytes");

    // And a follow-up update is a clean no-op — plan-side hashSource and
    // stage-side stageAsset agree for the non-identity adapter.
    const upd = run(fixture, ["update", "--agent", "opencode", "--target", target, "--json"]);
    assert.equal(upd.status, 0, `update after opencode install must exit 0: ${upd.stdout}\n${upd.stderr}`);
    const env = JSON.parse(upd.stdout);
    assert.notEqual(env.ok, false, `update must be a clean no-op for the non-identity adapter: ${upd.stdout}`);
    assert.notEqual(env.reason, "modification-blocks", `non-identity update must not tamper-block: ${upd.stdout}`);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});
