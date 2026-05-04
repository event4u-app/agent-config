---
status: ready
complexity: lightweight
---

# Road to Proof not Features

**Status:** DRAFT — synthesized 2026-05-04 from two external feedback
blocks on PR #41 (internal review + external critique). Awaits AI
Council review and user approval before promotion to READY.
**Started:** 2026-05-04 (capture-only).
**Trigger:** Both feedback blocks converge on the same diagnosis:
PR #41 closed the architecture gap (rated 9.4 / 10) but left the
**proof gap** open — three deferred showcase sessions, memory shown
but its consequence invisible, README still mixes user / contributor
audiences. Internal critique: "the only remaining path to 120/120
runs through the outside world." External critique: "the next PR
should not be a feature PR — it should be a Proof PR."
**Mode:** Single-goal roadmap. Three phases, one deliverable each.
No new architectural surface, no new contracts, no version pinning.

## The single goal

> **Make what we already built provable, explainable, and stable —
> without adding a new system surface.**

Three convergence signals, three phases, in this order:

1. **Beweis** — three real host-agent sessions captured + linted.
2. **Erklärbarkeit** — memory consequence surfaced; README split by
   audience; hook debug commands.
3. **Stabilisierung** — settings-sync subset doc + checker; hook
   concern budget; AI Council out of the user path.

Phase 1 is the unblock. Concretely, three downstream items hard-depend
on it:

- **P2.1b** (memory `affected` field) needs at least one captured
  session whose decision-trace JSON shows a key diverging when a
  memory entry is consulted vs. ignored — otherwise the closed key
  list in P2.1a is theory, not observation.
- **P3.3** (hook concern budget) reads concern counts per event from
  Phase 1 session logs to set thresholds; fewer than 3 real sessions
  → thresholds stay unset (see P3.3 below).
- **P1.4** operator verdict (yes / partial / no) is the only signal
  that tells the team whether Phase 2 is worth doing at all. A
  3-of-3 "no" pauses Phase 2 and triggers a follow-up roadmap.

Phase 2 + 3 do not start until Phase 1 ships P1.4.

## Out of scope (this roadmap)

- MCP server work — `road-to-mcp-server.md` (own strand, own gates).
- Persona spine (Architect / Risk-Officer Block B) — explicitly
  deferred per Block-1 anti-recommendation: no internal infra
  without external user feedback.
- Distribution & adoption (`road-to-distribution-and-adoption.md`)
  — phase-gated on the showcase sessions Phase 1 produces.
- Test-redundancy audit on the 2,318-test suite — long-tail,
  separate roadmap when prioritised.

## Horizon (6-week visible plate)

**Inside the plate:**

- Phase 1 (P1.1–P1.4) — three showcase sessions captured.
- Phase 2 (P2.1–P2.4) — memory consequence + README split + hook doctor.

**Outside the plate (gated on Phase 1 + 2 evidence):**

- Phase 3 (P3.1–P3.4) — settings-sync hardening, concern budget,
  AI Council scoping. Intentionally deferred so real session data
  informs the budget thresholds rather than guesswork.

## Phase 1 — Beweis (3 real showcase sessions)

**Goal:** turn `docs/showcase.md` from "infrastructure-only" into a
page that links to three captured, linted host-agent sessions.
Existing `capture_showcase_session.py` + `lint_showcase_sessions.py`
already compute the four metrics natively (verified 2026-05-04 in
`scripts/capture_showcase_session.py`); `memory_hit_ratio` returns
`None` until hit/miss markers exist in the log shape — see P1.0.

- [ ] **P1.0** — Pre-flight: confirm `capture_showcase_session.py
      metrics` runs against a synthetic log fixture and emits all
      four keys (null is acceptable for `memory_hit_ratio` until
      P2.1). If any other metric returns `None` unexpectedly, fix
      the pattern before P1.1 — three real sessions with broken
      metrics is wasted work. **No new metric implementation here**;
      strictly verification of existing extractors.
- [ ] **P1.1** — Run `/implement-ticket` against a **non-production
      target**: a `Galawork` staging-tenant ticket, a sandbox
      database, or a synthetic ticket on a throwaway branch. Production
      backend is **forbidden** in this phase — see Risk register
      "Beweis Theater". Capture the chat-log, pipe through
      `scripts/capture_showcase_session.py capture`, write to
      `docs/showcase/sessions/implement-ticket-<slug>.log`. Required
      frontmatter: `commit_sha`, `host_agent`, `model`, `started`,
      `ended`, `task_class`, `metrics: {tool_call_count,
      reply_chars, memory_hit_ratio, verify_pass_rate}`.
