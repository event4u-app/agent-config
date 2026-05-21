---
adr: 016
status: accepted
date: 2026-05-21
decision: installer-architecture
supersedes: —
superseded_by: —
phase: v2.x · monorepo-phase-3-typescript-installer
type: prospective
---

# ADR-016 — TypeScript Installer Architecture

## Status

**Accepted** · 2026-05-21 · external AI Council pass (`claude-sonnet-4-5`
+ `gpt-4o`, 2 rounds, `design` lens, actual cost $0.13) on
[`agents/roadmaps/monorepo-phase-3-typescript-installer.md`](../../agents/roadmaps/monorepo-phase-3-typescript-installer.md).
Council issued **conditional approval** with five blockers; this ADR
folds each blocker into the design before Phase 3.1 starts.

Session: [`agents/runtime/council/responses/phase-3-installer-design.json`](../../agents/runtime/council/responses/phase-3-installer-design.json) <!-- council-ref-allowed: ADR decision-trace -->

## Context

Phase 3 of the monorepo plan replaces the shell-based `install.sh` with
a TypeScript Core Installer that drives interactive TUI, non-interactive
CI flags, and a structured **agent-mode** JSON protocol over stdio. It
consumes [`dist/discovery/discovery-manifest.json`](../../dist/discovery/discovery-manifest.json)
(locked by [ADR-015](ADR-015-discovery-manifest-contract.md)) and
writes managed files into the consumer's `.augment/` and `.agent-src/`,
tracked in `agents/agent-config.lock.yml`.

The council raised five architectural risks that, left unaddressed,
would force post-merge rework in Phase 5 (trust) and Phase 6 (browser
wizard). This ADR locks the resolution of each.

## Decision

### 1. Lockfile schema v1 records provenance, not just paths

```yaml
schema_version: 1
agent_config_version: 2.0.0
manifest_sha256: <hex>           # sha256 of the consumed discovery-manifest.json
generated_at: 2026-05-21T12:00:00Z
workspaces: [engineering, governance]
packs:
  - id: pack.laravel
    version: 2.0.0
    auto_selected: false
    required_by: []
files:
  - path: .augment/skills/laravel/SKILL.md
    pack: pack.laravel
    pack_version: 2.0.0
    sha256: <hex>
    manifest_sha256: <hex>       # which manifest sourced this file
    managed: true
```

`manifest_sha256` is per-file (not just per-lockfile) so Phase 5 trust
gates can answer "which manifest claimed this artefact was safe?"
without needing a lockfile rewrite.

### 2. Overrides live in a separate file the installer never writes

```yaml
# agents/agent-config.overrides.yml — user-managed, installer reads but never writes
schema_version: 1
overrides:
  - path: agents/overrides/skills/laravel/SKILL.md
    shadows: .augment/skills/laravel/SKILL.md
    reason: "Custom prompt for our team's Laravel style"
```

The lockfile (`.lock.yml`) is **append-only by the installer**;
overrides (`.overrides.yml`) are **read-only to the installer**.
`validate` cross-references the two. This resolves the source-of-truth
ambiguity the council flagged on `managed: false`.

### 3. Merge decision table replaces "three-way merge" handwaving

| Disk    | Lock | Upstream | Override? | Action                               |
|---------|------|----------|-----------|--------------------------------------|
| A       | A    | A        | —         | no-op                                |
| A       | A    | B        | no        | write B, update lock                 |
| A       | A    | B        | yes       | write B to `.augment/`, leave override |
| A       | A    | absent   | —         | offer prune                          |
| X (drift) | A  | A        | —         | warn, suggest `validate --fix`       |
| X (drift) | A  | B        | no        | error: manual merge required         |
| X (drift) | A  | B        | yes       | error: override may be stale         |
| absent  | A    | B        | —         | write B (recreate)                   |

Encoded in `src/sync/merge-strategy.ts`; covered by
`tests/sync-algorithm.test.ts` with one case per row.

