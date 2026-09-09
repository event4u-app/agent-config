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

- [ ] **1.1 A test at the real call site, with an id on both sides.** Add the
      missing row to `tests/scripts/recycle_envelope_consumer.test.ts`: an
      envelope written under a producer id, consumed by a different id, asserted
      to `inject`. It must be RED first — that red is the whole finding, and a
      fix landing before it is a fix nobody can attribute.
      verify: the new case fails on `origin/main` at `d1e3517df` with
      `absent | no continuity record for this session`, and the other 19 cases
      stay green.

- [ ] **1.2 Report an unconsumed record instead of letting it accumulate.**
      `session_eol_hook` already knows the state directory. Emit one advisory
      line naming any record older than `RECYCLE_MAX_AGE_HOURS` that is neither
      consumed nor quarantined, with its age and its `next_task`. Advisory only
      — no deletion, no refusal.
      verify: a fixture with one 72-hour-old record produces exactly one
      advisory line naming it; a fixture with only fresh or consumed records
      produces none.

## Phase 2 — Decide the resolution rule, then implement it

- [ ] **2.1 Take the resolution rule to the council, with the two candidates
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

- [ ] **2.2 Implement the chosen rule in the ONE place the contract lives.**
      `_lib/recycle_envelope_paths.ts` is the single point where producer and
      consumer agree; its own docblock names a second copy of any of its values
      as the drift seam. The change belongs there and not in either caller.
      verify: 1.1's case goes green; every other case in that file and in
      `tests/scripts/envelope_consumption.test.ts` stays green; the
      `resolveContinuityRecord` peer-isolation cases still refuse.

- [ ] **2.3 Prove the fix end to end through the real dispatcher, not the
      library.** A unit call proved the defect; only a dispatcher run proves the
      repair, because the id arrives through the envelope and that is the layer
      the bug lived in.
      verify: two `session_start` dispatcher runs with different session ids,
      the first writing and the second consuming, and the second's stdout
      carries the predecessor's `next_task`.

## Phase 3 — Close the class, not the instance

- [ ] **3.1 Sweep the ten worktree orphans, once the mechanism works.** Deferred
      to last on purpose: sweeping before the fix would delete the only evidence
      that the mechanism was inert, and sweeping is a bulk deletion across
      worktrees other sessions may own — so it stays owner-gated even here.
      verify: `find .claude/worktrees -name 'recycle-envelope*.json'` returns
      only consumed or fresh records, and the owner authorised the sweep in this
      step's own text.

- [ ] **3.2 State the producer/consumer keying contract where the next reader
      looks.** The defect was possible because two modules agreed on a PATH and
      not on WHOSE id keys it. Write the answer into
      `_lib/recycle_envelope_paths.ts`'s docblock as a sentence a reader can
      check, next to the no-index decision it sits beside.
      verify: `grep -c "producing session" src/scripts/_lib/recycle_envelope_paths.ts`
      returns non-zero, and the sentence names both sides.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fix reopens the shared write target | implementation | Candidate (a) of 2.1 is the smallest change and it walks straight back into the race the per-session key was introduced to remove: two sessions in one checkout overwrite each other's record and each resumes from whichever wrote last. That defect is recorded in `_lib/recycle_envelope_paths.ts:47-52` and was repaired once already | 2.1 is a decision step with a council gate, and its verify requires the rejected alternative and its reason to be written down; the no-`latest`-index decision is cited by file and line so a candidate that contradicts it must amend it rather than pass unnoticed | Phase 2 — Decide the resolution rule, then implement it |
| 2 | The repair is proven by a unit call | implementation | The defect lived in which id the CALLER passes, so a library-level test can be made green by passing the right id in the test — proving the resolver and not the wiring. This is the shape that just produced seven findings on a sibling surface, three of them high | 2.3 requires two dispatcher runs with different ids and the predecessor's `next_task` in the second's stdout; 1.1 must be RED on `origin/main` first, so the test is anchored to the observed failure rather than to the fix | Phase 2 — Decide the resolution rule, then implement it |
| 3 | The advisory becomes noise and is ignored | product | An unconsumed-record line on every `stop` in a workspace that legitimately holds a fresh record trains the reader to skip it, and the one time it matters it is skipped too | 1.2 fires only past `RECYCLE_MAX_AGE_HOURS` and only on records that are neither consumed nor quarantined, and its verify includes the silent case — a fixture with fresh records producing NO line | Phase 1 — Make the defect visible before changing behaviour |
| 4 | Phase 3 is read as the deliverable | product | Twelve orphaned files are the visible symptom and deleting them feels like the fix. A run that sweeps and stops leaves the mechanism inert and removes the evidence that it was | 3.1 is last, states that reason inline, and stays owner-gated; the Goal is phrased on the envelope being READ, not on the directory being clean | Phase 3 — Close the class, not the instance |

## Acceptance Criteria

- [ ] AC-1 — An envelope written by one session and consumed by a session with a
      DIFFERENT id injects, proven by two dispatcher runs rather than by a
      library call. A test that passes `null` for the session id does not
      satisfy this — that is the shape that hid the defect.
- [ ] AC-2 — `tests/scripts/recycle_envelope_consumer.test.ts` contains at least
      one case whose consumer id differs from the producer id, and that case was
      observed RED before the fix landed.
- [ ] AC-3 — A record older than `RECYCLE_MAX_AGE_HOURS` that is neither
      consumed nor quarantined is reported by name and age, and a workspace with
      only fresh or consumed records produces no such line.
- [ ] AC-4 — `_lib/recycle_envelope_paths.ts` states, in prose a reader can
      check, whose session id keys the record on the producing side and whose on
      the consuming side.

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
