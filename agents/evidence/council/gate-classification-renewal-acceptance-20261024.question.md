<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-ninth round that day),
     committed verbatim. The asking agent wrote the reconciler and the ledger
     whose renewal this concerns. -->

# Step 7.1 — a closed acceptance list for the pin renewal and for item 4

This round does not ask for a renewal verdict. It asks you to fix the bar.

## Context

Step 7.1 classifies 16 check scripts into a ledger. Each binding aspect is
classed invariant, snapshot, tolerance or observation.

**Closure standard (owner).** Option A requires items 1, 4, 5, 6, 7 and 8:
- Items 1, 5, 6, 7 and 8 were met 2/2 (round 21).
- Item 4 reads: *class predicates mutually exclusive or with precedence defined;
  each aspect satisfying its predicate.*
- Item 7, already met, holds that *"a named error or a demonstrated coverage
  defect reopens 7.1; merely proposing another analysis technique does neither"*.

**Rule D38.** The record's inputs are pinned by hash. A pin is renewed only by
a council round on the diff that staled it. The last attested set is
revision 16.

The record now derives each aspect's class from structured fields. 49 of 49
aspects derive their recorded class, with 0 waived. Those fields are:
- each reaching branch's `effect`, from a branch inventory that separate
  sessions produced from source and reviewed;
- a structured `modes` map;
- an `overlaps` precedence table.

**Renewal attempts on revision 21, 22 and 23** (rounds 26, 27 and 28) each
returned *do not renew* and *item 4 not met*, 2/2. Each round named new
requirements:

| Round | Findings |
|---|---|
| 26 | substring mode matching; effects unchecked against code; no rollback for D46; an unexamined wiring change in whole-file pins |
| 27 | whole-file wiring hashes attest the unexamined change; only derived labels shown exclusive, not runtime modes; contradiction blind spot; independence not shown |
| 28 | the Phase-7-step YAML scope is syntactic, not semantic, and may miss job-level `env`/`if`/matrix and Taskfile includes; `excluded` is not runtime precedence, with no truth table for flag combinations; a default-row bypass; the ledger-row diff not shown; no clean run after renewal |

All findings of rounds 26 and 27 were implemented. Each new check was seen red
under sabotage before it was trusted.

**Facts relevant to a bar:**
- Code confirmation is a structural limit of syntactic scanning. 63 of 167
  blocking branches contain a hard exit or throw site. The other 104 report
  through an aggregated exit, and rest on the independent inventory's reading.
- Only two branches reach rows in two modes. Both map a default row
  (observation, exit 0) and a `--strict` row (invariant, exit 1).
  `check_public_links c11-beta-marker` also names `--list` as an exclusion.
- A clean post-renewal run is only possible after renewal. Round 27's openai
  seat called requiring it beforehand *"circular"*.

**A candidate split** of the renewal unit:
- **A.** The D46 behaviour fix, plus check 16's re-inventory, mapping and
  review. Both seats called the fix sound in rounds 26–28.
- **B.** The classifier machinery: the reconciler, the site scanner and the
  grounds file.
- **C.** Wiring. Either Phase-7-step pins or whole-file pins.

## Questions

**Q1. The closed list.** Give a **finite, closed** list of acceptance items for
renewing the pins and meeting item 4. Each item needs a pass condition that a
script or a single named test can check. For each item say:
- whether it is **required for 7.1** under Option A;
- or whether it belongs to 7.2 or another step.

Commit that anything **not** on the list does not block a later renewal, in the
spirit of item 7.

**Q2. Wiring.** Should the wiring pins:
- return to conservative whole-file hashes, with a non-Phase-7 change attested
  by a short separate diff review;
- or stay step-scoped, under a semantic resolver?

Name the one you require.

**Q3. Split.** Is renewing unit A separately from B and C acceptable? If yes,
does A's renewal let any part of 7.1 proceed?

**Q4. Truth table.** For the two multi-mode branches, is a runtime test required
for 7.1? Such a test executes the check under each valid flag combination and
asserts the selected row's behaviour. If not required for 7.1, which step owns
it?

**Q5. Owner reservation.** Is any item or decision here owner-reserved, or is
it within what the council may decide? Owner-reserved would mean it changes the
closure standard the owner set, lowers a safety floor, or is irreversible.

Give your confidence.