- [ ] **P1.2** — Run `/work` against a deliberately vague
      stakeholder request (Refine → Plan → Implement) on the same
      non-production target class as P1.1. Same capture + frontmatter
      contract.
- [ ] **P1.3** — Run `/review-changes` against a real local diff
      (or `/fix-ci` against a captured CI failure log if no diff is
      review-ready). Read-only by construction — no production risk.
      Same capture contract.
- [ ] **P1.4** — `docs/showcase.md` gets a "Real sessions" section
      linking the three captured logs. **Per-session outcome line
      must include**: (a) verify-gate pass/fail, (b) `task_class`,
      (c) `verify_pass_rate`, (d) one-sentence "did the agent solve
      it?" verdict written by the operator (binary: yes / no / partial).
      `lint_showcase_sessions.py` must pass — no orphans, no broken
      links, frontmatter complete.

**Exit criterion (lint):** `task lint-showcase` exits 0 with three
linked sessions and `docs/showcase.md` no longer carries "deferred"
notes for 1.3 / 1.4 / 1.5.

**Exit criterion (quality):** at least **two of three** sessions
carry an operator verdict of "yes" or "partial". A 3-of-3 "no"
result is a roadmap-level signal, not a Phase-1 failure: it
triggers a follow-up roadmap "what broke" instead of advancing to
Phase 2.

**Rollback / kill-switch:** if P1.1 or P1.2 modifies state on a
target the operator did not intend (wrong tenant, wrong branch,
non-throwaway data), capture is aborted, the session log is
discarded (no `docs/showcase/sessions/` write), and Phase 1
restarts from P1.0 after the operator documents the miss in the
session manifest.

## Phase 2 — Erklärbarkeit (consequence + audience + debug)

**Goal:** the user can see *why* memory changed an outcome, find
their own onboarding path in the README, and reproduce a hook
failure without platform magic.

### P2.1 — Memory decision consequence (split into three steps)

- [ ] **P2.1a — Trace key set.** Define the closed list of
      decision-trace JSON keys that count as "affected when memory
      changed" (e.g. `test_plan`, `risk_flags`, `confidence_band`,
      `applied_rules`). Document in `docs/contracts/decision-trace-v1.md`
      under a new "Memory consequence keys" section. Closed list,
      not open: keeps the abstraction from leaking into "every
      memory call affects everything" (Risk register row 2).
- [ ] **P2.1b — Surface `affected` field.** Update
      `scripts/work_engine/scoring/memory_visibility.py` and
      `.agent-src/templates/scripts/work_engine/hooks/builtin/memory_visibility.py`
      to compute the diff between "decision-trace with this memory
      consulted" and "decision-trace without it" against the closed
      key list. Output line shape:
      `🧠 Memory: 3/4 · ids=[mem_42, mem_57] · affected: test_plan,risk_flags`.
      Empty `affected` (consulted but no key diverged) renders as
      `· affected: none` so the user sees that the call was
      *informational*, not load-bearing.
- [ ] **P2.1c — Tests + report block.** Unit tests cover three
      cases: (i) consulted-and-applied (≥1 key in `affected`),
      (ii) consulted-but-no-divergence (`affected: none`),
      (iii) entry not consulted (no line at all). Add an end-of-run
      report block: "Memory changed decisions: <id> → <key>" lines
      derived from the same diff source. The report is suppressed
      when zero entries diverged any key.

> **Out of scope for P2.1:** gradations beyond binary key-diverged
> / not-diverged (overridden, combined, filtered). Captured as
> follow-up risk in the Risk register; revisit after Phase 1
> session data shows whether the binary model under-explains real
> outcomes.

### P2.2 — README three-audience split (split into three steps)

- [ ] **P2.2a — Information architecture.** Decide the three
      top-of-README headings: "Use it in your project", "Prove it",
      "Contribute". Map every existing top-of-README block (Start
      here, Quick install, Showcase teaser, Multi-agent tool support,
      etc.) to exactly one of the three branches. No content rewrite
      yet — only an annotated outline committed as `docs/readme-split-plan.md`.
