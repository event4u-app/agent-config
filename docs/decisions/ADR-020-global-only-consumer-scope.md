---
adr: 020
status: accepted
date: 2026-05-23
decision: global-only-consumer-scope
supersedes: —
superseded_by: —
phase: v3.x · global-only install rollout
type: forward-looking
---

# ADR-020 — Global-only consumer scope

## Status

**Accepted** · 2026-05-23. Phases 1-5 of
`road-to-global-only-install` shipped (Setup-Wizard, consumer scope
gate, surface + bridge, migration tooling). Phase 6 (docs sweep)
in progress. The ADR locks the decision; the roadmap locks the
mechanics.

Companion artefacts:
- Roadmap: [`agents/roadmaps/road-to-global-only-install.md`](../../agents/roadmaps/road-to-global-only-install.md)
- Bridge contract: [`docs/contracts/consumer-bridge.md`](../contracts/consumer-bridge.md)
- Wizard contract: [`docs/contracts/gui-wizard.md`](../contracts/gui-wizard.md)
- Predecessor ADR: [`ADR-007`](ADR-007-agent-discovery-scopes.md) — scope precedence, global-default amendment
- Perms entry-gate: [`scripts/lint_global_paths.py`](../../src/scripts/lint_global_paths.py)
- Payload schema: [`internal/schemas/wizard-apply-payload.schema.json`](../../internal/schemas/wizard-apply-payload.schema.json)

## Context

ADR-007 (2025-Q4) established that the agent-config consumer can run
in two scopes — **project** (`<repo>/.augment/`, `<repo>/.claude/`, …)
or **global** (`~/.claude/`, `~/.cursor/`, `~/.augment/`, …) — and
that newly-onboarded consumers default to **global**. Six months of
field use surfaced three structural problems:

1. **Settings drift.** Per-project `.agent-settings.yml` files
   accumulate stale `personal.*` keys that disagree with the user's
   real preferences. Multi-repo developers ship the wrong
   `personal.autonomy` into PRs.
2. **Onboarding fragmentation.** New users land in `wizard.md` from
   one tool, `getting-started-by-role.md` from another, and a
   project-local `.agent-user.md` from a third. Three near-identical
   surfaces, each subtly inconsistent.
3. **Update lag.** Consumer projects pin an installer version in
   `package.json`. Skill / rule / command edits ship to the package
   but never reach the consumer until someone manually bumps.

The amendment in ADR-007 (2026-05-13) flipped the **default** to
global for Augment. This ADR finishes the job: the consumer surface
becomes **global-only** end-to-end. The project tree retains exactly
one piece of agent state — `agents/overrides/` plus the bridge marker
documented in [`consumer-bridge`](../contracts/consumer-bridge.md).

## Decision

Consumer installations of `@event4u/agent-config` write **only** to
`~/.event4u/agent-config/` (global root) and `agents/.event4u-bridge.yml`
(in-repo marker). The Setup-Wizard and the legacy Installer-GUI
converge on a single `/api/apply` endpoint behind a `schema_version`
discriminator. Per-tool adapters resolve their rules / skills /
commands by reading the bridge marker, expanding `global_root`, and
fanning out from there.

The single project-local exception is `agents/overrides/`, which
remains the canonical place to override or extend a shared skill /
rule / command per [override-management](../../.agent-src.uncondensed/skills/override-management/SKILL.md).

The maintainer-side dev experience is preserved by the
`AGENT_CONFIG_DEV_MODE=1` environment gate documented in
[`docs/maintainers/dev-mode.md`](../maintainers/dev-mode.md). With the
flag set, `scripts/install.py` treats the package repo as both source
and project surface (Phase 3 contract).

## Amendment — 2026-05-30 · user-content exception

The original decision named `agents/overrides/` as "the single
project-local exception". Field work on the global-only hook path
(`road-to-self-update-and-global-hook-resolution`) clarified that a
consumer also legitimately carries two **metadata** artefacts the
tooling writes and maintains:

