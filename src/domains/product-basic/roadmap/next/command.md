---
model_tier: medium
name: roadmap-next
pack: product-basic
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
Run ONE command:

```bash
agent-config roadmap:context
```

The four hand-written reads this block used to carry — the pruning fetch, the
active and archived roadmap listings, the open-PR listing, and the session
register — are now one probe
([`roadmap_context.ts`](../../../../scripts/roadmap_context.ts)), so all five
`/roadmap:*` entry points screen the same way instead of one command file
screening well and four not screening at all.

Both session axes are still in the report and for the same reason: the live
records AND the unmerged branches checked out in other worktrees. The branch
axis is the one that does not need a peer to have claimed anything, and it is
the half that cannot be silent.

The probe never refuses. With no network, no `gh`, or no authentication it
prints `scanned: 0 PRs (network unavailable)` and exits 0 — a probe that failed
closed would make the call site conditional, which is the failure this
extraction removes.

Excluded from the candidate set: `template.md`, `archive/`,
`skipped/`, `later/`, anything with `status: draft` whose promotion
trigger has not fired, and:

| Exclusion | Source | What it means | Recovery |
|---|---|---|---|
| **taken by an open PR** | `gh pr list` — a roadmap slug matching an open PR's branch | The work is done or nearly done and is waiting on review | Review or merge that PR; the roadmap archives inside it |
| **claimed by a live session** | `sessions:list` — a live record whose `roadmap_slug` matches | Another session is working on it *right now*, before any PR exists | Nothing to do — it releases on that session's end, or by TTL |
| **held by a foreign worktree** | `sessions:list` — an unmerged branch in another worktree whose name names this roadmap | A peer is already writing code, whether or not it ever claimed | Pick something else; a branch on disk outranks an unwritten claim |

Keep the three distinguishable in the reported screen. They are different
states with different recovery, and collapsing them into "unavailable"
loses the only information that tells the user whether to wait for a
review or simply pick something else.

```
A DIFFERENT BRANCH NAME DOES NOT MAKE IT A DIFFERENT TASK.
MEASURED TWICE: TWO SESSIONS BUILT ONE ROADMAP PHASE UNDER
`feat/dispatch-safety-confirmation` AND `feat/dispatch-safety-confirmed-execution`,
AND ONE OF THE TWO PRs WAS THROWN AWAY. COMPARE THE ROADMAP, NEVER THE BRANCH.
```

A slug in the register that names **no open roadmap** is not a claim — it is a
stale field left behind after that roadmap archived. `sessions:list` labels it
`← STALE`; read it as "nobody claimed anything", never as "taken".

A roadmap completes by an archive move **inside its merging PR**, so a
local checkout can show a closed roadmap as open. That is why this step
precedes the screen instead of following it.

The session read closes a window the PR check cannot. Measured over the 14
most recent merged feature PRs, the gap between a branch's first commit and
its PR is a median of **18.5 minutes** and a maximum of **67** — and that is a
*lower bound*, since the clock starts at roadmap selection, strictly earlier
than the first commit. For that whole interval the PR check reports the
roadmap as free. Measurement:
`agents/evidence/analysis/parallel-session-register-phase1.md`.

```
THE REGISTER *WRITE* IS HOOK-CARRIED AND DETERMINISTIC.
THIS *READ* IS NOT. THE TWO MUST NOT LOOK ALIKE.
```

This screen runs because the model read this instruction — there is no gate
that fires it, and none that notices when it is skipped. It is a
model-carried obligation in exactly the shape the `enforced_by: none` rules
declare, and it is stated here rather than left as prose that reads like a
guarantee. What IS deterministic: the heartbeat that writes the register, the
TTL expiry, and `sessions:list` itself once invoked.

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

### 3b. Claim the pick, so the next session's screen sees it

```bash
agent-config sessions:claim <roadmap-slug> [--paths src/a.ts,src/b.ts]
```

`--paths` publishes the run's owned-path set — the same set the § 2 screen
derived — into the session record as `owned_paths`. It is what turns the third
collision axis on: without it a peer editing the same file under a different
roadmap and a different branch name is invisible on every axis, which is the
shape of the two duplications the branch axis already failed to catch. Declaring
nothing degrades to today's behaviour exactly, and the field is absent rather
than empty in the record.

Immediately after the pick, before any branch or commit. This writes the slug
into `agents/runtime/state/roadmap-claim-<session>.json`; the next heartbeat lifts
it into this session's register record, so another session's step 1 excludes it
**within one turn** and long before a PR exists.

The file is keyed on the host session id, not on the worktree, and that
distinction was a measured defect rather than a nicety: with one shared file per
checkout, four live records once carried one identical slug — naming an
already-archived roadmap — because every session in that checkout read the last
claim written there. A session that inherits a peer's claim reports work it is
not doing, and the peer whose claim was overwritten reports none. On a host that
exports no session id the legacy shared path is still written and still read, and
`sessions:claim` says so on that path rather than implying a guarantee it cannot
give.

**The claim is also what makes the duplicate-work warning possible.** Without it
the register can only compare branch names, and two sessions on one roadmap
routinely pick two different names — so a skipped claim does not merely delay
visibility, it removes the only axis that sees the expensive collision.

Routing the claim through a state file rather than having this command write the
register directly is deliberate: the roadmap is picked mid-session by the model,
a hook is a script and cannot know what was picked, and this way the model never
needs to know the register's path or format. The cost is that the claim lands at
most one turn late.

Same honesty boundary as the screen above: **this write is model-carried.** The
verb is deterministic once invoked, and nothing forces the invocation. A skipped
claim degrades to today's behaviour — the PR check still catches the roadmap once
a PR exists — so the failure mode is a re-opened window, not a wrong result.

