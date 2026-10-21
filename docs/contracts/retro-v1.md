---
stability: beta
keep-beta-until: 2027-01-14
---

# Retro v1 — paths, unit key, targets, caps, triage

> What a retro is, which finished work it examines, and what it may write. Written
> for `road-to-a-retro-the-merge-runs` step 0.3 and **before** any retro code
> exists, so the code is written against this file and not the other way round.
>
> The switch `retro.enabled` and the verb `retro` exist since ADR-292. Start
> values for the triage scores, the daily budget and the catch-up window are
> pre-registered in step 0.5 and calibrated in step 5.3, never tuned silently in
> code.

## The switch

`retro.enabled` — class C, default `true`, cascading from the user-global file.
`false` in the project or the user-global file stops every automatic path: the
merge enqueue, the push-time merge marker, the session pointer and the daily
probe. It never stops an explicit `/retro`, and a manual run never turns an
automatic path back on. CLI, hooks and GUI resolve it through one resolver
(`retroEnabled` in `src/scripts/retro_queue.ts`), which fails closed: a settings
layer the user broke disarms the automatic paths rather than letting the shipped
default speak for it.

## Where the state lives

Everything is local and lives under `<git common dir>/agent-config/`, so every
worktree of a repository shares it and a removed worktree loses nothing:

| Directory | Written by | What it holds |
|---|---|---|
| `retro-queue/` | paths A, B, C | one file per unit; the first enqueue time stands |
| `retro-markers/` | the push-settle hook | one marker per pushed PR until the forge reports it merged or closed |
| `retro-sessions/` | the session-end hook | one pointer per session: state key, tag, branch, workspace, end time |
| `retro-dispositions/` | the sweep, `/retro record` | the triage class of every unit, `analysed` once examined |
| `retro-sweep/` | the sweep | the high-water day, the last sweep's counts, triage timings |
| `retro-ran/` | `/retro record` | the sessions a retro ran in, so no retro examines itself (K5) |

Switching the retro off leaves these files where they are; they are inert
without the automatic paths, and `rm -rf "$(git rev-parse --git-common-dir)"/agent-config/retro-*`
removes them.

## The three paths

| Path | Trigger | What it does |
|---|---|---|
| **A — `/pr:merge`** | `/pr:merge <N>` finished; `/pr:merge all` finished its whole queue | Enqueues the merged PRs as units. Never between two merges of one drain. |
| **B — forge merge** | A push wrote a merge marker with the PR number; the forge later reports `MERGED` or `CLOSED` | The daily probe resolves open markers through the forge reader; `unread` keeps the marker. Covers web-UI merges, automerge and merges by someone else. |
| **C — daily sweep** | The first session of a new local calendar day | Counts the sessions since the last high-water mark, resolves open markers, triages deterministically and writes one queue line. No model, no spawn. Zero candidates writes nothing. |

All three paths fill **one** queue in the git common directory, so two worktrees
on one day produce one sweep and one queue. Hooks and probes only write markers,
count and enqueue; no model ever runs inside a hook. A merge is an event, never
a permission — nothing here reads or writes a merge setting.

**Where paths B and C run.** The daily probe rides the `session_start` slot of
the `session-register` concern, throttled once per workspace and day. It takes
the repository's day claim **before** it lists or reads a single session. A
claim is a file `claim-<day>.<generation>` created exclusively, and it is taken
over only when its holder process has exited — never inside a 60-second lease,
and never from a live holder, however long it is suspended — so one process at a
time mutates the retro stores. A claim of an earlier day with a live holder
blocks the next day too. The one escape is age: past 24 hours a holder's pid is
presumed reused and the claim is taken over, so a crash cannot block every later
sweep. A takeover exclusively creates the next generation, so of two takers one
succeeds, and a sweep that finds it no longer holds the newest generation records
nothing further. A finished sweep gives its claim back. A session start that
loses the claim does no discovery and is not stamped, so it retries later. Every
`gh` and `git` call gets only the time left of the probe's three seconds, and a
session read the deadline cut short is discarded, never triaged; what remains
past the deadline is local file reads of that one session.

## Who does the model work

