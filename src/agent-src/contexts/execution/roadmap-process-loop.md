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

The report carries open PRs with the files they change, remote branches carrying
a roadmap slug, live sessions on both axes, `agents/tmp/` note names, sibling
roadmaps on the same topic, and roadmap-to-PR file overlap. Two readings act:

- **The roadmap is closed in an open PR** → name the PR number and stop. This is
  a **selection error**, not a halt: nothing on the halt list fired, the run
  simply picked work that is already done. It does not touch the halt list and
  it is not a `blocked` outcome.
- **The roadmap is partially covered by an open PR** → name the PR and continue,
  on a branch cut from `origin/main`. Never rebase onto the foreign branch.

Same honesty boundary the probe states in its own header: **the probe is
deterministic once invoked, and the invocation is model-carried.** Nothing fires
it and nothing notices when it is skipped.

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
| `/roadmap:process-full` | `autonomous`, **preselected** | offered |
| `/roadmap:next` | `phase-checkpoints`, **preselected** | offered |
| `/roadmap:process-phase` | `phase-checkpoints` | offered |
| `/roadmap:process-step` | — | none (one step needs no run contract) |

Still **exactly one confirmation**, never two: rung 3 changes which option the
contract screen arrives preselected on, never whether the screen is shown. The
screen's `3. Run interactive instead` option
([`roadmap-execution-contract § 2`](roadmap-execution-contract.md)) stays on it
in every case, so a derived mode is always one keystroke from being refused.

<!-- decision 2026-08-20: /roadmap:next preselects `phase-checkpoints`, not
     `autonomous`. AI council 2/2 (anthropic + openai) on the
     `autonomy-defaults-sheet` fork of road-to-user-out-of-the-loop, record
     agents/evidence/council/drain-blocker-dispositions-a.md. Reasoning: the two
     wrappers differ in what the user has actually seen at Accept time.
     `process-full` names one roadmap the user chose, so `autonomous` is a
     preselection over a scope they read. `/roadmap:next` SELECTS the roadmap
     itself, so `autonomous` there preselects full autonomy over a target the
     user has not seen — the one rung where the derivation picks the object and
     the scope in the same keystroke. Reversibility: this is a preselected
     option on a screen that still offers `1. Go — start processing
     autonomously`, so the aggressive path costs one keystroke and no rebuild;
     flipping the row back is a one-line edit with no dependent mechanism.
     Deliberately scoped to `/roadmap:next` only — the blocker's question named
     that wrapper, and Phase 1 Step 1 of the parent roadmap landed with
     `process-full` → `autonomous` explicitly, so widening the change would
     silently reverse an already-shipped step nobody asked to revisit. -->


**Why the old fallback was a defect and not a conservative default.** Absent
`execution.mode` used to mean the legacy commit-step scan, which derives no
contract at all — no batched artifact drafting, no council auto-enable, no
push/PR grant. Measured 2026-08-17: **27 of 37 active roadmaps carry no
`execution.mode`**, so roughly three quarters of the corpus ran the degraded
path *under the wrapper built for the opposite*, and silently — the user saw a
`process-full` invocation behave like an interactive one with no line saying so.
A default that contradicts the wrapper the user just typed is a wrong answer,
not a safe one.

**Kill criteria — carried here, at the flip, not only in the roadmap that
made it.** A default flip whose reversal condition lives in a roadmap is a
flip nobody can reverse once that roadmap is archived, which is why both
conditions below sit next to the table they govern:

- **The ladder itself** (absent `execution.mode` derives a mode instead of
  falling back to interactive): `3. Run interactive instead` chosen at the
  contract screen in **more than 40 % of 20 runs** reverts rung 3, leaving
  the ladder at explicit-suffix-then-frontmatter only. **No instrument
  today** — nothing records which contract option was chosen, so the rate is
  unmeasured rather than low. Stated so the gap is visible at the flip.
- **The `/roadmap:next` row** (`phase-checkpoints` rather than
  `autonomous`): reverted if checkpoint-mode runs on that wrapper are
  observed to stop at a phase boundary the user then waves through without
  a change — that is a contact the preselection bought nothing for. Same
  missing instrument, same honesty: this is a condition, not a reading.

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

