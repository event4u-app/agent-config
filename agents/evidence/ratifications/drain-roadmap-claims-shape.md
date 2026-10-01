---
proposed_by: claude-code session 726708e6 (roadmap-process-full run, 2026-10-01)
implemented_by: claude-code session 726708e6 (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 1 round
providers: [anthropic, openai]
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/roadmap-claims-shape-20261001`

## What was proposed

`road-to-roadmap-claims-with-a-shape`, all three phases. Six steps, four
acceptance criteria, each verified by its own `verify:` line and each line run.

| Surface | Change |
|---|---|
| `.github/workflows/consistency.yml` | three steps added: the new gate, its self-test, and a caller for `check_held_object_arrivals` |
| `src/config/gate-coverage.yml` | one row: `check_verify_expectation_delta`, `status: enforced`, `min_scanned: 0` |
| `src/scripts/check_estate_count.ts` | block-scalar read for `exemptionReason`; shape + duplicate refusal on ADDED exemptions; `draft_roadmaps` reported |
| `src/scripts/_lib/exemption_shape.ts` | new — the disposition vocabulary, shared by the gate and its reader |
| `src/scripts/estate_exemption_shape.ts` | new — the producing command for the exemption measurement |
| `src/scripts/check_verify_expectation_delta.ts` | new — the diff-scoped verify-expectation gate |
| `tests/scripts/*` | 13 new cases across two files |
| `agents/evidence/analysis/*` | two measurement records |

## Why this is a gated diff at all

`check_kernel_edit_ratified` watches `.github/workflows/consistency.yml`,
because that workflow carries the step deciding whether the ratification gate
runs. The watch is path-based and has no notion of direction, so a change that
only ADDS constraint still trips it. That is the gate working as designed, and
the record below is what it asks for rather than a complaint about it.

## Independence

`proposed_by` and `implemented_by` are the same session, which is the shape the
Iron Law forbids reviewing itself. `reviewed_by` is the council — two seats, two
providers, neither of them the author. `council:quorum · 2/2 present, needed 1`
both before and after the run.

One operational note, because it would otherwise read as a configuration
problem: both seats first resolved `unknown (live_probe: no exchange with this
provider has ever been recorded)` and the run came back 0/2 INCONCLUSIVE. The
probe store lives at `agents/runtime/state/council-probes.json`, which is
gitignored, so a fresh worktree has none. The machine's own store was copied in
and the run concluded 2/2. Nothing about the question or the seats changed.

## The verdict

**`confirmed-non-expanding`, both seats.** Neither seat found an authority
expansion; both said so independently, and the policy's own note is that a
non-expanding change must not be labelled `ratified`.

Seat A (anthropic), on each question: no expansion — the gates add constraint,
the parser fix closes a gap rather than opening one, the advisory check exits 0;
the ratification invocation is neither modified, disabled, reordered nor
conditioned; the manifest row is a real gate with a real floor and a real
negative control; the enforcing/advisory split is evidence-based.

Seat B (openai) reached the same classification by a different route and was
explicit that the ratification verdict is **narrower than a merge approval**: it
confirms the authority direction and does not confirm operational correctness of
code it was not shown.

## What seat B asked for, and what was done

The council saw two files — the governance diff — which is the gated surface and
not the whole branch. Three asks, all taken:

1. **"Replace volatile statistics in workflow comments with a durable
   reference."** Taken, in full. The replay figures are gone from the workflow
   comment and replaced by the command that reproduces them
   (`check_verify_expectation_delta --replay 30`); the arrival check's step no
   longer restates a false-positive rate that lives in the check's own header.
   The seat's reasoning is right and worth keeping: a precise number in a
   comment looks evidentiary, is easy to rubber-stamp, and goes stale silently.

2. **"Include or link the implementation, independent regression tests and
   passing CI evidence."** The implementation and tests are in the same pull
   request — the council was handed the gated surface, not the branch. 13 test
   cases across `tests/scripts/check_verify_expectation_delta.test.ts` (9) and
   the new `shape` cases in `tests/scripts/check_estate_count.test.ts` (4), plus
   the gate's own 9-case `--self-test` run as its own CI step. CI evidence is
   the run on this pull request; this record is written before it, and that
   ordering is stated rather than hidden.

3. **"Name an owner for the known collateral."** Taken, and then the collateral
   resolved itself before this branch pushed. The named PR was **#2144**
   (`drain/behavior-vocabulary-close`), carrying three bare clauses:
   `wc -w src/skills/test-case-discovery/SKILL.md` in
   `road-to-behavior-vocabulary-and-runner-truth.md`, and `npm ls fastify hono`
   plus `npm audit --omit=dev --audit-level=high` in
   `road-to-upstream-advisory-bump.md`. It merged as `00612c1f2` while this
   branch was being reviewed, so those three clauses are now base content and
   the diff-scoped gate never reads them — grandfathered by exactly the
   mechanism that makes this gate shippable at all.

   **This is luck, not design, and the ask stands answered rather than
   dissolved.** Had #2144 landed after this branch, its owner would have owed
   three edits: the two `npm` clauses take `-> 0`, and the `wc -w` clause needs
   a regex, because `wc` exits 0 on any file. The record keeps the name and the
   diff so the next enforcing gate over this surface starts from a worked
   example of what the disclosure has to contain. Re-measured against the moved
   base after the merge: this branch's own diff adds one verify clause and the
   gate is green on it.

## What seat B's dissent does NOT cover, said plainly

Seat B's `REQUEST_CHANGES` is a **merge** disposition, not a ratification one —
its own text says "ratification may pass as non-expanding". Both seats'
ratification verdicts agree, and the policy's quorum is met. Nothing here reads
the dissent as cleared by having been answered: a reviewer who could not see the
implementation still has not seen it, and the pull request is where that is
checked.

One of its observations stands as a limitation of this record rather than
something fixed: a self-test living inside the production script is weaker than
an independent fixture-based control, because a shared parsing defect can make
both agree. The mitigation here is that the gate ALSO has unit tests that import
its functions directly, and one of those asserts the gate carries no second copy
of the arrow regex — which is the specific shared-defect axis that matters for
this gate. It is not a general answer to the objection.

## What would have changed the verdict

Any of: a change to the `check_kernel_edit_ratified` step itself; a
warn-and-allow wrapper on the new gate, which would make an enforced manifest
row false; a `min_scanned` floor above 0 on a diff-scoped gate, which would fail
every unrelated pull request; the exemption shape rule reading files already in
the tree rather than only those the diff adds.

## Open

None from this roadmap. The promotion of `check_held_object_arrivals` to
`--enforce` stays open by design, conditioned on a green run on `main`.