- [ ] **P2.2b — Content migration.** Apply the plan: move blocks,
      keep anchor IDs stable for "Multi-agent tool support",
      "Installation", "Showcase" so existing inbound links survive.
      Top of README = three paragraphs (one per audience), each
      with a single primary CTA. AI Council is **not** mentioned
      in any of the three branches (this is the surface P3.4
      verifies).
- [ ] **P2.2c — Verification.** Re-run `lint-readme` (existing CI
      gate). Add a grep-based test under `tests/` that asserts
      the three audience headings exist in the order
      Use → Prove → Contribute. No regression in `task ci`.

### P2.3 — Hook doctor

- [ ] **P2.3** — `./agent-config hooks:doctor`. Lists registered
      concerns per platform/event from `scripts/hook_manifest.yaml`,
      surfaces fail-open vs fail-closed, last-feedback file per
      concern under `agents/state/`, and any platform whose
      trampoline is missing. Wraps existing `scripts/hooks_status.py`.
      Read-only.

### P2.4 — Hook replay (split into three steps)

- [ ] **P2.4a — Fixture corpus.** Build `tests/fixtures/hooks/`
      with one JSON payload per declared event in
      `scripts/hook_manifest.yaml` (Stop, PostToolUse, …). Each
      fixture is a minimal valid payload that the dispatcher
      accepts without modification. Schema: documented inline in
      `docs/contracts/hook-architecture-v1.md` if not already there.
- [ ] **P2.4b — Replay subcommand.** `./agent-config hooks:replay
      --platform <p> --event <e> --payload <fixture-path>` loads
      the fixture, dispatches through `scripts/runtime_dispatcher.py`,
      prints each concern's exit code + stderr + feedback file.
      **Read-only enforcement:** dispatcher runs with an env flag
      (`AGENT_CONFIG_REPLAY=1`) that the existing concerns honor by
      skipping `agents/state/` writes; concerns that don't honor
      the flag are listed by `hooks:doctor` as not replay-safe.
- [ ] **P2.4c — Tests.** Boot the dispatcher with each fixture in
      replay mode, assert no `agents/state/` mutation, assert exit
      codes match the manifest expectations.

**Exit criterion:** P2.1b visible in a real `/implement-ticket`
session captured under Phase 1.4. P2.2 lands without breaking
existing inbound links. P2.3 + P2.4 covered by tests that boot the
dispatcher with synthetic manifests.

**Rollback / kill-switch:** P2.1b is gated behind a settings flag
(`memory.show_consequence: bool` in `.agent-settings.yml`,
default `true`); if real sessions reveal the `affected` field
misleads more than it helps, flip default to `false` and re-plan
the closed key list. P2.4 is gated by `AGENT_CONFIG_REPLAY=1`; a
concern that mutates state in replay mode is a hard test failure,
not a runtime-tolerable bug.

## Phase 3 — Stabilisierung (deferred, gated on Phase 1 + 2)

**Goal:** harden two surfaces that grew in PR #41 without adding new
ones, and pull AI Council out of the user-facing story before it
widens the product.

**Entry gate:** Phase 1 P1.4 shipped (three sessions linked, lint
green) **and** Phase 2 P2.1b visible in at least one new session.
Without both, Phase 3 does not start.

- [ ] **P3.1** — `docs/contracts/settings-sync-yaml-subset.md`. Lock
      the supported `.agent-settings.yml` subset (scalars, mappings,
      sequences-of-scalars, line comments, no anchors / aliases / multi-
      doc). Pulled out of the ADR's revisit-trigger language so
      contributors have a citable contract.
- [ ] **P3.2** — `./agent-config settings:check`. Validates the
      user's `.agent-settings.yml` against the subset, prints
      "supported / not supported / how to fix" per offending line.
      Read-only.
- [ ] **P3.3** — Hook **concern budget** analogous to always-rule
      budgets: max concerns per event, max execution time per
      concern, fail-closed allowed only for Tier-1 concerns,
      warning when a single event fires more than the threshold.

      **Threshold sourcing** — three real sessions are not a
      statistically meaningful sample. Phase 3 therefore ships the
      budget *mechanism* with the threshold sourced as
      **max(observed-in-Phase-1) × 1.5, rounded up**, and the gate
      runs in **warn-only** mode for the first 6 weeks. Hard-fail
      mode is a separate decision after at least 10 captured
      sessions across host agents (tracked in
      `road-to-distribution-and-adoption.md`, not here).

      New CI gate `lint_hook_concern_budget.py` (warn-only by
      default, hard-fail behind a settings flag).
