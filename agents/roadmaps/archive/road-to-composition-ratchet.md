---
complexity: structural
status: ready
---

# Road to composition ratchet — stop the falsifiability dilution without resurrecting the skill-DAG

> Every skill added or materially changed after the cutoff ships a structurally
> valid `evals/triggers.json`, enforced by a shrink-only CI allowlist — so the
> trigger-eval coverage ratio can only rise as the catalog grows, with zero
> backfill and zero dependency-edge metadata.

## Goal

Close the protocol→CI gap on trigger-evals: the drafting protocol already
mandates a `triggers.json` stub for new skills, but no gate enforces presence —
`check_trigger_evals` validates only files that exist. Add a presence ratchet
(grandfather the current 221 skills without one; the allowlist may only shrink)
and record the adoption-sequencing gate, so composition-coverage dilution stops
at today's ratio.

## Context

- Round 4 of a recurring external analyst audit (2026-07-08, v8.5.0) found the
  composition-coverage counters flat while the catalog grew: trigger-eval files
  43/264 skills, `requires_skills` 4, `parallelizable` 4 — "die Oberfläche ist
  gewachsen, die Verdrahtung nicht."
- Verified on this checkout: `src/scripts/check_trigger_evals.ts` (wired in
  `taskfiles/ci-fast.yml`) asserts freshness (≤90 days) + structure for
  **existing** `src/skills/*/evals/triggers.json` only — it cannot flag a new
  skill that ships without one. The drafting protocol
  (`src/rules/artifact-drafting-protocol.md` Phase C) requires the stub in
  prose; nothing enforces it.
- Standing lock (council 2026-06-14, settled-by-decision): per-skill
  composition metadata driving auto-chains ("skill-DAG") is killed; reopen only
  on external reproduction showing skill-chain beats flat ≥20% task-success
  where this package demonstrably fails.

## Council notes (2026-07-08, debate · 2 rounds)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o · actual cost $0.12.

- **Convergence:** no batch backfill (synthetic evals without users — both
  members, both rounds); the adoption roadmap sequences next (both); some
  stop-doing/steering discipline on polish features is warranted (both); the
  reopen bar for any dependency-edge work is *documented first-adopter failure
  attributable to missing composition metadata* (both members' closing
  "evidence that would change my mind").
- **Divergence:** gpt-4o held "trigger-evals = different mechanism, ratchet
  new/changed skills" across both rounds; claude-sonnet-4-5 flipped in round 2
  to "catalog-wide edge-annotation is the killed skill-DAG's declaration burden
  without the automation payoff; a 'composition-claim'-triggered ratchet is
  circular and unenforceable — reply-only, wait for real-consumer data."
- **Host resolution (convener verdict, evidence-based):** the round-2
  enforceability objection is valid against a judgment-based trigger but not
  against a *presence* gate — "every new skill needs `triggers.json`" requires
  no composition-claim interpretation, and the stub duty already exists in the
  drafting protocol (`src/rules/artifact-drafting-protocol.md` Phase C). The
  round-2 conflation of trigger-evals with dependency edges is factually wrong:
  `triggers.json` encodes should/should-not-fire phrasings (activation), not
  inter-skill edges. Dependency-edge backfill stays dead under the 2026-06-14
  lock.
- **Lock re-affirmed** — scope: catalog-wide `requires_skills` /
  `parallelizable` / dependency-edge annotation for composition purposes (any
  framing, including "falsifiability wiring"). revisit-if: a documented
  first-adopter failure attributable to missing composition metadata, or the
  original lock's external ≥20% reproduction. Settled-by-decision.
- **New disposition** — scope: batch backfill of `triggers.json` over the
  grandfathered skill set. Rejected. revisit-if: real consumer misfire data
  names specific skills (backfill exactly those). Settled-by-decision.

## Gap-table (analyst proposals → scope)

| Analyst item | Verdict | Where |
|---|---|---|
| Wire `requires_skills`/`parallelizable` edges across catalog | CUT | 2026-06-14 lock applies (mechanism match confirmed); reply cites reopen condition |
| Expand trigger-evals across the existing catalog (backfill) | CUT | synthetic without users; revisit on real misfire data |
| Keep composition falsifiable as the catalog grows | KEEP | Phase 1 presence ratchet (new/changed skills only) |
| Expand `context_spine` coverage | CUT | orchestration plumbing; owned by the subagent-value follow-up roadmap |
| Stop polishing before the first user exists | FOLD | Phase 2 sequencing gate + `road-to-adoption-without-narrative-debt.md` executes next |

