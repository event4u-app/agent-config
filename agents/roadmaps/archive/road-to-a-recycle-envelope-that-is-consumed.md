---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-continuity-writer-activation
    relation: extends
    note: >
      Shared surface, verified rather than assumed: that roadmap's Phase 3
      retires the `hot-context` concern and its step 1.1 owns the continuity
      RECORD's capacity policy. This file owns the record's RESOLUTION — which
      session may read which file — and those are different halves. Its
      `check_continuity_surface` axes are untouched here: no artefact is added
      or removed, one resolver branch changes.
estate_growth_exempt: "Charges +1 active roadmap against the origin/main `active_roadmaps` floor of 4, and the reason is that the defect is live on main and no active roadmap, later roadmap or stub names it. MEASURED this change rather than argued: `consume_recycle_envelope` resolves the record by the CONSUMING session's id (`handoff_context_hook.ts:392` passes `envelope['session_id']`), while `session:recycle` writes it under the PRODUCING session's id — so a successor never finds a predecessor's envelope. Reproduced on five fixtures (see § What is actually wrong); corroborated by the only `.consumed.json` in the tree carrying the pre-keying LEGACY name, and by all 19 consumer-test calls passing `null` for the session id, which is why no gate sees it. Folding it into `road-to-continuity-writer-activation` was considered first and rejected: that file carries 6 blockers, all owner-gated, so a live trunk defect folded into it inherits six unrelated waits."
estate_offset_exempt: "Offsets nothing, and there was nothing to disarchive against it. This is a receiver for a defect found while executing the recycling hook's own instruction, not a planned addition — the alternative to the file is a fix with no record of why the mechanism was inert for weeks, or a deferral with no receiver, which `active-remediation` names as not a disposition at all. Nothing unrelated was archived or parked to pay for it, which is the laundering the ratchet exists to catch."
---
# Road to a recycle envelope that is consumed

> **Source:** found 2026-09-09 while obeying the `session-eol` stop hook's own
> instruction to run `session:recycle` at the context threshold. The envelope
> was written and verified in the main checkout — and then, checking for stray
> copies, twelve unconsumed envelopes turned up across the estate. The
> accumulation was the symptom; the cause is below and was measured, not
> inferred.

## Goal

An envelope written by one session is read by its successor, or the reason it
was not is reported to someone. Concretely: the resolver either finds a
predecessor's record for a successor that carries its own session id, or the
`session-eol` producer refuses to write a record nothing can read — and an
unconsumed record does not sit undetected for weeks in either case.

## What is actually wrong

Three facts, each reproduced on a fixture rather than read off the source.

**1. The producer and the consumer key on different sessions.**
`session:recycle` writes `agents/runtime/state/recycle-envelope-<producer-id>.json`
(`recycle_envelope_rel`, `_lib/recycle_envelope_paths.ts:69`). The consumer calls
`resolveContinuityRecord(root, sessionId)` where `sessionId` is
`envelope['session_id']` from the dispatcher — the CONSUMING session's id
(`handoff_context_hook.ts:390-393`). Case 1 of that resolver reads the record
keyed to the id it was given **and nothing else**, by design and for a good
reason: picking the newest would hand a session a peer's state. But the id it is
given is never the producer's, so the record is never found.

Measured on five fresh fixtures, one per row, each with a schema-valid envelope
so a refusal cannot be mistaken for a resolution failure:

| envelope at | consumer id | outcome |
|---|---|---|
| `recycle-envelope-<PRED>.json` | successor's | **`absent` — no continuity record for this session** |
| `recycle-envelope-<PRED>.json` | same as producer | found (reached schema validation) |
| `recycle-envelope-<PRED>.json` | none | found |
| `recycle-envelope.json` (legacy) | successor's | **`absent` — no continuity record for this session** |
| `recycle-envelope.json` (legacy) | none | found |

So the mechanism works only when the consumer has NO session id. Every real
Claude Code session has one.