### 3c. Capability screen — can the agent do this at all?

```
A RUN ALWAYS STARTS. THERE IS NO PREFLIGHT REFUSAL.
PER OPEN STEP, ASK ONE QUESTION: CAN THE AGENT EXECUTE THIS AT ALL?
YES → IT IS WORK. NO → IT IS THE ONLY KIND OF BLOCKER LEFT.
WHO CONVENTIONALLY DOES A THING IS NOT A PROPERTY OF THE THING.
```

**Rewritten by [ADR-237](../../../docs/decisions/ADR-237-end-to-end-execution-authority.md),
which supersedes ADR-235.** This section used to be a *preflight refusal*: a run
with no "runnable" open step created no branch and wrote nothing. That is gone.
The invocation is a delegation, so the question is no longer *is this step
runnable under current governance* but *is this step possible for the agent at
all.*

Run once at the end of the pre-scan, and again immediately before any `blocked`
report.

**The screen, in order:**

1. **Can the agent execute it?** Through the filesystem, git, `gh`, an API, a
   CLI, a tool, a model, a council — anything machine-executable. If yes, the
   step is **work**. Stop here; no blocker citation changes that.
2. **Is the authority already implied by the invocation?** For a `process-full`
   run: branches, chunked commits, pushing that branch, opening and updating the
   PR, reversible repository/branch settings, CI runs and re-runs, merge-base
   updates, conflict resolution, project-local dependencies, and paid calls
   inside the cumulative USD 25 ceiling. If yes → **run it**.
3. **Is it on the EXCLUDED list?** Merging to a production trunk, deploying,
   production data / secrets / IAM / DNS, bulk deletion outside the roadmap's
   scope, an irreversible external action beyond the PR itself. Those keep their
   own this-turn confirmation ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md))
   and are a **halt**, not a blocker.
4. **Otherwise it is externally impossible**, and only then is it a blocker: a
   credential that does not exist and cannot be created · a purchase beyond the
   budget · physical hardware access · another person or organisation must act ·
   a wait that is factually mandatory and unverifiable.

**A `## Blockers` entry is evidence, never a verdict.** A `Class: 3` label on an
action the agent can perform is a **defect in the roadmap**, and the run repairs
the label rather than obeying it — recording what it did and why. Class `0`/`1`
entries carry a `Run:` the agent executes, exactly as before. Class `2`
(consent-once) is pre-cleared for the duration of a `process-full` run when the
consent it wants is one the invocation already gave; a `2` asking for something
the invocation did NOT give (an EXCLUDED action, a spend crossing) still reaches
the owner.

**No citation → work**, and the default direction is unchanged: the failure this
screen must not have is declining work an agent could have done.

**A step this screen judges externally impossible carries a `blocked-by:` marker
on its own line.** The obligation is unchanged and its reason is unchanged: two
mechanisms read blockedness from two different places and only one reads this
section — `run-continuation`, the stop-slot concern that re-engages an autonomous
run, decides open-vs-blocked from the inline `<!-- blocked-by: <id> -->` marker
and never parses `## Blockers`. Without the marker a step that IS impossible
still counts as open work to the concern, which re-engages the agent into it
every stop fire until the stall rung fires — the mechanism whose job is to detect
a stall manufacturing one. **The residual is real and is not papered over:**
nothing enforces the pairing, so a `## Blockers` entry authored without its
marker is caught by review or not at all.

**The gaming vector inverted, and both directions are now named.** Under ADR-235
the vector was an agent writing itself a Class-3 blocker to stop early; the
defence was that a qualifying blocker must **pre-date the run**, checkable from
git. That defence is kept for the narrow blocker set that remains. ADR-237 adds
the opposite vector — an agent that keeps going past a spend ceiling or into an
EXCLUDED action under cover of "the roadmap needed it" — and its defences are
step 3 above being an enumerated list rather than a characterisation, and the
ceiling being cumulative per run rather than per action.

