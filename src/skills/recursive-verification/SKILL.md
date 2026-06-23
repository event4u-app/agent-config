---
model_tier: inherit
name: recursive-verification
description: "Use to run a depth-bounded self-correction loop (attempt → critic verdict → re-attempt) as a tunable test-time compute knob — a do-and-judge specialisation, default off, capability-gated."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# recursive-verification

## When to use

* A first attempt at a bounded task may be improvable by feeding the
  attempt plus an explicit critic verdict back into a corrective
  re-attempt — and the extra compute is justified by the task's value.
* You want **depth** (number of correction rounds) to be an explicit
  compute knob, not an open-ended loop.
* The shipped default (`verification.recursive`) is not `off` for the
  active host, or the user asks for an extra self-correction pass.

Do NOT use when:

* The task is trivial — a one-liner, a rename, a format fix. The loop's
  cost dwarfs any gain (the package's A/B bench measured ~11× tokens for
  a single wrapper pass; recursion multiplies that per depth level).
* The host already one-shots the task. On a strong host with no headroom
  a second pass only adds cost (see `docs/benchmark.md`: strong-host
  discipline lift is null).
* You are chasing **model intelligence**. This transfers a test-time
  *compute* pattern, not capability — it cannot make a model smarter than
  its weights, and it implies **no** comparison to any frontier model.
* Budget is the constraint, or `verification.recursive: off` for this host.

## Goal

Land a verified result by running a depth-bounded
`attempt → critic verdict → conditional re-attempt` loop, with depth as
the only compute knob, every level budgeted, and the loop default-off
until a benchmark gate authorises it per host.

## The Iron Law

```
A CROSS-MODEL CRITIC NEVER RUNS ON THE SAME MODEL + CONTEXT AS THE ATTEMPT.
SAME-MODEL SELF-CRITIQUE IS A DISCIPLINE PASS ONLY — NEVER A CAPABILITY CLAIM.
```

Inherited from [`subagent-orchestration`](../subagent-orchestration/SKILL.md):
same model + same context = same blind spots. A same-model self-critique
at depth 1 is allowed **only** when explicitly flagged as a *discipline*
(not capability) pass — it can catch a skipped step or a scope-creep, but
it shares the attempt's blind spots and must never be sold as a capability
lift. Cross-model recursion (a different vendor as critic) is the
cross-vendor variant and obeys the Iron Law by construction
(critic model ≠ attempt model).

## The loop

```
attempt₀
  → critic verdict (accept | revise: <reason>)
    → accept            → done
    → revise            → attempt₁ (reads attempt₀ + the verdict as context)
      → critic verdict
        → … → depthₙ
```

Each level reads **only** the prior attempt plus the critic's verdict —
never the full history — mirroring the read-your-own-output-and-decide
pattern. Depth `n` is the tunable compute knob, hard-capped by
`verification.max_depth`.

## Deterministic stop conditions

The loop stops at the first of:

1. **`accept`** — the critic accepts the attempt.
2. **`max_depth` reached** — `verification.max_depth` (default `1`).
3. **`verify-budget` exhausted** — each re-attempt is one budgeted unit
   per [`verify-budget`](../../contexts/execution/verify-budget.md); a
   required-but-unrun verification is a surfaced safety gap, never a
   silent pass.
4. **No-progress floor** — two consecutive attempts score identical on
   the deterministic scorer; further depth cannot help, so stop.

Stop conditions are deterministic so the loop can never run unbounded —
there is no open-ended "keep trying" branch.

## Settings

Configured in `.agent-settings.yml`; documented in
[`agent-settings`](../../templates/agent-settings.md):

| Key | Default | Effect |
|---|---|---|
| `verification.recursive` | `off` | `off` = inert; `ask` = ask once before looping; `on` = loop silently up to `max_depth`. |
| `verification.max_depth` | `1` | Hard cap on correction rounds. `1` = a single critic pass (effectively inert beyond one review) until a benchmark gate authorises more. |

Ships `off`. The per-host shipped default flips only on a passing
capability-axis benchmark cell (see Procedure step 4); an honest-null
keeps it `off`.

## Procedure

### 1. Gate on settings + task shape

Resolve `verification.recursive` for the active host. `off` → no-op.
Confirm the task is non-trivial (above the `verify-budget` change-size
floor) and that the host plausibly has headroom — skip otherwise.

### 2. Resolve the critic

Read `.agent-settings.yml` (`subagents.judge_model`). A cross-model
critic must satisfy the Iron Law. A same-model depth-1 pass is allowed
only when explicitly flagged as a discipline pass; surface that framing.

### 3. Run the loop

Run `attempt → verdict → conditional re-attempt`, counting each
re-attempt against `verify-budget`, until a deterministic stop condition
fires. Under `verification.recursive: on` surface depth + spend in one
line; under `ask`, ask once before the first re-attempt.

### 4. Honour the benchmark gate

The shipped default is set by the `bench:ab` gate
([`orchestration-benchmark-gate`](../../contexts/execution/orchestration-benchmark-gate.md),
`gateVerdict` / `resolveShippedDefault`): `on`/`ask` only on a host whose
**capability-axis** cell passed; `off` otherwise. A discipline-only lift
does not authorise a flip — that question is already answered by the
existing rules. Never flip a default without its own passing cell.

### 5. Report

Follow the output format. Never present a recursion result as a
capability gain or a frontier-model comparison.

## Gotcha

* **Recursion as discipline duplicate** — if the only lift is on the
  discipline axis, recursion duplicates rules the package already ships,
  at multiplied cost. Surface it; do not ship a redundant expensive loop.
* **Unbounded loop** — there is no open-ended branch; the four stop
  conditions are deterministic and the depth cap is hard.
* **Same-model self-praise** — a same-model critic shares the attempt's
  blind spots and tends to accept; treat depth-1 same-model passes as a
  discipline check only, never as independent verification.
* **Cost surprise** — depth multiplies the per-pass token cost; confirm
  budget before raising `max_depth` above 1.
* **Strong-host no-op** — on a host that one-shots the task, every extra
  depth level is pure cost; the benchmark gate keeps the default `off`
  there.

## Output format

1. **Depth reached** — the number of correction rounds run, and which
   stop condition fired (`accept` / `max_depth` / `budget` / `no-progress`).
2. **Critic pairing** — attempt model / critic model (resolved), and
   whether it was a cross-model or same-model discipline pass.
3. **Verdict** — accepted attempt vs. handed back, with the budget spent.
4. **Evidence** — per-depth scorer/verdict trail, never framed as a
   capability or frontier-model comparison.

## Do NOT

* NEVER claim recursion makes the host model more capable or "closer to"
  any frontier model — it is a test-time compute pattern, not intelligence.
* NEVER run an open-ended loop — `max_depth` and the stop conditions are
  hard caps.
* NEVER treat a same-model self-critique as independent verification.
* NEVER flip the shipped default without a passing capability-axis gate
  cell for that host.
* NEVER skip a required verification silently — surface it as a safety gap.

## Handover

| Task | Skill / context |
|---|---|
| Mode selection, the judge Iron Law | [`subagent-orchestration`](../subagent-orchestration/SKILL.md) |
| Per-pass cost budgeting | [`verify-budget`](../../contexts/execution/verify-budget.md) |
| Shipped-default gate mechanism | [`orchestration-benchmark-gate`](../../contexts/execution/orchestration-benchmark-gate.md) |
| Cross-vendor critic (different vendor) | [`ai-council`](../ai-council/SKILL.md) |
| Completion evidence | [`verify-completion-evidence`](../verify-completion-evidence/SKILL.md) |