The queue line is work for the agent, read the way the self-repair queue line
is read — not a notification. The retro runs after the first user task of the
session is finished. The queue line itself grants nothing: whether the agent may
hand the retro to a subagent is decided by the delegation policy that already
governs every dispatch, never by the line. **The first user task is never
deferred for a retro**: a probe that delays the user's own work has spent the one
moment this package is not allowed to spend.

**What leaves the machine.** Nothing a retro writes. The one network read is the
probe's: for each open merge marker it asks GitHub, through the user's own `gh`
login, whether that PR merged — the repository and the PR number, nothing more —
inside a three-second budget for the whole probe. `retro.enabled: false` stops it.

## The unit key

A unit is one piece of finished work, identified locally by

```
{repo, pr | session | analysis-run, merge_sha | tag | round_id, policy}
```

- `repo` — the repository the work happened in.
- `pr` with `merge_sha` for a merged pull request; `session` with its session
  `tag` for a session without one; `analysis-run` with its `round_id` for one
  analysis round (ADR-288), whose facts are read from that round's own
  `run.json`.
- `policy` — the version of this contract's triage policy that classified the
  unit. A new policy version is the only thing besides new evidence that reopens
  a disposition.

### `analysis-run` — what adoption may be read from, and what may not

An analysis round is adopted to the extent the roadmaps it emitted were worked.
That reading is taken **only once a roadmap is archived**: while it is still
active its open steps may yet be done or cancelled, so counting them earlier
would score unfinished work as rejected. An active, parked or stub roadmap
therefore reads `missing`, never `{done: 0}`, and the run-level sum is taken
only when every emitted roadmap is archived.

`run.json` records which roadmaps a run emitted and which analysts ran it, and
nothing that joins the two. Adoption per analyst is consequently always
`not-applicable` with that reason — attributing a roadmap's fate to one analyst
would be a number no record supports. What a run *does* carry per analyst is its
contribution: loops run and top-tier items added, changed and killed.

The key never leaves the machine. It is also the **origin** of every intake
signal a retro writes, because a free-form origin string does not separate
evidence: two hosts in one session must count as one origin, and two PRs on one
host as two.

## Triage — deterministic, never a model

| Class | Meaning |
|---|---|
| `analyse` | Worth a model retro; enters the daily budget, highest score first. |
| `skip:low-signal` | Too small or too smooth to teach anything. |
| `covered` | Already examined — a session whose PR has a retro, or a retro session itself. |
| `expired` | Older than the catch-up window; its inputs may already be gone. |
| `deferred` | Worth a retro, but past today's budget; examined on a later day. |

Signals, all read from local facts and never from a transcript:

- for a PR — CI red-to-green iterations, review threads, repair commits after
  the first push, a later revert, the conflict classes of the drain summary;
- for a session — turns, tool calls, compactions and final context size from
  the session end-of-life state, interruptions from the interruption ledger,
  self-repair records in its time window.

A short session with no friction signal is `skip:low-signal`. A short session
with a user correction or a self-repair record is `analyse`. A field that could
not be read is `missing`, never 0, and a missing field never lowers a score.

**A skip is a durable disposition.** A unit classified `skip:low-signal`,
`covered` or `expired` is not re-triaged on the next sweep; it is re-evaluated
only on new evidence about that unit or on a new `policy` version.

## Targets — a closed vocabulary

Every durable learning routes to exactly one target:

| Target | What is written | Effect |
|---|---|---|
| `intake-signal` | A decaying intake signal with the unit key as origin | Behaviour-neutral until a human promotes a lesson |
| `override-proposal` | A proposal file under `agents/proposals/` | None until a human applies it |
| `contract-no-go-proposal` | A proposal file for a project no-go | None until a human applies it |
| `package-record` | A self-repair record with `target` / `proposes` and the unit key | Local; leaving the machine is another roadmap's question |
| `none` | Nothing, with the reason | — |

Nothing is written into an always-loaded file, a rule or a skill.

A `package-record` carries the candidate's claim in the record's optional claim
fields: `subject` → `principle` (a lowercase slug of at most 80 characters),
`falsifier` → `falsifier` (one line of at most 160). `mechanism` has no
candidate field and stays unset. The record validates these shapes on write and
the privacy floor scans them. The upstream body carries `principle` beside
`target` and the defect class; `mechanism` and `falsifier` are free text and
never leave. The record key reads none of them.

