---
status: accepted
date: 2026-05-18
---

# Release model: no npm publish, provisional name, git-tag/vendor distribution

The npm name `skillctl` is held by an unrelated third-party package (versions 0.0.3–0.0.9, "Gestor de Skills para Agentes de IA", frozen 2026-02); this kernel has never been published under any version. Because the package name may still change, we **defer npm publication** and distribute via git tag + `docs/release-notes/v<x.y.z>.md` (consumed by clone / git-dependency / vendor); `package.json` carries `"private": true` as the accidental-`npm publish` guard. **Consequence:** there is no published public-API contract yet — the contract clock starts only at the first real publish under a resolved name, so pre-publish internal API removals (e.g. the dormant `pipeline.*` namespace) are routine cleanup recorded in release notes for vendor consumers, not contract breaks requiring a major bump or external-migration ceremony.

## Considered options

- **Scope and publish now** (`@seasontemple/skillctl`) — rejected for now: the maintainer wants the name unsettled until the project identity is firm; scoping then renaming churns more than deferring.
- **Dispute / reclaim the `skillctl` name** — rejected: slow, low-probability, not under our control.
- **Rename the project** — deferred: a larger identity decision, not forced yet.

Supersede this ADR when the name + publish decision is made (that decision starts the public-API contract clock and removes `"private": true`).
