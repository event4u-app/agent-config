---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-host-claims-the-tree-contradicts
entry_condition:
  what: >-
    Either a session in which the `user_prompt_submit` budget was actually
    reached appears in the host transcript corpus, or the channel question is
    settled — i.e. it is established which channel, if any, records a reached
    hook timeout, so the wake command can be known to be able to say no.
  when: >-
    The first is unbounded and external: it arrives when a dispatch on that slot
    crosses 30 s in a real session, which this repository cannot cause. The
    second is reachable as soon as a session carries permission to configure a
    throwaway hook and read the transcript store.
  who: >-
    The owner, for the permission grant that makes the channel question
    answerable. Nobody, for the organic witness — it is waited for, not assigned.
review_by: 2027-01-06
estate_growth_exempt: "open_blockers rises by one because step 2.4's hold was discovered while doing the work and is now written down instead of left implicit in prose; the alternative to the entry is not a smaller estate but the same hold recorded nowhere a gate can count, which is the laundering this carried file exists to prevent. Nothing was archived to offset it because nothing in this change finished — the roadmap moves from the active tree into later/, so active_roadmaps falls by one in the same diff."
---
# Road to host claims the tree contradicts — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-host-claims-the-tree-contradicts`](../archive/road-to-host-claims-the-tree-contradicts.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-host-claims-the-tree-contradicts deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-host-claims-the-tree-contradicts

