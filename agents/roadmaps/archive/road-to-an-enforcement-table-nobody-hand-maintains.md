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

- [x] **1.1 Write a read-only reporter** that prints host by slot by blocking value beside the
      published table's current claim, listing mismatches.
      verify: the reporter writes nothing — `grep -nE 'writeFile|mkdir|appendFile'` finds nothing —
      and it runs offline.
      `src/scripts/report_enforcement_drift.ts`. The grep returns nothing, and a test asserts the
      same over a wider set (`rmSync` included) so the property cannot come back silently. Reads
      two files, opens no socket.
      **The comparison rule is stated before the count, because the count is a consequence of it.**
      A published cell is host-level and binary; the configuration is per slot, so a cell
      summarises a column. **Strict** — the headline — calls a published "deny honoured" accurate
      only when *every* lowerable slot under that host blocks. **Lenient** needs only one. Strict,
      because an unqualified "the only host that refuses on a deny" is read as *a guard bound here
      is honoured*, and the lenient rule scores one-of-nine identically to nine-of-nine, which
      would make the drift invisible by construction rather than absent. Both counts print on every
      run and `--rule` re-derives the other.
- [x] **1.2 Report an empty mismatch list as a real answer.** If the table is already accurate at
      slot granularity, that is the finding and the rest of this roadmap is cheaper, not moot.
      verify: the run's output is recorded in the evidence tree with its date, whichever it says.
      `agents/evidence/analysis/enforcement-table-slot-drift-2026-09-12.md`, pinned to
      `9e85c0bf3`. **The list is not empty, and it is also not large: 1 mismatch of 8 comparable
      hosts.** The honest shape of the finding is that *the table is accurate on 7 of 8 comparable
      hosts, and the single inaccuracy is the row that carries the enforcement claim* — the
      `claude` row publishes "honoured" while 3 of 9 lowerable slots block. Under the lenient rule
      the count is 0, and the two rules disagree on exactly that one row, which is the empirical
      form of the argument for strict rather than a separate assertion.
      Two things are deliberately **not** counted as mismatches and are printed as labelled blocks
      instead: a host with no row in the lowering file (silence, not contradiction) and the
      slot-count column (published counts *declared* bindings, the lowering file records what an
      install can *emit* — two senses the document itself keeps apart).
      **The roadmap's own premise was verified rather than inherited, and holds in all three
      parts:** exactly three non-null blocking values (`host_lowering.yaml:66,67,68`), all under
      `claude:` (block opens `:45`), and the content scanner is `injection-scan`, bound only on
      `post_tool_use`, whose claude value is `block_exit: null` (`:69`).
      One fact the roadmap did not state: effective blocking is gated on verification currency —
      claude's block expires 2027-09-06 (`:62`), so literal and effective coincide today. The
      reporter prints both side by side so a future expiry surfaces as a visible difference rather
      than a value that quietly became null.

## Phase 2 — Generate the matrix, keep the prose

- [x] **2.1 Generate the matrix from the lowering configuration** under a marker that says it is
      generated, and add a check that fails when the committed matrix differs from what the
      configuration produces.
      verify: editing the configuration and not regenerating reddens the check; regenerating
      greens it.
      `src/scripts/check_enforcement_matrix.ts`, generator and gate in one. Marker style matches
      the tree's only existing begin/end convention (`lint_adapter_tier` over
      `docs/contracts/provider-lifecycle.md`) rather than a new one.
      **Both readings taken, and taken twice.** The subagent edited the configuration without
      regenerating and got exit 1; `--write` returned it to exit 0. Verified independently from the
      other direction — hand-flipping one generated cell (`claude`/`stop` from `refusal` to
      `warning`) exits **1**, restoring the file exits **0**. Worth recording how that second check
      nearly went wrong: piping the run into `tail` made `$?` report `tail`'s status, printing ❌
      beside `EXIT=0`. The gate was fine; the probe was not, and a probe that reads a red as green
      is the failure this roadmap is about.
- [x] **2.2 Leave the explanatory prose hand-written.** The paragraphs saying why a host cannot
      block are authored and stay above the generated block.
      verify: the generated region is delimited and the diff of a regeneration touches only inside
      it.
      Region is lines 189–231; the `Loop primitive` section sits at 313, outside it, and the
      boundary comment names that explicitly so a later reader does not have to infer it. A
      regeneration after a one-field configuration change touched exactly two lines, both inside
      the region — the summary and the one row.

## Phase 3 — Slot granularity, not host granularity