**2. No test exercises the path a real session takes.** All **19**
`consume_recycle_envelope` calls in
`tests/scripts/recycle_envelope_consumer.test.ts` pass `null` as the session id
— which is exactly row 3 and row 5 above, the two that work. The defect is
invisible to the suite by construction, not by oversight.

**3. The corroboration is in the tree.** The only `.consumed.json` in the main
checkout carries the **legacy shared** name, dated 2026-09-06. Consumption last
succeeded under the pre-keying path. Twelve live orphans were found this session
— two in the main checkout (deleted, both referencing PRs merged weeks earlier)
and ten across worktrees aged 19–29 days, each naming a PR merged 3–4 weeks ago.

**What is NOT wrong, corrected here because an earlier reading of this session
claimed it.** These orphans are not a stale-resume hazard.
`RECYCLE_MAX_AGE_HOURS = 48` means the reader discards an expired record loudly,
so nothing resumes from month-old context. The cost is the opposite and quieter:
a mechanism the stop hook tells every session to use has been returning
`absent` for weeks, and the only visible trace was files accumulating.

## Phase 1 — Make the defect visible before changing behaviour

- [x] **1.1 A test at the real call site, with an id on both sides.** Add the
      missing row to `tests/scripts/recycle_envelope_consumer.test.ts`: an
      envelope written under a producer id, consumed by a different id, asserted
      to `inject`. It must be RED first — that red is the whole finding, and a
      fix landing before it is a fix nobody can attribute.
      verify: the new case fails on `origin/main` at `d1e3517df` with
      `absent | no continuity record for this session`, and the other 19 cases
      stay green.

      Done 2026-09-09, and RED first. Four cases added to
      `tests/scripts/recycle_envelope_consumer.test.ts`, failing on
      `origin/main` at `4be5f5935` with `4 failed | 21 passed`: a predecessor
      record not injected for a successor, two records not producing the
      `starting clean` refusal, a stale record not discarded-with-reason, and
      **one the roadmap did not predict — a session reads its OWN record back**,
      which is a loop rather than a resume and was reachable because a session
      can receive more than one `session_start`.
      Verify output after the fix: `29 passed (29)` — the four go green and the
      21 pre-existing ones are untouched.
- [x] **1.2 Report an unconsumed record instead of letting it accumulate.**
      `session_eol_hook` already knows the state directory. Emit one advisory
      line naming any record older than `RECYCLE_MAX_AGE_HOURS` that is neither
      consumed nor quarantined, with its age and its `next_task`. Advisory only
      — no deletion, no refusal.
      verify: a fixture with one 72-hour-old record produces exactly one
      advisory line naming it; a fixture with only fresh or consumed records
      produces none.

      Done 2026-09-09. `unconsumedRecordLines` in `session_eol_hook.ts`, placed
      beside the counter-check it belongs with, reporting path, age in hours and
      `next_task` for any record past `RECYCLE_MAX_AGE_HOURS` that is neither
      consumed nor quarantined.
      Advisory only, per K3 — it returns lines, it refuses nothing.
      Verify output: 6 cases, `29 passed`. **The silent cases are tested first
      and deliberately**, because Risk 3 is that this becomes noise: no records
      → no line; a 2-hour-old record → no line (that is a pending resume, not a
      defect); an unparseable or undated record → no line rather than a guessed
      age. Then a 100-hour record reports its path, `100h` and its `next_task`,
      and three records of mixed age report exactly the two old ones.
## Phase 2 — Decide the resolution rule, then implement it

