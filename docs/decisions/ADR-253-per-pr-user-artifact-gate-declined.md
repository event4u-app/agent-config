---
adr: 253
status: accepted
date: 2026-09-04
decision: per-pr-user-artifact-gate-declined
supersedes: —
superseded_by: —
phase: road-to-meta-ratio-measured · Phase 1.1
type: structural
reopen_policy: directional
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/roadmaps/road-to-meta-ratio-measured.md
    - agents/evidence/reports/release-mix-baseline.md
    - agents/evidence/reports/release-mix-14.15.0.json
    - agents/evidence/reports/release-mix-14.16.0.json
    - src/scripts/measure_release_mix.ts
    - src/scripts/release_mix_taxonomy.json
review_trigger: >-
  Reopen on either of two observations, each of which refutes a premise this
  record rests on rather than merely arguing against it. First — a same-PR
  user-artifact gate is demonstrated somewhere to change what a release
  contains rather than how a pull request is packaged, since "it measures
  packaging, not progress" is the whole basis of the decline and one worked
  counter-example refutes it. Second — the published release-mix ratio does not
  move across two consecutively measured releases after the response obligation
  has been in force for both, which falsifies the claim that a release-level
  measurement with an attached response is a sufficient replacement; that
  observation escalates to a RELEASE-level gate, never to the per-PR shape.
  Explicitly NOT a reopen trigger: a third request for the same per-PR rule with
  no new mechanism argument. This record is the answer to that request.
---

# ADR-253 — the same-PR user-artifact gate is declined; the release mix is measured instead

## Status

**Accepted.** Decided by AI council, 2026-09-04, 2/2 convergent
(anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, quorum 2/2,
$0.00 — both seats subscription-authed, nothing billed). Both seats declined
the proposal on the same two grounds and both specified the same replacement
shape. A second round on 2026-09-04, same seats, same quorum, ruled on the
four implementation questions the replacement left open; its rulings are
recorded in the Consequences below.

## Context

An external multi-model review round asked, in two consecutive cycles, for one
rule: **no meta/governance feature without a user-facing artifact in the same
pull request.** The second ask carried its own prediction — that two tidy
cycles of not doing it would itself be the signal that the meta layer outranks
the cap.

Verified against the tree before the council ran, and re-verified at
`b75d7f7cb`: no such rule or gate exists in `src/rules/`, `docs/contracts/` or
`.github/workflows/`. Nothing owns the request. The nearest existing mechanism,
`check_estate_count`, caps the *number* of active roadmaps and is silent on the
governance-versus-product mix of anything. `inventory_meta_layers.ts` is a
read-only discovery pass and enforces nothing.

So the request had met silence twice, and silence is not a decision. This
record ends that, in the direction the council chose rather than the direction
the reviewer asked for.

## Decision

**The per-PR user-artifact gate is declined.** It is not deferred, not
scheduled, and not softened into a maybe. The mechanism is rejected, on
mechanism rather than on threshold, for two reasons both seats gave
independently:

1. **It measures packaging, not progress.** A single one-line consumer-surface
   edit legitimises an otherwise governance-only pull request and leaves the
   release-level imbalance exactly where it was. In codex's words: *"a same-PR
   gate measures packaging, not progress."* The gate would be satisfiable
   without changing what any release contains, which makes it a formatting
   requirement wearing an outcome requirement's clothes.
2. **It rejects legitimate work by construction.** A CI fix, a dependency bump,
   a security patch and an analysis round that produces only roadmaps are all
   real work with no consumer surface. A rule that must be waived for whole
   classes of legitimate change is a rule that will be waived, and a waiver
   habit is worse than no rule.

**In its place: the governance-versus-product mix is measured at release level,
published, and carries a written response.** Three parts, all shipped with this
record:

- **A versioned path→category mapping as data** —
  `src/scripts/release_mix_taxonomy.json`, four categories (`consumer`,
  `governance`, `maintenance`, `unclassified`) plus `mixed` for a commit
  touching more than one. Versioned so a later reading is comparable to an
  earlier one rather than being compared across two different rulers.
- **A classifier that reads changed paths, never commit subjects** —
  `src/scripts/measure_release_mix.ts`, publishing a commit view and a diff
  view as machine-readable JSON and as a human summary, with generated
  projections and lockfiles excluded by name from both.
- **A response obligation, in force from the first reading** — recorded in
  [`CHANGELOG-conventions`](../contracts/CHANGELOG-conventions.md) and enforced
  for completeness (never for the ratio) by `check_release_highlights.ts`.

**No threshold is committed to this repository.** Both seats refused to pick
one on a single cycle, and the reviewer's *"more than half the cycle"* carries
no denominator. The first two readings are published as levels, not verdicts.

## Consequences

**The response obligation binds now, not after a threshold.** When
governance-only commits strictly outnumber consumer-only commits over a release
span, the release notes carry a written response naming either the next cycle's
consumer work or a maintainer justification. Strict inequality is the trigger;
both seats named it explicitly when asked whether the inequality was soft.
Measurement without a consequence becomes ceremonial — codex's word — so the
consequence ships in the same change as the measurement.

