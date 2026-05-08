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
- `app/Modules/*/agents/roadmaps/*.md` (module-scoped)

**Exclude** `template.md`, `archive/`, and `skipped/`.

- User named one (path, partial name, title) → use it.
- None named, single active roadmap (`count_open > 0`) → use it.
- None named, multiple active → default = **most recently modified**;
  surface alternatives in the pre-run summary.
- None active → tell the user; suggest [`/roadmap:create`](../../commands/roadmap/create.md).

## 2. Pre-run summary — single confirmation gate

Before the loop runs, show the resolved config in the user's language:

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

Skip the gate when scope, roadmap, and council are all unambiguous in
the invocation (e.g. `/roadmap:process-phase road-to-X.md with council`).

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

## 4. Resolve quality cadence

Read `roadmap.quality_cadence` from `.agent-settings.yml` once:

| Value | Pipeline runs |
|---|---|
| `end_of_roadmap` (default) | Once, before archival (§ 6) |
| `per_phase` | At every phase boundary + § 6 |
| `per_step` | After every step + § 6 |

Missing / unreadable / unknown → fall back to `end_of_roadmap`.
The Iron Law [`verify-before-complete`](../../rules/verify-before-complete.md)
still mandates fresh quality output before any "complete" claim.

## 5. Step loop

For each open step in the working set (scope-bound — see wrapper):

1. Read the step description and inline notes.
2. Analyze the codebase for what the step requires.
3. Decide and act — implement. **No "should I implement this?" prompt.**
4. **Open question handling:**
   - **Council on** → invoke per [`ai-council`](../../skills/ai-council/SKILL.md),
     integrate convergence, proceed. Token spend was opted in.
   - **Council off** → halt, surface once, wait. Resume on next turn.
5. Mark the checkbox: `[x]` done · `[~]` partial · `[-]` skipped.
6. Regenerate the dashboard — `./agent-config roadmap:progress` — in
   the **same response** per [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md).
7. Run quality pipeline if cadence is `per_step`.

### Halt conditions

- Hard-Floor trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md))
- Security-sensitive path ([`security-sensitive-stop`](../../rules/security-sensitive-stop.md))
- Step reveals work outside the roadmap's scope
- Test failure or quality red on `per_step`
- Council off + true ambiguity

On halt: stop, surface state, do **not** auto-fix outside the failing step.

### Non-halt — horizon markers, gating notes, "optional" tags

Authoring annotations, never halt conditions. Do **not** stop execution
when the roadmap text contains:

- `Horizon (N-week visible plate)` section headers
- `(out-of-horizon, gated on Phase N)` phase-header suffixes
- `(deferred)` / `(later)` / `(optional)` tags on a step
- "Gate: Phase 1 ships and …" prose inside an out-of-horizon phase

`process-step` and `process-phase` honor scope by stopping at their
configured boundary anyway. `process-full` is **defined by** ignoring
these markers — see [`/roadmap:process-full § Iron Law`](../../commands/roadmap/process-full.md#iron-law--full-is-full).

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
| `process-full` | Every open step across every phase, in order — **horizon markers do not narrow this set** | Roadmap fully closed (or halt) |

`process-full` runs the per-phase quality pipeline at every phase
boundary when cadence is `per_phase` or `per_step`; on red it halts
before the next phase. It does **not** stop at horizon markers,
"out-of-horizon" labels, or "gated on Phase N" notes — those are
archival annotations, not halt conditions.
