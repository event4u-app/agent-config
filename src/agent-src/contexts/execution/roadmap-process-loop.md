# Roadmap-Process Loop

Loaded by [`/roadmap:process-step`](../../commands/roadmap/process-step.md),
[`/roadmap:process-phase`](../../commands/roadmap/process-phase.md), and
[`/roadmap:process-full`](../../commands/roadmap/process-full.md). Holds
the canonical autonomous-execution loop, roadmap discovery, cadence
resolution, commit-step pre-scan, halt conditions, and archival check.
The three command files are thin wrappers that bind only the **scope
delta**.

**Size budget:** ≤ 4,000 chars.

## 1. Resolve roadmap

Search both locations:

- `agents/roadmaps/*.md` (project root)
- `{module_root}/*/{agent_folder}/roadmaps/*.md` (module-scoped; resolve
  via `scripts/_lib/agent_settings.ts::enumerate_modules()`. Laravel
  shape: `app/Modules/*/agents/roadmaps/*.md`)

**Exclude** `template.md`, `archive/`, `skipped/`, and `later/` (`later/` holds
roadmaps with open work that is blocked-for-later — parked, not active).

- User named one (path, partial name, title) → use it.
- None named, single active roadmap (`count_open > 0`) → use it.
- None named, multiple active → default = **most recently modified**;
  surface alternatives in the pre-run summary.
- None active → tell the user; suggest [`/roadmap:create`](../../commands/roadmap/create.md).

### Live merge-state before any "in-flight / merged / handled" claim

When selection reasoning would **exclude** a roadmap — or a pre-run summary,
decision, or any user-facing message would **describe** one — as *in-flight*,
*handled by an open PR*, *already merged*, or *not yet merged*, verify that
claim **live at the moment of the claim** (`gh pr view <n> --json state,mergedAt`
or `gh pr list --search "<slug>"`). Never infer merge state from:

- the **dashboard's open-count** — it lags: a completed roadmap is archived in
  the **merging** PR, so a roadmap can still read "open" on `main` while its PR
  is already merged (archive not yet on your checkout), or read "open" seconds
  before a merge you never re-checked;
- **session memory** ("I opened a PR for this earlier") or an **earlier fetch** —
  a merge can land between your fetch and your message.

A stale merge-state claim ships an unnecessary user-facing message about work
that is already done — the exact failure this clause prevents. This is the
[`direct-answers`](../../rules/direct-answers.md) Iron-Law-2 live-state rule
(git/PR state never from memory), applied to roadmap selection.

## 2. Pre-run summary — gate or inline note

Read `roadmap.skip_pre_run_gate` from `.agent-settings.yml` (default
`true`). The command name already names the scope; asking "Go /
Different roadmap / …" on every run is the noise the gate-skip removes.

- `true` **and** the roadmap is unambiguous (user named it, or exactly
  one active roadmap exists) → **skip the interactive gate.** Emit the
  summary block below as a one-shot inline note (no numbered options,
  no wait) so the user can still abort mid-stream if the wrong file was
  picked, then continue straight into § 3.
- `false`, **or** the roadmap is ambiguous (multiple active roadmaps and
  none named), **or** an unresolvable cadence / scope conflict is
  detected → show the gate with numbered options and wait for input.

The gate is **always** shown — regardless of the flag — when the
roadmap is ambiguous or a scope / cadence conflict has no sensible
default. The flag suppresses the confirmation, never a genuine
"which roadmap?" question.

Summary block (shown in both modes; gate-mode appends the numbered
options + wait):

> Roadmap: `<resolved-path>`
> Phase 1: `<name>` — 3/5 done
> Phase 2: `<name>` — 0/4
> Next open step: `<description>`
> Scope: **step | phase | full**
> Execution mode: **autonomous | phase-checkpoints | interactive** (derived per § 3a — name the rung: `invocation suffix` | `frontmatter` | `invocation form`)
> AI council: **on | off** (`<member list or "no members configured">`)
> Quality cadence: **end_of_roadmap | per_phase | per_step**
> Commit steps in roadmap: **N** (see § 3)
>
> 1. Go — start processing autonomously
> 2. Different roadmap · 3. Different scope · 4. Toggle council · 5. Abort

The invocation-level skip still applies under `skip_pre_run_gate: false`:
when scope, roadmap, and council are all unambiguous in the invocation
(e.g. `/roadmap:process-phase road-to-X.md with council`), the gate
does not fire.

