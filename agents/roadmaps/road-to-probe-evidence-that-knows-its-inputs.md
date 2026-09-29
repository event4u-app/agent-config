---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "active_roadmaps 2 to 24 (+22, all 22 offset-exempt) — measured by check_estate_count on this diff, not predicted. This claim authorises the whole inbox-2026-09-ab round; the per-file justification follows. Verified 2026-09-29 at HEAD: `grep -c 'sha256\|createHash\|digest'` over `src/scripts/ui_conformance_probe.ts` returns 0, so `ui-conformance.json` records `generated_at` and nothing about what it looked at, and `conformanceVerdict` in `src/scripts/hooks/design_pass_hook.ts` prints a findings count with no freshness comparison — while the same file applies an mtime freshness rule to the audit artefact and states in its own comment that a stale artefact is worse than a missing one. The asymmetry is inside one file and nothing else in the tree reads it."
estate_offset_exempt: >-
  This work was scoped as a defect fix inside `road-to-behaviour-evidence-over-pixels`, which
  archived before it landed, so the intended host no longer exists and there is nothing to retire
  in its place. Merging it into the sibling ledger roadmap in this same source set would couple a
  probe-artefact schema change to three unrelated `apply.ts` fixes with a different shadow/flip
  schedule; parking it reproduces exactly the state that let it fall out of the archived host.
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: extends
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: disjoint
---
# Road to probe evidence that knows its inputs

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t10/` — an external completion-discipline
> analysis delivered as a transcript plus two successive plan revisions. The source named this
> its smallest immediately shippable change and routed it into a roadmap that has since archived;
> that routing is `corrected-from-reproduction` here.

## Goal

`ui-conformance.json` records when it was generated and nothing about what it read, so a probe
run before the last UI edit is indistinguishable from one run after it. After this roadmap the
artefact carries a digest of each input it saw, the hook's reader recomputes those digests without
starting a browser and reports `stale` when they moved, and an absent artefact on a turn that
actually ported a provided handover stops reading as unremarkable.

## Non-goals

- No blocking. The design-pass reader stays advisory; its block branch is untouched.
- No new artefact, schema file, hook or command verb — the digests are fields on the JSON the
  probe already writes, and the reader is the function that already parses it.
- No browser work in the reader. Deciding `stale` is a file-hash comparison.

## Phase 1 — The artefact records what it read

- [ ] **1.1 Add an `inputs` object to `ui-conformance.json`** carrying a content digest for the
      target, the reference and the declarations file, plus the probe's own version — written
      beside the existing `generated_at` (`src/scripts/ui_conformance_probe.ts:360,379`).
      verify: two runs over unchanged inputs produce identical `inputs` digests; changing one byte
      of the target CSS changes the target digest and nothing else.
- [ ] **1.2 An input the probe could not read is recorded as absent, never omitted.**
      verify: a run with the declarations file missing writes an explicit absent marker for it and
      the run still completes; a silently missing key fails the test.

## Phase 2 — The reader says `stale`, and says nothing else

- [ ] **2.1 `conformanceVerdict` recomputes the digests and compares them**
      (`src/scripts/hooks/design_pass_hook.ts`). On a mismatch the line reads that the inputs
      changed since the probe ran, and the findings count is not printed — a count against inputs
      that moved is the misleading half.
      verify: touching the target after a probe run makes the line read stale; the pre-change
      behaviour (a findings line) is asserted absent in the same test.
- [ ] **2.2 An artefact written before the digests existed reads as unknown, not stale and not
      fresh.** Absence of `inputs` is a version skew, not evidence of movement.
      verify: a fixture artefact with no `inputs` key produces the unknown line and no false stale.
- [ ] **2.3 No browser is started to decide any of this.**
      verify: the reader's module imports are asserted to contain no browser runtime; the stale
      decision runs with no browser binaries installed.

## Phase 3 — Absent becomes noteworthy, but only where it should be

- [ ] **3.1 A missing artefact sets `noteworthy` when a provided handover was detected this turn**
      and otherwise stays as it is today. The existing handover routing trigger decides; no new
      matcher.
      verify: a clean UI write with no handover produces no new line; a turn touching a handover
      with no probe run produces exactly one.
- [ ] **3.2 The line stays advisory.**
      verify: the hook's block branch is unchanged in the diff, asserted by the test that already
      pins the advisory path.

## Acceptance criteria

- AC-1 A probe artefact older than any of its inputs reads `stale`, and the reader reaches that
  verdict without a browser.
- AC-2 An artefact predating the `inputs` field reads unknown, never stale and never fresh.
- AC-3 A clean UI write with no handover produces no new advisory line.
- AC-4 The design-pass reader still blocks nothing.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Every existing artefact reads stale on the first run after the change | implementation | An artefact written before the `inputs` field exists has no digests to compare, and treating absence as a mismatch would report stale for every pre-existing run | 2.2 makes a missing `inputs` key read unknown rather than stale | Phase 2 |
| 2 | The new advisory line becomes noise and the reader is switched off | product | The design-pass concern already names carrier abandonment as its own risk; an absent-artefact line on every UI turn is the cheapest way to earn it | 3.1 scopes absent-is-noteworthy to turns where a provided handover was actually detected | Phase 3 |
| 3 | Digesting inputs makes the probe measurably slower on a large reference | implementation | Hashing target, reference and declarations adds work to every probe run, including runs nobody will read | The digests are taken over input files the probe already opens, so no additional read is introduced | Phase 1 |
| 4 | `stale` is reported for a formatting-only change to the target | product | A digest moves on whitespace, so a reformat reports stale although no observed property changed, and a reader who learns to ignore it learns to ignore real movement | Accepted and stated: the line reports that inputs moved, never that evidence is wrong, and re-running the probe is cheap | Phase 2 |

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| Content digests over mtime | reuse the mtime rule the same file already applies to the audit artefact | mtime moves on a checkout or a touch and would report stale on turns nothing changed | A digest proves measurably slower than mtime on a real reference |
| Report stale instead of blocking | make a stale artefact refuse the turn | The reader is advisory by design and this roadmap adds no refusal surface | The advisory line is measured as ignored across real turns |
