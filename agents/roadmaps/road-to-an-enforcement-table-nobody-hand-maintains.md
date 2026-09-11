---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-the-delivery-flip-that-tells-the-truth
    relation: disjoint
    note: >
      Both correct a truth surface about host behaviour. That one is about which
      projection a host receives; this one is about whether a host refuses on a
      deny. Different data, different files, neither waits on the other.
estate_growth_exempt: >-
  The published enforcement truth is hand-maintained at host granularity while the data it
  describes is per slot. Verified 2026-09-11: `src/scripts/hooks/host_lowering.yaml` carries
  exactly three non-null blocking values, all under one host, and the slot that the content
  scanner binds to is non-blocking even there — so "the only host that refuses on a deny" rounds
  off a distinction that matters. At least five always-loaded rules each carry their own hedge
  paragraph re-deriving this by hand. Also grows open_blockers by one.
estate_offset_exempt: >-
  Nothing active owns the enforcement matrix. The two delivery roadmaps own which slots are bound
  where; this owns what a bound slot does with a refusal, which is the other axis and is what the
  five hedging rules are actually uncertain about. Archiving an unrelated roadmap to buy the slot
  would trade open mechanism work for a documentation derivation.
---
# Road to an enforcement table nobody hand-maintains

> **Source:** `agents/tmp.old/inbox-2026-09-y/t1-typed-state-routing/` — analysed 2026-09-11. The
> source's own claim about this surface was verified and came back sharper than it was written:
> one host honours a deny on three of its nine bound slots, and the slot carrying the content
> scanner is not one of them.

## Goal

The published statement of what each host enforces is derived from the file the runtime resolver
actually reads, at slot granularity, so no host can be described as refusing on a deny for a slot
whose configuration says otherwise — and the five rules that each carry their own hedge paragraph
about this can point at one generated table instead.

Host granularity is the defect. "One host refuses on a deny" is true and incomplete: that host
refuses on three of its nine bound slots, and a guard bound to one of the other six runs and is
ignored. A reader of the current table cannot tell those apart, and neither could the five rules
that hedge about it, which is why each of them re-derives the caveat in prose.

## Phase 1 — Measure the drift that exists today

- [ ] **1.1 Write a read-only reporter** that prints host by slot by blocking value beside the
      published table's current claim, listing mismatches.
      verify: the reporter writes nothing — `grep -nE 'writeFile|mkdir|appendFile'` finds nothing —
      and it runs offline.
- [ ] **1.2 Report an empty mismatch list as a real answer.** If the table is already accurate at
      slot granularity, that is the finding and the rest of this roadmap is cheaper, not moot.
      verify: the run's output is recorded in the evidence tree with its date, whichever it says.

## Phase 2 — Generate the matrix, keep the prose

- [ ] **2.1 Generate the matrix from the lowering configuration** under a marker that says it is
      generated, and add a check that fails when the committed matrix differs from what the
      configuration produces.
      verify: editing the configuration and not regenerating reddens the check; regenerating
      greens it.
- [ ] **2.2 Leave the explanatory prose hand-written.** The paragraphs saying why a host cannot
      block are authored and stay above the generated block.
      verify: the generated region is delimited and the diff of a regeneration touches only inside
      it.

## Phase 3 — Slot granularity, not host granularity

- [ ] **3.1 Emit one row per host and bound slot.** The three honouring slots and the six
      non-honouring ones of the one blocking host are each visible.
      verify: the table has a row per bound slot, and the row for the slot carrying the content
      scanner reads non-blocking.
- [ ] **3.2 Keep a generated one-line summary above the table** so a reader who needs the short
      answer gets one that is derived rather than remembered.
      verify: the summary line is inside the generated region and is regenerated with the matrix.

## Phase 4 — A closed vocabulary, backed by data

- [ ] **4.1 Give every cell a value from a closed set** covering refusal, halt-by-state, warning,
      and unenforced.
      verify: a value with no backing line in the lowering configuration is rejected by the check
      from Phase 2.1.
- [ ] **4.2 Do not let the vocabulary outrun the data.** The halt-by-state value has zero prior
      occurrences in this tree; it may appear in the table only when the configuration carries it.
      verify: the check's fixture includes a cell claiming a value the configuration does not have,
      and the check reds on it.

## Blockers

### blocker: generating-a-hand-written-doc-is-a-docs-policy-call
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 2 onward. Phase 1 proceeds without it and is the half that produces the
  finding.
- **What to do:** decide whether this document may become partly generated. It is currently
  hand-written prose, and turning a section of it into build output means a regeneration step and
  a drift check that reds when someone edits the table directly. Read `docs/enforcement-by-host.md`
  to see how much of it is the matrix and how much is the explanation, and
  `src/scripts/hooks/host_lowering.yaml` for the data the matrix would be generated from. Two
  options: (a) generate the matrix under a drift check; (b) keep it hand-written and apply Phase 1's
  mismatch list once, by hand.
- **Recommendation:** generate it. The matrix is a projection of one configuration file and the
  drift this roadmap measures is the cost of maintaining that projection by hand; the prose stays
  authored, so nothing that requires judgement becomes build output.
- **If you do nothing:** Phase 1 still lands the measurement, and the mismatch list is a usable
  correction to make by hand once.
- **Resolved when:** the document carries a generated region with a drift check, or this roadmap
  records the refusal and Phase 1's list is applied manually.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The generated matrix loses the reason behind a value | product | The explanation of why a host cannot refuse is the part readers need, and a generated table carries values without reasons | Phase 2.2 keeps the prose authored and above the generated region, and the regeneration diff proves it is untouched | Phase 2 — Generate the matrix, keep the prose |
| 2 | Slot rows make the table too wide to read | product | Nine slots across nine hosts is a table people skip, which would leave the five hedging rules hedging | Phase 3.2 generates a one-line summary above it from the same data, so the short answer is derived rather than remembered | Phase 3 — Slot granularity, not host granularity |
| 3 | The new vocabulary is adopted in prose before anything emits it | implementation | One of the four values has no occurrence anywhere in the tree, so it could become an unbacked claim in a table that looks authoritative | Phase 4.2 makes an unbacked cell a check failure, with a fixture that proves the check fires | Phase 4 — A closed vocabulary, backed by data |
| 4 | The measurement finds nothing and the work looks wasted | implementation | If the hand-maintained table is already accurate, Phase 1 returns an empty list | Phase 1.2 records an empty list as the finding with its date; an accurate table measured is worth more than an accurate table assumed | Phase 1 — Measure the drift that exists today |

## Acceptance Criteria

- [ ] AC-1 — A read-only reporter prints host by slot by blocking value against the published
      claim, writes nothing, and its output is recorded with a date.
- [ ] AC-2 — The published matrix is generated from the lowering configuration, and a check reds
      when the two differ.
- [ ] AC-3 — The explanatory prose is outside the generated region and is unchanged by a
      regeneration.
- [ ] AC-4 — The table carries one row per host and bound slot, and the row for the slot carrying
      the content scanner reads non-blocking.
- [ ] AC-5 — Every cell carries a value from the closed set, and a cell claiming a value the
      configuration does not carry reds the check.
