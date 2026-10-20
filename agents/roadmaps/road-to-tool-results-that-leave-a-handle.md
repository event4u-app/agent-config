---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends:
  - road-to-placeholders-on-the-wire
estate_offset_exempt: "Second arrival of one subject (round inbox-2026-10-p; first inbox-2026-09-ab, whose two roadmaps are archived). The one active roadmap that emits a tool-result rewrite, road-to-placeholders-on-the-wire, replaces identifiers for privacy and declares no size reduction and no recoverable store; folding a size class into it would widen a privacy roadmap already carrying three blockers. No stub or later/ entry holds a spool or an output store (a grep for spool, output_store and tool_result_store across agents/roadmaps/ returns nothing). Archiving or parking leaves raw_bytes equal to delivered_bytes by construction with no plan to make them differ."
estate_growth_exempt: "Grows open_blockers by one: `tool-output-store-refused-until-activation-is-gated`, which records a council refusal that ALREADY HAPPENED (2/2, anthropic + openai, 2026-10-20) and was until now visible nowhere in the tree. The ratchet exists to stop the estate accreting unplanned work; this entry adds no work, it makes an existing block findable, and the alternative is a refusal that only the run which received it knows about. CORRECTED here rather than appended to: the prior claim read \"grows active_roadmaps by one and open_blockers by zero\", which was true when it was written and is now false, and leaving it beside a contradicting count would make the next reader distrust both. Its substance survives \u2014 this file is the second of a two-roadmap set from round inbox-2026-10-p, separate because its arming waits on road-to-placeholders-on-the-wire while its sibling waits on nothing \u2014 and active_roadmaps is unchanged at 15 by this diff."
relates:
  - slug: road-to-placeholders-on-the-wire
    relation: depends
    note: "Consumes its tool-output probe (0.1), its composition ADR (1.1: one dispatcher stage is the only writer) and its observe-mode stage (1.3). This file adds a size class to that stage; it adds no second writer and no concern that rewrites."
  - slug: road-to-bytes-the-model-actually-receives
    relation: extends
    note: "Archived, every step closed, 1.4 included. Consumes its model-visible distribution (1.4) to pick the tool classes worth reducing, and its content key (2.2) for the repeated-Read reference."
---
# Road to tool results that leave a handle

> **Source:** `agents/tmp.old/inbox-2026-10-p/` — the same round as
> `road-to-bytes-the-model-actually-receives`: two transcripts asking that the
> resource-economy plans consumed by round `inbox-2026-09-ab` be implemented in
> full, and naming the output store as the missing foundation for any reduction.
> Tree facts re-read at `main@9a943f30c` on 2026-10-14.

## Goal

A large tool result can reach the model shorter than the host produced it
**without losing anything**: the bytes the model would have received stay on this
machine under a content hash, the model receives a deterministic stand-in plus a
handle that returns those bytes, and the census records a `delivered_bytes`
smaller than `raw_bytes` for exactly those results. Two profiles share one store
and one writer: an **execution** profile for command output (exit code, failure
lines) and a **content** profile for file-content reads (path, range, digest).
Nothing is reduced by default for consumers; every reduction is measured against
an outcome floor before it is armed.

## Execution status — redesign 2026-10-15

**History.** A `/roadmap:process-full` pass on 2026-10-14 (`main@90ed4e697`) found
nothing executable and built nothing (D8). On 2026-10-15 the sibling's 1.4 landed
and 1.1 selected no class (D6): the large model-visible results are file-content
reads, and the results with failure lines are small, so the execution summary had
nothing to apply to.

**Owner decision 2026-10-15 (D10): redesign, not close or park.** This revision:

- **Adds a content profile** for `Read` text and file-printing Bash, selected by a
  criterion committed before the window it reads (D11,
  `internal/bench/tool-results-content-profile-PREREG.md`, commit `033c3b2aa`).
  Its window is the 14 days after 2026-10-15T12:26:27+02:00; 1.3 cannot be read
  before 2026-10-29. No class selected closes this roadmap — there is no third
  criterion.