**One imprecision, inherited and now given a test.** The class taxonomy has no
row for *"waiting on time"* or *"waiting on another roadmap"*; both are authored
as `3` today because an absent `Class:` already means `3`. Under step 4 a wait is
a blocker only when it is factually mandatory and unverifiable — a soak window a
run can simply outlast, or a cross-roadmap dependency the run can satisfy itself,
is work. The taxonomy still lacks the row; the mislabel now has a stated test
instead of a default.

### 3d. Set contract — one contract over an enumerated set

A **set contract** is the ordinary contract screen rendered over a closed,
ordered list of roadmaps instead of one. It grants
[`autonomy-mechanics § Task-scope`](autonomy-mechanics.md)'s **set-scoped**
shape, whose four conditions (enumerated before Accept · closed · ordered with
independence declared · one Accept) are the authorization contract — this
section is only the loop's side of it.

**What the screen must print, per member.** Roadmap path, derived branch name,
open-step count, artifact count from the pre-scan, and its dependency edges.
One decision sheet spans the whole set: a question that applies to several
members appears once, and its answer applies to all of them.

**Dependency edges come from two sources, unioned.**

| Source | Shape | Trust |
|---|---|---|
| Declared | `depends:` in the dependent roadmap's frontmatter — a list of roadmap slugs | authoritative; a declared edge is never overridden by the heuristic |
| Inferred | **file overlap**: the intersection of the owned-path sets the two pre-scans derived | advisory; an inferred edge orders the members and marks them non-parallelizable, and is printed as inferred so the user can see why |

The union feeds exactly two decisions and nothing else: **ordering** (a
dependent member runs after its parent) and **parallelizability** (only members
with no edge between them and disjoint owned paths are lane candidates). An
inferred edge is deliberately allowed to be wrong in the conservative
direction — a false edge costs serial execution, a missed edge costs a
collision, so overlap resolves toward *serial*.

#### Auto-continuity — the next member needs no new contact

Under an accepted set contract, when a member closes **green** the loop pulls
the next member whose dependencies are all satisfied and starts it without a
new contact. Green means: its own final report ran, its quality cadence passed,
and no halt class fired. Anything else is not green and does not continue —
see failure isolation below.

The default stays **this one only**: auto-continuity applies to
`/roadmap:next` and to any wrapper reaching this section **only when the set
option was chosen on the sheet**. A single-roadmap invocation is never widened
into a set because more roadmaps happened to be open, which is condition 4 of
the set-scoped shape read from the loop's side.

#### Failure isolation — a regression halts its own member, not the set

A quality regression, a failed verify probe, or a halt class firing inside one
member terminates **that member** and leaves the rest of the set running:

1. Record the member's outcome as halted, with the halt class and the evidence.
2. Skip every member that declares a dependency on it — transitively. A
   dependent member of a halted parent is *blocked*, not failed, and is
   reported as such.
3. Continue with the next independent member.
4. Report every member's outcome in one final report at the end of the set.

Two carve-outs, and they are the reason this is isolation rather than
tolerance. A **Hard-Floor** stop and a **locked decision class** stop the whole
set, not one member: both are about the user's authority rather than about the
member's code, and continuing past them under a set contract would be exactly
the "several authorizations from one Accept" failure the enumeration guards
against. Likewise the **N=3 validation budget** is per validation target and is
not reset by moving to the next member.

#### Parallel lanes — the shape, and why they are not on yet

Lanes are **staged**, not shipped: the gate is ten clean serial set runs, and
that gate has not been reached because no set run has happened. Recorded here
so the shape is settled before the runs rather than designed under pressure:

- **Cap: two lanes** in the first iteration — a recorded decision
  (`decision 2026-08-20`, AI council 2/2 on the `autonomy-defaults-sheet`
  fork), chosen over the configured `subagents.max_parallel` because a
  collision at two lanes is diagnosable and one at N is not. Reversible: the
  cap is one number in the set contract, and raising it after the first ten
  clean parallel runs is strictly cheaper than recovering from a lost branch.
- **Candidate test:** no dependency edge in either direction, and disjoint
  owned paths.
