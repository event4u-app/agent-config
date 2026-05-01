# UI Track — Flow Contract

> Technical contracts for the UI directive sets shipped under
> [`road-to-product-ui-track.md`](../roadmaps/road-to-product-ui-track.md).
> Sibling of [`implement-ticket-flow.md`](implement-ticket-flow.md) — that
> doc covers `backend`; this one covers `ui`, `ui-trivial`, and the
> `mixed` set that stitches both.
>
> - **Created:** 2026-05-01
> - **Status:** Phase 1–6 shipped — audit / design / apply / review /
>   polish handlers live under
>   [`.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/).
>   Mixed (Phase 4) under `directives/mixed/`. `ui-trivial` (Phase 2 Step 6)
>   under `directives/ui_trivial/`. R4 (Visual Review Loop) added the
>   a11y gate, the preview envelope, and a polish-termination rewrite
>   that splits subjective ceilings from objective a11y blocks — see
>   [`road-to-visual-review-loop.md`](../roadmaps/road-to-visual-review-loop.md).
>   Golden Transcripts GT-U1..U4, U7, U8, U9..U12 plus GT-U5 (mixed
>   flow), GT-U6A/B (stack dispatch), and R4's GT-U13..U15 (a11y polish,
>   a11y ceiling, preview render failure) pin happy-path, ambiguity,
>   mixed orchestration, stack dispatch, trivial happy path, and the
>   visual-review gates.
> - **Runtime:** Python 3.10+. Same `DeliveryState` envelope, same
>   eight-slot dispatcher as the backend track — only the slot handlers
>   differ.

## What this doc is

The **shape** of the four UI-related directive sets: which slot runs
which handler, what each handler reads / writes on `DeliveryState`, the
hard thresholds (similarity, polish ceiling, trivial limits), and the
sentinels that release each gate.

## What this doc is *not*

- A skill spec — `existing-ui-audit`, `ui-design-brief`, the stack
  apply / review / polish skills are documented in their own
  `SKILL.md` files.
- A migration guide for the schema — see
  [`implement-ticket-flow.md`](implement-ticket-flow.md#state-schema-v1).
- A roadmap — phased delivery lives in
  [`road-to-product-ui-track.md`](../roadmaps/road-to-product-ui-track.md).

## The four directive sets

| Set | When picked | Slot 1–8 |
|---|---|---|
| `backend` | Default — no UI keywords, no UI envelope | `refine → memory → analyze → plan → implement → test → verify → report` (see sibling doc) |
| `ui` | UI keywords, `improve` envelope, or refine routing to UI | `audit → ⊘ → design → ⊘ → apply → review → polish → report` |
| `ui-trivial` | Phase-1 classifier hits "single-line tweak" pattern | `refine → ⊘ → ⊘ → ⊘ → apply → test → ⊘ → report` |
| `mixed` | Backend + UI in one input | `refine → memory → analyze → contract → ui → stitch → verify → report` |

`⊘` = `_passthrough.run` (or `_skipped.run` in `ui-trivial`). The slot
exists so the dispatcher's completeness check is satisfied; no logic
runs and no state is touched.

Source of truth for slot wiring:
[`directives/ui/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/__init__.py),
[`directives/mixed/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/mixed/__init__.py),
[`directives/ui_trivial/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui_trivial/__init__.py).

## The `ui` set — slot-by-slot

### `refine` → audit

Mandatory pre-step. Routes on `state.ui_audit` shape:

| State | Outcome | Handler |
|---|---|---|
| `None` / empty / non-dict | `BLOCKED` + `@agent-directive: existing-ui-audit` | First-pass delegation |
| `greenfield=True`, no `greenfield_decision` | `BLOCKED` numbered options | User picks `scaffold` / `bare` / `external_reference` |
| `shadcn_inventory.version` major ≠ `TESTED_AGAINST_SHADCN_MAJOR` (`2`) and no `version_mismatch_decision` | `BLOCKED` soft halt | "Cautious composition / abort" |
| Confidence `high` + ≥1 match with similarity ≥ `STRONG_SIMILARITY` (`0.7`) and no runner-up within `TIE_GAP` (`0.05`) | `SUCCESS`, `audit_path = "high_confidence"` | Design folds findings into brief |
| Anything else populated | `BLOCKED` numbered options | User picks candidate to extend (or "build new"); records `audit_path = "ambiguous"` + `candidate_pick` |

