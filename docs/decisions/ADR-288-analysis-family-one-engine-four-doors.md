---
adr: 288
status: accepted
date: 2026-10-18
decision: analysis-family-one-engine-four-doors
supersedes: —
superseded_by: —
phase: road-to-an-analysis-family-that-deepens-itself · Phase 1
type: structural
review_trigger: >-
  Reopen when the falsification rule in D9 fires on the first ten recorded
  runs (a stage moves its door's metric by zero on more than half of them),
  when a probed analyst binary writes outside its read-only profile, when a
  fetch reaches private or authenticated content, or when ADR-118 is amended
  so that a loop-design contract becomes permissible.
reopen_policy: directional
protected_dimensions: [security_floor]
provenance:
  kind: mixed
  decision_makers: [owner, ai-council]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E1
  discovery: complete
  basis:
    - agents/evidence/council/analysis-family-naming.md
    - agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md
    - src/domains/analysis-workbench/analyze/inbox/command.md:47
    - src/domains/meta/optimize/deep/command.md:115
    - src/scripts/ai_council/cli_agency_bounds.ts:4
    - docs/decisions/ADR-118-loop-engineering-boundaries.md:119
    - docs/CLAIMS.md:497
authority_basis: owner_intent
---

# ADR-288 — One analysis engine behind four doors

## Status

**Accepted** · 2026-10-18.

## Context

The owner ordered, on 2026-10-15, one analysis pipeline that the tree had
practised by hand for months and never built: independent analysts, three
deepening loops each, an exchange that deepens three more times, a gain-gated
extra round, a final inbox pass that lands `ready` roadmaps, and a ready PR.
The roadmap `road-to-an-analysis-family-that-deepens-itself` records what the
tree showed at `085ec41ff` (its § Context, findings F1–F18): no command
resolves its scope, the exchange instruments under `src/scripts/ai_council/`
had no production caller, `analyze:inbox` forbids the branch and PR every round
ends in (`src/domains/analysis-workbench/analyze/inbox/command.md:47`), and a
module without a marker resolved to the repository root.

Phase 2 of that roadmap has since built the run core in code — scope resolver,
run states, loop ledger, analysts, exchange, gain gate, question routing,
emitter, validator and local source adapters (`src/scripts/analysis_*.ts`,
`src/scripts/source_adapters.ts`). This record fixes the shape those parts are
assembled into before the doors are rewired.

## Decision

### D1 — Four doors, one engine

| Door | Today | After |
|---|---|---|
| foreign source | `analyze:repo` (alias `analyze:reference-repo`) | **`analyze:reference`**; `analyze:repo`, `analyze-repo`, `analyze:reference-repo`, `analyze-reference-repo` stay `replaces:` aliases |
| this project | `optimize:deep` | **`analyze:and-optimize`**; `optimize:deep`, `optimize-deep` stay aliases; its `limits:` block carries over unchanged |
| a pull request | — (`council:pr` is a seat runner without an apply path) | **`analyze:pr`**, feedback by default, `--optimize` to apply |
| the final stage | `analyze:inbox` (analysis only) | **`analyze:inbox`**, the stage every door ends in |

The foreign-source name was decided by the AI council on 2026-10-18, both seats
converging on a name outside the three offered
(`agents/evidence/council/analysis-family-naming.md`). `analyze:roadmap-repos`
keeps its name and is the discovery stage in front of `analyze:reference`.

### D2 — The analyst is a class of its own

Beside the council member and the implementer there is an **analyst**: it reads
the scope (and, under D7, a named source), writes only into its own round
folder, never runs project scripts, never pushes. Modes: `subagent` (same
family, fresh context), `external` (a `handoff-v1` file the owner drops), and —
under D8 — `cli:<provider>`. Council seats stay oracles and judges.

### D3 — Rounds live under `agents/runtime/analysis/<round-id>/`

Gitignored, opaque round ids. Owner drops for `external` analysts go to
`agents/tmp/<round-id>/`; the engine never writes into `agents/tmp/`
(`docs/contracts/agents-layout.md`).

### D4 — The second chaining exception

`analyze:roadmap-repos → analyze:reference` stays the first. The second: **a
door invokes stages, never another door.** `analyze:inbox` as the final stage
is a stage call, not a door chaining into a door.

### D5 — The default end state changes, and this record is where it changes

Every door except `analyze:pr` now ends in a **non-draft PR** carrying exactly
the roadmaps the run emitted. `--mode=plan` and `--no-pr` stop after
deterministic validation, before any push. Standalone `analyze:inbox` therefore
starts publishing by default when `vcs: git`. This is an explicit contract
change, recorded here so no operator meets it silently; `analyze:pr` ends in a
verdict and writes nothing to the PR without `--comment`.

### D6 — The push model

One invocation authorises a bounded push sequence on exactly the objects it
names: the run's own new branch (inbox, reference, and-optimize) or the named,
writable PR branch (`analyze:pr --optimize`). Each push follows an
expected-head check; at most one publication push plus three CI-fix pushes;
never a merge, never another branch, never an approval of the run's own change.
Precedent: `optimize:deep` Step 0 (`src/domains/meta/optimize/deep/command.md:115`).

### D7 — Fetching (owner, 2026-10-15, blocker `source-fetch-authorization`, option a)

An invocation that names a source (`analyze:reference https://…`) authorises
read-only fetches of **that source** plus the research step for **that run**.
Secrets and private or authenticated network content stay excluded. Without a
named source no fetch happens; `--no-network` runs label every result
`degraded: no-network`. The parked observation roadmap's `entry_condition`
carries the same sentence.

### D8 — Cross-family analysts (owner, 2026-10-15, blocker `analyst-cli-agency`, option a)

`cli:<provider>` analysts run under a **separate read-only analyst profile** in
`src/scripts/ai_council/cli_agency_bounds.ts`. The seat doctrine ("It never
edits, never runs a command, never fetches", `cli_agency_bounds.ts:4`) is
unchanged: the profile is new, the seat bound is not widened.

### D9 — Pre-registered before any door is rewired

Each door is scored by a **count of decidable items**, never a judgement:

| Door | Metric |
|---|---|
| `analyze:reference` | rows anchored on both sides — a tree anchor and a source anchor (today's `analyze:repo` metric) |
| `analyze:and-optimize` | emitted steps with a verified anchor and a falsifiable exit (`verify:` line) |
| `analyze:pr` | findings with a diff anchor (`file:line` inside `base..head`) and a reproduction or a test |
| `analyze:inbox` | points discharged per the inbox's own point ledger |

Defaults, all reversible inputs to the run core:

- **Analysts: 3** (`DEFAULT_ANALYSTS` in `src/scripts/analysis_analysts.ts`).
  `--quick`, or a scope below **40 files**, runs one analyst and no exchange.
- **Loops: 3** mandatory lenses; loops 4–5 only while the previous loop added a
  top-tier item (`src/scripts/analysis_ledger.ts`).
- **Gain rule** (until step 6.6 calibrates it): one more round is offered only
  when a named open conflict, or a high-impact `claimed`-tier item, has an
  executable verification plan inside the remaining budget; the council decides
  first, the owner is asked once on a split or above the ceiling; at most three
  rounds (`src/scripts/analysis_gate.ts`).
- **Per-round token ceiling: 1,500,000 tokens**; crossing the run's cap ends in
  `handed-back`, never in a raised cap.
- **Slicing size:** a round over **~400 KB of input or ~5 topic folders** runs
  as parallel lanes, each with its own census and point ledger, folded once —
  the inbox's own measured batch threshold
  (`src/domains/analysis-workbench/analyze/inbox/command.md` § Round size).
- **Fixture set — ten frozen inputs**, the inbox rounds `inbox-2026-10-j`
  through `inbox-2026-10-s` under `agents/tmp.old/`, the last of them the round
  this roadmap came from.

**Falsification rule.** After the first ten recorded runs (`run.json`), a
default whose stage moves its door's metric by **zero on more than half** of
those runs is lowered — fewer analysts, fewer loops, no exchange — and the null
is published in this record. The comparison pairs are one vs three analysts,
one vs three loops, and with vs without the exchange.

### D10 — ADR-118 conformance

Every loop, round and fix cycle carries a numeric cap in the door's `limits:`
block; no door runs until a condition. No loop-design contract is created under
`docs/contracts/`: the specification lives in this record and in the on-demand
context file `src/agent-src/contexts/execution/analysis-loop.md`
(`docs/decisions/ADR-118-loop-engineering-boundaries.md:119`).

## Evidence

- `agents/evidence/council/analysis-family-naming.md` — the naming verdict, both
  seats, with the prompt committed beside it.
- `agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md` § Context —
  F1–F18 with their anchors; § Blockers — the two owner answers of D7 and D8.
- `src/domains/analysis-workbench/analyze/inbox/command.md:47` — the branch and
  PR ban D5 lifts.
- `src/domains/meta/optimize/deep/command.md:115` — the push precedent of D6.
- `src/scripts/ai_council/cli_agency_bounds.ts:4` — the seat doctrine D8 leaves
  untouched.
- `docs/CLAIMS.md:497` — the pre-registered claim whose five mechanisms step 4.1
  pins rather than freezes.

## Assumptions

- The **40-file** small-scope threshold and the **1,500,000-token** round
  ceiling are stated defaults, not measurements: nothing has measured where one
  analyst stops being worse than three, or what a three-analyst round costs on
  this host. Both are exactly what D9's falsification rule exists to correct.
- The ten fixture rounds sit in a gitignored tree; a clone cannot re-run them.
  The fixture set is a maintainer-local denominator, named so its absence is
  visible rather than silent.

## Consequences

- `analyze:inbox` loses its "never a branch, never a PR" clause when step 3.4
  lands; until then the inbox stays analysis-only.
- Two new trust surfaces open, each owner-authorised and bounded: read-only
  fetches of a named source (D7) and a read-only analyst profile for CLI
  binaries (D8).
- A failed seat degrades the council to `single-voice`, said in the run, never
  counted as a clearance.

## Alternatives

- **Keep the optimize cluster** and add the analysis family beside it — rejected:
  `optimize:deep` already is "analyse and improve this project", so two doors
  would do one job.
- **One monolithic `/analyze`** with a mode switch — rejected: the four inputs
  (a source, this project, a PR, an inbox round) end in different artefacts (a
  roadmap set or a verdict), and a mode switch hides that difference.
- **`analyze:source`, `analyze:harvest`, keep `analyze:repo`** — rejected by the
  council for `analyze:reference` (D1).

## References

- `agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md`
- `agents/roadmaps/later/road-to-first-reference-analysis-observation.md`
- `docs/decisions/ADR-118-loop-engineering-boundaries.md`
- `src/agent-src/contexts/execution/analysis-loop.md`
