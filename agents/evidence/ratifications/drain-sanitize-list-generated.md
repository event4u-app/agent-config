---
proposed_by: claude-code session 5413debc (roadmap-process-full run, 2026-09-29)
implemented_by: claude-code session 5413debc (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 5 rounds
providers: [anthropic, openai]
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/sanitize-list-generated`

## What was proposed

`road-to-a-sanitize-list-that-is-generated`, Phases 1 and 2. Phase 3 is **left
open**; the roadmap is **not archived**.

| Surface | Change |
|---|---|
| `src/config/gate-coverage.yml` | one row: `check_read_surface_coverage`, `status: enforced`; header figures recomputed on the merged tree (345 scripts, 107 rows) |
| `.github/workflows/consistency.yml` | one step invoking it directly |
| `Taskfile.yml` · `taskfiles/ci-fast.yml` | one task definition, one chain entry |

The defect: `_lib/retrieval_sanitize.ts` carried a hand-maintained prose list of
the read surfaces it covers, and its own header stated the rule for anything not
on it — uncovered. The list was wrong in both directions, and its header already
recorded an earlier version failing the same way. Twice is a property of the
mechanism, so the list is now derived from the import graph.

## Independence

`proposed_by` and `implemented_by` are the same session, which is the shape the
Iron Law forbids reviewing itself; `reviewed_by` is the council — two seats, two
providers, neither of them the author. `council:quorum · 2/2 present` on all
five rounds.

## Five rounds. The first four did not pass.

**Round 1 — `refused`, unanimous.** A narrative was supplied where a patch was
required. The author's error, and the second time this session made it.

**Round 2 — `refused`, unanimous, on the transform.** Two findings, and the
branch was **narrowed rather than patched** on the review's own recommendation
(land the inventory gate, hold the transform):

- **`aria-hidden` is not a hiding channel.** Its content is visible to sighted
  readers — it is a screen-reader affordance — so stripping it deleted
  legitimate visible text, silently. A design error in the channel list, and
  the per-channel fixtures could not catch it because a fixture written from
  the same wrong list agrees with it. Risk 2 of the register named
  over-stripping; the mitigation it named was the one that failed.
- **A handwritten matcher mis-parses adversarial markup** — a comment
  containing a same-name tag, tag-like text inside `<script>`, nested
  same-name elements, unterminated markup. A stripper that can be confused by
  what it defends against reports success while failing.

`_lib/structural_hiding.ts` and its test are deleted from the branch.

**Round 3 — split (one APPROVE, one REQUEST_CHANGES), and the dissent was
right.** Round 2's own fix was not the fix it claimed: it compared identifiers
that had already been through `.toLowerCase()`, which folds Unicode as well as
ASCII, so the provider field the fix announced as closed was still open. Closing
one field and calling the class closed is the failure mode. Both fields now
clear a canonical-ASCII grammar on untouched bytes. Both seats also asked for
the dormant percentage rule to be removed — a condition watching a file that
does not exist — and it went in full, helper, regex, self-test case and unit
tests, because a rule half-removed is the confusion they named.

**Round 4 — REQUEST_CHANGES on the traversal test, right on all three counts.**
It `chmod 000`'d a real directory, which is not portable (under root the mode is
no barrier), and its capability check read the PARENT directory rather than the
locked one — so in that environment it would have FAILED instead of skipping:
fragile in exactly the case it guarded. Its precondition asserted a non-zero
count, which does not establish that the module behind the locked door was the
one that disappeared. Rewritten with an injected `EACCES` through a narrow
reader seam, because `vi.spyOn(fs, 'readdirSync')` is refused by ESM
(`TypeError: Cannot redefine property` — measured, not assumed).

**Round 5 — `ratified`, 2/2.** One non-blocking ask, taken: the test comment
carried the round-by-round story, which belongs in this record and not in the
tree.

## What I got wrong, and what it cost the argument

Beyond the defects above, one claim of mine was factually wrong and it was wrong
in the direction that made my own reasoning look better supported. In round 4 I
argued the grammar guards nothing reachable for this allow list, on the ground
that the only Unicode characters folding onto an ASCII letter are **Kelvin and
Angstrom**. Measured:

```
U+212A KELVIN   -> "k"  ASCII? true
U+212B ANGSTROM -> "å"  ASCII? false
```

One character, not two. The conclusion survives — no listed provider carries a
`k` — but it rests on a single character. Neither seat caught it; I put the
correction to round 5 explicitly and both confirmed the grammar stays at a
reachable set of one. The code and the test both now say so and say that an
earlier note claimed otherwise.

**Two tests in this branch are labelled non-discriminating in their own names**,
because they are: for this allow list nothing discriminates on the fold axis.
Two fixtures were written to demonstrate the vector and both passed against the
unfixed code. Labelling them was cheaper than letting a green tick read as
proof.

## What the reviewer checked, and what it could not

The governance diff, the gate's full source, the scanner's full source, the two
Phase-2 call sites and both test files — supplied verbatim across rounds 2–5
after round 1 refused the narrative. Bounded out and stated by the seats
themselves: the generated document, the surrounding implementations, and the
command output they could not re-run.

## What would have changed the verdict

The transform kept in any form. The percentage rule left dormant. The traversal
test left permission-dependent. The allow list compared on a transformed value
in either field.

## Open

Phase 3 stays open with what the detector needs before it returns: a parser
rather than a matcher, adversarial fixtures per shape, an explicit removal
policy (silent irreversible deletion leaves callers unable to debug), and
`aria-hidden` off the channel list. A frozen corpus is not required to test
declared channels, but both seats were explicit that one is required before
claiming detection adequacy for the class.
