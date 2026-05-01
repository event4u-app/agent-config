# ADR — Product UI Track: audit-as-hard-gate, design-review loop, stack dispatch

> **Status:** Decided · R3 Phases 1–6 shipped · 2026-05-01
> **Context:** [`ui-track-flow.md`](ui-track-flow.md) ·
> [`road-to-product-ui-track.md`](../roadmaps/road-to-product-ui-track.md) ·
> [`road-to-product-ui-track-followup.md`](../roadmaps/road-to-product-ui-track-followup.md)
> **Builds on:** [`adr-prompt-driven-execution.md`](adr-prompt-driven-execution.md)
> — R2 envelope routing and the band-action gate that R3 widens to UI.
> **Defers to:** Roadmap 4 (`road-to-visual-review-loop.md`, stub) for
> headless-browser screenshot capture and visual-regression assertions.

## Decision

R3 ships four directive sets — `backend` (R1/R2), **`ui`**, **`ui-trivial`**,
and **`mixed`** — dispatched at the engine boundary on
`state.directive_set`. The slot wiring is fixed by
[`directives/ui/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/__init__.py),
[`directives/ui_trivial/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui_trivial/__init__.py),
and [`directives/mixed/__init__.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/mixed/__init__.py);
the contract for each lives in [`ui-track-flow.md`](ui-track-flow.md).

The UI set drives `audit → design → apply → review → polish → report`
with three load-bearing properties:

1. **Existing-UI-audit is a hard gate.** No `apply` runs without
   `state.ui_audit` populated. The gate lives at directive level **and**
   at always-on rule level ([`ui-audit-before-build`](../../.agent-src.uncompressed/rules/ui-audit-before-build.md))
   so an agent acting outside the engine cannot bypass it.
2. **Design brief is locked microcopy.** `apply` consumes the brief
   verbatim — `PLACEHOLDER_PATTERNS` (`<placeholder>`, `lorem`, `todo:`,
   `tbd`, `xxx`) reject at producer and consumer.
3. **Polish has a hard 2-round ceiling.** Schema-level validation
   (`work_engine.state._validate_ui_polish`) rejects `rounds > 2` on
   disk; after round 2 the engine halts with ship-as-is / abort / hand-off.

Halt budget on the happy path: **2 user halts** — audit pick + design
sign-off. Apply / review / polish run silently when their producers
write clean envelopes.

## Why this was a real question

R1 + R2 produced a competent backend executor. UI work was the gap. The
package already shipped UI skills (`fe-design`, `blade-ui`, `livewire`,
`flux`) but they were flat tools: an agent could call `flux` directly,
write a component that duplicated three existing primitives, ignore the
project's design tokens, and ship microcopy with `<placeholder>` strings
intact. Tests passed; the result felt undesigned.

Three options were on the table:

1. **More UI skills, no directive set** — add `react-shadcn-ui`,
   `existing-ui-audit`, `ui-design-brief` as flat skills and let
   `/work` route to them via the existing dispatcher. Rejected:
   the audit step is the load-bearing piece, and a flat skill cannot
   enforce "no apply before audit". Rules can advise; only the
   dispatcher can refuse.
2. **One mega-skill (`product-ui`) that orchestrates internally** —
   single SKILL.md that runs audit → design → apply → review →
   polish in one shot. Rejected: the engine's halt-budget,
   sentinel-based replay, and Golden Transcript suite are designed
   for slot-level granularity. Folding five steps into one skill
   blinds the freeze-guard to mid-flow regressions.
3. **A new directive set per intent (chosen)** — `ui` for build /
   improve, `ui-trivial` for provably bounded edits, `mixed` for
   prompts that touch both layers. Adopted because each slot keeps
   its own sentinel, halt surface, and replay coverage; the audit
   gate is enforced at the dispatcher boundary and at the agent
   boundary; and stack-specific implementation is dispatched without
   widening the directive set.

## Audit as a hard gate (the load-bearing piece)

The Lovable-grade differentiator is **"audit existing UI first, design
before code, polish before ship"**. Everything in R3 follows from that.

The audit gate refuses `apply` until `state.ui_audit` is well-formed:
either `≥1 components_found` entry, or `greenfield=True` with a user-chosen
`greenfield_decision` ∈ `{scaffold, bare, external_reference}`. An empty
dict, `None`, or a populated dict without those keys is **not** findings;
the gate emits `@agent-directive: existing-ui-audit` and refuses to advance.

Two enforcement layers, deliberately redundant:

- **Dispatcher layer** —
  [`directives/ui/audit.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/audit.py)
  refuses to write `outcomes["refine"] = "success"` without a populated
  audit. Purely structural; no LLM, no heuristic.
- **Agent layer** — [`ui-audit-before-build`](../../.agent-src.uncompressed/rules/ui-audit-before-build.md)
  is an always-on rule that fires when the agent is about to write a
  component file outside the engine (free-form edit, side conversation,
  cloud surface). The rule encodes the same Iron Law in prose so cloud
  agents that don't ship the engine still honour it.

