<!-- evidence-type: analysis -->

# Council record: five design decisions for autonomous roadmap runs (2026-11-03)

- **Question:** `agents/evidence/council/inbox-2026-11-v-autonomous-runs-20261103.question.md`
- **Members:** anthropic/claude-sonnet-4-5 (CLI, subscription), openai/codex-default (CLI, subscription).
  1 round, mode `design`. Quorum 2/2. Spend $0.00 (non-billable seats).
- **Neutrality:** round 1 saw the question file and the neutral system prompt, nothing else.

## Verdicts

| Q | anthropic | openai | Outcome |
|---|---|---|---|
| Q1 run-level defaults under process-full | (c) declare by invocation flag | (b) command-specific defaults | **split**. Both reject (a), keeping `halt`/`wait` silently. Built: the convergent subset, flags. The default goes to the owner (O-1). |
| Q2 mechanical hold at turn end | (b) scope record only | (b) scope records first, refusal experimental | **convergent (b)** |
| Q3 `high_impact` / `user_required` under process-full | none: a governance contradiction | (c) preflight known decisions, quarantine dependents; whether delayed notification satisfies escalation is a policy decision | **convergent on "policy decision"**, so owner-reserved (O-2) |
| Q4 process-step / process-phase grant model | (a) | (a), with exclusions kept explicit | **convergent (a)** |
| Q5 several roadmaps, one PR | (a), worded "one invocation, one deliverable" | (a), with a frozen manifest, cycle detection, and "at most one delivery PR" | **convergent (a)** |

## Must-fix conditions carried into the roadmap

- Q1/Q2: persist the declared policy and the discovery counter so that they survive a resumed run.
- Q2: a refusal gate needs, before it is enabled, a dated trial, a completion-improvement threshold,
  time and spend budgets, a disable switch that works even on corrupt state, and preserved cancellation.
- Q4: keep the exclusions (Hard Floor, security-sensitive, scope-out). A blocked step must not run
  other steps to make itself runnable.
- Q5: resolve and freeze the manifest before the first edit, refuse cycles, and bind `--from-pr`
  to a revision. PR content names candidates and never expands authority. A blocked member
  blocks only its dependents.

## Dissent recorded

anthropic called Q4 a one-way door and Q3 unanswerable without a governance choice between
"process-full is fully autonomous" and "no command is". openai called Q4 reversible for defaults.
