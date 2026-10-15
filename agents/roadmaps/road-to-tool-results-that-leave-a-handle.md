---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends:
  - road-to-placeholders-on-the-wire
  - road-to-bytes-the-model-actually-receives
estate_offset_exempt: "Second arrival of one subject (round inbox-2026-10-p; first inbox-2026-09-ab, whose two roadmaps are archived). The one active roadmap that emits a tool-result rewrite, road-to-placeholders-on-the-wire, replaces identifiers for privacy and declares no size reduction and no recoverable store; folding a size class into it would widen a privacy roadmap already carrying three blockers. No stub or later/ entry holds a spool or an output store (a grep for spool, output_store and tool_result_store across agents/roadmaps/ returns nothing). Archiving or parking leaves raw_bytes equal to delivered_bytes by construction with no plan to make them differ."
estate_growth_exempt: "Second of a two-roadmap set from round inbox-2026-10-p; grows active_roadmaps by one and open_blockers by zero. It is a separate file because its arming waits on road-to-placeholders-on-the-wire while its sibling waits on nothing."
relates:
  - slug: road-to-placeholders-on-the-wire
    relation: depends
    note: "Consumes its tool-output probe (0.1), its composition ADR (1.1: one dispatcher stage is the only writer) and its observe-mode stage (1.3). This file adds a size class to that stage; it adds no second writer and no concern that rewrites."
  - slug: road-to-bytes-the-model-actually-receives
    relation: depends
    note: "Consumes its model-visible distribution (1.4) to pick the tool classes worth reducing, and its content key (2.2) for the repeated-Read reference."
---
# Road to tool results that leave a handle

> **Source:** `agents/tmp.old/inbox-2026-10-p/` — the same round as
> `road-to-bytes-the-model-actually-receives`: two transcripts asking that the
> resource-economy plans consumed by round `inbox-2026-09-ab` be implemented in
> full, and naming the output store as the missing foundation for any reduction.
> Tree facts re-read at `main@9a943f30c` on 2026-10-14.

## Goal

A verbose tool result can reach the model shorter than the host produced it
**without losing anything**: the full output stays on this machine under a content
hash, the model receives a summary that keeps every failure line plus a handle that
retrieves the rest, and the census records a `delivered_bytes` smaller than
`raw_bytes` for exactly those results. A second full read of unchanged content can
become a reference to the first. Nothing is reduced by default for consumers;
every reduction is measured against an outcome floor before it is armed.

## Execution status — 2026-10-14, `main@90ed4e697`

A `/roadmap:process-full` pass found no step executable yet and built nothing (D8).

- **Phase 1 waits on the sibling's 1.4.** `road-to-bytes-the-model-actually-receives`
  1.4 has no dated distribution on `main`; 1.1 picks classes from that
  distribution and from nothing else, and 1.2's corpus needs the classes.
- **Phase 2 waits on `road-to-placeholders-on-the-wire` 1.2 and 1.3.** 2.1 writes
  "in the placeholders stage's observe mode" and 2.2 stores "the placeholder view
  of the envelope"; neither the stage nor the view exists. A store with no caller
  would pass 2.1–2.4's unit-test verify lines without showing any of their
  observable behaviour.
- **Unblock events:** sibling 1.4 accepted → run Phase 1. Placeholders 1.1's ADR
  accepted and its 1.2/1.3 landed (stage, observe mode, two views) → build
  Phase 2 through that stage.
- **Contracts to settle before 2.1 is built** (named by the council, not decided
  here): whether the handle is an opaque hash or a path; whether 2.4's range is
  in lines or bytes, and which existing read path serves it; which detector
  confidence (high only, or high and medium) refuses storage in 2.2; how an
  expired handle is told from an unknown one without keeping sensitive metadata
  past retention; concurrent write, read and cleanup.
- **Correction to Risk 4's mitigation:** it says Phases 1 and 2 "need only the
  sibling's Phase 1". Phase 2's own wording needs the placeholders stage too, so
  only Phase 1 is unblocked by the sibling alone.

**Update 2026-10-15.** The sibling's 1.4 landed; 1.1 ran and selected no class
(D6). The large model-visible results here are file-content reads, and the
results with failure lines are small, so the summary this file plans — every
failure line, head, tail, handle — has no class to apply to. 1.2 is deferred,
not cancelled. **Owner question:** continue with a redesign (a criterion stated
before a fresh window is read, possibly a content profile beside the execution
profile — both seats raised it), or close this roadmap on the D6 null. Either is
a scope decision this file cannot take for itself; Phases 2–4 stay as written
until it is answered.