- [ ] <!-- blocked-by: upst-timeout-witness | asked: no — raised from a subagent drain lane with no user channel; carried to the owner as residue in the lane report and in the blocker entry below --> **2.4 Observe a reached timeout on the slot.** Deferred, and named rather
      than dropped: the fourth return condition the 2026-09-29 refusal set — a
      session in which the `user_prompt_submit` timeout is actually reached and
      its effect on the 13 concerns recorded. It is the only thing that turns
      row 2's `read-from-host-documentation` into a measurement this tree holds,
      and it cannot be manufactured from the tree: it needs a real session that
      crosses 30 s on that slot, with host, host version, transcript reference
      and date. Until then no cell in the new table may be cited as evidence
      this package collected. ~~Same shape as 3.3, and for the same reason.~~
      **Struck 2026-10-05:** 3.3 closed and the shared shape was the reason it
      had not. The two differ, and the difference is set out under "Why this one
      is not recoverable" below.

      **Searched 2026-10-05, and the negative is now MEASURED rather than
      assumed.** The sibling step closed because its observation was recoverable
      from the transcript corpus, so the same corpus was searched for this one.
      All **1257** `.jsonl` files under the host's store were parsed per line and
      every match of `/hook[^"\n]{0,60}timed out|timed out after[^"\n]{0,20}|user_prompt_submit[^"\n]{0,60}timeout/i`
      was classified by the channel it sat in:

      | Channel | Matches | What it is |
      |---|---|---|
      | `toolUseResult` | 71 | tool output — Bash commands hitting their own `timed out after 2m 0s` / `10m 0s` caps, and greps of this repository's own prose echoing the phrase `user_prompt_submit` timeout |
      | assistant / user prose | 3 | agents and the user writing *about* timeouts |
      | `hookError` | **0** | — |

      **Two controls, because a zero from an uninstrumented probe is not a
      finding.** (1) The same classifier *did* find real timeout events — the 71
      `toolUseResult` hits include genuine Bash-tool timeouts at 2m, 3m, 7m and
      10m, so it can see a timeout when one exists. (2) The `hookError` channel is
      not hypothetical: `grep -rl -F 'hookError' ~/.claude/projects --include='*.jsonl' | wc -l`
      returns **278**, so the field is present and populated across the corpus and
      carries no timeout in any of them. The condition is unmet by measurement.

      **Re-run at this lane's tip, not only at its start.** The wake command
      below returns **0** files, and its control has moved **278 -> 282** — four
      more transcripts carry `hookError` than when the paragraph above was
      written, so the corpus is still accumulating and the zero is a live
      reading rather than a frozen one. The drift has a mundane cause worth
      naming, because it bounds what the control proves: the corpus includes the
      sessions that probe it, so re-running inflates the denominator by the act
      of measuring. That weakens the control as a growth signal and not at all
      as a presence signal, which is the only thing it is used for here.

      **Visited 2026-10-06 by a drain lane sent to decide producible-vs-elapsed
      from commands rather than from this prose. The answer is neither, and the
      step moves on that.** Full record:
      [`upst-timeout-observability-2026-10.md`](../../evidence/analysis/upst-timeout-observability-2026-10.md).
      Three things changed here, none of them the checkbox:

      1. **The mechanism is ordinary and bounded, and unreachable from this
         posture.** A nested host session whose `UserPromptSubmit` hook has the
         dispatcher's shape — emit context, then exceed the budget — against a
         throwaway directory outside this repository. Four commands, four
         refusals from the session permission layer: writing the hook settings
         file (`[Self-Modification]`), launching the session under it
         (`[Auto-Bypass]`), running the wake command below over the transcript
         store (`[PII Data Handling]`), and running that command's own control
         (`[Auto-Bypass]`). They were not worked around.
      2. **So the zero above was NOT re-measured at this tip**, and this lane
         adds no newer one. The `0` / `278 -> 282` reading stays dated
         2026-10-05. What is new is that the wake command is unrunnable under
         this posture, so a lane sent at this step again under it will not
         reach the reading either — that is a second, independent ground for
         the hold, and it is the one with an owner.
      3. **The wake command's own validity is unestablished — own analysis.**
         Its control shows `hookError` is populated for *some* hook outcome. It
         does not show a *timed-out* hook writes there, and row 2 of the table
         this step feeds gives positive reason to doubt it: a reached timeout is
         documented as cancelled with its output **discarded**, which is a
         different path from a hook that errors. If timeouts report elsewhere or
         nowhere, the condition is **unfalsifiable** rather than unmet, and no
         amount of waiting fires it. The argument below that a prober is "not a
         witness" is accepted for the ROW and does not reach this: a deliberate
         timeout is a perfectly good witness to *where a timeout is recorded*,
         which is a question about the host's reporting rather than about this
         package's runtime. Settling the channel is therefore the cheaper half,
         and it is what the blocker asks for first.

      **Why this one is not recoverable the way 3.3 was.** A delivered tool
      surface leaves a durable artefact in every transcript it appears in; a
      reached timeout leaves one only in the session where it happens. Searching
      harder cannot produce it.

      **What would happen the moment the block lifted — nothing else stops it.**
      Three figures re-executed at this tip rather than re-read:

      | Claim | Recorded | Live (2026-10-05) |
      |---|---|---|
      | `hook_manifest.yaml` sets no `timeout` key | 0, grepped 2026-09-30 | **0** — `grep -c timeout src/scripts/hook_manifest.yaml` → `0`, exit 1. Note the path: `src/scripts/`, not `src/config/` |
      | 13 concerns share the one budget on `claude` | 13 | **13** — the `user_prompt_submit` list on `claude` in that file, counted |
      | `user_prompt_submit` p95 | 81 ms (2026-07-27, 50 CI runs) | **81 ms**, max 83 — `docs/hook-latency.json` unchanged |

      So a witness session needs no tree edit first: the row has somewhere to go
      the moment it exists, and nothing else would stop it.

      **The hand-over, exactly.** The cells go into the table whose header is at
      `docs/enforcement-by-host.md` — locate it with
      `grep -n 'What the host documents' docs/enforcement-by-host.md` rather than
      by line number — as a fourth row, and the paragraph that currently reads
      "No such session exists in this tree" (`grep -n 'No such session exists in this tree' docs/enforcement-by-host.md`)
      is the one the row retires. The row to add:

      ```markdown
      | 4 | A session in which the `user_prompt_submit` budget was actually reached, and the observed effect on the 13 concerns. | — | `observed-in-session` · host · host version · transcript reference · date |
      ```

      **The command that flips the condition.** Nothing in `src/scripts/`
      produces it and none is being added, because a prober that manufactures the
      condition is not a witness to it. What a future session runs, once it has
      seen one, to confirm the corpus now carries it:

      ```bash
      grep -rlE '"hookError".{0,200}(timed out|timeout)' ~/.claude/projects --include='*.jsonl'
      ```

      Non-empty output is the witness; empty is this step's current state.
      **Measured cost of the hand-over itself: zero commands, one table row and
      one retired paragraph** — the search above is what this lane already paid.
