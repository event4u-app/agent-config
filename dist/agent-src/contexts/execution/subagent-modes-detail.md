# Subagent Modes — per-mode detail (decision rows, contracts, heavy modes)

Extended detail for the [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md)
modes. Split out of the skill body to keep it under the size budget; the mode
list, form gate, selection rules, and procedure stay inline in the skill. Pull
this when you dispatch a mode and need its decision row, execution contract, or
the heavy-mode detail (modes 7–9).

## Modes 1–6 — decision rows and execution contracts

### Mode 1 — do-and-judge

| When to use | When not | Model pairing |
|---|---|---|
| Single-change task with non-trivial risk | Tiny fix, or spike/exploration | implementer = session; judge = one tier up |

### Mode 2 — do-and-judge-two-stage

Implementer produces a diff; **two judges run sequentially** — first a
spec-compliance reviewer (does the diff satisfy the stated spec /
acceptance criteria?), then a code-quality reviewer (is the diff well-
written for the codebase it lands in?). The orchestrator only proceeds
to stage two if stage one returns `DONE` or `DONE_WITH_CONCERNS`. A
stage-one `BLOCKED` shortcuts the loop — there is no point quality-
reviewing a diff that does not satisfy the spec.

| When to use | When not | Model pairing |
|---|---|---|
| Spec is contested or AC are detailed; diff size makes one judge prone to missing one axis (correctness vs craft) | Spec is one sentence, or the diff is one line (collapse to mode 1) | implementer = session; spec-judge = one tier up; quality-judge = same tier as spec-judge, fresh context |

**Why two stages, not one judge with both rubrics:** combining the
rubrics in one prompt reliably regresses one of them — the judge "spends
attention" on whichever rubric appears last. Splitting the prompts
forces each judge to commit fully to its rubric.

**Stage-routing rule:**
- Stage-1 returns `DONE` → run stage-2.
- Stage-1 returns `DONE_WITH_CONCERNS` → run stage-2; concerns carry
  forward to the final envelope.
- Stage-1 returns `NEEDS_CONTEXT` → pause; stage-2 does not run.
- Stage-1 returns `BLOCKED` → final verdict is `BLOCKED`; stage-2
  does not run (saves cost).

### Mode 3 — do-in-steps

| When to use | When not | Model pairing |
|---|---|---|
| Multi-step plan with ordered dependencies | Single-step change, or when steps are independent (use `do-in-parallel`) | implementer = session; judge = one tier up |

### Mode 4 — do-in-parallel

| When to use | When not | Model pairing |
|---|---|---|
| Independent slices (different files, non-overlapping) | Any slice touches shared state | implementer = session; judge = one tier up, run once |

### Mode 5 — do-competitively

| When to use | When not | Model pairing |
|---|---|---|
| Broad solution space (algorithm choice, API shape) | Well-defined problem with one good answer | implementers = same tier (≥2 instances); judge = one tier up |

### Mode 6 — judge-with-debate

| When to use | When not | Model pairing |
|---|---|---|
| Security, data integrity, public API change | Routine internal refactor | judges = same tier (2x); meta-judge = one tier up |

## Severity-conditioned team composition — conditions pattern

Guidance, not a new object class (persona-catalog disposition; AI council
2026-07-27, claude-sonnet-4-5 + gpt-4o: capture as guidance on this
existing surface — no roster schema, no linter, no fourth scoping
ontology). Incident-style severity tiers refine composition and
activation **within** the form the static gate already picked — severity
never overrides the form gate, the Iron Law, or any safety floor.

| Severity | Composition + activation | Existing mode(s) |
|---|---|---|
| Critical — prod impact, security, data integrity | Full parallel team; debate-grade review on the aggregate | `do-in-parallel` + `judge-with-debate` (Mode 9 where opted in) |
| High — contested spec, cross-layer risk | Implementer + two sequential judges | `do-and-judge-two-stage` |
| Medium — routine multi-step | Implementer + judge between steps | `do-in-steps` / `do-and-judge` |
| Low — small, reversible | Solo with async review | in-session (`none`); optional single async judge |

