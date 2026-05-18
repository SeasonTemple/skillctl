---
status: accepted
date: 2026-05-18
---

# Adapter content transform via SPI hook, not kernel handler

## Context

The OpenCode adapter (`scripts/installer/adapters/opencode.mjs`) excludes
`"agent"` from `supportedAssetTypes` because agent files ship Claude Code
frontmatter (`tools:`, `model:`, `color:`) that OpenCode's startup validator
rejects. Direct copy is not viable; the frontmatter must be translated at
install time. The question is **where the translation lives**.

The Adapter SPI is the layered boundary between the kernel and per-CLI
behavior. Today an adapter decides **paths** (`mapTargetPath`) but never
**content** — every install writes source bytes verbatim. Adding content
rewriting forces a layer decision that ripples through the staging path, the
`state.json` hash contract, and the SPI evolution policy. Three layer
candidates: a kernel handler in `core/`, an adapter SPI hook, or vendor-time
normalization. The Z three-layer rule (ADR-0001 D3) requires the kernel stay
provider-agnostic; adapters carry all per-CLI knowledge.

## Decision

### D1: Add a per-adapter content-transform hook to the SPI

`SPI_DEFAULTS` gains one optional field, `transformAssetContent: (asset,
body: Buffer) => Buffer`, identity default. Pure (no env, no IO), subject to
the import side-effect ban. Bumps the SPI to v1.1 (minor — additive optional
field with a kernel default; existing adapters unaffected). One new ERR code,
`ERR_TRANSFORM_FAILED`, joins the public stability contract. A hook throw or
non-Buffer return surfaces as `AdapterError(ERR_TRANSFORM_FAILED)` with
`.details = { adapterId, assetId, assetType, stage, cause }` — `stage`
discriminates plan vs. stage origin without forking the error identity.

### D2: Plan and stage both invoke the hook through a shared helper; no Buffer caching

`core/plan.mjs` gains `applyAdapterTransform`; `core/stage-asset.mjs`
composes it as `hashTransformed` (plan side, no write) and `stageAsset`
(stage side, writes). The plan stage hashes the **transformed** buffer so the
recorded sha256 matches what lands on disk; the stage stage re-runs the
transform to write the same bytes. No Buffer is cached on plan entries —
plans stay JSON-serializable. Re-running a pure transform is cheap and
exercises idempotency on every install. The cross-stage hash invariant
(`state.json` sha256 == `hashFile(promoted file)`) holds for transformed and
untransformed assets alike, witnessed by `core/stage-asset.test.mjs` + a
sample-bin E2E.

### D3: Body bytes pass through unchanged; only frontmatter is rewritten

The opencode adapter's `transformAssetContent` parses leading YAML
frontmatter, emits a new frontmatter object, and concatenates the **unchanged
body**. It does not rewrite body strings (e.g. `~/.claude/...` paths). Body
rewriting assumes every such reference points at the agent's own runtime
config; that assumption is unsafe in general (a skill body may reference a
source-CLI filesystem path it scans, not its own config). Body normalization,
when needed, belongs at vendor time with a human-reviewable diff — not at
install time inside an adapter that cannot disambiguate the two reference
classes. The adapter is scoped to *shape*, not *content meaning*.

### D4: Agent tool-restriction parity across platforms (grill Q5)

The OpenCode transform cannot carry Claude's `tools:` shape — OpenCode's
validator rejects it. U6 first checks whether OpenCode's agent schema has a
native tool-restriction field; if it does, the transform maps `tools:` onto
it (preserving the restricted semantic). If OpenCode has no equivalent,
`tools:` is dropped and **an agent restricted on Claude/Codex runs at
OpenCode's default subagent tool access** — a named, accepted capability
divergence: three-platform reach traded against per-agent OpenCode tool
parity. The kernel must NOT claim unqualified "three-platform capability
parity" while this holds. `model:`/`color:` are dropped regardless (lets
OpenCode subagents inherit the parent provider). The divergence is surfaced
by the U6 tool-posture test, recorded in `CONTEXT.md`, and revisitable if
OpenCode gains a native restriction field. Missing/empty `description` is a
source defect — fail fast at install (`AdapterError`), do not emit a
mute-but-valid degraded agent.

## Consequences

- Kernel stays provider-agnostic: no `if (adapterId === "opencode")` in
  `core/`. Per-CLI knowledge lives in `adapters/opencode.mjs` only.
- SPI evolution stays under the minor-version policy; third-party adapters
  without `transformAssetContent` keep working via the identity default.
- `state.json` contract preserved: recorded sha256 matches disk content, so
  `update` / tamper-detection work identically for transformed and
  untransformed assets.
- `ERR_TRANSFORM_FAILED` is now part of the public stability contract.
- The D4 capability divergence is a known, documented limitation, not a
  silent inherit from the downstream fork.

## Alternatives considered

- **Kernel handler in `core/`** — rejected. Puts OpenCode's frontmatter
  schema knowledge into the kernel, violating the Z three-layer separation
  (ADR-0001 D3). Every future per-CLI schema change would touch `core/`.
- **Cache the transformed Buffer on plan entries** — rejected. Breaks plan
  JSON-serializability; the recompute cost is negligible and the re-run
  exercises idempotency.
- **Vendor-time frontmatter normalization** — rejected for frontmatter
  (mechanical, adapter-specific, would commit N pre-translated copies);
  retained as the right answer for *body* content (D3).

## References

- `docs/adr/0001-adopt-adr-practice-and-record-frozen-invariants.md` — Z-layer
- `scripts/installer/adapters/spi.mjs`, `adapters/README.md` — SPI v1.1
- `scripts/installer/adapters/opencode.mjs` — the adapter implementing it (U6)
- `scripts/installer/core/plan.mjs`, `core/stage-asset.mjs` — invocation sites
- `CONTEXT.md` — the "three-platform capability parity" qualification
- `docs/plans/2026-05-18-001-feat-absorb-netops-spi-v11-and-release-discipline-plan.md`