- [x] **3.3 Write the observed row.** Closed 2026-10-05, and the premise it was
      deferred on turned out to be false. The step read as though the observation
      had to be *created*; it had already *happened* and was sitting in the host's
      transcript store, uncounted.
      verify: `npx vitest run tests/scripts/ask_surface.test.ts tests/scripts/_lib_host_capability.test.ts` -> 0

      The oracle is the two test files rather than a grep for the row's literal
      text, and the swap is deliberate: a substring grep passes on a row whose
      fields are wrong, while `ask_surface.test.ts` pins the key set AND all four
      shape values AND the narrowing the row causes, and
      `_lib_host_capability.test.ts` pins the registry boolean it has to agree
      with. A grep would have been an oracle weaker than the exit condition.

      It reads the runner's **exit code**, not its printed counts. An
      intermediate form counted lines matching `2 passed`, which a reviewer
      showed is coupled to the test total — a suite of 52 would have matched
      twice and false-redded a green run. The exit code carries no such coupling.

      **Evidence (2026-10-05).** 1257 `.jsonl` transcripts under the host's store
      were parsed per line; **48** blocks of `type: "tool_use"` carry a `name`
      matching `STRUCTURED_ASK_TOOL_NAME_RE`, all of them `AskUserQuestion`,
      across host versions **2.1.252, 2.1.268, 2.1.269, 2.1.270, 2.1.277,
      2.1.284** between **2026-09-01** and **2026-10-02**. 47 were answered by a
      non-error `tool_result`. Four-part citation, shape, method and controls:
      [`structured-ask-host-observation-2026-10.md`](../../evidence/analysis/structured-ask-host-observation-2026-10.md).

      **Why it read as unobserved.** The `false` row it rested on was taken from a
      **subagent** leg, whose delivered surface carries no picker because a
      subagent has no user to ask — the 2026-09 artefact lists that surface and it
      is the subagent toolset. The reading was sound; the step from "this leg has
      none" to "no host has been observed with one" was not. The earliest call
      found here is on **2.1.252**, six days and eleven patch versions *before* the
      2026-09-07 `false` reading on 2.1.263: the picker was being delivered and
      called while the row denying it was being written.

      **One instance is a sample.** The refuted sentence had **four** copies, all
      corrected in this change: `src/scripts/_lib/structured_ask.ts` (module
      header), `src/scripts/hooks/one_question_per_ask_hook.ts` (§ WHAT IT SEES),
      `src/scripts/_lib/host_capability.ts` (provenance block) and
      `docs/enforcement-by-host.md` § the picker bullet.

      **What did not change: the guard.** One question per call is
      `ask-when-uncertain`'s Iron Law, not a host ceiling, and all 47 parsed calls
      carried exactly one. The deny threshold is untouched.

      **Correction to this file's own citation.** Until this change the
      disposition paragraph below cited
      `host-capability-manifest.md:115-121` for "comes from a real session and
      never from a script". That sentence is **removed**, not repaired, because
      the premise it supported no longer holds; this paragraph is the record, so
      the stale anchor is not silently dropped. The fenced Iron Law sits at **117-119** and the
      "deliberately not a script" half at **122** — outside the cited range. Use
      `grep -n 'A ROW IS WRITTEN FROM AN OBSERVATION' src/agent-src/contexts/execution/host-capability-manifest.md`
      and `grep -n 'deliberately not a script'` on the same file instead.

      **Disposition re-checked 2026-10-02, against the tree rather than against
      this line.** Both carried steps ask for the same class of input: a row whose
      cells are *host, host version, transcript reference, date* taken from a real
      session that crossed a condition this repository cannot create. 2.4 needs a
      session in which the `user_prompt_submit` timeout is actually reached; 3.3
      needed a session on a host that delivered a question picker. **That symmetry
      was wrong**, and the difference is why one of the two closed: a *delivered
      tool surface* leaves a durable artefact in every transcript it appears in, so
      it is searchable after the fact; a *reached timeout* leaves one only in the
      session where it happens. The first was recoverable from the corpus. The
      second is not, and 2.4 stays open on that ground rather than on the shared
      one this paragraph assumed.

      **2.4 stays `[ ]`, not `[~]`.** The Risk Register below wants carried work
      counted as open in the dashboard; a deferral glyph would read as finished and
      is exactly the laundering this file was created to prevent.

      **Wake condition for 2.4:** a session that meets the condition is observed
      and its four cells are written into the row the parent names. Until one is, no
      cell in the new table may be cited as evidence this package collected — the
      parent's own constraint, restated here so it travels with the step.