At equal severity the cheapest-mode preference (skill § 3. Pick the mode)
still applies; escalate one tier only on a named risk signal, never on
vibes.

## Status taxonomy — rationale and routing semantics

Every implementer or judge return conforms to
[`schemas/subagent-status.json`](../../../skills/subagent-orchestration/schemas/subagent-status.json).
Four statuses, no free-form alternatives:

| Status | Meaning | Required keys (beyond `status`, `summary`) |
|---|---|---|
| `DONE` | Work shipped, all gates green. | `evidence[]` |
| `DONE_WITH_CONCERNS` | Work shipped but caller must act on concerns. | `evidence[]`, `concerns[]` |
| `NEEDS_CONTEXT` | Paused; caller can unblock by answering. | `blocking_question` |
| `BLOCKED` | No path forward exists. | `blocking_reason` |

**Why a fixed taxonomy:** orchestrators (`/do-and-judge`, `/do-in-steps`)
route on status. Free-form "kind of done" returns force the orchestrator
to interpret prose, which silently regresses the two-revision ceiling and
the judge-rejected-do-not-apply rule. The schema makes routing mechanical.

**Distinguishing `NEEDS_CONTEXT` from `BLOCKED`:** `NEEDS_CONTEXT` means
*"you, the caller, can fix this by telling me X"*. `BLOCKED` means
*"no input from you unblocks this — escalate or rescope"*. If a subagent
is unsure, it picks `BLOCKED` and the caller can downgrade.

## Mode 7 — do-in-worktrees

Cross-wing or cross-skill chain executed across isolated git
worktrees — each handoff in the chain runs in its own worktree, so
the workspace state of one step never leaks into the next. Operationalizes
the worktree boundary clause in
[`docs/contracts/cross-wing-handoff.md`](../../../../docs/contracts/cross-wing-handoff.md)
§ 3. State-machine layer only — worktree creation/destruction lives
in [`using-git-worktrees`](../../skills/using-git-worktrees/SKILL.md) and
[`finishing-a-development-branch`](../../skills/finishing-a-development-branch/SKILL.md).

| When to use | When not | Model pairing |
|---|---|---|
| Multi-step cross-wing chain (≥2 senior skills, each ≥30 min) where one step's open files / branch state would confuse the next | Fast iteration where each step < 30 min — worktree overhead exceeds isolation benefit | implementers = same tier per step; judge = one tier up at chain end |

**Handoff shape:** initiator-skill emits the typed output declared in
its `## Output` block → control passes to delegated-skill in a fresh
worktree → delegated-skill consumes the input shape declared in its
`## Input` (or `## When the agent should load this`) block. The
handoff is auditable; `lint_handoffs.ts` validates the chain.

**Example chain (W3 launch):** `positioning-strategy` (worktree A) →
`messaging-architecture` (worktree B, consumes positioning's
`positioning-statement.md`) → `gtm-launch` (worktree C, consumes
both prior artifacts). Each worktree carries one branch; the chain
end produces a single integration PR.

**Anti-pattern:** do not use for fast iteration loops where each
step is under ~30 minutes. The branch-creation, context-switch, and
worktree-cleanup cost dominates. Stick with mode 1 (do-and-judge)
or mode 3 (do-in-steps) for those.