- [x] **2.1 Take the resolution rule to the council, with the two candidates
      already costed.** This is a decision, not an implementation, and it is
      where the no-recency rule bites: (a) the producer writes to a
      SUCCESSOR-agnostic name and the resolver's ambiguity rule does the rest,
      which reopens the shared write target the per-session key was introduced
      to remove; (b) the successor learns the predecessor's id from somewhere
      that is not recency — the register is the only candidate in-tree, and
      whether it can answer "which session ended in this workspace last" is
      unverified. Both must be weighed against the recorded no-`latest`-index
      decision in `_lib/recycle_envelope_paths.ts:56-64`, which forbids the
      obvious third option by name.
      verify: the chosen rule is written into this step with the rejected
      alternative and its reason, and it does not contradict the no-index
      decision — or, if it does, that decision is amended rather than ignored.

      Done 2026-09-09. AI council, 2 seats, 2/2 present, convergent, $0.0687.
      **Verdict: rule (d) — resolve to the unique record that is NOT the
      reader's own — and it does NOT contradict the no-`latest`-index decision**,
      because nothing is sorted and nothing is compared by time: uniqueness
      admits, ambiguity refuses.
      **Conditional, and the condition is part of the rule rather than a
      decoration on it: (d) is acceptable WITH a branch-match gate and not
      without it.** Peer isolation stops coming from the filename, so an
      unrelated session in the same checkout would otherwise resume an ended
      peer's work simply by starting next.
      **(a) rejected** — the successor-agnostic name IS the shared write target,
      so it restores the race the per-session key repaired.
      **(b) and (d′) rejected** — the register is unsound as a liveness source:
      absence means two things (`ended` and `not yet heartbeat`), only `cline`
      is in `DEREGISTER_ON_STOP_PLATFORMS`, and a newly-started session has a
      window before its first register write. A seat named what would change
      that — a `stopping` state written atomically with the envelope — and it
      does not exist today.
      **Left to the owner, both optional and neither taken here:** the staleness
      threshold (the existing 48 h guard is reused rather than a new number
      invented), and a branch-rename fallback via `git reflog`. The second is
      worth a note rather than silence: branches WERE renamed several times in
      this session's own work, so the case is not hypothetical — but the failure
      mode is a refused resume, which is safe, and the record is left unclaimed
      rather than consumed.
- [x] **2.2 Implement the chosen rule in the ONE place the contract lives.**
      `_lib/recycle_envelope_paths.ts` is the single point where producer and
      consumer agree; its own docblock names a second copy of any of its values
      as the drift seam. The change belongs there and not in either caller.
      verify: 1.1's case goes green; every other case in that file and in
      `tests/scripts/envelope_consumption.test.ts` stays green; the
      `resolveContinuityRecord` peer-isolation cases still refuse.

      Done 2026-09-09, in `_lib/recycle_envelope_paths.ts` and nowhere else for
      the resolver half, per that file's own single-point-of-agreement contract.
      `resolveContinuityRecord` now filters the reader's own record out of the
      candidate set and admits the unique remainder; the multi-candidate
      `starting clean` refusal is unchanged and is now reachable from both
      branches instead of only the no-id one.
      The branch gate lives in `handoff_context_hook` because it needs the
      parsed envelope, and it refuses with **`absent`** deliberately: every
      other outcome consumes the record (moved, not copied), and consuming here
      would destroy state the rightful successor could still use. `absent` is
      the only outcome that leaves the file alone.
      **Unknown is not a mismatch** — an envelope with no `branch` field, or a
      tree whose branch cannot be read, is admitted rather than refused on a
      comparison neither side can make. Both directions are tested.
      Sabotage-proven: disabling the gate reds exactly its own case
      (`1 failed | 28 passed`) and nothing else.
- [x] **2.3 Prove the fix end to end through the real dispatcher, not the
      library.** A unit call proved the defect; only a dispatcher run proves the
      repair, because the id arrives through the envelope and that is the layer
      the bug lived in.
      verify: two `session_start` dispatcher runs with different session ids,
      the first writing and the second consuming, and the second's stdout
      carries the predecessor's `next_task`.

      Done 2026-09-09. `tests/hooks/recycle_resume_e2e.test.ts`, 5 cases, all
      through `dispatch_hook` with real git workspaces because the branch gate
      reads the branch with git.
      A successor with a different id receives the predecessor's `next_task`;
      a third session does not receive the same record (moved, not copied);
      a session is not handed its own record back; a record from another branch
      is left on disk unclaimed; two predecessor records start clean.
      Verify output: `5 passed (5)`. This is the step that distinguishes proving
      the resolver from proving the wiring — the defect lived in which id the
      CALLER passes, so a library-level green would have proved the wrong
      thing.
