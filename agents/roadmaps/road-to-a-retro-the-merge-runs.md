---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-o found at 2bc5715c7 that no merge moment, session end or daily point feeds the learning loop that already exists: /pr:merge writes a per-PR summary nothing reads (src/domains/git/pr/merge/command.md:527-548), the session-end aggregation is class B default false (settings.ts:445), and the learning dogfood protocol can never mint a lesson. No active, later, stub or archived roadmap owns a retro, a merge-triggered learning step or a daily sweep (grep over agents/roadmaps for retro, push-settle, daily sweep). Archiving or parking costs more because the owner asked for this behaviour on by default on 2026-10-12; merging into road-to-learning-you-can-see-carried would wake a parked file whose class B key this plan deliberately leaves untouched."
estate_growth_exempt: "open_blockers 74 -> 76, measured by check_estate_count at this change: one blocker here (retro-transcript-excerpts-by-default) and one in road-to-one-upstream-that-checks-what-leaves (upstream-pr-shows-the-account). Each records an owner-reserved privacy decision this round could not close - lowering the per-call transcript opt-in, and accepting that an upstream pull request reveals the opening account - and each blocks only the steps that need the answer."
relates:
  - slug: road-to-one-upstream-that-checks-what-leaves
    relation: extends
    note: "Added in the same change. Owns everything that leaves the machine; Phase 4 here produces package records it may later offer, and never sends one itself."
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "Decides how a package-wide proposal lands (ADR-281). This file produces proposals and never promotes one."
  - slug: road-to-learning-you-can-see-carried
    relation: disjoint
    note: "later/. `memory.learn_on_session_end` stays class B with default false; the retro aggregates the sidecar itself (D6). That file's step 2.4 (the GUI key reaching the hook) names the settings-file question Phase 0 here answers for `retro.enabled`."
  - slug: road-to-placeholders-on-the-wire
    relation: disjoint
    note: "Session excerpts handed to a model are provider-bound bytes; its placeholder rules apply once they exist."
  - slug: road-to-adversarial-verification-and-long-runs
    relation: disjoint
    note: "later/. Carries the open owner question on `allow_auto_merge`; path B here detects a forge merge whatever that answer is."
  - slug: road-to-surface-consolidation
    relation: extends
    note: "later/. Lists the `/memory` table; a new `/retro` entry is mentioned there when Phase 2 lands."
---
# Road to a retro the merge runs

> **Source:** `agents/tmp.old/inbox-2026-10-o/` — one transcript and five
> supplied plans from two parallel sessions, pinned at `main@d760ecb`; every
> reading below was re-taken at `main@2bc5715c7` on 2026-10-12. The two commits
> since the pin touch none of the cited source files.
>
> **Owner directives, 2026-10-12 (binding, from the transcript):** (a) after a PR
> is merged — by automerge or by hand — a retro runs automatically, and it can be
> started manually; (b) it improves the local setup; (c) the sessions of the
> previous day are examined the next day, as their own path and as the backup when
> a merge retro did not run; (d) small sessions not worth analysing are skipped;
> (e) **on by default**, switchable off by a setting. A neutral pull request
> against this package is owned by `road-to-one-upstream-that-checks-what-leaves`.

## Goal

After every merged pull request, and on the first session of every new day, the
package examines finished work that is worth examining — chosen by a
deterministic triage, never by a model — draws **at most one** durable learning
per unit, routes it to exactly one target, makes it effective locally without
changing behaviour, and offers anything behaviour-changing as a proposal. Whether
a learning held is read from the recurrence count that already exists. With
`retro.enabled: false` none of this runs except an explicit `/retro`.

## Prerequisites

- The learning loop this feeds already exists and is reused, not re-planned:

