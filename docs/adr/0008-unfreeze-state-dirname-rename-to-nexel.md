---
status: accepted
date: 2026-05-18
supersedes: 0007 (D4 only)
---

# Unfreeze STATE_DIRNAME: rename `.skillctl` → `.nexel` (supersedes ADR-0007 D4 only)

## Context

ADR-0007 D4 deliberately did **not** rename the on-disk state directory when
the project was renamed `skillctl` → `nexel`. Its rationale, quoted verbatim:

> `STATE_DIRNAME = ".skillctl"` (`scripts/installer/core/filesystem.mjs`) is
> **deliberately NOT renamed**. Renaming it would orphan every existing
> `.skillctl/` state directory on disk — a real production-behavior change with
> a migration cost. Freezing it is what a package-manager-class kernel does:
> the on-disk state contract is a stability surface independent of the product
> mark (consistent with ADR-0001 D2's reasoning that identity woven into
> on-disk state must stay stable across a lifetime). Consequently the rename's
> "zero production-code behavior change" claim is scoped to mean "no logic
> change and no on-disk-contract change."

D4's Consequences clause further stated that "the on-disk state directory they
already have stays `.skillctl` and needs no migration."

**That entire rationale is premised on existing adoption** — "every existing
`.skillctl/` state directory", "they already have". The project has **zero
adoption**: it is unpublished (`"private": true`, no npm package — ADR-0005 /
ADR-0007), distributed only by git-tag/vendor, with no known consumers. There
are therefore no on-disk `.skillctl/` directories anywhere to orphan. The sole
load-bearing reason for the freeze does not exist.

Leaving `STATE_DIRNAME` at `.skillctl` is now pure identity incoherence with
no offsetting benefit: the package, repo, docs, and bin all say `nexel` while
the directory every install/uninstall/repair/drift operation writes still
says `.skillctl`.

This ADR is recorded per ADR-0001 D1 (hard to reverse once adopted, surprising
without context, the result of a real trade-off). It supersedes **ADR-0007 D4
only**.

## Decision

### D1: Rename `STATE_DIRNAME` `.skillctl` → `.nexel`

`STATE_DIRNAME` in `scripts/installer/core/filesystem.mjs` is changed to
`.nexel`. This is a **deliberate breaking on-disk-contract change**, taken now
because pre-adoption is the cheap window — the same principle ADR-0007 itself
invokes for pre-publish internal cleanup ("routine cleanup… not contract breaks
requiring a major bump or external-migration ceremony"). It is **not** a
"zero production-code behavior change": the directory the kernel reads and
writes changes name. Safety rests entirely on the **zero-adoption premise**
recorded above; that premise is the load-bearing assumption of this decision.

### D2: Retract D4's "no migration because frozen" consequence

ADR-0007 D4's Consequences clause ("stays `.skillctl` and needs no migration")
is retracted. The replacement is **not** "frozen, so no migration" — it is
"**no migration shim by design, because there is nothing to migrate**" (zero
adoption → no pre-existing `.skillctl/` directories). A future consumer reading
ADR-0007 D4 must treat its freeze *and* its no-migration-by-freeze reasoning as
fully superseded by this ADR; no part of D4 remains in force.

### D3: Scope of supersession

This ADR supersedes **ADR-0007 D4 only**. ADR-0007's other decisions remain in
force unchanged: D1 (name resolved = `nexel`), D2 (scope-it rejected on its own
merits), D3 (the explicit retraction of ADR-0005's contract-clock/`private`
coupling), D5 (publish posture deferred — `npm publish`, `"private": true`
removal, and the public-API contract clock are still not started). This is a
narrow amendment, not a re-opening of the rename or publish decisions.

## Consequences

- The `skillctl` → `nexel` identity rename is now functionally complete: no
  live identity surface still says `skillctl`. Remaining `skillctl` occurrences
  are by-design and enumerated in the cleanup plan's retention list (historical
  records, the product-literal legacy-leak guards, rename-documenting
  ADRs/notes, `pre-skillctl` historical comments).
- There is **no migration path and none is needed** — pre-adoption by design.
  If the project is ever published/adopted, the on-disk state directory is
  thereafter a stability surface again (ADR-0001 D2's reasoning re-applies from
  that point forward); this ADR's window is explicitly the pre-adoption one.
- The contract clock is still **not** started (ADR-0007 D5 stands). This change
  is pre-publish routine cleanup, recorded in the `v0.5.2` release note for
  git-tag/vendor consumers.
- ADR-0007 stays on file as a historical record; D4 is marked superseded by
  this ADR (the rest of 0007 remains authoritative).

## References

- [ADR-0007](0007-rename-to-nexel-and-decouple-publish-decision.md) — D4 superseded by this ADR; D1/D2/D3/D5 remain in force
- [ADR-0001](0001-adopt-adr-practice-and-record-frozen-invariants.md) — D1 (ADR practice), D2 (on-disk-identity stability reasoning, re-applies post-adoption)
- [ADR-0005](0005-release-model-no-npm-provisional-name.md) — superseded by ADR-0007; the zero-adoption / pre-publish-cheap-window principle originates here
- `docs/plans/2026-05-18-006-refactor-residual-skillctl-cleanup-plan.md` — the implementation plan this decision authorizes
- `scripts/installer/core/filesystem.mjs` — `STATE_DIRNAME` (the renamed constant)
