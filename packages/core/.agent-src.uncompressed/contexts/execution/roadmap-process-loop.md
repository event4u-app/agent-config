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
  via `scripts/_lib/agent_settings.py::enumerate_modules()`. Laravel
  shape: `app/Modules/*/agents/roadmaps/*.md`)

**Exclude** `template.md`, `archive/`, and `skipped/`.

- User named one (path, partial name, title) → use it.
- None named, single active roadmap (`count_open > 0`) → use it.
- None named, multiple active → default = **most recently modified**;
  surface alternatives in the pre-run summary.
- None active → tell the user; suggest [`/roadmap:create`](../../commands/roadmap/create.md).

## 2. Pre-run summary — single confirmation gate

Read `roadmap.skip_pre_run_gate` from `.agent-settings.yml` (default
`true`).

- `true` **and** the roadmap is unambiguous (user named it, or exactly
  one active roadmap exists) → **skip the interactive gate**. Emit the
  summary block below as a one-shot inline note (no numbered options,
  no wait) so the user can still abort mid-stream if the wrong file
  was picked, then continue straight into § 3.
- `false`, **or** the roadmap is ambiguous (multiple active roadmaps
  and none named), **or** an unresolvable cadence / scope conflict
  is detected → show the gate and wait for input.

Summary block (shown in both modes; the gate-mode adds the numbered
options + wait):

> Roadmap: `<resolved-path>`
> Phase 1: `<name>` — 3/5 done
> Phase 2: `<name>` — 0/4
> Next open step: `<description>`
> Scope: **step | phase | full**
> AI council: **on | off** (`<member list or "no members configured">`)
> Quality cadence: **end_of_roadmap | per_phase | per_step**
> Commit steps in roadmap: **N** (see § 3)
>
> 1. Go — start processing autonomously
> 2. Different roadmap · 3. Different scope · 4. Toggle council · 5. Abort

The gate is also skipped — regardless of `skip_pre_run_gate` — when
scope, roadmap, and council are all unambiguous in the invocation
(e.g. `/roadmap:process-phase road-to-X.md with council`); the
invocation-level skip is the legacy path that still works under
`skip_pre_run_gate: false`.

## 3. Commit-step pre-scan — one upfront ask

Before step 4, scan the roadmap for explicit commit steps (lines
matching `commit:` / `git commit` / `Commit phase` patterns).

- **No commit steps** → nothing to ask. Never commit, never re-ask
  per [`commit-policy`](../../rules/commit-policy.md).
- **Commit steps present, autonomous mode** (`personal.autonomy: on`,
  or `auto` after opt-in) → ask **once** upfront:
  > "Roadmap contains N commit steps. Authorize all of them for this
  > run? (yes / no / list them)"
  Cache the answer for the whole run; do **not** re-ask per step.
  Hard-Floor diffs (bulk deletions, infra) still trigger the
  per-commit gate from [`commit-mechanics`](../authority/commit-mechanics.md).
- **Commit steps present, non-autonomous** → ask before each commit
  step inside the loop.

## 4. Resolve cadences — read once, cache for the run

Read both keys from `.agent-settings.yml` once and cache for the whole
run. Do **not** re-read inside the step loop.

**`roadmap.quality_cadence`** — when to run the quality pipeline:

| Value | Pipeline runs |
|---|---|
| `end_of_roadmap` (default) | Once, before archival (§ 6) |
| `per_phase` | At every phase boundary + § 6 |
| `per_step` | After every step + § 6 |

Missing / unreadable / unknown → fall back to `end_of_roadmap`.
The Iron Law [`verify-before-complete`](../../rules/verify-before-complete.md)
still mandates fresh quality output before any "complete" claim.

**`roadmap.dashboard_regen_cadence`** — when to run the dashboard
subprocess between steps:

| Value | `./agent-config roadmap:progress` runs |
|---|---|
| `per_step` (default) | After every checkbox flip |
| `every_5_steps` | Every 5th closed step + at phase boundary + at reply end |
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
   normally.
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
2. Analyze the codebase for what the step requires.
3. Decide and act — implement. **No "should I implement this?" prompt.**
4. **Open question handling:**
   - **Council on** → invoke per [`ai-council`](../../skills/ai-council/SKILL.md),
     integrate convergence, proceed. Token spend was opted in.
   - **Council off** → halt, surface once, wait. Resume on next turn.
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
   git diff --name-only -- agents/roadmaps/<file>.md
   ```

   Empty output → Iron Law 2 was violated this iteration: the step
   landed work but no checkbox flipped. **Halt loudly**, surface
   "step <N> landed without checkbox flip — flip then resume", and
   stop the run. Do not auto-fix; the user resumes on the next turn.

   This guard is the deterministic counterpart to the rule's
   pre-send self-check — it catches a forgotten flip per step, not
   only at run end. It runs in every scope (`process-step`,
   `process-phase`, `process-full`); the cost is one `git diff` per
   step.

6. **Dashboard regen — cadence-gated.** Run
   `./agent-config roadmap:progress` when due per
   `roadmap.dashboard_regen_cadence` (resolved in § 4):
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

### Halt conditions

- Hard-Floor trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md))
- Security-sensitive path ([`security-sensitive-stop`](../../rules/security-sensitive-stop.md))
- Step reveals work outside the roadmap's scope
- Test failure or quality red on `per_step`
- Council off + true ambiguity

On halt: stop, surface state, do **not** auto-fix outside the failing step.

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
- **If the entire roadmap reached `count_open == 0`** → run the full
  project quality pipeline. On green → archival via the
  [`roadmap-management`](../../skills/roadmap-management/SKILL.md) skill
  (`git mv` to `agents/roadmaps/archive/`, regenerate dashboard). On
  red → stop, surface failures, do **not** archive.

## Scope deltas — what each wrapper binds

| Wrapper | Working set | Stop after |
|---|---|---|
| `process-step` | Single first open step | One iteration of § 5 |
| `process-phase` | All open steps in first phase with `count_open > 0` | Phase boundary; per-phase quality if cadence ≠ `end_of_roadmap` |
| `process-full` | Every open step across every phase, in order | Roadmap fully closed (or halt) |

`process-full` runs the per-phase quality pipeline at every phase
boundary when cadence is `per_phase` or `per_step`; on red it halts
before the next phase. Phase-internal `(deferred)` / `(optional)` /
"gated on Phase N" annotations do not stop the run — those are
authoring notes, not halt conditions.
