# UI-conformance fixture — four planted defects and one declared deviation

Phase 0 of `road-to-behaviour-evidence-over-pixels`. This directory exists
**before** the probe that reads it, so the comparison in Phase 6 is a prediction
rather than a retrofit.

The subject is narrow and worth stating plainly: a screenshot shows a resting
state. Hover, focus, keyboard, breakpoint behaviour and JavaScript are not in a
resting state, so a pixel comparison cannot see them however carefully it is
taken. This fixture is built to make that measurable instead of arguable.

## Layout

| Directory | What it is |
|---|---|
| `reference/` | The intended implementation. Every planted defect is a deliberate removal from this. |
| `variant-defects/` | Four planted defects plus one **declared** deviation. |
| `variant-renamed/` | Phase 0.3 — one element's identity renamed, styling byte-identical. |
| `reference-no-handles/` | D6 — the reference with every `data-probe-id` removed. Zero nodes on capture. |
| `variant-added/` | D7 — the reference plus one handle it does not carry. |
| `variant-no-handles-declared/` | D8 — no handles, the declared line-height deviation alone. |
| `variant-no-handles-media-rule/` | D9 — no handles, the missing narrow-width media block alone. |
| `variant-no-handles-removed/` | D10 — no handles, the removed `.badge` element alone. |

The last three are single-change variants: each carries exactly one difference
from `reference-no-handles/`, so a reading that fires on one of them cannot be
crediting a defect it did not isolate. `variant-defects/` carries all four at
once and is the wrong instrument for that question.

Nodes are keyed by `data-probe-id`, never by position or class. A probe that
matched nodes positionally would compare the renamed node against whatever sits
in its place and report style findings about the wrong element; keying on a
stable id is what makes `variant-renamed` a structure question rather than a
style question.

## The four planted defects

Each is named in a comment at the point of removal, so a later reader can tell a
planted defect from a bug in the fixture.

| id | Defect | Where | Dimension it should surface in |
|---|---|---|---|
| D1 | Missing hover colour — `.action:hover` removed | `variant-defects/styles.css` | `interaction` |
| D2 | Missing narrow-width media rule — the `max-width: 480px` block removed | `variant-defects/styles.css` | `viewport_matrix` |
| D3 | Dead click handler — the listener registration removed, button still rendered | `variant-defects/app.js` | `interaction` |
| D4 | Missing element — the `status-badge` span removed | `variant-defects/index.html` | `structure` |

And one deviation that is **not** a defect:

| id | Deviation | Where | Expected |
|---|---|---|---|
| DECL | `line-height` 24px → 28px, recorded in `conformance.declared.json` | `variant-defects/styles.css` | **Zero findings.** A run that reports this has failed the fixture exactly as badly as one that misses a defect. |

`variant-renamed/` carries a fifth case, D5: `data-probe-id="status-badge"`
becomes `status-chip`, the class stays `.badge`, and `styles.css` and `app.js`
are byte-identical copies of the reference. Its computed style is therefore
unchanged in every property, which is what makes it a clean test of the
structure gate.

## Pre-registered honest null for the screenshot arm

> **Registered 2026-09-13, before `ui_conformance_probe.ts` existed.** Written
> down first so Phase 6 reads a prediction. No number below may be revised after
> a probe run; if the probe's behaviour disagrees with this, the disagreement is
> the finding.

**The screenshot arm, defined precisely enough to be wrong.** The comparison is
against the review's actually-shipped practice, not an idealised one:
`src/skills/design-review/SKILL.md` Phase 0 (`Take baseline screenshot.`,
line 58) plus Phase 2 (`Take screenshots at each viewport.`, line 105) over the
four declared viewports — 1440, 768, 375 and 320px. Five captures, all of the
**resting** state: nothing hovers, nothing is focused, nothing is clicked, and
no media preference is emulated. A defect counts as caught when it produces a
visible pixel difference in at least one of those five captures.

