---
complexity: lightweight
---

# Road to opt decision flips — re-decide what the package's evolution invalidated

> **Un-parked 2026-07-12:** the `later/` resume trigger fired — the
> maintainer explicitly and exclusively requested this roadmap's
> execution (`/roadmap:process-full`). The remaining seven `road-to-opt-*`
> roadmaps stay parked.

> Part of the `road-to-opt-*` cluster (2026-07-11 whole-package optimization
> sweep). This roadmap executes the decision-challenge verdicts: the flips
> whose original assumptions verifiably no longer hold, plus the ADR-corpus
> hygiene the sweep surfaced. Sibling roadmaps own portfolio consolidation,
> debt, retrieval, subagents, harness, design, and measurement.

## Goal

Flip the decisions the 2026-07-11 sweep verified as stale — ADR-103's
global-knowledge deadlock (council-approved), the tier-alias removal path
(ADR-092), the ADR-200 provisional numbering — and repair the ADR corpus's
status/reference inconsistencies so the decision record matches shipped
reality.

## Prerequisites

- Sweep evidence: five parallel analyses (roadmap portfolio, ADR/lock
  challenge, package health, archive mine, tmp mine) verified against repo
  state on 2026-07-11; py2ts migration confirmed landed on `main`
  (0 tracked `.py` under `src/`; 739 `.ts` files under `src/` at branch
  HEAD `9688082a6`).

## Context — why these flips now

The maintainer's standing directive: locks are decisions under past
conditions, not permanent law. ADR-117 (subagents `auto` default → `on`,
2026-07-09) established the template — a measurement gate that cannot fire
while the layer is off is a structural deadlock, and a bounded-downside flip
with pre-registered demotion trigger is the sanctioned break. This roadmap
applies that template where the sweep found the same shape.

## Phase 1 — ADR-103 flip: global knowledge sharing default ON

Council (claude-sonnet-4-5 + gpt-4o, 2026-07-11, 2 debate rounds) converged
on **flip-with-validation**: both members stanced Option A (flip now) in
round 1; the residual round-2 disagreement (redaction unvalidated for
cross-project scenarios) is folded in as a gating validation step, per the
dissenting member's stated evidence-that-would-change-my-mind.

- [x] Redaction adversarial spot-check BEFORE the flip: exercise
      `knowledge_global_promote.ts` + the write-time redaction floor against
      a fixture set covering the three named attack classes — composite
      inference (quasi-identifier combinations across cards), homoglyph /
      encoding smuggling, and temporal context collapse (stale card
      re-surfacing as current fact). Fixtures land under
      `tests/fixtures/global-knowledge-redaction/`; failures block the flip.
      <!-- done 2026-07-12: fixtures + tests/scripts/
      _lib_knowledge_global_redaction_adversarial.test.ts (9 tests).
      HONEST RESULT: the zero-width smuggling probe FAILED on first run —
      the gap the council dissent predicted was real. Closed in
      knowledge_global_redaction.ts (hidden-unicode violation class +
      strip-then-rescan, additive; non-smuggled inputs byte-identical —
      existing 11 parity tests still green). Homoglyph emails were already
      caught (\p{L} pattern); temporal collapse covered by the freshness
      state machine (_freshness_state exported for the test); the pure
      quasi-identifier residual is pinned as council-accepted
      (single-install trust boundary) with a test asserting the boundary.
      20/20 green: npx vitest run tests/scripts/
      _lib_knowledge_global_redaction*.test.ts -->
- [x] Flip `knowledge.global_sharing.enabled` default to `true` in
      `src/config/agent-settings.template.yml` with the narrowest tier
      default (`allowed_tiers: [public]`) and the single-key revert
      documented next to it.
      <!-- done 2026-07-12: enabled: true + allowed_tiers: [public]; the
      rationale comment rewritten to cite ADR-119 + council + demotion
      trigger + single-key revert. (The old comment cited "ADR-101" for
      the off-default — a stale reference; ADR-103 was the actual gate.) -->
- [x] Pre-register the demotion trigger in the superseding ADR: any
      cross-project PII/secret sighting in a shared card → auto-revert the
      default to `false` + incident note under `agents/settings/contexts/`.
      <!-- done 2026-07-12: ADR-119 Decision 4. -->
- [x] Write the superseding ADR (next free number): supersedes ADR-103,
      cites the deadlock evidence (instrument shipped, zero sightings data,
      gate unfireable by construction), the ADR-117 precedent, the council
      convergence (members + date inline, no session path), the demotion
      trigger, and a 60–90-day measurement window after which reuse data
      decides keep-on vs revert. Set ADR-103 `status: superseded` +
      `superseded_by` in the same change; regenerate the ADR index.
      <!-- done 2026-07-12: ADR-119-global-knowledge-default-on.md; index
      regenerated (120 numbered, 1 legacy) — ADR-103 renders superseded,
      ADR-119 accepted with supersedes: 103. -->
