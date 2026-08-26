<!-- evidence-type: analysis -->
<!-- evidence-artifact-type: analysis -->

# Council — a grace ceiling pinned at HEAD, and a rule that cannot fit under it

**Date:** 2026-08-26 · **Members:** `anthropic/claude-sonnet-4-5`,
`openai/codex-default` · **Rounds:** 2 · **Quorum:** 2/2, concluded ·
**Actual cost:** $0.0322 · **Verdict: D, convergent.**

Recorded under the drain-run directive: a disposition that would normally end in
"ask the maintainer" goes to the council. This one is the value-over-budget
escalation [`token-budget-discipline`](../../../src/rules/token-budget-discipline.md)
requires — a change blocked purely on a budget line, surfaced rather than
silently dropped or silently bumped.

## What was asked

`check_preamble_payload_budget`'s CI ceiling is a **grace ceiling pinned exactly
at HEAD's measurement** (138,212), by explicit design: *"growth beyond today reds
immediately while today's total is tolerated."* Step 1.5 of
`road-to-consumer-repo-reality` adds one rule, and step 5.1 adds a section to an
existing one. Together they measure +1,731 tokens. Any addition reds the gate.

Four dispositions were put — **A** raise the ceiling, **B** ship with a red
check, **C** drop the rule, **D** fund it by removing an equivalent amount
elsewhere — plus an invitation to name a fifth.

## The verdict

**D, with an audit as its precondition, and not before.**

> "**D, conditionally.** I agree with Reviewers A and B that raising the ceiling
> or knowingly ignoring red CI destroys the gate's stated function, while
> dropping the rule leaves a demonstrated coverage gap. I also agree that any
> offset should follow a documented value-and-overlap audit — preferably
> consolidation or deduplication — not an arbitrary 1,314-token deletion."
> — openai

> "Ship the diagnostic NOW, defer the agent-side rule UNTIL a value audit
> identifies 1.3k tokens of demonstrably lower-value or redundant content to
> remove. … The grace ceiling exists BECAUSE the corpus is already 28.4 % over
> the design budget — it's an emergency brake on an over-budget state, not a
> normal operating ceiling. Any addition to over-budget corpus requires
> demonstrating it's more valuable than existing content, or that existing
> content is redundant. **Neither has been shown yet.**"
> — anthropic

Both rejected **A** and **B** on the same ground, and it is the one that binds a
later promoter: raising the ceiling on the first addition is the precedent that
makes it inert, and a red check a reviewer is told to ignore is how a gate
becomes background noise.

## The shortcut both closed before anyone reached for it

The obvious escape is that `instruction-path-verification` is `type: auto` and
loads on a trigger, so perhaps the census should not count it:

> "I disagree with … the suggestion that excluding `type: auto` might merely
> 'fix the census': the budget is explicitly defined as standing per-spawn
> payload, so exemption is valid only after proving through **actual spawn
> traces** that the rule is never preloaded, **not from its label**."
> — openai

That is a real fifth option, and it is gated on evidence nobody has produced.

## The one thing neither seat said, recorded because it is the honest limit

Neither seat weighed the **counterfactual cost of the gap**: an agent routing on
a dangling path was measured in three first-party installs, and the deferral
leaves that carried by nothing on the agent side. anthropic named it as the
strongest counter-argument to its own verdict —

> "A diagnostic that requires manual invocation doesn't discharge the
> obligation — it just makes the gap discoverable when someone looks."

— and chose D anyway. So the decision is *not* that the obligation is
unimportant; it is that an over-budget corpus may not grow on an unaudited
claim of importance.

## What was done

Both steps' prose was **removed from the branch** and transferred to
[`stubs/road-to-instruction-path-obligation.md`](../../roadmaps/stubs/road-to-instruction-path-obligation.md),
with the measurements, the rejected dispositions and the audit precondition. The
deterministic half of 1.5 — `doctor --check instruction-path-reach` — ships,
because it adds no rule payload.

Two consequences worth naming, since both are the sort of thing that quietly
does not happen:

- The **stub ceilings** raised for the two routing rules were **restored** to
  126 and 129. Compressing their Iron-Law clauses to fit the payload budget also
  brought them back under their original ceilings, so the ratchet raise this
  branch had recorded is no longer needed and was removed rather than left
  standing.
- The shipped payload measures **exactly 138,212** — net zero against
  `origin/main`. Not "close enough": the gate's whole property is that growth
  reds, so a branch that ships at +14 has spent the property.