**Why two layers.** A single layer would leak: cloud surfaces and
free-form edits bypass the dispatcher entirely. A rule alone would not
hold under engine-driven runs because rules don't refuse exit codes.
Belt-and-suspenders is cheap (no shared state, no double-write) and
the failure modes are different enough to justify it.

### Confidence-path resolution

Audit findings carry a confidence label and per-candidate similarity.
[`directives/ui/audit.py::_decide_path`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/audit.py)
resolves to one of:

- `high_confidence` — confidence `high` + ≥1 match with similarity
  ≥ `STRONG_SIMILARITY = 0.7` and no runner-up within
  `TIE_GAP = 0.05`. Audit folds findings into the design brief — no
  separate halt.
- `ambiguous` — populated but below the high-confidence threshold or
  with a tie. Numbered-options halt records `audit_path = "ambiguous"`
  + `candidate_pick`.
- `greenfield` — no `components_found`, `greenfield = True`, user picks
  `scaffold` / `bare` / `external_reference`.

Constants are named, exported, and imported by tests so a re-tune
re-captures Goldens explicitly rather than drifting silently.

## Design-review polish loop

`apply` writes the rendered envelope. `review` (stack-dispatched) emits
`findings` + `review_clean`. `polish` runs a bounded fix loop with a
hard ceiling of `POLISH_CEILING = 2` rounds, validated at three layers
(in-memory state, on-disk schema, dispatcher).

| `review_clean` | `rounds` | Behaviour |
|---|---|---|
| `True` | any | `SUCCESS` — advance to report |
| `False` | `< 2` | `BLOCKED` + `@agent-directive: ui-polish-<stack>`; agent applies fixes, re-runs review, increments `rounds` |
| `False` | `== 2` | `BLOCKED` numbered options: ship-as-is / abort / hand off |

**Why ceiling at 2.** Three rounds is one round too many: by round 3
the agent is either making cosmetic tweaks the user can't notice, or
spinning on a design problem the engine cannot resolve. Halting at 2
hands the decision to the user with the cheapest possible context
(two completed rounds of evidence). Rate of false-ceiling-hits will
be visible in delivery reports; a tune to 3 stays a one-line constant
change with a Golden re-capture.

**Token-violation extraction.** Findings with `kind == "token_violation"`
carry `category` and `value`. Polish classifies against
`state.ui_audit.design_tokens`:

- Matched value → fix uses the named token.
- Unmatched value repeated > `TOKEN_REPEAT_THRESHOLD = 2` times →
  emits `polish_token_extraction_pending` to extract a new token
  before the next round runs. One-off unmatched values stay inline.

This is the only place R3 mutates the design system. It runs only
after a finding identifies a violation, and only when the same value
appears three or more times — single-use values are not worth the
ceremony.

## Halt budget — why max 2 on the happy path

The Lovable feel comes from "user decides once, agent runs". Three
halts (audit + design + polish-final) is the obvious shape but
empirically wrong: by the time polish needs sign-off, the user is
context-switched away. Two halts that pin the **decisive** choices
(which existing UI to extend, what microcopy to ship) buy the agent
the runway to finish silently.

Additional halts surface only on real ambiguity:
greenfield-undecided, shadcn-version-mismatch, audit-ambiguous,
placeholder rejection, polish round (per dirty review, capped at 2),
polish ceiling. GT-U11 (high-confidence) and GT-U12 (ambiguous) pin
the budget at 1 and 2 halts respectively; a regression that adds a
third halt fails replay.

## Trivial path and reclassification

For provably bounded edits (single class swap, copy tweak, one-prop
adjustment), the Phase-1 intent classifier writes
`directive_set = "ui-trivial"`. The slot wiring collapses to
`refine → ⊘ → ⊘ → ⊘ → apply → test → ⊘ → report` with
`MAX_FILES = 1` and `MAX_LINES_CHANGED = 5` enforced inside
[`directives/ui_trivial/apply.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui_trivial/apply.py).

**Mandatory reclassification at apply time.** When a trivial edit
exceeds the preconditions, apply flips
`state.directive_set = "ui"` and the dispatcher restarts at audit.
The reclassification is loud (delivery report records it) and
counted (delivery report tracks the rate). Silent skips are the
failure mode to watch for.

**Why the bypass exists.** Without it, "fix the typo on the login
button" runs the full audit + design loop. That is six halts the
user does not want to take. The bypass restores common sense without
weakening the audit gate — the gate stays in force whenever the
preconditions don't hold.

## Stack detection and dispatch

[`scripts/work_engine/stack/detect.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/stack/detect.py)
reads `composer.json` and `package.json` once, applies a four-rule
priority table, and writes `state.stack.frontend`:

1. `livewire/livewire` + `livewire/flux` → `blade-livewire-flux`
2. `react` + (`@radix-ui/*` OR `shadcn-ui` OR `components.json`) → `react-shadcn`
3. `vue` (any major) → `vue`
4. otherwise → `plain`

