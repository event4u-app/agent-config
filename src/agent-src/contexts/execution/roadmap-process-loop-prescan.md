# Roadmap-Process Loop — Branches (prescan)

Branch-only body of [`roadmap-process-loop`](roadmap-process-loop.md), moved
out verbatim so the core stays a single read. Each section below is loaded
from the pointer line the core carries at the moved section's place, and only
when a run reaches that branch; the Iron-Law fences stay in the core.

### Context probe — unconditionally, before resolving the roadmap

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

The command name already names the scope; asking "Go / Different
roadmap / …" on every run is noise, so there is no confirmation gate and
no setting to bring one back (the `roadmap.skip_pre_run_gate` key was
retired on 2026-10-09 with its default, `true`, as fixed behavior).

### 3a. Mode derivation ladder — first source wins

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
   inside whatever `cost.budgets` windows are configured — none configured,
   none applies (ADR-279). If yes → **run it**.

   **Unbounded spend is disclosed, never silent.** When `cost.budgets.daily`,
   `weekly` and `monthly` are all `0` (the shipped default), the run's **first
   output line** says so before any paid call: `no spend ceiling configured —
   paid calls in this run are unbounded; set cost.budgets.daily (or weekly /
   monthly) to bound them`. The end summary repeats it with the count of paid
   calls the run made. A consumer who never set a budget learns it from the run,
   not from this file.
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
the label rather than obeying it — recording what it did and why. **A relabel is
an owner-facing event, not run-internal bookkeeping:** the run names every
`Class: 3` it relabelled — the blocker id, the original label verbatim, the new
class and the one-line reason — in a `Relabelled owner blockers` block of the
PR body **and** of its end summary, so the owner sees each one before the
change can merge. A relabel the PR body does not list did not happen; a relabel
of an EXCLUDED action (step 3) is never allowed. Class `0`/`1`
entries carry a `Run:` the agent executes, exactly as before. Class `2`
(consent-once) is pre-cleared for the duration of a `process-full` run when the
consent it wants is one the invocation already gave; a `2` asking for something
the invocation did NOT give (an EXCLUDED action, a spend crossing) still reaches
the owner.

**No citation → work**, and the default direction is unchanged: the failure this
screen must not have is declining work an agent could have done.
