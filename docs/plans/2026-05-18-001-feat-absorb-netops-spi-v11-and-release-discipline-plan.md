---
title: "feat: Absorb netops fork Tier 1+2 — SPI v1.1 content-transform, stage-asset dedup, release-sync lint, test rebuild, ADR practice"
type: feat
status: active
date: 2026-05-18
---

# feat: Absorb netops fork Tier 1+2 into the OSS kernel

## Summary

skillctl forked from the netops-agent-skills internal product at its v0.5.1 — *before* that downstream evolved an adapter content-transform capability, deleted its dormant two-tier `pipeline.*` namespace, added a release-sync lint and a comprehensive test suite, and adopted an ADR practice (now at v0.10.0). This plan absorbs the product-agnostic, kernel-level subset of that evolution back into the OSS kernel: SPI v1.0→v1.1 with a `transformAssetContent` adapter hook, a `core/stage-asset.mjs` primitive that deduplicates the three live staging sites and enforces the cross-stage hash invariant, **deletion of the dormant `pipeline.*` namespace** (adopting the downstream's terminal single-tier decision rather than re-investing in a path it already audited and removed), a stripped-down `lint-release-sync`, a layered test-suite rebuild bound to `examples/sample-product/`, and a `docs/adr/` decision record practice.

---

## Problem Frame

The kernel has three structural gaps relative to its own more-evolved downstream:

1. **No content-transform seam.** Adapters can remap *paths* (`mapTargetPath`) but never *content*. Every install writes source bytes verbatim. The shipped `opencode` adapter cannot install `agent` assets at all — it hard-drops `"agent"` from `supportedAssetTypes` because Claude-Code agent frontmatter (`tools:`, `model:`, `color:`) makes OpenCode's startup validator reject the file. A kernel that claims three-platform reach silently can't deliver agents to one of the three.
2. **Three live staging sites duplicate the same shape; a fourth is dormant dead weight.** `commands/index.mjs:255/665/950` (install/update/repair) each inline the same `readFileSync → stageWrite` shape with no transform and no stage-time hash; `repair` never re-hashes at all (keeps the prior `state.json` sha256). A fourth site, `pipeline.mjs:351` (`stageStage`), has **zero internal callers** — `commands.install` inlines its own staging and does not route through `pipeline.stage`; only `index.mjs` re-exports `pipeline`. This is the same never-activated, interrupted-migration two-tier namespace the more-evolved downstream audited and **deleted** (netops ADR-0004), committing to a single-tier installer. The moment a content transform exists, the recorded sha256 diverges from on-disk bytes on the live sites and `update`/tamper-detection misfire.
3. **No enforced release or decision hygiene.** `docs/adr/` and `docs/release-notes/` do not exist yet (only `docs/plans/`, which holds this plan). CLAUDE.md asserts invariants (SPI v1 frozen identity fields, the Z three-layer import rule, manual versioning, per-tag release notes) with no recorded rationale and no mechanical check that a version bump moved the docs that must move with it. The downstream already hit and structurally fixed this exact drift class.

The downstream solved 1 across two plans (`2026-05-14-001` introduced SPI v1.1 + `applyAdapterTransform`; `2026-05-15-001` extracted the stage-asset triplet for its three command sites), resolved 2 by **deleting `pipeline.*` entirely** (netops ADR-0003 *deferred* the pipeline fate; ADR-0003 was then **superseded by ADR-0004**, which deleted the namespace and committed to single-tier — netops never wired a fourth site, it removed it), and solved 3 via ADR-0006 + `lint-release-sync.mjs`. skillctl is pre-all-three. Absorbing the *terminal* downstream state therefore means: land the SPI v1.1 + stage-asset combination over the three live sites, **delete the dormant `pipeline.*` namespace to match the downstream's single-tier conclusion**, and port the release/test/ADR hygiene.

---

## Requirements

- R1. SPI gains an optional `transformAssetContent(asset, body: Buffer) => Buffer` hook with an identity default; existing adapters work unchanged; SPI version markers move to v1.1. Frozen Adapter-SPI-v1 identity fields are not touched.
- R2. A new `core/stage-asset.mjs` exposes `stageAsset` (transform + hash + stageWrite, `stage:"stage"`) and `hashTransformed` (transform + hash, no write, `stage:"plan"`), composing a new `core/plan.mjs:applyAdapterTransform` primitive.
- R3. The three live staging sites (install/update/repair) route through `stageAsset`; `buildInstallPlan` hashes the *transformed* buffer via `hashTransformed`. The dormant `pipeline.*` namespace is deleted (no fourth site remains), removing `pipeline` and the `ERR_PIPELINE_*` codes from the public surface. The cross-stage hash invariant holds on every remaining write path including `repair`: `state.json` sha256 == `hashFile(on-disk file)` for transformed and untransformed assets alike.
- R4. The shipped `opencode` adapter implements `transformAssetContent` (Claude→OpenCode agent frontmatter rewrite, frontmatter-only, body bytes unchanged) and re-admits `"agent"` to its `supportedAssetTypes`.
- R5. A product-agnostic `scripts/lint-release-sync.mjs` enforces, by semver (not lexical): `package.json` version == newest `docs/release-notes/v*.md`, plus the advisory stale-prose heuristic. The netops-private four-manifest lockstep is stripped. `docs/release-notes/` is scaffolded with a backfilled `v0.1.0.md`.
- R6. The kernel test suite is rebuilt to a layered subset bound to `examples/sample-product/`: SPI-bearing units carry their own tests, zero-product-coupling module tests are ported near-verbatim, and `validator`/`drift` tests are adapted to the sample fixture. Product-coupled tests are explicitly deferred.
- R7. `docs/adr/` is established. ADRs record: the ADR practice + SPI-v1 freeze + Z-layer rationale; the content-transform hook decision; the adopt-downstream-single-tier (`pipeline.*` delete) decision; and the absorption provenance (what Tier 1+2 was/wasn't taken from the fork and why, anchored to the downstream's terminal v0.10.0 state).
- R8. Architecture invariants hold throughout: `architecture.test.mjs` Z-layer rules green; pure JS/ESM `.mjs` only (no ts/tsx); `node --test` only (no Jest/Vitest); ProductConfig/Adapter-SPI-v1 frozen fields unbroken.

---

## Scope Boundaries

- Not absorbing any netops product content: `skill-collector` / `skill-analyzer` / `skill-absorber` / `skill-forge` lifecycle, `PROVENANCE.md` / `ABSORBED.md`, the promotion checklist, `netops-lint-config.mjs`, `INSTALL-FOR-AGENTS.md` content, the four-manifest version lockstep, and the "version-agnostic explainer" invariant. These were stripped at the OSS fork by design and do not flow back. The *patterns* may be demoed later in `examples/sample-product/` but are out of this plan.
- Not absorbing `verify-baseline.mjs` (byte-baseline regression oracle). It is Tier-2-but-deferred: coupled to a fixed command list + bin name, lower value until the kernel CLI surface stabilizes. Listed under Deferred to Follow-Up Work.
- No body-content rewriting in `transformAssetContent` (no `~/.claude → ~/.config/opencode` path munging). Frontmatter only, per ADR-0002 D3. Body bytes pass through byte-identical.
- No publish-time hard gate. `lint-release-sync` is read-only and standalone (manual / pre-commit), never imported by or wired into release tooling — same posture as the downstream's deferred ADR-0006 D3 (publish-gate integration).
- `lint-release-sync` does not ship without a written spec for its assertions. netops ADR-0006 D1 makes a release-process contract the single source of truth and D2 the lint that enforces its machine-assertable subset; ADR-0006 explicitly rejects "lint only, no contract doc". skillctl's assertion set is small (version == newest release note; advisory stale-prose), so the spec is folded into ADR-0001's release-discipline section + the backfilled `v0.1.0.md` rather than a separate `docs/release-process.md` — a deliberate D1-compression, recorded, not a silent D2-without-D1.
- No `CHANGELOG.md`; no automatic semver tool. The repo's existing manual-versioning + per-tag-release-note conventions are honored, not replaced.
- The dormant `pipeline.*` namespace is **deleted**, not kept-and-wired and not kept-but-skipped. Keeping it (either wiring a fourth `stageAsset` site or accepting a known invariant gap on the public `pipeline.stage` path) is an explicit non-goal: it re-creates the two-tier debt the more-evolved downstream already audited and removed (netops ADR-0004).

### Deferred to Follow-Up Work

- Product-coupled test rebuild — extended `loader`, `commands`, `cli`, `help`, `strings`, `prompts` module tests adapted to `sample-product`: a follow-up sweep as the sample fixture stabilizes (matches the CLAUDE.md "rebuilt as that fixture stabilizes" commitment).
- `verify-baseline.mjs` byte-baseline oracle, parameterized to the sample bin: separate plan once the CLI output surface is declared stable.
- `examples/sample-product/` demonstrating the agent-install-contract / product-lint-config *patterns*: separate docs/example PR.

---

## Context & Research

### Relevant Code and Patterns

- `scripts/installer/core/plan.mjs` — `defaultTargetMapping` (only adapter seam today, path-only); `buildInstallPlan` builds plan entries `{sourceAbs, targetRel, assetType, sha256, algo, normalization, bytes, …}` where the hash is the **source** hash (`hashFile(sourceAbs)` at ~:137/:167/:200). No transform concept exists. `applyAdapterTransform` is the new primitive's home.
- `scripts/installer/core/filesystem.mjs` — `hashBytes(buf,{extension,forceByteExact})` (text → LF-normalized hash + `normalization:"text-lf-v1"`; binary/non-text-ext → raw + `"byte-exact"`; `bytes` is always *raw* length), `stageWrite`, `makeStagingDir`, `promoteStagedFiles` (rename, no re-hash). `stageAsset` composes `hashBytes` + `stageWrite`.
- `scripts/installer/cli/commands/index.mjs:255` (install), `:665` (update persist), `:950` (repair) — three inline staging sites. `:617` `newHash = hashFile(sourceAbs)` feeds `update`'s state write; install state write maps plan-entry source hashes; repair never re-hashes (comment ~:955).
- `scripts/installer/core/pipeline.mjs` — the dormant two-tier namespace (`stageStage` at :343-355 et al.). **Zero internal callers**: `commands.install` inlines its own staging and does not route through `pipeline.stage`; the only references are the `index.mjs` public re-export and the architecture-test gate. This is the deletion target (matches netops ADR-0004). A pre-delete grep for non-test, non-re-export consumers gates U5.
- `scripts/installer/adapters/spi.mjs` — SPI v1: `SPI_REQUIRED` (4 frozen identity fields), `SPI_DEFAULTS` (6 optional + kernel defaults), `applyDefaults` injected inside `createAdapterRegistry`. New optional field auto-defaults for all adapters. `adapters/README.md` is the SPI contract doc (declares v1).
- `scripts/installer/adapters/opencode.mjs` — `supportedAssetTypes:["skill","rule"]` (no `"agent"`); own `mapTargetPath` (agent → `agent/<installedName>.md`); header comment already describes the OpenCode frontmatter incompatibility. Landing site for the absorbed transform.
- `scripts/installer/core/state.mjs` — `managedFiles[]` entry records `{sha256, algo, normalization:"text-lf-v1"|"byte-exact", bytes, …}`; `validateState` enforces the sha256/algo/normalization shape; `writeStateAtomic` refuses invalid state. The invariant target.
- `scripts/installer/architecture.test.mjs` — `ALLOWED` map (`core→core`, `adapters→core|adapters`, `cli→core|cli|adapters`, `index→all`); the public-symbol assertion list (extend when adding a public symbol). `core/stage-asset.mjs` is `core` → may import only `core`.
- `examples/sample-product/` — fixture the rebuilt tests bind to: 2 skills, 1 agent (`agents/sample-example-agent.md`, Claude-style frontmatter — exactly the transform target), 1 rule, 1 bundle (`sample-demo` fans skill → agent + rule). `agent-skills.config.mjs` defines the `ProductConfig`.

### Institutional Learnings

skillctl has no `docs/solutions/`. The authoritative learnings are the downstream's recorded decisions, treated as the blueprint:

- **netops ADR-0002** (`~/workspace/netops-agent-skills/docs/adr/0002-adapter-content-transform-via-spi-hook.md`) — D1 (SPI hook, identity default, `ERR_TRANSFORM_FAILED` with `.details={adapterId,assetId,assetType,stage,cause}`), D2 (plan **and** stage both invoke the transform via a shared helper; no Buffer cached on plan entries — plans stay JSON-serializable; transform re-runs, cost <1ms/file, exercises idempotency), D3 (frontmatter-only; body byte-preserved; rationale: mechanical body rewrite corrupts source-CLI-path references).
- **netops plan 2026-05-15-001** — the stage-asset extraction: module naming (`stage-asset.mjs` = noun, distinct from filesystem.mjs staging-dir verbs), signature `({asset,adapter,stagingDir,targetRel}) → {sha256,algo,normalization,bytes,transformed}`, hardcode `stage:"stage"`, no new error class (pass through `AdapterError`/`FsError`). The invariant witness model in netops's *terminal* state is **single-witness** — `stage-asset.test.mjs` + a `commands` E2E; the earlier `pipeline.test.mjs` witness was deleted with the namespace in ADR-0004. skillctl mirrors the terminal model (no pipeline-side witness, because no pipeline).
- **netops ADR-0006** — release-discipline rationale: the structural lever is a *mechanical* read-only check, not a human checklist; semver-not-lexical is load-bearing (v0.10.0 > v0.9.0); a release-process contract (D1) is the SSOT the lint (D2) enforces; the publish-time hard gate (D3) is a deliberately separate deferred concern.
- **netops ADR-0003 → ADR-0004 (pipeline fate):** ADR-0003 *deferred* the `pipeline.*` namespace fate to a later audit; it is marked **Superseded by ADR-0004**, which **deleted** `pipeline.mjs` (entire file), its public re-export, the `ERR_PIPELINE_*` codes, and `pipeline.test.mjs`, committing to a single-tier installer. The terminal downstream decision is *delete*, not defer and not wire. skillctl **adopts** that decision (its `pipeline.*` is the same dormant, zero-consumer namespace). Recorded as skillctl ADR-0003 (see Key Technical Decisions) — an adoption of the downstream conclusion, not a divergence from a superseded deferral.

### External References

None. Pure Node, well-patterned internal work with a complete downstream reference implementation in hand. No external framework research warranted.

---

## Key Technical Decisions

- **One-shot complete SPI v1.1, not phased.** (User-confirmed.) The hook + `applyAdapterTransform` + `stage-asset.mjs` + the three-site wiring + the invariant land as a sequenced unit chain in one plan. The genuinely atomic boundary is **U5↔U6**: once a non-identity adapter ships (U6), the plan-side and stage-side hashes must already agree (U5), or the cross-stage invariant and tamper-detection break. U2–U5 each stay green via the identity default (untransformed installs byte-for-byte unchanged); the lint (U7), test rebuild (U8), and ADR scaffold (U1) carry **no** correctness coupling to the SPI chain — they are bundled for absorption coherence and review economy, not invariant-safety. This is named so the blast-radius decision is weighed on its real axis.
- **Delete the dormant `pipeline.*` namespace; route only the three live command sites — adopting the downstream's terminal single-tier decision.** Rationale: skillctl's `pipeline.mjs` has zero internal callers (the same dormant, interrupted-migration namespace netops audited under ADR-0004 and deleted, "no documented harm from the dormant namespace... codebase hygiene and architectural coherence"). Keeping it forces a bad trilemma — wire a fourth `stageAsset` site into dead code (re-creating the two-tier debt netops removed), or ship a known cross-stage-invariant gap on the public `pipeline.stage` path. Deleting it dissolves the trilemma, matches the more-evolved downstream's trajectory, and is the *coherent* form of "absorb the downstream's kernel evolution" (absorb the terminal state, not a mid-vintage snapshot). Cost: removes `pipeline` and `ERR_PIPELINE_*` from the public surface — a public-API removal, gated by a pre-delete grep proving zero non-test/non-re-export consumers, recorded in skillctl ADR-0003 + release note, and reflected in the version bump. Recorded as skillctl ADR-0003 (adopt-downstream-single-tier).
- **`stage-asset.mjs` lives in `core/`, named as a noun.** Distinct from `filesystem.mjs`'s staging-*dir* verbs (`STAGING_PREFIX`, `makeStagingDir`, `stageWrite`, `promoteStagedFiles`). Layer-legal (`core`-only imports). Mirrors the downstream naming decision verbatim.
- **`applyAdapterTransform` stays core-internal — not re-exported via `index.mjs`.** It is a compose helper consumed only by `core/stage-asset.mjs` (also `core`); no adapter, CLI, or sample-product bin calls it directly. `stageAsset`/`hashTransformed` are likewise core-internal (consumed by `core/plan.mjs` and `cli/commands` — both layer-legal without a public re-export). Exporting any of them prematurely widens the stability contract for no identified consumer. The `architecture.test.mjs` public-symbol list is therefore **not** extended for these (and the assertion is missing-only anyway — adding exports never fails it). If a future downstream needs the raw primitive, the export is added then, with the consumer named.
- **No Buffer cached on plan entries.** `buildInstallPlan` calls `hashTransformed` (transform + hash, no write) so the plan-time sha256 is the transformed hash; the three command sites re-run the transform via `stageAsset`. Plans stay JSON-serializable (existing plan round-trip tests unaffected). Transform re-runs; cost is negligible and exercises idempotency every install.
- **`repair` re-hash is a bug fix, not a semantic regression** (grill-resolved via code trace). `repair` always re-copies from *current source* (`fs.readFileSync(item.sourceAbs)` — it never restored an original snapshot). Today it does NOT record the staged hash, so after repairing a `missing`/`--accept-modified`-tampered file whose source has drifted, `state.json` describes neither disk nor source: the **next `update` then misclassifies the just-repaired file as tampered and blocks (`ok:false`)** — `newHash(source) ≠ mf.sha256` and `targetHash(disk) ≠ mf.sha256` both fire the tamper gate. Routing `repair` through `stageAsset` and recording the staged hash makes `state.json` honest about the bytes repair already wrote; the subsequent `update` is then a correct clean no-op. No legitimate `update` reconciliation is lost — there was never a correct reconciliation, only a false-tamper block being avoided. The one genuine semantic to record (release note + ADR-0003): `repair` restores to **current source**, not the originally-installed snapshot — true under both old and new behavior; the old behavior merely lied about it in state.
- **`lint-release-sync` badge check is adapted, not ported.** skillctl's README has a *dynamic* npm-version shields badge and a `tests-N passing` badge — no static `releases-vX.Y.Z` badge like netops. The load-bearing check (pkg version == newest release note, semver) is kept; the badge assertion is retargeted to the `tests-N passing` count badge as an advisory-only check (or dropped with recorded rationale if it proves brittle). The four-manifest lockstep is removed entirely (skillctl ships no plugin manifests).
- **No new error class for `stage-asset.mjs`.** Pass through `AdapterError(ERR_TRANSFORM_FAILED)` from `applyAdapterTransform` and `FsError`/raw fs errors from `stageWrite`. Error propagation is byte-identical to the current inline sites.
- **Test rebuild is the layered subset, not all ~16 modules.** (User-confirmed.) Honors the CLAUDE.md "rebuilt as the fixture stabilizes" stance; avoids importing non-kernel netops assertions (four-manifest lockstep, repo-only collector/absorber); concentrates risk on the SPI change's own coverage.

---

## Open Questions

### Resolved During Planning

- **SPI v1.1 sequencing — phased or one-shot?** One-shot complete (user-confirmed); no safe intermediate state for the invariant.
- **Test rebuild breadth?** Layered subset: SPI-bearing units self-test + zero-coupling module tests ported + `validator`/`drift` adapted to `sample-product`; product-coupled tests deferred (user-confirmed).
- **`pipeline.*` — wire the fourth site, skip it, or delete it?** Delete it. netops ADR-0003 (defer) was superseded by ADR-0004 (delete + single-tier); the terminal downstream decision is delete. skillctl's `pipeline.*` is the same dormant, zero-internal-caller namespace. Wiring it re-creates removed debt; skipping it ships a known invariant gap on a public path. Deleting matches the downstream and dissolves both. Gated by a pre-delete consumer grep (U5).
- **Export `applyAdapterTransform` / `stageAsset` / `hashTransformed` via `index.mjs`?** No — all three are core-internal, consumed only within `core`/`cli` (layer-legal without a public re-export). No identified downstream consumer. Public-symbol list unchanged.
- **Where does the plan-side transformed hash come from?** `core/plan.mjs:applyAdapterTransform` + `core/stage-asset.mjs:hashTransformed`, called by `buildInstallPlan` with `stage:"plan"`.
- **`lint-release-sync` without a contract doc (netops ADR-0006 D1)?** Not D2-without-D1: the assertion spec is folded into ADR-0001's release-discipline section + the backfilled `v0.1.0.md`, a recorded D1-compression appropriate to skillctl's small assertion set.
- **Badge check feasibility (skillctl has no static releases badge)?** Adapt to the `tests-N passing` badge as advisory; keep the semver version==release-note check as the load-bearing gate.

### Deferred to Implementation

- Exact `transformAssetContent` frontmatter mapping table for `opencode` (which Claude keys drop, whether `description` is the only retained key, exact `mode: subagent` emission) — settle against the live `sample-product` agent file + OpenCode schema during U6, mirroring netops `opencode.mjs` but re-derived for the sample fixture.
- Whether `install`'s dry-run path short-circuits before `stageAsset` — verify in U5; if so the throwing-adapter integration test uses `update`/`repair` instead of `install`.
- Precise wording of ADR-0001's Z-layer / SPI-freeze rationale and ADR-0004's absorption provenance list — drafted at unit time from this plan's Context section.
- `stage-asset.test.mjs` fixture style (inline byte-exact string fixtures vs. reusing `sample-product` files) — pick during U4 to match whatever the adapted adapter tests use.

---

## Output Structure

    docs/
    ├── adr/
    │   ├── 0001-adopt-adr-practice-and-record-frozen-invariants.md   # U1
    │   ├── 0002-adapter-content-transform-via-spi-hook.md            # U2
    │   ├── 0003-adopt-downstream-single-tier-delete-pipeline.md      # U5
    │   ├── 0004-absorption-provenance-netops-tier-1-2.md             # U9
    │   └── 0005-release-model-no-npm-provisional-name.md             # already written (grill session)
    ├── release-notes/
    │   └── v0.1.0.md                                                 # U1 (backfill)
    └── plans/
        └── 2026-05-18-001-feat-absorb-netops-spi-v11-and-release-discipline-plan.md
    scripts/
    ├── lint-release-sync.mjs                                         # U7
    ├── lint-release-sync.test.mjs                                    # U7
    └── installer/
        ├── core/
        │   ├── stage-asset.mjs                                       # U4
        │   ├── stage-asset.test.mjs                                  # U4
        │   ├── errors.test.mjs        # U8 (ported)
        │   ├── asset-types.test.mjs   # U8 (ported)
        │   ├── which.test.mjs         # U8 (ported)
        │   └── manifest/
        │       ├── validator.test.mjs # U8 (adapted to sample-product)
        │       └── drift.test.mjs     # U8 (adapted to sample-product)
        ├── (deleted)  core/pipeline.mjs            # U5 (adopt downstream single-tier)
        └── (modified) core/plan.mjs, adapters/spi.mjs,
            adapters/opencode.mjs, adapters/spi.test.mjs,
            cli/commands/index.mjs, core/errors.mjs,
            index.mjs (drop `pipeline` + ERR_PIPELINE_* re-exports),
            architecture.test.mjs (drop `pipeline` from expected symbols)

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Transform flows through two stages that must agree on the hash:

```
PLAN stage (buildInstallPlan)                STAGE stage (commands install/update/repair)
  asset + adapter                              asset + adapter
        │                                            │
        ▼                                            ▼
  hashTransformed({stage:"plan"})            stageAsset({stage:"stage"})
        │                                            │
        ├─ applyAdapterTransform ──┐      ┌── applyAdapterTransform
        │  (transform or identity) │      │   (same transform, re-run)
        ▼                          │      ▼
  hashBytes(transformedBuf)        │   hashBytes(transformedBuf) ── stageWrite ──▶ staging dir
        │                          │      │                                            │
        ▼                          │      ▼                                     promoteStagedFiles
  plan.sha256 (TRANSFORMED) ───────┴──────┴──▶ state.json.sha256  ═══ must equal ═══ hashFile(on-disk)
```

Invariant (ADR-0002 D2, single-witness — `stage-asset.test.mjs` + a `commands` E2E, mirroring the downstream's terminal model): `state.json` sha256 == `hashFile(promoted file)` for every asset on every remaining write path (install / update / repair). No pipeline path exists after U5. The identity default makes untransformed assets a zero-delta special case of the same path.

Layer placement (architecture.test-legal; all primitives core-internal, not re-exported):

```
core/plan.mjs            applyAdapterTransform   (core → core; not exported via index.mjs)
core/stage-asset.mjs     stageAsset, hashTransformed   (core → core; imports plan.mjs + filesystem.mjs)
cli/commands/index.mjs   install/update/repair → stageAsset   (cli → core)
adapters/opencode.mjs    transformAssetContent   (adapters → core)
(deleted) core/pipeline.mjs — dormant two-tier namespace, adopt downstream single-tier
```

---

## Implementation Units

### U1. docs/ discipline scaffold + ADR-0001 + v0.1.0 release note backfill

**Goal:** Establish `docs/adr/`, `docs/release-notes/`, `docs/plans/`; backfill `docs/release-notes/v0.1.0.md` from existing tag/commit context so the release-sync lint has a baseline; write ADR-0001 recording the ADR practice itself plus the rationale CLAUDE.md asserts but never justifies (ProductConfig/Adapter-SPI-v1 frozen identity fields; the Z three-layer import rule).

**Requirements:** R7, R8

**Dependencies:** None

**Files:**
- Create directories explicitly: `docs/adr/`, `docs/release-notes/` (git does not track empty directories — a fresh clone has neither; do not assume they exist because this plan lives under `docs/plans/`). U2 depends on `docs/adr/` and U7 on `docs/release-notes/v0.1.0.md`; both fail with path-not-found if this step is skipped.
- Create: `docs/adr/0001-adopt-adr-practice-and-record-frozen-invariants.md`
- Create: `docs/release-notes/v0.1.0.md`
- Modify: `package.json` (add `"private": true` — accidental-`npm publish` guard while the package name is provisional and publication is deferred; removed only when the name + publish decision is made, a separate future decision)
- Modify: `CLAUDE.md` (update the Repository layout tree to add `docs/adr/` and `docs/plans/` alongside the existing `docs/release-notes/`; add `docs/adr/` to Conventions; note ADR-per-architectural-decision)

**Approach:**
- ADR-0001 follows the netops ADR format (Date / Status / Context / Decision / Consequences / Alternatives / References). Content: why ADRs now (kernel is downstream-extended; invariants need recorded rationale); the SPI-v1 frozen-field rationale; the Z-layer rationale; a **release-discipline section** that is the written spec `lint-release-sync` (U7) enforces — version == newest `docs/release-notes/v*.md` by semver, advisory stale-prose (the netops ADR-0006 D1 contract, compressed into ADR-0001 since skillctl's assertion set is small); a **one-line release-model pointer** to `docs/adr/0005-release-model-no-npm-provisional-name.md` (already written during the grill session — the no-npm / provisional-name / `"private": true` / no-contract-clock posture is recorded there, not duplicated in ADR-0001); explicitly note ADR-0002/0003/0004 will follow in this plan and ADR-0005 already exists.
- `v0.1.0.md` backfilled from `git log` of the initial-release commits (`35a285c`, `7fe4f07`, `389617d`). Content-faithful, not invented.

**Patterns to follow:**
- `~/workspace/netops-agent-skills/docs/adr/0001-*.md` and `0006-*.md` — ADR section structure.
- `~/workspace/netops-agent-skills/docs/release-notes/v0.1.0.md` — release-note shape.

**Test scenarios:**
- Test expectation: none — docs + CLAUDE.md only, no behavioral change. (U7 will mechanically assert `v0.1.0.md` is parseable by the release-sync lint.)

**Verification:**
- `docs/adr/0001-*.md`, `docs/release-notes/v0.1.0.md` exist and render; `npm test` unaffected (still green).

---

### U2. SPI v1.0 → v1.1: `transformAssetContent` hook + `ERR_TRANSFORM_FAILED` + ADR-0002

**Goal:** Add the optional `transformAssetContent(asset, body: Buffer) => Buffer` SPI field with an identity default; add `ERR_TRANSFORM_FAILED`; move all SPI version markers to v1.1; record the decision as ADR-0002. Purely additive — identity default means zero behavior change until later units wire it.

**Requirements:** R1, R7, R8

**Dependencies:** U1 (`docs/adr/` exists)

**Files:**
- Modify: `scripts/installer/adapters/spi.mjs` (add `transformAssetContent` to `SPI_DEFAULTS` with identity default `(asset, body) => body`; document the import-side-effect ban applies). Note: the literal version markers are `Adapter SPI v1` (spi.mjs header) and `the SPI v1 contract` / `# Adapter SPI v1` (README) — there is no `v1.0` token; rewrite the `v1` markers to `v1.1`, do not find-replace `v1.0`
- Modify: `scripts/installer/adapters/README.md` (SPI contract doc → v1.1; add the optional-field row; add a "Pre-1.0 minor-bump removal allowance" subsection mirroring netops ADR-0004 D3's three conditions — **forward hygiene for the eventual first publish, NOT a legitimacy precondition for the U5 `pipeline` removal**. Per the grill finding, this kernel has never been published to npm (the npm `skillctl` name is an unrelated third-party package, versions 0.0.3–0.0.9; this codebase is at zero published surface), so removing `pipeline`/`ERR_PIPELINE_*` is internal cleanup, not a published-contract break — the allowance is documented now so it exists *when* publishing starts, but the U5 removal does not depend on it)
- Modify: `scripts/installer/core/errors.mjs` (add `ERR_TRANSFORM_FAILED` in the Adapter-errors group)
- Modify: `scripts/installer/index.mjs` (re-export `ERR_TRANSFORM_FAILED`)
- Modify: `scripts/installer/adapters/spi.test.mjs` (now 7 optional fields; identity default returns input Buffer by reference; `applyDefaults` injects it when absent)
- Create: `docs/adr/0002-adapter-content-transform-via-spi-hook.md`

**Approach:**
- Mirror netops ADR-0002 D1: signature `(asset, body:Buffer)=>Buffer`, pure, identity default **returns the input Buffer unchanged by reference** (preserves the later `transformed` reference-equality flag). Minor-version-compatible per the documented SPI evolution policy.
- ADR-0002 adapted to skillctl: keep D1/D2/D3; replace netops-specific references (skill-absorber, netops agent paths) with skillctl/sample-product equivalents; cite this plan. **Add D4 (grill Q5): agent tool-restriction parity across platforms.** Record that the OpenCode transform cannot carry Claude's `tools:` shape (OpenCode validator rejects it). If OpenCode has a native restriction field the transform maps onto it; if not, `tools:` is dropped and an agent restricted on Claude/Codex runs at OpenCode's default subagent access — a named, accepted capability divergence (three-platform reach traded against per-agent OpenCode tool parity). The kernel must not claim unqualified "three-platform capability parity" while this holds; the divergence is documented here, surfaced by the U6 tool-posture test, and revisitable if OpenCode gains a restriction field.

**Patterns to follow:**
- `scripts/installer/adapters/spi.mjs` existing `SPI_DEFAULTS` shape + `applyDefaults`.
- `~/workspace/netops-agent-skills/scripts/installer/adapters/spi.mjs:78` (`transformAssetContent: (asset, body) => body`) and `adapters/README.md` v1.1 optional-field row.

**Test scenarios:**
- Happy path: `SPI_DEFAULTS` exposes `transformAssetContent`; `applyDefaults({...without it})` injects the identity default.
- Edge case: identity default returns the *same* Buffer instance it was given (reference equality, not a copy).
- Edge case: an adapter that already defines `transformAssetContent` is not overwritten by `applyDefaults`.
- Happy path: `ERR_TRANSFORM_FAILED` is exported from `core/errors.mjs` and re-exported from `index.mjs`.
- Integration: `createAdapterRegistry([claude,codex,opencode])` still builds; all three resolve a `transformAssetContent` (identity) without declaring one.

**Verification:**
- `npm test` green (updated `spi.test.mjs` included); built-in adapters unchanged in behavior; `adapters/README.md` says v1.1.

---

### U3. `core/plan.mjs:applyAdapterTransform` primitive

**Goal:** Add the transform-compose primitive: run the adapter hook (or identity), wrap any throw as `AdapterError(ERR_TRANSFORM_FAILED)` with `.details = {adapterId, assetId, assetType, stage, cause}`, and report a `transformed` flag via Buffer reference-equality.

**Requirements:** R2, R8

**Dependencies:** U2 (`transformAssetContent` field + `ERR_TRANSFORM_FAILED`)

**Files:**
- Modify: `scripts/installer/core/plan.mjs` (add module-internal `applyAdapterTransform(asset, transformFn, {adapterId, stage})`; `export` it from the module so `core/stage-asset.mjs` can import it, but **do not** re-export via `index.mjs` — core-internal, no public consumer; see KTD)
- Test: `scripts/installer/core/plan.test.mjs` (extend; created here if absent)
- (No `index.mjs` or `architecture.test.mjs` change — `applyAdapterTransform` is not public API; the public-symbol assertion is missing-only and is intentionally not extended for it)

**Approach:**
- `core → core` only (layer-legal). Returns `{resultBuf, transformed}` where `transformed === (resultBuf !== sourceBuf)`. A non-Buffer return or a throw from the hook surfaces as `AdapterError(ERR_TRANSFORM_FAILED)` carrying `stage` (caller passes `"plan"` or `"stage"`).
- Signature and error shape mirror netops `applyAdapterTransform` exactly so `stage-asset.mjs` (U4) composes it unchanged.

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/core/stage-asset.mjs` (composition shape + JSDoc) and netops `core/plan.mjs:applyAdapterTransform`.
- Existing `PlanError` construction in `scripts/installer/core/plan.mjs` for the throw/details idiom.

**Test scenarios:**
- Happy path: identity transform → `transformed:false`, `resultBuf` is the input Buffer by reference.
- Happy path: non-identity transform → `transformed:true`, `resultBuf` is the new bytes.
- Error path: hook throws → `AdapterError(ERR_TRANSFORM_FAILED)` with `.details.stage` equal to the caller-passed stage and `.details.cause` the original error.
- Error path: hook returns a non-Buffer → `AdapterError(ERR_TRANSFORM_FAILED)`.
- Edge case: `transformFn` undefined (identity) → `transformed:false`.

**Verification:**
- `npm test` green; `applyAdapterTransform` importable by `core/stage-asset.mjs` (intra-`core`), NOT present in `index.mjs` exports; `architecture.test.mjs` core→core rule green.

---

### U4. `core/stage-asset.mjs` — `stageAsset` + `hashTransformed` + invariant witness

**Goal:** Create the dedup primitive module: `stageAsset({asset,adapter,stagingDir,targetRel})` (transform + hash + stageWrite, `stage:"stage"`) and `hashTransformed({asset,adapter,stage})` (transform + hash, no write). Add `core/stage-asset.test.mjs` carrying an independent cross-stage hash invariant witness.

**Requirements:** R2, R3, R8

**Dependencies:** U3 (`applyAdapterTransform`)

**Files:**
- Create: `scripts/installer/core/stage-asset.mjs`
- Create: `scripts/installer/core/stage-asset.test.mjs`
- (No `index.mjs` re-export and no `architecture.test.mjs` symbol-list change — `stageAsset`/`hashTransformed` are core-internal, consumed by `core/plan.mjs` and `cli/commands` only, both layer-legal without a public export; consistent with `applyAdapterTransform`, see KTD)

**Approach:**
- `stageAsset`: `applyAdapterTransform(asset, adapter?.transformAssetContent, {adapterId:adapter?.id??null, stage:"stage"})` → `hashBytes(resultBuf,{extension:path.extname(asset.sourceAbs)})` → `stageWrite(stagingDir,targetRel,resultBuf)` → return `{sha256,algo,normalization,bytes,transformed}`. Hardcodes `stage:"stage"` (always writes).
- `hashTransformed`: same minus `stageWrite`; caller passes `stage` (`"plan"`). Returns the same shape.
- No new error class — pass through (`AdapterError`/`FsError`/raw fs).
- `stage-asset.test.mjs` independently asserts `hashFile(stagedPath) === returned.sha256` (the ADR-0002 D2 invariant witness). This is the single witness (plus the U5 `commands` E2E) — there is no pipeline-side witness because `pipeline.*` is deleted in U5, matching the downstream's terminal model.

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/core/stage-asset.mjs` — near-verbatim (signatures, JSDoc, invariant comment), re-pointed at skillctl modules.
- `scripts/installer/core/filesystem.mjs:hashBytes/stageWrite` for the compose targets.

**Test scenarios:**
- Happy path: identity adapter → staged bytes == source bytes; `sha256 === hashFile(sourceAbs)`; `transformed:false`.
- Happy path: non-identity adapter → staged bytes == transformed; `sha256 === hashFile(staged)`, `!== hashFile(sourceAbs)`; `transformed:true`.
- Edge case: empty source (`Buffer.alloc(0)`) → empty staged file; sha256 is the empty-buffer hash.
- Edge case: binary/non-text extension → `normalization:"byte-exact"` propagates from `hashBytes`.
- Error path: throwing adapter → `AdapterError(ERR_TRANSFORM_FAILED)` `.details.stage:"stage"`.
- Error path: `stageWrite` path-validation failure (absolute / `..`) → `FsError` (pass-through).
- Integration (invariant witness): mock adapter, run `stageAsset`, assert `hashFile(stagedPath) === returned.sha256`.
- Happy path: `hashTransformed` returns the same `{sha256,…,transformed}` as `stageAsset` for the same input, without writing any file.

**Verification:**
- `npm test` green; `core/stage-asset.test.mjs` invariant witness passes; module imports only `core/` (architecture.test green).

---

### U5. Delete dormant `pipeline.*` + wire the 3 live staging sites + plan-side transformed hash + ADR-0003 (linchpin)

**Goal:** Delete the dormant two-tier `pipeline.*` namespace (adopting the downstream's terminal single-tier decision); route the three live command staging sites (install/update/repair) through `stageAsset`; make `buildInstallPlan` hash the transformed buffer via `hashTransformed` (`stage:"plan"`); record the returned transformed sha256 into `state.json` on every remaining write path including `repair`. The cross-stage invariant holds end-to-end with no pipeline path remaining. Record the decision as ADR-0003 (adopt-downstream-single-tier).

**Requirements:** R3, R7, R8

**Dependencies:** U4 (`stageAsset`/`hashTransformed`), U3 (`applyAdapterTransform`)

**Files:**
- Delete: `scripts/installer/core/pipeline.mjs` (entire dormant namespace — gated by the pre-delete consumer grep below)
- Modify: `scripts/installer/index.mjs` (drop the `pipeline` re-export and the `ERR_PIPELINE_STAGE/_COMMIT/_PERSIST` re-exports if they become unreferenced after deletion)
- Modify: `scripts/installer/core/errors.mjs` (remove `ERR_PIPELINE_*` only if no remaining code references them; otherwise leave — verify by grep, do not break unrelated callers)
- Modify: `scripts/installer/architecture.test.mjs` (remove `pipeline` from the expected public-symbol list — this assertion IS strict for *removal*: a listed-but-absent symbol fails it, so the list must drop `pipeline` in the same change)
- Modify: `scripts/installer/core/plan.mjs` (`buildInstallPlan` threads the adapter through **both** its callers; per-asset hash via `hashTransformed({stage:"plan"})` instead of `hashFile(sourceAbs)`)
- Modify: `scripts/installer/cli/commands/index.mjs` (install :255, update :665, repair :950 → `stageAsset`; state writes use returned `{sha256,algo,normalization,bytes}`; `repair` now re-hashes)
- Create: `docs/adr/0003-adopt-downstream-single-tier-delete-pipeline.md`
- Test: extend `examples/sample-product/sample-bin.test.mjs` (the existing E2E harness) for the throwing-adapter staging path and the cross-stage invariant E2E — this is the primary integration witness, since `cli/commands/` has no test file today (a future `cli/commands/index.test.mjs` is deferred work, not created here)
- Possibly delete: any `scripts/installer/core/pipeline.test.mjs` — **none exists today** (do not attempt to "keep/extend" it); the invariant witness is `core/stage-asset.test.mjs` (U4) + the sample-bin E2E here

**Approach:**
- **Pre-delete consumer grep (hard gate).** Before deleting `pipeline.mjs`, grep the repo for `pipeline\.` / `from .*pipeline` / `import .*pipeline` excluding `core/pipeline*.mjs`, `index.mjs` re-export lines, and `architecture.test.mjs`; also grep for the secondary re-exports (`snapshotStateBak`, `writeStateAtomic`, `stateDirFor`, `STATE_BAK`) imported *via the pipeline module path*. Confirm zero non-test, non-re-export runtime consumers (expected: zero — `commands.install` inlines its own staging; already code-confirmed: the only non-test reference is `index.mjs:58`). If a real consumer is found, STOP and surface it. **No external-consumer concern exists**: this kernel has never been published to npm (the npm `skillctl` name belongs to an unrelated third-party package; this codebase is at zero published surface — established in the grill session). The `pipeline` removal is therefore *internal cleanup*, not a published-API contract break; no external migration ceremony is warranted. Record the removal in the release note for git-tag/vendor consumers.
- **Delete `pipeline.*`** and prune its now-dead public exports + the `ERR_PIPELINE_*` codes (only those that become unreferenced). This is the coherent absorption of netops ADR-0004 (single-tier).
- The adapter must reach `buildInstallPlan` and the staging sites. `buildInstallPlan(manifest, selectionIds, options)` has **two callers** — `cli/commands/index.mjs` (which already resolves the adapter from the registry) and, until deleted, `pipeline.mjs`. After the delete only the commands caller remains; thread `adapter` through its `options` and down to each `stageAsset` call. (This simplification is a *direct benefit* of the delete: one threading path, not two.)
- `buildInstallPlan` per-asset: `hashTransformed({asset, adapter, stage:"plan"})` → entry `{sha256,algo,normalization,bytes}` is now the *transformed* hash. Conflict/`--overwrite` detection compares transformed-intended bytes (preserves the "plan knows what it will write" invariant — netops ADR-0002 rejected the stage-only-with-backfill alternative for this reason).
- `repair`: replace "keep prior sha256" with `stageAsset`'s returned sha256. Per KTD this is a **bug fix** (the old behavior left `state.json` describing neither disk nor current source, causing the next `update` to false-flag the just-repaired file as tampered and block) — not a regression and not merely a transform-latent fix. Characterize it with the differential test scenario below; record the named rationale + the "restores to current source, not original snapshot" semantic in ADR-0003 + the release note.
- ADR-0003: records adopting netops ADR-0004's single-tier conclusion (not diverging from the superseded ADR-0003 deferral); the consumer-grep evidence; the removal of `pipeline`, `ERR_PIPELINE_*`, and the secondary `pipeline.mjs` re-exports (`snapshotStateBak`/`writeStateAtomic`/`stateDirFor`/`STATE_BAK` — still exported from `filesystem.mjs`, enumerate them so the grep's blind spot is noted); the fact that the kernel is **unpublished** (npm `skillctl` is an unrelated third-party package) so this is internal cleanup, not a published-contract break — no external-migration ceremony; and the **`repair` re-hash as a bug fix, not a regression** — named rationale: old `repair` left `state.json` describing neither disk nor current source, causing the next `update` to false-flag the just-repaired file as tampered and block; recording the staged hash makes state honest; no correct `update` reconciliation is lost. The release note records the `pipeline` removal AND the `repair` fix (noting `repair` restores to *current source*, not the originally-installed snapshot) for git-tag/vendor consumers.

**Execution note:** Characterization-first. Land the U4 `stage-asset.test.mjs` invariant witness and a sample-bin E2E asserting `state.json.sha256 === hashFile(on-disk)` (identity adapter) **before** rewiring the three sites, so the refactor + the `repair` re-hash change are guarded by a failing→passing assertion, not just untransformed regression. Run the pre-delete consumer grep as the very first step.

**Patterns to follow:**
- `~/workspace/netops-agent-skills` plan `2026-05-15-001` Approach + post-dedup `commands/index.mjs` shape (1-line `stageAsset` call + hash-field destructure); netops ADR-0004 for the delete scope/sequence.
- Existing `applyInstall` state-write idiom in `scripts/installer/core/state.mjs`.
- `examples/sample-product/sample-bin.test.mjs` `spawnSync` E2E idiom for the integration scenarios.

**Test scenarios:**
- Integration (E2E): install with identity adapter (claude) → every `state.json` entry's `sha256 === hashFile(target file)`.
- Integration (E2E): install with a non-identity adapter (opencode, after U6) → `state.json.sha256 === hashFile(transformed on-disk file)`, `!== hashFile(source)`.
- Integration: `install → update` no-op when source unchanged (transformed hash stable across re-run — idempotency).
- Integration: `repair` on a tampered managed file → file restored; `state.json.sha256` matches the restored on-disk file.
- Integration (the repair-rehash bug-fix characterization — **differential, code-grounded**): identity adapter; managed file recorded at hash `H0`; drift its *source* to `H1` (`H1 ≠ H0`); make the file repairable (delete it on disk so it is `drift.missing`, or modify it + pass `--accept-modified` so it is accepted-`tampered`). Run `repair --apply`, then `update`. Assert: (a) after the **new** `repair`, `state.json` for that file == `H1` and the subsequent `update` is a clean **no-op** (`newHash === mf.sha256`, not in `candidates`, not in `tampered`); (b) the **pre-change** behavior is the bug — with `state.json` left at `H0`, the same `update` classifies the file as **tampered and returns `ok:false`** (`newHash=H1 ≠ H0` and `targetHash=H1 ≠ H0` both fire the tamper gate). The test must fail if post-new-repair `update` is anything other than a clean no-op, and the old-behavior arm must demonstrate the `ok:false` tamper-block (proving the fix removes a real false-tamper, not that it "behaves as documented").
- Error path: throwing adapter during a real staging verb → `AdapterError(ERR_TRANSFORM_FAILED)` `.details.stage:"stage"`; if `install --dry-run` short-circuits before staging, use `update`/`repair` (deferred-to-implementation check).
- Edge case: conflict/`--overwrite` detection compares *transformed* intended bytes vs. existing unmanaged file.
- Regression: no test imports `pipeline`; `architecture.test.mjs` passes with `pipeline` removed from the expected list; no `ERR_PIPELINE_*` reference dangles.

**Verification:**
- Pre-delete grep recorded in ADR-0003 showing zero non-test/non-re-export `pipeline` consumers.
- `npm test` green incl. the `stage-asset.test.mjs` invariant witness + sample-bin E2E; `grep` shows zero remaining inline `readFileSync(...)→stageWrite(...)` staging triplets outside `stage-asset.mjs`, and zero `pipeline.mjs`; `index.mjs` no longer exports `pipeline`/`ERR_PIPELINE_*`; E2E install of an agent via `opencode` (after U6) produces on-disk bytes whose hash equals the recorded `state.json` entry.

---

### U6. opencode adapter `transformAssetContent` — Claude→OpenCode agent frontmatter rewrite

**Goal:** Implement the actual transform in the shipped `opencode` adapter (frontmatter-only: retain `description`, set `mode: subagent`; map `tools:` to OpenCode's native restriction field if one exists, else drop it as a named accepted divergence; drop `model:`/`color:`; body bytes unchanged) and re-admit `"agent"` to `supportedAssetTypes`, so the kernel can deliver agents to OpenCode.

**Requirements:** R4, R8

**Dependencies:** U2 (SPI field); end-to-end coverage depends on U5

**Files:**
- Modify: `scripts/installer/adapters/opencode.mjs` (`transformAssetContent`; add `"agent"` back to `supportedAssetTypes`; keep its existing `mapTargetPath` agent path)
- Modify: `scripts/installer/adapters/README.md` (opencode transform note)
- Test: `scripts/installer/adapters/spi.test.mjs` or a new `scripts/installer/adapters/opencode.test.mjs` (byte-exact transform fixtures)

**Approach:**
- Parse leading YAML frontmatter, concatenate the **unchanged** body (ADR-0002 D3 — no body rewriting). Non-agent asset types and files without frontmatter pass through identity (return the input Buffer by reference). Fail-fast (throw `AdapterError`) on a missing/empty `description` rather than emitting a mute-but-valid degraded agent — mirror netops's `ERR_OPENCODE_AGENT_FRONTMATTER` discipline.
- **Tool-restriction divergence — investigate, do not silently inherit the drop (grill Q5).** netops's transform emits *only* `{description, mode: subagent}`, dropping `tools:`/`model:`/`color:` (forced — OpenCode's startup validator rejects Claude's shapes). Dropping `tools:` means an agent restricted on Claude/Codex (e.g. the sample agent's `tools: [Read, Grep, Glob]`) runs on OpenCode with OpenCode's **default** subagent tool access — a capability/safety divergence. U6 must first check whether OpenCode's agent schema has a native tool-restriction field; **if it does, map `tools:` onto it** (preserve the restricted semantic) instead of dropping. Only if OpenCode has no equivalent does the transform drop `tools:` — and then the divergence is a named, accepted consequence (recorded in ADR-0002, see U2), not a silent inherit. `model:` is dropped regardless (lets OpenCode subagents inherit the parent provider — avoids `ProviderModelNotFoundError`).
- Mapping table re-derived against `examples/sample-product/agents/sample-example-agent.md` and the OpenCode agent schema; structurally similar to netops `opencode.mjs:transformAssetContent` but with the tools-field investigation above resolved first.

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/adapters/opencode.mjs` `transformAssetContent` (lines ~114-140) — structure and frontmatter-only discipline.
- Existing `yaml` dependency usage in the repo for frontmatter parse/emit.

**Test scenarios:**
- Happy path: sample agent file → output frontmatter retains `description`, sets `mode: subagent`, drops `model`/`color`; body bytes byte-identical to input body.
- **Tool-posture (grill Q5, must be explicit not implicit):** sample agent `tools: [Read, Grep, Glob]` → assert and document the post-transform tool posture: if OpenCode has a native restriction field, assert `tools:` mapped onto it (restriction preserved); if not, assert `tools:` absent AND a test comment + ADR-0002 reference records that the agent runs at OpenCode default access (divergence visible, not hidden).
- Edge case: skill/rule asset (non-agent) → identity (input Buffer returned by reference; `transformed:false`).
- Edge case: agent file with no frontmatter → identity pass-through; malformed YAML → pass-through (surfaces at OpenCode boot, not masked).
- Error path: agent frontmatter missing/empty `description` → throws `AdapterError` (`ERR_OPENCODE_AGENT_FRONTMATTER`-equivalent) at install time — fail-fast on source defect, not a mute degraded agent.
- Integration: `createAdapterRegistry` with opencode now lists `"agent"` in `supportedAssetTypes`; plan for the `sample-demo` bundle (skill → agent + rule) includes the agent for opencode.
- Integration (with U5): install the sample agent via opencode → on-disk file is OpenCode-schema-valid frontmatter; `state.json.sha256 === hashFile(on-disk)`.

**Verification:**
- `npm test` green; opencode installs `agent` assets; transformed file parses under OpenCode's frontmatter expectations (asserted via fixture, not a live OpenCode run).

---

### U7. Port `lint-release-sync.mjs` (stripped) + `docs/release-notes` enforcement

**Goal:** Add a product-agnostic read-only release-sync lint: `package.json` version == newest `docs/release-notes/v*.md` by **semver** (not lexical), plus the advisory stale-prose heuristic. Strip the netops four-manifest lockstep. Add the npm script and pre-commit wiring.

**Requirements:** R5, R8

**Dependencies:** U1 (`docs/release-notes/v0.1.0.md` exists)

**Files:**
- Create: `scripts/lint-release-sync.mjs`
- Create: `scripts/lint-release-sync.test.mjs`
- Modify: `package.json` (`"lint:release-sync"` script; add its test file to the `test` aggregate)
- Modify: `.husky/pre-commit` (run `lint:release-sync` alongside `npm test`)

**Approach:**
- Keep netops `semverGt`, `newestReleaseNoteVersion`, `runLint` exported (testable, pure). Remove the `mirrors` four-manifest block entirely. Badge check: retarget to skillctl's `tests-N passing` shields badge as **advisory-only** (never affects exit code); if it proves brittle, drop it and record the rationale inline + in ADR-0004. Load-bearing gate = version == newest release note (exit 1 on mismatch; exit 2 on IO/parse error).
- `--json` mode preserved (machine-readable, same shape minus lockstep entries).

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/lint-release-sync.mjs` (and its `.test.mjs`) — near-verbatim minus `mirrors`.
- Existing skillctl lint scripts (`scripts/lint-skills.mjs`) for the exit-code + `--json` convention and pre-commit style.

**Test scenarios:**
- Happy path: `package.json` version == newest `docs/release-notes/v*.md` → `ok:true`, exit 0.
- Edge case (the semver trap): release notes `v0.9.0`, `v0.10.0` present, pkg `0.10.0` → newest resolves to `0.10.0` (semver), `ok:true`. Lexical comparison would wrongly pick `v0.9.0` — assert it does not.
- Error path: pkg version `0.2.0`, newest note `v0.1.0` → `ok:false`, one mismatch, exit 1.
- Error path: empty/missing `docs/release-notes/` → throws → exit 2.
- Edge case: advisory stale-prose hit in README → reported, `ok` unaffected, exit still 0.
- Happy path: `--json` emits `{ok, checks, advisory, mismatches}` with no lockstep keys.

**Verification:**
- `npm run lint:release-sync` passes on the repo as shipped (pkg `0.1.0` == `docs/release-notes/v0.1.0.md`); `npm test` includes the new test; pre-commit runs it.

---

### U8. Test-suite rebuild — layered subset bound to `examples/sample-product/`

**Goal:** Rebuild kernel coverage to the confirmed layered subset: port zero-product-coupling module tests near-verbatim; adapt `validator`/`drift` to the sample fixture; wire everything into the `test` aggregate and pre-commit. SPI-bearing coverage already lands in U2–U6.

**Requirements:** R6, R8

**Dependencies:** U2, U3, U4, U5, U6 (modules at final shape so tests bind correctly)

**Files:**
- Create: `scripts/installer/core/errors.test.mjs` (ported)
- Create: `scripts/installer/core/asset-types.test.mjs` (ported)
- Create: `scripts/installer/core/which.test.mjs` (ported)
- Create: `scripts/installer/core/manifest/validator.test.mjs` (adapted to `sample.install.json`)
- Create: `scripts/installer/core/manifest/drift.test.mjs` (adapted to `sample-product` tree)
- Modify: `package.json` (`test` aggregate adds the new files)
- Modify: `.husky/pre-commit` (no change if it already runs `npm test`; confirm)

**Approach:**
- `errors`/`asset-types`/`which`: zero product coupling — port from netops near-verbatim (only import-path fixups). High regression value, near-zero adaptation.
- `validator`/`drift`: swap netops `netops.install.json` + `netops:` prefix fixtures for `examples/sample-product/sample.install.json` + `sample:` prefix. **Drop** any netops-private assertions (four-manifest lockstep, repo-only collector/absorber, `netops-lint-config`) — they are not kernel.
- Do not port `loader`(extended)/`commands`/`cli`/`help`/`strings`/`prompts` — Deferred to Follow-Up Work.

**Patterns to follow:**
- `~/workspace/netops-agent-skills/scripts/installer/core/{errors,asset-types,which}.test.mjs` (verbatim targets).
- `~/workspace/netops-agent-skills/scripts/installer/core/manifest/{validator,drift}.test.mjs` (adapt fixtures).
- `examples/sample-product/sample-bin.test.mjs` for the sample-fixture binding idiom already used in-repo.

**Test scenarios:**
- Happy path: each ported module test passes against skillctl's (identical) module under `node --test`.
- Edge case: `validator.test.mjs` rejects a malformed `sample.install.json` (bad profile/category) and accepts the shipped one.
- Edge case: `drift.test.mjs` detects an added/removed file vs. `sample.install.json` and reports clean on the pristine tree.
- Integration: `npm test` aggregate runs all new files; no netops-private assertion leaked (grep the new tests for `netops`, four-manifest, repo-only collector terms → none).

**Verification:**
- `npm test` green with the expanded suite; README `tests-N passing` badge count updated (U9 sweep); no `node_modules`/Jest/Vitest added.

---

### U9. ADR-0004 absorption provenance + final consistency sweep

**Goal:** Record what Tier 1+2 was absorbed from netops-agent-skills **at its terminal v0.10.0 state** (including the single-tier `pipeline.*` delete via netops ADR-0004, not the superseded ADR-0003 deferral) and what was deliberately not (Tier 3 product privates) and why; final sweep for architecture/test/badge consistency.

**Requirements:** R7, R8

**Dependencies:** U1–U8

**Files:**
- Create: `docs/adr/0004-absorption-provenance-netops-tier-1-2.md`
- Modify: `README.md` (`tests-N passing` badge count → actual)
- Modify: `docs/release-notes/` (new note for this release if a version bump accompanies the merge — coordinate with maintainer; otherwise fold into the next tag's note)

**Approach:**
- ADR-0004: provenance table — absorbed (SPI v1.1, stage-asset, **single-tier `pipeline.*` delete adopting netops ADR-0004**, lint-release-sync, layered tests, ADR practice) vs. deliberately excluded (collector/absorber/forge, INSTALL-FOR-AGENTS content, version-agnostic-explainer invariant, four-manifest lockstep, verify-baseline-for-now) with one-line rationale each. Explicitly note the provenance is anchored to the downstream's **terminal v0.10.0 state** and that netops ADR-0003 (defer) was superseded by ADR-0004 (delete) — future readers must not anchor on the superseded deferral. Cite this plan + netops source ADRs/plans by path.
- Sweep: `architecture.test.mjs` green with `pipeline` **removed** from the expected public-symbol list; `index.mjs` exports carry no `pipeline`/`ERR_PIPELINE_*`; `npm test` count == README badge; `npm run lint:release-sync` green; `grep` confirms no residual inline staging triplet and no `pipeline.mjs`.

**Test scenarios:**
- Test expectation: none — documentation + badge text; the substantive checks are the existing suites asserted green in Verification.

**Verification:**
- `npm test` + `npm run lint:release-sync` + `npm run lint:skills`/`lint:manifest`/`lint:drift` all green; ADR-0004 present; README badge matches actual test count.

---

## System-Wide Impact

- **Interaction graph:** New transform-composition layer (`applyAdapterTransform` → `stageAsset`/`hashTransformed`) sits between `buildInstallPlan`/staging sites and `filesystem.hashBytes`/`stageWrite`. The shipped `opencode` adapter gains a content responsibility. No callbacks/observers/middleware introduced.
- **Error propagation:** `AdapterError(ERR_TRANSFORM_FAILED)` (with `.details.stage`) rises from `applyAdapterTransform`; `FsError`/raw fs from `stageWrite`. Identical to current inline behavior — no new error class, no swallowed errors.
- **State lifecycle risks:** The plan-time hash becomes the *transformed* hash; `repair` now re-hashes — a **bug fix** (the old behavior left `state.json` describing neither disk nor source, making the next `update` false-flag a just-repaired file as tampered; see KTD/U5), not a semantic regression. Mitigated by the single-witness invariant test (`stage-asset.test.mjs`) + the sample-bin E2E asserting `state.sha256 === hashFile(on-disk)` on every remaining write path, plus the differential `repair`-then-`update` characterization test (new = clean no-op vs old = `ok:false` tamper-block). `snapshotStateBak → applyInstall → promoteStagedFiles → writeStateAtomic` ordering is unchanged.
- **API surface parity:** Three staging paths (install/update/repair via commands) get uniform treatment; the dormant `pipeline.stage` public path is **removed**, not made uniform — adopting the downstream's terminal single-tier model (netops ADR-0004).
- **Integration coverage:** Lifecycle + cross-stage-invariant + throwing-adapter + opencode-agent-install + drifted-source-repair scenarios cover the seams that unit mocks cannot prove (transform actually flows to disk; recorded hash matches promoted bytes; repair semantic change is intentional).
- **Public API change (NOT unchanged):** `pipeline` and the `ERR_PIPELINE_*` codes are **removed** from `index.mjs` — a deliberate public-surface deletion (gated by the consumer grep, recorded in ADR-0003, reflected in the version bump). This is the one breaking change in the plan and is called out explicitly rather than hidden under "additive only".
- **Unchanged invariants:** ProductConfig/Adapter-SPI-v1 frozen identity fields; the Z three-layer import rule; `state.json` schema; `node --test`-only; ESM `.mjs`-only. `ERR_*` strings are additive (`ERR_TRANSFORM_FAILED`) **except** the deliberate `ERR_PIPELINE_*` removal above. Public API is additive **except** the deliberate `pipeline` removal above; `applyAdapterTransform`/`stageAsset`/`hashTransformed` are core-internal (no public surface added). Identity-default `transformAssetContent` means untransformed installs are byte-for-byte unchanged from today.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Plan-side and stage-side transform disagree → invariant break, tamper-detection misfire | Both compose the *same* `applyAdapterTransform`; `stage-asset.test.mjs` witness + sample-bin E2E assert `state.sha256 === hashFile(on-disk)` on every remaining write path; characterization-first execution note on U5 |
| One of three sites left on the old inline path | U5 verification greps for residual `readFileSync→stageWrite` triplets; architecture.test + pre-commit gate |
| Deleting `pipeline`/`ERR_PIPELINE_*` breaks an internal consumer | Pre-delete consumer grep is a hard gate (STOP if a non-test/non-re-export consumer exists). Already code-confirmed zero (only `index.mjs:58` re-export). Matches the downstream's identical-namespace finding |
| Deleting `pipeline` breaks an external consumer | Structurally impossible: the kernel is unpublished (npm `skillctl` is an unrelated third-party package; zero published surface — grill-established). No external consumer of *this* codebase's `pipeline` can exist. Recorded in release note for git-tag/vendor consumers |
| `repair` re-hash changes behavior unexpectedly | Code-trace-resolved (grill): it is a **bug fix** — old behavior false-flags just-repaired files as tampered on the next `update`. Differential characterization test asserts new = clean no-op vs old = `ok:false` tamper-block. Release note states the one real semantic (`repair` restores to current source, not original snapshot) |
| `install --dry-run` short-circuits before staging → throwing-adapter test on wrong verb | Deferred-to-implementation check in U5; fall back to `update`/`repair` verb for that test |
| Badge check has no static `releases-vX` target in skillctl | KTD: retarget to `tests-N passing` badge as advisory-only, or drop with recorded rationale; load-bearing gate is the semver version==release-note check |
| Ported netops tests smuggle non-kernel assertions back in | U8 drops product-coupled tests entirely; grep gate for `netops`/four-manifest/repo-only terms in new test files |
| Bundling loosely-coupled concerns enlarges blast radius | Grill-resolved: ship as **two PRs** (see Phased Delivery). PR1 = U1+U7 (zero-risk hygiene, SPI-chain-independent). PR2 = U2–U6 (atomic SPI chain, KTD U5↔U6) + U8 + U9. Note: U8 is NOT splittable to PR1 — it binds to the final post-SPI module APIs (the doc-review FYI's "U1+U7+U8 first" was wrong on U8) |
| Mixed-vintage netops citations (read a superseded ADR-0003 snapshot) | Plan now anchors to the terminal v0.10.0 state (ADR-0004 delete + single-tier); U9/ADR-0004 provenance derived against terminal state; Sources flags the supersession |

---

## Phased Delivery

Grill-resolved (Q6). The 9 units land as **two PRs**, one logical absorption sequenced — not bundled into a single high-blast-radius change.

### PR1 — Foundation (near-zero risk, SPI-chain-independent)

- **Units:** U1 (docs scaffold + ADR-0001 + `v0.1.0.md` + `package.json` `"private": true`) + U7 (`lint-release-sync` + its test + pre-commit wiring).
- **Why first:** zero code-behavior change; U1 is already a hard prerequisite for U2; lands ADR practice + release-discipline so it is not held hostage to the contested SPI work. ADR-0001 forward-references ADR-0002/0003/0004 as "in the follow-up PR" (honest; ADR-0005 already exists from the grill session).
- **Version:** docs+lint only → a patch/minor with no contract impact (e.g. `v0.1.1`); `v0.1.1.md` release note lands in the same PR so `lint:release-sync` is green.

### PR2 — The substantive absorption (isolated blast radius)

- **Units:** U2 → U3 → U4 → U5 → U6 (the atomic SPI chain — KTD U5↔U6 boundary; non-identity adapter and the four-equivalent staging rewire must agree before merge) + U8 (test rebuild — **must be here**: binds to the final post-SPI module APIs: `stage-asset`, `transformAssetContent`, post-`pipeline`-delete `index.mjs`) + U9 (ADR-0004 provenance + final sweep).
- **Why second:** high blast radius (deletes `pipeline.*`, rewires staging, fixes `repair`, SPI v1.0→v1.1, opencode transform). Isolating it lets reviewers approve the hygiene (PR1) separately and lets PR2 iterate without blocking release-discipline. ADR-0002/0003/0004 are written in this PR.
- **Version:** reflects the `pipeline` removal + `repair` fix + SPI bump; `v0.2.0.md` (or next) note lands in-PR.

PR2 depends on PR1 (docs/adr + docs/release-notes scaffolding, and U2's `docs/adr/` prerequisite). U8/U9 stay in PR2 because their correctness binds to PR2's final code shape.

---

## Documentation / Operational Notes

- ADRs: 0001 (practice + freeze/layer + release-sync-lint spec; release-model = one-line pointer to 0005), 0002 (content-transform hook), 0003 (adopt-downstream-single-tier / `pipeline.*` delete), 0004 (absorption provenance, anchored to terminal v0.10.0 state), **0005 (release model — no npm / provisional name / no contract clock; already written during the grill session, `status: accepted`, supersede when the name+publish decision is made)**.
- `adapters/README.md` is the SPI contract doc — must move to v1.1 with the new optional-field row (U2) and the opencode transform note (U6).
- **Release model (grill-resolved): no npm publish; provisional name; git-tag/vendor distribution.** The npm `skillctl` name is taken by an unrelated third-party package (versions 0.0.3–0.0.9, last touched 2026-02); this kernel has never been published under any version. The maintainer is deferring npm publication because the package name may still change. Until then: distribution is git tag + `docs/release-notes/v<x.y.z>.md` (consumed via clone / git-dependency / vendor), **not** npm. `package.json` gets `"private": true` so an accidental `npm publish` fails loud while the name is provisional.
- Version bump: this carries internal API removals (`pipeline`, `ERR_PIPELINE_*`, the `pipeline`-path re-exports) plus an additive SPI field and a `repair` semantic change. Since there is **no published public-API contract** (the kernel is unpublished), this is not a contract break — a **minor** bump (0.1.0 → 0.2.0) is appropriate as routine pre-1.0 progression, not as a break-under-allowance. The `v0.2.0.md` release note records (for git-tag/vendor consumers; no external-npm migration section needed — there are no external npm consumers of this codebase): the `pipeline` removal; and the `repair` fix — one sentence stating `repair` now records the staged hash, which removes a latent inconsistency that previously made the next `update` false-flag a just-repaired file as tampered, and noting that `repair` restores to **current source**, not the originally-installed snapshot. `lint:release-sync` enforces pkg version == newest release note (registry-agnostic — valid in the no-npm phase) so the `v0.2.0.md` note lands in the same change as the bump.
- CLAUDE.md gains the `docs/adr/` convention (U1); the "lean test suite / rebuilt as fixture stabilizes" note is now partially discharged (U8) with the remainder explicitly deferred.

---

## Alternative Approaches Considered

- **Phased SPI v1.1 (dedup-only refactor first, hook later)** — rejected by the user-confirmed one-shot decision. The genuinely atomic coupling is narrow (U5↔U6: plan/stage hash must agree once a non-identity adapter ships); the identity default makes U2–U5 individually green. The bundling of U1/U7/U8 is for absorption coherence and review economy, not invariant-safety — stated honestly in the KTD rather than overclaimed as "no safe intermediate anywhere".
- **Keep + wire `pipeline.stageStage` (route-all-four)** — rejected. Invests transform + hash + an ADR + a re-created witness into a dormant namespace the more-evolved downstream audited and **deleted** (netops ADR-0004), re-creating the exact two-tier debt netops paid down. The original framing ("diverge from netops's deferral") rested on netops ADR-0003, which is *superseded*; the live downstream decision is delete, not defer.
- **Keep `pipeline.*` but don't wire it (accept the invariant gap)** — rejected. Ships a known cross-stage-invariant hole on a *public* surface (`pipeline.stage` with a non-identity adapter), and still carries the dead two-tier surface. Worst of both: a footgun for any future downstream that adopts pipeline, plus the maintenance weight. If the namespace is doomed (it is, per the downstream), delete it now rather than ship it broken.
- **Cache the transformed Buffer on plan entries** — rejected (netops ADR-0002 precedent): breaks plan JSON-serializability; the recompute cost is <1ms/file and exercises idempotency every install.
- **Body rewriting in `transformAssetContent`** — rejected (ADR-0002 D3): mechanical body rewrite corrupts references that point at the source CLI filesystem rather than the agent's own config; frontmatter-only keeps the adapter scoped to shape, not meaning.
- **Port the full ~16-module netops test suite** — rejected (user-confirmed): fights the CLAUDE.md incremental-rebuild stance and risks importing non-kernel assertions; the layered subset concentrates coverage where this change adds risk.

---

## Sources & References

- Related code (skillctl): `scripts/installer/core/plan.mjs`, `core/filesystem.mjs`, `core/pipeline.mjs` (delete target, U5), `cli/commands/index.mjs:255/665/950`, `adapters/spi.mjs`, `adapters/opencode.mjs`, `core/state.mjs`, `architecture.test.mjs`, `index.mjs`, `examples/sample-product/`
- Blueprint (downstream, read-only — read at the **terminal v0.10.0 state**, not a mid-vintage snapshot): `~/workspace/netops-agent-skills/docs/adr/0002-adapter-content-transform-via-spi-hook.md`, `docs/adr/0003-defer-pipeline-namespace-fate-to-v080-audit.md` **(Superseded — do not use as a decision basis)**, `docs/adr/0004-pipeline-namespace-delete.md` **(the live pipeline decision)**, `docs/adr/0006-release-discipline-contract.md` (note D1 contract-doc requirement, D3 deferred publish gate), `docs/plans/2026-05-14-001-feat-opencode-agent-frontmatter-adapter-plan.md`, `docs/plans/2026-05-15-001-refactor-stage-asset-dedup-plan.md`, `scripts/installer/core/stage-asset.mjs`, `scripts/installer/adapters/spi.mjs`, `scripts/installer/adapters/opencode.mjs`, `scripts/lint-release-sync.mjs`, `scripts/installer/core/{errors,asset-types,which}.test.mjs`, `scripts/installer/core/manifest/{validator,drift}.test.mjs`. Caution: other absorbed artifacts (SPI v1.1, stage-asset, lint) may carry post-v0.7.3 amendments — derive U9/ADR-0004 provenance against the v0.10.0 terminal state, not the cited mid-vintage plan snapshots.
- Project conventions: `CLAUDE.md` (architecture invariants, ProductConfig contract, test scope, conventions)