## Phase 3 — Close the class, not the instance

- [x] **3.1 Sweep the ten worktree orphans, once the mechanism works.** Deferred
      to last on purpose: sweeping before the fix would delete the only evidence
      that the mechanism was inert, and sweeping is a bulk deletion across
      worktrees other sessions may own — so it stays owner-gated even here.
      verify: `find .claude/worktrees -name 'recycle-envelope*.json'` returns
      only consumed or fresh records, and the owner authorised the sweep in this
      step's own text.

      Done 2026-09-09, owner-authorised this turn, and after the fix rather than
      before it — sweeping first would have deleted the only evidence that the
      mechanism was inert.
      Ten files removed, all the legacy shared name under a worktree's
      `agents/runtime/state/`, each assertion-guarded on name, path and
      file-ness before unlinking: `evidence-typing`,
      `feat+inbox-harvest-b-quorum-telemetry`, `feat+road-to-completion-loop`,
      `feat+turn-end-gate-always-on`, `gate-autonomy`, `inbox-perf-regression`,
      `metric-loop`, `road-to-always-on-orchestration`, `sd-phase2`,
      `sm-scorers`. Two main-checkout orphans were removed earlier the same day
      with their referenced PRs (#1914, #1952) verified merged first.
      Verify output: `find .claude/worktrees -name 'recycle-envelope*.json'`
      returns two paths, both `.consumed.json`.
- [x] **3.2 State the producer/consumer keying contract where the next reader
      looks.** The defect was possible because two modules agreed on a PATH and
      not on WHOSE id keys it. Write the answer into
      `_lib/recycle_envelope_paths.ts`'s docblock as a sentence a reader can
      check, next to the no-index decision it sits beside.
      verify: `grep -c "producing session" src/scripts/_lib/recycle_envelope_paths.ts`
      returns non-zero, and the sentence names both sides.

      Done 2026-09-09. The contract now sits in
      `_lib/recycle_envelope_paths.ts` beside the no-index decision, and it
      names the thing whose absence caused the defect: the record is keyed by
      the **producing session** and read by the **consuming session**, which is a
      different session with a different id. Both facts were true in their own
      module and were never written down together, so the two sides agreed on a
      PATH and disagreed about whose id filled it.
      Verify output: `grep -c "producing session"` returns 1, and the sentence
      names both sides.
## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-09 | reviewer: claude/host -->

> **Re-reviewed at closure, same day.** Risk 1 did NOT fire and the gate that
> stopped it is 2.1's council: candidate (a) was the smallest diff and was
> rejected for exactly the reason the row predicted. Risk 2 did not fire —
> 2.3 proved the repair through the dispatcher, and the row is why that step
> exists rather than a library assertion. Risk 3 shaped 1.2 rather than
> firing: its silent cases are tested first. Risk 4 held — the sweep ran last
> and after the fix. No row is retired; each is the reason a step has the
> shape it has.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fix reopens the shared write target | implementation | Candidate (a) of 2.1 is the smallest change and it walks straight back into the race the per-session key was introduced to remove: two sessions in one checkout overwrite each other's record and each resumes from whichever wrote last. That defect is recorded in `_lib/recycle_envelope_paths.ts:47-52` and was repaired once already | 2.1 is a decision step with a council gate, and its verify requires the rejected alternative and its reason to be written down; the no-`latest`-index decision is cited by file and line so a candidate that contradicts it must amend it rather than pass unnoticed | Phase 2 — Decide the resolution rule, then implement it |
| 2 | The repair is proven by a unit call | implementation | The defect lived in which id the CALLER passes, so a library-level test can be made green by passing the right id in the test — proving the resolver and not the wiring. This is the shape that just produced seven findings on a sibling surface, three of them high | 2.3 requires two dispatcher runs with different ids and the predecessor's `next_task` in the second's stdout; 1.1 must be RED on `origin/main` first, so the test is anchored to the observed failure rather than to the fix | Phase 2 — Decide the resolution rule, then implement it |
| 3 | The advisory becomes noise and is ignored | product | An unconsumed-record line on every `stop` in a workspace that legitimately holds a fresh record trains the reader to skip it, and the one time it matters it is skipped too | 1.2 fires only past `RECYCLE_MAX_AGE_HOURS` and only on records that are neither consumed nor quarantined, and its verify includes the silent case — a fixture with fresh records producing NO line | Phase 1 — Make the defect visible before changing behaviour |
| 4 | Phase 3 is read as the deliverable | product | Twelve orphaned files are the visible symptom and deleting them feels like the fix. A run that sweeps and stops leaves the mechanism inert and removes the evidence that it was | 3.1 is last, states that reason inline, and stays owner-gated; the Goal is phrased on the envelope being READ, not on the directory being clean | Phase 3 — Close the class, not the instance |

## Acceptance Criteria

- [x] AC-1 — An envelope written by one session and consumed by a session with a
      DIFFERENT id injects, proven by two dispatcher runs rather than by a
      library call. A test that passes `null` for the session id does not
      satisfy this — that is the shape that hid the defect.
      Met. `tests/hooks/recycle_resume_e2e.test.ts` drives `dispatch_hook` with
      real git workspaces: `sess-A-producer` writes, `sess-B-successor` starts,
      and B's stdout carries A's `next_task`. Not one of its 5 cases passes
      `null`.
- [x] AC-2 — `tests/scripts/recycle_envelope_consumer.test.ts` contains at least
      one case whose consumer id differs from the producer id, and that case was
      observed RED before the fix landed.
      Met, with four such cases rather than one, all four observed red on
      `origin/main` at `4be5f5935` (`4 failed | 21 passed`) before any source
      change. The file now holds 29 cases and the 19 that passed `null` are
      untouched — they were never wrong, only insufficient.
- [x] AC-3 — A record older than `RECYCLE_MAX_AGE_HOURS` that is neither
      consumed nor quarantined is reported by name and age, and a workspace with
      only fresh or consumed records produces no such line.
      Met by `unconsumedRecordLines`, and BOTH halves are tested — the silent
      half first, because Risk 3 is that this becomes noise. A 100-hour record
      reports its path, `100h` and its `next_task`; no records, a 2-hour record,
      and an unparseable or undated record each produce nothing.
- [x] AC-4 — `_lib/recycle_envelope_paths.ts` states, in prose a reader can
      check, whose session id keys the record on the producing side and whose on
      the consuming side.
      Met. The contract sits beside the no-index decision and names both sides
      plus the reason its absence mattered: each fact was true in its own module
      and they were never written down together, so producer and consumer agreed
      on a PATH and disagreed about whose id filled it.

## Kill register

- **K1** A `latest` pointer file, or any resolution by recency. Forbidden by the
  recorded decision at `_lib/recycle_envelope_paths.ts:56-64`, and it is the
  option that looks cheapest at 2.1.
- **K2** Sweeping the worktree orphans before Phase 2 lands. That deletes the
  evidence and satisfies nothing.
- **K3** Making the `session-eol` advisory a refusal. A hook that blocks a
  session end over a stale runtime file is worse than the file.
- **K4** Relaxing `RECYCLE_MAX_AGE_HOURS` to make an orphan readable. The 48-hour
  guard is what keeps a wrong resume out; the defect is resolution, not age.
