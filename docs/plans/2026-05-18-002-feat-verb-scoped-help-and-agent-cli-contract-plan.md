---
title: "feat: verb-scoped progressive CLI help + kernel-generic agent CLI contract doc"
type: feat
status: completed
date: 2026-05-18
---

# feat: verb-scoped progressive CLI help + kernel-generic agent CLI contract doc

## Summary

Adapt netops v0.10.0's verb-scoped progressive `--help` into skillctl as a product-agnostic kernel capability (cli layer only — `strings.help.verb.*` catalog, `renderHelp`/`printVerbHelp`/`hasVerbHelp` in `help.mjs`, one routing swap in `cli.mjs`, a new routing-coverage test). The netops renderers are no-arg with a hardcoded bin name; skillctl's must be parameterized off `productConfig` to stay kernel-generic. Add a kernel-generic agent CLI contract doc (11 verbs / exit codes / non-interactive flags / `--json` envelope / behavioral contract) plus a `examples/sample-product/` worked-example pointer, fix the README install reality (npm → git/tag/vendor per ADR-0005) in both locales, record the kernel-vs-product contract-doc boundary as ADR-0006, and ship as minor v0.3.0.

---

## Problem Frame

skillctl's `--help` is all-or-nothing: any help request renders the full ~70-line body (`printHelp` composing `strings.help.{header,usage,verbsBlock,flagsBlock,examplesBlock}` — skillctl has **no** monolithic `strings.help.full` key; that is a netops-only shape). A user (or agent) who wants only `install`'s flags reads the whole reference. netops solved this downstream at v0.10.0 with verb-scoped progressive help; the capability is product-agnostic kernel surface that skillctl can absorb. Separately, the README tells consumers to `npm install skillctl` — factually wrong: ADR-0005 froze the package as `"private": true`, unpublished, with the npm name held by an unrelated third party. There is also no agent-facing CLI contract doc; ADR-0004 deliberately excluded netops's `INSTALL-FOR-AGENTS.md` as product-specific, leaving a kernel-generic equivalent unwritten.

---

## Requirements

- R1. `<bin> <verb> --help` and `<bin> help <verb>` render a focused verb-scoped block, not the full reference.
- R2. Bare `help`, `--help` with no verb, and unknown verb/positional all still render the full byte-preserved help body — i.e. the unchanged `printHelp` composition of `strings.help.{header,usage,verbsBlock,flagsBlock,examplesBlock}` (netops parity — full help is the safe fallback).
- R3. Verb-help renderers are parameterized off `productConfig` (bin name, skill prefix, adapter list) — zero hardcoded product identity, matching the existing `strings.help.*` function-key i18n-seam contract.
- R4. `argv.mjs` parsing is unchanged — routing is derived from existing `verb` / `help` / `positional[0]` fields only.
- R5. A new kernel-generic agent CLI contract doc exists, product-agnostic, with a `examples/sample-product/` worked-example pointer; it is explicitly NOT a port of netops `INSTALL-FOR-AGENTS.md` content.
- R6. README install instructions reflect ADR-0005 reality (git tag / git-dependency / vendor; no `npm install`) in both `README.md` and `README.zh-CN.md`; each gains an LLM-agent pointer section linking the new contract doc; the Public API table lists `renderHelp` and no longer lists the deleted `pipeline`/`ERR_PIPELINE_*` (ADR-0004); the Status line and Roadmap no longer contradict the shipped v0.3.0 / already-released-v0.2.0 / ADR-0005 reality.
- R7. The kernel-vs-product agent-contract-doc scope boundary is recorded as ADR-0006; version bumps 0.2.0 → 0.3.0 with `docs/release-notes/v0.3.0.md`; `lint:release-sync` stays green.

---

## Scope Boundaries

- No `argv.mjs` changes — no new flags, no parser branches.
- The existing `printHelp` full-render path and each of its `strings.help.{header,usage,verbsBlock,flagsBlock,examplesBlock}` blocks stay byte-identical (regression-guarded, not rewritten). There is no `strings.help.full` to preserve — the full body is composed at runtime in `printHelp`.
- Existing human-facing README prose sections (Overview, ProductConfig, Architecture, SPI, Verbs table, Tests) are NOT reworked. Scope-lock **narrowed (user decision)**: U6 additionally makes three targeted accuracy edits — add `renderHelp` to the Public API table, correct the stale Status line (`v0.1.0` → `v0.3.0`, drop the `API surface is stable` overclaim), and correct the Roadmap (`v0.2.0` npm-subpath items contradict ADR-0005). These are factual-accuracy line edits driven by the same install-reality-accuracy goal as the install-block fix, not a prose rework.
- No `verify-baseline.mjs` byte-baseline oracle — `help.test.mjs` covers routing only (ADR-0004 keeps the byte oracle Tier-2-deferred).
- The new contract doc carries NO netops-specific content (tag resolution, npx-git-URL, tarball mirror, "triggering an installed skill", platform-depth) — ADR-0004 excluded that surface as product-private.

### Deferred to Follow-Up Work

- Product-coupled extended test sweep (`loader`/`commands`/`cli`/`help`/`strings`/`prompts` against the sample fixture): remains the ADR-0004 deferred follow-up. This plan adds only the new verb-help **routing** test, not the deferred product-coupled rebuild.
- `verify-baseline.mjs` byte oracle for the full-help body: Tier-2 follow-up (ADR-0004).