- **Isolation:** the existing worktree scope lock
  ([`worktree-lifecycle`](../../skills/worktree-lifecycle/SKILL.md)).
- **Coordination:** session-register branch claims, so two sessions never share
  a branch.
- **Delivery:** one branch and one PR per lane.
- **Immediate removal:** a single scope-lock collision with data loss.

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

### Context refresh — a comparison, not a third cadence key

There is **no `roadmap.context_refresh_cadence` setting**, deliberately. The
refresh trigger is derived:

```bash
agent-config roadmap:context --fingerprint   # cheap: one rev-parse + one gh call
```

At every phase boundary (and at run end), take the fingerprint and compare it
with the one § 1's probe returned. **Differs → re-probe in full** and apply the
reaction table in § 5e. **Same → nothing moved; continue without paying for a
probe.** Cache the new value as the run's baseline either way.

The fingerprint covers `origin/main` **and the head SHA of every open PR**. The
second half is the case a `main`-only trigger misses: a peer pushing to their own
PR branch mid-run can add a file that now overlaps this run's owned paths while
`origin/main` has not moved at all.

Why a comparison and not a knob: `docs/contracts/settings-classes.md` classifies
a fixed-beat flag as `derivable` — "the mechanism itself can decide, from the
situation, better than a flag can" — behind a ratchet whose count may only fall.
A cadence enum was implemented, refused by `lint_settings_classes`, and replaced
by this; the full reasoning, the options rejected, and what the substitution costs
are in `agents/evidence/analysis/situational-awareness-cadence-key-decision.md`.
Turning the refresh off is a one-line revert of this subsection, which is the same
reversibility a `cadence: off` value would have bought.

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

   The failure this catches is quiet: "nothing to do here" reads identically to
   "already done", and one of those is a closed step while the other is a lost
   one. A step citing no paths is unaffected — there is nothing to check, and
   inventing a doubt would fire this on every prose step.

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
   stop the run. Outside an accepted contract: do not auto-fix; the user
   resumes on the next turn. Inside one: exactly one self-fix attempt, under
   the four preconditions below.

   **One deterministic self-fix, contract mode only.** A forgotten flip is the
   one halt class whose repair is mechanical — the work is on disk, the step is
   named, and the glyph follows from the outcome. Halting a contract run on it
   spends a user contact to retype something the run can derive. So inside an
   accepted contract the run may attempt the flip **once**, and only when all
   four hold:

   1. **The work is citable.** The step's landed change is identifiable in this
      iteration's own output — a diff, a file path, a command result. No
      evidence, no flip: that is a genuine halt, not a forgotten one.
   2. **The glyph is unambiguous.** `[x]` only for a step whose evidence is
      present and, where the step carries a `verify:` field, whose fresh green
      run is in this reply. Anything that would be `[~]` or `[-]` is a
      *disposition*, never a repair — those halt exactly as before, because a
      deferral and a cancellation are decisions.
   3. **Exactly one attempt, per run.** Not per step. A second forgotten flip
      in the same run halts: one is a slip, two is a broken loop, and the
      difference is the whole justification for allowing the first.
   4. **The attempt is verified, then re-guarded.** Re-run the
      `git status --porcelain` probe above after the flip. Still empty → halt
      loudly as before. A self-fix that cannot prove itself is
      indistinguishable from the failure it was repairing.

   The attempt is recorded as a decision memo (§ 4 handling), so an auto-flip is
   reviewable after the fact rather than invisible. **Kill criterion, from the
   originating roadmap and repeated here because a flip is a write to the source
   of truth: one wrong auto-flip removes this allowance** and returns the guard
   to halt-always. Reversibility is the deletion of this block — the guard
   underneath it never changed.

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

**The checkpoint carries a repository fingerprint too, not only roadmap counts.**
`context_fingerprint` is the `roadmap:context --fingerprint` value the dying run
last held. Every other field on the checkpoint reports **roadmap** drift; none
reported **repository** drift, so a run resumed after a long gap trusted a context
reading it never re-took — the exact staleness § 4's refresh exists to end,
reappearing across the one boundary a mid-run cadence cannot see.

