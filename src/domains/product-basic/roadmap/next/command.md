---
model_tier: medium
name: roadmap-next
pack: product-basic
tier: 2
visibility: internal
cluster: roadmap
sub: next
skills: [roadmap-management, agent-docs-writing, ai-council, subagent-orchestration, worktree-lifecycle, git-workflow]
description: Pick the next executable roadmap and carry it to a reviewable PR — live remote screen, five-disqualifier feasibility pass, council on the pick, process-full, chunked commits, PR, CI fix.
argument-hint: "[--worktree] [roadmap]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:next

Selection + delivery scope of the [`/roadmap`](../roadmap.md) cluster.
The three `process-*` subs take a roadmap **as given** and vary the
scope inside it. `/roadmap:next` varies the **selection**: it screens
what is actually executable right now, picks one, pins the scope to
`full`, and carries the run to a PR that is ready for review.

One invocation = one roadmap = one branch = one PR.

## Instructions

### 1. Live remote screen — before any selection reasoning

Selection reads live state, never memory, a dashboard count, or an
earlier fetch (per [`direct-answers`](../../rules/direct-answers.md)
Iron Law 2 and [`roadmap-process-loop § 1`](../../contexts/execution/roadmap-process-loop.md#1-resolve-roadmap)).
Run as ONE block:

```bash
git fetch origin --prune
git ls-tree --name-only origin/main agents/roadmaps/          # still active?
git ls-tree --name-only origin/main agents/roadmaps/archive/   # already closed?
gh pr list --state open --json number,title,headRefName        # in flight?
```

Excluded from the candidate set: `template.md`, `archive/`,
`skipped/`, `later/`, anything with `status: draft` whose promotion
trigger has not fired, and any roadmap whose slug matches an **open
PR's** branch — that one is taken.

A roadmap completes by an archive move **inside its merging PR**, so a
local checkout can show a closed roadmap as open. That is why this step
precedes the screen instead of following it.

### 2. Screen the survivors — five disqualifiers

For each candidate read its frontmatter, its open-step count, and every
`### blocker:` section. Disqualify on:

1. **A blocker whose resolution is a human ACTION** — install a secret,
   click a repo setting, recruit a participant, approve spend, let a
   date pass. Apply the action-vs-judgement split: a blocker that is a
   **judgement call** (which option, whether to reopen a recorded
   decision, is the evidence sufficient) is **not** a disqualifier — it
   is council-resolvable in step 3.
2. **Spend** — paid bench or API runs, an npm publish, a public release.
3. **A date that must pass.**
4. **A kernel-rule edit** — [`scope-control`](../../rules/scope-control.md)
   demands its own PR plus a ≥24 h soak, so it cannot close in this run
   (kernel list: [`kernel-membership`](../../../docs/contracts/kernel-membership.md)).
5. **Phases gated on a spike verdict** that may return FINDING.

Also check the **family concurrency cap** (`lint_roadmap_family_cap`) —
adding a third `road-to-<family>-*` roadmap without archiving one reds
CI.

Partial disqualification is normal and does **not** drop a candidate:
record which phases the blocker actually blocks. A roadmap whose blocker
touches one deferred step still has a full working set.

Delegate the per-candidate reads to parallel subagents when more than
three candidates survive step 1 (per
[`delegation-policy`](../../rules/delegation-policy.md)); each returns
`{slug, open_steps, blockers[], disqualifiers[], blocked_phases[]}` and
nothing else.

### 3. Rank, then let the council settle a genuine tie

```
RANK BY DEFECT SEVERITY, NEVER BY PERCENT-DONE OR STEP COUNT.
A ROADMAP THAT REPAIRS A LIVE, USER-VISIBLE WRONGNESS OUTRANKS
ONE THAT MOVES MORE CHECKBOXES. PICKING BY CHECKBOX COUNT IS THE
GOODHART MOVE THIS PACKAGE'S OWN DISCIPLINE FORBIDS.
```

- **Exactly one survivor, or one that dominates** → take it, state the
  one-line reason inline, proceed. Do not ask
  ([`no-cheap-questions`](../../rules/no-cheap-questions.md)).
- **Two or more with a real trade-off** → put the pick to the AI
  council with the constraint set stated (survivors, open-step counts,
  blocked phases, severity read) per
  [`ai-council`](../../skills/ai-council/SKILL.md). Check the council's
  decisive premise against the tree before adopting it — twice recorded,
  the load-bearing claim was falsifiable in-repo.
- **Zero survivors** → emit the screen table (candidate · open steps ·
  disqualifier) and stop. Suggest
  [`/roadmap:create`](create.md) or a blocker the user can clear. Do
  not manufacture a pick.

### 4. Workspace — branch by default, worktree on request

Default: a feature branch in the current checkout, named
`feat/<roadmap-slug>` per [`commit-conventions`](../../rules/commit-conventions.md).
Propose the name once and proceed; no naming menu.

`--worktree` — or the user saying "in a worktree" — routes through
[`/worktree:create`](../../worktree/create.md) in full, including its
[seeding allow/deny list](../../../skills/using-git-worktrees/SKILL.md#4b-seed-the-worktree--allow--deny-list).
Two entries decide whether the run's gate results mean anything:
dependencies are symlinked or installed **fully**, and
`.agent-settings.yml` is **never** copied — absent IS the CI shape.

### 5. Run it

Hand off to [`/roadmap:process-full`](process-full.md) and follow it
verbatim, including its Iron Law — full is full, and its five halt
conditions are the only stops. The execution contract from
[`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md)
is derived once; the user's single Accept covers branch, chunked
commits, push to that branch, and the PR.

### 6. Deliver

Chunked commits (the agent picks the split — never ask how, per
[`commit-policy`](../../rules/commit-policy.md)), then
[`/create-pr`](../../git/pr/create.md): archival sweep, preflight,
push, PR opened **ready for review** (not draft).

### 7. CI — fix locally, honour the push gate

Follow [`/create-pr` § 4d](../../git/pr/create.md): wait for the
verdict in the background, never end the turn on "CI is running",
diagnose and fix in the working tree on red, within the N=3 budget per
[`autonomous-execution`](../../rules/autonomous-execution.md).

```
THE LOCAL FIX IS AUTONOMOUS. THE RE-PUSH IS NOT.
git push IS A HARD-FLOOR TRIGGER AND THE FLOOR REFUSES A STANDING
DIRECTIVE BY CONSTRUCTION. FIX, VERIFY, THEN SAY WHAT IS READY.
NEVER INVENT A PER-PR "STANDING MANDATE" WORKAROUND.
```

The cheapest CI-fix loop is the one that never fires: run `task
preflight` before the first push, which runs the same
`skill_linter --changed` gate CI does.

### 8. Report

Roadmap picked + the screen result that picked it · steps closed /
total · commits · PR URL as the literal last line (per
[`direct-answers`](../../rules/direct-answers.md) reply-close) · CI
verdict · anything left open with its reason.

## Iron Law — screened, never guessed

```
NEVER PICK A ROADMAP FROM MEMORY, A DASHBOARD COUNT, OR AN EARLIER SESSION.
THE THREE LIVE CHECKS RUN FIRST, EVERY INVOCATION.
A ROADMAP CLAIMED "IN FLIGHT", "MERGED", OR "DONE" WITHOUT A LIVE CHECK
AT THE MOMENT OF THE CLAIM IS AN UNVERIFIED CLAIM.
```

## Rules

- **One roadmap per invocation.** Never chain a second pick after the
  first closes — the user re-invokes.
- **The screen is reported, not just used.** State which candidates were
  disqualified and on what, so the pick is auditable.
- **A judgement-call blocker goes to the council, not to the user.**
  A human-ACTION blocker goes to neither — it disqualifies.
- **No merge, ever.** The PR is opened for review; merging is
  conversational ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)).
- All rules from [`/roadmap:process-full`](process-full.md#rules) apply
  unchanged to the execution half.

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/roadmap:process-full`](process-full.md) — the execution half this wraps
- [`/roadmap:ai-council`](ai-council.md) — challenge a roadmap before running it
- [`/worktree:create`](../../worktree/create.md) — the `--worktree` path
- [`/create-pr`](../../git/pr/create.md) — delivery + the CI wait contract
- [`roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md) — canonical mechanics