- **Leaves the content delivery form undecided.** The council split (D12): one
  seat would shorten only byte-identical repeats, the other constrained first
  reads. Both asked for the same missing reading — the repeat share — which 1.4
  takes from the same window. 3.2 reopens D12 once, with that reading.
- **Settles one of D8's contracts** (D13, both seats): a handle returns the bytes
  stored at delivery, addressed by their hash, never a re-read from disk.
- **Applies D9 of `road-to-placeholders-on-the-wire`:** `observe` never changes a
  view and the placeholder view exists from `protect` upward, so the store is
  written only from `protect`; in `observe` the stage counts what it would store.

**Screen 2026-10-18 (`main@3f8c98e74`), nothing executable.** Placeholders 1.1
(ADR-285) and 1.2 have landed and `src/scripts/hooks/egress_stage.ts` exists;
placeholders 1.3 is open on its one release of readings, so D8's wait holds as
recorded. 1.3 and 1.4 here are dated on or after 2026-10-29; a run before then
is labelled PEEK and counts for nothing.

**Run 2026-10-20 (`main@220f8af88`): Phase 2 built.** D8's revisit-if fired
(ADR-285 accepted, the stage exists), the council reopened it and chose to build
the store now behind an empty selection (D16), and settled the four open
contracts (D17). 2.1–2.4 are closed: the stage calls the store, which stores
nothing until D14 names a class. Still waiting, each on a date or a reading:
1.3 and 1.4 on the D11 window (closes 2026-10-29); 1.5, 3.1–3.4 on 1.3's
selection; 3.5 and 4.2 on a release of readings; 4.1 on D15.

## Context — read at `main@9a943f30c`, F6 at `main@085ec41ff`

| # | Finding | Evidence |
|---|---|---|
| F1 | **Nothing reduces a tool result today, by construction and by test.** `tests/scripts/tool_result_bytes_hook.test.ts:212` pins "nothing in the tree rewrites a tool result"; the recorder writes `delivered_bytes` equal to `raw_bytes` (`src/scripts/hooks/tool_result_bytes_hook.ts:280`). |
| F2 | **The writer this needs is planned, not built.** `road-to-placeholders-on-the-wire` 1.1 makes one dispatcher stage the only writer of a rewrite and 3.1 emits the host's result-replacement field from it; its 0.1 probes what a mismatched replacement does. None of its steps is done. |
| F3 | **No store exists to make a reduction recoverable.** A grep for `spool`, `output_store`, `tool_result_store` and `local_handle` under `src/` returns nothing. Without one, a shortened output can only be recovered by re-running the command, which may be slow, non-deterministic or side-effecting. |
| F4 | **Superseded by F6.** The 12-transcript sample read Bash as the large text class; the dated distribution shows the large Bash results are file-content reads. Image Reads stay out of scope (K7). |
| F5 | **The command-output advisory exists and stays advisory.** `rtk_wrap_hook` nudges toward a bounded form and records its fire count (`src/config/hook-token-budget.json:110`); it rewrites nothing. |
| F6 | **The large results are content, the failing ones are small.** Text `Read` p95 42,029 B with no exit code; 2,599 Bash results above 8,192 B carry 36.7 % of Bash bytes and are mostly `sed`, `cat` and `git diff`, 13 of them with a failure line; a test runner's p95 is 2,256 B (D6). `reread_guard_hook` already keeps a session ledger of full reads (path, mtime, size, sha256 — no content) and says one advisory line on an unchanged full re-read. |

## Phase 1 — Choose what is worth reducing, under a criterion stated first

- [x] **1.1 Pick the classes from the sibling's 1.4, not from the source plans.**
      A class enters scope when its model-visible p95 exceeds a stated byte
      threshold (D1) and its results have a failure-line structure the summary can
      keep. The selection, with the figures, goes into this file's `## Decisions`
      as row D6 before any store is built. Any census line it reads goes through
      `src/scripts/_lib/tool_result_census.ts` (`readCensusLine`), so a legacy
      `{bytes}` line counts as envelope bytes with delivered bytes unknown.
      verify: `grep -c '^| D6 ' agents/roadmaps/road-to-tool-results-that-leave-a-handle.md` -> /^1$/