## 3. Pre-scan — execution contract or commit-step ask

### 3a. Mode derivation ladder — first source wins

```
AN ABSENT `execution.mode` IS NOT A DECLARATION OF `interactive`.
IT IS THE ABSENCE OF A DECLARATION, AND IS DERIVED — NEVER DEFAULTED SILENTLY.
```

Resolve the mode from the first source that answers, and **state which rung
answered** in the pre-run summary so the derivation is auditable rather than
implicit:

| # | Source | Wins when |
|---|---|---|
| 1 | **Explicit invocation suffix** — `… autonomous` / `… phase-checkpoints` / `… interactive` in the invocation | the user typed it this turn |
| 2 | **Frontmatter `execution.mode`** | the roadmap declares one |
| 3 | **Invocation form** (table below) | neither of the above answered |

Rung 3, by wrapper:

| Wrapper | Derived mode | Contract |
|---|---|---|
| `/roadmap:process-full`, `/roadmap:next` | `autonomous`, **preselected** | offered |
| `/roadmap:process-phase` | `phase-checkpoints` | offered |
| `/roadmap:process-step` | — | none (one step needs no run contract) |

Still **exactly one confirmation**, never two: rung 3 changes which option the
contract screen arrives preselected on, never whether the screen is shown. The
screen's `3. Run interactive instead` option
([`roadmap-execution-contract § 2`](roadmap-execution-contract.md)) stays on it
in every case, so a derived mode is always one keystroke from being refused.

**Why the old fallback was a defect and not a conservative default.** Absent
`execution.mode` used to mean the legacy commit-step scan, which derives no
contract at all — no batched artifact drafting, no council auto-enable, no
push/PR grant. Measured 2026-08-17: **27 of 37 active roadmaps carry no
`execution.mode`**, so roughly three quarters of the corpus ran the degraded
path *under the wrapper built for the opposite*, and silently — the user saw a
`process-full` invocation behave like an interactive one with no line saying so.
A default that contradicts the wrapper the user just typed is a wrong answer,
not a safe one.

**What this does NOT change.** A derived mode grants nothing on its own:
authorization is still the single Accept on the contract screen, per
[`roadmap-execution-contract § Principle`](roadmap-execution-contract.md). The
Hard Floor, the locked decision classes, and the kernel-edit soak are untouched.

### 3b. Contract or commit-step ask

**Derived `autonomous` or `phase-checkpoints`** → load
[`roadmap-execution-contract`](roadmap-execution-contract.md) and run
its four-class pre-scan over every open step:

1. commit-shaped steps (patterns below),
2. git-shape needs (branch / push / PR / delivery),
3. artifact-authoring steps (new or materially rewritten skill / rule /
   command / guideline — feeds the batched drafting-protocol research
   pass, run at contract time against current artifact state),
4. open questions / ambiguity markers (incl. `ask-when-uncertain`
   vague-trigger patterns).

Surface the contract summary; the user's single **Accept** activates
all run grants (branch, chunked commits, push to the run's own feature
branch only, PR-open, batched artifact drafting, council auto-enable) —
cached for the run, never re-asked. The contract never lifts a Hard
Floor or any safety floor; boundaries + per-mode gate table live in the
contract context.

**Derived `interactive`** — i.e. the user asked for it explicitly (rung 1), the
frontmatter declares it (rung 2), or the invocation was `process-step` (rung 3)
→ legacy commit-step scan only: lines matching `commit:` / `git commit` /
`Commit phase`. An ABSENT field no longer reaches this branch; that is the whole
change in § 3a.

- **No commit steps** → nothing to ask. Never commit, never re-ask
  per [`commit-policy`](../../rules/commit-policy.md).
- **Commit steps present, autonomous conversation mode**
  (`personal.autonomy: on`, or `auto` after opt-in) → ask **once**
  upfront:
  > "Roadmap contains N commit steps. Authorize all of them for this
  > run? (yes / no / list them)"
  Cache the answer for the whole run; do **not** re-ask per step.
  Hard-Floor diffs (bulk deletions, infra) still trigger the
  per-commit gate from [`commit-mechanics`](../authority/commit-mechanics.md).
- **Commit steps present, non-autonomous** → same one-shot pre-scan
  ask as above, before the run starts; never per step
  (per [`commit-mechanics`](../authority/commit-mechanics.md) —
  `commit-policy` § NEVER ask about committing holds regardless of
  autonomy).

