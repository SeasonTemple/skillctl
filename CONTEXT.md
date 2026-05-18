# skillctl

The shared language of skillctl — a product-agnostic kernel for installing agent skills, agents, and rules across multiple agent CLIs. Created lazily during a grilling session; extend as terms are resolved.

## Language

### Core domain

**Kernel**:
The product-agnostic library in `scripts/installer/`. Owns install / uninstall / update / state / drift / plan logic; knows nothing about any specific product's content.
_Avoid_: engine, core (ambiguous with the `core/` layer)

**ProductConfig**:
The frozen per-product identity a downstream product passes into the kernel (`productName`, `skillIdPrefix`, `agentNamePrefix`, …). The kernel is inert without one.
_Avoid_: settings, options

**Adapter**:
A pluggable per-CLI integration (Claude Code, Codex, OpenCode) implementing the SPI. Decides where assets land and — at SPI v1.1 — how their content is transformed.
_Avoid_: plugin, driver, backend

**Asset**:
A unit the kernel installs. Exactly one of: **skill**, **agent**, **rule**. Not a generic file.
_Avoid_: artifact, resource, file

**Manifest**:
`install.json` — the single source of truth for what assets/bundles exist. An asset is visible to the kernel iff it has a manifest entry.
_Avoid_: config, registry

**Absorption**:
Pulling a *kernel-level* (product-agnostic) evolution back from the more-evolved downstream fork (netops-agent-skills) into this OSS kernel. Product-specific downstream content is explicitly never absorbed.
_Avoid_: merge, sync, port

### Release & contract

**Published baseline**:
The API surface that exists in an actually-published npm release. skillctl currently has **no published baseline** — the npm name `skillctl` is an unrelated third-party package (versions 0.0.3–0.0.9), and this kernel has never been published under any version.
_Avoid_: released version, public version

**Public API contract**:
The stability promise that begins at the *first real publish under the resolved name*. Before that, internal API removals (e.g. deleting the dormant `pipeline.*` namespace) are internal cleanup, **not** contract breaks. The contract clock has not started.
_Avoid_: the API, the interface

**Release model**:
Distribution is git tag + `docs/release-notes/v<x.y.z>.md`, consumed via clone / git-dependency / vendor. **Not npm** — npm publication is deferred because the package name may still change; `package.json` carries `"private": true` as the accidental-publish guard.
_Avoid_: the release process (overloaded with the lint)

## Relationships

- A **Kernel** is configured by exactly one **ProductConfig** per consuming product
- An **Adapter** maps and transforms **Asset**s; a **Manifest** declares which **Asset**s exist
- A **Public API contract** begins only at the first **Published baseline**; until then there is none
- The **Release model** is git-tag/vendor, so `lint-release-sync` enforces version↔release-note (registry-agnostic), not npm state

## Example dialogue

> **Dev:** "Deleting the `pipeline` export is a breaking public-API change — we need a major bump and a migration note for npm consumers, right?"
> **Maintainer:** "There is no **Published baseline**. The npm `skillctl` is someone else's package; this kernel has never shipped. There's no **Public API contract** yet, so removing `pipeline` is internal cleanup — record it in the release note for vendor consumers, routine pre-1.0 minor bump, no migration ceremony."

## Flagged ambiguities

- **"skillctl" the npm package vs "skillctl" this kernel** — resolved: distinct and unrelated. `npm view skillctl` returns a third-party package ("Gestor de Skills para Agentes de IA", 0.0.3–0.0.9, frozen 2026-02). This repo's kernel is unpublished; the name is provisional and may change. Do not treat the npm registry state as this project's history.
- **"release process"** was used for both the `lint-release-sync` mechanical check and the distribution model — resolved: the mechanical check is the *release-sync lint*; the distribution/versioning posture is the **Release model**.
- **"three-platform capability parity"** — unqualified claim is false. An **Agent**'s `tools:` restriction cannot survive the OpenCode transform (OpenCode's validator rejects Claude's frontmatter shape). Resolved: a Claude/Codex-restricted agent runs at OpenCode's default subagent access — a *named, accepted divergence* (ADR-0002 D4), revisitable if OpenCode gains a native restriction field. The kernel claims parity of *capability surface*, not of *per-agent tool restriction on OpenCode*.
