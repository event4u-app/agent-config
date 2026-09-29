---
proposed_by: claude-code session 5413debc (roadmap-process-full run, 2026-09-29)
implemented_by: claude-code session 5413debc (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 3 rounds
providers: [anthropic, openai]
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/host-claims-contradicted`

## What was proposed

Closing `road-to-host-claims-the-tree-contradicts` Phases 1 and 3. Three
governance surfaces are touched, which is why this record exists:

| Surface | Change |
|---|---|
| `src/config/gate-coverage.yml` | one row: `check_host_format_column`, `status: enforced`, with a `min_scanned` floor, a declared `ci_invocation` and a `no_canary_reason` |
| `.github/workflows/consistency.yml` | one step invoking that script directly |
| `Taskfile.yml` · `taskfiles/ci-fast.yml` | the task definition and its place in the chain |

The rest of the diff carries no governance surface: the new check and its test,
one corrected format cell plus two prose sections in
`docs/enforcement-by-host.md`, and a comment-only rewrite of
`src/scripts/hooks/one_question_per_ask_hook.ts`.

## Why `ratified` and not `confirmed-non-expanding`

The first round asked for `confirmed-non-expanding` on the reasoning that a
check which can only refuse grants no new capability. One seat refused that
classification outright, and the objection is accepted rather than argued with:

> A new power to refuse IS authority expansion in governance terms. Before this
> branch, host-format inconsistency could not block a merge. After it, it can.

The second seat disagreed on the point of law — the stated test names the
package's or an agent's authority, not the set of blocking conditions — so the
seats split. The branch takes the stronger label, because
`ratification-artifact.md` § the six fields makes misclassification a review
error rather than an option, and `ratified` is a passing verdict too. Nothing
was lost by conceding it.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same session. That is the shape the
Iron Law forbids reviewing itself, which is why `reviewed_by` is the AI council:
two seats, two providers, neither of them the party that wrote the diff —
`council:quorum · 2/2 present` on every round.

## What the review actually changed

Three rounds, and the first two did not pass. Recorded because a ratification
whose review found nothing is the shape this file exists to make suspicious.

**Round 1 — `refused` / REQUEST_CHANGES, unanimous, on method.** A narrative was
supplied where a patch was required. Both seats declined to ratify a table of
assertions about a diff they could not read. That was the author's error and it
is the finding with the highest leverage in this record: the round cost a full
pass and established nothing about the code.

**Round 2 — `refused`, two blockers, both agreed by both seats.**

1. **The gate's verdict overstated its oracle.** The green line claimed every
   path named in the format column is "written by an emitter in this tree". Only
   the measured half was observed being written; the declared half is a root read
   out of `ADAPTER_REGISTRY` — the projection's source of truth, but not an
   observation the run took. Both the green and the red line now name which half
   a path resolved to. This is the defect the gate itself exists to catch, one
   level up: a claim wider than the check behind it.
2. **The timeout rows could not be anchored.** Three rows asserted the host's
   cancel-and-discard semantics, each marked `read-from-host-documentation`, cited
   as "Claude Code's own hooks reference, § hook execution / timeout" — no URL, no
   host version, no retrieval date, in a document whose every other column is read
   off a file in this repository. One seat held the current primary source
   contradicts part of what they asserted. The rows are **withdrawn**, not
   re-cited: this session cannot anchor a vendor page to a version and a date it
   can prove. `docs/enforcement-by-host.md` now carries a stated gap instead —
   what it does not record, why, and the shape a usable row would take.

   Risk 3 of the roadmap's own register predicted this failure in advance. The
   mitigation it named (a provenance marker) was implemented and was **not
   sufficient**, which is a finding about the mitigation, not about the review.

3. Non-blocking: three argv shapes silently coalesced to `ROOT` — a trailing
   `--root`, a repeated `--root`, and a stray positional. A fixture test written
   that way passes without ever opening its fixture. All three refused now.

**Round 3 — `ratified`, 2/2, both blockers cleared, no required pre-merge
change.** One suggestion, endorsed by both seats: a self-test case for
`--root --quiet` by name. Added, and **labelled as non-discriminating** in the
case name itself, because the coalescing code also exited 2 on that shape (no
document under `--quiet`) — the three cases that would have caught the defect
are the other ones. Saying so in the case name is cheaper than a reader later
assuming all nine discriminate.

## One round-3 claim that does not reproduce

One seat wrote that "unknown options such as `--bogus` remain silently
accepted". Measured on the branch:

```
$ ./scripts-run src/scripts/check_host_format_column --bogus ; echo $?
check_host_format_column: unrecognised flag(s): --bogus
    known: --self-test, --root, --quiet
2
```

The pre-existing `unknown` filter refuses it. Recorded because a ratification
that repeats a reviewer's every claim unchecked is not a review of the review.

## What the reviewer checked

The complete diff of all three governance surfaces, the full source of the new
check, its full test file and the exact documentation wording — supplied
verbatim in rounds 2 and 3 after round 1 refused the narrative. Both seats
independently confirmed that the emitter run's writes are confined to a
temporary root and removed in `finally`, that the three representations of one
invocation are reconciled by `check_gate_coverage`'s literal comparison, and
that no injection, secret-handling or authorization issue is present.

## What would have changed the verdict

A row asserting host semantics from an unpinnable source, kept rather than
withdrawn. A verdict line still claiming an observation for a registry read. Any
change to the guard's deny path, `fail_closed: false` posture or manifest
`tools:` list under cover of the comment rewrite — the diff is comment-only and
filtering it for non-comment lines returns empty.

## Still open, by the review's own note

Both seats observed that the branch mixes governance with non-governance
changes. Neither required a split at this stage: this repository's gate is
per-branch, so splitting would produce two branches and two artifacts for one
roadmap. Recorded rather than resolved.

Roadmap Phase 2 is left **open** with the refusal as its named blocker, and the
roadmap is **not archived**.