---

## Context & Research

### Relevant Code and Patterns

- `scripts/installer/cli/strings.mjs` — `strings.help` is a frozen object; keys are functions taking params (`header({binName,version})`, `verbsBlock()`, `flagsBlock({adapterList,...})`, `examplesBlock({binName,prefix})`). The `verbsBlock` already enumerates all 11 verbs + one-liners; `flagsBlock` is the full flag catalog to subset per verb.
- `scripts/installer/cli/help.mjs` — current `printHelp({productConfig,version,adapters,stream})` composes blocks from `strings.help`. The routing functions are added here.
- `scripts/installer/cli/cli.mjs:84-87` — the single help-routing site: `if (args.help || args.verb === "help") { printHelp(...); process.exit(0); }`. This is the one swap point.
- `scripts/installer/cli/argv.mjs` — already produces `verb`, `help` (bool from `--help`/`-h`), and `positional[]`. Routing needs nothing more (R4 verified against the parser source).
- `scripts/installer/cli/dispatch.mjs` — `KERNEL_HANDLERS` is the canonical 11-verb set: install, uninstall, update, list, plan, agents, doctor, repair, export, import, validate.
- `scripts/installer/index.mjs:14` — exports `printHelp`; `renderHelp` is added as an additive sibling export. Framing per ADR-0005: the kernel is unpublished and the public-API contract clock has not started, so this is a pre-publish surface addition (freely reshapeable, recorded in release notes), **not** a stability commitment under a "Public API contract" — note that U6 simultaneously removes the README's "API surface is stable" claim, so justifying the export *by* that claim would be self-contradictory.
- `examples/sample-product/bin.mjs` — uses `createCli` only; never calls `printHelp` directly. The routing change is fully internal to `cli.mjs`; the bin itself needs no change, but `sample-bin.test.mjs` gains two mandatory E2E witnesses (see U4) — it is the only layer that can assert `<verb> help` reverse-order behavior and prove routing reaches a real `createCli` bin.
- **Porting templates (read-only reference, another local repo — not a skillctl dependency):** `~/workspace/netops-agent-skills/scripts/installer/cli/help.mjs` (the `renderHelp`/`printVerbHelp`/`hasVerbHelp` shape), `.../cli/strings.mjs:95-282` (the `strings.help.verb` co-declared-in-freeze catalog), `.../cli/help.test.mjs` (10 routing tests, product-agnostic, uses the `Common flags:` sentinel which skillctl's `flagsBlock` also emits).

### Institutional Learnings

- ADR-0004 (`docs/adr/0004-absorption-provenance-netops-tier-1-2.md`): defines the absorbed-vs-excluded boundary. `INSTALL-FOR-AGENTS.md` content + the "version-agnostic explainer" invariant are explicitly **excluded** as netops-product-private. The new contract doc is therefore *new complementary kernel work*, not fulfillment of a recorded deferral (the invocation's "delivers ADR-0004's deferred follow-up" framing is corrected here — ADR-0004 records no such kernel-generic deferral). Verb-help routing is product-agnostic cli surface and is in-bounds to absorb.
- ADR-0005 (`docs/adr/0005-release-model-no-npm-provisional-name.md`): no npm publish, `"private": true`, distribute via git tag + `docs/release-notes/v<x.y.z>.md` (clone / git-dependency / vendor). The README `npm install skillctl` + npm-version badge are the install-reality defect. ADR-0004's deviation note already documents the npm badge as known-wrong-but-tolerated for lint purposes; the README *prose* is the actively-misleading part this plan corrects.

### External References

- None. Local patterns are strong (the netops fork is a direct lineage ancestor with a complete worked implementation); no external research warranted.

---

## Key Technical Decisions

- **Parameterize verb renderers (the core kernel-vs-product adaptation):** netops `strings.help.verb.<verb>` are no-arg arrows with literal `netops-agent-skills` and hardcoded bundle ids. skillctl's must be `(params) => template` taking `{ binName, prefix, adapterList }`, consistent with the existing `strings.help.*` function-key contract, so a downstream product's identity flows through with zero forking. This is the single decision that makes the absorption kernel-legal rather than a product-content copy.
- **Verb blocks co-declared inside the `strings.help` `Object.freeze` literal**, not assigned after freeze (post-freeze `strings.help.verb = …` throws). Mirrors the netops structure and skillctl's existing freeze discipline.
- **One routing entry point, `renderHelp`, replacing the `printHelp` call in `cli.mjs`** — keeps the human/createCli path and any future thin-bin path from diverging. `printHelp` stays exported and unchanged as the full-render primitive (R2 regression guard).
- **`renderHelp` threads `productConfig` through to verb renderers.** `cli.mjs` already has `productConfig` + `adapterIds` in scope at the routing site; `renderHelp` takes the same inputs `printHelp` does plus `args`.
- **Full help is the universal fallback** (R2): unknown verb, bare `help`, `--help` with no verb → the unchanged `printHelp` full composition. Never error on a help request. Matches netops; the parser already guarantees an unknown token lands in `positional`, never `verb`.
- **`renderHelp` added to `index.mjs`** as an additive pre-publish export. Rationale is ADR-0005, not a stability contract: the kernel is unpublished, the contract clock has not started, pre-publish surface changes are routine and recorded in release notes. Do not justify it via a "Public API contract" — U6 removes the README claim that one exists.
- **Contract doc borrows netops's *structural skeleton only*** (preconditions / non-interactive contract / exit-code contract / behavioral contract headings) with fully kernel-generic content keyed off the 11 `KERNEL_HANDLERS` verbs and the documented exit-code/`--json` conventions — no netops product specifics (ADR-0004 boundary).
- **ADR-0006 records the contract-doc scope boundary**, reusing ADR-0004's own provenance-recording pattern, so a future reader cannot re-conflate the kernel-generic doc with the excluded netops `INSTALL-FOR-AGENTS.md`. Qualifies as ADR-worthy under CLAUDE.md criteria: it is a hard-to-reverse scope/provenance decision that is surprising without ADR-0004 context.

---

## Open Questions

### Resolved During Planning

- README locale scope: fix **both** `README.md` and `README.zh-CN.md` install blocks + add the LLM-agent section to both. Rationale: skillctl has a release-sync lint discipline; divergent install instructions across locales is a real defect, not cosmetic. (User-confirmed.)
- README scope-lock narrowed (doc-review decision, user-confirmed): the original "don't rework README human sections" lock left the Public API table (missing the new `renderHelp` export), Status line, and Roadmap stale and self-contradictory with the shipped v0.3.0 / ADR-0005 reality — half-defeating U6's own accuracy goal (coherence + product-lens flagged). Resolution: U6 makes three targeted factual-accuracy line edits (Public API row, Status, Roadmap); the npm *badge* stays (dynamic, can't drift — ADR-0004 deviation note). Not a prose rework.
- ADR-0004 framing: the invocation's "delivers ADR-0004's deferred follow-up" is inaccurate — ADR-0004 *excludes* the netops product contract and records no kernel-generic deferral. Resolution: frame the contract doc as new complementary kernel work and record the boundary in ADR-0006. (User-confirmed.)
- Unknown-verb behavior: keep full help (netops parity), confirmed against `argv.mjs` (non-valid tokens never become `verb`).

### Deferred to Implementation

- Exact per-verb flag subset wording: derive from `flagsBlock` at implementation time per verb; the plan fixes the *shape* (Usage / Flags / optional notes / Example / "Run '<bin> help' for the complete reference."), not final copy.
- *(Resolved by round-2 doc review — no longer deferred.)* The `sample-bin.test.mjs` E2E witnesses are **mandatory**, not optional: `help.test.mjs` imports only `help.mjs` and cannot assert the `cli.mjs` gate, so the `<verb> help` reverse-order behavior is only enforceable end-to-end. See U4.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Help-routing decision — the two supported verb-help forms plus the full-help fallback:

| Input form | `args.verb` | `args.help` | `positional[0]` | Outcome |
|---|---|---|---|---|
| `<bin> install --help` | `install` | `true` | — | verb help: `install` |
| `<bin> help install` | `help` | `false` | `install` | verb help: `install` |
| `<bin> help` | `help` | `false` | — | full help |
| `<bin> --help` | `null` | `true` | — | full help |
| `<bin> frobnicate --help` | `null` | `true` | `frobnicate` | full help (fallback) |
| `<bin> help frobnicate` | `help` | `false` | `frobnicate` | full help (fallback) |
| `<bin> install help` | `install` | `false` | `help` | **NOT a help path** — `args.verb==="install"`, `args.help===false`, so the `cli.mjs` help gate misses and `dispatchVerb` runs `runInstall` with `positional=["help"]` |

**Reverse-order `<verb> help` is intentionally unsupported** (netops parity). `argv.mjs` only classifies `a[0]` against `validVerbs`; a second verb-shaped token is never re-classified, so `<bin> install help` reaches the install handler, not help. Only `<bin> <verb> --help` and `<bin> help <verb>` are help affordances. The agent CLI contract doc (U5) must state this explicitly so agents do not emit `<bin> <verb> help` expecting usage text.

```
renderHelp({ args, productConfig, version, adapters, stream = process.stdout }):
  target = null
  if args.help and hasVerbHelp(args.verb):                 target = args.verb
  elif args.verb == "help" and hasVerbHelp(args.positional?.[0]): target = args.positional[0]
  if target: printVerbHelp({ verb: target, productConfig, version, adapters, stream }); return
  printHelp({ productConfig, version, adapters, stream })   # unchanged full path; stream threaded

hasVerbHelp(v): v is string and v != "help" and typeof strings.help.verb?.[v] == "function"
```

`stream` is threaded through `renderHelp` to **both** `printVerbHelp` and the `printHelp` fallback, preserving `printHelp`'s existing `stream = process.stdout` injection contract (skillctl's `printHelp` has a `stream` param; netops's does not — this is a skillctl-specific seam the port must not drop).

---

## Implementation Units

### U1. Parameterized `strings.help.verb.*` catalog

**Goal:** Add an 11-key verb-help catalog inside the frozen `strings.help`, each a `(params) => string` renderer threading product identity.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Modify: `scripts/installer/cli/strings.mjs`

**Approach:**
- Add `verb: Object.freeze({ install, uninstall, update, list, plan, agents, doctor, repair, export, import, validate })` co-declared *inside* the existing `help: Object.freeze({...})` literal (after `examplesBlock`), so the freeze covers it.
- Each key: `({ binName, prefix, adapterList }) => \`...\`` rendering: `<binName> <verb> — <one-liner>` / `Usage:` / `Flags:` (verb-scoped subset drawn from the existing `flagsBlock` catalog) / optional one-line notes / `Example(s):` / trailing `Run '<binName> help' for the complete reference.`
- One-liners reuse the descriptions already in `verbsBlock`; flag subsets are the verb-relevant rows of `flagsBlock` (e.g. `install` → agent/skill/bundle/all/mode/target/overwrite/allow-no-cli/dry-run/yes/json; `list` → agent/json; `validate` → json).
- No `Common flags:` header in any verb block (that sentinel must remain unique to full help — it is the test discriminator).

**Patterns to follow:**
- `scripts/installer/cli/strings.mjs` existing `help.*` function-key shape and freeze.
- `~/workspace/netops-agent-skills/scripts/installer/cli/strings.mjs:95-282` for block structure (adapt no-arg → parameterized).

**Test scenarios:**
- Happy path: each of the 11 verbs has a `typeof === "function"` renderer; calling it with `{binName:"x",prefix:"p",adapterList:"a | b"}` returns a non-empty string naming the verb. (Covered by U4.)
- Edge case: no verb block contains the `Common flags:` substring. (Covered by U4.)
- Edge case: rendered output contains the passed `binName`, not any literal `skillctl`/`netops` string.

**Verification:**
- `strings.help.verb` exists, frozen, 11 keys, all functions; full suite green.

---

### U2. `renderHelp` / `printVerbHelp` / `hasVerbHelp` in `help.mjs`

**Goal:** Add the shared routing decision + verb renderer, parameterized off `productConfig`, leaving `printHelp` untouched.

**Requirements:** R1, R2, R3, R4

**Dependencies:** U1

**Files:**
- Modify: `scripts/installer/cli/help.mjs`

**Approach:**
- Keep `printHelp` exactly as-is (full-render primitive, R2 guard).
- Add `hasVerbHelp(verb)`: `typeof verb === "string" && verb !== "help" && typeof strings.help.verb?.[verb] === "function"`.
- Add `printVerbHelp({ verb, productConfig, version, adapters, stream = process.stdout })`: resolve `strings.help.verb[verb]`, invoke with `{ binName: productConfig.binName, prefix: productConfig.skillIdPrefix, adapterList: adapters.join(" | ") }`, write to `stream`. **The `stream = process.stdout` default is mandatory** — it mirrors `printHelp` (help.mjs:20) and is the seam the U4 `capture()` tests + the U3 cli.mjs call site (which passes no `stream`) both depend on.
- Add and export `renderHelp({ args, productConfig, version, adapters, stream = process.stdout })` implementing the decision in High-Level Technical Design. **`renderHelp` MUST carry the `stream = process.stdout` default too** (its only production caller, the U3 cli.mjs site, passes no `stream`; without the default `stream` is `undefined` and the verb-help path does `undefined.write(...)` → TypeError on every real `<bin> <verb> --help`). `stream` is then threaded to **both** `printVerbHelp` (verb path) and `printHelp` (full-help fallback) so `printHelp`'s existing injection contract is preserved end-to-end. netops's `printHelp`/verb renderers have no `stream` param, so the port reference does not exercise this seam — do not copy its no-stream shape; the two defaults (`renderHelp`, `printVerbHelp`) are a single load-bearing invariant, not two independent choices.
- Mirror the netops doc-comment that states the shared-decision rationale (both entry points route identically; caller owns its own exit/return).

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/cli/help.mjs` (adapt: thread `productConfig` instead of no-arg; keep skillctl's `stream` param convention from `printHelp`).

**Test scenarios:**
- Happy path: `renderHelp` with `{help:true, verb:"install"}` → output matches `/install/`, excludes `Common flags:`. (U4)
- Happy path: `{verb:"help", positional:["uninstall"]}` → matches `/uninstall/`, excludes `Common flags:`. (U4)
- Edge case: `{verb:"help", positional:[]}` and `{help:true, verb:null}` → include `Common flags:` (full body). (U4)
- Edge case: `{help:true, verb:null, positional:["frobnicate"]}` and `{verb:"help", positional:["frobnicate"]}` → full body, no throw. (U4)
- Integration: `renderHelp` verb path emits exactly `strings.help.verb.<verb>({...})` output with no wrapping. (U4)
- Edge case (regression guard for the stream-default invariant): `renderHelp({ args:{help:true,verb:"install"}, productConfig, version, adapters })` called with **no `stream` key** does NOT throw and routes to `install` verb help — proves the `renderHelp`/`printVerbHelp` `= process.stdout` defaults are present (this is the exact U3 cli.mjs call shape). (U4)

**Verification:**
- `renderHelp` exported from `help.mjs`; `printHelp` byte-output for the full path unchanged; suite green.

---

### U3. Route `cli.mjs` through `renderHelp` + export from `index.mjs`

**Goal:** Swap the single help-routing site to `renderHelp`; expose `renderHelp` as an additive public export.

**Requirements:** R1, R2, R4

**Dependencies:** U2

**Files:**
- Modify: `scripts/installer/cli/cli.mjs`
- Modify: `scripts/installer/index.mjs`

**Approach:**
- In `cli.mjs`, replace the `cli.mjs:84-87` block: still gate on `args.help || args.verb === "help"`, but call `renderHelp({ args, productConfig, version: ctx.version, adapters: adapterIds })` instead of `printHelp(...)`, then `process.exit(0)`. Import `renderHelp` alongside `printHelp`. **This call site intentionally passes no `stream`** — correctness depends on `renderHelp`'s `stream = process.stdout` default (U2); the U2 regression-guard test asserts exactly this call shape does not throw.
- The unknown-verb fallback at `cli.mjs:95` (`printHelp` after `dispatchVerb` returns false) stays `printHelp` — that path has no `args.help` and is the genuine "unknown verb, show everything" case (R2).
- In `index.mjs`, add `export { printHelp, renderHelp } from "./cli/help.mjs";` (additive; `printHelp` retained).

**Patterns to follow:**
- `scripts/installer/cli/cli.mjs` existing import + routing structure; `scripts/installer/index.mjs:14` export line.

**Test scenarios:**
- Integration: `createCli().run([... ,"install","--help"])`-shaped invocation routes to verb help (asserted via the dispatch/cli test surface or an E2E witness in U4).
- Happy path: `renderHelp` is importable from `scripts/installer/index.mjs`.
- Edge case: unknown verb (no `--help`) still falls back to full help, exit 0 (unchanged behavior).

**Verification:**
- `import { renderHelp } from "scripts/installer/index.mjs"` resolves; existing `dispatch.test.mjs`/`argv.test.mjs`/`sample-bin.test.mjs` stay green.

---

### U4. `help.test.mjs` routing coverage

**Goal:** Add a new routing-focused test suite (the verb-help **routing** coverage, distinct from the ADR-0004-deferred product-coupled sweep).

**Requirements:** R1, R2, R3, R4

**Dependencies:** U1, U2, U3

**Files:**
- Create: `scripts/installer/cli/help.test.mjs`
- Modify (**mandatory**): `examples/sample-product/sample-bin.test.mjs` — no longer optional: it is the only layer that can assert the `<verb> help` reverse-order behavior and the only true E2E proof the routing reaches a real `createCli` bin.
- Modify: `package.json` — add a `test:help` per-suite script AND append `scripts/installer/cli/help.test.mjs` to the `test` aggregate. The `test` script is a **hand-maintained explicit space-separated file list passed to `node --test`** (no glob / no auto-discovery). Omitting the append makes `npm test` and the pre-commit hook silently never run the new suite — a false-green that defeats the R2 regression guard. Both edits are mandatory. **Sequencing (resolves the U4/U7 same-file hazard):** this `package.json` edit must NOT be committed standalone — staged-and-uncommitted until it lands in U7's single commit alongside the version bump + `v0.3.0.md`. Committing it before U7 trips the pre-commit `lint:release-sync` (still 0.2.0, no v0.3.0 note). The whole plan ships as one atomic PR (see Risks); there are no intermediate commits, so "mandatory edit" and "no standalone commit" are jointly satisfiable.

**Approach:**
- Port the netops `help.test.mjs` case *set* (the routing scenarios), NOT its call shapes. Two netops cases cannot be ported verbatim because skillctl's strings shape differs and renderers are parameterized:
  - netops `strings.help.verb[v]()` is **no-arg**; skillctl's is `({binName,prefix,adapterList}) => …`. Calling it no-arg interpolates the literal string `"undefined"` and can still pass a naive `match(/verb/)` assertion while the help is silently corrupted. Every renderer call in the test MUST pass a stub `productConfig` (`{ binName, skillIdPrefix }`) + `adapters`, and the per-verb case MUST assert the rendered output contains the stub `binName` and contains no literal `skillctl`/`netops`.
  - netops test #37 calls `strings.help.full({...})` directly. **skillctl has no `strings.help.full` key.** Replace that case with a `printHelp({ productConfig, version, adapters, stream })` invocation asserting the composed body contains the header, `Verbs:`, and `Common flags:` — `printHelp` IS skillctl's full-body surface. Do not port the netops `strings.help.full` direct-call case.
- Sentinel `FULL_ONLY = "Common flags:"` (skillctl's `flagsBlock` emits it exactly once; verb blocks must not — U1 forbids it).
- Cases: every production verb has a non-empty parameterized renderer naming the verb, containing the passed `binName`, and excluding `FULL_ONLY`; `printHelp(...)` composed output renders header+`Verbs:`+`Common flags:` (the full-body regression guard — there is no `strings.help.full`); `<verb> --help` routes to verb help; `help <verb>` routes via `args.positional[0]`; bare `help` → full; `--help` no verb → full; unknown `frobnicate --help` → full (no throw); `help frobnicate` → full; verb path emits exactly the catalog output (no wrapping); `printHelp` still emits full body (byte-path regression guard).
- **`<verb> help` reverse-order is NOT a `help.test.mjs` case.** That behavior lives in the `cli.mjs` gate (`if (args.help || args.verb === "help")`), not in `help.mjs`/`renderHelp` — `help.test.mjs` imports only `help.mjs` and structurally cannot assert the gate state. Cover it instead via a **mandatory** `spawnSync` E2E in `sample-bin.test.mjs`: `<sample-bin> install help` exits as an `install` invocation (positional `["help"]`), NOT verb help — assert stdout is not the `install` usage block / does not match the verb-help shape. This is the only layer where the reverse-order claim is enforceable.
- Use the netops `capture()` stdout-swap helper. `capture()` works by temporarily replacing `process.stdout`; tests MUST omit an explicit `stream` so `renderHelp`/`printVerbHelp`'s `= process.stdout` default resolves to the (now-swapped) global. This is the correct way to exercise the stream-defaulting contract — it proves the default path works, NOT that stream threading is absent (it does not contradict U2's stream-threading requirement; the two describe the same invariant from opposite ends).
- **Mandatory E2E witnesses in `sample-bin.test.mjs`** (two `spawnSync` assertions): (1) `<sample-bin> install --help` stdout matches `/install/` and excludes `Common flags:` (verb help reaches a real `createCli` bin); (2) `<sample-bin> install help` behaves as an `install` invocation, NOT verb help (reverse-order claim — the only enforceable layer for it, per the `<verb> help` note above).

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/cli/help.test.mjs` (structure + `capture` helper + the 10 case set).
- `package.json` existing `test:*` per-suite scripts + `node --test` convention (no Jest/Vitest).

**Test scenarios:**
- This unit *is* the test suite; scenarios are enumerated in Approach. All 10+ cases must pass; `npm test` aggregate green; `npm run lint:release-sync` unaffected.

**Verification:**
- `npm test` output explicitly lists `help.test.mjs` as executed (confirm the file was appended to the aggregate — a green `npm test` that never ran the suite is the failure mode); all routing cases pass; no other suite regresses.

---

### U5. Kernel-generic agent CLI contract doc + sample-product pointer

**Goal:** Author a product-agnostic agent-facing CLI contract doc and point it at the worked example.

**Requirements:** R5

**Dependencies:** None (doc-only; references the 11 verbs which already exist)

**Files:**
- Create: `docs/AGENT-CLI-CONTRACT.md`
- Modify: `examples/sample-product/bin.mjs` (add a short header-comment pointer to the contract doc) — pointer only, no behavioral change.

**Approach:**
- Structural skeleton borrowed from netops `INSTALL-FOR-AGENTS.md` headings only: Preconditions / Non-interactive contract / Exit-code contract / Behavioral contract. Content fully kernel-generic.
- Cover: the 11 `KERNEL_HANDLERS` verbs and their purpose (sourced from the README Verbs table / `verbsBlock`); `--yes`/`-y` requirement for non-interactive `install`/`uninstall`; `--json` machine-readable envelope; exit-code contract (0 success / non-zero typed failures / 130 cancelled — sourced from `cli.mjs` catch block + `error-format.mjs`); the `<bin> <verb> --help` discoverability path this plan adds; the explicit statement that bin name / skill prefix / manifest filename are product-supplied via `ProductConfig` (so the doc never hardcodes a bin name).
- **Help-affordance contract (explicit):** only `<bin> <verb> --help` and `<bin> help <verb>` produce verb usage. `<bin> <verb> help` (verb-first, `help` as a positional) does NOT — it runs the verb handler with `help` as an argument. State this so agents never emit the unsupported reverse form expecting usage text.
- Worked-example section: point at `examples/sample-product/bin.mjs` as the concrete `createCli` instantiation an agent can run (`node examples/sample-product/bin.mjs <verb> --json`).
- Explicit non-content note: this doc is the kernel-generic contract; it is intentionally NOT netops `INSTALL-FOR-AGENTS.md` (tag resolution / npx-git / tarball mirror / skill-trigger / platform depth are product concerns, see ADR-0006).

**Patterns to follow:**
- `~/workspace/netops-agent-skills/docs/INSTALL-FOR-AGENTS.md` headings as a *skeleton only* (do not copy product content — ADR-0004/0006 boundary).
- skillctl `docs/` flat-file convention; repo-relative links.

**Test scenarios:**
- Test expectation: none — documentation unit, no behavioral change. Correctness verified by U7 cross-reference review and the no-netops-content boundary check.

**Verification:**
- `docs/AGENT-CLI-CONTRACT.md` exists, references all 11 verbs, hardcodes no bin name, links `examples/sample-product/bin.mjs`, and states the netops-exclusion boundary.

---

### U6. README install-reality fix + accuracy edits + LLM-agent section (both locales)

**Goal:** Correct the install instructions to ADR-0005 reality, fix the three correlated stale-accuracy spots (Public API table, Status, Roadmap), and add an LLM-agent pointer section, in `README.md` and `README.zh-CN.md`.

**Requirements:** R6

**Dependencies:** U3 (Public API table must list the `renderHelp` export U3 adds), U5 (the LLM section links the contract doc)

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Approach:**
- Replace the `## Install` block's `npm install skillctl` with the ADR-0005 distribution reality: git tag / git-dependency (`package.json` git URL pinned to a `v<x.y.z>` tag) / vendor copy; keep the Node ≥ 18 / ESM line.
- **Public API table (two-row edit):** (a) add `renderHelp` to the CLI-primitives row alongside `printHelp` (it is now an `index.mjs` export — U3); (b) **remove `pipeline` (and `ERR_PIPELINE_*` if listed) from the Manifest-pipeline row** — `pipeline.*` was deleted per ADR-0004 and is not in `index.mjs`, so the current table documents a non-existent export. Both corrections are required for the table to be accurate (the entire point of widening U6); fixing only (a) leaves a known-false row shipped.
- **Status line (full-sentence rewrite, not a one-hop bump):** the README currently says `v0.1.0 — first OSS release. API surface is stable; …` but `package.json` is **already 0.2.0** with `docs/release-notes/v0.2.0.md` shipped — so "first OSS release" is itself false today, independent of this plan. Replace the whole Status sentence: read `v0.3.0`, drop "first OSS release" (v0.2.0 already shipped), drop the "API surface is stable" overclaim (ADR-0005: contract clock has not started — say "pre-1.0, expect iteration" instead). This is a two-version correction; a literal `v0.1.0`→`v0.3.0` find-replace would leave the false "first OSS release" framing intact.
- **Roadmap (bounded edit):** replace **only the `v0.2.0` bullet's text** — do not add, remove, or reorder any other Roadmap bullet (bullet count unchanged). The current bullet promises npm-subpath exports / npm publish, but (a) ADR-0005 defers npm entirely and (b) `package.json` `exports` **already ships** the `./adapters/*` subpaths and v0.2.0 already released — so the bullet is doubly stale (wrong version label + items partly shipped). Rewrite it to the unpublished-kernel reality (git/tag/vendor distribution; npm deferred until the ADR-0005 name+publish decision) and cite `ADR-0005` in the text so `lint:release-sync`'s historical-cue heuristic suppresses the advisory. Reconcile against what v0.2.0 actually delivered — do not re-list shipped subpath work as future.
- Leave the npm-version *badge* as-is (ADR-0004 deviation note records it as a dynamic shields.io badge, known-wrong-but-tolerated, cannot drift — explicitly out of scope to re-litigate; distinct from the prose Status line which IS corrected).
- Add a `## For LLM Agents` (zh-CN: `## 给 LLM Agent`) section: one short paragraph + a link to `docs/AGENT-CLI-CONTRACT.md` and the `examples/sample-product/bin.mjs` worked example.
- Keep both locale files semantically in sync (same structural changes, translated copy) — locale parity is a hard requirement.

**Patterns to follow:**
- Existing `README.md` / `README.zh-CN.md` section style and bilingual parity.
- ADR-0005 wording for the distribution model; ADR-0004 deviation note for the badge-vs-prose distinction.

**Test scenarios:**
- Test expectation: none — documentation unit. Verified by U7 review: no `npm install skillctl` remains in either README; Public API table lists `renderHelp` AND no longer lists `pipeline`/`ERR_PIPELINE_*`; Status says v0.3.0 with no "first OSS release" / "API stable" wording; the Roadmap edit changed only the v0.2.0 bullet text (same bullet count) and cites ADR-0005; both link the contract doc; both locales in parity.

**Verification:**
- Neither README instructs `npm install skillctl`; both Public API tables list `renderHelp` and omit `pipeline`/`ERR_PIPELINE_*`; both Status lines read v0.3.0 without "first OSS release" or the stability overclaim; both Roadmaps changed only the v0.2.0 bullet text (bullet count identical to pre-edit) and reference ADR-0005; both contain the LLM-agent section; `README.md` and `README.zh-CN.md` are structurally in sync.

---

### U7. ADR-0006 + v0.3.0 release note + version bump

**Goal:** Record the contract-doc scope boundary, cut the release note, bump the version, keep `lint:release-sync` green.

**Requirements:** R7

**Dependencies:** U1, U2, U3, U4, U5, U6 (release note describes the shipped set)

**Files:**
- Create: `docs/adr/0006-kernel-generic-agent-cli-contract-doc-boundary.md`
- Create: `docs/release-notes/v0.3.0.md`
- Modify: `package.json` (`version` 0.2.0 → 0.3.0)

**Approach:**
- ADR-0006 (accepted, dated 2026-05-18): records that the kernel ships a *product-agnostic* agent CLI contract doc, distinct from and complementary to netops `INSTALL-FOR-AGENTS.md` (excluded by ADR-0004 as product-private); states the structural-skeleton-only borrowing; corrects the "delivers a deferred ADR-0004 follow-up" misframing (it is new complementary work, not a recorded deferral); references ADR-0004 and ADR-0005. Follow the `docs/adr/0001..0005` frontmatter + section format.
- `v0.3.0.md`: verb-scoped progressive help (kernel cli capability, parameterized off `ProductConfig`); new `renderHelp` public export (additive, backward-compatible); new `docs/AGENT-CLI-CONTRACT.md`; README install-reality + accuracy corrections (install block, Public API table, Status, Roadmap — both locales); ADR-0006. Note for vendor consumers: `printHelp` behavior unchanged; composed full-help body byte-preserved.
- Bump `package.json` to `0.3.0` so `lint:release-sync` (semver: package version == newest `docs/release-notes/v*.md`) passes; `"private": true` stays (ADR-0005).

**Patterns to follow:**
- `docs/adr/0004-absorption-provenance-netops-tier-1-2.md` (provenance-recording ADR shape).
- `docs/release-notes/v0.2.0.md` (release-note shape).
- `scripts/lint-release-sync.mjs` semver-equality contract.

**Test scenarios:**
- Happy path: `npm run lint:release-sync` exits 0 (package `0.3.0` == newest release note `v0.3.0`).
- Edge case: pre-commit hook (`npm test` + release-sync) passes with the bumped version + new note present.

**Verification:**
- `lint:release-sync` green; ADR-0006 + `v0.3.0.md` present and cross-referenced; `npm test` green.

---

## System-Wide Impact

- **Interaction graph:** Only the `cli.mjs` help-routing site changes behavior. `dispatchVerb`, `parseArgs`, all `run.mjs` handlers, every adapter, and the entire `core/` layer are untouched. The Z-layer guard (`architecture.test.mjs`) is unaffected (`help.mjs`/`cli.mjs` stay in `cli/`, import only `strings.mjs`/`core` as before).
- **Error propagation:** Unchanged. Help rendering never throws on unknown input — it falls back to full help (R2); the `cli.mjs` try/catch around dispatch is not in the help path.
- **State lifecycle risks:** None. No filesystem, no state.json, no manifest interaction in any unit.
- **API surface parity:** `index.mjs` gains `renderHelp` (additive, pre-publish per ADR-0005 — not a frozen-contract commitment). `printHelp` signature/behavior preserved — existing consumers and the sample bin are unaffected.
- **Integration coverage:** The unit-level `help.test.mjs` proves `renderHelp`/`printVerbHelp` routing in isolation; the **mandatory** `sample-bin.test.mjs` spawn witnesses are the only proof that (a) a real `createCli`-wrapped bin reaches verb help and (b) `<verb> help` reverse-order stays a handler invocation (the `cli.mjs` gate is untestable from `help.test.mjs`).
- **Unchanged invariants:** the `printHelp`-composed full-body bytes (`strings.help.{header,usage,verbsBlock,flagsBlock,examplesBlock}`); `printHelp` full-render path + its `stream` injection contract; `argv.mjs` parse output; ProductConfig contract; the Z three-layer import directions.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A verb block accidentally contains `Common flags:`, breaking the test discriminator and confusing the full/verb distinction | U1 explicitly forbids the substring in verb blocks; U4 asserts its absence for all 11 verbs |
| Full-help body drifts during the routing swap (silent regression) | `printHelp` and its five `strings.help.*` blocks are left strictly untouched; U4 includes a `printHelp`-composed full-body regression case (substring guard, not a byte oracle — byte oracle is ADR-0004 Tier-2-deferred) |
| Parameterization missed somewhere → a literal bin name leaks into a downstream product's help | U1 test asserts rendered output contains the passed `binName` and no literal `skillctl`/`netops`; renderers are pure functions of params |
| Contract doc drifts toward netops product specifics, violating the ADR-0004 boundary | U5 carries an explicit non-content note; ADR-0006 records the boundary; U7 review checks for absence of tag/npx/tarball/skill-trigger content |
| README locale divergence (English fixed, zh-CN left stale) | U6 treats both files as one unit with a parity check in Verification |
| `lint:release-sync` fails in pre-commit if version bump and release note are not landed together | U7 bundles version bump + `v0.3.0.md` in one unit; ordered last so it describes the actual shipped set |
| U4 and U7 both edit `package.json` (U4: `test`/`test:help`; U7: `version`). A mid-plan commit after U4 but before U7 trips the pre-commit `lint:release-sync` (still 0.2.0, no v0.3.0 note) | Treat U1–U7 as one atomic PR (no intermediate commits); U7 is the last unit and lands the version+note in the same commit set as everything else — the two `package.json` edits are not independently committable |

---

## Documentation / Operational Notes

- No runtime, rollout, or monitoring impact — this is cli-surface + docs only.
- Distribution stays git-tag/vendor per ADR-0005; consumers pulling `v0.3.0` get the additive `renderHelp` export and verb help with no migration. `printHelp` unchanged → zero-action upgrade for existing thin bins.
- CLAUDE.md "Test scope" note: the ADR-0004 deferred product-coupled `help`/`strings` sweep remains deferred; this plan's `help.test.mjs` is the narrower routing suite and does not discharge that follow-up.

---

## Sources & References

- Related ADRs: `docs/adr/0004-absorption-provenance-netops-tier-1-2.md`, `docs/adr/0005-release-model-no-npm-provisional-name.md`
- Related code: `scripts/installer/cli/help.mjs`, `scripts/installer/cli/strings.mjs`, `scripts/installer/cli/cli.mjs`, `scripts/installer/cli/argv.mjs`, `scripts/installer/cli/dispatch.mjs`, `scripts/installer/index.mjs`, `examples/sample-product/bin.mjs`
- Porting reference (separate local repo, not a dependency): `~/workspace/netops-agent-skills/scripts/installer/cli/{help,strings,help.test}.mjs`, `~/workspace/netops-agent-skills/docs/INSTALL-FOR-AGENTS.md` (skeleton only)
- Prior plan: `docs/plans/2026-05-18-001-feat-absorb-netops-spi-v11-and-release-discipline-plan.md`