Constants live in
[`directives/ui/audit.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/audit.py):
`STRONG_SIMILARITY = 0.7`, `TIE_GAP = 0.05`,
`TESTED_AGAINST_SHADCN_MAJOR = 2`. Idempotent re-entry: once
`audit_path` is set the step round-trips through `SUCCESS` without
re-emitting.

### `analyze` → design

Produces the **locked design brief**. `apply` consumes microcopy
verbatim — that's the lock.

Required brief keys (`REQUIRED_BRIEF_KEYS`): `layout`, `components`,
`states`, `microcopy`, `a11y`. Required state coverage
(`REQUIRED_STATE_KEYS`): `empty`, `loading`, `error`, `success`,
`disabled`.

Microcopy is rejected when any string matches `PLACEHOLDER_PATTERNS`:
`<placeholder>`, `lorem`, `todo:`, `tbd`, `xxx` (case-insensitive
substring). The same tuple is re-imported by `apply` so the rejection
fires at the producer first, at the consumer as defense-in-depth.

Sentinel: `state.ui_design.design_confirmed`. Without it the brief
halt fires every pass; with it the step round-trips through `SUCCESS`.

### `implement` → apply

Stack-dispatched. Routes on `state.stack.frontend`:

| `state.stack.frontend` | Directive | Skill bundle |
|---|---|---|
| `blade-livewire-flux` | `ui-apply-blade-livewire-flux` | `flux` + `livewire` + `blade-ui` |
| `react-shadcn` | `ui-apply-react-shadcn` | `react-shadcn-ui` |
| `vue` | `ui-apply-vue` | `ui-apply-vue` |
| `plain` (or unknown — `DEFAULT_DIRECTIVE`) | `ui-apply-plain` | `blade-ui` + Tailwind base |

Apply does **not** re-validate the brief — it validates *output* against
`PLACEHOLDER_PATTERNS`. A hallucinated `<placeholder>` string in the
rendered envelope triggers
`apply_placeholders_in_output` and forces re-render with the locked
microcopy. Once `state.ticket["ui_apply"]` is well-formed, apply records
changes and returns `SUCCESS`.

### `test` → review

Stack-dispatched design-review pass. Same dispatch table shape as
apply, prefix `ui-design-review-`. Writes
`state.ui_review.findings` (list) + `state.ui_review.review_clean`
(bool). The step does **not** enforce
`review_clean == (len(findings) == 0)` — that would block the
legitimate "ship as-is with open findings" replay path. Honesty of the
flag is the producer's contract; review only validates shape.

**R4 — a11y gate** (after the basic clean/findings gates pass).
`_apply_a11y_gate` reads `state.ui_review.a11y.violations`, filters
out entries already in `state.ui_audit.a11y_baseline` (pre-existing
violations stay informational, never block), drops anything below
`severity_floor` (default `moderate`; unknown severities default to
`moderate` so a malformed envelope cannot weaken the gate), and
filters entries listed in `state.ui_review.a11y.accepted_violations`
(idempotent re-entry after the polish-ceiling Accept choice).
Surviving violations are synthesised as
`{kind: "a11y_violation", rule, selector, severity}` findings (deduped
by `(rule, selector)`) and `review_clean` is forced to `False`
engine-side. Opt-in: when `state.ui_audit.a11y_baseline` exists but
`state.ui_review.a11y` is missing, the step halts with
`review_a11y_pending` so the skill writes the envelope on the next
pass; pre-R4 envelopes without a baseline bypass the gate entirely.

**R4 — preview envelope** (the engine never renders).
`_apply_preview_gate` reads `state.ui_review.preview`. Shape:
`render_ok: bool`, optional `screenshot_path`, `dom_dump_path`,
`error`, `skipped`. `render_ok: False` halts with
`preview_render_failed` so the user picks retry / skip / abort; Skip
flips `state.ui_review.preview.skipped = true` and the gate becomes a
no-op on re-entry. `render_ok: True` with `screenshot_path` set
threads the path into the delivery report's `artifacts` list. The
gate is independent of the a11y gate; both can fire on the same pass.

### `verify` → polish

Bounded fix loop. Base ceiling: `POLISH_CEILING = 2` rounds. R4
splits termination into **subjective** and **objective** branches:
the subjective `polish_ceiling_reached` halt only fires when the
remaining findings are non-a11y; objective a11y violations take the
explicit `polish_a11y_blocking` branch with its own option set.

| `review_clean` | `rounds` | Remaining findings | Behaviour |
|---|---|---|---|
| `True` | any | — | `SUCCESS` — advance to report |
| `False` | `< effective_ceiling` | any | `BLOCKED` + `@agent-directive: ui-polish-<stack>`; skill applies fixes, re-runs review, increments `rounds` |
| `False` | `== effective_ceiling` | contains `a11y_violation` | `BLOCKED` numbered options: extend (one extra round, sets `extension_used = True`; option disappears once spent) / accept (appends rule ids to `state.ui_review.a11y.accepted_violations`, then continues) / abort |
| `False` | `== effective_ceiling` | non-a11y only | `BLOCKED` numbered options: ship as-is / abort / hand off |

`effective_ceiling = POLISH_CEILING + 1` once
`state.ui_polish.extension_used` is set; the schema validator widens
the upper bound from `[0, 2]` to `[0, 3]` only when the flag is
`True`, so the ceiling holds across in-memory state, on-disk state,
and the dispatcher. `rounds > 3` is rejected unconditionally, even
with the extension flag.

**Idempotent re-entry on Accept.** A `state.ui_review.a11y.accepted_violations`
list with rule ids matching the remaining a11y findings round-trips
through `SUCCESS` because the review gate's `_apply_a11y_gate`
filters accepted entries before synthesising `a11y_violation`
findings. The Accept branch and the Ship-as-is branch are therefore
asymmetric: Ship-as-is flips `review_clean` directly; Accept records
explicit rule ids so replay reproduces the same gate decision.

**Token-violation extraction.** Findings with
`kind == "token_violation"` carry `category` and `value`. Polish
classifies them against `state.ui_audit.design_tokens`:

- Matched value → fix uses the named token; counted as a regular round.
- Unmatched value repeated `> TOKEN_REPEAT_THRESHOLD` (`2`) times →
  emits `polish_token_extraction_pending`: extract the value to a new
  token before the next round runs. One-off unmatched values stay
  inline.

Stack-directive table mirrors apply / review with prefix
`ui-polish-`. `DEFAULT_DIRECTIVE = "ui-polish-plain"`.

### `report` → backend renderer

Re-export of
[`directives.backend.report.run`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/backend/report.py).
The renderer is pure and state-driven; the same Markdown contract
serves both tracks.

## Halt budget — happy path

`ui` set, fresh state, audit + design pass cleanly:

1. **Audit pick** — first-pass `existing-ui-audit` directive halt.
2. **Design sign-off** — `design_confirmed` numbered-options halt.

Two user halts. Apply / review / polish all run silently when their
producers write clean envelopes on the first attempt. GT-U1..U4 pin
this budget.

Additional halts surface only on real ambiguity:
greenfield-undecided (+1), shadcn-version-mismatch (+1), audit-ambiguous
(+1), placeholder rejection (+N until microcopy is fixed),
polish round (+1 per dirty review, capped at the effective ceiling),
polish ceiling — subjective (+1 when both rounds fail and remaining
findings are non-a11y) **or** a11y-blocking (+1 when remaining
findings include `a11y_violation` entries; the Extend option grants
one extra round, then disappears),
preview render failure (+1 when `state.ui_review.preview.render_ok`
is `False`; user picks retry / skip / abort),
review a11y pending (+1 when an `a11y_baseline` exists but the review
skill has not yet written `state.ui_review.a11y`).

## The `ui-trivial` set — short-circuit path

For provably bounded edits (single class swap, copy tweak, one-prop
adjustment). Phase-1 intent classifier writes
`directive_set = "ui-trivial"`.

Hard preconditions in
[`directives/ui_trivial/apply.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui_trivial/apply.py):