## Caps

- At most **one** durable learning per unit.
- At most **three** intake signals per unit.
- At most **one** package record per run.

## The durability test

A learning is durable only if it is **not derivable from the code, the tests or
the docs, and it would recur without a note**. <!-- harvest:one-durable-lesson-per-retro-run --> A learning readable from the diff
itself is discarded; a trivial typo PR yields `none`. Otherwise the target is
`none` and the reason is stated.

## Evidence threshold

The tree stated the threshold for "is this learning established" in four files,
in three different shapes. Census, read on 2026-10-16:

| Site | What it says |
|---|---|
| `src/skills/upstream-contribute/SKILL.md:73` | learnings must have occurred 2+ times or be clearly generalizable |
| `src/skills/upstream-contribute/SKILL.md:97-103` | an aggregate is admissible from independently operated consumers converging on the same substance, or with a named public mechanism |
| `src/domains/meta/upstream-contribute/command.md:78` | the learning occurred twice or more, or is clearly generalizable |
| `docs/guidelines/agent-infra/self-improvement-pipeline.md:82` | at least 2 independent evidence entries (distinct PRs, issues, or incidents) |
| `src/scripts/learning_sidecar.ts:47` | `MIN_CORROBORATIONS = 2` distinct origins before a lesson is promoted |

The retro uses one table and the sites above are read against it:

| Scope | Evidence threshold |
|---|---|
| **Local** — a lesson for this installation | Two unit keys from **different** PRs or sessions, each carrying its own incident. Two hosts in one unit are one key. |
| **Package** — a change proposed to the shared package | Clustering across independently operated installations by mechanism fingerprint, **or** a named mechanism with a fixture that reproduces it. |

A single retro is evidence #1, never a mandate. "Clearly generalizable" is not a
third route: a generalization without a second unit key or a named mechanism is
a hypothesis, recorded as a signal and nothing more.

## Held or recurred — the effect reading

Every retro that names an asset target reports whether the EARLIER learning on
that target held. Three verdicts, read from record **status** in the self-repair
store:

| Verdict | When | What it means |
|---|---|---|
| `first` | no record names the target | nothing earlier to have held |
| `held` | every record naming it is in a terminal status | the fix landed and the defect has not come back |
| `recurred` | at least one record naming it is active again | it was never closed, or something reopened it |

**The verdict never reads the occurrence count.** Occurrences accumulate across
a record's whole life, so a high count on a closed record says the defect was
frequent *before* the fix, not that the fix failed. Reading volume as recurrence
is the measurement error Phase 5 exists to avoid, and it is stated here because
the count sits beside the verdict in the same object.

**A revert reopens.** A fix the base later reverted is not a fix, so a measured
`later_revert` on the unit puts every `actioned` record naming that target back
to `open` with the reason recorded. This is the one status the retro writes; it
never closes, declines or supersedes a record, and an unmeasured revert fact
reopens nothing — `missing` is not `false`.

## Version history

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-16 | Initial contract, written before any implementation. |
| v1 | 2026-10-17 | Who does the model work: delegated or after the first task, never before it. |
| v1 | 2026-10-17 | Held or recurred: three verdicts read from record status, never from the occurrence count; a measured revert reopens. |
| v1 | 2026-10-20 | The switch (ADR-292) and where the state lives; path A wired into `/pr:merge`; the push-time marker and the session pointer written by their hooks; `/retro` and its forms. |
| v1 | 2026-10-20 | After council review: the queue line grants no delegation, the sweep holds one owner-tokened claim per day with a lease, a stale backlog expires, pointers stay bounded by the window, and the network read is disclosed. The session-start call of the daily probe is not wired yet; the sweep runs by hand through `retro sweep`. |
| v1 | 2026-10-21 | The session-start call wired through `session-register`: the day claim is taken before discovery, a claim is taken over only from an exited holder (or after 24 hours) by exclusively creating the next generation, a finished sweep releases it, and the deadline bounds every process call and discards a cut-short read. |
