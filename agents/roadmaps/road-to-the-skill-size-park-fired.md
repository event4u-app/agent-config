---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-dated-trigger-that-decides
    relation: disjoint
    note: >
      Both are reopen conditions a tool reports as `indeterminate` while being
      mechanically decidable. That roadmap takes the dated sub-class and
      deliberately stops there. This one is a numeric condition, evaluated by
      hand here rather than by a parser, and it does not widen that scope —
      it is the evidence that the numeric sub-class exists.
estate_growth_exempt: "A recorded park's reopen condition is met at HEAD and reproduced exactly: ADR-225 parks a skill-size ceiling until `more than ten skills exceed 2,500` words, and twelve do. Under `decision-revisit-gate` a fired condition is not an unqualified lock and must be surfaced and routed rather than quietly complied with; no active roadmap, later roadmap or stub owns ADR-225's park. The roadmap adds no gate — its deliverable is the routed decision and, at most, whichever small outcome the council returns."
estate_offset_exempt: "Cannot be offset. Offsetting it means archiving another active roadmap to make room for a lock whose own condition has already fired, which is the trade-the-finding-against-estate-arithmetic behaviour that a sibling roadmap in this estate was created to name."
---
# Road to the skill size park fired

> **Source:** `agents/tmp.old/inbox-2026-09-q/` — an external multi-round
> comparison artifact that watched this condition since its own v8 and reports
> it fired. Every one of the twelve word counts was re-derived at `99d14b2e7`
> before this file was written, and they match the artifact exactly.

## Goal

ADR-225's parked skill-size ceiling has been re-evaluated by the body entitled to
re-evaluate it, and the estate carries either a size mechanism or a re-park with
new numbers and a new condition — not a fired trigger that nobody answered. The
condition, verbatim from the ADR's own park section: *"Reopen when p95 crosses
3,000 words, or when more than ten skills exceed 2,500."* Re-derived at
`99d14b2e7` over `src/skills/*/SKILL.md` with `wc -w`: **twelve** skills exceed
2,500 words — `subagent-orchestration` 2,503 · `adr-create` 2,515 ·
`systematic-debugging` 2,668 · `react-shadcn-ui` 2,669 · `roadmap-writing` 2,698 ·
`existing-ui-audit` 2,707 · `testing-anti-patterns` 2,747 · `decision-review`
2,763 · `conventional-commits-writing` 2,771 · `git-workflow` 2,884 ·
`memory-consolidation` 3,012 · `ai-council` 3,031. The disjunction's other half
did not fire: p95 is 2,367 over n=299, below the 3,000 threshold. `adr_cite_check
ADR-225` reports `reopen_policy unclassified` and `trigger state indeterminate`,
so investigation is permitted and the routing is the council's. Out of scope by
decision: writing any size gate before the council answers, and re-opening the
four other axes ADR-225 rejected — each carries its own condition and none of
them fired.

## Phase 1 — The fired condition is on the record

- [ ] **1.1 Write the reproduction, not the assertion.** Record the twelve counts, the
      p95, the n, and the exact command that produced each, in
      `agents/evidence/analysis/skill-size-park-fired-2026-09-06.md`. Name which half of
      the disjunction fired and which did not — a record that says only "the park fired"
      cannot be checked against a later tree.
      verify: re-running the stated command reproduces the twelve names and counts, and
      the p95 line reproduces 2,367 at n=299.
- [ ] **1.2 Name what moved.** Two of the twelve crossed 2,500 inside the 14.16→14.18
      window and one rose by 326 words. State for each crosser whether the growth was
      content the estate deliberately added or drift, with the commit that added it.
      verify: each named crosser carries a commit reference, and the classification is
      falsifiable from that commit's diff rather than asserted.

## Phase 2 — The council answers the park, not this file

- [ ] **2.1 Put the park to the council with the reproduction as its input.** The question
      is the ADR's own: a disclosure sweep for the heavy tail, a re-park with new numbers
      and a new condition, or a mechanism. `agent-config council:status` reports the seats;
      the prompt states the counts and asks for a verdict, and states no expectation of the
      outcome in either direction.
      verify: a council artifact exists carrying the prompt verbatim alongside the verdict,
      per `evaluator-independence` — a recorded verdict whose prompt is not recoverable is
      not evidence.
- [ ] **2.2 Record the answer as an amendment to ADR-225, with a new condition.** Whatever
      the verdict, the park either ends or is re-parked on a number that is not the one
      that just fired — a re-park on the same threshold is a silent extension.
      verify: `./scripts-run src/scripts/adr_cite_check ADR-225` shows the amendment, and
      the recorded condition differs from `more than ten skills above 2,500`.

## Phase 3 — Execute only what was returned

- [ ] **3.1 Implement the council's verdict at its stated size, and nothing beside it.** If
      the verdict is a re-park, the deliverable is the amendment from 2.2 and this phase is
      closed empty with that stated. If it is a sweep or a mechanism, it ships at the scope
      the verdict names.
      verify: the diff of this phase contains only what 2.2 records as the verdict, and a
      reader can map every changed file to a sentence in it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The run answers the park itself and calls it routing | product | The verdict is cheap to guess — a re-park is the low-friction outcome and the roadmap could produce it directly, presenting a decision as a routing outcome and retiring a fired condition on the agent's own authority. | 2.1 requires a council artifact carrying its prompt verbatim, so an unrouted answer has no evidence behind it; 2.2 forbids re-parking on the threshold that just fired, which is the shape a self-answered park would take. | Phase 2 — The council answers the park, not this file |
| 2 | The prompt is written to produce the convenient verdict | implementation | The same run that would prefer a re-park also authors the council's prompt, which is the steering `evaluator-independence` exists to stop — and a steered honest-null here would retire the condition with a real artifact behind it. | 2.1 states that the prompt carries no expectation in either direction and must ship with the verdict; the reproduction from Phase 1 is the input, so the counts the council sees are the measured ones rather than a summary. | Phase 2 — The council answers the park, not this file |
| 3 | A size gate is built before the verdict | implementation | Twelve findings is a satisfying gate to write and the numbers are already in hand, so Phase 3 could start before Phase 2 finishes — committing the estate to the mechanism option that the ADR explicitly parked. | The goal names building a gate before the council answers as out of scope, and 3.1's verify requires every changed file to map to a sentence in the recorded verdict. | Phase 3 — Execute only what was returned |
| 4 | The other four parked axes are swept in alongside | product | ADR-225 rejects four further axes with their own conditions; a roadmap already opening that record is one edit from re-arguing them, none of which has fired. | The goal names them out of scope by decision and states that none fired; 2.2's amendment is scoped to the skill-size park, and 3.1 bounds the diff to the verdict. | Phase 2 — The council answers the park, not this file |

## Acceptance Criteria

- [ ] AC-1 — An evidence file reproduces the twelve skills above 2,500 words, the p95 at n=299, and the command behind each, and a later reader can re-run it.
- [ ] AC-2 — Each of the crossers that moved inside the window carries the commit that moved it and a classification falsifiable from that diff.
- [ ] AC-3 — A council artifact exists carrying its own prompt verbatim next to the verdict on ADR-225's skill-size park.
- [ ] AC-4 — ADR-225 carries an amendment whose recorded condition is not `more than ten skills above 2,500`.
- [ ] AC-5 — Every file this roadmap changed outside Phases 1 and 2 maps to a sentence in the recorded verdict, and no size gate exists that the verdict did not ask for.