## 4. Resolve cadences — read once, cache for the run

Read both keys from `.agent-settings.yml` once and cache for the whole
run. Do **not** re-read inside the step loop.

**`roadmap.quality_cadence`** — when to run the quality pipeline.
Only relevant when `quality.local_auto_run` is `true`; when it is
`false` or missing (the default), local pipeline runs are suppressed at
EVERY cadence — remote CI is the gate, and the run-end report states
*"quality gates delegated to remote CI"* instead of a pass claim
(new-gate carve-out steps still run once).

| Value | Pipeline runs (`local_auto_run: true` only) |
|---|---|
| `end_of_roadmap` (default) | Once, before archival (§ 6) |
| `per_phase` | At every phase boundary + § 6 |
| `per_step` | After every step + § 6 |

Missing / unreadable / unknown → fall back to `end_of_roadmap`.
The Iron Law [`verify-before-complete`](../../rules/verify-before-complete.md)
still forbids claiming quality output that was not produced.

**`roadmap.dashboard_regen_cadence`** — when to run the dashboard
subprocess between steps:

| Value | `./agent-config roadmap:progress` runs |
|---|---|
| `per_step` | After every checkbox flip |
| `every_5_steps` (default) | Every 5th closed step + at phase boundary + at reply end |
| `phase_boundary` | Only at phase boundaries + run end |

`process-step` ignores this — single-step runs always regen at step
end. Any file-shape touch (rename / phase add / archive — Iron Law 1
of [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md))
forces an immediate regen regardless of cadence. The checkbox flip
itself is **never** batchable — only the subprocess.

## 5. Step loop

For each open step in the working set (scope-bound — see wrapper):

0. **CI-step gate** — per
   [`roadmap-ci-steps-policy`](../../rules/roadmap-ci-steps-policy.md).
   When `quality.local_auto_run: false` and the step text matches a
   CI-shaped literal (`task ci`, `task ci-fast`, `task ci-strict`,
   `make ci`, `make test`, `npm/pnpm run check`, `yarn check`,
   `composer test`, whole-suite `vendor/bin/phpunit`, whole-suite
   `php artisan test`) **without** an inline
   `<!-- carve-out: new-gate-verification -->` marker → flip the
   checkbox to `[-]`, append
   `<!-- skipped: quality.local_auto_run=false → remote CI is the gate -->`
   on the same line, regenerate the dashboard, continue to the next
   step. Never run the gate. Carve-out marker present → run normally
   (new gate must be verified once locally). Setting `true` → run
   normally. Full pattern table, carve-outs, linter contract, failure
   modes: [`roadmap-ci-steps-mechanics`](roadmap-ci-steps-mechanics.md).
1. **Bundled read — one parallel tool-call block.** The step
   description, the immediately-relevant code files, and any
   guideline/context the step cites are **independent** reads and
   **must** be dispatched together, not serially.

   ```
   parallel:
     - view agents/roadmaps/<file>.md     (the step's section)
     - view <files cited in the step text>
     - codebase-retrieval (only if the step is vague)
   ```

   Anti-pattern: `view step` → think → `view file A` → think →
   `view file B`. That's 3 round-trips for what should be 1.

   Fire/no-fire pair (falsifiable — the discriminator is whether a
   call's *input* depends on another call's *output*, never the count):

   - **Fires (batch these):** a step says "update the hook, its test,
     and the manifest entry" → `view src/scripts/hooks/foo_hook.ts` +
     `view tests/scripts/foo_hook.test.ts` +
     `view src/scripts/hook_manifest.yaml` are three independent reads
     whose paths are all known BEFORE the first call — dispatch all
     three in ONE parallel block. Issuing them serially is the
     violation: each extra round-trip re-transmits the accumulated
     context as input for zero new information.
   - **Does NOT fire (stays serial):** `grep -rn "buildAdvisoryLine"
     src/` → then `view <the file the grep found>`. The second call's
     path IS the first call's output — batching would mean guessing the
     path, and a guessed read is worse than a round-trip. Dependent
     calls stay serial; only the independent remainder batches.
