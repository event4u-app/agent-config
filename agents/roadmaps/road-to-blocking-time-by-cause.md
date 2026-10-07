---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The nearest owners are archive/road-to-agent-turnaround (built the probe and the baseline) and archive/road-to-turnaround-followups (batching, authorization, paths); both are archived and closed, and reopening an archived roadmap for a new axis would make its closed acceptance criteria read open again. No active or parked roadmap owns the blocking-share regression, which release finding ee95ff4aca5f names as having no owner. Adds no gate and moves no baseline."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the blocking-share regression and the context-floor rise have no owner anywhere in the estate."
relates:
  - slug: road-to-agent-turnaround
    relation: extends
    note: "Archived. Built probe_turnaround and src/config/turnaround-budget.json; this adds a cause axis to its blocking tail and leaves its baseline as registered."
  - slug: road-to-turnaround-followups
    relation: disjoint
    note: "Archived. Its batching, authorization and paths work is not reopened here."
---
# Road to blocking time by cause

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main`
> @ `a75bb3210` on 2026-10-06. Class: external review corpus.

## Goal

The turnaround probe says, for every tool call that blocked for more than 60
seconds, what it was waiting on — and how many blocking minutes each cause
holds, with the unclassified share always printed. One reading over a fresh
window confirms or refutes the hypothesis the last reading named and could not
test. The two largest causes get a target written before a mitigation lands,
one mitigation each, and a re-read. The context-floor rise is attributed to
what grew. No baseline is moved.

## Context

- `agents/evidence/analysis/turnaround-reading-2026-10-01.md`, the four
  figures (`:47-52`): blocking share **0.6202 → 0.8908**, first-call context
  floor max **230,705 → 244,518**, calls per request **27.37** (reported only),
  mean batch size **1.01 → 1.11**. Gate verdict: exit 1 on blocking share and
  context floor (`:54`).
- Blocking share (`:95-104`): "252 calls over 60 seconds account for 1,266 of
  1,422 minutes of tool time", the baseline "deliberately not re-based", and
  one mechanism named "as a hypothesis rather than a finding": parallel
  worktree drain runs waiting on CI settles and subagent returns.
- Context floor (`:105-110`): also deliberately not re-based; no attribution.
- `src/scripts/probe_turnaround.ts` reports only the aggregate tail —
  "the >60 s blocking tail and its share of tool time" (`:21`). It pairs each
  `tool_use` timestamp with its `tool_result` (`:169-172`, `:199-202`) and
  keeps only the durations (`:216-231`); the tool name and input that would
  say what a call waited on are read and dropped. There is no test file for the
  probe under `tests/scripts/`.
- The baseline and its directions live in `src/config/turnaround-budget.json`
  (`blocking_share: 0.6202`, direction DOWN; `context_floor_max: 230705`,
  direction DOWN). Its `_comment` keeps the probe out of CI because a fresh
  checkout has no transcript store.
- Release finding `ee95ff4aca5f`
  (`agents/evidence/release-findings/16.3.0.json:158`): both regressions stand,
  the hypothesis is "explicitly unverified", and "no owner or follow-up
  roadmap is named for either regression". It has no disposition.
- The nearest prior owners are archived:
  `agents/roadmaps/archive/road-to-agent-turnaround.md` and
  `agents/roadmaps/archive/road-to-turnaround-followups.md`.

## Phase 1 — Every blocking call has a cause

- [x] **1.1 A classifier over a fixture transcript.** `probe_turnaround` keeps,
      for each call over `BLOCKING_SECONDS`, its tool name and a bounded
      summary of its input, and assigns exactly one cause from a closed set:
      `ci-wait`, `subagent-wait`, `test`, `build`, `network`, `sleep-poll`,
      `mcp`, `unknown`. The rules are a table keyed on tool name and, for a
      shell call, on the command's leading words. A fixture JSONL with one
      call per cause and one unmatched call asserts each assignment; the test
      is seen red before the classifier exists.
      verify: `npx vitest run tests/scripts/probe_turnaround_causes.test.ts` -> 0
- [x] **1.2 Minutes per cause, unknown always printed.** The text and `--json`
      outputs print blocking calls and minutes per cause beside the existing
      tail line, and the `unknown` row is printed even at zero. The existing
      four figures and the `--against-baseline` exit code are byte-identical
      for the same corpus.
      verify: `npx vitest run tests/scripts/probe_turnaround_causes.test.ts` -> 0

## Phase 2 — The hypothesis meets a reading

- [ ] **2.1 One reading, published.** Run the probe over a ten-session window
      and write the per-cause table, the command, the window's shape and the
      unknown share to
      `agents/evidence/analysis/turnaround-blocking-by-cause-2026-10.md`,
      carrying `<!-- evidence-type: analysis -->`. The page states whether
      `ci-wait` plus `subagent-wait` hold the majority of blocking minutes —
      confirmed or refuted, not "consistent with".
      verify: `grep -c 'evidence-type: analysis' agents/evidence/analysis/turnaround-blocking-by-cause-2026-10.md` -> /^1$/
- [ ] **2.2 The unknown share bounds the claim.** If `unknown` holds more
      blocking minutes than the largest named cause, the page says the reading
      is inconclusive, 1.1's table gains rows for what the unknown calls were,
      and 2.1 is re-run before Phase 3 starts.
      verify: `grep -c -i 'unknown share' agents/evidence/analysis/turnaround-blocking-by-cause-2026-10.md` -> /^[1-9]/

## Phase 3 — Targets first, then one mitigation per cause

- [ ] **3.1 Pre-register targets for the top two causes.** One claim in
      `docs/CLAIMS.md` names the two causes with the most blocking minutes in
      2.1, the minutes each held, the target for each over a window of the
      same shape, and what counts as a miss. Then
      `./scripts-run src/scripts/build_proof` runs in the same change.
      verify: `grep -c '^### claim: turnaround-blocking-by-cause-targets' docs/CLAIMS.md` -> /^1$/
- [ ] **3.2 One mitigation for the first cause.** The change that addresses the
      largest cause lands with its own test, and its commit names the claim id.
      verify: `npx vitest run tests/scripts/probe_turnaround_causes.test.ts` -> 0
- [ ] **3.3 One mitigation for the second cause.** Same shape as 3.2.
      verify: `npx vitest run tests/scripts/probe_turnaround_causes.test.ts` -> 0
- [ ] **3.4 Re-read against the targets.** A second window is read and the
      result is appended to the 2.1 page as met, missed, or underpowered —
      underpowered when the window holds fewer blocking calls than 2.1 did.
      verify: `grep -c -E 'met|missed|underpowered' agents/evidence/analysis/turnaround-blocking-by-cause-2026-10.md` -> /^[1-9]/

## Phase 4 — The context floor, attributed; the finding, disposed

- [ ] **4.1 What grew the floor.** The page gains a section listing, for the
      first call of the session that set the 244,518 maximum, the contributors
      to its input context and their size against a session near the 230,705
      baseline, from the same store. `src/config/turnaround-budget.json` is not
      edited.
      verify: `git diff --exit-code a75bb3210 -- src/config/turnaround-budget.json` -> 0
- [ ] **4.2 Dispose of `ee95ff4aca5f`.** The finding's `status` and
      `rationale` fields in `agents/evidence/release-findings/16.3.0.json` —
      the shape the ledger already uses for a disposition — name this roadmap,
      the 2.1 page and the claim id.
      verify: `grep -c 'road-to-blocking-time-by-cause' agents/evidence/release-findings/16.3.0.json` -> /^[1-9]/

## What this roadmap deliberately does not do

- No new gate. The probe stays local-only for the reason its budget file gives.
- No re-basing. `blocking_share` and `context_floor_max` keep their registered
  values; 4.1 asserts the file is untouched.
- No adopted external target. A reviewer of this round asked for a blocking
  share below 30 %; that number is recorded here as an external target and is
  not adopted. 3.1 sets its own targets from 2.1's reading.
- No attribution of the 1.01 → 1.11 batch movement; that reading already
  declined it.

## Acceptance Criteria

- [ ] AC-1 — `probe_turnaround` prints blocking minutes per cause, including
      `unknown`, and its four existing figures are unchanged for a fixed corpus.
- [ ] AC-2 — A published page states whether CI and subagent waits hold the
      majority of blocking minutes in one window.
- [ ] AC-3 — Targets for the top two causes are dated in `docs/CLAIMS.md`
      before either mitigation lands, and a re-read reports each as met,
      missed or underpowered.
- [ ] AC-4 — The context-floor rise has a named list of contributors, and
      `src/config/turnaround-budget.json` is unchanged.
- [ ] AC-5 — Release finding `ee95ff4aca5f` carries a disposition.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Classify by tool name and leading command words, one cause per call | The probe already reads each `tool_use` block (`probe_turnaround.ts:199-202`) | `unknown` stays above the largest named cause after 2.2 |
| D2 | reversible-technical | agent | Unknown is a printed row, never folded into another | A share hidden inside a named cause would confirm whatever hypothesis it was folded into | — |
| D3 | contested-technical | evidence | No re-basing; attribution instead | The 2026-10-01 reading declined both directions on one local window (`:95-110`) | Two windows of the same shape agree on a new level |
| D4 | reversible-technical | agent | The reviewer's 30 % figure is recorded, not adopted | No reading supports it; targets come from 2.1 | 2.1 shows 30 % is within one mitigation's reach |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The window is an mtime window and moves | implementation | Two readings may cover different kinds of session, so a per-cause delta can be a corpus change. | 2.1 and 3.4 record the window's shape; 3.4 reports underpowered rather than a verdict when the shape differs. | Phase 3 — Targets first, then one mitigation per cause |
| 2 | Command-prefix rules misclassify | implementation | A shell call that waits on CI through a wrapper reads as `unknown` or `build`. | 1.1's fixture pins each rule; 2.2 reopens the table when `unknown` dominates. | Phase 1 — Every blocking call has a cause |
| 3 | Bounded input summaries carry private paths | implementation | Command text in a published page can name local paths or hosts. | The page publishes cause counts and minutes only; the input summary stays in the probe's in-memory record. | Phase 2 — The hypothesis meets a reading |
| 4 | A mitigation trades wall-clock for something worse | product | Shorter blocking time from skipping a CI wait could ship unverified work. | 3.1 names what counts as a miss; a mitigation that removes a verification step is out of scope. | Phase 3 — Targets first, then one mitigation per cause |
