import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { semverGt, newestReleaseNoteVersion, runLint } from "./lint-release-sync.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- semverGt (numeric, not lexical) ----

test("semverGt: numeric per-field, not lexical", () => {
  assert.equal(semverGt("0.10.0", "0.9.0"), true, "0.10.0 > 0.9.0 (lexical would say false)");
  assert.equal(semverGt("0.9.0", "0.8.9"), true);
  assert.equal(semverGt("1.0.0", "0.99.99"), true);
  assert.equal(semverGt("0.9.0", "0.9.0"), false, "equal is not greater");
  assert.equal(semverGt("0.9.0", "0.10.0"), false);
});

// ---- newestReleaseNoteVersion ----

test("newestReleaseNoteVersion: picks semver max, not lexical max", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rn-"));
  try {
    for (const v of ["v0.8.0", "v0.9.0", "v0.10.0", "v0.8.9"]) {
      fs.writeFileSync(path.join(dir, `${v}.md`), "x");
    }
    fs.writeFileSync(path.join(dir, "README.md"), "ignored"); // non-matching
    assert.equal(newestReleaseNoteVersion(dir), "0.10.0");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("newestReleaseNoteVersion: throws when no v*.md present", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rn-empty-"));
  try {
    assert.throws(() => newestReleaseNoteVersion(dir), /no v<x\.y\.z>\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- runLint with synthetic fixtures (no lockstep, no badge — skillctl) ----

function makeFixture(version, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lrs-"));
  const write = (rel, content) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };
  write("package.json", JSON.stringify({ name: "skillctl", version: overrides.pkg ?? version }));
  write("README.md", overrides.readmeExtra ?? "# skillctl\n");
  write("README.zh-CN.md", overrides.readmeZhExtra ?? "# skillctl\n");
  for (const v of (overrides.releaseNotes ?? [version])) {
    write(`docs/release-notes/v${v}.md`, "note");
  }
  return root;
}

test("runLint: consistent fixture → ok, zero mismatches", () => {
  const root = makeFixture("0.9.0");
  try {
    const r = runLint({ repoRoot: root });
    assert.equal(r.ok, true, JSON.stringify(r.mismatches));
    assert.equal(r.mismatches.length, 0);
    assert.equal(r.version, "0.9.0");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint: package bumped but release-note not written → mismatch (semver, not lexical)", () => {
  const root = makeFixture("0.9.0", { pkg: "0.10.0", releaseNotes: ["0.9.0"] });
  try {
    const r = runLint({ repoRoot: root });
    assert.equal(r.ok, false);
    const names = r.mismatches.map((m) => m.name);
    assert.ok(names.includes("package-version-matches-newest-release-note"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint: newest release note resolved by semver (v0.10.0 > v0.9.0)", () => {
  const root = makeFixture("0.10.0", { releaseNotes: ["0.9.0", "0.10.0"] });
  try {
    const r = runLint({ repoRoot: root });
    assert.equal(r.ok, true, JSON.stringify(r.mismatches));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint: empty docs/release-notes → error, exit-2 shape", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lrs-noerr-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.0" }));
    fs.writeFileSync(path.join(root, "README.md"), "# x\n");
    fs.mkdirSync(path.join(root, "docs/release-notes"), { recursive: true }); // present but empty
    const r = runLint({ repoRoot: root });
    assert.equal(r.ok, false);
    assert.ok(r.error && /no v<x\.y\.z>\.md/.test(r.error), `expected no-v*.md throw, got: ${r.error}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint: absent docs/release-notes dir → still exit-2 (IO error), not a crash", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lrs-absent-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.0" }));
    fs.writeFileSync(path.join(root, "README.md"), "# x\n");
    const r = runLint({ repoRoot: root }); // no docs/release-notes at all
    assert.equal(r.ok, false);
    assert.ok(r.error, `any IO error is a valid exit-2; got error=${r.error}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint heuristic: stale current-state version flagged as ADVISORY (never fatal)", () => {
  const root = makeFixture("0.9.0", {
    readmeExtra: "skillctl (CLI, v0.8.0) ...\n",
  });
  try {
    const r = runLint({ repoRoot: root });
    const adv = r.advisory.find((a) => a.name.startsWith("no-stale-current-state-version"));
    assert.ok(adv && adv.ok === false, "stale current-state must surface in advisory");
    assert.equal(r.ok, true, "heuristic is advisory — must NOT fail the lint");
    assert.ok(!r.mismatches.some((m) => m.name.startsWith("no-stale")), "heuristic must not enter fatal mismatches");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runLint heuristic: historical mention NOT flagged (false-negative tolerant)", () => {
  const root = makeFixture("0.9.0", {
    readmeExtra: "Single-tier installer (v0.8.0 onward) — see ADR-0004\n",
    readmeZhExtra: "单层 installer（v0.8.0 起）— 见 ADR-0004\n",
  });
  try {
    const r = runLint({ repoRoot: root });
    assert.equal(r.ok, true, JSON.stringify(r.mismatches));
    const adv = r.advisory.find((a) => a.name.startsWith("no-stale-current-state-version"));
    assert.ok(adv && adv.ok === true, "historical mention must not raise an advisory note");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- integration: the real repo must be consistent ----

test("runLint: real repo is consistent (pkg version == newest release note)", () => {
  const r = runLint({ repoRoot: REPO_ROOT });
  assert.equal(r.ok, true, `real repo drift: ${JSON.stringify(r.mismatches)} ${r.error ?? ""}`);
});