| Building block | Evidence | Role here |
|---|---|---|
| Learning sidecar (decay, ≥ 2 origins, dead-end ledger) as a library | `src/scripts/learning_sidecar.ts:6-8`, `:47` | Aggregated by the retro itself (4.2) |
| Self-repair record (statuses, timestamps, `target`) and recurrence count per target | `src/scripts/_lib/self_repair.ts:67`, `:92-122`; `self_repair_store.ts:343-371` | Package findings; effect check |
| PR resolution after push | `src/scripts/hooks/push_settle_hook.ts:39-43`, `:159-170` | Writes the merge marker (path B) |
| Per-session end-of-life counters (turns, final context size, compactions) | `src/scripts/_lib/session_eol.ts:59-74` | Triage facts that survive chat-history pruning |
| Interruption ledger with session tag | `src/scripts/hooks/interruption_ledger_hook.ts:59`, `:68` | Friction signal |
| Daily probe throttle on the local calendar day | `src/scripts/hooks/probe_throttle.ts:1-24` | Trigger "first session of a new day" |
| Git common dir as the cross-worktree store | `src/scripts/_lib/session_register.ts:5-19` | Queue location |
| Class C setting with default `on` by documented decision | `docs/contracts/settings-classes.md:285-295` (`continuity.auto_record`) | Shape of "on by default, switchable" |
| Forge reader that reports `unread` on any failure | `src/scripts/_lib/forge_reader.ts:51-74` | Merge verification |
| Drain summary per PR | `src/domains/git/pr/merge/command.md:527-548` | Fact source |

## Context — read at `main@2bc5715c7`

| # | Defect or trap | Evidence |
|---|---|---|
| F1 | **No merge moment triggers learning.** `/pr:merge` § 9 writes a summary with conflict classes and CI iterations per PR that nothing reads (`src/domains/git/pr/merge/command.md:527-548`; no code reader). For a forge merge (`delivery.merge: on-green`, `src/scripts/_lib/settings.ts:162-164`) no session exists at merge time. |
| F2 | **The learning loop has no regular producer.** Aggregation is class B, default `false` (`settings.ts:445`; `settings-classes.md:161`); the loop's own dogfood protocol reads three hand-seeded signals from one origin against `MIN_CORROBORATIONS = 2` (`learning_sidecar.ts:47`), so a lesson can never be minted. |
| F3 | **"Origin" is not an evidence key.** It is a free string with symbolic values such as `agent` or `claude` (`src/scripts/_lib/memory_signal.ts:229`, `:272`): two hosts in one session give two origins, two PRs on one host give one. |
| F4 | **Chat history keeps the last five sessions.** `DEFAULT_MAX_SESSIONS = 5` (`src/scripts/chat_history.ts:54`), pruned on every new session (`:1367-1376`). A next-day sweep reading transcripts loses sessions after an active day, and the first session of the day prunes before it. |
| F5 | **"On by default" fits no retro-ready class without a decision.** Class B requires a conservative default and the build breaks otherwise (`settings-classes.md:106-118`); class C with a documented decision is the one shape (`:285-295`). |
| F6 | **A user-global `retro.enabled: false` would be discarded.** Only keys on `MERGEABLE_KEYS` cascade from the user-global file (`src/scripts/_lib/agent_settings.ts:268`, filtered at `:951`); adding a key requires an ADR. *(executed)* `agent-config settings:get continuity.auto_record` warns that a user-global value "is being discarded". |
| F7 | **The sweep's inputs live per worktree.** Session end-of-life files are written under the workspace (`session_eol.ts:224`), the interruption ledger likewise (`interruption_ledger_hook.ts:68`). A queue in the git common dir dedupes runs, but sessions that ran only in a worktree stay invisible to a sweep in the main checkout and vanish when the worktree is removed. *(executed)* 367 files in the main checkout, 2 and 1 in two worktrees. |
| F8 | **Session state lives seven days.** The janitor removes `agents/runtime/state/session-eol` after `ttlDays: 7` (`src/scripts/janitor.ts:77-78`); a catch-up window must stay below that. |
| F9 | **No verb.** `retro` is not in `src/config/discovery/command-verbs.yml`; a new visible verb needs an ADR addendum (`docs/decisions/ADR-041-controlled-command-verbs.md:75`). |
| T1 | **Git `post-merge` is not a PR merge.** This repository installs that hook for itself (`install-hooks.sh:522`, `:614`), and `/pr:merge` triggers it on a base sync that performs a merge (`command.md:137-151`); consumers do not get it. |
| T2 | **A timed background agent is a published refusal.** The council refused unattended relaunch with a falsifiable reopen condition (`src/scripts/_lib/headless_invocation.ts:9-58`); a sweep at a fixed hour would be that capability. The sweep runs in the first session of the day instead. |

## Phase 0 — Contract, settings shape, pre-registration (no product code)

- [x] **0.1 File the directive.** The five owner directives above, verbatim with
      their date, under `agents/evidence/owner-directives/`.
      verify: `ls agents/evidence/owner-directives/` -> /2026-10-12-retro/
      *Done 2026-10-16: `2026-10-12-retro-inbox-2026-10-o.md`.*
