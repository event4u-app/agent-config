# Roadmap-Process Loop

Loaded by [`/roadmap:process-step`](../../commands/roadmap/process-step.md),
[`/roadmap:process-phase`](../../commands/roadmap/process-phase.md), and
[`/roadmap:process-full`](../../commands/roadmap/process-full.md). Holds
the canonical autonomous-execution loop, roadmap discovery, cadence
resolution, commit-step pre-scan, halt conditions, and archival check.
The three command files are thin wrappers that bind only the **scope
delta**.

**Size budget:** the core is held by `src/config/procedure-core-budget.json`; branch files by `check_depth_budget` (16,000 chars each).

## 1. Resolve roadmap

### Context probe — unconditionally, before resolving the roadmap

```bash
agent-config roadmap:context --roadmap <slug>   # slug omitted on a bare invocation
```

Run it **before resolving the roadmap**, on every invocation, and print its
report in the pre-run summary (§ 2). Unconditional is the whole point: the live
merge-state clause below fires only when a message would *describe* a roadmap
as in-flight or merged, so a run that never makes such a claim has never looked.
Measured on the population that motivated this: 4 of 24 active roadmaps were
already closed in an open PR, and 2 of 22 six days later — the same sample
halved inside a week, which is why the probe re-runs on a cadence (§ 5e) rather
than once at branch time.

