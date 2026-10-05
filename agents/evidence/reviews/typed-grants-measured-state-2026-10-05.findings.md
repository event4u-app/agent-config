# Completion review — typed-grants measured state, 2026-10-05

**Skipped:** no code surface for this completion — two roadmap files, one acceptance-criterion closure and one withdrawn claim about a guard; the validator reports 0 code path(s) of 2 changed file(s), scope 0c02866c4affcb78e8a0cf527c2e6cde8ddc17ac167e4e59ded8b9626e9d3faf, declared 2026-10-05

## What this change is, and why R2 has nothing to bind to

Both changed files are roadmaps — `road-to-typed-grants-that-persist.md` and the
archived `road-to-drain-commands.md`. No script, schema, config, workflow or
projection is touched; `task sync` and `task generate-tools` have no input here.
An R2 reviewer over this diff would be reading measurement prose, one checkbox
flip and a thirteen-line supersession note. That is the shape § 2.4 names.

The substance of the change is evidence rather than design: every blocking
condition in the file was executed as a command instead of read off a `Status:`
line, and the results were written back. Nothing in the diff grants an
authority, narrows a floor, or changes what any gate does.

## What a reviewer WOULD have caught, recorded here rather than hidden

Three things, and the second is the one that matters.

**1 — the convenient reading of AC-3 was available and was refused.** The
criterion's third clause parses two ways, and one of them was already green on
the tree. Amending the criterion to that reading would have closed the box with
no work. The weaker limb was discharged instead, by a note on the archived
blocker, so both readings hold. The ambiguity is recorded in the AC rather than
removed, because a later reader should be able to see that a choice was made.

**2 — a claim this roadmap has carried since 2026-10-01 is false, and a probe
run to confirm it instead refuted it.** The kernel-guard blocker stated that
`block-kernel-rule-writes` refuses a read-only `grep` at a kernel-rule path, and
warned a later session to expect its own verify command to be denied. Executed
verbatim, the grep runs and returns 1. The correction was not accepted on one
reading: the opposite polarity was run in the same session on the same tree, an
in-place `sed` at the same path, and that IS blocked — so the negative is a live
guard rather than a dead one, and the guard's own header settles the intent
(reads stay allowed; a kernel rule is immutable, not secret). The tree and the
session memory store were then searched for other copies, each with a control
grep beside the zero: one site, one file, the paragraph itself.

**3 — a probe that did not move was not written up as a finding.** A throwaway
gate file was created to measure what a new gate costs step 4.3, and
`check_gate_completeness` reported identical counts. Rather than conclude the
cost is zero, the cause was read out of the gate: its registry is the Taskfile
closure, not a filesystem glob, so a loose file registers nothing. The real cost
was then measured on the shipped `classifyGateSource` over all four polarities,
and the avoidance path — import the gate ledger from the first commit — is
written onto the step. The probe file was removed by exact deletion, not by
`git checkout`.

## What this change deliberately does NOT do

No step closed. Twenty-five of them are held by a reproduced tool-call deny, by
a refusal to self-grant authority, or by an absent store, and this run neither
attempted a crossing nor proposed one. The two open blockers stand on human
forge actions — a repository secret carrying `administration: read`, and a
rehearsed administrator recovery from a ruleset lockout — which an agent run can
re-measure and cannot advance.