2. Analyze the codebase for what the step requires.
3. Decide and act — implement. **No "should I implement this?" prompt.**
4. **Open question handling:**
   - **Council on** (toggled manually, or auto-enabled for the run by
     an accepted execution contract — § 3) → invoke per
     [`ai-council`](../../skills/ai-council/SKILL.md), integrate
     convergence, proceed. Token spend was opted in (the contract
     summary named the members). `high_impact` / `user_required`
     classifications still escalate to the user per
     [`ask-when-uncertain`](../../rules/ask-when-uncertain.md).
   - **Second-model rung, when the class declares one**
     (`decision_resolution.classes.<cls>.second_model`, UOTL Phase 4.1)
     → one local vendor-CLI pass under subscription auth. **The rung is
     MODEL-CARRIED: the key is declared and schema-validated, and no
     TypeScript path reads it at runtime** — so "bounded by the
     `cli_call_budget` counter" is what the rung must respect, never
     something a booking consumer enforces (`cli_call_budget.ts` declares
     its consumer set closed at two, and this is not one of them). Stated
     rather than implied after R2 round 4 finding 4 found the coupling
     asserted on three surfaces at once. Available
     to `trivial` / `low_impact` / `medium_impact` only; the config
     schema REFUSES the key on `high_impact` and `user_required`, so no
     locked question can reach it.
   - **Council off / not configured** → halt, surface once, wait.
     Resume on next turn. An execution contract cannot enable a
     council that has no configured members — the contract summary
     says so upfront, and in-run ambiguity halts (never silent
     guessing).
   - **No self-adversarial fallback.** With neither a council nor a
     second-model rung available, the ambiguity halt STANDS. The gap is
     never filled by the agent arguing both sides of the question to
     itself: a monologue produces a verdict with no independent
     observer, which is the failure
     [`evaluator-independence`](../../rules/evaluator-independence.md)
     exists over, and reads as convergence to whoever finds it later.
     Halting costs one turn; a manufactured verdict costs the trust in
     every other verdict the run produced.
   - **A resolution taken WITHOUT contacting the user is recorded** —
     `agent-config decision:memo write --run <id> …` (question, chosen
     option, reasoning, resolver, confidence). The run's PR description
     links the directory. Not a gate: the memo is what makes an
     autonomous resolution reviewable after the fact, which is the
     condition under which it is legitimate at all.
5. **Atomic flip — same reply, every step.**
   Flip the checkbox in `agents/roadmaps/<file>.md`: `[x]` done ·
   `[~]` partial · `[-]` skipped. **Non-skippable, non-batchable**
   per Iron Law 2 of
   [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md).
   A loop iteration that lands work without flipping its box is a
   rule violation. Do not save flips for the archive commit.