- [x] **3.1 Emit one row per host and bound slot.** The three honouring slots and the six
      non-honouring ones of the one blocking host are each visible.
      verify: the table has a row per bound slot, and the row for the slot carrying the content
      scanner reads non-blocking.
      32 rows, long form — `Host | Slot | Configured outcome | Backing`. The `claude` block shows
      `refusal` on `stop`, `user_prompt_submit` and `pre_tool_use`, and `warning` on
      `post_tool_use`, which is the slot the content scanner binds to.
      **The layout was measured rather than assumed, and the first argument for it was withdrawn.**
      Both shapes were built. The 9x6 matrix is genuinely more compact — 11 lines against 41 — and
      the document says so instead of pretending otherwise. It was rejected because a one-cell
      change rewrites a six-value row whose host must be recovered by counting columns, because
      there is no room for the `Backing` column so no cell is checkable against the YAML without
      trusting the derivation, and because it needs a fifth glyph for "not bound here" which puts a
      value outside the closed set into the same visual column as the four real ones. The initial
      claim that long form reads better on a phone was walked back — its rows are no narrower in
      characters — and the document now names the diff as the decisive argument instead.
      Grouped per-host subsections were not built: headings inside a generated region would make
      the document's own structure build output, against the council's condition 2.
- [x] **3.2 Keep a generated one-line summary above the table** so a reader who needs the short
      answer gets one that is derived rather than remembered.
      verify: the summary line is inside the generated region and is regenerated with the matrix.
      Inside the region, and it moved under the regeneration probe — `4 of 32` back to `3 of 32`
      when the sabotaged field was restored, which is the proof it is derived rather than written
      once.

## Phase 4 — A closed vocabulary, backed by data

- [x] **4.1 Give every cell a value from a closed set** covering refusal, halt-by-state, warning,
      and unenforced.
      verify: a value with no backing line in the lowering configuration is rejected by the check
      from Phase 2.1.
      All 32 cells carry one of the four. `--self-test` runs 5 cases, 4 of them rejecting: a value
      outside the vocabulary, a hand-flipped outcome, a deleted row, the `halt-by-state` fixture
      below — and the regenerated region accepting.
- [x] **4.2 Do not let the vocabulary outrun the data.** The halt-by-state value has zero prior
      occurrences in this tree; it may appear in the table only when the configuration carries it.
      verify: the check's fixture includes a cell claiming a value the configuration does not have,
      and the check reds on it.
      **The fixture found a real defect before this shipped, which is the whole argument for
      demanding it.** The first `--write` guard computed its backing set from *the generator's own
      output*, so sabotaging `outcomeFor` to return `halt-by-state` for every propagating slot
      wrote the phantom value through and exited **0** — precisely the scenario the dissenting
      council seat described. `backedOutcomes` now reads the raw configuration fields instead, and
      the same sabotage exits 1 with 19 findings. Recorded in the gate's docstring and its
      `no_canary_reason` rather than only here.
      That also settles the recorded dissent empirically. The seat that wanted the value removed
      from the vocabulary entirely was worried about a generator bug emitting a phantom; the seat
      that wanted it defined-but-unused was worried about an unexplained category meeting a
      reader. Both concerns were real, and the fixture addresses the first without giving up the
      second.

## Blockers

### blocker: generating-a-hand-written-doc-is-a-docs-policy-call
- **Status:** resolved 2026-09-12 by council — generate it, under five conditions
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
- **Resolution:** **generate it.** Council, 2 seats, quorum concluded, converged 2/2 on option (a)
  — and both seats independently held that an **empty** mismatch list would not have changed the
  answer: it would show the table happens to be right today, not that hand maintenance is
  reliable. Phase 1 then measured 1 of 8, so the question did not arise.
  Five conditions, all adopted:
  1. **Title it for what it proves.** A drift check establishes agreement with the YAML, never
     agreement with reality — a mistaken lowering rule yields perfectly synchronised and false
     documentation. Absent a runtime conformance test, the generated region is titled
     **configured** behaviour, not **enforced** behaviour. This changes the deliverable and is the
     sharpest thing the council said.
  2. **Generate only the mechanical projection.** The taxonomy and every explanation of *why* a
     host cannot refuse stay hand-written, above the region.
  3. **Mark the boundary unmistakably** — source file, regeneration command, and visual separation
     from the adjacent hand-written `loop primitive` table, which stays outside the region.
  4. **The measurement is the generator's test.** Phase 1's projection logic and the generator's
     are the same logic; writing it twice invites them to disagree.
  5. **A drift failure prints the regeneration command** and says corrections belong in the YAML
     or the generator, because the correction path is otherwise strictly worse than editing a cell.