## Prerequisites

- [x] Confirm the grandfather count on the execution checkout (expected 221 =
  264 skills − 43 with `evals/triggers.json`; recount before freezing the
  allowlist). <!-- verified 2026-07-08: 264 total, 43 with triggers.json, 221 grandfathered -->

## Phase 1 — Trigger-eval presence ratchet (CI)

- [x] **1.1 — Freeze the grandfather allowlist** — generate
  `src/scripts/trigger_eval_grandfather.json` listing every skill directory
  currently lacking `evals/triggers.json`, sorted, with a header comment naming
  this roadmap and the shrink-only contract. <!-- frozen 2026-07-08: 221 entries, `_note` field carries the contract (JSON has no comments) -->
- [x] **1.2 — Presence gate** — `src/scripts/check_trigger_eval_presence.ts`:
  every skill under `src/skills/` must either appear in the allowlist or carry
  an `evals/triggers.json` that passes the existing structural smoke from
  `check_trigger_evals.ts`. Fail (exit 1) on: a skill missing from both sets, an
  allowlist entry that no longer exists as a skill (stale), or an allowlist
  entry that HAS a triggers.json (must be removed from the list — shrink-only
  ratchet). Print the coverage ratio.
- [x] **1.3 — Wire into CI** — add the gate to `taskfiles/ci-fast.yml` next to
  the existing `check_trigger_evals` task; run the new gate once locally, green
  on the current tree and red on a synthetic new skill without triggers.json
  <!-- carve-out: new-gate-verification -->. <!-- verified 2026-07-08: red on synthetic stub-less skill (exit 1), red on shrink violation (exit 1), green on live tree + via `task check-trigger-eval-presence` (exit 0); wired in taskfiles/ci-fast.yml + both Taskfile.yml aggregates -->
- [x] **1.4 — Close the protocol loop** — one line in
  `src/skills/skill-writing/SKILL.md` § eval stub duty noting the stub is now
  CI-enforced (presence gate), then `/condense` for the touched sources.
  <!-- done 2026-07-08: § 1c skip-path now names the presence gate; dist re-condensed, check_condensation zero errors, hashes in sync -->

Exit criteria: gate red-tested against a stub-less synthetic skill and green on
the live tree; allowlist frozen with count printed; coverage ratio can only
rise (removing a triggers.json or adding a skill without one fails CI).
Rollback: drop the task from `taskfiles/ci-fast.yml`, delete the gate script +
allowlist; no other surface touched.

## Phase 2 — Adoption-sequencing gate (recorded discipline)

- [x] **2.1 — Record the stop-doing gate in
  `road-to-adoption-without-narrative-debt.md`** (roadmap→roadmap reference is
  allowed): a body note under its goal — no new settings-UI / theming /
  config-management polish features ship while that roadmap has open phases;
  exceptions: bug fixes, completing broken first-run flows, CI/claims
  infrastructure. Exit condition of the gate: 3 documented external adoptions
  OR the roadmap is archived. Label it honestly as maintainer discipline
  (advisory, no CI teeth). <!-- done 2026-07-08: note landed under that roadmap's Goal -->
- [x] **2.2 — Sequencing decision** — same note records:
  `road-to-adoption-without-narrative-debt.md` is the next roadmap to execute,
  per council convergence 2026-07-08 (analyst critique 2 accepted).
  <!-- done 2026-07-08: same note, first sentence -->

Exit criteria: the adoption roadmap carries the gate note + sequencing line.
Rollback: revert the note.

## Acceptance criteria

- A new skill without `evals/triggers.json` fails CI; the current tree passes.
- The grandfather allowlist exists, is shrink-only by mechanism, and its count
  is printed by the gate (no public "coverage" claim beyond the printed ratio —
  claims discipline unchanged).
- Zero backfilled `triggers.json` files land via this roadmap.
- Zero `requires_skills` / `parallelizable` annotations land via this roadmap.
- The adoption roadmap carries the sequencing note + polish gate.

## Provenance

Source: round 4 of a recurring external analyst audit of this package against a
category peer, delivered in-chat 2026-07-08; no external link exists. Peer kept
anonymous per source-confidentiality.