### 4. Agent mode: strict question-ID validation (stateless)

Of the three options the council surfaced (session token, nonce,
strict sequencing) we adopt **strict sequencing**: the CLI tracks the
current question id in the manifest of expected answers; any
`--answer` that does not match the current question id returns:

```json
{ "status": "error", "protocol_version": 1, "reason": "out_of_order",
  "expected_question_id": "q1.workspaces", "received": "q2.packs" }
```

Stateless (no session file), enforceable, and easy to test. Nonces
can be added later under the same protocol version if the threat model
hardens.

### 5. Atomic writes via staging directory

Every command that writes to `.augment/`, `.agent-src/`, or the
lockfile stages changes under `.augment/.agent-config-staging/<uuid>/`,
verifies sha256s against intended manifest entries, then performs:

1. Atomic rename: `staging/.augment/foo.md` → `.augment/foo.md`
   (per-file `fs.renameSync` is atomic on POSIX and Windows ≥ 10).
2. Lockfile written last (so a mid-flight crash leaves the lockfile
   pointing at the previous-good state, not the partial new state).
3. Staging directory removed on success.

`init`, `sync`, and `prune` share the same `commitAtomic(staging)`
helper.

### 6. `protocol_version` field on every agent-mode response

```json
{ "status": "question", "protocol_version": 1, "id": "q1.workspaces", ... }
```

Pinned at 1 for Phase 3; bumped to 2 only on breaking change.
Versioning the schema (not just `next_call`) lets Phase 5 add trust
banners without breaking existing agents.

## Consequences

**Positive**

- Phase 5 (trust) can add `trust_level` to lockfile packs without a
  schema migration (already at `schema_version: 1`; trust fields
  become optional v1 additions).
- Phase 6 (browser wizard) reuses the same agent-mode JSON shape over
  a local HTTP server; the strict-sequencing model maps to HTTP
  request/response naturally.
- `agents/agent-config.overrides.yml` becomes a Git-tracked
  declaration of user intent — diffable, reviewable, and never
  silently overwritten.
- Atomic writes give `sync` and `prune` crash safety without a
  rollback subcommand.

**Negative**

- One extra YAML file in the consumer repo (overrides).
- Strict sequencing means agents must replay the conversation if they
  lose state mid-call; this is the simplest threat-model resolution
  but pushes complexity onto agent authors.
- Per-file `manifest_sha256` adds ~64 bytes per lockfile entry; for a
  500-file install that's 32 KB. Acceptable.

**Deferred to Phase 5**

- npm package signature verification (SLSA Level 3 / `npm
  provenance`). Reviewer A's "sign the package, not just the
  manifest" call. Phase 5 owns trust gates; Phase 3 only records
  provenance.

## Rejected alternatives

- **Single lockfile with `overrides:` section** — the original spec.
  Rejected because the installer cannot detect untracked
  user-authored overrides without either scanning `agents/overrides/`
  (which a malicious agent could pollute) or trusting user edits to
  the lockfile (which breaks "lockfile is installer-generated").
- **Nonce-based agent mode** — overkill for v1. Re-evaluate when
  agent mode lands on a remote surface.
- **Rollback subcommand with lockfile history** — atomic writes
  already give us crash safety; full version history is a Phase 6
  concern (the browser wizard wants a timeline).

## References

- Roadmap: [`agents/roadmaps/monorepo-phase-3-typescript-installer.md`](../../agents/roadmaps/monorepo-phase-3-typescript-installer.md)
- Discovery manifest: [ADR-015](ADR-015-discovery-manifest-contract.md)
- CLI shell precedent: [ADR-012](ADR-012-typescript-cli-shell.md)
- Council session: [`agents/runtime/council/responses/phase-3-installer-design.json`](../../agents/runtime/council/responses/phase-3-installer-design.json) <!-- council-ref-allowed: ADR decision-trace -->
