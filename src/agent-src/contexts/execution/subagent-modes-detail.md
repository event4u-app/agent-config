# Subagent Modes — worktree + live-app-judge detail

Extended detail for the two heaviest [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md)
modes — `do-in-worktrees` (mode 7) and `do-with-live-app-judge` (mode 8).
Split out of the skill body to keep it under the size budget; the mode list,
selection rules, and the six common modes stay inline in the skill. Pull this
when you actually dispatch one of these two modes.

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
