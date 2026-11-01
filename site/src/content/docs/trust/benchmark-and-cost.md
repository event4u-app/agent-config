---
title: "Benchmark and cost, explained"
description: What we measured about Agent Config, what it costs in tokens, where it helped and where it did not — in plain words, with every figure linked to its run.
---

Agent Config makes a weaker model more disciplined, does nothing measurable for a strong one, and costs more tokens either way. This page explains the measurements behind that sentence; the [full benchmark](/agent-config/benchmark/) has every table.

Pick how much is loaded when you install:

```bash
npx -y @event4u/agent-config init --profile balanced   # minimal | balanced | full
```

## What we measured

We gave the same coding tasks to the same model twice — once plain, once with Agent Config — and scored **discipline**: did the agent update every caller it should have, stay inside the task and check its work? Each task family is built around a trap a careless agent falls into. The runs are paired, the scoring is deterministic, and a third arm with an equal amount of unrelated text rules out "it only helped because the prompt was longer".

## What it showed

- **On a weaker model (Claude Haiku), discipline improved significantly** — and beat the equal-length placebo, so it is the content that helps, not the length. <!-- claim:discipline-lift-weak-host -->
- **On a strong model (Claude Sonnet), nothing moved.** The strong model was already at the ceiling on these traps; Agent Config was redundant there. We publish this as a [null result](/agent-config/benchmark/#strong-host-sonnet-full-30-task-corpus--gate-verdict-honest-null).
- **On a non-Claude model the gain did not replicate.** [Details](/agent-config/benchmark/#p2-gate--non-claude-weak-host-gpt-5-mini-via-codex--replication-failed).
- **The gain is scoped to the trap it targets.** On the scope and downstream-changes family it took Haiku from 0.533 to 1.000; on families where Haiku was already near the ceiling it changed nothing. <!-- claim:essential-tier-cost-factor -->

It changes behaviour, not intelligence: it does not make a model smarter.

## What it costs

Checking its work is what spends the tokens. All figures are from Claude Haiku with the rules pasted as text, not the full plugin.

| Install profile | What it loads | Measured cost (Claude Haiku) |
|---|---|---|
| `minimal` | The always-on rules only | Not measured as its own arm. |
| `balanced` (default) | The cut that carries the gain, on Claude models without a measured null; less on Sonnet and on non-Claude models | 3.3× a run with no rules on the task family where it helps; about 1.7× over the full corpus <!-- claim:essential-tier-cost-factor --> |
| `full` | Every rule; experimental, opt-in | 11.7× a run with no rules <!-- claim:essential-tier-cost-factor --> |

Sources: the [cost-factor sweep](/agent-config/benchmark/#cost-factor-sweep-claude-haiku-4-5--lift-per-loaded-context-cost) and the [full-corpus run](/agent-config/benchmark/#full-corpus-p1-gate-claude-haiku-4-5-all-30-tasks--family-scoped-pass). Do not carry these numbers past Haiku: the strong-model run was a null and the non-Claude replication failed.

The role you pick in the wizard changes **which** skills you get, not this cost. `/cost:report` shows what your own sessions spend — see [Cost and budget](/agent-config/features/cost/).

## Why not just write a short CLAUDE.md?

Partly, you could — and we measured how far that gets you. On Claude Haiku, the always-on rules plus one more rule (`downstream-changes`), pasted as plain text, kept a significant gain (+0.458 against +0.542 for the full package) at 3.3× the tokens of a run with no rules, against 11.7× for the full package; the remaining gap was not significant. <!-- claim:essential-tier-cost-factor -->

Two findings matter if you write your own file:

- **Content beats length.** A larger rule set that left out the one rule carrying the gain produced no gain at all.
- **The cost is the behaviour.** The smaller set cost slightly more per run than the larger null one, because checking its work is what spends tokens.

What the package adds beyond a static file: rules that load only when a task needs them; refusal where the tool allows it (Claude Code); workflows such as `/work` and `/review:changes` that carry the procedure, not only the reminder; the same setup in every tool; and a clean way out.

## How to read our numbers

Every figure on this site carries a link to the run that produced it, and the build fails when a figure on a page has no backing entry in the [claims ledger](/agent-config/claims/). Results that did not hold are published too — [check our claims](/agent-config/trust/check-our-claims/).