**Prediction: the screenshot arm catches 2 of the 4 planted defects.**

| id | Predicted | Why |
|---|---|---|
| D1 hover colour | **miss** | Hover is never entered. The resting pixels are identical. |
| D2 narrow media rule | **catch** | At 375 and 320px the toolbar stays a row instead of stacking; the layout differs visibly. |
| D3 dead click handler | **miss** | The panel is `hidden` in both. Nothing is clicked, so the two captures are identical. |
| D4 missing element | **catch** | The badge is absent from the 1440px capture. |

**Second pre-registered figure: the screenshot arm raises 1 false positive.** It
has no channel through which a deviation can be declared, so the 24px → 28px
line-height change is reported as a difference like any other. This is not a
criticism of pixel comparison — it is the property that makes the two arms
measure different things, and it is registered here so Phase 6 cannot present it
as a discovery.

**What this pre-registration does not license.** It is a prediction about *this
fixture*, whose defects were chosen to span the four dimensions the probe
claims. It is not an estimate of how often real UI defects are invisible to a
screenshot, and no such rate is claimed anywhere from it. A fixture is a
sensitivity instrument, never a population.

**The bar Phase 6 is read against.** The probe supersedes the screenshot arm on
behaviour only if it catches strictly more than 2 of 4 **and** raises zero
findings for `DECL`. Anything less is a null, and a null is recorded as an
outcome rather than as a failure of the roadmap.

## Two cases the fixture had no directory for

Added by `road-to-a-probe-that-cannot-report-a-false-green`, and written here
**before** the probe changed, so the reading below is a prediction rather than a
transcription of what the new code happened to do.

| Directory | What it is | Pre-change reading, measured |
|---|---|---|
| `reference-no-handles/` | D6 — `reference/index.html` with every `data-probe-id` removed. The capture collects **zero** nodes. | Five rows of `status: "exercised"`, `findings: 0`, and `structure_gate: "passed"`. A comparison that never happened, reported as a clean one. |
| `variant-added/` | D7 — the reference plus one handle it does not carry, `extra-badge`. Stylesheet and script byte-identical to the reference. | **Zero findings.** The evaluation loop iterated `reference.nodes` only, so a node present only in the target was unreachable. |

Both pre-change readings were measured on the frozen observations at the branch
point and are recorded in the roadmap's Phase 1 evidence. Neither is a bug in
the fixture: they are the two states the probe's own header forbids and had
never been given.

- D6 — the expected reading after the change is five `status: "not_applicable"`
  rows carrying `findings: null` and a reason naming the **handover** (no
  `data-probe-id` in the reference) rather than the host, with
  `structure_gate: "stopped"` and `reference_nodes: 0`. A row reading
  `exercised` for this input is a test failure.
- D7 — the expected reading after the change is exactly **one** `structure` finding on `extra-badge`, absent in the reference and present in the target,
  with every other dimension still at zero and `structure_gate: "stopped"`. A
  wrapper node a framework port inserts carries no handle and must still
  produce nothing.

`variant-renamed/` changes reading as a consequence, and the change is intended:
a rename is an omission **and** an addition, so D5 now produces two `structure`
findings — `status-badge` absent, `status-chip` added — where it previously
produced one. The probe could see half of a rename; it can now see both halves.

## Measured baseline for the blocked demotion

Phase 4 of the roadmap — demoting the mandatory screenshot step — is blocked on
an owner decision (`screenshot-mandate-reopens-a-completed-decision`) and is not
done here. The measurement that phase depends on **is** done, because measuring
is not deciding, and the number is perishable:

```
$ grep -cnE 'Take (a )?(baseline )?screenshots?' src/skills/design-review/SKILL.md
2
```

Measured 2026-09-13 at the branch point: the regex matches exactly two lines,
`:58` and `:105`. This is recorded now because it is the pre-fix count AC-6
requires, and because the roadmap's own highest-value finding is that the
source's literal-string version of this check matched only one line each and
would have reported success before any work was done. If the file changes before
the owner decides, re-measure rather than quoting this line.

