# Symptom-driven harvest loop

> The procedure that turns an **operator's production symptom** into a roadmap
> this repository can execute. It is the inverse of the source-driven harvest:
> that one starts from external material pushed onto the repo and asks what is
> worth adopting; this one starts from a failure someone hit in production and
> pulls external material in **per confirmed defect**.
>
> Body of `road-to-symptom-driven-harvest-loop` Phase 2. It lives here rather
> than inline in [`roadmap-writing`](../../../src/skills/roadmap-writing/SKILL.md)
> because that skill is already ~4.8k tokens — well past the 3,500-token band —
> and a procedure needed a few times a quarter should not be paid for on every
> roadmap-authoring turn. The skill carries the pointer.

## When this applies

An operator reports a failure in their own words — "runs never end", "the agent
screenshots instead of reading the code" — rather than a defect with a file and
a line. File it first under [`agents/tickets/symptoms/`](../../../agents/tickets/symptoms/README.md);
that entry is what this loop resolves.

Not this loop: a defect already traced to a file (that is a roadmap item), a
feature request (roadmap or ticket), or external material arriving unprompted
(the source-driven harvest family).

## The four steps

**1. Confirm against the live tree, at a pinned commit, before any external
search.** One `file:line` per claim, and the pin recorded next to it. The
ordering is the load-bearing part: searching externally first produces a plan
about the ecosystem's problems rather than this tree's, and every subsequent
round inherits that frame. A symptom that does not reproduce as a confirmed
defect gets a `null:` block and stops here — that is a result.

**2. Triangulate externally, per confirmed defect, never additively.** For each
defect, and only for each defect: the host tool's own issue tracker, its official
docs **fetched fresh**, and practitioner reports. Inverted form throughout — the
defect is the anchor, the source is drawn in to explain or bound it. A source
that matches no confirmed defect is not evidence for this roadmap; note it and
drop it.

**3. Iterate at least two further rounds, each stating its delta.** A round that
changes nothing ends the loop early and says so. This is the step that is
skipped under time pressure and the step that pays: on the first run of this
loop, round 2 refuted a standing repo blocker from the official payload spec,
imported a constraint that reshaped a whole phase from "block on invalid" to
"command-hook, disk-fallback, block-once", and round 3 found a reopen-clause
deadlock that was the *only* argument for reopening cancelled work at all. A
one-pass version would have shipped a roadmap re-proposing cancelled items with
no reopening argument and a mechanism the host would have broken.

**4. Emit with a symptom→defect map and per-phase falsifiers.** The map is the
artifact the operator can read: their words in one column, confirmed defects with
anchors in the next, owning phase in the third. Every phase carries the
measurement that would delete it.

## Step 5, added by the first three runs: re-verify at adoption

A roadmap drafted at a pin and adopted later is a **snapshot of an opinion about
a tree that has since moved**. Before adopting, re-verify every repo claim at the
current tip and record the deltas.

This is not ceremony. Adopting the first three runs of this loop, 81 commits
past their shared pin, re-verification found 32 of 36 claims still true — and:

- one defect had **fixed itself** (a function measured as having zero production
  callers had acquired one), which deleted a roadmap step before anyone built it;
- one claim was **wrong at the pin too** (a count stated as six where the tree
  binds seven), which no amount of re-reading the draft would have surfaced;
- three anchors had **drifted** to new line numbers while their content held;
- one cross-cutting conflict was invisible until two drafts were read together
  (a proposed "adopt the artifact's code" duty against an existing
  `NEVER ADOPT EXTERNAL CODE VERBATIM` Iron Law).

The cheapest of those to find was the already-fixed one, and it was worth the
most: an item prevented costs nothing to maintain.

## Worked example — why round 2 is mandatory

`hook_manifest.yaml` carried a comment stating that in-process subagents "inherit
the host process env and cannot be marked per-spawn", and that comment had stood
for months as a recorded blocker on a whole design axis. It was true about the
mechanism it named — the env var — and false about the conclusion.

Round 2 fetched the host's current payload specification, which states that tool
events inside a subagent carry `agent_id` and `agent_type` precisely so
subagent calls can be distinguished from main-thread ones. The env cannot mark a
spawn; the payload already did. One fetch refuted a months-old blocker, and the
axis it had closed reopened.

The general shape: **a repo comment records what was tried, not what is
possible.** Round 1 finds the comment and believes it, because it is this tree's
own evidence. Only an external round can date it.

## See also

- [`roadmap-writing`](../../../src/skills/roadmap-writing/SKILL.md) — the authoring
  skill this procedure extends; it owns phases, falsifiers, and the output format.
- [`agents/tickets/symptoms/README.md`](../../../agents/tickets/symptoms/README.md) —
  the intake convention and the two resolution blocks.
- [`source-discovery-gate`](../../../src/rules/source-discovery-gate.md) — the
  no-structural-claim-without-evidence rule step 1 is an application of.
- [`external-reference-deep-dive`](../../../src/rules/external-reference-deep-dive.md) —
  how to read a named external source properly in step 2.
