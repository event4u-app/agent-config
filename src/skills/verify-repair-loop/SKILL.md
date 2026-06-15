---
model_tier: inherit
name: verify-repair-loop
description: "Use to iterate a change until tests/quality checks pass — bounded run→revise→re-run gated by a numeric threshold, then a judge confirms. Triggers 'iterate to green', 'keep fixing until tests pass'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# verify-repair-loop

> A bounded **generate → run → revise → re-run** cycle whose pass signal is the
> **executed verdict** — the project's real test/quality output, scored against a
> numeric threshold — escalated to a **judge** for qualitative confirmation only
> *after* the numeric gate passes (staged escalation). The loop is the
> conversation, not a process: no daemon, no persistent cross-session state. Use
> it to drive a change to green when the verdict source is *runtime execution*,
> not a judge reading a diff.

## When to use

* A change must converge against the project's **test runner / quality tools**
  and you want the agent to iterate until checks pass before asking for review.
* Test/quality coverage is the authoritative signal (high coverage, actionable
  failures) — not subjective craft.
* You want bounded auto-repair with a hard stop, not an open-ended fix loop.

Do NOT use when:

* The verdict is **subjective craft** (naming, architecture, style) or coverage
  is incomplete → use `do-and-judge` in
  [`subagent-orchestration`](../subagent-orchestration/SKILL.md) (judge reads the
  diff and is sovereign).
* You only need a **one-shot** multi-judge review of a finished diff → use
  [`/review-changes`](../../commands/review-changes.md).
* The verdict must come from a **live app** (Playwright against running services)
  → **deferred** (see Scope below); use test/quality verdicts until that trigger
  fires.

## The Iron Law

```
THE NUMERIC VERDICT IS NEVER SOVEREIGN.
TESTS DECIDE WHEN TO ESCALATE — A JUDGE DECIDES WHETHER TO APPLY.
A REVISION THAT BREAKS A PREVIOUSLY-GREEN CHECK STOPS THE LOOP,
EVEN IF THE OVERALL SCORE ROSE.
GENERATOR NEVER APPROVES ITS OWN CHANGE.
```

A loop that optimizes for `pass_count ≥ N` can game the metric — delete tests,
skip assertions, weaken checks — and still hit the threshold. The numeric gate
only decides **when to escalate**; a judge with veto confirms the change is real.

## Procedure

### 1. Freeze the contract (spec fingerprint)

Before the first run, capture what "done" means and snapshot it:

* the task's acceptance criteria / requirement,
* the set of checks that define the verdict (test files + quality commands),
* a **spec fingerprint** = a hash of (requirement text + the check set).

Record the **baseline green set** — which checks pass *before* any edit — so
regressions are detectable. Pick the verdict commands per the project's
[`toolchain-resolver`](../../contexts/execution/toolchain-resolver.md) (PHP / JS-TS
/ Python / Go / Rust), not a hardcoded runner.

### 2. Set the gate

