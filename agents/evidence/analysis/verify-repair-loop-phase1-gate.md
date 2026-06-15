# verify-repair-loop — Phase 1 gate decision (runtime-free PoC)

**Roadmap:** `road-to-autonomous-verify-loop.md` · **Phase 1** (PoC + decision gate).
**Date:** 2026-06-15 · **Verdict: PROCEED to Phase 2** (restricted scope).

## Question

Can a bounded `generate → run → judge → revise → re-judge` cycle — pass signal =
an *executed* verdict (numeric threshold over real test/quality results), plateau
early-stop, N=3 cap, generator ≠ judge — be expressed **runtime-free** (multi-turn
agent reasoning, no daemon, no persistent cross-session state, honoring
[`docs/contracts/no-runtime-boundary.md`](../../../docs/contracts/no-runtime-boundary.md))?
And is it a genuine capability gap versus the existing `do-and-judge` revise-loop
inside [`subagent-orchestration`](../../../src/skills/subagent-orchestration/SKILL.md)?

## Decision (AI council, claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15)

### Q1 — runtime-free: YES, for a restricted scope

The loop is the **conversation**, not executing control-flow code. Per-turn the
agent: runs a tool (test/quality command), reads the structured result, reasons,
edits, re-runs. **No daemon.** Loop control-state lives in exactly two places:

| State | Lives in | Never |
|---|---|---|
| Iteration count, score history, threshold, spec fingerprint | The conversation, optionally mirrored to a re-read working file (`.verify-loop/state.json`) the agent reads at turn start | A running process / persistent cross-session store |
| Latest verdict (test/quality output) | The most recent tool result in-context | A long-lived service |

Two scope limits the council made load-bearing:

1. **Unit tests + static quality tools only** (fast, deterministic, sandboxed,
   no side effects) are runtime-free. **Live-app Playwright is NOT** — it needs
   running services (`docker-compose up`, a DB, an API server) = a runtime. This
   is exactly why the roadmap lists *"live-app Playwright as the canonical verdict
   source"* under **Deferred (trigger-gated)**. Phase 2 uses test/quality verdicts;
   Playwright stays deferred until its trigger (a UI-observable mission output +
   Playwright wired into a consumer CI) fires.
2. **Plateau detection is a deterministic check, not LLM "reasoning about
   convergence"** — a window+tolerance comparison over the score history (run as a
   small script / explicit comparison), never a vibe judgment. `scores[-1] ==
   scores[-2]` is wrong (stops on the first flaky jitter); use a window.

→ **Runtime-free interpretation holds** for the test/quality scope. PROCEED.

### Q2 — genuine gap: YES, as a separate skill committing to staged escalation

`do-and-judge` already revises→re-judges (2 cycles, implementer ≠ judge), so a
near-twin would be duplication. The council's non-duplication proof is the
control flow:

```
do-and-judge:        generate → judge → [if REVISE] → generate → judge
verify-repair-loop:  generate → tests → [if FAIL] → revise → tests → [if PASS] → judge
```

`verify-repair-loop` commits to **Architecture C — staged escalation**: an
*executed numeric gate FIRST*, *then* judge approval. That is architecturally
distinct from `do-and-judge`'s single-phase diff-reading judgment, and justifies a
separate skill. Boundary statement (trigger-time disambiguation):

> **`verify-repair-loop`** — tests decide when to escalate. Automated convergence
> via test-driven iteration, gated by a numeric threshold, *then* escalated to a
> judge for qualitative approval. Use when test/quality coverage is the verdict
> source and you want the agent to iterate until checks pass before review.
>
> **`do-and-judge`** (subagent-orchestration mode) — the judge is sovereign and
> reads the diff. Use when coverage is incomplete or the criteria are subjective
> (naming, architecture, style).

## Phase-2 safeguards the council made mandatory (encode in the skill)

