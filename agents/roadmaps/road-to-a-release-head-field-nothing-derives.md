---
complexity: lightweight
status: draft
estate_offset_exempt: "Draft, so the count half reports +0 active; the file-based one-in-one-out half fires on the added file regardless of status, and this exemption answers that half. The subject is a shipped release-truth defect found by three independent reviewers in one round, and it has no existing owner in the estate — no stub, no later/ entry, nothing under agents/roadmaps/ mentions the Known-limitations field."
execution:
  mode: phase-checkpoints
---
# Road to a release head field nothing derives

> **Source:** `agents/tmp.old/inbox-2026-09-aa/` — a round of fourteen
> independent external reviews of the 14.23.0 → 15.0.0 → 16.0.0 window. Three
> of the fourteen raised this field independently; one called it *"der klarste
> Fehler im 16.0 Release-PR"*. Verified against the tree at `58f1f2ae2`, after
> PR #2017 merged, so the defect below is published rather than proposed.

## Goal

`Known limitations` in a release head either names a limitation the span's own
code documents, or says `_none_` because a derivation looked and found none.
Today it is the one curated label of five that nothing derives, so `_none_` is
what it prints when nobody writes anything — and that is what 15.0.0 and 16.0.0
both shipped while the code they shipped documented its own residuals. When
this is finished, a reader can tell the difference between "no limitations were
found" and "no one filled the field in".

## Context — what was verified, and where

The generator is honest about the gap and names it twice in its own source:

- `src/scripts/_lib/release_highlights.ts:184` — *"a label absent here is never
  derived (`Known limitations` is pure prose, not checkable)"*.
- `src/scripts/_lib/release_highlights.ts:207` — *"Known limitations: never
  derived — pure prose, not gate-checkable."*
- `_DERIVED_REASON` (`:186-191`) carries four entries. The fifth label has none.

The consequence is in two published heads:

- `CHANGELOG.md:686` — 16.0.0 ships `- **Known limitations:** _none_`.
- `docs/archive/CHANGELOG-pre-16.0.0.md:24` — 15.0.0 ships the same line.

And the same span's own code documents two residuals of a detector that
shipped **in** 16.0.0:

- `src/scripts/_lib/dropped_decision.ts:86-87` — blockquoted ask illustrations
  are not excluded, while fenced ones are.
- `src/scripts/_lib/dropped_decision.ts:90` — a genuine user turn carrying no
  `type: 'text'` block does not reset the turn boundary.

The module header states why the other four labels were made derivable: the
generator used to emit `_none_` for all five while the gate rejected exactly
that default once the span carried evidence, so *"the generator no longer
manufactures a claim it cannot support"* (`:20-21`). That sentence is now true
of four labels and false of the fifth.

## Phase 1 — Make the field falsifiable

- [ ] **1.1 Derive known-limitation candidates from the span, the way the other
      four labels are derived.** Add a `Known limitations` entry to
      `_DERIVED_REASON` and a matching rule in the derivation: a commit whose
      subject or body, or a file the commit touches, carries a self-declared
      residual — the forms this tree already uses are *"the residual limit,
      named rather than left to be discovered"*, *"known limit"*, *"does not
      yet"*, *"is not covered"*, *"not excluded and tested"*. The pattern list
      is the load-bearing part and belongs beside `_NULL_FORMS`, in the same
      shape and with the same commented false-positive reasoning.
      verify: `./scripts-run src/scripts/_lib/release_highlights` has no CLI, so
      the check is the unit test — a fixture span containing the 16.0.0
      detector-E commit derives at least one candidate, and a fixture span of
      pure chore commits derives none.

- [ ] **1.2 Prove the derivation on the two spans that shipped `_none_`.** Run
      the new derivation over `15.0.0..16.0.0` and over the 14.23.0 → 15.0.0
      span and record what it returns for each.
      verify: the run over `15.0.0..16.0.0` names the `dropped_decision.ts`
      residuals; the output is pasted into the evidence record, both spans, with
      the commands that produced it.

- [ ] **1.3 Refuse `_none_` when the derivation found candidates.** Extend the
      head gate the module header already describes — the one built for *"a
      human editing a substantiated line back down to `_none_`"* — so it covers
      the fifth label on the same terms as the other four.
      verify: a fixture head carrying `Known limitations: _none_` over a span
      with a derived candidate exits non-zero and names the candidate; the same
      head over a span with no candidate exits 0. Sensitivity proven in both
      directions.

## Phase 2 — Correct the two published heads

- [ ] **2.1 Replace `_none_` in the 16.0.0 and 15.0.0 heads with what the
      derivation returns.** One in-place head correction each, naming the
      residuals and not rewriting anything else in those sections.
      verify: `grep -n 'Known limitations' CHANGELOG.md docs/archive/CHANGELOG-pre-16.0.0.md`
      returns no `_none_` for either version, and the new text names a residual
      that `git grep` finds at a real `file:line` in the corresponding span.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The pattern list fires on prose that is not a limitation | implementation | The tree is dense with hedged, honest prose — "the residual limit", "stated rather than implied" — and a broad pattern turns every careful sentence into a release-head limitation, which makes the field noise and gets it ignored exactly like `_none_` did | Step 1.2 runs the derivation over two real spans before any gate exists, and the output is read rather than assumed; if the candidate set is dominated by prose that is not a limitation, the pattern narrows or the step lands as a reporter and not a gate | Phase 1 — Make the field falsifiable |
| 2 | The derivation finds nothing on a span that genuinely has limitations | implementation | A self-declared residual is only detectable when someone wrote it down, so a limitation nobody documented stays invisible and the field prints a derived `_none_` that reads stronger than the undefended one it replaced | The reason string the gate prints says which — "no candidate derived" is not "no limitations exist", and step 1.3's message carries that distinction verbatim | Phase 1 — Make the field falsifiable |
| 3 | The head correction is read as rewriting release history | product | Editing a published CHANGELOG section is the shape this repo treats carefully, and a correction that looks like a quiet rewrite costs more trust than the wrong field did | Step 2.1 is additive in substance — the `_none_` claim is replaced by a named residual and nothing else in the section moves; the diff is one line per version | Phase 2 — Correct the two published heads |

## Acceptance Criteria

- [ ] AC-1 — `Known limitations` has an entry in `_DERIVED_REASON` and a
      derivation rule, so all five curated labels are derived from the span
      rather than four of five.
- [ ] AC-2 — A head that says `_none_` over a span carrying a derived candidate
      is refused, and the refusal names the candidate.
- [ ] AC-3 — Neither the 16.0.0 nor the 15.0.0 head says
      `Known limitations: _none_`, and the text that replaced it names a
      residual findable at a real `file:line` in that span.
- [ ] AC-4 — The evidence record carries the derivation's output over both
      spans with the commands that produced it, so a later reader can re-run
      the measurement rather than trust the summary.