| Knob | Default | Meaning |
|---|---|---|
| `threshold` | all targeted checks green | numeric pass bar, **absolute** (fraction of total), not "± N tests" |
| `allow_regressions` | `false` | a revision breaking a baseline-green check stops the loop |
| `max_attempts` | **3** | hard cap (test feedback is more actionable than diff critique → one more than `do-and-judge`'s 2; bounded by [`autonomous-execution`](../../rules/autonomous-execution.md) N=3) |
| `plateau_window` | 3 | stop if the last *window* scores sit within `tolerance` |
| `tolerance` | small absolute fraction | flake jitter that does **not** count as improvement |

### 3. The loop (multi-turn — the conversation IS the loop)

Each iteration is agent turns, never executing control-flow code:

1. **Generate / revise** — make the smallest change toward the contract.
2. **Run** — execute the verdict commands; parse the **structured** result
   (counts green/total, which checks failed). This is one tool call, read in
   context.
3. **Score + regression check** — compute the numeric score; compare failures
   against the baseline green set.
   * **Regression** (a baseline-green check now fails) → STOP, hand back with the
     regression named, even if the score rose. No whack-a-mole.
   * **Plateau** (last `plateau_window` scores within `tolerance`) → STOP; surface
     suspected flakiness or a stuck point. Do not thrash.
   * **`attempts == max_attempts`** → STOP, hand back the best envelope.
4. **Numeric gate** — score `< threshold` and attempts remain → back to step 1
   (attempts++). Score `≥ threshold`, no regression → **escalate** (step 4 of the
   stage).

### 4. Judge escalation (only after the numeric gate passes)

Dispatch the judge as a **subagent with fresh context** (the `judge-*` cluster via
[`subagent-orchestration`](../subagent-orchestration/SKILL.md)) that sees **only the
diff + the executed results** — never the generator's reasoning. This is the real
generator ≠ judge separation; single-agent persona-switching is theater.

* judge `apply` → DONE.
* judge `revise` → back to step 3.1 (attempts++; still bounded).
* judge `reject` → STOP, hand back; the approach must change.

### 5. Mid-loop invalidation (user-interrupt-priority)

Re-check the spec fingerprint each iteration. If the user changes the
requirement mid-loop (a new instruction in the conversation), the fingerprint
changes → **abort and hand back** per
[`user-interrupt-priority`](../../rules/user-interrupt-priority.md). Never keep
iterating against a stale contract.

## Scope — what runs, what is deferred

| Verify context | In scope | Why |
|---|---|---|
| Unit / integration tests | ✅ | fast, deterministic, sandboxed — runtime-free |
| Static quality (lint, type-check, format) | ✅ | fast, deterministic, no side effects (auto-fixable failures may bypass the revise step) |
| Live-app Playwright / E2E | ⛔ **deferred** | needs running services (DB, API) = a runtime; trigger = a UI-observable mission output + Playwright wired into a consumer CI |

State lives in the conversation, optionally mirrored to a re-read working file —
**never** a daemon or persistent cross-session store (honors
[`no-runtime-boundary`](../../../docs/contracts/no-runtime-boundary.md)).

## Validation

Before finalizing, confirm:

1. The numeric gate **escalated to a judge** — it did not apply on its own.
2. No baseline-green check regressed (or the loop stopped and said so).
3. The loop stopped at `max_attempts`, a plateau, or a judge `apply` — never
   ran unbounded.
4. The judge saw only the diff + results, dispatched in fresh context.
5. No daemon / persistent runtime introduced.

## Output format

```
verify-repair-loop
Contract:   <one-line requirement> · threshold <X> · allow_regressions false
Attempts:   <k>/<max>  scores: [s1, s2, …]   stop: threshold|plateau|cap|regression|reject
Verdict:    DONE | DONE_WITH_CONCERNS | BLOCKED
Judge:      <judge skill> → apply|revise|reject
Evidence:   <green/total> · regressions: none | <named checks>
```

Required fields (ordered):

1. **Contract** — the frozen requirement + threshold + `allow_regressions`.
2. **Attempts** — `k/max`, the score history, and the exact stop reason
   (`threshold` / `plateau` / `cap` / `regression` / `reject`).
3. **Verdict** — `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`.
4. **Judge** — the dispatched judge skill and its `apply` / `revise` /
   `reject` verdict (omit only when the loop stopped before escalation).
5. **Evidence** — final `green/total` and any regressed checks by name.

## Examples

Good — staged, bounded, judge confirms:
```
iter1 84/100 (<90) → revise
iter2 93/100 (≥90, no regression) → escalate → judge apply → DONE
```

Bad — numeric verdict treated as sovereign (rejected by the Iron Law):
```
iter1 91/100 ≥ threshold → "PASS, done"   ✗ no judge escalation; metric may be gamed
iter2 fixes A, breaks B, 92% → "PASS"      ✗ regression ignored
```

## Gotcha

* **Metric gaming** — the agent "passes" by deleting a failing test or
  weakening an assertion. The numeric gate cannot catch this; the
  fresh-context judge is the safeguard. If the diff *removes* checks,
  that is a `reject`, not a `pass`.
* **Flake mistaken for a plateau** — a single non-deterministic test flips
  the score and the window-comparison reads it as "no improvement". Re-run
  the suspected check before declaring a plateau; surface flakiness instead
  of thrashing.
* **Score rose, but a regression hid inside it** — fixing 6 checks while
  breaking 2 still raises the total. Without the regression guard the loop
  ships a regression. Always diff failures against the baseline green set,
  not just the aggregate score.
* **Persona-switch theater** — asking the same agent to "now judge what you
  wrote" is not separation. Dispatch the judge as a fresh-context subagent
  that never saw the generator's reasoning.
* **Stale contract** — iterating against a requirement the user changed
  mid-loop. Re-check the spec fingerprint each turn; a change aborts.

## Do NOT

* NEVER let the numeric score apply a change without judge confirmation.
* NEVER continue past a regression because the overall score improved.
* NEVER run the live-app Playwright path here — it is deferred (needs a runtime).
* NEVER judge with the generator's own context — dispatch a fresh-context judge.
* NEVER loop past `max_attempts` or a detected plateau.

## See also

* [`subagent-orchestration`](../subagent-orchestration/SKILL.md) — `do-and-judge`
  (judge-sovereign, diff-read) is the sibling; this skill is test-verdict-gated.
* [`/review-changes`](../../commands/review-changes.md) — one-shot multi-judge
  review; wires this loop as an opt-in step.
* [`playwright-testing`](../playwright-testing/SKILL.md),
  [`quality-tools`](../quality-tools/SKILL.md) — verdict sources.
* [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 cap.
* [`no-runtime-boundary`](../../../docs/contracts/no-runtime-boundary.md) — the
  runtime-free constraint this loop honors.
