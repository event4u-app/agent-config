---
stability: stable
---

# ADR — Level-6 Productization Closure

> **Status:** Decided · 2026-05-14
> **Context:** Closure record for `road-to-productization.md` and its
> two sibling roadmaps (`road-to-proof-not-features.md`,
> `road-to-better-skills-and-profiles.md` Block A). PR #43 lifted the
> package from Level-4 (execution engine) to Level-5 (observable
> decision system); this roadmap was the Level-5 → Level-6 jump:
> **steerable + provable + onboardable**.
> **Cross-links:**
> [`road-to-productization.md`](../../agents/roadmaps/road-to-productization.md) ·
> [`road-to-proof-not-features.md`](../../agents/roadmaps/archive/road-to-proof-not-features.md) ·
> [`road-to-better-skills-and-profiles.md`](../../agents/roadmaps/archive/road-to-better-skills-and-profiles.md).

## What shipped

### Decision-Engine steerability (Phase 2)

- [`decision-engine-gates.md`](decision-engine-gates.md) — additive
  `decision_engine:` block in `.agent-settings.yml` with
  `min_confidence`, `block_on_risk`, `require_memory_hits`, `on_block`,
  `ask_timeout_seconds`, `on_block_fallback`. Absent block = unchanged
  observe-only behaviour.
- Gate-conflict resolution matrix (P2.1a) + non-TTY timeout fallback
  (P2.1b) shipped before the gates themselves; the engine refuses to
  evaluate downstream gates after the first rejection and falls back
  to `on_block_fallback` in non-interactive contexts.
- Confidence-band gate (P2.2) and risk-class gate (P2.3) wired into
  the scoring path. Memory-required policy (P2.4) unblocks on P6.2
  shipping (`affected` keys in the decision trace).

### UX simplification (Phase 3)

- README "Quickstart" block — install → `/onboard` → `/work "first
  real task"`, contributor detail moved below the `## For contributors`
  fold.
- Default `cost_profile` flipped from `minimal` to `balanced`;
  rationale in [`cost-profile-defaults.md`](cost-profile-defaults.md).
- `/onboard` step 11 prints the Quickstart command list inline.
- CI gate: `task smoke-quickstart` runs the installer into a tmpdir
  and validates the documented default surface deterministically.

### Multi-stack skill depth (Phase 4)

- `symfony-workflow` skill (~8.6 KB) — DI, Doctrine, Messenger,
  voters, Twig, console.
- `nextjs-patterns` skill (~9.9 KB) — App Router, RSC boundaries,
  Server Actions, caching, route handlers, 14.x↔15.x deltas.
- README stack table now separates Symfony / Next.js / Zend-Laminas
  rows; "Deepest reference stack" paragraph names the workflow-grade
  second tier explicitly.

### Architecture cleanup (Phase 5)

- Auto-rules (`non-destructive-by-default`, `scope-control-policy`)
  audited: already refactored to trigger + Iron Law + pointer shape;
  bound by the kernel-budget linter at 4 000-char override ceiling
  (P5.1).
- Rule-Interaction matrix marked rule-only by design;
  [`rule-interactions.md`](rule-interactions.md) § "Out of scope —
  orchestration surfaces" points at `decision-engine-gates`,
  `decision-trace-v1`, `agent-memory-contract`, `memory-visibility-v1`,
  and the `ai-council` skill for Council × Memory × Work-Engine
  interactions (P5.2).
- `type: orchestrator` frontmatter tag exempts cluster routers from
  the `command_missing_skill_references` linter check; 15 commands
  carry the tag (P5.3).
- Beta-review marker protocol shipped in [`STABILITY.md`](STABILITY.md)
  § Beta-review markers; `scripts/check_beta_review_markers.py` wired
  into `task ci`; 39 beta contracts back-filled (P5.4).
- Test-redundancy audit produced
  [`road-to-test-cleanup.md`](../../agents/roadmaps/road-to-test-cleanup.md)
  — audit-only, no deletions (P5.5).

### Release-trunk discipline (Phase 1)

- [`release-trunk-sync.md`](release-trunk-sync.md) protocol; CI gate
  fails the release-prep branch when `main` is more than one tagged
  release behind (P1.3).

### Proof + cognition layers (Phases 6 + 7)

- Memory-consequence in the trace: `affected` keys in
  [`decision-trace-v1.md`](decision-trace-v1.md) (sibling P2.1a–c).
- README three-audience split (sibling P2.2a–c).
- Hook doctor (sibling P2.3).
- Persona spine: Core-tier 5-section + Specialist-tier 7-section
  spines locked in [`persona-schema.md`](persona-schema.md) (sibling
  Block A).

## What got cancelled

- **P6.1 — Three real showcase sessions** (sibling P1.1–P1.4).
  Cancelled upstream — capturing real host-agent sessions requires a
  hosted-LLM runner that is out of scope for this roadmap. P1.0
  pre-flight shipped; the capture surface is ready when a runner
  exists. Reopen as `road-to-showcase-capture.md` once a runner is
  on the table.
- **P8.1 — End-to-end Level-6 smoke** — same gating as P6.1.
  Structural coverage (`task smoke-quickstart` + decision-engine
  schema validator + gate-evaluator unit tests) covers the
  configuration surface deterministically; the live smoke remains
  the manual pre-tag gate.

## What stayed beta

39 contracts carry `keep-beta-until: 2026-08-12` (next audit
deadline). None met the 30-day promotion floor at audit time.
First-commit age range: 0–12 days. Audit cap is 90 days from the
audit date; CI rejects undated betas, multiple markers, and
keep-beta-until dates beyond the window.

## What got deferred to siblings

- **Showcase capture** → future `road-to-showcase-capture.md` when a
  hosted-LLM runner is on the table.
- **Test-suite deletion** →
  [`road-to-test-cleanup.md`](../../agents/roadmaps/road-to-test-cleanup.md)
  (audit-only sibling spawned by P5.5; non-destructive by default).
- **Persona Block B** (Architect / Risk-Officer extension) —
  anti-recommended per the sibling closure decision; not deferred,
  closed.
- **Distribution / adoption** →
  `road-to-distribution-and-adoption.md`, gated on this roadmap
  closing (which this ADR records).
- **MCP server work** — own strand, out of scope.

## Consequences

- **Steerable:** the Decision Engine now gates on configurable
  thresholds; the configuration surface is documented and CI-tested.
- **Provable:** memory hits/misses surface as `affected` keys in the
  decision trace; the trace shape is contract-stable.
- **Onboardable:** a fresh user can land at a working `/work`
  invocation in three Quickstart steps without scrolling past the
  fold.
- **Multi-stack credible:** Laravel stays the deepest reference;
  Symfony and Next.js shipped at workflow-grade depth; other stacks
  remain project-analysis-only with the honest delta language in the
  README.
- **Architecturally tidy:** orchestrator commands no longer warn,
  beta contracts cannot rot undated, and the contract surface itself
  carries a periodic review obligation.