- [ ] **P3.4** — AI Council surface scoping (product-facing only;
      this roadmap's drafting use of Council is unaffected — see
      Reference). Move `scripts/ai_council/` references out of the
      README's user-facing path; keep `docs/ai-council.md` as a
      maintainer / evaluation page. README "Use it" branch must not
      mention Council. Verify by grep: zero references in the
      top-level README sections owned by P2.2.

**Exit criterion:** `task ci` green with the new `settings:check`
and `lint_hook_concern_budget` gates in warn-only mode. P3.4 grep
returns zero hits in the "Use it" / "Prove it" branches of the
README.

**Rollback / kill-switch:** P3.2 and `lint_hook_concern_budget`
are warn-only by default — if real-world adoption shows false
positives, the rollback is "leave warn-only, do not promote to
hard-fail" rather than reverting code. P3.4 is reversible by
moving Council references back if user research shows the surface
helps adoption (current evidence: it doesn't; revisit only with
new evidence).

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Iron Law 2 (no impersonation): the agent cannot author authentic host-agent transcripts itself | High | Phase 1 sessions must be run by the user as host-agent operator. Agent only assists capture / lint — the conversation itself is real. Documented in `docs/showcase.md`. |
| `affected` set in P2.1 turns into a leaky abstraction (every memory call claims to affect everything) | Medium | Anchor on decision-trace key diff, not on memory metadata. Unit tests cover the "consulted but ignored" case explicitly. |
| README split (P2.2) breaks existing inbound links from blog posts / READMEs of other projects | Low | Keep anchor IDs stable; new headings get IDs that match prior link targets where reasonable. |
| Hook concern budget thresholds (P3.3) chosen too tight, breaks legitimate flows | Medium | Defer until Phase 1 + 2 produce real concern-count data. Phase 3 is explicitly out-of-plate. |
| Phase 1 sessions reveal the system fails on real tickets in ways internal tests didn't catch | High (but desired) | This is the point of the roadmap. A red Phase 1 produces a follow-up roadmap, not a hidden retry. |
| P1.1 / P1.2 run against production data by accident ("Beweis Theater" critique) | High | Hard rule: non-production target only (staging tenant, sandbox DB, throwaway branch, synthetic ticket). P1.1 captures the target classification in frontmatter; lint rejects `target: production`. |
| Memory consequence model is binary (key-diverged / not) and under-explains real outcomes | Medium | Captured in P2.1 "out of scope" note. Revisit after Phase 1 produces session evidence; do not pre-build gradations without data. |
| Three sessions are too few to set system-wide hook concern budgets | Medium | P3.3 ships the mechanism in warn-only mode and sources thresholds as `max(observed) × 1.5`. Hard-fail promotion needs 10+ sessions across host agents — tracked in distribution roadmap, not here. |

## Reference

- `docs/contracts/decision-trace-v1.md` — schema P2.1 reads from.
- `docs/contracts/hook-architecture-v1.md` — manifest + dispatcher
  P2.3 / P2.4 wrap.
- `docs/contracts/adr-settings-sync-engine.md` — revisit-triggers
  P3.1 promotes into a separate subset doc.
- `docs/showcase.md` — Phase 1.4 deliverable surface.
- `scripts/capture_showcase_session.py`, `scripts/lint_showcase_sessions.py` — Phase 1 tooling. Native metric extraction verified 2026-05-04; `memory_hit_ratio` returns `None` until P2.1b emits hit/miss markers, all other metrics work today.
- `scripts/work_engine/scoring/memory_visibility.py` + `.../hooks/builtin/memory_visibility.py` — P2.1 edit sites.
- `agents/council-sessions/proof-roadmap-draft/responses.json` — AI Council critique that shaped this revision (Anthropic + OpenAI, 2026-05-04).

### Two uses of "Council" (do not conflate)

- **Drafting use** — what produced this roadmap revision. The maintainer
  ran `./agent-config council:run` on the draft, applied accepted
  critiques. Council is part of the *maintainer's* toolkit and stays
  there. P3.4 does not affect this use.
- **Product surface** — what P3.4 scopes out. Today's README mentions
  Council in the user-facing path, which widens the product story
  without evidence it helps adoption. P3.4 moves that mention into a
  maintainer-only doc.

## Next step

Apply accepted council critiques (this revision). Promote to
`status: ready` only after user approval. Phase 1 begins as soon as
the user kicks off the first real ticket session.