**The escalation condition, and what it excludes.** If the published ratio does
not move across two measured releases with the response obligation in force, a
**release-level** gate is reconsidered. The per-PR shape is not reconsidered by
that escalation, at any ratio: it is declined on mechanism, and a mechanism
does not become correct because the number it would not have fixed got worse.

**Four implementation rulings**, from the second council round, recorded here
because each is a place a later reader would otherwise re-argue:

- *No CI workflow.* A gate with no threshold is either a no-op or a smuggled
  threshold. The measurement publishes; it does not block on the number.
- *The obligation lives in the release contract, not in a rule.* A rule fires on
  an agent's prompt; a release is cut by a script and reviewed by a human. The
  surface that is read at the moment the obligation binds is the changelog
  contract plus the existing highlights checker.
- *The two baseline readings are taken retrospectively.* Over already-cut
  ranges, with the taxonomy locked before the numbers were computed. codex
  named four biases a retrospective reading carries that a prospective one does
  not — taxonomy-selection, history-shape, survivorship, and the absence of a
  behavioral response from contributors who could not see the metric — and
  both seats still preferred publishing now to waiting two cycles, which is
  close to the two cycles of nothing the reviewer predicted.
- *Generated projections are excluded from both views.* `dist/` is a byte-exact
  projection of `src/` in this repository. A commit left with nothing after the
  exclusion is counted as a `generated_only` diagnostic rather than as
  maintenance, so the ratio does not depend on whether a regeneration was
  committed separately from the source edit that caused it.

**Two readings are a floor for discussion, not for a threshold.** anthropic
asked for four to five readings before any threshold conversation, on the
ground that commit counts are sensitive to squashing and commit hygiene and
that two points establish a level but not a variance. That is adopted: nothing
in this record authorises setting a number after the second reading.

**What the first two readings actually say.** Both trip the obligation. 14.15.0
reads governance-only 3 against consumer-only 1; 14.16.0 reads 16 against 6.
The reviewer's complaint is substantiated by the measurement that replaced the
reviewer's proposed remedy, which is worth stating plainly: the decline is of
the mechanism, not of the concern.

## Alternatives considered

- **Adopt the per-PR gate as asked.** Rejected on the two grounds above.
- **Adopt it advisory-only.** Rejected: this repository has a measured record of
  advisory markers being ignored eighteen times across five consecutive
  releases before the corresponding gate was made blocking
  (`check_release_highlights`, reversed 2026-09-01). An advisory version of a
  mechanism that is wrong anyway is worse than none.
- **Publish the measurement with no response obligation.** Rejected by both
  seats as the way the replacement fails — a published ratio nobody must answer
  for is a number in a file.
- **Wait for two future releases before publishing anything.** Rejected: it
  delays the whole mechanism by two release cycles, which is the behavior the
  reviewer predicted.
- **Classify from commit subjects.** Rejected: subjects are mutable,
  inconsistently formatted, and can contradict the files a commit touches. The
  classifier reads paths, and a test rewrites a subject and asserts the reading
  is unchanged.

## Evidence

| Claim | Basis |
|---|---|
| No per-PR user-artifact rule or gate exists | `git grep -iE 'user-facing artifact\|anwender-artefakt\|meta.*feature.*same PR' b75d7f7cb -- src/rules docs/contracts .github/workflows` → 0 hits |
| The nearest gate caps roadmap count, not mix | `src/scripts/check_estate_count.ts` |
| Both seats declined the per-PR gate, 2/2 | AI council 2026-09-04, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, quorum 2/2, $0.00; convergence inlined in `agents/roadmaps/road-to-meta-ratio-measured.md` § What was asked |
| Both seats ruled A/A/A on shape, obligation surface and retrospective baselines | AI council 2026-09-04, same seats, 2 rounds, quorum 2/2, $0.00; convergence inlined in `agents/evidence/reports/release-mix-baseline.md` § Council convergence |
| 14.15.0 reads governance-only 3 vs consumer-only 1 | `agents/evidence/reports/release-mix-14.15.0.json` |
| 14.16.0 reads governance-only 16 vs consumer-only 6 | `agents/evidence/reports/release-mix-14.16.0.json` |
| Every tracked path resolves to exactly one category or to an explicit `unclassified` | `measure_release_mix --audit` → 9337 tracked paths over 90 classification units, 0 unmatched |
| Classification is subject-independent | `tests/scripts/measure_release_mix.test.ts` — amends a commit subject, asserts the reading is unchanged |
| `mixed` is not collapsed | same test file; sensitivity confirmed by collapsing `mixed` into its first category, which reds the case |
| An advisory marker in this repository shipped ignored 18 times | `src/scripts/_lib/release_highlights.ts` header, re-derived at `b50b27281` |

**Evidence this record does NOT have.** No reading exists for a release cut
*after* the response obligation came into force, so the claim that an attached
response changes behavior is untested. That is the second reopen trigger
above, and it is the reason no threshold is set here.

## References

- `agents/roadmaps/road-to-meta-ratio-measured.md` — the roadmap this record closes.
- [`CHANGELOG-conventions`](../contracts/CHANGELOG-conventions.md) § Governance-versus-product response — the obligation's text.
- `src/scripts/measure_release_mix.ts`, `src/scripts/release_mix_taxonomy.json` — the mechanism.
- `agents/evidence/reports/release-mix-baseline.md` — the two published readings.