- **Recorded dissent, and how it was resolved.** The seats split on `halt-by-state`, the
  vocabulary value with zero occurrences in this tree. One held it should not exist in the
  vocabulary at all until something emits it, since a generator bug could emit a phantom value.
  The other held it should be defined in the hand-written taxonomy and marked *currently unused*,
  so that a reader who later meets it does not meet an unexplained category. The second is adopted
  because it is what Phase 4 already specifies — the value is in the closed set, and 4.2 requires
  a fixture proving the check reds on a cell claiming a value the configuration does not carry.
  The first seat's concern is answered by that same fixture rather than dismissed.
- **Note:** owner-classified Class 3, routed to the council under this run's standing delegation
  and recorded rather than silently reclassified.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The generated matrix loses the reason behind a value | product | The explanation of why a host cannot refuse is the part readers need, and a generated table carries values without reasons | Phase 2.2 keeps the prose authored and above the generated region, and the regeneration diff proves it is untouched | Phase 2 — Generate the matrix, keep the prose |
| 2 | Slot rows make the table too wide to read | product | Nine slots across nine hosts is a table people skip, which would leave the five hedging rules hedging | Phase 3.2 generates a one-line summary above it from the same data, so the short answer is derived rather than remembered | Phase 3 — Slot granularity, not host granularity |
| 3 | The new vocabulary is adopted in prose before anything emits it | implementation | One of the four values has no occurrence anywhere in the tree, so it could become an unbacked claim in a table that looks authoritative | Phase 4.2 makes an unbacked cell a check failure, with a fixture that proves the check fires | Phase 4 — A closed vocabulary, backed by data |
| 4 | The measurement finds nothing and the work looks wasted | implementation | If the hand-maintained table is already accurate, Phase 1 returns an empty list | Phase 1.2 records an empty list as the finding with its date; an accurate table measured is worth more than an accurate table assumed | Phase 1 — Measure the drift that exists today |

## Acceptance Criteria

- [x] AC-1 — A read-only reporter prints host by slot by blocking value against the published
      claim, writes nothing, and its output is recorded with a date.
      `report_enforcement_drift.ts`; the write-grep returns nothing and a test pins the property
      over a wider set. Recorded at
      `agents/evidence/analysis/enforcement-table-slot-drift-2026-09-12.md`, pinned to `9e85c0bf3`,
      with the comparison rule stated ahead of the count. Result: 1 mismatch of 8 comparable hosts.
      The artefact now carries a dated addendum recording that its subject — the `Deny honoured`
      column — was deleted by this roadmap, so a later reader is not left measuring a column that
      no longer exists.
- [x] AC-2 — The published matrix is generated from the lowering configuration, and a check reds
      when the two differ.
      `check_enforcement_matrix`, 32 rows, registered in `Taskfile.yml`, `taskfiles/ci-fast.yml`,
      `.github/workflows/consistency.yml` and `src/config/gate-coverage.yml` — CI-run rather than
      local-only. Red and green both observed, twice, from both directions.
- [x] AC-3 — The explanatory prose is outside the generated region and is unchanged by a
      regeneration.
      Region 189–231; taxonomy, the `Loop primitive` section (313) and the
      *What a generated table here can and cannot prove* subsection are all outside it, and a
      regeneration's diff touched only the two lines inside.
- [x] AC-4 — The table carries one row per host and bound slot, and the row for the slot carrying
      the content scanner reads non-blocking.
      `claude`/`post_tool_use` reads `warning`, and `injection-scan` binds only to `post_tool_use`.
      That single row is the thing the old host-level column could not say.
- [x] AC-5 — Every cell carries a value from the closed set, and a cell claiming a value the
      configuration does not carry reds the check.
      Met, and the fixture proving it caught a real hole in the first implementation of the guard
      it tests.

**One acceptance criterion the roadmap did not write, delivered because the council made it
binding:** the generated region is titled **configured** behaviour, not **enforced** behaviour, and
opens "A cell says what this package has written down about a host, never what the host does." A
drift check establishes agreement with the YAML and nothing more — a mistaken lowering rule yields
a synchronised, false document the gate stays green over. A hand-written subsection states that
limit, names what would close it (a runtime conformance test, which this tree has for no host), and
names the specific mistake: reading a generated table as stronger evidence than the hand-written one
it replaced. A test asserts the region says `configured behavior, not observed behavior` and does
not match `/enforced behaviour/i`.

**The `Deny honoured` column was deleted, not corrected.** It published "the only host that refuses
on a deny" — the one claim Phase 1 measured as wrong, and wrong in the direction that matters. A
column that can only be right or wrong at host granularity cannot express a host that refuses on
three of nine slots, so the per-slot table replaces it rather than restating it more carefully.