A resumed run therefore re-probes and passes the fresh fingerprint into
`verifyCheckpoint`. A disagreement forces a full re-probe and the § 5e reactions
**before the first step**. A `null` or absent value on either side reads as *not
known* and never as a disagreement — the same rule `head` already follows, and for
the same reason: a false alarm on the field whose job is to say whether anything
moved trains the reader to skip the line.

`agent-config run:supervise --once` reports which runs died with open steps
left. It never merges, pushes, or closes anything — that boundary is a named
rejection, not a missing feature.

### 5e. Context refresh — four reactions, enumerated and closed

At each due point (§ 4 — fingerprint differs) re-probe and act. **These four rows
are the whole set.** Nothing here is a halt: none of them appears on the halt list
and none of them is a `blocked` outcome.

| # | What the refresh found | Reaction |
|---|---|---|
| a | A PR touching my owned paths **merged** since the last refresh | Run `sync_pr_branch` now — already the documented resolution, only push-bound until this row existed. Re-read the current step's files, continue. |
| b | An **open** PR touches my owned paths | Continue. Name the collision in the PR description and in the final report. **Never rebase onto a foreign branch.** |
| c | A peer session shows `PATH OVERLAP` | Take disjoint steps first if ordering allows; otherwise name it and continue. The register is advisory, never a lock. |
| d | The roadmap itself was **archived on `origin/main`** | Stop. The same **selection error** as § 1, detected late — not a halt, and no checkbox is flipped to reach it. |

Deliberately NOT a drift-level taxonomy. A severity ladder over these four would
invite a fifth row for every new shape of surprise, and the value here is that the
set is closed: an agent that meets something outside it has met an ordinary step,
not a new reaction.

Row (a) is the one that changes behaviour mid-run rather than only reporting. Rows
(b) and (c) exist to make the collision **visible in the artefact** — a run that
silently produces a conflicting PR has spent the reviewer's time, not its own.

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

The halt list above answers *"what interrupts runnable work"*. This answers
*"what does the run report when the roadmap is not finished and the remaining
work is not the agent's to do"* — and under
[ADR-237](../../../docs/decisions/ADR-237-end-to-end-execution-authority.md) that
second set is much smaller than it looks.

**The measurement that motivated the old answer, and the reading that replaced
it.** Measured 2026-08-19 across the twelve most nearly complete roadmaps:
**zero** could reach `count_open == 0` in one PR, because every remaining step
needed "a human action" — flip branch protection, authorise paid spend, install a
binary, wait out a soak window, edit a file a hook denies. The census was sound.
The reading was not: it counted actions a human *conventionally* performs,
without asking per action whether a human was **necessary**. Flipping a branch
setting, pushing, opening a PR, re-running CI, updating a merge base, fixing a
test, spending inside a budget — the agent can do all of it. That is remediation
work, and a `process-full` invocation grants it.

Four outcomes, and only one of them is success:

| Outcome | When | What it reports |
|---|---|---|
| `complete` | `count_open == 0` and the PR is open | the roadmap is finished; archival check runs (§ 6) |
| `blocked` | every remaining open step is **externally impossible** for the agent | the work that DID close, plus the specific impossibility |
| `superseded` | the remaining work **already landed** on `origin/main`, in a merged PR | which steps the tree already satisfies, with the PR number and the evidence per step |
| a halt | one of the five conditions above fired | the halt, its evidence, and what remains |

**Why `superseded` is here and not on the halt list.** A run that meets a merged
PR which already closed its remaining steps had, until this row existed, no legal
move: *"let the open PRs merge first"* is a forbidden non-halt reason below, the
halt list calls itself exhaustive, and neither `complete` nor `blocked` is true —
the work is done and it was not externally impossible. The only two available
actions were a rule violation or duplicate work. This row is the third.

