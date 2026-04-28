# ADR — Prompt-Driven Execution: `/work` and the confidence-band gate

> **Status:** Decided · R2 Phases 1–6 shipped · 2026-04-28
> **Context:** [`implement-ticket-flow.md`](implement-ticket-flow.md) ·
> [`road-to-prompt-driven-execution.md`](../roadmaps/archive/road-to-prompt-driven-execution.md)
> **Builds on:** [`adr-work-engine-rename.md`](adr-work-engine-rename.md) —
> the universal-dispatcher refactor that this entrypoint slots into.
> **Defers to:** Roadmap 3 (`road-to-product-ui-track.md`) for UI- and
> mixed-intent prompts; this ADR is backend-only.

## Decision

A second top-level slash command, **`/work`**, drives a free-form prompt
through the same `work_engine` dispatcher that backs `/implement-ticket`.
The two commands differ only in the input envelope they build:

| Command | Subcommand | Envelope | Trigger |
|---|---|---|---|
| `/implement-ticket` | `./agent-config implement-ticket` | `input.kind="ticket"` | Ticket id, URL, or pasted ticket payload |
| `/work` | `./agent-config work` | `input.kind="prompt"` | Free-form goal — no ticket id, no AC yet |

The engine routes on `input.kind` at the dispatcher boundary; downstream
directives (`memory`, `analyze`, `plan`, `implement`, `test`, `verify`,
`report`) are envelope-agnostic.

## Why this was a real question

Roadmap 1 shipped a ticket-shaped contract: the engine assumed
`state.ticket["acceptance_criteria"]` would always be populated by the
caller. R2 broke that assumption — a free-form prompt arrives as a
single string with no AC and no scope boundary. Three options were on
the table:

1. **One command, two modes** — overload `/implement-ticket` with a
   `--prompt` flag. Rejected: the slash-command surface is the public
   contract, and the dispatch decision (ticket vs. prompt) belongs at
   the entrypoint, not behind a flag.
2. **Two commands, two engines** — fork the dispatcher. Rejected:
   doubles the maintenance surface and re-introduces the
   ticket-as-name-lock that
   [`adr-work-engine-rename.md`](adr-work-engine-rename.md) just
   removed.
3. **Two commands, one engine, two envelopes (chosen)** — `/work` and
   `/implement-ticket` are sibling envelope-builders over the same
   `work_engine`. Adopted because it preserves the freeze-guard on
   `/implement-ticket` (R1 goldens stay byte-equal) and keeps a single
   place to add R3's UI-intent envelope later.

## Naming — `/work` over `/do`, `/execute`, `/build`

Phase 1 locked the name. Considered alternatives:

| Name | Rejected because |
|---|---|
| `/do` | Prefix-collision with `/do-and-judge`, `/do-in-steps` — surfaces as ambiguous in autocomplete and command-routing |
| `/execute` | Reads as "run this artisan command for me" rather than "drive an end-to-end flow" |
| `/build` | Dominated by build-system semantics in most ecosystems (CI builds, asset builds) |
| `/work` | Pairs naturally with the underlying `work_engine` module name; reads as "do the work end-to-end" |

`/do` lost on prefix-collision alone — even if the read was lean, the
autocomplete failure is an everyday cost. `/work` was the next-best
option that also matches the engine module name.

## Confidence-band gate (the load-bearing piece of R2)

A free-form prompt has no AC contract. Before R2, every downstream
gate would either trip on missing AC or fabricate one silently. The
gate solves this with a **deterministic, heuristic-only scorer** at the
`refine` boundary.

**Single source of truth:**
[`scripts/work_engine/scoring/confidence.py`](../../.agent-src/templates/scripts/work_engine/scoring/confidence.py).
The rubric, dimension definitions, weights, and band thresholds live in
that module. SKILL.md, this ADR, and `implement-ticket-flow.md` cite
the module — they do **not** re-derive the values. Tuning happens by
editing the constants and re-capturing goldens.

**Rubric shape** (5 dimensions × 0–2, sum / 10 → band):

- `goal_clarity` · `scope_boundary` · `ac_evidence` ·
  `stack_data` · `reversibility`

**Band-action mapping:**

| Band | Score | Engine outcome | Agent surface |
|---|---|---|---|
| `high` | `≥ 0.8` | `SUCCESS` | Silent proceed; AC + assumptions land in delivery report |
| `medium` | `0.5 ≤ score < 0.8` | `PARTIAL` | Assumptions-report halt; user confirms or edits, engine re-runs |
| `low` | `< 0.5` | `BLOCKED` | One clarifying question on the weakest dimension (per `ask-when-uncertain` Iron Law) |

