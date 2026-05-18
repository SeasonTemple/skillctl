---
status: accepted
date: 2026-05-18
---

# Adopt the downstream's single-tier decision: delete the dormant `pipeline.*` namespace

## Context

skillctl forked from netops-agent-skills before that downstream resolved the
fate of its two-tier `pipeline.*` namespace. The downstream's netops ADR-0003
*deferred* the decision; it was then **superseded by netops ADR-0004**, which
**deleted** `pipeline.*` entirely and committed to a single-tier installer
(CLI verbs encapsulate plan + stage + commit inline). skillctl still carried
the same dormant `core/pipeline.mjs` — a never-activated, interrupted
migration with **zero internal runtime callers**.

A pre-delete consumer grep (the hard gate) confirmed this: the only
references to `pipeline` outside `core/pipeline.mjs` and `.test.mjs` files
were `index.mjs:58` (the public re-export) and the `ERR_PIPELINE_*`
re-exports at `index.mjs:129-131`. `commands.install` inlines its own
staging and does not route through `pipeline.stage`; `buildInstallPlan`'s
only non-pipeline caller is `commands/index.mjs`. No `import … from
'…/pipeline'` exists anywhere except `pipeline.mjs`'s own internal import.

## Decision

### D1: Delete `pipeline.*`, adopting netops ADR-0004 — not diverging from the superseded ADR-0003

The earlier framing ("diverge from netops's deferral, route a fourth staging
site through `stageAsset`") rested on netops ADR-0003, which is superseded.
The live downstream decision is *delete*. skillctl adopts it: `core/pipeline.mjs`
is removed; `pipeline`, `ERR_PIPELINE_STAGE/_COMMIT/_PERSIST`, and the
section comment are dropped from `index.mjs`; the `ERR_PIPELINE_*`
declarations are removed from `core/errors.mjs`; `pipeline` is removed from
the `architecture.test.mjs` expected public-symbol list. Wiring a transform
into dead code, or shipping a known cross-stage-invariant gap on a public
`pipeline.stage` path, were both rejected — keeping the namespace re-creates
the exact two-tier debt the more-evolved downstream paid down.

### D2: This is internal cleanup, not a published-contract break

skillctl has never been published to npm (the npm `skillctl` name is an
unrelated third-party package — see ADR-0005). There is no published
public-API contract; removing `pipeline`/`ERR_PIPELINE_*` (and the secondary
`pipeline`-path re-exports, which never existed in this codebase's
`index.mjs` — only `pipeline` itself was re-exported) is internal cleanup. No
external-migration ceremony is warranted; the SPI removal-allowance
(`adapters/README.md`) is forward hygiene for the eventual first publish, not
a precondition for this removal. The change is recorded in the release note
for git-tag/vendor consumers.

### D3: `repair` re-hash is a bug fix, not a semantic regression

`repair` always re-copies from *current source*
(`fs.readFileSync(item.sourceAbs)` — it never restored an original
snapshot). The old behavior did **not** record the staged hash, so after
repairing a `missing` / `--accept-modified`-tampered file whose source had
drifted, `state.json` described neither disk nor source. The **next
`update`** then misclassified the just-repaired file as tampered and blocked
(`ok:false`): `newHash(source) ≠ mf.sha256` and `targetHash(disk) ≠
mf.sha256` both fire the tamper gate. Routing `repair` through `stageAsset`
and recording the staged (transformed) hash makes `state.json` honest about
the bytes repair just wrote; the subsequent `update` is then a correct clean
no-op. No legitimate `update` reconciliation is lost — there was never a
correct reconciliation, only a false-tamper block being avoided. The one
genuine semantic, recorded in the release note: `repair` restores to
**current source**, not the originally-installed snapshot (true under both
old and new behavior; the old behavior merely lied about it in state).

### D4: Plan-side transformed hash composed locally to avoid an import cycle

`buildInstallPlan` hashes the *transformed* bytes (so the recorded sha256
matches what `stageAsset` later writes — the ADR-0002 D2 cross-stage
invariant). It composes the in-module `applyAdapterTransform` + `hashBytes`
directly rather than calling `stage-asset.mjs`'s `hashTransformed`, because
`core/stage-asset.mjs` imports `applyAdapterTransform` from `core/plan.mjs`
and the reverse import would create a `plan.mjs ↔ stage-asset.mjs` cycle.
The behavior is identical; only the composition site differs.

## Consequences

- Single-tier installer, matching the downstream's terminal architecture.
  One `buildInstallPlan` caller (`commands/index.mjs`), one threading path
  for the SPI v1.1 adapter.
- Public surface shrinks by `pipeline` + three `ERR_PIPELINE_*` codes —
  recorded as an internal removal (no published contract exists).
- `repair` followed by `update` is now correct for the drifted-source case;
  a differential characterization test asserts new = clean no-op vs old =
  `ok:false` tamper-block.
- The invariant is single-witnessed (`core/stage-asset.test.mjs` + a
  sample-bin E2E), matching the downstream's terminal witness model (its
  pipeline-side witness was deleted with the namespace).

## References

- `docs/adr/0002-adapter-content-transform-via-spi-hook.md` — the SPI hook + D2 invariant
- `docs/adr/0005-release-model-no-npm-provisional-name.md` — unpublished posture
- netops ADR-0003 (superseded) → netops ADR-0004 (pipeline-namespace-delete) — the adopted decision
- `docs/plans/2026-05-18-001-feat-absorb-netops-spi-v11-and-release-discipline-plan.md`
