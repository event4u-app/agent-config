---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Extends two archived roadmaps (behaviour-evidence-over-pixels, a-probe-that-cannot-report-a-false-green) whose closed criteria would read open if reopened. No active, parked or stub roadmap names the probe's handle gap, which its own header records as the state of every real run. Shadow-only: adds no gate, no setting and no coverage row."
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: extends
    note: "Archived. Built the conformance probe and its base fixture, keyed on `data-probe-id`. This adds one reading for the input that probe cannot compare — a handover with no handles — and leaves the five handle-keyed dimensions as they are."
  - slug: road-to-a-probe-that-cannot-report-a-false-green
    relation: extends
    note: "Archived. Made an empty reference report five not-applicable rows and added the no-handles fixture. Its invariant — no dimension is exercised on zero nodes — is kept: the new reading is a separate field, not a sixth dimension."
---
# Road to a structure reading without handles

> **Source:** `agents/tmp.old/inbox-2026-10-k/` — an external harvest round
> that built three prototypes against this tree's own design fixtures and
> kept the third. The third prototype was re-run on `main` @ `d41121927` on
> 2026-10-11 against `design.html` → `port-faithful.html` and
> `design.html` → `port-regenerated.html` at the probe's four widths and
> reproduced the round's table for both pairs exactly. Class: external harvest
> proposal, verified and reproduced against this tree.

## Goal

When a design handover carries no handles, the conformance probe still says
something true about static structure at each of its four widths: how many
rendered leaves of each kind there are, how many containers lay their
children out in a row or a column, and whether the page overflows
horizontally. It says it as counts, never as a score. It is silent on a
faithful port that restructures its wrappers and on a change in size or
spacing, and it stays in shadow.

## Context

- The probe compares nothing on real input. Its header: "no design handover in
  this tree carries a `data-probe-id` at all, so every real run still lands in
  the not-applicable branch" (`src/scripts/ui_conformance_probe.ts:58-59`). An
  empty reference yields `not_applicable` rows with `findings: null`
  (`:29`, `:306`), and a test holds that invariant
  (`tests/scripts/ui_conformance_probe.test.ts:148-152`). No active roadmap,
  parked roadmap or stub names the probe or its handles.
- Three constraints the tree already sets for anything that fills the gap:
  "NO AGGREGATE, ANYWHERE. Counters per dimension, never a single number"
  (`:27`); findings key "on the handle, never on the DOM node, so the wrapper
  and portal nodes a legitimate framework port inserts produce nothing"
  (`:54-55`); and a tolerance number "even flagged unmeasured, shapes
  behaviour" (`src/scripts/_lib/design_tolerance.ts:15`), which is why both
  tolerance keys ship `null`.
- The tree holds two controls for such a reading.
  `tests/design-artifacts/fixtures/ui-conformance/` has a reference without
  handles, planted defects (hover colour, a missing narrow-width media rule, a
  dead click handler, a missing element) and one declared deviation that must
  raise nothing. `tests/design-artifacts/fixtures/` has `design.html`,
  `port-faithful.html` (markup restructured the way a real port would be) and
  `port-regenerated.html`.
- Prototype 1, the form the round brought (an edge-density grid ignoring
  colour), failed the declared-deviation control at three of four widths and
  missed the removed element at 1440. Prototype 2 (a census by tag) passed that
  control and failed the faithful-port control: `div` 3 → 4, `main` 1 → 0 at
  all four widths, on a port the fixture labels faithful.
- Prototype 3 — wrapper-agnostic: per width, rendered leaves (elements with no
  rendered element child) counted by kind — control, heading, media, text —
  and a multiset of `<child count>:<row|column|mixed>` over containers with two
  or more rendered children, tags ignored, plus a horizontal-overflow flag. No
  coordinate or size is compared. Reproduced on `d41121927`:

  | Pair | leaves | arrangement | overflow |
  |---|---|---|---|
  | `design.html` → `port-faithful.html` | no change at any width | no change at any width | same at every width (both overflow at 320) |
  | `design.html` → `port-regenerated.html` | control 5 → 2, text 6 → 5, one empty leaf gone, at all four | changed at all four; `3:column` → `3:row` at 375 and 320 | false → true at 375 |

  The round also reports, from the no-handles fixture: nothing for the
  declared deviation, the renamed handle and the reference with handles; text
  2 → 1 at all four widths for the removed element; `2:column` → `2:row` at 375
  and 320 only for the missing media rule. Those rows were not re-run here.
  Two limits stay limits: hover colour and a dead click handler are behaviour
  and produce nothing, and in the combined variant the media-rule defect is
  masked once its container has lost a child.
