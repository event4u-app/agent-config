# Skill-catalogue delivery — pre-registered baseline

The measurement half of the frontend-skill-application work. Everything here is
fixed **before** a delivery or ownership fix lands, so a later rate can be
compared against something that was not chosen after seeing the result.

## The host boundary — why there is no `session_start` capture hook

The round-6 census asked for a `session_start` concern that logs the injected
skill-catalogue block. A concern cannot do that, and the tree already contains
the proof: the dispatcher envelope carries `session_id`, `source`, `cwd` and
`transcript_path`, and `preamble_byte_census.ts` verified independently that no
local transcript or file holds the request's system payload. A hook claiming to
"capture the catalogue" would be capturing something else under that name.

The capture is therefore two-sided, and each side is labelled as what it is:

| Side | Source | Status |
|---|---|---|
| Projection — which entries offer a `description:`, how long, which frontmatter keys, sorted position | `capture_skill_catalogue.ts` over the host-facing skill tree | deterministic, file-measurable |
| Observation — which entries actually arrived bare in a live session | a session reporting its own context | **self-report**, never enforcement |

The join of the two is the useful question: not *how many* are bare but **which
property separates bare from described**. That property is the selector, and a
delivery fix has to act on it.

## Pre-registered metrics

**UI turn.** Deterministic, from `src/scripts/_lib/ui_surface.ts` — the single
definition shared by the analyzer, the anti-slop hook and the route nudge. A
turn is UI-shaped when it writes a path matching `isUiPath` (the single-segment
extensions plus the compound `.blade.php` suffix, which the hook's original
regex could not match) or sits in a tree matching `isUiTreePath`.

**Consultation rate.** Share of UI turns where any of `fe-design`,
`existing-ui-audit`, `design-intelligence` or `design-review` was invoked, or
one of their reference files was read.

**Discharge rate.** Share of UI-write turns followed by a review verdict that is
either render-scoped or explicitly static-scoped — the two verdict shapes
`design-review-after-ui-write` defines. A "looks good" with neither scope named
counts as undischarged.

Both are computed over ≥ 20 captured UI sessions before any comparison is drawn.

## Baseline condition: design-quality pressure is zero on every path

Recorded so that a later A/B is not read as an upgrade of existing pressure. At
baseline, all three links of the chain are open:

- `lint_design_slop` defaults to exit 0 regardless of findings — advisory by
  council decision, not a CI block.
- The `design-slop` hook is default-OFF (`hooks.design_slop.enabled`), warn-only
  by construction, and bound only on hosts carrying a `pre_tool_use` slot.
- `design-review` itself does not fire, because nothing routes to it in an
  ad-hoc session.

Any measured movement after a fix is therefore movement from zero, not an
increment on an existing control.

## Observation 1 — 2026-08-12, host `claude`

First observation recorded to `agents/evidence/metrics/skill-catalogue.jsonl`.
Partial by construction: 16 entries observed bare, 19 observed described, out of
336 projected entries.

**Verdict: `no-selector`.** No measured property separates the two groups.

The first three rows below are the tool's own candidate output, quoted. The
fourth is **derived, not quoted**, and the distinction matters in a document
whose purpose is that later numbers be comparable against something measured:
`analyzeSelector` only emits a `frontmatter:<key>` candidate when that key
*does* separate, so "no frontmatter key separates" is read off the **absence**
of any such row, never printed as one.

| Candidate | Separates | Source | What the data says |
|---|---|---|---|
| `declares-description` | no | tool | 16/16 bare entries **do** declare a `description:` in their projected `SKILL.md` — the projection is not the cause |
| `positional-head` | no | tool | described entries reach position #325 while bare entries start at #45; the ranges overlap, so no head-N budget explains the split |
| `description-length` | no | tool | length ranges overlap |
| any frontmatter key | no | derived from absence | no `frontmatter:<key>` candidate was emitted, which is how the tool reports that no key tracks the split |

Reproduce it: the observation inputs are the two files under
`agents/evidence/metrics/skill-catalogue/` and the record is the append-only
`agents/evidence/metrics/skill-catalogue.jsonl`; all three are tracked. Re-run
`./scripts-run src/scripts/capture_skill_catalogue --observed <bare> --described <described>`
to recompute the verdict rather than re-reading the prose that asserts it.

**Consequence, stated because it is load-bearing.** The census's strongest
hypothesis — a fixed head-N description budget, with priority ordering as the
fix — is refuted on this evidence. A delivery fix chosen today would be chosen
without a mechanism to act on. That is why the delivery phase stays blocked on
more observations rather than proceeding on the hypothesis.

**What would change the verdict.** More observations from more hosts and more
session shapes; a property the analyzer does not yet test (it tests description
presence, description length, sorted position, and frontmatter-key presence);
or a host-side statement of how the catalogue is assembled. Absent any of those,
the honest position is that the selector is host-internal.

All eight design surfaces are in the bare set: `dashboard-design`,
`design-intelligence`, `design-review`, `design-system-capture`, `design-tokens`,
`design-variations`, `existing-ui-audit`, `fe-design`.

## Shared fixtures

The UI-turn corpus reuses the `bench:ui` fixture set rather than authoring a
second one, so a single measurement window serves both the consultation
question here and the builder/grader tier question parked on that harness.

## Privacy

An observation record carries a schema version, a date, a host label, integer
counts, the bare-entry names and the verdict. The record type has **no field**
able to hold prompt text, file bodies, or paths outside the catalogue — the same
exclusion-by-construction `domain-safety-pii` § Surface 2 requires of a log
event. Do not widen it with a free-form field.