- `MAX_FILES = 1` — exactly one file touched.
- `MAX_LINES_CHANGED = 5` — diff stays under five changed lines.

Violation flips `state.directive_set` to `ui` (the full audit gate)
and the dispatcher restarts. The trivial path **never** silently
swallows scope creep.

Skipped slots (`memory`, `analyze`, `plan`, `verify`) share
`_skipped.run` — they record `success` without work so the dispatcher
completeness check is satisfied. `report` renders a one-line summary
instead of the full delivery report.

## The `mixed` set — contract + UI + stitch

Used when a single input touches both layers. Slot mapping:

| Slot | Handler | Purpose |
|---|---|---|
| `refine`, `memory`, `analyze`, `verify`, `report` | reused from `backend` | Same handlers, by reference |
| `plan` | `mixed.contract` | Lock `data_model` + `api_surface` |
| `implement` | `mixed.ui` | Delegate to UI sub-flow |
| `test` | `mixed.stitch` | End-to-end smoke scenarios |

**Sentinels** that release each mixed gate:

- `state.contract.contract_confirmed = True` — UI sub-flow refuses to
  start without it (defense-in-depth even if `outcomes["plan"] ==
  "success"`). Required keys: `data_model`, `api_surface`
  (`REQUIRED_CONTRACT_KEYS`).