## Context — read at `main@9a943f30c`

| # | Finding | Evidence |
|---|---|---|
| F1 | **Nothing reduces a tool result today, by construction and by test.** `tests/scripts/tool_result_bytes_hook.test.ts:212` pins "nothing in the tree rewrites a tool result"; the recorder writes `delivered_bytes` equal to `raw_bytes` (`src/scripts/hooks/tool_result_bytes_hook.ts:280`). |
| F2 | **The writer this needs is planned, not built.** `road-to-placeholders-on-the-wire` 1.1 makes one dispatcher stage the only writer of a rewrite and 3.1 emits the host's result-replacement field from it; its 0.1 probes what a mismatched replacement does. None of its steps is done. |
| F3 | **No store exists to make a reduction recoverable.** A grep for `spool`, `output_store`, `tool_result_store` and `local_handle` under `src/` returns nothing. Without one, a shortened output can only be recovered by re-running the command, which may be slow, non-deterministic or side-effecting. |
| F4 | **Text results that are large and reducible are mostly Bash.** *(executed)* over 12 local transcripts: Bash 3,127 results, 2.69 M model-visible characters; text Reads 25 results, 0.38 M; Edit/Write already short (59 K for 263). Image Reads dominate the sample — 339 results, 85.2 M characters of encoded image — but an image has no failure-line structure to summarise and is out of scope here (K7). The sibling's 1.4 replaces this sample with a dated distribution. |
| F5 | **The command-output advisory exists and stays advisory.** `rtk_wrap_hook` nudges toward a bounded form and records its fire count (`src/config/hook-token-budget.json:110`); it rewrites nothing. |

## Phase 1 — Choose what is worth reducing, from the distribution

- [x] **1.1 Pick the classes from the sibling's 1.4, not from the source plans.**
      A class enters scope when its model-visible p95 exceeds a stated byte
      threshold (D1) and its results have a failure-line structure the summary can
      keep. The selection, with the figures, goes into this file's `## Decisions`
      as row D6 before any store is built. Any census line it reads goes through
      `src/scripts/_lib/tool_result_census.ts` (`readCensusLine`), so a legacy
      `{bytes}` line counts as envelope bytes with delivered bytes unknown.
      verify: `grep -c '^| D6 ' agents/roadmaps/road-to-tool-results-that-leave-a-handle.md` -> /^1$/
- [~] **1.2 Freeze a golden corpus before any reducer exists.** *Deferred 2026-10-15: D6 selected no class, so there is no class to record twenty outputs for; it waits on the owner question in Execution status.* Twenty recorded
      outputs per selected class, each with its known failure lines and exit code,
      under `tests/fixtures/tool-output-corpus/`. Recall on this corpus is what
      every later phase is held to.
      verify: `ls tests/fixtures/tool-output-corpus | wc -l` -> /^\s*[1-9][0-9]+$/

## Phase 2 — A local store the summary can point into

- [ ] **2.1 Store the full output under its hash.** In the placeholders stage's
      observe mode, a result of a selected class is written to
      `agents/runtime/spool/<sha256>` — gitignored, workspace-local, never
      `agents/tmp/` — before anything is shortened. Writing is idempotent on the
      hash. Case `spool-write-is-content-addressed` asserts equal outputs share one
      file.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t spool-write-is-content-addressed --reporter=verbose` -> /✓.*spool-write-is-content-addressed/
- [ ] **2.2 No credential rests in the store.** The spool receives the
      placeholder view of the envelope, never the execution view, so a value the
      placeholders stage replaces is a token on disk too. With that stage off, a
      result carrying a credential-class match is not stored and is delivered
      unreduced.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t credential-match-is-never-spooled --reporter=verbose` -> /✓.*credential-match-is-never-spooled/
- [ ] **2.3 The store expires.** Entries older than the retention age (D2) are
      removed at `session_start`; the store has a byte cap past which the oldest
      go first. A handle to an expired entry answers "expired", never an empty
      body.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t expired-handle-says-expired --reporter=verbose` -> /✓.*expired-handle-says-expired/
- [ ] **2.4 A handle can be read back.** One existing read path — not a new CLI
      verb — returns a stored output by hash, whole or by line range.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t handle-reads-a-range --reporter=verbose` -> /✓.*handle-reads-a-range/

