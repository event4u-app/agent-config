---
adr: 049
status: accepted
date: 2026-06-03
decision: configuration-trust-boundary
supersedes: —
superseded_by: —
phase: v6.0.0 · settings-scope hardening
type: decision
---

# ADR-049 — Configuration trust boundary: the user-global whitelist is a security boundary

## Status

**Accepted** · 2026-06-03. **Council-config *placement* superseded by
[ADR-093](ADR-093-ai-council-config-user-global.md) → [ADR-104](ADR-104-ai-council-config-global-only.md)**
(council config now lives user-global at
`~/.event4u/agent-config/settings/.ai-council.yml`, never project-local).
The **trust-boundary decision below still stands**: `ai_council` is not on
the user-global *settings merge whitelist* (`.agent-settings.yml` keys) —
the council reads its own dedicated `.ai-council.yml`, not a merged
settings key. Wherever this ADR says council config "lives project-local",
read "lives user-global per ADR-104".

Locks the AI-council convergence
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode + peer-review,
2026-06-03) on where the source of truth for personal preferences and AI-council
configuration lives. Refines [`ADR-020`](ADR-020-global-only-consumer-scope.md)
(global-only consumer scope) and sits alongside
[`ADR-038`](ADR-038-canonical-settings-path.md) (canonical project settings
path) and the resolver cascade in `scripts/_lib/agent_settings.py`.

## Context

[`ADR-020`](ADR-020-global-only-consumer-scope.md) framed its consequences as
"one source of truth for `personal.*`, `agent_council.*`, and `personas:`",
which read as a mandate to push personal preferences, council configuration, and
personas into the **user-global** layer (`~/.event4u/agent-config/`). The
implementation never did this: the loader's user-global layer is **whitelist-
filtered** to a small curated set (`MERGEABLE_KEYS` = `name`, `ide`,
`rule_loading_tier`, `memory.cadence`, `personal.bot_icon`, `personal.autonomy`,
`telegraph.speak_scope`); everything else in a user-global file is silently
ignored. `ai_council` is not on the whitelist, and council configuration lives
project-local in `agents/settings/.ai-council.yml` (per
[`ai-council-config`](../contracts/ai-council-config.md), the Phase-0 single
source of truth).

The maintainer questioned whether that project-local placement is a bug. The AI
council was asked to decide and **converged** that it is **not** a bug — the
whitelist is a deliberate **security trust boundary**, and ADR-020's
"everything global" framing was aspirational overreach the implementation
correctly rejected. The decisive argument is the **untrusted-project escalation
test**: if `ai_council` or arbitrary `personal.*` keys cascaded from any layer a
project repo controls, a cloned repo could set `personal.autonomy: full` or point
a provider key at an attacker endpoint and have it silently inherited into the
user's scope. Only a whitelist that filters what a project may escalate survives
that test. Two further arguments hold even under this package's team-internal,
all-repos-trusted reality: workflow configuration (council member selection,
personas, rule tier) **belongs in version control**, and onboarding stays clean
(`clone → install → correct config`) without out-of-band global state.

## Decision

1. **The `MERGEABLE_KEYS` whitelist is a security trust boundary**, not a feature
   gate. Project-controlled layers (repo-root, intermediate, CWD, and the
   user-global file *when populated from an untrusted source*) may only escalate
   the curated identity keys on the whitelist into the merged settings. Every
   other key resolves **project-local**.

2. **Council configuration and personas stay project-local.** The canonical home
   for council config is `agents/settings/.ai-council.yml`
   ([`ai-council-config`](../contracts/ai-council-config.md)); personas live in
   the project surface. Neither is a user-global concern.

3. **Only secrets and the curated identity whitelist are global.** Provider API
   keys already live global in `~/.event4u/agent-config/<provider>.key` (0600);
   the whitelist carries cross-project user identity (`name`, `ide`, autonomy,
   bot icon, rule tier, memory cadence, telegraph scope). This is the complete
   global surface.

4. **Expanding the whitelist requires a threat model, not just product
   rationale.** Any future PR that adds a key to `MERGEABLE_KEYS` must state, in
   an ADR, why an untrusted project escalating that key into user scope is safe.

## Consequences

- **Positive.** The untrusted-project escalation hole is closed by construction.
  Council config and personas are diffable and reviewable in git. The
  global surface stays minimal and auditable (`~/.event4u/agent-config/`).
- **Naming.** ADR-020's `agent_council.*` is corrected to `ai_council` and
  dropped from the "global" list — see the ADR-020 amendment. `ai_council` is the
  single canonical key; the standalone `.ai-council.yml` file is its canonical
  home; the `ai_council:` block in `.agent-settings.yml` is the Phase-0
  one-line breadcrumb only.
- **No code change required.** The loader already implements this boundary; this
  ADR documents it as load-bearing so a future contributor does not "fix" the
  whitelist by widening it without a threat pass.
- **Dev-mode is unaffected.** `AGENT_CONFIG_DEV_MODE=1` treats the package repo
  as its own project surface; project-local council/persona files there are the
  test fixtures, not a workaround — see the ADR-038 amendment.

## Alternatives considered

- **Make `ai_council` + `personal.*` global (implement ADR-020 literally).**
  Rejected by the council: reintroduces the untrusted-project escalation hole and
  moves version-controllable workflow config out of git. Even under a fully
  trusted team-internal scope the version-control and onboarding arguments stand.
- **Split identity vs workflow into two new files
  (`.agent-identity.yml` / `.agent-workflow.yml`).** Rejected: the whitelist
  already is the boundary; new filenames add migration debt and a "which file do
  I edit?" cognitive load without closing any gap the whitelist leaves open.
- **Status quo, undocumented.** Rejected: the gap between ADR-020's wording and
  the implementation is exactly what triggered the "is this a bug?" question; an
  undocumented boundary invites a future well-meaning widening.

## References

- AI-council convergence: anthropic/claude-sonnet-4-5 + openai/gpt-4o, design
  mode + peer-review, 2026-06-03 (hybrid / security-bounded model).
- [`ADR-020`](ADR-020-global-only-consumer-scope.md) — global-only consumer scope; this ADR refines its "global source of truth" wording.
- [`ADR-038`](ADR-038-canonical-settings-path.md) — canonical project settings path; dev-mode amendment added there.
- [`ai-council-config`](../contracts/ai-council-config.md) — `.ai-council.yml` as the Phase-0 single source of truth for council config.
- `scripts/_lib/agent_settings.py` — `MERGEABLE_KEYS` whitelist and the resolver cascade this ADR locks.