## Blockers

### blocker: upst-timeout-witness

- **Status:** open
- **Owner:** owner
- **Blocks:** 2.4, and nothing else. AC-1 is already met — 2.4 carries a
  recorded disposition, which is what that criterion asks for; this entry is the
  reason `count_open` stays at 1 rather than being laundered to 0 with a
  deferral glyph.
- **What to do:** pick exactly one, and (a) is the cheap one —
  (a) grant a session permission to configure a throwaway `UserPromptSubmit`
  hook outside this repository and to read the host transcript store, so the
  **channel question** can be settled: drive one hook on that slot past 30 s and
  record which channel, if any, reports it. That answers whether the wake
  command can ever fire, and it is a question about the host's reporting rather
  than a manufactured witness to the row;
  (b) grant only the transcript-store read, which re-enables the wake command
  and its control but leaves the channel question open — this restores
  measurement of a zero whose meaning stays unestablished;
  (c) accept the hold as unbounded and leave it parked, in which case the step
  waits on an organic session nobody can schedule and the `review_by` date is
  the only thing that brings it back.
- **Resolved when:** either the wake command
  `grep -rlE '"hookError".{0,200}(timed out|timeout)' ~/.claude/projects --include='*.jsonl'`
  returns a non-empty list and its four cells are written into the row at
  `docs/enforcement-by-host.md` § "What the host documents", **or** the channel
  question is settled and recorded, so a zero from that command is known to mean
  "no timeout occurred" rather than "timeouts are not recorded there".

**Recommendation:** (a). It is the only option that makes the step's own exit
condition falsifiable, it is bounded to a single throwaway session, and it does
not depend on an external event arriving. (b) buys back a measurement whose
meaning is still unknown; (c) is honest but leaves a condition that may never
fire for reasons unrelated to whether the thing being waited for happens.

**If you do nothing:** the roadmap stays parked under `later/` and comes back on
`review_by: 2027-01-06`. Nothing degrades and nothing is lost — the three
figures the hand-over depends on re-executed green on 2026-10-06, so the row
still has somewhere to go the moment a witness exists. The cost of doing nothing
is that the condition may be unfalsifiable, so the wait could be indefinite
whether or not timeouts actually occur.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-host-claims-the-tree-contradicts |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-host-claims-the-tree-contradicts` is still `[ ]` without a recorded disposition.

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| Park the roadmap under `agents/roadmaps/later/` with `status: later`, a structured `entry_condition` and `review_by: 2027-01-06`, rather than leaving it in the active tree. | (a) Keep it active with the blocker recorded — rejected: its one open step cannot proceed from any posture a drain lane has, so it would be picked up and bounce on every sweep. (b) Flip 2.4 to `[~]` and archive — rejected outright: a deferral glyph reads as finished, and that is the laundering this carried file exists to prevent. (c) `skipped/` — rejected: the work is wanted, not declined. | The step has open work that will resume, blocked on an external trigger plus an owner-owned permission grant. That is exactly what `later/` is for, and the `entry_condition` makes the return observable instead of a hope. | The `upst-timeout-witness` blocker resolves by either branch of its `Resolved when`, or `review_by` arrives. |
| Do not produce the timeout by configuring a hook in this session. | Build the probe anyway through another route. | Four independent refusals from the permission layer, two of them naming self-modification and auto-mode bypass. Routing around a refusal of a hook-configuration surface is circumvention, not investigation — and the grant is the owner's to give. | The owner grants option (a) or (b) in the blocker. |
| Record the wake command's validity as unestablished instead of re-asserting the 2026-10-05 zero. | Repeat the zero as current. | The zero could not be re-measured here, and its control proves the `hookError` field is populated, never that a timed-out hook writes to it. Restating it as current would be a measurement claim with no fresh evidence. | The channel question is settled either way. |
