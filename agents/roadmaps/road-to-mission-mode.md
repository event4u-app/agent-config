---
complexity: structural
status: ready
---

# Roadmap: Mission-Mode — named, framework-aware autonomous missions (gated)

**Trigger:** User's explicit #1 ask from the Source-E competitive-harvest — "upgrade
package X → Y (e.g. Laravel 10→11→12) is the perfect autonomous workflow; I want
it for AC". A code-audited external reference (**Source-E**, § Provenance)
implements a gated mission engine (`orch-pipeline`); AC's own `/work` engine
already implements the same gated shape and is stronger. The gap is a thin layer
of **named, framework-aware mission recipes** on top of `/work` — not a new
autonomous runtime.

## Goal

Ship a Mission-Mode layer where a "mission" is a parameterized, framework-aware
recipe (breaking-change knowledge + phase sequence + verification gates)
executed by the **existing gated `/work` engine** — never a new autonomous
runtime, never auto-PR/-push. Prove ONE mission (`/mission:upgrade`,
Laravel 10→11) end-to-end before generalizing. AC beats Source-E via versionable
breaking-change catalogs (Source-E has none), a trusted-mission/user-recipe
security split, a surfaced size-tier, and `/work`'s confidence-band + N=3 +
persisted `.work-state.json` engine.

> **Hard dependency:** `road-to-security-hardening` completes first — a
> mission's trust boundaries are undefined without the threat model + the
> git-discipline enforcement hook (council, 2026-06-15).

> **The one resolved ambiguity (council).** Mission-Mode is **gated
> orchestration, NOT autonomous execution**. AC's Hard-Floor
> (`non-destructive-by-default`) forbids auto-PR/-push regardless. Source-E's
> `orch-pipeline` proves the gated shape (two human gates: after Plan, before
> Commit; everything between flows). The open risk is **implementation**, not
> architecture: can a recipe express a mission with minimal `/work` change, and
> do missions need control-flow beyond a linear gated sequence? Phase 1 is a
> validation PoC that answers exactly that before any build commitment.

---

## Phase 0 — Boundary + manifest + security split (authoring-only)

- [ ] Write `docs/contracts/no-runtime-boundary.md` — the definition every
      mission decision references. **Allowed:** codegen, file I/O,
      multi-turn prompting, git-as-state (AC shells out to git constantly — a
      mission `git commit -m "mission:upgrade step=11 status=ok"` is structured
      logging, not a daemon). **Prohibited:** background processes, cross-session
      persistent state, event loops, polling. **Gray (council-review):**
      conditional branching on prior outputs, file-state within one invocation.
- [ ] Draft a **minimal mission-manifest stub** schema
      (`src/scripts/schemas/mission.schema.json`): `mission`, `inputs`,
      `phases` only. NO advanced features yet (no loop, no size policy) — extend
      after the PoC reveals what is actually needed.
- [ ] Decide + document the **trusted-mission vs user-recipe security split**
      (privilege-escalation risk, council): shipped missions are trusted (may
      invoke skills directly); user/cookbook recipes are sandboxed (may invoke
      missions, not inject skills between mission steps unless a skill is
      explicitly `user_invokable: true`). Record as an ADR (`adr-create`).

## Phase 1 — Validation PoC (decision gate, NOT a build commitment)

A ~2-day validation experiment (council: "PoC measures implementation risk;
the architectural ambiguity is already collapsed"). Deliverable is evidence + a
decision, not shippable product.

- [ ] Implement `/mission:upgrade` for **Laravel 10 → 11 ONLY** as a manifest +
      thin `/work` invocation. Drive the existing gated `/work` engine; no new
      state machine.
- [ ] **Rollback = git** (council): the rollback unit is git commits on a
      provisional branch (`mission/upgrade-…`); a mid-flight failure within the
      N=3 budget reverts the last step, never auto-PRs. Prove revert is
      observable (`git revert` / branch reset), no `.mission-state/` daemon.
- [ ] **Decision doc** (`agents/evidence/`): can the mission be expressed with
      ≤ ~200 LoC calling ONLY existing skills + `/work`? Do missions need
      control-flow (conditional / loop / nested sub-mission) beyond a linear
      gated sequence? If yes → scope the minimal control-flow addition; if no →
      missions stay simple parameterized sequences. **This gate decides Phase 2.**

## Phase 2 — Flagship `/mission:upgrade`, productized (single-step)

Only after the Phase 1 gate. Ship the one proven mission well before the others.

- [ ] Productize `/mission:upgrade` for single major-version steps (10→11,
      11→12 as separate invocations the user sequences) under `/work`'s gates.
- [ ] **Versionable breaking-change catalog** as YAML data (council — better
      than Source-E, which has none): `src/missions/upgrade/laravel-*.yaml`
      listing breaking changes per major, so the mission validates against
      structured, diffable, CI-testable data — not prose buried in a skill.
- [ ] **Surface the size-tier** (Source-E ADAPT): the mission states its
      `trivial|small|standard|large` classification in one line so the user can
      override; security-trigger / public-API touch forces ≥ standard.
- [ ] ADOPT Source-E's `laravel-verification` phase-sequencing (build → typecheck
      → lint → test → coverage gate) as the mission's verification phase, reusing
      AC's `quality-tools` + `verify-completion-evidence`.