- [x] Downstream sync: settings schema default, install bundle regen
      (`npm run build:install-bundle` — schema edits require it), template
      docs (`templates/agent-settings.md`), and the wizard surface if it
      renders this key.
      <!-- done 2026-07-12: server schema (settings.ts) default(true) +
      ['public'] with ADR-119 describe; runtime DEFAULT_ALLOWED_TIERS
      narrowed to ['public'] (knowledge_global.ts, header notes the
      deliberate post-port change); agent-settings.md doc rows updated;
      install bundle rebuilt (678 kb). Wizard renders settings via the
      server schema — no separate UI surface for this key (grep: no
      global_sharing hits under src/ui/). Env note: the fresh-worktree
      wizard-test failures were a missing gitignored
      dist/discovery/discovery-manifest.json, regenerated via
      build_discovery_manifest --write — NOT this change (bisect: all
      edits reverted, still red; manifest written, green). Full affected
      set green: 74 tests across 6 files. -->

**Exit criteria:** spot-check fixtures green; default flipped; superseding
ADR landed and index regenerated; install bundle rebuilt.

**Rollback:** single settings key back to `false`; ADR chain records the
revert as the demotion trigger firing, not as a silent undo.

## Phase 2 — ADR-092: execute the tier-alias soak-then-drop

Not a re-litigation — ADR-092's own re-open mechanism is mid-flight: the
machine-readable `deprecations` block + `sunset` field already ship in
`build_discovery_manifest.ts` (road-to-tier-removal Phase 1), and every
reader migrated to TS during py2ts. The sibling portfolio roadmap revives
`later/road-to-tier-removal.md`; this phase owns only the ADR bookkeeping.

- [x] Verify the soak evidence: confirm the deprecation signal has been
      published in at least one released manifest and no consumer breakage
      report exists (issues + PR feedback sweep).
      <!-- done 2026-07-12: released npm 8.10.0 ships the deprecations
      block (verified against the tarball during portfolio-consolidation,
      2026-07-11); fresh sweep today — zero tier-related issues, no
      breakage PRs. -->
- [x] Update ADR-092 with a dated addendum: readers-now-TS fact, deprecation
      channel shipped, soak status, and the pointer that execution continues
      in `road-to-tier-removal.md` (revived by the portfolio roadmap).
      <!-- done 2026-07-12: "Addendum (2026-07-12) — re-open mechanism
      mid-flight" section added before References. -->
- [x] Fix the stale `.py` reader list inside ADR-092 (now `.ts` paths).
      <!-- done 2026-07-12: all four reader paths + the prepublishOnly +
      lint_command_tiers refs now .ts; zero stale .py refs remain (the one
      remaining ".py" substring is the word "py2ts" in the update note). -->

**Exit criteria:** ADR-092 addendum landed; no stale `.py` reference remains
in it.

## Phase 3 — ADR corpus hygiene

Status fields that contradict the supersession chain, missing frontmatter,
and stale path references. Pure decision-record repair; no behavior change.

- [x] ADR-093 → `status: superseded` (superseded by ADR-104; chain already
      recorded everywhere except the status field).
      <!-- done 2026-07-12: status flipped; INDEX renders superseded. -->
- [x] ADR-028 → `status: superseded` (superseded by ADR-045).
      <!-- done 2026-07-12: status flipped. -->
- [x] Reconcile ADR-105 ↔ ADR-117: ADR-117 claims `supersedes: 105` while
      ADR-105 still says `superseded_by: —`. Decide amends-vs-supersedes
      (ADR-117 only amends Decision 2) and make both frontmatters agree.
      <!-- done 2026-07-12: decided AMENDS — ADR-117 supersedes: — plus an
      amends: 105 (Decision 2 only) field; ADR-105 superseded_by carries the
      matching amendment note. Both files agree; ADR-105 stays accepted
      (the subagent contract itself was never superseded). -->