**Why heuristic, not LLM:** the score must be reproducible across
replays — the freeze-guard harness pins expected outcomes per fixture,
and an LLM-based scorer would drift between runs. Heuristics also
remove a network dependency from the gate.

## AC projection — the engine fix Phase 5 surfaced

Downstream gates (`analyze`, `plan`) read
`state.ticket["acceptance_criteria"]` — a slot the prompt envelope
never sets directly. R2's first SUCCESS path through `refine` populated
`state.input.data.reconstructed_ac` only, so `analyze` blocked with
`ticket lost its acceptance criteria` even on a clean high-band run.

Fixed at the refine boundary: `directives/backend/refine.py::_run_prompt`
mirrors `data["reconstructed_ac"]` into `state.ticket["acceptance_criteria"]`
(as an independent list copy) before SUCCESS branches. Two regression
tests pin the contract on the high-band and medium-band release paths.

This is intentionally a **boundary** projection, not a parallel field
of truth: prompt envelopes carry one canonical AC list, and downstream
gates read the same slot regardless of envelope kind.

## Golden-Transcript contract

Phase 5 captured `GT-P1..GT-P4` against the live engine and pinned them
alongside the R1 goldens:

- `GT-P1` — high-band happy path (6 cycles → exit 0)
- `GT-P2` — medium-band release after assumption confirmation (7 cycles → exit 0)
- `GT-P3` — low-band one-question halt (2 cycles → exit 1)
- `GT-P4` — UI-intent rejection with R3 pointer (2 cycles → exit 1)

`task golden-replay` runs all 9 transcripts (R1 + R2) on every PR. The
R1 freeze-guard from
[`adr-work-engine-rename.md`](adr-work-engine-rename.md) stays in force
— GT-1..GT-5 remain byte-equal across the R2 changes.

## Deferred to Roadmap 3

R2 deliberately does **not** ship:

- `directives/ui/` and `directives/mixed/` — UI-shaped prompts are
  rejected at the band-action gate (`stack_data` scores `0`) with a
  `@agent-directive: r3-pointer` halt.
- Existing-UI-audit pre-step, design-review polish loop, microcopy /
  a11y / states directives.
- `input.kind="diff"` and `input.kind="file"` resolvers.

The rejection path (`GT-P4`) pins this boundary so an R3 dispatcher
addition doesn't silently widen `/work`'s surface.

## Tradeoffs accepted

- **Two top-level commands** sharing a state file. Mitigated by the
  envelope-collision halt: a `.work-state.json` carrying `input.kind="ticket"`
  refuses an incoming `/work` invocation, and vice versa.
- **Heuristic scorer drift** as the rubric matures — `goal_clarity` is
  the most likely dimension to be retuned. Mitigated by the
  freeze-guard: every threshold change re-captures `GT-P1..P4` and a
  PR reviewer signs off.
- **No telemetry** — confidence scores are not aggregated. A
  false-medium / false-low rate would only surface through user
  reports. Telemetry is deferred indefinitely (roadmap "Future-track
  recipe — deferred").

## Non-goals

- Does **not** change `/implement-ticket` behavior — R1 contract pinned
  by `GT-1..GT-5`.
- Does **not** introduce auto-git operations (`/commit`, `/create-pr`
  remain user-gated per `scope-control`).
- Does **not** pin a removal date for any R1 surface.
- Does **not** route UI-intent prompts — that's R3.

## Consequences — unblocks

- **R3** (`road-to-product-ui-track.md`) can register `directives/ui/`
  and `directives/mixed/` against the existing dispatcher; the
  envelope shape and the band-action gate are already in place.
- Future entrypoints (`/refactor`, `/spike`, …) can compose by
  building a third envelope kind without touching the dispatch core.
- Memory entries cited from prompt runs land under the same retrieval
  surface as ticket runs — the engineering-memory contract is
  envelope-agnostic.

## Follow-ups (not part of this ADR)

- Tune confidence thresholds against real-world prompts as usage
  grows; refresh `GT-P1..P4` on any change.
- Decide whether `assumptions_confirmed` should expire on long-running
  flows (currently sticky for the lifetime of the state file).
- Revisit telemetry once R3 lands — UI directives may produce richer
  signals than backend-only flows.
