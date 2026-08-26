<!-- evidence-type: analysis -->
<!-- evidence-artifact-type: analysis -->

# Council — where the "an instruction file over-reports" obligation lives

**Date:** 2026-08-26 · **Members configured:** `anthropic/claude-sonnet-4-5`,
`openai/codex-default` · **Rounds:** 2 · **Verdict: B, on one seat.**

> **DEGRADED — 1 of 2 members answered. This is not convergence.**
> `anthropic/claude-sonnet-4-5` returned `exit_1`. Recorded per the drain-run
> directive's degradation clause rather than presented as a two-seat result,
> and the single-seat basis is stated wherever this decision is cited.

Recorded under the standing directive: a disposition that would normally end in
"ask the maintainer" goes to the council, and the council's recorded decision
substitutes for sign-off. `road-to-consumer-repo-reality` step 1.5 makes the
placement a recorded decision rather than an assertion.

## What was asked

A root agent-instruction file names a path that does not exist in the tree.
Measured in three first-party consumer installs: one described a whole agent
layer that was absent; another had the layer but two of its four advertised
directories were missing; a third carried no agent surface at all.
[`missing-skill-recovery`](../../../src/rules/missing-skill-recovery.md) covers
the mirror case — a catalogue that **under-reports** — and does not cover this
one.

Three dispositions were put: **A** extend `missing-skill-recovery` · **B** add a
sibling rule · **C** the Phase-1 diagnostic discharges it and no rule is needed.
A fourth was invited explicitly so it could be rejected on the record.

## The verdict

**B — a narrowly scoped sibling rule.**

> "I agree with Reviewers A and B that catalogue under-reporting and
> instruction-file over-reporting have different triggers, causes, and remedies;
> that is the strongest argument against combining them."

The seat supplied both descriptions verbatim, and both are used as given:

- `missing-skill-recovery` — *"Recover capabilities omitted from the delivered
  skill catalogue"*
- `instruction-path-verification` — *"Verify instruction-referenced repository
  paths exist before routing through them"*

It named the strongest counter-argument itself and answered it:

> "The strongest counter-argument is the always-loaded rule budget, but that
> favors a compact rule with one obligation and excludes expanding the
> already-misaligned 101-line rule."

And it rejected two alternatives from its own round-1 reading:

> "I disagree with Reviewer A's `think-before-action` alternative because a
> generic verification rule would make this failure difficult to discover, and
> with Reviewer B's shared-parent option because it adds abstraction without
> eliminating the need for direction-specific triggers and remedies."

On the roadmap's two extra requirements — the carrier must state the
over-reporting direction explicitly, and be reachable from the diagnostic's own
output:

> "Have the diagnostic identify the dangling path, explicitly state that the
> instruction surface over-reports the tree, and link the sibling rule's exact
> identifier; these reachability requirements strengthen B rather than changing
> the choice."

## What landed

`instruction-path-verification` (not in the tree — transferred), `type: auto`, `tier: 2a`,
`packs: [meta]`, `enforced_by: instruction-only`. It carries:

- the over-reporting direction in its own Iron Law;
- a two-row table contrasting it with the under-reporting sibling, including the
  decisive asymmetry — the sibling's remedy is `suggest_skill_for_task`, which
  has nothing to say about a path in a markdown file that does not resolve;
- the three-outcome contract, so an uninterpretable path is never called absent;
- the diagnostic invocation, with the sentence that running it is **not** this
  rule: the command answers when somebody runs it, the rule binds mid-session.

Reachability in the other direction is code, not prose:
`checkInstructionPaths` names `instruction-path-verification` in its `fail`
message, so a consumer reading a dangling-path report is pointed at the
obligation.

## The honest limit of this record

One seat. The reasoning is checkable and was checked against the tree — the
101-line length, the `type: auto` classification and the
`suggest_skill_for_task` remedy were all read from
`missing-skill-recovery.md` at the current commit rather than taken from the
seat's summary — but a single-seat verdict is not the two-seat convergence the
other decisions in this drain run carry. A later change that wants to merge the
two rules is not relitigating a convergent decision.
