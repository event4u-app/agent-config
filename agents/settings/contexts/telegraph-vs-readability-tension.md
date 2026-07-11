# Telegraph-speak vs. reply-prose readability — open tension (council re-eval routed)

**Status:** surfaced 2026-07-11 (road-to-opt-harness-discipline Phase 5); maintainer
disposition = **re-evaluate in the AI council**. Not silently flipped, not silently kept.

## The tension

A strong-host native coding-harness mandates **complete sentences** for the
agent's reply prose and **bans fragment / arrow-chain grammar** (readability for
the human reader). `telegraph-speak` (`type: auto`, tier 1) does the opposite for
reply prose: it condenses to telegraph grammar (drop articles, fragments,
`X → Y` causality) for **token frugality**. Both target the same surface — the
agent's chat-reply prose — so they genuinely conflict.

The conflict is not hypothetical: the package's own `direct-answers` rule already
states *"being readable and being concise are different things, and readable
matters more,"* while the frugality canon (`telegraph-speak`, `token-budget-discipline`,
thin-projector) pulls toward maximal condensation. The two canons disagree about
reply prose, and neither currently wins by an evidenced decision.

## Why council, not a unilateral flip

Per [`decision-revisit-gate`](../../../.agent-src.uncondensed/rules/decision-revisit-gate.md),
a change blocked (or driven) purely by a budget/frugality-canon line gets the
trade-off **surfaced and re-evaluated**, never an auto-flip. `telegraph-speak` is a
deliberate, documented frugality lock; readability is a load-bearing quality goal.
That is exactly the "genuine trade-off, route to council" shape.

## What the council should decide

- Does reply-prose readability outweigh the telegraph token savings, for which
  `speak_scope` default (`off` / `prose_only` / `aggressive`)?
- If a change is warranted, is it a default flip, a new readability floor inside
  telegraph grammar, or a per-surface carve-out — and what evidence (token delta
  vs. re-ask / comprehension cost) supports it?

## Revisit-if / how to run

Invoke `/council` (or `/council:debate`) on this question when ready — **not
auto-run** from the roadmap (per `commit-policy` / `scope-control`: council spend
is the maintainer's call). Record the convergence outcome back into
`telegraph-speak` (inline convergence summary: members + date, no session path,
per `no-roadmap-references`).