1. **Numeric verdict is NOT sovereign — judge retains veto.** A revision loop
   optimizing for `pass_count ≥ N` can game the metric (delete tests, skip
   assertions). The numeric gate only decides *when to escalate*; a judge confirms
   the change is real before `PASS`. Staged: `numeric_gate → THEN judge_approval`.
2. **Regression guard — `allow_regressions: false`.** A revision that breaks a
   previously-green check stops the loop even if the overall score rose. Prevents
   whack-a-mole (fix A by breaking B).
3. **Flaky-test handling.** Plateau detection uses a window (default 3) + absolute
   tolerance (fraction of total checks), not consecutive-equality. Surface
   suspected flakiness rather than thrashing.
4. **Verify-context heterogeneity.** Unit/integration + static quality are
   in-scope (runtime-free). E2E/Playwright is a different context (slow, stateful,
   needs services) → deferred. Never treat all "verification" as one
   interchangeable `run this command`.
5. **Spec fingerprint → mid-loop invalidation.** Capture a hash of the task's
   requirements + test set at loop start. If the user changes the requirement
   mid-loop (a new instruction in the conversation), the fingerprint changes →
   **abort and hand back** (honors [`user-interrupt-priority`](../../../src/rules/user-interrupt-priority.md)).
6. **Iteration cap N=3, justified.** Test feedback is more actionable than
   subjective diff critique (do-and-judge's 2), so one extra cycle is warranted;
   still bounded by [`autonomous-execution`](../../../src/rules/autonomous-execution.md)'s N=3.
7. **Real generator ≠ judge separation.** Single-agent persona-switching is
   theater. Enforce separation by dispatching the judge as a **subagent with fresh
   context** (the existing `judge-*` cluster via `subagent-orchestration`) that
   sees only the diff + executed results, never the generator's reasoning.

## Scope adopted / rejected (unchanged from the roadmap's 2026-06-15 council)

- **Adopt:** the control structure only — staged verify→repair→re-verify, numeric
  threshold, plateau early-stop, generator/judge separation.
- **Reuse:** AC's `judge-*` cluster + `playwright-testing` + `quality-tools` +
  the N=3 cap.
- **Reject:** the external reference's model-pinned 3-agent set and its UI-product
  rubric.

## PoC — the loop as multi-turn reasoning (worked trace, runtime-free)

Target: a change must pass the project test runner at ≥ the threshold, no
regressions, before a judge confirms. No daemon; each step is one agent turn.

```
Turn 1 (generate):  agent writes the change; records spec_fingerprint + threshold.
Turn 2 (run):       agent runs `<test-runner>`; parses → 85/100 green (85%).
                    state: iter=1, scores=[85], baseline_green={...}.
Turn 3 (judge gate):85% < threshold(90%) AND a previously-green test now fails
                    → FAIL + regression. Surface the failing checks + a revision.
Turn 4 (revise):    agent edits to fix the regression + 6 more; re-runs.
Turn 5 (run):       92/100 (92%), no regression vs baseline. scores=[85,92].
Turn 6 (numeric gate PASS → escalate):  92% ≥ 90%, no regression, attempts<3
                    → escalate to the judge subagent (fresh context, sees diff +
                    results only).
Turn 7 (judge):     judge verdict apply/revise/reject. apply → DONE. revise →
                    back to Turn 4 (attempts++). Plateau (window=3 within
                    tolerance) OR attempts==3 → STOP, hand back to user.
```

The "loop" is the turn sequence + the re-read state file — **not** executing code,
**not** a process. This satisfies `no-runtime-boundary`.

## Provenance

- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, peer-review,
  2026-06-15). Convergence inlined above; session artefacts are local-only
  (gitignored, auto-pruned per `ai_council.session_retention_days`).
- Source-E (external agent-harness reference, code-audited 2026-06-15): GAN-style
  planner/generator/evaluator loop — control structure only; model-pinned agent
  set and UI rubric rejected. Maintainer-recoverable link in the roadmap Provenance.
