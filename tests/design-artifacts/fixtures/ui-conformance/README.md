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