*Exit: 2.1–2.4 green; nothing is shortened yet, and `delivered_bytes` still equals `raw_bytes`.*

## Phase 3 — Shorten, in observe mode first

- [ ] **3.1 A deterministic summary per selected class.** Exit code, every line
      the class marks as a failure, a head and a tail bounded in bytes, and the
      handle. No model summarises anything. The summary is computed and counted in
      observe mode; nothing is delivered shorter.
      verify: `npx vitest run tests/scripts/tool_output_summary.test.ts -t summary-keeps-every-failure-line --reporter=verbose` -> /✓.*summary-keeps-every-failure-line/
- [ ] **3.2 Hold the floors on the corpus.** Failure-line recall 100 % and exit
      code preserved on all of 1.2's corpus; a result whose summary would not save
      at least the net-win floor (D3) is delivered unchanged.
      verify: `npx vitest run tests/scripts/tool_output_summary.test.ts -t corpus-recall-is-total --reporter=verbose` -> /✓.*corpus-recall-is-total/
- [ ] **3.3 Arm it for this workspace only.** After one release of observe-mode
      readings, the stage delivers the summary for the selected classes in the
      maintainer workspace, and the census line carries `delivered_bytes` from the
      stage's output — the debt the placeholders roadmap's 3.2 names. Only the
      tail of the newest result changes, so no earlier turn and no cache
      breakpoint moves.
      verify: `npx vitest run tests/scripts/tool_result_bytes_hook.test.ts -t reduced-result-records-smaller-delivered --reporter=verbose` -> /✓.*reduced-result-records-smaller-delivered/

## Phase 4 — A second read of unchanged content becomes a reference

- [ ] **4.1 Replace only on a content match.** When the sibling's content key
      (its 2.2) shows a full Read of content already delivered this session, the
      stage delivers a reference to the earlier read and the handle instead of the
      body. A ranged Read, a changed hash, or content above the hash bound is
      delivered unchanged.
      verify: `npx vitest run tests/scripts/reread_guard_hook.test.ts -t unchanged-full-read-becomes-reference --reporter=verbose` -> /✓.*unchanged-full-read-becomes-reference/
- [ ] **4.2 Measure whether the model then re-reads anyway.** Over one release in
      the maintainer workspace, the count of references followed by a full re-read
      of the same path within three turns. A rate above the stated bound (D4)
      disarms 4.1 and records the null.
      verify: `ls agents/evidence/analysis/ | grep -c reread-reference` -> /^[1-9]/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | A class is in scope when its model-visible p95 exceeds 8 KB | the host already caps a Bash result through `BASH_MAX_OUTPUT_LENGTH`, so savings live between the typical and the capped size; 8 KB is a stated default, not a fit | the 1.4 distribution shows no class above it |