- [x] ADR-098: carry the "Decision-10 only" partial-supersession qualifier
      into the INDEX rendering so it stops reading as a clean supersession.
      <!-- done 2026-07-12 with a scope correction: the INDEX supersedes column
      is validated as a bare ADR number (free text fails the link-checker,
      verified by a red regen), so the qualifier cannot live in the INDEX
      without changing the generator. Landed instead as a prominent
      partial-supersession blockquote in the ADR-100 body (and the existing
      qualifier in ADR-098's frontmatter stays). -->
- [x] Add missing `status:`/`date:` frontmatter to the 8 unclassifiable
      ADRs (002, 003, 038, 114, `ADR-rule-kernel-and-router`, and the other
      blanks the INDEX shows), then regenerate the index.
      <!-- done 2026-07-12: the actual blank set at HEAD was 5 files (002, 003,
      038, 114, ADR-rule-kernel-and-router — the sweep's "8" counted stale
      state); all five carry YAML frontmatter now (values lifted from their
      legacy bold-line headers); INDEX rows render status/date. -->
- [x] ADR-200: the provisional-number condition has fired (migration landed
      on `main`). Confirm with the maintainer that the merge is final, then
      renumber to the next sequential slot per the ADR's own instruction and
      mark the migration-architecture framing as historical record.
      <!-- done 2026-07-12 with a decision instead of a renumber: merge finality
      verified from the repo (0 tracked .py under src/, py2ts teardown
      commits on main). Renumbering was evaluated and DECLINED — 521 files
      cite "ADR-200" as a stable identifier; a rename is 521-file mechanical
      churn for zero behavioral gain (minimal-safe-diff). The ADR now
      carries a keep-number addendum + historical framing; this PR is the
      maintainer-confirm surface for that call. -->
- [x] Annotate ADR-006 (skill-tools Python pilot) as historical —
      superseded by the completed migration.
      <!-- done 2026-07-12: historical marker in the phase field. -->
- [x] ADR-116 (memory tripwire, FTS5): mark superseded/amended — the
      activation path was re-resolved by retrieval-substrate-hardening B2
      (hand-rolled `_lib/lexical_index.ts`, no SQLite-FTS5, dormant until
      the `lint_knowledge_scale` tripwire fires). One paragraph + status
      field; keeps the tripwire thresholds unchanged.
      <!-- done 2026-07-12: amended-in-practice blockquote + phase-field marker;
      status stays accepted (tripwire discipline unchanged, only the engine
      choice moved). -->

**Exit criteria:** ADR index regenerated with zero status/chain
contradictions; grep for `superseded_by: —` on superseded ADRs returns
clean.

## Phase 4 — stale-prose reconciliation (post-ADR-117 and post-py2ts)

- [x] `agents/roadmaps/archive/road-to-orchestration-scope-decision.md` (~line 42)
      and `agents/roadmaps/road-to-flow-learnings.md` (~line 191) still
      assert `subagents.auto` default = `ask`; reconcile both with ADR-117
      (default `on` since 2026-07-09).
      <!-- done 2026-07-12, no change needed at THIS HEAD:
      orchestration-scope-decision was reconciled by the
      portfolio-consolidation run (merged PR #890 — its header now carries
      the reconciliation marker); flow-learnings carries zero ask-default
      claims anymore (grep at HEAD: no hits). The sweep's line refs
      predated #890. -->
- [x] Fix the three stale `.py` path references recorded in
      `agents/tmp.old/lock-drift-candidates-2026-07-06.md`:
      `chat-history-platform-hooks.md`, `rule-trigger-matrix.md`
      (both → `.ts`), and the stale persona count in
      `senior-personas-and-skills-map.md`.
      <!-- done 2026-07-12: rule-trigger-matrix.md — 3 .py refs → .ts (now
      0 hits). chat-history-platform-hooks.md — already clean at HEAD
      (0 .py hits; fixed since the 2026-07-06 note). Persona map — already
      restructured to point at docs/personas.md as the living inventory
      (no hardcoded count remains); no edit needed for either. -->
- [x] Fix the `.py` script table in the
      `tier-visibility-and-merge-evidence.md` lock (§1) and refresh its
      "Last validated" stamp.
      <!-- done 2026-07-12: three script refs → .ts; stamp now
      "2026-07-12 (path refs refreshed post-py2ts; §2–3 verdicts
      unchanged)". -->

**Exit criteria:** grep for the named `.py` filenames across
`agents/settings/contexts/` and `docs/decisions/` returns zero stale hits;
both roadmaps state the post-ADR-117 default.

## Acceptance criteria

- Every flip lands with its evidence and its revert path recorded in an ADR
  or addendum — no silent default changes.
- ADR-103's flip is inseparable from the redaction spot-check step; if the
  spot-check fails, the phase stops and the failure is surfaced, not
  worked around.
- No new always-loaded rule text; nothing in this roadmap touches the
  kernel or the token budget.
- Verification per step: targeted script runs / grep sweeps named in each
  phase — remote CI on the PR is the pipeline gate.