`agent-config sessions:claim --release` drops the claim if the run is abandoned
before the session ends; otherwise `session_end` clears the whole record.

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

This step is where the run **ends**, not a step it may stop before — see the
second Iron Law below. The invocation already authorised the push and the PR;
asking for them again is the re-ask
[`no-cheap-questions`](../../rules/no-cheap-questions.md) § IL 5 forbids.

### 7. CI — fix locally, honour the push gate

Follow [`/create-pr` § 4d](../../git/pr/create.md): wait for the
verdict in the background, never end the turn on "CI is running",
diagnose and fix in the working tree on red, within the N=3 budget per
[`autonomous-execution`](../../rules/autonomous-execution.md).

```
THE LOCAL FIX IS AUTONOMOUS. A RE-PUSH ON THE AGENT'S OWN AUTHORITY IS NOT.
BUT AN INSTRUCTION WHOSE DELIVERABLE IS A REMOTE STATE — "FIX THE CI",
"RESOLVE THE CONFLICT WITH MAIN", "UPDATE THE PR" — NAMES THE PUSH, AND
DELIVERING IT IS NOT A SECOND OPERATION TO ASK ABOUT.
NEVER INVENT A PER-PR "STANDING MANDATE" FOR A PUSH NOBODY ASKED FOR.
AND NEVER CALL A CI FIX DONE OFF A LOCAL RUN — RE-VERIFY ON THE PUSHED HEAD.
```

The full reading, its decidable test, and what it deliberately does **not**
cover live in [`/create-pr` § 4d items 5–6](../../git/pr/create/command.md);
this is the pointer, not a second copy.

Measured on this command's own run, 2026-08-17: a `/roadmap:next` invocation
raised a separate push ask **three times** — after a CI fix, after a
cross-reference fix, and after resolving a merge conflict the user had asked
for by name. Each ask cost a turn and returned the same answer, and the third
was for a conflict whose entire existence is a remote fact. That is the friction
this clause removes; the floor it keeps is the *unnamed* push.

**Before every push to the open PR**, bring the branch up to its base with
`./scripts-run src/scripts/sync_pr_branch` and regenerate afterwards. Measured on
this run: the base moved three times, the push was rejected twice for it, and the
PR reached `CONFLICTING` in between. Verify the result afterwards with
`./scripts-run src/scripts/check_pr_ci_current` — a green local gate says nothing
about a fix that was never pushed, and a green CI run on an earlier commit says
nothing about the current one.

The cheapest CI-fix loop is the one that never fires: run `task
preflight` before the first push, which runs the same
`skill_linter --changed` gate CI does. Two gates it does NOT reach are
`check_references` and `check_r2_manifest`, both remote-only — measured on this
run, each forced one extra commit and therefore one extra review re-bind.

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

## Iron Law — the run ends at a PR, never at an offer to open one

```
STEP 6 IS AN END CONDITION, NOT A STEP THE RUN MAY STOP BEFORE REACHING.
A RUN THAT PRODUCED COMMITS ENDS WITH A PR OPENED FOR REVIEW.
THE INVOCATION IS THE ACCEPT — IT COVERS THE BRANCH, THE CHUNKED COMMITS,
THE FIRST PUSH TO THAT BRANCH, AND THE PR. NEVER RE-ASK FOR THEM.
"SAY THE WORD AND I'LL OPEN IT" IS A PROMISSORY CLOSE, WHICH
verify-before-complete ALREADY FORBIDS. SO IS ENDING ON COMMITTED-BUT-UNPUSHED
WORK WITHOUT NAMING IT.
STOPPING EARLIER IS LEGAL ONLY AS ONE OF process-full's FIVE NAMED HALTS,
A HARD-FLOOR TRIGGER, OR AN N=3 EXHAUSTION — AND THE HALT IS NAMED IN THE
REPORT TOGETHER WITH WHAT IS STILL UNPUSHED.
```

**What this does NOT lift.** § 7's re-push restriction stands unchanged: the
invocation covers the *first* push that opens the PR, never the pushes that
follow a CI fix. Those are Hard-Floor triggers needing the user's word that turn
([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)), and
no reading of this law manufactures a per-PR standing mandate.

**Why it needed saying, measured on this command's own run.** A session screened
30 roadmaps, recovered from a live claim collision, picked, branched and did the
work — then closed with a status report and no PR, because § 6 read as a step in
a list rather than as the condition the run terminates on. The user had to ask
for the PR the invocation had already authorised. A step that can be narrated
instead of executed is not an obligation; an end condition is.

**Honest scope.** `enforced_by: none` — nothing inspects a chat turn for a
missing PR, so this is model-carried like the live screen above it. The
deterministic half is elsewhere and unchanged: `/create-pr` runs the archival
sweep and preflight, and CI gates the branch once the PR exists.

## Rules

- **One roadmap per invocation.** Never chain a second pick after the
  first closes — the user re-invokes.
- **The screen is reported, not just used.** State which candidates were
  disqualified and on what, so the pick is auditable — and keep
  "taken by open PR" and "claimed by a live session" distinguishable.
- **A live foreign claim is not a merge conflict to resolve.** It excludes the
  roadmap from *this* pick and nothing more. Never override it, and never treat
  the register as a lock: it is advisory, two sessions can claim in the same
  millisecond, and an idle session disappears from it although its user returns
  ([`parallel-sessions`](../../../../docs/guides/parallel-sessions.md)).
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
- [`parallel-sessions`](../../../../docs/guides/parallel-sessions.md) — what the session register does, its TTLs, and the two limits it does not hide