- [ ] **0.2 One ADR for the setting and the verb (D1, D2, D3).** It adds
      `retro.enabled` as class C with default `true` to
      `docs/contracts/settings-classes.md` after the `continuity.auto_record`
      pattern, adds it to `MERGEABLE_KEYS` so a user-global `false` holds
      (F6), and adds `retro` to `command-verbs.yml` as the ADR-041 § 5 addendum.
      The governance diff carries its council ratification artefact.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> /0 finding/
- [x] **0.3 The contract.** `docs/contracts/retro-v1.md`: the three paths, one
      local-only unit key `{repo, pr|session, merge_sha|tag, policy}`, the closed
      target vocabulary (`intake-signal`, `override-proposal`,
      `contract-no-go-proposal`, `package-record`, `none`), caps (≤ 1 durable
      learning and ≤ 3 intake signals per unit, ≤ 1 package record per run), the
      durability test ("not derivable from code, tests or docs, and it would
      recur without a note") <!-- harvest:one-durable-lesson-per-retro-run -->, the triage classes (`analyse | skip:low-signal |
      covered | expired | deferred`) and their signals. A skip is a durable
      disposition, re-evaluated only on new evidence or a new policy version.
      verify: `grep -c 'skip:low-signal' docs/contracts/retro-v1.md` -> /[1-9]/
      *Done 2026-10-16: key and verb wait for 0.2.*
- [x] **0.4 One evidence threshold.** A census of the four sites that state a
      threshold for the same question (`src/skills/upstream-contribute/SKILL.md:47`,
      `:71`; `src/domains/meta/upstream-contribute/command.md:60`;
      `docs/guidelines/agent-infra/self-improvement-pipeline.md:78`;
      `learning_sidecar.ts:47`) and one canonical table in the contract (D4).
      verify: `grep -c 'Evidence threshold' docs/contracts/retro-v1.md` -> /[1-9]/
      *Done 2026-10-16: census re-read at current lines.*
- [x] **0.5 Pre-registration.** Before any code: triage start values with a
      weighted scoring table as a hypothesis, the daily model-retro budget (D7),
      the catch-up window (D8), a labelled gold set of the last 30 merged PRs and
      30 sessions (hand-labelled "worth a retro / not") for false-negative
      recall, and the Phase 5 measures. Filed under `agents/evidence/`.
      verify: `ls agents/evidence/analysis/` -> /retro-preregistration/
      *Done 2026-10-17: `retro-preregistration.md`. Labelled by the agent that
      wrote the scores, labels first; an independent relabel before 5.2 is
      recommended there.*

*Exit: directive filed, ADR merged with ratification, contract and
pre-registration in place, settings lint green with the new key.*

## Phase 1 — Facts first (deterministic, no model)

- [x] **1.1 Facts for a PR.** `retro_facts --pr <N>` reads the drain summary
      line, CI runs and red-to-green iterations, review threads, repair commits
      and a later revert, via `forge_reader`. Every field is
      `measured | missing | not-applicable`; never 0 for missing.
      verify: `npx vitest run tests/scripts/retro_facts.test.ts -t pr-facts-never-invent-a-number --reporter=verbose` -> /✓.*pr-facts-never-invent-a-number/
      *Done 2026-10-17: `src/scripts/retro_facts.ts --pr <N>`. A later revert
      matches the merge SHA only; in-PR reverts count separately. More runs than
      one page read as `missing`, not as a short count.*
- [x] **1.2 Facts for a session.** The same for a session tag: end-of-life
      counters, interruptions, self-repair records in its time window, its
      branch and PR when known.
      verify: `npx vitest run tests/scripts/retro_facts.test.ts -t session-facts-join-on-tag --reporter=verbose` -> /✓.*session-facts-join-on-tag/
      *Done 2026-10-17: `--session <id>` or `--tag <tag>`. End-of-life state is
      keyed by a hash of the id, so a tag alone reports it `missing`. Branch
      stays `missing`: nothing in the tree records a session's branch; the PR is
      not joined either until a queue pointer (1.3) carries it.*
- [ ] **1.3 Worktree sessions are not lost (F7).** The fact reader enumerates
      every worktree of the repository (`git worktree list`) and reads its
      session state; the session-end hook additionally appends a one-line
      pointer to the git-common-dir queue, so a removed worktree leaves its unit
      behind.
      verify: `npx vitest run tests/scripts/retro_facts.test.ts -t worktree-session-is-seen-from-main --reporter=verbose` -> /✓.*worktree-session-is-seen-from-main/
      *Open 2026-10-17: the reader half is built and its test is green. The
      session-end hook half stays open: it changes a hook consumers receive
      (owner-reserved) and writes into the queue of 3.1, which does not exist
      yet.*
- [x] **1.4 Review and transcript text is data.** It passes the existing
      injection scan before any model sees it; an instruction to the agent inside
      a review comment appears as a quoted datum and changes no routing.
      verify: `npx vitest run tests/scripts/retro_facts.test.ts -t review-instruction-is-data --reporter=verbose` -> /✓.*review-instruction-is-data/
      *Done 2026-10-17: review comments and bodies are quoted (500 chars) with
      the scanner's verdict; no transcript is read (D12).*

## Phase 2 — `/retro` by hand

- [x] **2.1 Composition.** Facts → one synthesis step → at most one durable
      learning per unit, passing the durability test, else `none` with its
      reason. A trivial typo PR yields `none`; a learning readable from the diff
      itself is discarded.
      verify: `npx vitest run tests/scripts/retro.test.ts -t trivial-pr-yields-none --reporter=verbose` -> /✓.*trivial-pr-yields-none/
      *Done 2026-10-17: `src/scripts/retro.ts` — triage from the pre-registered
      start values, the durability test on the synthesis's candidate, `none`
      with its reason. The synthesis itself stays the agent's.*
- [x] **2.2 Exactly one target.** The learning routes to one target from the
      closed vocabulary; the intake origin is the local unit key (F3), so two PRs
      with one learning mint a lesson and two hosts in one PR do not.
      verify: `npx vitest run tests/scripts/retro.test.ts -t two-prs-mint-two-hosts-do-not --reporter=verbose` -> /✓.*two-prs-mint-two-hosts-do-not/
      *Done 2026-10-17: `unitKey` is the signal origin; a target outside the
      closed vocabulary throws.*
- [x] **2.3 The output per unit.** Facts, learning, target, counter-hypothesis,
      falsifier, and the recurrence state of earlier learnings with the same
      target.
      verify: `npx vitest run tests/scripts/retro.test.ts -t output-carries-falsifier --reporter=verbose` -> /✓.*output-carries-falsifier/
      *Done 2026-10-17: recurrence is the per-target record count; the
      held/recurred reading is 5.1.*
- [ ] **2.4 The forms.** `/retro`, `/retro <N>`, `/retro --session [<tag>]`,
      `/retro --since <date>`, `/retro status`, `--dry-run`. A manual run never
      re-enables the automatic paths.
      verify: `npx vitest run tests/scripts/retro.test.ts -t manual-run-does-not-reenable --reporter=verbose` -> /✓.*manual-run-does-not-reenable/
- [ ] **2.5 `/retro status`.** Shows the queue and the last sweep's triage
      counts: analysed, skipped by reason, covered, deferred, expired.
      verify: `npx vitest run tests/scripts/retro.test.ts -t status-shows-skip-reasons --reporter=verbose` -> /✓.*status-shows-skip-reasons/
      *2.4 and 2.5 open 2026-10-17: both are the visible `/retro` command,
      which needs the verb from 0.2's ADR and is a new consumer command
      (owner-reserved). The library they call exists.*

## Phase 3 — Three paths, one queue

- [x] **3.1 The queue.** In the git common dir via `_lib/git_common_dir.ts`, one
      file per unit, written atomically; two worktrees on one day produce one
      sweep and one queue.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t two-worktrees-one-queue --reporter=verbose` -> /✓.*two-worktrees-one-queue/
      *Done 2026-10-17: `src/scripts/retro_queue.ts`; an existing entry is
      never rewritten, so the first enqueue time stands. No path writes to it
      yet — 3.2-3.4.*
- [ ] **3.2 Path A — `/pr:merge`.** After `/pr:merge <N>` immediately; after
      `/pr:merge all` once, after the queue ends — never between two merges of a
      drain. `/roadmap:process-full --merge` inherits it.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t drain-of-three-enqueues-once --reporter=verbose` -> /✓.*drain-of-three-enqueues-once/
- [ ] **3.3 Path B — forge merges.** `push-settle` writes a marker with the PR
      number at push time; the daily probe checks each open marker through the
      forge reader for `MERGED` / `CLOSED`. A merge through the web UI, by
      automerge or by someone else is picked up; `unread` keeps the marker.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t web-merge-is-picked-up --reporter=verbose` -> /✓.*web-merge-is-picked-up/
- [ ] **3.4 Path C — the daily sweep.** A probe throttled by `probe_throttle` to
      the first session of a new local day counts the sessions since the last
      high-water mark from the session state, checks open merge markers, triages
      deterministically and writes one `<retro-queue>` line — no model, no spawn
      (K1, K7). With zero candidates it writes nothing.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t zero-candidates-is-silent --reporter=verbose` -> /✓.*zero-candidates-is-silent/
- [x] **3.5 Who does the model work.** The agent treats the queue line as work
      after the pattern of the self-repair queue — delegated to a subagent where
      the host can, otherwise after the first user task; the first user task is
      never deferred for it.
      verify: `grep -c 'never deferred' docs/contracts/retro-v1.md` -> /[1-9]/
      *Done 2026-10-17: contract § Who does the model work; the line it reads
      arrives with 3.4.*
- [x] **3.6 Dedupe and window.** The sweep skips sessions whose PR already has a
      retro (`covered`) and retro sessions themselves; catch-up reaches back at
      most the window from D8, older units count as `expired`. Day boundaries use
      the local IANA zone; a DST switch neither drops nor doubles a day.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t dst-switch-neither-drops-nor-doubles --reporter=verbose` -> /✓.*dst-switch-neither-drops-nor-doubles/
      *Done 2026-10-17: `sweepDays` and `classifyUnit` on calendar dates, so a
      23- or 25-hour day is one day. The sweep that calls them is 3.4.*
- [ ] **3.7 The switch.** `retro.enabled: false` — project or user-global — turns
      off all three paths and the probe; the value survives a restart and an
      upgrade; CLI, hook and GUI resolve it through one resolver; an agent cannot
      set it.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t disabled-globally-means-no-probe --reporter=verbose` -> /✓.*disabled-globally-means-no-probe/
      *3.2, 3.3, 3.4 and 3.7 open 2026-10-17: 3.2 edits `/pr:merge`, a merge
      carrier; 3.3 and 3.4 change hooks consumers receive and switch on an
      automatic path (owner-reserved); 3.7 needs the key from 0.2's ADR.*

## Phase 4 — Local effect without automatic promotion

- [ ] **4.1 Intake signals carry the unit key** as their origin and are written
      without a question (gitignored, decaying, behaviour-neutral until a human
      promotes them).
      verify: `npx vitest run tests/scripts/retro.test.ts -t intake-origin-is-unit-key --reporter=verbose` -> /✓.*intake-origin-is-unit-key/
- [ ] **4.2 The retro aggregates the sidecar itself** at the end of each run
      through the library function, independent of
      `memory.learn_on_session_end` (D6).
      verify: `npx vitest run tests/scripts/retro.test.ts -t retro-aggregates-sidecar --reporter=verbose` -> /✓.*retro-aggregates-sidecar/
- [ ] **4.3 Proposals as files.** Override, test and project no-go proposals land
      under `agents/proposals/`; `/memory:propose` lists retro learnings with
      their unit keys. Promotion stays human.
      verify: `npx vitest run tests/scripts/retro.test.ts -t override-is-a-proposal-file --reporter=verbose` -> /✓.*override-is-a-proposal-file/
- [ ] **4.4 Package findings become self-repair records** with
      `target`/`proposes` and the retro's unit key; whether one leaves the
      machine is `road-to-one-upstream-that-checks-what-leaves`'s question.
      verify: `npx vitest run tests/scripts/retro.test.ts -t package-finding-is-a-record --reporter=verbose` -> /✓.*package-finding-is-a-record/

## Phase 5 — Effect, not volume

- [ ] **5.1 Held or recurred.** Every retro reports "held / recurred" for earlier
      learnings of the same target, from `targetCounts`; a revert of a landed fix
      reopens its record.
      verify: `npx vitest run tests/scripts/retro.test.ts -t revert-reopens-record --reporter=verbose` -> /✓.*revert-reopens-record/
- [ ] **5.2 Thirty days of dogfood in this repository.** With the triage's own
      denominators: units seen, analysed, skipped by reason, `none` share, landed
      learnings, recurrence after landing per comparable exposure, time and token
      cost, discovery latency per path, and recall against the gold set from 0.5.
      A counterfactual line compares merge-only, sweep-only and both. An honest
      null is allowed; recurrence counts are not read as causation.
      verify: `ls agents/evidence/analysis/` -> /retro-dogfood/
- [ ] **5.3 Calibration.** Triage thresholds and the daily budget are reset from
      the measurements as a documented contract revision.
      verify: `grep -c 'revision' docs/contracts/retro-v1.md` -> /[1-9]/
- [ ] **5.4 Stop conditions.** A backlog above the pre-registered value pauses
      the sweep and keeps `/retro`; triage p50 above 2 s in the probe is reported
      by `/retro status`.
      verify: `npx vitest run tests/scripts/retro_queue.test.ts -t backlog-pauses-sweep-not-manual --reporter=verbose` -> /✓.*backlog-pauses-sweep-not-manual/

## Blockers

### blocker: retro-transcript-excerpts-by-default
- **Status:** resolved — owner chose (b) on 2026-10-12; recorded as D12
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 1.2 reads session facts only; transcript excerpts for a triaged session are added to 1.2 only after this resolves — no other step is blocked
- **Question:** May the default-on retro read local transcript excerpts around friction events, which `/memory:mine-session` today reads only on a per-call opt-in?
- **Recommendation:** (b). The directive asked for a retro on by default, not for transcript reading; the session facts survive pruning (F4) and carry the friction signals, and the per-call opt-in is a recorded privacy floor that only the owner may lower.
- **If you do nothing:** the retro runs on facts only; a learning that needs the user's wording is drawn from `/retro --session` after an explicit opt-in, and every analysed unit says `transcript: not read`.
- **What to do:** pick exactly one — (a) excerpts by default: add a class C key `retro.transcripts: excerpts | off` with default `excerpts`, local-only, around friction events only, to the ADR in step 0.2; or (b) facts by default: no new key, excerpts only through the existing per-call opt-in of `src/domains/meta/memory/mine-session/command.md:51`; or (c) no transcript reading at all in the retro, opt-in included.
- **Resolved when:** step 0.2's ADR records the chosen option and this entry's Status reads resolved. Resolved 2026-10-12: option (b).

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | owner | `retro.enabled` defaults to `true` | Directive (e), 2026-10-12 | the 30-day dogfood shows net cost with no landed learning |
| D2 | reversible-technical | agent | One visible key, `retro.enabled`, class C; budgets, window and thresholds are contract constants, not settings | The owner asked for one switch; each extra class C key is a GUI surface and a governance row | a user needs a value the contract fixes |
| D3 | reversible-technical | agent | The verb is `retro`, added by ADR-041 addendum; no new upstream verb | The owner named it; ADR-041 § 5 is the route | a host already reserves `retro` |
| D4 | reversible-technical | agent | Canonical threshold: local — two unit keys from different PRs or sessions, each with its own incident; package — clustering across independent installations by mechanism fingerprint, or a named mechanism with a fixture | Reconciles the four sites of 0.4; a single retro is evidence #1, never a mandate | the dogfood shows lessons never minting |
| D5 | reversible-technical | agent | The merge is an event, never a permission; nothing here touches `allow_auto_merge` or a merge setting | `check_no_automerge_key.ts:59`; ADR-282 owns automerge | — |
| D6 | reversible-technical | agent | The retro aggregates the sidecar itself; `memory.learn_on_session_end` stays class B default false, untouched | Keeps the 2026-07-27 council decision on that key intact | that key is promoted |
| D7 | reversible-technical | agent | Daily model-retro budget: start at 3 units, highest score first, rest `deferred`; no money ceiling by default | ADR-279; the budget bounds tokens, not spend | 5.2 shows deferrals piling up |
| D8 | deterministic | evidence | Catch-up window: 5 days | Must stay below the 7-day session-state TTL (`janitor.ts:77-78`) with a margin for a long weekend | the janitor TTL changes |
| D9 | reversible-technical | agent | Local behaviour changes are proposals; nothing is applied automatically beyond intake signals | ADR-281 keeps the kill on automatic promotion; the directive's "improve the local setup" is met by intake signals plus proposals | the dogfood shows proposals never read |
| D10 | reversible-technical | agent | No timed background agent; the sweep runs in the first session of a new day | T2; reopening needs its own council and owner decision | 5.2 shows the first-session moment is too late or too disruptive |
| D12 | product-owned | owner | Facts by default: the retro reads no transcript; excerpts only through the existing per-call opt-in of `/memory:mine-session`; no `retro.transcripts` key | Owner answer 2026-10-12 to blocker `retro-transcript-excerpts-by-default`, option (b) | 5.2 shows learnings that facts alone cannot draw |
| D11 | reversible-technical | agent | The daily sweep runs where this package is installed, on by default; no separate consumer pilot gates it | Directive (e) names no pilot; the triage, budget and switch bound the cost | a consumer reports cost before 5.2 lands |

## What this roadmap deliberately does not do

- **K1** No model in a hook; the session-end concern has a 2 s budget
  (`memory_learn_hook.ts:61`). Hooks and probes write markers, count and enqueue.
- **K2** No automatic write to `CLAUDE.md`, `AGENTS.md`, rules or skills (ADR-281).
- **K3** No retro between two merges of a drain queue.
- **K4** No new skill; the retro composes the fact reader,
  `learning-to-rule-or-skill`, the self-repair store and the sidecar.
- **K5** No sweep that analyses itself or a retro session.
- **K6** No unbounded catch-up (D8).
- **K7** No timed background agent (D10).
- **K8** No class B key with a permissive default (F5).
- **K9** No event taxonomy or outcome enum beside the self-repair statuses, and no
  action receipt — the forge's merge state is the receipt.
- **K10** No OS scheduler, daemon or consumer GitHub workflow template for now;
  the workflow template is reconsidered after 5.2.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | On by default spends tokens unnoticed | product | Every installation pays for model retros nobody reads. | Deterministic triage, daily budget, silence on zero candidates, `/retro status`, one off switch. | Phase 3 — Three paths, one queue |
| 2 | The first session of a day becomes slow | product | The probe or the model work delays the user's first task. | Probe without a model; model work delegated or after the first task (3.5). | Phase 3 — Three paths, one queue |
| 3 | Noise drowns the learning loop | product | Many weak learnings accumulate unread. | Caps, durability test, `skip:low-signal`, decay, effect measured not volume. | Phase 5 — Effect, not volume |
| 4 | Poisoning through review or transcript text | implementation | A planted instruction in a review shapes a learning. | Injection scan, data-not-instruction, human promotion (1.4, K2). | Phase 1 — Facts first (deterministic, no model) |
| 5 | Sessions lost before the sweep | implementation | Pruned chat history or a removed worktree hides a session. | Facts from per-turn state; worktree enumeration and a queue pointer (1.3). | Phase 1 — Facts first (deterministic, no model) |

## Acceptance Criteria

- [ ] **AC-1** A merged PR — by `/pr:merge`, in the web UI or by automerge —
      yields exactly one queue unit, and a drain of three yields one retro run.
- [ ] **AC-2** The first session of a new local day sweeps the previous days'
      sessions up to the window, including worktree-only sessions, and writes
      nothing when there are no candidates.
- [ ] **AC-3** A short session without a friction signal is `skip:low-signal`,
      counted and visible in `/retro status`; a short session with a user
      correction is analysed.
- [ ] **AC-4** No unit yields more than one durable learning, and no learning is
      written into an always-loaded file.
- [ ] **AC-5** `retro.enabled: false` in the project or the user-global file
      stops every automatic path across restart and upgrade; `/retro` still runs
      on request.
- [ ] **AC-6** Recall against the pre-registered gold set and the counterfactual
      comparison are reported in the dogfood evidence.

## Notes — how this file was derived

Two sessions each ran three loops, then consolidated twice. The latest
tree-pinned plan (master v2) is the base; it was not self-contained — its
defects, kills and fixtures pointed at an earlier version not in the source set
— so each item was re-derived here from the tree. Folded in from the parallel
plans: the IANA/DST semantics, one resolver for the switch with an upgrade test,
a skip as a durable disposition, a scoring table as a pre-registered hypothesis,
a gold set for false-negative recall, silence on zero candidates, the
counterfactual comparison, a triage latency budget. Found in this round and in no
supplied plan: the user-global switch would be discarded (F6), sweep inputs are
per worktree (F7), and the catch-up window was pointed at the wrong retention
(F8). Declined: a ten-value outcome enum and an action receipt (K9), an OS
scheduler (K10), a separate consumer pilot (D11), and four visible keys (D2).
The upstream half moved to its own file because it waits on the detector table of
`road-to-one-detector-and-the-senders-we-own` and this half does not.