It is a **report**, not a licence to flip anything. Marking a step the tree
already closed is a separate, deliberately unbuilt mechanism: it needs the step's
own `verify:` green against `origin/main`, a decision memo, and a one-strike kill
criterion, and an autonomous run writing a completion marker into the source of
truth is not switched on unasked. Until it is, `superseded` reports and the boxes
stay open — the same discipline the `[~]` prohibition below enforces for
`blocked`.

`blocked-preflight` **no longer exists** (ADR-237 § 4). A run always starts.

```
`blocked` IS NEVER PRESENTED AS COMPLETION.
count_open STAYS > 0. NO CHECKBOX IS FLIPPED TO [~] TO REACH IT.
A PR OPENED ON A BLOCKED RUN IS LABELLED PARTIAL PROGRESS.
BEFORE REPORTING IT, ASK PER REMAINING STEP: CAN I DO THIS AT ALL?
ONE STEP THE AGENT COULD HAVE EXECUTED REJECTS THE CLAIM.
```

**Externally impossible — the whole list.** A required credential that does not
exist and the agent cannot create · a purchase beyond the delegated budget ·
physical hardware access · another person or organisation must act · a wait that
is factually mandatory and cannot be simulated or verified.

**Not externally impossible — every one of these is work.** An unprotected
branch · a branch to create · a push · a PR to open · a repository or branch
setting the agent can change · a workflow to start · CI to re-run · a merge base
to update · conflicts · failing tests · local configuration · a paid call under
the ceiling · "this could be risky" · "a maintainer should do this".

The `[~]` prohibition is load-bearing and was the one point the council split on.
Deferring a blocked step to `[~]` would let the run reach `count_open == 0` and
report completion — laundering unfinished work through a glyph, which is exactly
what Iron Law 3 of [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
exists to catch on the archival side. So the boxes stay open and the outcome
carries the truth instead. **ADR-237 keeps this clause verbatim** — narrowing
`blocked` makes it more important, not less, because a run with more authority
has more ways to reach a clean-looking count.

Revalidation is the second half of the same discipline: the set is recomputed at
the moment of reporting, because steps unblock during a run (a prerequisite
closes, a `Run:` succeeds, a peer merges, a setting the run itself changed). If
any remaining step is one the agent could execute, `blocked` is refused and the
loop continues.

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
- **"this step looks human-gated"** — the `blocked` outcome above is reached by
  the § 3c test, never by a judgement about how a step feels. A step with no
  qualifying blocker citation is runnable, and writing the citation yourself does
  not make it one. This entry exists because the terminal outcome is the single
  most abusable thing on this page.
- **"the branch is not protected" / "a branch must be created" / "a PR must be
  opened" / "a GitHub setting must change" / "CI must be re-run" / "the merge
  base needs updating" / "there are conflicts" / "tests fail"** — every one is
  remediation work the invocation authorised (ADR-237 § 1). Do it.
- **"a paid service is needed"** — authorised up to a cumulative USD 25 per run
  (§ Spend in the wrapper). Uncertainty about the exact cost is explicitly NOT a
  reason to ask.
- **"a maintainer should do this"** when the agent can perform the same action
  through git, `gh`, an API or a CLI. **Capability before role**: the role of the
  person who conventionally does a thing is not a property of the thing.

If the work genuinely cannot continue, it will be because one of the five real
halt conditions fired, or because every remaining step is externally impossible
by the § 3c test — surface THAT, with the specific impossibility named, not a
manufactured caution and not a convention mistaken for a constraint.

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
3. **Route by the preservation test**, per
   [`roadmap-progress-sync § Who resolves it`](../../rules/roadmap-progress-sync.md):
   a disposition that keeps the criterion ALIVE in the active estate
   (fix now · carry item + blocker into a follow-up created in the SAME
   change · merge into existing active work · restore to `[ ]`) may be
   resolved by the council, recorded at the item. A disposition that
   drops, weakens or permanently accepts the loss of it — cancel to
   `[-]`, keep-in-archive, scope cut — reaches the **user**, and the
   autonomous mandate (`/work`, `/roadmap:process-full`, "decide for
   me") does **not** lift that half. In doubt: user. A council verdict
   naming a follow-up that does not exist yet fails closed to the user.
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
