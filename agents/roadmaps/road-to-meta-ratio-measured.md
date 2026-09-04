---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `meta`, `ratio`, `inventory_meta_layers` — nothing owns it. The nearest gate,
# check_estate_count, caps the NUMBER of active roadmaps and says nothing about
# the governance-vs-product mix of a release.
estate_offset_exempt: "Cannot be offset, and offsetting it would be the finding. It exists because two consecutive cycles neither built nor declined the request; archiving an active roadmap to make room for the decline would be the third cycle of trading the ask against estate arithmetic, which is the behaviour the reviewer predicted."
estate_growth_exempt: "Adds one active roadmap against a floor of 1. It answers a request an external reviewer made in two consecutive cycles and neither cycle built nor declined — the third silence would itself be the finding. A 2/2 AI-council round supplied the mechanism, which is a release-level measurement rather than the per-PR gate that was asked for, so the deliverable is a script, a mapping and a decision record and does not fit any sibling roadmap in this change. Parking it is the behaviour the reviewer predicted would prove the meta layer outranks the cap."
---
# Road to a measured meta ratio

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0, second consecutive cycle asking for the same rule.
> The mechanism below is the AI council's answer (2026-09-04,
> anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, quorum 2/2), not
> the reviewer's proposal — both seats declined the proposal and specified a
> replacement.

## Goal

The governance-versus-product mix of a release is measured, published and
answerable, and the per-PR rule that was asked for twice is declined in a record
that states why, so a third round meets a decision rather than silence.

## What was asked, and what the council decided

The ask, twice: *"kein Meta-Verwaltungs-Feature ohne Anwender-Artefakt im selben
PR."* The second ask carried its own prediction — *"Wenn ihr es zwei aufgeräumte <!-- md-language-check: ignore -->
Zyklen lang nicht tut, ist das selbst das Signal, dass die Meta-Schicht euch <!-- md-language-check: ignore -->
lieber ist als die Deckelung."*

Verified before the council ran: no such rule or gate exists anywhere in
`src/rules/`, `docs/contracts/` or `.github/workflows/`; nothing owns it; the
nearest gate, `check_estate_count`, caps the *number* of active roadmaps and is
silent on the mix. `inventory_meta_layers.ts` is a read-only discovery pass.

Both council seats declined the per-PR gate, on the same two grounds:

- **It measures packaging, not progress.** A one-line consumer-surface edit
  legitimises an otherwise governance-only pull request and leaves the
  release-level imbalance exactly where it was. codex: *"a same-PR gate measures
  packaging, not progress."*
- **It rejects legitimate work by construction.** A CI fix, a dependency bump and
  an analysis round that produces only roadmaps are all real work with no
  consumer surface.

Both replaced it with the same shape: classify at **release** level, publish, and
attach a mandatory response. Both also refused to pick a threshold now — one
observed cycle is not a baseline, and the reviewer's "more than half the cycle"
carries no denominator.

## Phase 1 — Decline the gate in a record

- [ ] **1.1 Write the decision record.** An ADR stating that the same-PR
      user-artifact gate is declined, with the two grounds above, the council
      round that decided it, and the replacement. A decline that lives only in an
      analysis file is the silence this roadmap exists to end.
      verify: the ADR exists, cites the council date, members and quorum, and
      names the replacement mechanism.

## Phase 2 — Classify a release, from the diff

- [ ] **2.1 Define the path→category mapping as data, not as a regex in a
      script.** Four categories, from the council's converged list: `consumer`
      (shipped skills, rules, commands, guidelines), `governance` (roadmaps,
      evidence ledgers, verdicts, archive and promotion records,
      governance-only docs), `maintenance` (CI, tests, scripts, dependencies,
      packaging, repository infrastructure), and `mixed` for a commit touching
      more than one. The mapping is versioned so a later reading is comparable to
      an earlier one.
      verify: the mapping file exists with a version field, and every top-level
      path in the tree resolves to exactly one category or is explicitly
      unclassified.
- [ ] **2.2 Classify from changed paths, never from commit subjects.**
      Subjects are mutable, inconsistently formatted and can contradict the
      files a commit touches — codex's objection to the cheaper reading.
      verify: the script's classification is unchanged when a commit subject is
      rewritten, pinned by a test.
- [ ] **2.3 Do not collapse `mixed` into product.** Collapsing it recreates the
      exact gaming the declined rule permits: one consumer file makes a
      governance commit read as product.
      verify: `mixed` is reported as its own bucket in both views, and a test
      plants a governance commit carrying one consumer file and asserts it lands
      in `mixed`.
- [ ] **2.4 Publish two views.** A commit view (exclusive counts per category
      plus mixed) and a diff view (added/deleted lines per category, excluding
      generated projections and lockfiles — this repo's `dist/agent-src/`,
      `.augment/`, `.claude/` and `package-lock.json` would otherwise dominate
      every reading).
      verify: both views are emitted as machine-readable JSON and as a human
      summary, and the generated trees are excluded by name.

## Phase 3 — Baseline before threshold, and a response that is owed

- [ ] **3.1 Take a baseline over two releases before choosing any number.**
      Both seats refused a threshold on one cycle. The first two readings are
      levels, not verdicts, and are published as such.
      verify: two readings exist with their release tags, and no threshold is
      committed to the repository before the second.
- [ ] **3.2 Attach the response obligation now, not after the threshold.**
      Effective from the first reading: when governance-only commits outnumber
      consumer-only commits in a release, the release notes carry a written
      response naming either the next cycle's consumer work or a maintainer
      justification. Measurement without a consequence becomes ceremonial —
      codex's word.
      verify: the obligation is written where the release process reads it, and
      the first release that trips it carries the response.
- [ ] **3.3 State the escalation, and the condition that triggers it.** If the
      published ratio does not move over two measured releases, a release-level
      gate is reconsidered — never the per-PR gate, which is declined on
      mechanism rather than on threshold.
      verify: the ADR from 1.1 carries the escalation condition and the explicit
      exclusion of the per-PR shape.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The measurement becomes ceremonial | product | A published ratio nobody must answer for is a number in a file; both seats named this as the way the replacement fails | 3.2 attaches the response obligation from the first reading rather than after a threshold, and 3.3 names the escalation | Phase 3 — Baseline before threshold |
| 2 | The category mapping is argued instead of used | implementation | Four buckets over a repo where roadmaps and ADRs are arguably the product invites an unresolvable debate about which bucket an ADR belongs in | 2.1 makes the mapping versioned data with an explicit unclassified state, so a disputed path is visible rather than silently assigned | Phase 2 — Classify a release |
| 3 | A threshold is adopted from the first reading | product | The reviewer's "more than half the cycle" is a ready-made number and it has no denominator; adopting it would be the false precision both seats rejected | 3.1 forbids committing a threshold before the second reading, and the first two readings are published as levels | Phase 3 — Baseline before threshold |

## Acceptance Criteria

- [ ] AC-1 — An ADR declines the same-PR user-artifact gate, states the two
      grounds, cites the council round, and names the replacement and its
      escalation condition.
- [ ] AC-2 — A versioned path→category mapping exists and every top-level path
      resolves to one category or is explicitly unclassified.
- [ ] AC-3 — The release classifier reads changed paths, not commit subjects,
      pinned by a test that rewrites a subject and asserts no change.
- [ ] AC-4 — `mixed` is a reported bucket, and a planted governance-plus-one-
      consumer-file commit lands in it.
- [ ] AC-5 — Two release readings are published as levels with no committed
      threshold, and the response obligation is in force from the first.