| D2 | reversible-technical | agent | Spool retention is 7 days and 500 MB, whichever comes first | the same order as the council runtime retention (`ai_council.session_retention_days` default 7); a handle older than a week is rarely followed | a handle is followed after expiry in the 4.2 readings |
| D3 | reversible-technical | agent | Net-win floor: a summary must be at most half the model-visible bytes of the original, else the original is delivered | below that the handle line and the head/tail eat the saving | the observe-mode readings show most results land just above the floor |
| D4 | reversible-technical | agent | A reference rate followed by a full re-read above 30 % disarms 4.1 | a reference the model does not trust costs a turn and saves nothing | the rate sits near the bound |
| D6 | reversible-technical | council:tool-results-d6-selection-2026-10-15 (2/2 present, both seats chose this) | The selection is empty: no class meets D1 and the failure-line condition of 1.1 together. Bash has the structure but its p95 is 6,282 B, under 8 KB; text Read (p95 42,029 B) and image Read (p95 621,520 B, K7) are above it with no exit code or failure line; Edit and Write are K3; every other class has p95 at most 2,784 B. D1 is not revised to admit Bash: a threshold lowered, a tail-mass criterion, or Bash cut into command families after reading these figures would be a fit, and the families above 8 KB are file-content reads (`sed`, `cat`, `git diff`). D1's revisit-if did not fire as written (two classes are above 8 KB) — it should have read "no eligible class" | `agents/evidence/analysis/model-visible-bytes-2026-10-14.md` (83,031 results); `report_reducible_classes` on 2026-10-15 reads `selected: none` and the census through `readCensusLine` (142,709 legacy lines, 71,700 two-field, 0 unreadable, delivered unknown on 143,462). Supplementary, not part of the dated distribution: 2,599 Bash results above 8,192 B carry 37.4 MB (36.7 % of Bash bytes), and 13 of them carry `is_error` or an `Exit code` line | the owner answers how this roadmap continues (see Execution status), or a fresh window under a criterion stated before it is read selects a class |
| D7 | reversible-technical | agent | Verify lines of 3.3 and 4.1 name test titles the step itself creates; each is seen red before its implementation (closure listing C1, C2) | `closure_scan` lists a name filter with no matching title today because the titles do not exist yet | a step closes with its filter still matching no title |
| D8 | reversible-technical | council:tool-results-handle-scope-2026-10-14 (2/2 present, both seats chose this) | Phase 2's store is not built ahead of its caller; every step stays open until its dependency lands. Rejected: a standalone store module flipping 2.3/2.4 (a callerless store cannot show the integrated behaviour 2.1–2.4 describe, and it fixes handle, range and expiry contracts before the stage exists); spooling from the byte-recorder hook today (a writer outside the single stage, storing unselected classes) | `road-to-bytes-the-model-actually-receives` 1.4 and `road-to-placeholders-on-the-wire` 1.2/1.3 are unchecked on `main@90ed4e697` | either dependency lands, or the placeholders 1.1 ADR freezes the stage interface before the stage is built |
| D5 | reversible-technical | agent | No consumer default is set here; arming stops at the maintainer workspace | a consumer-facing default for result rewriting is already an owner blocker in `road-to-placeholders-on-the-wire` (`default-mode-for-consumers`); a second one would split one decision | that blocker is answered |

## What this roadmap deliberately does not do

- **K1** Add a second writer of a rewrite — the single stage of `road-to-placeholders-on-the-wire` 1.1 is the only one.
- **K2** Summarise with a model — a second upload to save the first.
- **K3** Reduce Edit or Write results — the model already receives a short confirmation (sibling F1).
- **K4** Shorten anything for a consumer by default (D5).
- **K5** Store anything under `agents/tmp/`, or any credential value anywhere.
- **K6** Claim a reduction percentage anywhere; the census delta is the record.
- **K7** Reduce or re-encode images. Screenshots are evidence for UI work; whether their size is a lever is a question for the sibling's 1.4 figures, not a step here.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A summary drops the line the agent needed | product | A reducer keeps the failures it was written for and loses an unanticipated one; the agent works from a wrong picture and does not know to open the handle. | The frozen corpus of 1.2 with 100 % recall (3.2), observe mode before arming (3.1, 3.3), and the handle line on every shortened result. | Phase 3 — Shorten, in observe mode first |
| 2 | The spool becomes a second copy of sensitive output | implementation | Full command output can carry tokens, customer data or paths; a persistent store multiplies where it rests. | Placeholder view only (2.2), refusal to store a credential match when that stage is off, a retention age and a byte cap (2.3). | Phase 2 — A local store the summary can point into |
| 3 | The host drops a replacement silently | implementation | A replacement whose shape the host rejects leaves the full result delivered while the census records it shortened. | The placeholders roadmap's 3.3 checks shape before emitting and counts a drop; this file records `delivered_bytes` from the stage only when that check passed. | Phase 3 — Shorten, in observe mode first |
| 4 | The dependency never lands | product | Both roadmaps this depends on are open; this file can sit ready with nothing executable. | Phases 1 and 2 need only the sibling's Phase 1 and run in observe mode; arming (3.3, 4.1) is the part that waits. | Phase 1 — Choose what is worth reducing, from the distribution |

## Acceptance Criteria

- [ ] AC-1 — In the maintainer workspace, a result of a selected class reaches the
      model shorter than the host produced it, its census line shows
      `delivered_bytes` below `raw_bytes`, and the full output is retrievable by
      its handle until it expires.
- [ ] AC-2 — On the frozen corpus every failure line and every exit code survives
      the summary.
- [ ] AC-3 — No credential value rests in the store, and no consumer install
      shortens a result without a setting a person chose.
- [ ] AC-4 — A full re-read of unchanged content is delivered as a reference only
      while the measured follow-up re-read rate stays under its bound, or the null
      is on record.