- `state.ui_review.review_clean = True` — mixed `ui` step's success
  condition. Polish-ceiling semantics live in the UI track; if the
  user reaches mixed.ui's "ship as-is / hand off / abort" halt, the
  UI track has already given up.
- `state.stitch.verdict = "success"` — stitch's success condition.
  `blocked` / `partial` halts with three numbered options unless
  `state.stitch.integration_confirmed = True` (explicit user override).

`stitch` emits `@agent-directive: integration-test` so an
agent-side handler runs the end-to-end smokes; `mixed.ui` emits
`@agent-directive: ui-track` to delegate the visible-surface work
back into the full UI directive set.

## Idempotency and replay

Every UI step is idempotent on its sentinel:

| Step | Sentinel | Effect on replay |
|---|---|---|
| audit | `audit_path` ∈ `{"high_confidence", "ambiguous", "greenfield"}` | `SUCCESS` without halt |
| design | `design_confirmed = True` | `SUCCESS` without halt |
| apply | `state.ticket["ui_apply"]` well-formed, no placeholders | `SUCCESS`, changes recorded once |
| review | well-formed envelope (`findings` list + `review_clean` bool) | `SUCCESS` |
| polish | `review_clean = True` (any round count) | `SUCCESS` |
| contract | `contract_confirmed = True` | `SUCCESS` |
| stitch | `verdict = "success"` OR `integration_confirmed = True` | `SUCCESS` |

The dispatcher walks the same eight slots on every replay; sentinels
are the only thing keeping a re-run from re-asking a question the
user already answered. Replay coverage is locked by the
Golden-Transcript suite under `tests/golden/baseline/GT-U*/`.

## Declared ambiguity surfaces

Each step re-exports an `AMBIGUITIES: tuple[dict[str, str], ...]`
constant. The
[`test_ambiguity_coverage.py`](../../tests/implement_ticket/test_ambiguity_coverage.py)
suite asserts every `BLOCKED` path has a matching declaration.

| Step | Codes |
|---|---|
| `audit` | `audit_missing`, `greenfield_undecided`, `shadcn_version_mismatch`, `audit_ambiguous` |
| `design` | `design_missing`, `design_placeholders`, `design_unconfirmed` |
| `apply` | `apply_envelope_missing`, `apply_placeholders_in_output` |
| `review` | `review_envelope_missing`, `review_findings_missing`, `review_clean_missing`, `review_a11y_pending`, `preview_render_failed` |
| `polish` | `polish_round_pending`, `polish_ceiling_reached`, `polish_a11y_blocking`, `polish_token_extraction_pending` |
| `contract` (mixed) | `upstream_analyze_failed`, `contract_missing`, `contract_incomplete`, `contract_unconfirmed` |
| `mixed.ui` | `contract_sentinel_missing`, `ui_subflow_missing`, `ui_subflow_dirty` |
| `stitch` | `upstream_ui_failed`, `stitch_missing`, `stitch_malformed`, `stitch_verdict_unsuccessful` |

## See also

- [`implement-ticket-flow.md`](implement-ticket-flow.md) — sibling
  contract for the `backend` set; covers `DeliveryState`, schema v1,
  hooks, persona policies, replay protocol.
- [`road-to-product-ui-track.md`](../roadmaps/road-to-product-ui-track.md)
  — phased delivery and Golden-Transcript matrix.
- [`road-to-product-ui-track-followup.md`](../roadmaps/archive/road-to-product-ui-track-followup.md)
  — pinned GT-U5 (mixed flow), GT-U6A/B (stack dispatch), GT-U7
  (trivial happy path), GT-U8 (trivial reclassification).
- [`road-to-visual-review-loop.md`](../roadmaps/road-to-visual-review-loop.md)
  — R4 contract: a11y gate, preview envelope, polish-termination
  rewrite. Pinned by GT-U13 (a11y polish), GT-U14 (a11y ceiling),
  GT-U15 (preview render failure).
- [`existing-ui-audit` SKILL](../../.agent-src.uncompressed/skills/existing-ui-audit/SKILL.md)
  — producer of `state.ui_audit`.
- [`ui-audit-before-build` rule](../../.agent-src.uncompressed/rules/ui-audit-before-build.md)
  — the always-on rule that mirrors the audit gate at the agent layer.