- What shapes the change in the probe. The capture loads the page at
  `VIEWPORTS[0]` (`:611`) and sweeps widths only inside its per-handle loop
  (`:642-646`), so a page with no handles is never resized. `readObservation`
  is an unversioned cast (`:220`). The design-pass hook prints
  "`N` behavioural finding(s)" from the dimension rows
  (`src/scripts/hooks/design_pass_hook.ts:247`).

## Phase 1 — The expectation, registered before the code

- [x] **1.1 Today's answer is pinned.** A test asserts that a no-handles
      reference yields only `not_applicable` rows and no structural reading at
      all — the control every later step flips or keeps.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t no-handles-control --reporter=verbose` -> /✓.*no-handles-control/
- [x] **1.2 The table is pre-registered.** The table above and the fixture
      rows are added to the conformance fixture's README as the expectation,
      with the two limits and the two refuted prototypes and what refuted
      them. Three single-change variants — declared deviation only, missing
      media rule only, removed element only — are added beside the existing
      ones.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t signature-fixture-variants-exist --reporter=verbose` -> /✓.*signature-fixture-variants-exist/

## Phase 2 — The capture records a signature

- [x] **2.1 A sweep that does not need a handle.** The capture resizes the
      page to each of the four widths once, outside the per-handle loop, and
      records leaves by kind, the arrangement multiset and the overflow flag.
      It stores no coordinate and no size. An element with `display: none`,
      `visibility: hidden` or a zero box is not rendered.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t signature-captured-at-four-widths --reporter=verbose` -> /✓.*signature-captured-at-four-widths/
- [x] **2.2 An observation without a signature says so.** The committed
      observation files are re-captured with the signature. A file that lacks
      it yields `not_available` for the reading, never "no change". Positive
      control: one fixture observation with the field deleted.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t signature-absent-is-not-available --reporter=verbose` -> /✓.*signature-absent-is-not-available/

## Phase 3 — A field beside the five rows

- [x] **3.1 `page_signature` on the artefact, only without handles.** When the
      reference collected no handles, the artefact carries a top-level
      `page_signature` with, per width, the changed leaf kinds, the changed
      arrangement keys and the overflow pair. The five dimension rows, the
      findings list and the structure gate are unchanged, and the zero-nodes
      test passes untouched. With handles in the reference the field is
      absent.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t page-signature-field --reporter=verbose` -> /✓.*page-signature-field/
- [x] **3.2 Both controls and every registered row hold.** A test asserts each
      row of the pre-registered table, including the four that must be empty:
      the faithful port, the declared deviation, the renamed handle and the
      reference with handles.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t page-signature-table --reporter=verbose` -> /✓.*page-signature-table/
- [x] **3.3 The field states its scope.** It carries one fixed sentence: the
      reading names kinds of leaf and of container, not nodes; it cannot be
      matched to a declared deviation and is not a finding.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t page-signature-scope-sentence --reporter=verbose` -> /✓.*page-signature-scope-sentence/

## Phase 4 — The shadow reader prints one more line

- [x] **4.1 One line, after the existing ones.** When `page_signature` is
      present the design-pass hook prints it on its own line — the count of
      changed classes per width and the overflow pair — below the lines it
      prints today. The headline and the verdict are byte-identical to
      today's for the same artefact without the field.
      verify: `npx vitest run tests/hooks/design_pass.test.ts -t page-signature-line --reporter=verbose` -> /✓.*page-signature-line/
- [x] **4.2 The probe's header describes the run that exists.** The sentence
      that every real run "lands in the not-applicable branch" is followed by
      what such a run now reports and what it still cannot.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts -t header-names-page-signature --reporter=verbose` -> /✓.*header-names-page-signature/

## What this roadmap deliberately does not do

- No score, percentage, threshold or verdict word.
- No image or pixel comparison, and no comparison of coordinates or sizes.
- No inference of which reference node corresponds to which target node, and
  no sixth dimension.
- No gate. The probe keeps its "NOT A GATE" status and gains no coverage row.
- No new skill, command, rule or setting, and no stamping of handles.

## Acceptance Criteria