Cached on `state.stack` against the manifest `mtime`. A `composer.json`
or `package.json` change invalidates the cache; same conversation
re-detects on the next dispatch.

Errors (missing file, malformed JSON) downgrade to `plain` rather than
raising — a wrong stack label is recoverable (audit catches it, user
can override), a crash mid-dispatch is not.

`apply`, `review`, `polish` each route on `state.stack.frontend` to a
stack-specific directive (`ui-apply-blade-livewire-flux`,
`ui-apply-react-shadcn`, `ui-apply-vue`, `ui-apply-plain`). The
dispatch table shape is identical across all three slots; adding a
stack adds three rows, one per slot.

## fe-design migration — reference, not executor

`fe-design` previously functioned as both heuristics catalogue and
direct executor. R3 splits the responsibilities:

- **Reference (kept):** layout patterns, form / table design,
  responsive strategy, a11y heuristics. Cited by
  [`directives/ui/design.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/design.py).
- **Executor (removed):** code-writing responsibilities migrated to
  the stack-specific apply / review / polish skills (`flux`,
  `livewire`, `blade-ui`, `react-shadcn-ui`, `ui-apply-vue`).

The split lets the design step stay framework-agnostic while
implementation skills stay focused on a single stack's idioms.

## Mixed orchestration — contract first, then UI, then stitch

When a single input touches both layers, `mixed` runs
`refine → memory → analyze → contract → ui → stitch → verify → report`.
Sentinels:

- `state.contract.contract_confirmed` — UI sub-flow refuses to start
  without it (defense-in-depth even if `outcomes["plan"] == "success"`).
- `state.ui_review.review_clean` — mixed `ui` step's success condition.
- `state.stitch.verdict = "success"` — stitch's success condition;
  `blocked` / `partial` halts unless `state.stitch.integration_confirmed`
  flips.

**Why contract first.** UI shape and microcopy depend on the API
surface (field names, error codes, paginated vs streamed). Building
UI before locking the contract leads to two rounds of churn — once
when the contract surfaces a constraint the design ignored, once
when the integration test reveals a field-name mismatch. Locking
the contract first costs one halt and saves an entire polish round.

## Tradeoffs accepted

- **Three new directive sets** — bigger surface to maintain, more
  Goldens (12 GT-U entries vs. R2's 4 GT-P). Mitigated by shared
  refine/report handlers and the strict-verb replay harness.
- **Hard 2-round polish ceiling** — some legitimate edge cases
  (a11y compliance edits across multiple components) need 3 rounds.
  Mitigated by ship-as-is / hand-off as explicit user choices at
  the ceiling halt.
- **Stack detection is heuristic, not full-AST** — a project with
  `react` + `flux` (e.g. test scaffold) misclassifies as
  `react-shadcn`. Mitigated by user-override path: explicit `intent`
  in prompt overrides detection.
- **Two-layer audit enforcement** — duplicates the gate logic in
  rule prose and dispatcher Python. Accepted: cloud surfaces don't
  ship the engine, and engine-driven flows can't rely on rule
  enforcement. Both layers are needed; the cost is documentation.

## Non-goals

- Does **not** replace `/implement-ticket` or `/work` — same engine,
  new directive sets only.
- Does **not** introduce a `/build` or `/build-screen` entrypoint.
  Intent classification at refine is enough; new commands wait on
  evidence of mis-routing.
- Does **not** pin a removal date for `fe-design`; the reference
  positioning is stable.
- Does **not** ship visual review (headless browser, screenshot
  capture, a11y tooling) — Roadmap 4 stub.
- Does **not** ship project-local design-memory beyond what the
  audit step already extracts; the audit is the memory.

## Consequences — unblocks

- **Roadmap 4** (visual review loop) can register a post-polish
  visual-assertion step against the existing `state.ui_apply`
  envelope.
- **New stacks** (Svelte, SolidJS, Astro) plug in via the
  extension recipe ([`ui-stack-extension.md`](ui-stack-extension.md)) —
  detector heuristic + apply/review/polish skills + Golden fixture.
  No engine change.
- **Mixed entrypoints** (`/refactor`, `/spike`, future) compose by
  building a new envelope kind plus a new directive set; the audit
  gate is reusable when the work touches UI.

## Follow-ups (not part of this ADR)

- Track reclassification rate (`ui-trivial` → `ui` flips) in
  delivery reports; if > 30 % of trivial runs reclassify, the
  classifier needs tuning.
- Track polish-ceiling-hit rate; if > 10 % of UI runs hit the
  ceiling, raise to 3 with a Golden re-capture.
- Decide whether `state.ui_audit` should expire on long-running
  state files (currently sticky for the lifetime of the file).
- Evaluate whether `react-shadcn` should split into
  `react-shadcn-v2` / `react-shadcn-v3` once shadcn ships its next
  major; the audit version-mismatch warning surfaces this signal
  without forcing a split today.