**Competitive variant — per-candidate isolation.** When mode 5
(`do-competitively`) is combined with worktrees, each candidate
implementer runs in its own worktree (so candidates cannot read each
other's open files or branch state). Selection rules:

- **No auto-merge.** The orchestrator never merges a candidate
  branch. Hard Floor per [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) —
  applies even under standing autonomy. ADR-005 records the reasoning.
- **Ranked presentation.** Judge ranks candidates (1..N) with a
  one-line justification per rank; user picks the winner.
- **Loser worktrees stay.** The orchestrator does not delete losing
  worktrees automatically — the user keeps the option to harvest a
  partial idea before cleanup.

## Mode 8 — do-with-live-app-judge (gated — UI-heavy tasks)

Implementer ships the change AND starts the dev server; the judge drives
the RUNNING application (Playwright / browser) against a written rubric —
it never reads the diff. Catches the class static review misses: wired-but-
broken flows, dead buttons, state that renders wrong only at runtime.

| When to use | When not | Model pairing |
|---|---|---|
| UI-heavy change where "looks right in the diff" ≠ "works in the app"; a dev server + browser tooling exist | Backend/logic change (a diff judge is cheaper and sharper); no runnable app surface | implementer = session; judge = same tier, fresh context, browser tools only |

Rules:

- The judge's rubric is written BEFORE dispatch (what flows to click, what
  must render) — never improvised from the diff it must not read.
- Record `dispatch_mode: do-with-live-app-judge` + `verdict_changed_outcome`
  on every use. **Adoption gate:** this mode stays experimental until its
  `verdict_changed_outcome` telemetry shows it changes outcomes (caught a
  real issue a diff judge missed); a mode that never flips a verdict is
  cost without value and gets removed.
- No self-play/"adversarial training" framing — this is one judge, one
  rubric, one running app.
- **Low-priority future candidate (needs real screenshot tooling — do not
  build speculatively):** the async silent-verifier shape from
  [`design-review`](../../skills/design-review/SKILL.md) § Async-verifier pattern — a
  background verifier that owns UI verification via screenshots, forbids the
  main agent from self-checking, and stays silent on pass — is the natural
  mechanism for this mode's judge once dependable screenshot tooling lands.
  Recorded from road-to-opt-design-polish; gate it behind the same
  `verdict_changed_outcome` adoption evidence above.

## Mode 9 — adversarial-verification-council (gated — opt-in, advisory)

A panel of N (default 2) **distinct-model** skeptics red-teams a real,
already-verified change through the `judge-*` lenses. Each skeptic is prompted to
*break* the change, returns a structured findings array (+ optional refutations),
and the returns are reconciled by
[`_lib/adversarial_reconcile.ts`](../../../scripts/_lib/adversarial_reconcile.ts)
into one [`adversarial-findings.json`](../../../skills/subagent-orchestration/schemas/adversarial-findings.json)
envelope. Scope: defect **finding coverage**, not a go/no-go decision (that is
mode 6). Full contract: ADR-122; skeptic prompt:
[`prompts/adversarial-verification-council.md`](../../../skills/subagent-orchestration/prompts/adversarial-verification-council.md).

| When to use | When not | Model pairing |
|---|---|---|
| High-risk change (security, tenant, migration, public API) where finding coverage matters, opted-in | Default flow, routine change, `subagents.adversarial_council: off`, or a plain go/no-go (use mode 6) | skeptics = ≥2 distinct models; cross-*vendor* for the registered claim + high-risk tier; cross-model Iron Law across all |

Invariants:

- **Advisory only — never auto-gates the change (Hard Floor).** The reconciler
  ranks and annotates findings; a human decides what is actionable.
- **Default-off.** `subagents.adversarial_council` (`off|ask|on`, default `off`).
  Fires only on an explicit high-risk change under an opted-in setting.
- **Cross-model Iron Law** across all skeptics; the registered finding-coverage
  claim and the high-risk tier require cross-*vendor* skeptics (the backed
  `cross-vendor-parity` signal is provider-level).
- **Reconciliation is deterministic TS with tests** — dedup, severity-quorum
  confidence, false-positive suppression (demote, never drop). Never
  LLM-computed prose (ADR-122 anti-lesson).
- **N cap** from the verify budget; no daemon / no persistent runtime; each
  skeptic return uses the `subagent-status.json` envelope before reconciliation.
- **Prove-or-drop.** The mode stays default-off until the
  `adversarial-council-finding-coverage` claim is `backed` by the two-stage
  residual-detection benchmark (roadmap Phase 4); honest-null keeps it inert.