- [x] **1.2 Classify content results exactly as pre-registered.** *Done
      2026-10-16: `classifyResult` + `contentProfile` in the report, a per-result
      `scanToolResultRecords` in `cc_transcript.ts` (command and timestamp kept),
      the D11 window fixed in code and a run before it closes labelled PEEK.
      Seen red first; not run over the window.* A classifier in
      `src/scripts/report_reducible_classes.ts` sorts a result into `Read:text`,
      `Bash:file-print`, `Bash:vcs-content`, the execution profile, or Bash
      residue by the PREREG table and nothing else; `--profile content` reports
      per class the count, the p95 and `selected`, `out` or `insufficient`, plus
      the residue count above 8,192 B. Case `content-class-follows-the-prereg`
      covers every table row and every exclusion (a leading `cd`, a chain, a
      redirect, a subshell, an image). It is built before the window closes and
      reads no result inside it.
      verify: `npx vitest run tests/scripts/report_reducible_classes.test.ts -t content-class-follows-the-prereg --reporter=verbose` -> /✓.*content-class-follows-the-prereg/
- [ ] **1.3 Read the window once, after it closes.** On or after 2026-10-29, run
      1.2 over the D11 window and record both profiles, the residue and any class
      `insufficient` in `agents/evidence/analysis/content-profile-selection-<date>.md`;
      the selection becomes row D14. No content class and no execution class
      selected → this roadmap closes on its second null (D10, D11).
      verify: `grep -c '^| D14 ' agents/roadmaps/road-to-tool-results-that-leave-a-handle.md` -> /^1$/
- [ ] **1.4 Measure the repeat share in the same window.** *Instrument built
      2026-10-16, reading still open: `repeatShare` in the report prints the
      share in the same `--profile content` run as 1.3; `scanToolResultRecords`
      now carries the transcript file as the session (a subagent is its own
      context), `Read` path and range, a sha256 over the payload, and whether a
      `reread_guard_hook` advisory preceded the call. A `Read` and a `cat` of
      one file never match each other, and a result first delivered before the
      window opened is not counted, so the share is a lower bound.
      Not run over the window.* For content results:
      how many, and how many bytes, are byte-identical to one delivered earlier in
      the same session (same path, same range, same digest over the delivered
      payload), and how many of those followed an advisory line from
      `reread_guard_hook`. Reported beside 1.3 with no bar; it is the reading
      D12 waits for.
      verify: `grep -rl 'repeat share' agents/evidence/analysis/ | grep -c content-profile-selection` -> /^[1-9]/
- [~] **1.5 Freeze a golden corpus before any reducer exists.** *Deferred
      2026-10-15: no class is selected; it waits on 1.3.* Twenty recorded results
      per selected class under `tests/fixtures/tool-output-corpus/` — for an
      execution class with its failure lines and exit code, for a content class
      with its path, range and the sha256 of the delivered payload. Recall on this
      corpus is what every later phase is held to.
      verify: `ls tests/fixtures/tool-output-corpus | wc -l` -> /^\s*[1-9][0-9]+$/

## Phase 2 — A local store the stand-in can point into

- [x] **2.1 Store the delivered bytes under their hash.** *Done 2026-10-20:
      `_lib/tool_output_spool.ts`, its own conditional chunk, called by
      `egress_stage.ts` through the engine's `spoolResult`; the selection is
      `_lib/tool_output_selection.ts`, empty until D14 (D16).* In the placeholders
      stage, from `protect` upward, a result of a selected class is written to
      `agents/runtime/spool/<sha256>` — gitignored, workspace-local, never
      `agents/tmp/` — before anything is shortened; the hash is over the bytes the
      model receives. In `observe` the stage writes no body and counts what it
      would store (class, bytes, digest), because `observe` never changes a view
      (D9 of the placeholders roadmap). Writing is idempotent on the hash. Case
      `spool-write-is-content-addressed` asserts equal outputs share one file.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t spool-write-is-content-addressed --reporter=verbose` -> /✓.*spool-write-is-content-addressed/
- [x] **2.2 No credential rests in the store, and the store holds what the model
      saw.** The spool receives the placeholder view of the envelope, never the
      execution view, so a value the placeholders stage replaces is a token on disk
      too. When the stored bytes would differ from the bytes delivered to the model,
      nothing is stored and the result is delivered unreduced (D13). With that
      stage off, a result carrying a credential-class match is not stored and is
      delivered unreduced.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t credential-match-is-never-spooled --reporter=verbose` -> /✓.*credential-match-is-never-spooled/