- [ ] Provisional-branch pattern for the (optional) multi-step chain: commits
      land on `mission/upgrade-in-progress`; the final merge to the working
      branch requires user confirmation (preserves no-auto-PR).
- [ ] A named cookbook recipe + `src/flows/` entry for the mission so it shows
      up in the generated cookbook; a verification test asserts the mission's
      command/skill refs resolve (reuse the `generate_cookbook` validation
      pattern).

## Phase 3 — Mission catalogue expansion

Each mission is a recipe on the proven engine; add once the flagship is solid.

- [ ] `/mission:phpstan-raise` — raise Larastan/PHPStan level with fixes (not a
      baseline dump), reusing the `quality-tools` + PHP skills.
- [ ] `/mission:n-plus-one-audit` — Eloquent N+1 detection + eager-load fixes
      (reuse `eloquent`, `performance-analysis`).
- [ ] `/mission:pest-migrate` — PHPUnit → Pest incremental (reuse `pest-testing`).
- [ ] `/mission:fat-controller-cleanup` — extract controller logic to
      actions/services/requests (reuse `php-service`, `architecture-review-lens`).
- [ ] `/mission:dead-code-removal` — ADOPT Source-E's `refactor-clean`
      tiered/test-verified deletion loop (reuse `tech-debt-tracker`,
      `code-refactoring`); never deletes without test-green proof.

---

## Deferred (trigger-gated)

> Not started until a trigger fires; `[~]` = deferred, not abandoned.

- [~] **Stack-generic missions** (PHP-version upgrade, Symfony-component upgrade,
      Next.js/React contract audit). **Trigger:** the Laravel missions land +
      ≥ 2 consumer requests for a non-Laravel mission.
- [~] **Control-flow DSL for missions.** **Trigger:** Phase 1 gate proves a
      linear gated sequence is insufficient AND ≥ 3 missions need branching/loops
      that a manifest cannot express. Until then, missions stay linear (the
      `/work` engine owns the loop/retry within a phase).

---

## Acceptance criteria

- [ ] `docs/contracts/no-runtime-boundary.md` + mission-manifest stub schema +
      trusted-mission/user-recipe ADR landed (Phase 0).
- [ ] Phase 1 PoC decision doc recorded (LoC + control-flow findings); the
      gate decision is explicit before any Phase 2 work.
- [ ] `/mission:upgrade` (Laravel single-step) ships gated, git-rollback,
      breaking-change catalog as YAML, size-tier surfaced, with a resolving
      cookbook entry + verification test. **Never auto-PRs/-pushes.**
- [ ] Phase 3 missions land only after the flagship is proven; each reuses
      existing skills (no new per-language agents — `persona-governance` +
      `framework-neutrality` hold).
- [ ] No daemon, no cross-session persistent state introduced
      (`no-runtime-boundary` honored throughout).

## Council notes (2026-06-15, two rounds, deep + peer-review)

Round 1 (Source-E harvest prioritization) flagged a **category error**: "mission" is
not a third thing between interactive tooling and autonomous runtime — it is one
of those wearing a disguise. Round 2 (mission-mode shape, grounded in Source-E's
actual `orch-pipeline`) resolved it: the **gated** shape is proven (Source-E +
AC's `/work`), so the architectural ambiguity is collapsed; what remains is
**implementation risk** → a 2-day **validation PoC** (Phase 1), NOT a 2-week
prototype-A-vs-B spike. Sharpest catches: (1) "recipes-on-`/work` with zero
engine change" is unproven — Source-E's `orch-pipeline` is 120 lines of *code*
with control-flow, so the PoC must answer whether missions need control-flow;
(2) **git is already AC's state store** → rollback = git commits on a provisional
branch, no `.mission-state/` daemon; (3) **trusted-mission vs user-recipe** is a
privilege-escalation boundary that must be split up front; (4) breaking-change
knowledge must be **versionable YAML data**, not prose, so missions can validate
against it; (5) ship ONE mission end-to-end before the abstraction for N.

## Provenance

- Source-E (external agent-harness reference, code-audited 2026-06-15;
  maintainer-recoverable via `src/scripts/_lib/link_crypto.py decrypt`):
  `ENC1:KPeL+ygg/jMY1GhTqv0giUX6ZODHZCJEHN6zxZh5VvLwnrNmfGwwhvXN3Pz/N69lIhLQBEojZTwbXkJ7nKW44Dfn1m3JBzimqNcQynvJa7icti4F53l+EWAGMawPzAg=`
- Evidence: gitignored harvest store
  (`agents/.harvest-local/source-e-findings/01-autonomy-orchestration.md`,
  `06-php-laravel-mission.md`). Source-E's `orch-pipeline` = gated 2-human-gate
  state machine, no auto-PR; Source-E has NO actual upgrade mission. AC's `/work`
  already implements the gated engine + confidence-bands + persisted state.
- Council: two live two-member runs (claude-sonnet-4-5 + gpt-4o, deep,
  peer-review, 2026-06-15); convergence inlined above.