## The page signature — registered before the code that reads it

Added by `road-to-a-structure-reading-without-handles`, and written here
**before** `ui_conformance_probe.ts` learned to capture a signature, so the
table below is a prediction this fixture is read against rather than a
transcription of whatever the new code happened to produce.

**What the reading is.** Per width, three things and no others: how many
rendered leaves of each kind there are, a multiset of
`<child count>:<row|column|mixed>` over containers with two or more rendered
children, and whether the page overflows horizontally. A rendered leaf is an
element with no rendered element child; an element is not rendered when it is
`display: none`, `visibility: hidden`, or has a zero box. Tags are ignored. No
coordinate and no size is stored, and nothing is compared between a reference
node and a target node — there is no correspondence to compare.

**Where it applies.** Only when the reference collected zero handles. With
handles in the reference the five dimensions have a question to ask and this
reading is absent, which keeps it from being a sixth dimension by the back door.

### Registered table — the two port pairs

Reproduced by the harvest round on `main` @ `d41121927`, against
`tests/design-artifacts/fixtures/design.html` and its two ports, at the probe's
four widths.

| Pair | leaves | arrangement | overflow |
|---|---|---|---|
| `design.html` to `port-faithful.html` | no change at any width | no change at any width | same at every width (both overflow at 320) |
| `design.html` to `port-regenerated.html` | control 5 to 2, text 6 to 5, one empty leaf gone, at all four | changed at all four; `3:column` becomes `3:row` at 375 and 320 | false to true at 375 |

### Registered table — this directory

| Reference | Target | Registered reading |
|---|---|---|
| `reference-no-handles/` | `variant-no-handles-removed/` | text 2 to 1 at all four widths |
| `reference-no-handles/` | `variant-no-handles-media-rule/` | `2:column` becomes `2:row` at 375 and 320 only |
| `reference-no-handles/` | `variant-no-handles-declared/` | nothing at any width |
| `reference-no-handles/` | `variant-renamed/` | nothing at any width |
| `reference-no-handles/` | `reference/` | nothing at any width |
| `reference/` | anything | the field is absent — the reference carries handles |

The last four rows are the controls, and they carry more weight than the first
two. A reading that is loud about a real loss is worth nothing if it is also
loud about a faithful port, a declared change of size, a renamed handle or the
same page with handles attached: that is the failure mode that gets a signal
muted, and the directory is laid out so it is measured rather than hoped for.

### Two limits, registered as limits

1. **Behaviour produces nothing.** A removed hover colour and a dead click
   handler change no leaf, no arrangement and no overflow, so this reading is
   silent on D1 and D3 by construction. They remain the business of the
   `interaction` dimension, which needs handles.
2. **Masking reads as absence.** Once a container has lost a child it drops out
   of the arrangement multiset, so a second defect inside it is not reported.
   `variant-no-handles-removed/` is the canonical case: the toolbar falls to one
   rendered child, and a missing narrow-width media block inside that same
   toolbar would be invisible behind it. This is why the two defects are planted
   in separate directories here.

### Two refuted shapes, and what refuted them

Kept because a rejected prototype that leaves no record gets re-proposed.

| Shape | Refuted by |
|---|---|
| An edge-density grid over the rendered page, ignoring colour, reported as a number | It reported the declared deviation at three of the four widths and missed the removed element entirely at 1440. A reading that fires on a change of size and misses a missing element is measuring the wrong thing. |
| A census of rendered elements by tag name | It passed the declared-deviation control and failed the faithful-port one: `div` 3 to 4 and `main` 1 to 0 at all four widths, on a port this fixture's own name calls faithful. Tag names are the part of a port that legitimately changes. |

### What a disagreement means

No number above may be revised after a capture run. If the implementation
disagrees with a row, the disagreement is the finding and is recorded beside the
row — the registered number stays, and the measured one is added next to it.