- [x] **2.3 The store expires.** *Done 2026-10-20: cleanup runs at the first
      store of each session, under an exclusive lock (D17); a handle carries
      its expiry and a MAC, so `expired` survives its entry's removal.* Entries older than the retention age (D2) are
      removed at `session_start`; the store has a byte cap past which the oldest
      go first. A handle to an expired entry answers "expired", never an empty
      body.
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t expired-handle-says-expired --reporter=verbose` -> /✓.*expired-handle-says-expired/
- [x] **2.4 A handle returns the stored bytes.** *Done 2026-10-20:
      `report_reducible_classes --read-handle <handle> [--range start:end]`,
      byte ranges, half-open (D17).* One existing read path — not a new
      CLI verb — returns a stored result by hash, whole or by range. It never
      re-reads the file from disk; a missing, an expired and a corrupted entry
      (digest mismatch) each answer their own state (D13).
      verify: `npx vitest run tests/scripts/tool_output_spool.test.ts -t handle-reads-a-range --reporter=verbose` -> /✓.*handle-reads-a-range/

*Exit: 2.1–2.4 green; nothing is shortened yet, and `delivered_bytes` still equals `raw_bytes`.*

<!-- blocked-by: tool-output-store-refused-until-activation-is-gated -->
**Phase 2 is written and locally green, and it does not ship.** The AI council
refused it 2/2 on 2026-10-20 under ADR-268 § 4. The four boxes above stay `[x]`
because the work they describe is done and verified; what is blocked is the
LANDING, not the step. Record, verdict and the five conditions:
`agents/evidence/ratifications/tool-output-spool-20261020.md`.
The five conditions are now answered in code and tests (D18), and the blocker
stays open until a new round ratifies the result.

## Phase 3 — Shorten, in observe mode first

- [ ] **3.1 Execution profile: a deterministic summary per selected class.** Only
      if 1.3 selects an execution class. Exit code, every line the class marks as
      a failure, a head and a tail bounded in bytes, and the handle. No model
      summarises anything. The summary is computed and counted in observe mode;
      nothing is delivered shorter.
      verify: `npx vitest run tests/scripts/tool_output_summary.test.ts -t summary-keeps-every-failure-line --reporter=verbose` -> /✓.*summary-keeps-every-failure-line/
- [ ] **3.2 Content profile: decide the form once, with the readings.** Only if 1.3
      selects a content class. D12 goes back to the council with 1.3's selection
      and 1.4's repeat share; the candidates are (a) a shortened first read and
      (b) a reference to a byte-identical earlier delivery. A split again, or a
      repeat share and a selection that support neither, keeps the content profile
      unbuilt and is recorded as such. The choice becomes row D15.
      verify: `grep -c '^| D15 ' agents/roadmaps/road-to-tool-results-that-leave-a-handle.md` -> /^1$/
- [ ] **3.3 Content profile: build the chosen form, in observe mode.** The stand-in
      carries path, range, byte length, the sha256 of the delivered bytes and the
      handle — plus, under form (a) only, an outline of top-level symbols or
      headings with line numbers for file types whose structure is extracted
      deterministically, every other type delivered unchanged. No model writes it.
      Computed and counted; nothing is delivered shorter.
      verify: `npx vitest run tests/scripts/tool_output_summary.test.ts -t content-stand-in-names-path-range-digest --reporter=verbose` -> /✓.*content-stand-in-names-path-range-digest/
- [ ] **3.4 Hold the floors on the corpus.** Execution classes: failure-line
      recall 100 % and exit code preserved on all of 1.5's corpus. Content
      classes: for every corpus entry and every range requested of it, the handle
      returns bytes identical to the entry, and the digest matches; under form (a)
      every outline entry the corpus records is present. Either profile: a result
      whose stand-in would not save at least the net-win floor (D3) is delivered
      unchanged.
      verify: `npx vitest run tests/scripts/tool_output_summary.test.ts -t corpus-recall-is-total --reporter=verbose` -> /✓.*corpus-recall-is-total/
- [ ] **3.5 Arm it for this workspace only.** After one release of observe-mode
      readings, the stage delivers the stand-in for the selected classes of either
      profile in the maintainer workspace, and the census line carries
      `delivered_bytes` from the stage's output — the debt the placeholders
      roadmap's 3.2 names. Only the tail of the newest result changes, so no
      earlier turn and no cache breakpoint moves.
      verify: `npx vitest run tests/scripts/tool_result_bytes_hook.test.ts -t reduced-result-records-smaller-delivered --reporter=verbose` -> /✓.*reduced-result-records-smaller-delivered/

## Phase 4 — A second read of unchanged content becomes a reference

- [ ] **4.1 Replace only on a byte-identical match.** When a content result is
      byte-identical to one delivered earlier this session (same path, same range,
      same digest over the delivered bytes, by `Read` or a content-class Bash
      command) and that earlier result is still stored, the stage delivers a
      reference to it and the handle instead of the body. The match reads
      `reread_guard_hook`'s ledger, which stays advisory and gains a range and a
      delivered-bytes digest; no second ledger is kept. A changed hash, a
      different range, or an expired entry is delivered unchanged. If D15 chooses
      form (b), this step is that form's delivery and 3.3 builds nothing apart
      from it.
      verify: `npx vitest run tests/scripts/reread_guard_hook.test.ts -t unchanged-full-read-becomes-reference --reporter=verbose` -> /✓.*unchanged-full-read-becomes-reference/
- [ ] **4.2 Measure whether the model then re-reads anyway.** Over one release in
      the maintainer workspace, the count of references followed by a full re-read
      of the same path within three turns. A rate above the stated bound (D4)
      disarms 4.1 and records the null.
      verify: `ls agents/evidence/analysis/ | grep -c reread-reference` -> /^[1-9]/

## Blockers

### blocker: tool-output-store-refused-until-activation-is-gated

- **Status:** open — raised 2026-10-20 by the ratification round required for the Phase 2 push.
- **Class:** 2 — the conditions are agent-executable work, and the verdict that lifts them is the council's, not the owner's.
- **Run:** the five conditions below, then `./scripts-run src/scripts/council_cli run <question> --output agents/runtime/council/responses/<slug>.md --confirm` for a renewed round.
- **Owner:** council
- **Blocks:** the PUSH of Phase 2 (steps 2.1–2.4 and every later phase that builds on the store). Not the steps' correctness — they are locally green.
- **Question:** is the tool-output store an increase in the agent's own power? Both seats answered yes-in-latent-form and refused the submitted framing of `confirmed-non-expanding`.
- **What to do:** (1) show that EVERY activation or broadening path triggers ratification, not only `_lib/tool_output_selection.ts`; (2) tests proving an empty selection never loads the store, writes, issues a handle, withholds output or changes behaviour; (3) document and test authorization scope, expiry, replay, range requests, equality leakage, retention, cleanup failure, partial writes and corruption; (4) separate the code-integrity claim from the stored-data security claim; (5) resubmit the complete diff with that evidence.
- **Recommendation:** resubmit asking for `ratified`, not `confirmed-non-expanding`. A seat said so directly: if the controls hold, this is an accepted expansion rather than no expansion, and arguing the weaker verdict again spends a round on a framing one seat has already rejected.
- **If you do nothing:** the branch cannot be pushed at all — the pre-push gate reads the whole governed diff, so even the resolved `origin/main` merge sitting in the worktree stays local.
- **Resolved when:** a council round over the same subject returns `ratified` or `confirmed-non-expanding` from both seats, and the artefact under `agents/evidence/ratifications/` carries that verdict with a subject digest matching the pushed diff.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | A class is in scope when its model-visible p95 exceeds 8 KB | the host already caps a Bash result through `BASH_MAX_OUTPUT_LENGTH`, so savings live between the typical and the capped size; 8 KB is a stated default, not a fit | the 1.4 distribution shows no class above it |
| D2 | reversible-technical | agent | Spool retention is 7 days and 500 MB, whichever comes first | the same order as the council runtime retention (`ai_council.session_retention_days` default 7); a handle older than a week is rarely followed | a handle is followed after expiry in the 4.2 readings |
| D3 | reversible-technical | agent | Net-win floor: a summary must be at most half the model-visible bytes of the original, else the original is delivered | below that the handle line and the head/tail eat the saving | the observe-mode readings show most results land just above the floor |
| D4 | reversible-technical | agent | A reference rate followed by a full re-read above 30 % disarms 4.1 | a reference the model does not trust costs a turn and saves nothing | the rate sits near the bound |
| D6 | reversible-technical | council:tool-results-d6-selection-2026-10-15 (2/2 present, both seats chose this) | The selection is empty: no class meets D1 and the failure-line condition of 1.1 together. Bash has the structure but its p95 is 6,282 B, under 8 KB; text Read (p95 42,029 B) and image Read (p95 621,520 B, K7) are above it with no exit code or failure line; Edit and Write are K3; every other class has p95 at most 2,784 B. D1 is not revised to admit Bash: a threshold lowered, a tail-mass criterion, or Bash cut into command families after reading these figures would be a fit, and the families above 8 KB are file-content reads (`sed`, `cat`, `git diff`). D1's revisit-if did not fire as written (two classes are above 8 KB) — it should have read "no eligible class" | `agents/evidence/analysis/model-visible-bytes-2026-10-14.md` (83,031 results); `report_reducible_classes` on 2026-10-15 reads `selected: none` and the census through `readCensusLine` (142,709 legacy lines, 71,700 two-field, 0 unreadable, delivered unknown on 143,462). Supplementary, not part of the dated distribution: 2,599 Bash results above 8,192 B carry 37.4 MB (36.7 % of Bash bytes), and 13 of them carry `is_error` or an `Exit code` line | the owner answers how this roadmap continues (answered: D10), or a fresh window under a criterion stated before it is read selects a class (D11) |
| D7 | reversible-technical | agent | Verify lines of 1.2, 3.3, 3.5 and 4.1 name test titles the step itself creates; each is seen red before its implementation (closure listing C1, C2) | `closure_scan` lists a name filter with no matching title today because the titles do not exist yet | a step closes with its filter still matching no title |
| D8 | reversible-technical | council:tool-results-handle-scope-2026-10-14 (2/2 present, both seats chose this) | Phase 2's store is not built ahead of its caller; every step stays open until its dependency lands. Rejected: a standalone store module flipping 2.3/2.4 (a callerless store cannot show the integrated behaviour 2.1–2.4 describe, and it fixes handle, range and expiry contracts before the stage exists); spooling from the byte-recorder hook today (a writer outside the single stage, storing unselected classes) | `road-to-bytes-the-model-actually-receives` 1.4 and `road-to-placeholders-on-the-wire` 1.2/1.3 are unchecked on `main@90ed4e697` | either dependency lands, or the placeholders 1.1 ADR freezes the stage interface before the stage is built |
| D5 | reversible-technical | agent | No consumer default is set here; arming stops at the maintainer workspace | a consumer-facing default for result rewriting is already an owner blocker in `road-to-placeholders-on-the-wire` (`default-mode-for-consumers`); a second one would split one decision | that blocker is answered |
| D10 | product-owned | owner | Redesign this roadmap rather than close it on the D6 null or park it: a content profile for file-content results beside the execution profile, selected under a criterion stated before a fresh window is read | Owner answer "1" on 2026-10-15 to the question in Execution status (redesign / close / park) | the D11 window selects no class — then this file closes on its second null (D11) |
| D11 | reversible-technical | agent | Content-profile selection is pre-registered in `internal/bench/tool-results-content-profile-PREREG.md`: three classes fixed by what the body is a function of (`Read:text`, `Bash:file-print`, `Bash:vcs-content`); a class is selected when its p95 exceeds D1's 8,192 B over at least 200 results in a 14-day window that starts after that file's commit; no class selected closes the roadmap with no third criterion | committed alone before any reading of the window; the honest-limit section of that file names the D6 reading the class definitions were informed by | never edited; a change is a new registration with its own window |
| D12 | reversible-technical | council:tool-results-content-delivery-2026-10-15 (2/2 present, split) | The content delivery form is not chosen. One seat: shorten only byte-identical repeats, and only after their share is measured. The other: the measured problem is large first reads, so a constrained shortened first read, failing open for types without reliable structure. Neither seat chose (c), head plus outline (K8). Both asked for the repeat share (1.4); 3.2 reopens this row once with it | `agents/evidence/council/tool-results-content-delivery-2026-10-15.md`, prompt verbatim beside it | 1.3 and 1.4 are recorded (step 3.2) |
| D13 | reversible-technical | council:tool-results-content-delivery-2026-10-15 (2/2 present, both seats agreed) | A handle returns the bytes stored at delivery, addressed by the sha256 of the bytes the model received — never a re-read of the file by path and range. A result is stored and replaced only when the stored bytes equal the delivered bytes; a missing, an expired and a corrupted entry each answer their own state. Settles the "opaque hash or path" contract D8 listed | the same record: a disk re-read is a time-of-check/time-of-use mismatch that can return content no longer matching the digest; a privacy view that differs from the delivered view cannot recover what was delivered | the placeholders stage delivers a view other than the one it hands to a local store |
| D16 | reversible-technical | council:tool-results-d8-reopen-2026-10-20 (2/2 present, both seats chose this) | D8 reopened on its own revisit-if (ADR-285 accepted, `egress_stage.ts` built) and replaced: Phase 2 is built now inside the existing stage, with the selected-class set an empty constant (`_lib/tool_output_selection.ts`) that only D14 fills, so production stores nothing before a class is selected and tests inject a selection. The store is its own conditional chunk, loaded by the engine only when that set is non-empty | `agents/evidence/council/tool-results-d8-reopen-2026-10-20.md`, prompt verbatim beside it | D14 selects no class — then the store, its chunk and its door are removed with the roadmap's close |
| D17 | reversible-technical | council:tool-results-d8-reopen-2026-10-20 (2/2 on (i), (ii), (iv); split on (iii), openai's taken on the requirement) | Contracts: (i) a range is zero-based, half-open, in bytes, refused when out of bounds, never clamped; (ii) any credential detection in the result at any confidence, or any refusal the stage recorded for it, refuses storage; (iii) a handle is `<sha256>.<expiry seconds>.<mac>` keyed by a workspace-local secret, so expired is told from unknown with no metadata kept past retention; (iv) writes publish through an exclusive temp file and an atomic rename, a read hashes the bytes it serves, cleanup runs under an exclusive lock taken over when stale. Cleanup runs at the first store of each session, not on the `session_start` event (implementer: the stage runs only on events with a body, and a session-start concern would cost a manifest entry and bundle bytes for an empty store). The read path is `report_reducible_classes --read-handle` | the same record; the anthropic (iii) answers `unknown` once cleanup removes an expired entry, which 2.3 forbids | a handle is followed after expiry in the 4.2 readings, or the first selected class needs line ranges |
| D18 | reversible-technical | agent, against the five conditions of the council refusal of 2026-10-20 (`agents/evidence/ratifications/tool-output-spool-20261020.md`); the next ratification round decides | Amends D13's naming and D17 (iii): the entry is filed under `HMAC(key, session, sha256)` and the handle is `<address>.<expiry>.<mac>` with the MAC over address, expiry and session, so a handle reads only in the session that stored it and equal content is not linkable across sessions or without the key. D13's substance holds — a read still verifies the sha256 of the delivered bytes, recomputed into the address. Cleanup runs at every store and at every fully checked read (not once per session), and deletes only by a rename claim that puts back an entry a writer replaced; the cleanup lock is efficiency, not correctness. Writes are complete or absent. The store directory is re-tightened to 0700. The observe digest is keyed. Every activation path is gated by name in `check_kernel_edit_ratified.ts`, plus any source file that newly imports a store module | condition 3 (authorization scope, equality leakage, retention) and condition 1 (every activation path); session binding is a scope boundary between sessions, not a defence against the machine's own user, and the contract says so | the ratification round refuses it again, or a selected class needs a handle readable across sessions |

## What this roadmap deliberately does not do

- **K1** Add a second writer of a rewrite — the single stage of `road-to-placeholders-on-the-wire` 1.1 is the only one.
- **K2** Summarise with a model — a second upload to save the first.
- **K3** Reduce Edit or Write results — the model already receives a short confirmation (sibling F1).
- **K4** Shorten anything for a consumer by default (D5).
- **K5** Store anything under `agents/tmp/`, or any credential value anywhere.
- **K6** Claim a reduction percentage anywhere; the census delta is the record.
- **K7** Reduce or re-encode images. Screenshots are evidence for UI work; whether their size is a lever is a question for the sibling's 1.4 figures, not a step here.
- **K8** Deliver a first read as its first N bytes plus an outline (option (c) of D12). Neither seat chose it; a byte-position cut keeps what is early, not what matters, and still needs the outline (a) carries.
- **K9** Resolve a handle by re-reading the file from disk (D13). The file may have changed since delivery; the handle would return bytes the digest does not describe.
- **K10** Re-fit the selection after reading figures: lower D1, add a tail-mass share, re-cut Bash into new families, or extend the D11 window to reach the sample floor. Each was named a fit in D6 or in the PREREG; a new criterion is a new registration.
- **K11** A size bound for shortened first reads proposed without evidence (one seat's 100 KB in D12). A bound enters only with a reading behind it, at 3.2.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A stand-in drops what the agent needed | product | An execution summary loses an unanticipated failure line, or a content stand-in leaves out a value the agent was looking for (a configuration value, a comment, an implementation detail anywhere in the file); the agent works from a wrong picture and does not open the handle. | The frozen corpus of 1.5 with 100 % recall (3.4), observe mode before arming (3.1, 3.3, 3.5), a content form chosen only with the repeat-share reading (3.2), and the handle line on every shortened result. | Phase 3 — Shorten, in observe mode first |
| 2 | The spool becomes a second copy of sensitive output | implementation | Full command output and file content can carry tokens, customer data or paths; a persistent store multiplies where it rests. | Placeholder view only and stored bytes equal to delivered bytes (2.2, D13), refusal to store a credential match when that stage is off, a retention age and a byte cap (2.3). | Phase 2 — A local store the stand-in can point into |
| 3 | The host drops a replacement silently | implementation | A replacement whose shape the host rejects leaves the full result delivered while the census records it shortened. | The placeholders roadmap's 3.3 checks shape before emitting and counts a drop; this file records `delivered_bytes` from the stage only when that check passed. | Phase 3 — Shorten, in observe mode first |
| 4 | The dependency never lands | product | Both roadmaps this depends on are open; this file can sit ready with nothing executable. | Phase 1 needs no dependency: 1.2 is a report and 1.3/1.4 a dated reading; Phase 2 waits on the placeholders stage (D8), and arming (3.5, 4.1) is the part that waits longest. | Phase 1 — Choose what is worth reducing, under a criterion stated first |
| 5 | The criterion is bent after the window is read | product | Text Read is expected to pass; a near-miss elsewhere invites a lowered bar, a re-cut family or a longer window. | The PREREG is committed before the window opens and never edited (D11); K10 lists every re-fit; no class selected closes the roadmap. | Phase 1 — Choose what is worth reducing, under a criterion stated first |

## Acceptance Criteria

- [ ] AC-1 — In the maintainer workspace, a result of a selected class reaches the
      model shorter than the host produced it, its census line shows
      `delivered_bytes` below `raw_bytes`, and the bytes it replaced are
      retrievable by its handle until they expire — or the D11 window selected no
      class and this roadmap closed on that null.
- [ ] AC-2 — On the frozen corpus every failure line and exit code of an
      execution class survives its summary, and every range of a content class
      comes back byte-identical through its handle.
- [ ] AC-3 — No credential value rests in the store, and no consumer install
      shortens a result without a setting a person chose.
- [ ] AC-4 — A re-read of unchanged content is delivered as a reference only
      while the measured follow-up re-read rate stays under its bound, or the null
      is on record.
