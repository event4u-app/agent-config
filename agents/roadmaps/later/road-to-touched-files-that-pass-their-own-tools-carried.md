---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-touched-files-that-pass-their-own-tools
entry_condition:
  what: the owner resolves blocker(s) touched-file-quality-default-is-an-owner-call
  when: whenever the owner takes the next step
  who: owner
review_by: 2026-12-31
estate_growth_exempt: >-
  Owner-chosen archive of road-to-touched-files-that-pass-their-own-tools: its deferred step waits on
  owner blocker(s) touched-file-quality-default-is-an-owner-call and is parked here instead of left
  active. The parent is archived in the same change, so the active count drops by one.
---
# Road to touched files that pass their own tools — carried

> **Source:** carried on 2026-10-06 from
> [`road-to-touched-files-that-pass-their-own-tools`](../archive/road-to-touched-files-that-pass-their-own-tools.md), which closed every other step.
> The step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. The blocker it names moved with it.

## Goal

The one step road-to-touched-files-that-pass-their-own-tools deferred is either done here or
explicitly disposed of — a step that still cannot run is re-deferred with its
reason, never left to read as finished.

## Phase 1 — Deferred steps carried from road-to-touched-files-that-pass-their-own-tools

- [ ] <!-- blocked-by: touched-file-quality-default-is-an-owner-call | asked: no — the step was already owner-routed in the parent and no new question is raised by moving it --> **2.3 Default `shadow` → `warn`.** Deferred in the parent because a
      shipped-default flip is an owner decision
      (`agents/roadmaps/stubs/road-to-discipline-default-flip.md`, which records
      the council's categorical Rule 3: an externally visible default change may
      only be transferred, never recorded as decided-and-done) and because it
      needed 2.1's reading first. **2.1's reading landed on 2026-10-06** —
      `agents/evidence/analysis/touched-file-quality-readings-2026-Q4.md` — so
      the second leg is discharged and only the owner's own act remains.
      The clause below checks the FIRST branch only — the shipped value moving off
      `"off"`. The second branch, a dated decision to keep it `off`, is deliberately
      not machine-checked: it is a sentence in a release record, and a clause that
      tried to match one would pass on any file mentioning the key. The blocker's
      `Resolved when` carries both branches; this clause is the falsifiable half.
      verify: `grep -c 'touched_file_quality: "off"' src/config/agent-settings.template.yml` -> /^0$/

## Blockers

### blocker: touched-file-quality-default-is-an-owner-call
- **Status:** open
- **Owner:** owner
- **Blocks:** 2.3
- **What to do:** decide the shipped default for
  `hooks.verify_before_complete.touched_file_quality`
  (`src/config/agent-settings.template.yml:1520`, currently `"off"`) — move it to
  `shadow`, move it to `warn`, or record a dated decision to keep it `off`.
- **Resolved when:** that line reads a value other than `"off"`, or the release
  record carries a dated decision to keep it `off`.
- **Recommendation:** **keep it `off` for now and fix the two soundness findings
  first.** The reading does not support a flip: over 30 real merged commits a
  `warn` default would have emitted **zero** advisory lines while costing ~3.5 s
  at 12 of those 30 stops. Two caveats cut in opposite directions and both are
  load-bearing — the zero is a **lower bound**, because merged commits are
  post-CI-green and a live stop is mid-edit, so the real rate is unknown and
  certainly above zero; but the upside is also **bounded by lint only**, because
  `tsc --noEmit` is `skipped: unscoped` on every row, so a genuine type error
  records `exit_code: 0`. And an eslint-ignored file records `exit_code: 0` too,
  shaped exactly like a pass, with no skip reason covering it. Flipping a default
  whose green can mean "never looked" ships a false assurance. Do **not** weigh
  the flip against the 243–322 ms figure from the 1.4 bench: it measured a
  synthetic five-file fixture and is ~11× below the real reading taken on this
  very repository.
- **If you do nothing:** the default stays `off`, which is the safe state — the
  record keeps its base-ref shape and no consumer pays the ~3.5 s. The cost of
  inaction is that the feature collects no field readings at all, since an
  opt-in feature observes nothing from non-adopters; the field counter stays
  structurally zero at any window length, and the circularity named in § 2 of
  the evidence page persists.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/drain-lane-f -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The carried step stays blocked indefinitely | implementation | A step deferred once for an owner decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-touched-files-that-pass-their-own-tools |
| 2 | The flip is taken on the superseded latency figure | implementation | The 1.4 bench published 243–322 ms for a synthetic fixture; the real repository reads 3,546 ms, and a reader who finds the bench first will price the decision ~11× too cheaply | The blocker's Recommendation names the superseded figure explicitly and says not to use it; the evidence page carries both readings side by side in § 4 | Phase 1 — Deferred steps carried from road-to-touched-files-that-pass-their-own-tools |

## Acceptance Criteria

- [ ] AC-1 — <!-- blocked-by: touched-file-quality-default-is-an-owner-call | asked: no — the step was already owner-routed in the parent and no new question is raised by moving it --> `src/config/agent-settings.template.yml` carries a `touched_file_quality` value other than `"off"`, or a dated decision to keep it `off` is recorded.