**Probe readings** — read [`roadmap-process-loop-prescan.md`](roadmap-process-loop-prescan.md#context-probe--unconditionally-before-resolving-the-roadmap).

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

**Live merge-state** — read [`roadmap-process-loop-prescan.md`](roadmap-process-loop-prescan.md#live-merge-state-before-any-in-flight--merged--handled-claim).

## 2. Pre-run summary — gate or inline note

**Retired gate key** — read [`roadmap-process-loop-prescan.md`](roadmap-process-loop-prescan.md#2-pre-run-summary--gate-or-inline-note).

- The roadmap is unambiguous (user named it, or exactly one active
  roadmap exists) → **no interactive gate.** Emit the summary block
  below as a one-shot inline note (no numbered options, no wait) so the
  user can still abort mid-stream if the wrong file was picked, then
  continue straight into § 3.
- The roadmap is ambiguous (multiple active roadmaps and none named),
  **or** an unresolvable cadence / scope conflict is detected → show the
  gate with numbered options and wait for input.

The gate is shown only for a genuine "which roadmap?" or an unresolvable
conflict — never as a routine confirmation.

Summary block (shown in both cases; the gate appends the numbered
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


## 3. Pre-scan — execution contract or commit-step ask

### 3-0. Read `## Decisions` — before any step, once per run

```
THE `## Decisions` TABLE IS READ BEFORE THE FIRST STEP, NOT WHEN A STEP TRIPS OVER IT.
A ROW IN IT IS A CLOSED DECISION. NEVER RE-DERIVE ONE. NEVER RE-ASK ONE.
A CLOSED DECISION REOPENS ONLY WHEN ITS `revisit if` CONDITION BECAME TRUE —
NEVER BECAUSE A CONTEXT RESET LOST IT, AND NEVER BECAUSE THE ANSWER LOOKS ODD.
```

Read it whole and cache it for the run alongside the cadences (§ 4). No section
is not an error — a plan that closed everything inline carries none. Row shape,
the three consequences during a run, and the reopen rule:
[`decision-closure-execution`](decision-closure-execution.md).

### 3a. Mode derivation ladder — first source wins

```
AN ABSENT `execution.mode` IS NOT A DECLARATION OF `interactive`.
IT IS THE ABSENCE OF A DECLARATION, AND IS DERIVED — NEVER DEFAULTED SILENTLY.
```

**3a ladder · 3b contract ask** — read [`roadmap-process-loop-prescan.md`](roadmap-process-loop-prescan.md#3a-mode-derivation-ladder--first-source-wins), [§ 3b](roadmap-process-loop-prescan.md#3b-contract-or-commit-step-ask).

### 3c. Capability screen — can the agent do this at all?

```
A RUN ALWAYS STARTS. THERE IS NO PREFLIGHT REFUSAL.
PER OPEN STEP, ASK ONE QUESTION: CAN THE AGENT EXECUTE THIS AT ALL?
YES → IT IS WORK. NO → IT IS THE ONLY KIND OF BLOCKER LEFT.
WHO CONVENTIONALLY DOES A THING IS NOT A PROPERTY OF THE THING.
```

**Capability screen** — read [`roadmap-process-loop-prescan.md`](roadmap-process-loop-prescan.md#3c-capability-screen--can-the-agent-do-this-at-all).

### Ask before park — a user decision is put to the user, then parked

```
A STEP BLOCKED ON A DECISION ONLY THE USER CAN MAKE IS PUT TO THE USER FIRST.
ONLY A DECLINE, A TIMEOUT, OR A NON-INTERACTIVE CONTEXT WRITES THE MARKER.
A TIMEOUT IS NOT CONSENT. A NON-INTERACTIVE CONTEXT IS NOT CONSENT.
NEVER ADOPT THE CONSERVATIVE DEFAULT WITHOUT AN ANSWER.
```

**Ask before park · 3d set contract** — read [`roadmap-process-loop-set.md`](roadmap-process-loop-set.md#ask-before-park--a-user-decision-is-put-to-the-user-then-parked), [§ 3d](roadmap-process-loop-set.md#3d-set-contract--one-contract-over-an-enumerated-set).

## 4. Resolve cadences — read once, cache for the run

Read `roadmap.quality_cadence` from `.agent-settings.yml` once and cache
it for the whole run. Do **not** re-read inside the step loop.

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

**Regen cadence · context refresh** — read [`roadmap-process-loop-set.md`](roadmap-process-loop-set.md#4-resolve-cadences--read-once-cache-for-the-run).

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
1. **Bundled read — one parallel tool-call block.** The step's own
   section (`grep -n` its line, then a ranged read — never the whole
   roadmap), the immediately-relevant code files, and any
   guideline/context the step cites are **independent** reads and
   **must** be dispatched together, not serially.

   **Batching example** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5-step-loop).

2. Analyze the codebase for what the step requires.
3. Decide and act — implement. **No "should I implement this?" prompt.**
4. **Open question handling:**
   **Council on · second-model rung** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5-step-loop).
   - **Council off / not configured** → halt, surface once, wait.
     Resume on next turn. An execution contract cannot enable a
     council that has no configured members — the contract summary
     says so upfront, and in-run ambiguity halts (never silent
     guessing).
   **No self-adversarial fallback · memo** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5-step-loop).
4b. **Stale-artefact check — a vanished file is never a closed step.**

   Before flipping anything, check the step's own cited paths against the tree:

   ```
   NEVER MARK STALE WORK COMPLETE JUST BECAUSE IT DISAPPEARED.
   ABSENCE OF THE FILE IS ABSENCE OF EVIDENCE, NOT EVIDENCE OF COMPLETION.
   ```

   Any cited path missing → the step resolves to **`unverified`**: surface it in
   the run report, name the missing path, and flip **no** checkbox. Not `[x]`
   (the evidence cannot be checked), not `[-]` (nobody decided to skip it), not
   `[~]` (nobody deferred it) — the box stays open and the report carries the
   reason. `staleArtefactVerdict` in `roadmap_context.ts` is the predicate.

   **Why the stale check exists** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5-step-loop).

5. **Atomic flip — same reply, every step.**
   Flip the checkbox in `agents/roadmaps/<file>.md`: `[x]` done ·
   `[~]` partial · `[-]` skipped. **Non-skippable, non-batchable**
   per Iron Law 2 of
   [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md).
   A loop iteration that lands work without flipping its box is a
   rule violation. Do not save flips for the archive commit.
   The flipped line ends with the step's receipt:
   `./scripts-run src/scripts/step_receipt --range <first commit>^..HEAD`
   (change class, raise-only via `--raise`, and what the `shadow`-mode
   `src/config/step-depth-table.json` would skip — no ceremony changes).

### 5a-residue. Mid-run residue — the same ownership table, inline

```
A DECISION THE RUN MEETS MID-STEP IS ROUTED BY THE SAME TABLE THAT CLOSED THE
PLAN. TECHNICAL RESIDUE RESOLVES INLINE AND IS APPENDED TO `## Decisions` WITH
THE STEP ID. IT NEVER BECOMES A QUESTION, AND IT NEVER BECOMES A HALT.
OWNER-OWNED RESIDUE ASKS **ONLY IF THE STEP CANNOT PROGRESS**. OTHERWISE THE
STEP IS PARKED, INDEPENDENT PHASES CONTINUE, AND THE RUN COMES BACK TO IT.
```

Per-class routing, why parking is not deferring, and the scope-growth pointer:
[`decision-closure-execution`](decision-closure-execution.md).

### 5b. Flip-guard — deterministic

   Before advancing to step 6, run:

   ```bash
   git status --porcelain -- agents/roadmaps/<file>.md
   ```

   **Why `--porcelain`** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5b-flip-guard--deterministic).

   Empty output → Iron Law 2 was violated this iteration: the step
   landed work but no checkbox flipped. **Halt loudly**, surface
   "step <N> landed without checkbox flip — flip then resume", and
   stop the run. Outside an accepted contract: do not auto-fix; the user
   resumes on the next turn. Inside one: exactly one self-fix attempt, under
   the four preconditions below.

   **Self-fix · `verify:` gate · steps 6-7** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5b-flip-guard--deterministic).

### 5d. Resuming a run whose previous session died

```
A RESUMED RUN RE-VERIFIES THE CHECKPOINT BEFORE ACTING ON IT.
RESUME BY EVIDENCE, NEVER BY BOOKKEEPING.
```

**Resume · 5e reactions** — read [`roadmap-process-loop-run.md`](roadmap-process-loop-run.md#5d-resuming-a-run-whose-previous-session-died), [§ 5e](roadmap-process-loop-run.md#5e-context-refresh--four-reactions-enumerated-and-closed).

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

### Terminal outcomes — `complete`, or a genuine external impossibility

```
`blocked` IS NEVER PRESENTED AS COMPLETION.
count_open STAYS > 0. NO CHECKBOX IS FLIPPED TO [~] TO REACH IT.
A PR OPENED ON A BLOCKED RUN IS LABELLED PARTIAL PROGRESS.
BEFORE REPORTING IT, ASK PER REMAINING STEP: CAN I DO THIS AT ALL?
ONE STEP THE AGENT COULD HAVE EXECUTED REJECTS THE CLAIM.
```

```
A SOLVABLE ARCHITECTURAL AMBIGUITY IS NOT `BLOCKED`. IT IS A DECISION.
A TECHNICAL JUDGEMENT CALL IS NEVER PARKED IN A FILE — IT ROUTES BACK THROUGH
CLOSURE AND IS RESOLVED AT THE LOWEST RUNG THAT OWNS IT: EVIDENCE, CONVENTION,
THE AGENT, AN INDEPENDENT SESSION, THE COUNCIL, THE TEAM.
A COUNT IS NEVER A QUESTION — A BOUNDED LOOP'S BOUND TRIGGERS A STRATEGY CHANGE
AND THE ESCALATION LADDER, NEVER AN OWNER QUESTION (ADR-268 § 7).
```

**Terminal outcomes · non-halt reasons** — read [`roadmap-process-loop-close.md`](roadmap-process-loop-close.md#terminal-outcomes--complete-or-a-genuine-external-impossibility), [forbidden](roadmap-process-loop-run.md#forbidden-non-halt-reasons--agent-invented-cautions), [annotations](roadmap-process-loop-close.md#non-halt--gating-notes-optional-tags).

## 6. Final report and archival

- Summary: scope-bound (steps/phases done in this run), council
  consultations count (if on), steps remaining, halts.
- Final dashboard regen.
**Contract end state · refusals** — read [`roadmap-process-loop-close.md`](roadmap-process-loop-close.md#6-final-report-and-archival).

- **If the entire roadmap reached `count_open == 0`** → run the full
  project quality pipeline. On red → stop, surface failures, do **not**
  archive. On green → run the **deferred-resolution gate** below before
  archival.

**Deferred-resolution gate · scope deltas** — read [`roadmap-process-loop-close.md`](roadmap-process-loop-close.md#6a-deferred-resolution-gate--iron-law-3), [scope deltas](roadmap-process-loop-close.md#scope-deltas--what-each-wrapper-binds).
