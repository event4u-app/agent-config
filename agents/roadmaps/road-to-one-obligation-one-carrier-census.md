---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  Nothing in the active estate can be archived to pay for this one. The nearest
  existing instrument, report_carrier_divergence, measures two copies of the
  SAME rule disagreeing across install scopes - a different condition, and its
  own header forbids it acquiring the threshold this census would need. The
  estate stubs it might otherwise join count roadmaps, not obligation bodies.
  Parking it is the outcome the source's own convergence argues against: seven
  independent readings named this as the single largest remaining cost and none
  of them produced an artifact, which is how the theme has survived unmeasured.
relates:
  - slug: road-to-estate-triage-remaining-batches
    relation: disjoint
    note: >-
      That stub counts roadmaps. This counts obligation bodies across artifact
      classes. Neither number is derivable from the other.
---
# Road to one obligation one carrier census

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t04/` — a round of independent
> code-level review outputs against one pinned head. This is the strongest
> convergence in the set: seven of the reviewers, scoring the tree between
> 9.2 and 10, named the same thing as the bottleneck in different words —
> mechanism density, estate restraint, runtime simplicity, and a proposed
> north star of "one obligation, one authoritative carrier, and delete the
> redundant copy". None of them produced a measurement, and the theme has now
> arrived across consecutive rounds as prose only.

## Goal

A read-only census that answers, per obligation, **how many distinct artifacts
carry its body** — so "mechanism density" stops being an impression and becomes
a number with named rows. Falsifiable: after Phase 2 a reader can name the ten
obligations with the most carriers, and open each carrier. The census
deliberately does **not** delete anything and does **not** become a gate.

## Non-goals, stated first because the source insisted on them

Every reviewer in the set who named this theme also named what not to build,
and the lists agree: no universal ledger, no shared state database, no second
registry with runtime behaviour, no new enforcement layer. This roadmap builds
a reporter and a table. If it ever grows a threshold it has become the thing
the source warned against.

## Phase 1 — Define what a carrier is, before counting anything

- [ ] **1.1 Enumerate the carrier classes.** An obligation's body can sit in a
      kernel rule, a tier-2 rule, a skill, a context file, a guideline, a hook
      concern's injected text, or a command. List the classes and say which
      ones the census reads. A class left out is a named exclusion, never a
      silent one.
      verify: the reporter's header lists every class and the reason for each
      exclusion
- [ ] **1.2 Define carrier identity without a similarity matcher.** Two
      artifacts carry the same obligation when they state the same binding
      sentence, not when they score similar. Use the structural anchors this
      tree already has — the Iron Law fence, the named rule slug, the explicit
      cross-reference — and report `unknown` where none resolves.
      verify: run the matcher over three obligations known to be duplicated and
      three known not to be; the six verdicts are correct and `unknown` appears
      where it should
- [ ] **1.3 Show the matcher red first.** Plant a duplicate that the current
      definition misses, watch the census under-count, then fix the definition.
      A census never seen under-count has unknown sensitivity.
      verify: the planted case is recorded with the count before and after

## Phase 2 — Report the census, read-only

- [ ] **2.1 Emit the table.** One row per obligation: its slug, its carrier
      count, and each carrier's path. Output goes to stdout and to a gitignored
      path, never into the tracked tree.
      verify: run it; it prints rows and exits 0, and `git status` is unchanged
- [ ] **2.2 Publish the ten highest counts with their paths.** Not a
      recommendation to delete — the input to the decision about whether to.
      verify: the ten rows exist and every path in them opens

## Phase 3 — One decision, on evidence

- [ ] **3.1 Take the top row and decide it, in writing.** One obligation, one
      chosen authoritative carrier, one recorded reason, and the redundant
      copies either removed or recorded as deliberately retained. One row, not
      ten — the source's own warning is that a consolidation programme is
      itself a mechanism.
      verify: the decision is recorded with the carrier it chose and the reason;
      the census re-run shows that row's count changed or states why it did not

## Acceptance criteria

- The census names every carrier class it reads and every one it excludes.
- Carrier identity resolves structurally; no similarity score decides a match.
- The matcher was seen under-counting a planted duplicate before it was fixed.
- The reporter writes nothing into the tracked tree.
- Exactly one obligation's carrier set is decided in Phase 3, with its reason.
- The census carries no threshold and reds no build.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The census acquires a threshold and becomes a gate | product | A count with named rows invites a ceiling, and a ceiling in this tree becomes a gate. The convergence this roadmap answers was that mechanism density is the bottleneck; a census that reds a build on carrier count would add one more mechanism while claiming to measure them, which is the outcome every reviewer in the source set named as the thing not to build. | The Non-goals section and the last acceptance criterion both forbid it, and step 2.1 fixes the output as a report to stdout and a gitignored path with no exit-code opinion. A threshold would fail a stated criterion rather than merely disappoint an intention. | Phase 2 — Report the census, read-only |
| 2 | Carrier identity is decided by a similarity matcher | implementation | "Same obligation" is easiest to approximate with a similarity score, and a score makes every count unfalsifiable: a reader who disagrees with a row cannot check it, only re-tune the threshold until it goes away. The census would then publish numbers nobody can contest or reproduce, on a question whose whole value is that it is checkable. | Step 1.2 requires the structural anchors this tree already has — the Iron Law fence, the named rule slug, the explicit cross-reference — and an explicit `unknown` where none resolves. Its verify runs six known cases, three duplicated and three not, and demands the correct verdict on each. | Phase 1 — Define what a carrier is, before counting anything |
| 3 | The census under-counts and its zero is read as "no duplication" | implementation | A matcher built from anchors will miss duplicates stated in different words, and a low count is the most comforting output available — it would be published as evidence the density concern was overstated. An untested matcher cannot support that reading, and the reading is the one most likely to be taken. | Step 1.3 requires a planted duplicate to be missed and the under-count observed before the definition is fixed, with the counts before and after recorded. A census never seen under-count has unknown sensitivity and is not evidence about anything. | Phase 1 — Define what a carrier is, before counting anything |
| 4 | Phase 3 turns into a consolidation programme | product | Ten rows with open-able paths is an obvious work queue, and working the queue is itself a mechanism — the thing the source explicitly warned against. A sweep would also delete carriers on the strength of a count whose sensitivity had only just been established, trading a measurement problem for a deletion one. | Step 3.1 caps the phase at exactly one obligation and that cap is an acceptance criterion, not advice. The redundant copies of that single obligation are either removed or recorded as deliberately retained, so the decision is visible in both directions. | Phase 3 — One decision, on evidence |
| 5 | The count is published and nothing is decided | product | The theme has arrived across consecutive review rounds as prose, from seven independent readings scoring the tree between 9.2 and 10, and has produced no artifact. A census that stops at a table repeats that failure one level up: the number exists, nothing moves, and the next round names the same bottleneck in different words again. | Phase 3 exists for exactly that, and its verify requires a recorded decision naming the chosen authoritative carrier and the reason, plus a census re-run showing that row's count changed or stating why it did not. | Phase 3 — One decision, on evidence |
