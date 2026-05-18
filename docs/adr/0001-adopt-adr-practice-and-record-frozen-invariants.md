---
status: accepted
date: 2026-05-18
---

# Adopt ADR practice; record the frozen kernel invariants and release-discipline spec

## Context

skillctl is a product-agnostic kernel that downstream products extend. `CLAUDE.md`
asserts several load-bearing invariants (the Adapter SPI v1 frozen identity fields,
the Z three-layer import rule, manual versioning with per-tag release notes) but
records no *rationale* for them, and there is no mechanical check that a version
bump moves the docs that must move with it. A future maintainer (or a downstream
product author) reading only the assertions cannot tell which are deliberate
trade-offs versus incidental, and the same drift class the more-evolved downstream
fork already hit (stale version facts shipped unnoticed) is unguarded here.

## Decision

### D1: Adopt an ADR practice

Architecture decisions are recorded as numbered ADRs in `docs/adr/NNNN-slug.md`.
An ADR is written only when the decision is **hard to reverse**, **surprising
without context**, and **the result of a real trade-off**. ADRs may be short.
`status` frontmatter is used when a decision is revisitable.

### D2: Record the frozen Adapter-SPI-v1 identity rationale

`ProductConfig` freezes five identity fields (`productName`, `skillIdPrefix`,
`agentNamePrefix`, `defaultManifestFile`, `binName`); `skillIdPrefix` may not
contain `:`, `agentNamePrefix` must end with `-`. **Rationale:** these values are
woven into on-disk asset identity (skill ids, agent filenames, manifest lookups);
a product changing them post-install would orphan every previously-installed
asset and break state/drift reconciliation. They are frozen so the kernel can
treat product identity as stable across a product's lifetime, and misconfigured
products fail loud at construction rather than mid-install.

### D3: Record the Z three-layer rationale

`core/` imports only `core/`; `adapters/` imports `core/`+`adapters/`; `cli/`
imports `core/`+`adapters/`+`cli/`; `index.mjs` is the only public entry point;
downstream bins import only `installer/index.mjs` or named adapter modules.
**Rationale:** the kernel must stay provider-agnostic — per-CLI knowledge lives
only in `adapters/`. The acyclic layer direction keeps `core/` reasoning free of
adapter and CLI concerns, makes the public surface a single auditable file, and
lets `architecture.test.mjs` enforce the boundary mechanically rather than by
convention. Breaking the direction is what re-introduces the provider coupling
the kernel exists to avoid.

### D4: Release-discipline spec (the contract `lint-release-sync` enforces)

This kernel keeps no `CHANGELOG.md`; release context lives in
`docs/release-notes/v<x.y.z>.md` (one file per tag) plus tag annotations, and
versioning is manual (no automatic semver tool). The deterministic, mechanically
assertable subset of that discipline — enforced by `scripts/lint-release-sync.mjs`
— is: **`package.json` `version` must equal the newest `docs/release-notes/v*.md`
by semver order (numeric per field, NOT lexical — `v0.10.0 > v0.9.0`)**, plus an
advisory (non-blocking) heuristic that README prose carries no stale current-state
version assertion. This section is the written spec the lint points at; it
replaces the larger separate release-process contract the downstream uses, since
skillctl's assertion set is small enough to live here.

### D5: Release model — pointer

The distribution/publication posture (no npm publish, provisional name,
`"private": true`, no public-API contract clock yet) is recorded separately in
[ADR-0005](0005-release-model-no-npm-provisional-name.md). It is not duplicated
here.

## Consequences

- The kernel's load-bearing invariants now have recorded rationale a future
  reader can weigh, not just assertions to obey or "fix".
- `lint-release-sync` (added in the same change as this ADR's release-discipline
  spec) makes the version↔release-note drift class mechanically caught.
- ADR-0002 (adapter content-transform hook), ADR-0003 (adopt the downstream's
  single-tier `pipeline.*` delete), and ADR-0004 (absorption provenance) follow
  in the substantive PR of the current absorption plan; ADR-0005 (release model)
  already exists.

## References

- `CLAUDE.md` — the asserted invariants this ADR explains
- `scripts/installer/architecture.test.mjs` — the Z-layer enforcement gate
- `scripts/installer/adapters/spi.mjs` — the SPI v1 contract
- `docs/plans/2026-05-18-001-feat-absorb-netops-spi-v11-and-release-discipline-plan.md`