- [x] AC-1 — Without handles, the probe reports the removed element at all four
      widths and the missing narrow-width rule at 375 and 320 only, each on
      its single-change variant.
- [x] AC-2 — It reports nothing for the faithful port, the declared deviation
      and the renamed handle.
- [x] AC-3 — On the regenerated port it reports the lost controls and the
      overflow at 375.
- [x] AC-4 — The artefact carries no aggregate for the reading, and the
      zero-nodes invariant test is unmodified and green.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | No grid or pixel reading | Prototype 1 reported the declared deviation at three widths and missed the removed element at 1440 | A fixture shows the coordinate-free reading blind where a grid is not |
| D2 | reversible-technical | evidence | Ignore tags; count leaves by kind and arrangements by child count | Prototype 2 reported a faithful port as changed at all four widths; prototype 3 is silent on it and loud on the regenerated port (reproduced) | A faithful port is found that changes a leaf count |
| D3 | reversible-technical | evidence | A top-level field, not a dimension row | The zero-nodes invariant test asserts every row not-applicable | The five dimensions gain a handle-free mode of their own |
| D4 | reversible-technical | agent | Shadow only | Two fixtures are the whole evidence base, and a reading with no node scope cannot honour a declared deviation | The field has run on real handovers and its false-positive count is recorded |
| D5 | reversible-technical | agent | Ready now, ranked after the three consumer-facing roadmaps of the same round | The round recommended taking it up with the next design-fidelity work; its scope is small and fully pre-registered | — |
| D7 | reversible-technical | evidence | A control, a heading and a media element are one leaf each and are never descended into | The literal leaf reading makes `<button>Save</button>` a control and `<button><span>Save</span></button>` a text leaf in a container, so a span around a label — the commonest thing a faithful port does — reads as a lost control, which is the class D2 was decided against. Measured consequence: six of seven registered rows reproduce exactly and the seventh disagrees on one label only (`heading 5 to 4` where the table registered `text 6 to 5`), traceable to `<h1 class="wordmark">Led<em>ger</em></h1>` | A fixture lands that unwraps inline markup inside a heading or a control — the present one does not discriminate, since the faithful port keeps that markup verbatim — or a real handover produces a leaf-kind change only one of the two readings sees |
| D6 | deterministic | agent | Closure pass 2026-10-11: nine `unfalsifiable-verify` listings are `-t` titles the steps add to `ui_conformance_probe.test.ts` and `design_pass.test.ts`; each verify asserts a passing test of that title | `closure_scan` on this file: 9 listings, 0 owner questions | A step lands without the named test title |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The evidence base is two fixtures | product | One small card and one page say little about component libraries that render extra leaves, icons or portals. | Shadow only; D2 and D4 name what reopens the design; 3.3 labels every reading as kind-level. | Phase 3 — A field beside the five rows |
| 2 | A line nobody reads | product | The hook's shadow output is advisory and the field may be ignored. | 4.1 keeps it to one line; the cost of being ignored is one DOM walk per width. | Phase 4 — The shadow reader prints one more line |
| 3 | Masking reads as absence | implementation | A second defect behind a removed child is not reported. | 1.2 registers the limit and 3.3 repeats it on the field. | Phase 1 — The expectation, registered before the code |
| 4 | Re-captured observations change other tests | implementation | Observation files gain a field that older readers cast blindly. | 2.2 adds the absent-field branch and its positive control before any reader uses the field. | Phase 2 — The capture records a signature |

## Provenance

- The round's lesson: an external skill pack compares structure rather than
  colour when checking a rebuilt page. The idea survives; its mechanism (an
  edge-density grid with a 0–100 score) does not.
- No council was consulted. An independent review inside the round refuted its
  second prototype with this tree's own faithful-port fixture.

| Item from the round | Verdict | Where it lands |
|---|---|---|
| Compare structure, not colour | KEEP | Phases 2 and 3 — counts of kinds, not an image grid |
| The edge-density grid | CUT | D1 |
| A census by tag (loop 2) | CUT | D2 |
| Pin today's answer first (loop 2 step 1.1, dropped in loop 3) | FOLD | 1.1 |
| A 0–100 score with verdict words | CUT | The probe forbids an aggregate; tolerance keys ship `null` |
| Pixel mode for a build against its own earlier build | CUT | The host test runner's screenshot assertion already does that |
| Weighted feature-parity score over a matrix | CUT | No reader for it here |