- `agents/.event4u-bridge.yml` — the bridge marker (already mandated by
  this ADR's Decision; restated here for completeness).
- managed `agents/` entries in the project `.gitignore` — so runtime
  artefacts under `agents/runtime/` stay untracked.

These, together with `agents/overrides/`, are **user content +
metadata pointers**, not distributed content. The global-only
constraint applies to **distributed content** — skills, rules,
commands, hooks, adapters, `.augment/`, `.claude/` — which is never
written into a consumer repo. Consumer tooling (`agent-config
refresh --project` and the wizard's apply step) may create and refresh
the user-content / metadata surface without violating global-only.

Forbidden, unchanged: writing any distributed content into the
consumer repo outside `AGENT_CONFIG_DEV_MODE=1`.

## Amendment — 2026-06-03 · settings-scope correction (ADR-049)

The original Consequences bullet "one source of truth for `personal.*`,
`agent_council.*`, and `personas:`" overstated the global surface and used a
key name that never existed in code. [`ADR-049`](ADR-049-configuration-trust-boundary.md)
(AI-council-converged, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-03)
corrects this:

- The global surface is **secrets** (provider keys, already global) plus the
  curated identity **whitelist** (`MERGEABLE_KEYS`) — not all of `personal.*`,
  not council config, not personas.
- **Council config is NOT on the `MERGEABLE_KEYS` whitelist.** _(Placement
  amended: per [ADR-093](ADR-093-ai-council-config-user-global.md) →
  [ADR-104](ADR-104-ai-council-config-global-only.md) the council config
  is now **user-global** at `~/.event4u/agent-config/settings/.ai-council.yml`,
  never project-local — but it is its own dedicated `.ai-council.yml`, not a
  merged `.agent-settings.yml` key, so it stays off this whitelist.)_ Personas
  stay project-local (version-controlled). The `MERGEABLE_KEYS` whitelist is a
  **security trust boundary**: an untrusted project repo must not be able to
  escalate arbitrary `personal.*` into user scope. Widening the whitelist now
  requires a threat model.
- The council config key name is **`ai_council`** (canonical), never
  `agent_council`. It lives in the user-global `.ai-council.yml` (ADR-104),
  not under `.agent-settings.yml`.

This amendment narrows ADR-020's wording; the global-only **consumer install**
decision (distributed content writes only to `~/.event4u/agent-config/`) is
unchanged.

## Alternatives considered

- **Status quo (project default + global opt-in).** Keeps the drift
  problem; multi-repo developers continue to ship stale
  `personal.*` keys. Rejected.
- **Dual-endpoint `/api/apply` (one per payload shape).** Doubles
  the CSRF + idle-timer surface with no observability gain. Rejected;
  see `gui-wizard § D12`.
- **Per-project bridge YAML pointing to multiple global roots.**
  Enables team-shared globals via NFS but introduces a tenancy model
  the rest of the system is not designed for. Deferred to a future
  ADR; v1 of the bridge marker is single-root.

## Consequences

**Positive.**
- One source of truth for the curated cross-project identity keys
  (`MERGEABLE_KEYS`) and provider secrets. _(Amended 2026-06-03 — the original
  wording named `personal.*`, `agent_council.*`, and `personas:` as global; see
  the settings-scope correction below and [`ADR-049`](ADR-049-configuration-trust-boundary.md): council config + personas stay project-local; the key is `ai_council`.)_
- New skills / rules / commands reach every consumer the moment they
  install or run `task dev:install-global` — no per-repo bump.
- The onboarding wizard becomes the only authoring surface for
  `.agent-user.md`. Three duplicate flows collapse into one.

**Negative.**
- Phase 3 SCOPE_SUPPORT flip is breaking for any tool that still
  hard-codes a project-local lookup. Migration order is locked in
  the roadmap (Phase 5) — `agent-config migrate-to-global` runs the
  perms entry-gate, copies, verifies, then deletes the project
  shadow.
- The bridge marker is a new failure mode: a stale `global_root` on
  disk yields a fail-closed error instead of a silent project-local
  fallback. The trade-off is intentional; silent fallback is what
  produced the drift in the first place.

**Operational.**
- `scripts/lint_global_paths.py` becomes a required precondition for
  `migrate-to-global`. Wrong perms (e.g. `0755` on the global root
  when `0700` is expected) abort the migration before any write.
- The Augment, Claude, and Cursor adapters get free-form-tested by
  the maintainer dev install every CI run, so a regression in the
  bridge-resolver surfaces immediately instead of at consumer time.

## References

- [`ADR-007`](ADR-007-agent-discovery-scopes.md) — discovery scope precedence and the 2026-05-13 global-default amendment.
- [`ADR-018`](ADR-018-trust-and-safety-layer.md) — trust levels and HRR banner; unchanged by this decision.
- [`road-to-global-only-install`](../../agents/roadmaps/road-to-global-only-install.md) — phased rollout, cross-phase gates A1-A7.
- [`consumer-bridge`](../contracts/consumer-bridge.md) — bridge marker schema and reader contract.
- [`gui-wizard § Apply payload`](../contracts/gui-wizard.md#apply-payload--versioning-handshake-road-to-global-only-install-phase-04--d12) — payload discriminator.