### 5b. Flip-guard — deterministic

   Before advancing to step 6, run:

   ```bash
   git status --porcelain -- agents/roadmaps/<file>.md
   ```

   (`git status --porcelain`, not `git diff` — a roadmap file that is
   still **untracked**, e.g. in a fresh worktree, is invisible to
   `git diff` and would false-halt; `--porcelain` reports both `M`
   and `??`.)

   Empty output → Iron Law 2 was violated this iteration: the step
   landed work but no checkbox flipped. **Halt loudly**, surface
   "step <N> landed without checkbox flip — flip then resume", and
   stop the run. Do not auto-fix; the user resumes on the next turn.

   This guard is the deterministic counterpart to the rule's
   pre-send self-check — it catches a forgotten flip per step, not
   only at run end. It runs in every scope (`process-step`,
   `process-phase`, `process-full`); the cost is one `git diff` per
   step.

   **`verify:` gate (when a step carries one).** If the step declares a
   named `verify:` command (roadmap step-field convention, see
   [`templates/roadmaps.md`](../../templates/roadmaps.md)), a `[x]` flip
   additionally requires a **fresh green run of that exact command this
   iteration** — its passing output present in this reply or an earlier
   one this run. Flipping a `verify:`-bearing step to `[x]` without that
   fresh green run is the same class of violation as a forgotten flip:
   **halt loudly** ("step \<N\> flipped without its `verify:` run —
   \`<cmd>\`"), do not auto-fix. This is a check on existing output, not a
   new loop or a new script — the agent runs the step's own command, the
   same way `think-before-action`'s `step → verify:` planning already
   asks. Steps with no `verify:` field are governed by the flip-guard
   above unchanged (agent-decidable exit/acceptance criteria remain the
   default; `verify:` is the opt-in machine-checkable tightening).

6. **Dashboard regen — cadence-gated.** Run
   `./agent-config roadmap:progress` when due per
   `roadmap.dashboard_regen_cadence` (resolved in § 4; default
   `every_5_steps`):
   - `per_step` → always after the flip.
   - `every_5_steps` → after the 5th, 10th, … closed step **of this
     run**, or when the reply ends with closed steps pending regen.
   - `phase_boundary` → skip; the boundary handler in § 5 wrapper /
     § 6 runs the regen.
   - Any file-shape touch (rename / phase add / archive — Iron Law 1)
     → run immediately regardless of cadence.

   Skipped regens accumulate into the next due regen — the markdown
   file is the source of truth between regens.
7. Run quality pipeline if cadence is `per_step`.

### 5d. Resuming a run whose previous session died

A session above the recycle threshold and inside a running contract leaves a
**deterministic checkpoint** at
`agents/runtime/state/checkpoints/<run>.json` — open / done / parked counts,
the next open step, and the commit the tree was on. Every field is recomputed
from the roadmap on disk rather than summarised, which is what makes the next
line possible.

```
A RESUMED RUN RE-VERIFIES THE CHECKPOINT BEFORE ACTING ON IT.
RESUME BY EVIDENCE, NEVER BY BOOKKEEPING.
```

The first act of a resumed run is to look its checkpoint up **by roadmap slug**
— `latestCheckpointFor(repoRoot, slug)` — and then `verifyCheckpoint` it against
the current tree. The slug, not the run id: a relaunched session has a NEW
session id, so the run-id-keyed `readCheckpoint` cannot find the checkpoint the
DYING session wrote, and this instruction named an unreachable path until the
R2 review's finding 7. The slug is the one key a resumed run holds by
definition, because claiming the same roadmap is what makes it a resume.

The per-field report then names WHICH claim went stale, which is what a bare
"stale/fresh" verdict cannot. **A disagreement is not an error**: work landing
between the checkpoint and the resume is the normal case (a human committed, a
sibling worktree moved, the dying session finished a step it never recorded),
and the `actual` column is what to resume from. Treating progress as corruption
would refuse every healthy resume.

`agent-config run:supervise --once` reports which runs died with open steps
left. It never merges, pushes, or closes anything — that boundary is a named
rejection, not a missing feature.

### Halt conditions

- Hard-Floor trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md))
- Security-sensitive path ([`security-sensitive-stop`](../../rules/security-sensitive-stop.md))
- Step reveals work outside the roadmap's scope
- Test failure or quality red on `per_step`
- Council off, no second-model rung, and true ambiguity — under an
  **accepted execution contract**
  ([§ 3](#3-pre-scan--execution-contract-or-commit-step-ask)) this halt
  exists only when neither rung is available: the contract auto-enables
  council for the run, so in-run open questions resolve silently
  (`high_impact` / `user_required` classifications still escalate per
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)); with a
  class-declared `second_model` the local rung runs first. With neither,
  true ambiguity halts — never silent guessing, and never a
  self-adversarial monologue in place of the missing observer (the
  open-question handling in § 5 states that rung by rung).

An accepted execution contract **never lifts a Hard Floor** or any of
the other halts above — it removes redundant *asks* (git shape,
artifact drafting, council enablement), not safety.

On halt: stop, surface state, do **not** auto-fix outside the failing step.

### Forbidden non-halt reasons — agent-invented cautions

The halt list above is **exhaustive**. An agent running `process-full` (or any
wrapper) must **never** stop the run for a reason it invented that is not on
that list. In particular these are NOT halt conditions and stopping for them is
a violation of the command and the user's will:

- "running low on context / token budget" — keep landing complete steps until
  context actually runs out; never announce a boundary-stop by choice.
- "quality would degrade / this deserves a fresh focused run later"
- "avoid a PR pile-up" / "let the open PRs merge first"
- "this phase is large / touches a deep subsystem"
- "phase-checkpoints mode, so I'll checkpoint and wait" — under `process-full`
  a phase boundary emits a non-blocking status line and the run **continues**;
  the stop-and-wait reading of `phase-checkpoints` applies only to
  `process-phase`.

If the work genuinely cannot continue, it will be because one of the five real
halt conditions fired — surface THAT, not a manufactured caution.

### Non-halt — gating notes, "optional" tags

The following are **authoring annotations**, never halt conditions. Do
**not** stop execution when the roadmap text contains them:

- `(deferred)` / `(later)` / `(optional)` tags on a step
- "Gate: Phase 1 ships and …" prose inside a later phase

`process-step` and `process-phase` honor scope by stopping at their
configured boundary anyway. `process-full` processes every open step
regardless of these annotations — see
[`/roadmap:process-full § Iron Law`](../../commands/roadmap/process-full.md#iron-law--full-is-full).
Time-boxed plate / horizon framing is opt-in via
`roadmap.horizon_weeks` in `.agent-settings.yml` (default `0` =
forbidden, per template rule 16). When `0` and encountered in legacy
text, treat as ordinary prose; never use it to gate execution. When
`> 0`, plate framing is allowed in authoring but is still **not** a
halt condition — phase ordering and explicit dependency gates govern
execution either way.

## 6. Final report and archival

- Summary: scope-bound (steps/phases done in this run), council
  consultations count (if on), steps remaining, halts.
- Final dashboard regen.
- **End state under an accepted execution contract** (per-mode table:
  [`roadmap-execution-contract § 4`](roadmap-execution-contract.md)):
  all steps `[x]` · quality green per cadence · work committed in
  chunks on the run's feature branch · pushed to that branch · ONE PR
  open (description-only flow) · archival sweep run. **Merge is out of
  scope in every mode — always conversational.** Without a contract
  (interactive mode), the run ends after the archival check with no
  git delivery beyond explicitly authorized commit steps.
- **If the entire roadmap reached `count_open == 0`** → run the full
  project quality pipeline. On red → stop, surface failures, do **not**
  archive. On green → run the **deferred-resolution gate** below before
  archival.

### 6a. Deferred-resolution gate — Iron Law 3

Before any `git mv` to `archive/`, count `[~]` items in the closing
roadmap. If `count_deferred > 0`, archival is **blocked** per
[`roadmap-progress-sync § Iron Law 3`](../../rules/roadmap-progress-sync.md).
The loop MUST:

1. Enumerate every `[~]` step (phase + text + optional
   `<!-- deferred: ... -->` annotation).
2. Surface the numbered-options block from
   [`roadmap-management § 4b`](../../skills/roadmap-management/SKILL.md) —
   five choices: follow-up (draft), follow-up (ready + blocked),
   keep-in-archive (intentional drop), restore to `[ ]`, convert
   to `[-]` cancelled.
3. Wait for the user. The autonomous mandate (`/work`,
   `/roadmap:process-full`, "decide for me") does **not** lift this
   gate — Iron Law 3 calls it "the canonical lost-information failure
   mode this rule exists to prevent."
4. On picks 1 / 2 → run the "Spawn follow-up from deferred items"
   procedure in [`roadmap-management`](../../skills/roadmap-management/SKILL.md).
   On picks 3 / 4 / 5 → apply the change, re-evaluate the decision
   table, archive when the gate clears.

`count_deferred == 0` → archive. **Primary path:** run the
`archive_completed_roadmaps --all` sweep — it is untracked-safe (`git mv`,
or a plain `mv` in a pre-first-commit / untracked consumer), rewrites inbound
refs (on the index when tracked, on the filesystem when not), and regenerates
the dashboard. This entry point is **PR-independent** (gap B): it does not need
`/create-pr` to have run. **Fallback only when that script is not vendored** in
the consumer: emit a one-line instruction to vendor it (run `agents:init`),
then apply the manual procedure in
[`roadmap-management`](../../skills/roadmap-management/SKILL.md) (mkdir
`archive/`, `mv`, inbound-ref rewrite, dashboard regen). NEVER silently
delegate to a bare `git mv` that fails on untracked files and leaves a
completed roadmap rotting in the active tree.

## Scope deltas — what each wrapper binds

| Wrapper | Working set | Stop after | Execution contract (§ 3) |
|---|---|---|---|
| `process-step` | Single first open step | One iteration of § 5 | Never — mode ignored |
| `process-phase` | All open steps in first phase with `count_open > 0` | Phase boundary; per-phase quality if cadence ≠ `end_of_roadmap` | When `execution.mode: autonomous \| phase-checkpoints` |
| `process-full` | Every open step across every phase, in order | Roadmap fully closed (or halt) | When `execution.mode: autonomous \| phase-checkpoints` |

`process-full` runs the per-phase quality pipeline at every phase
boundary when cadence is `per_phase` or `per_step`; on red it halts
before the next phase. Phase-internal `(deferred)` / `(optional)` /
"gated on Phase N" annotations do not stop the run — those are
authoring notes, not halt conditions.
