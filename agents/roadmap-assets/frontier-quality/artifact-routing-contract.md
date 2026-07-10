# Artifact, Visual & Connected-Tool Routing Contract

Phase 5 of `road-to-frontier-quality-operating-system`. Planning contract for
`FQ-07` (artifact carrier routing), `FQ-08` (connector-first — covered),
`FQ-09` (visual routing) in [`mechanism-matrix.md`](mechanism-matrix.md).
Format-agnostic; points to existing skills for implementation.

## Unified carrier routing (FQ-07)

Decide the carrier before producing: **inline answer** vs **tracked file** vs
**visual widget/diagram** vs **MCP/app tool** vs **downloadable document**.
Composes with `surface-agent-contracts` (the surface taxonomy) — this row is the
carrier decision, that contract is the per-surface invariant.

### File-creation triggers / non-triggers

| Create a file | Stay inline |
|---|---|
| "write the article/report/story" | brief list / bullets |
| "save / download / file it" | short code snippet |
| a named path or format | a simple recipe |
| code above a size threshold | conversational strategy / summary |
| "edit my file X" | — |
| presentation / spreadsheet / document | — |

### Carrier cost/UX table

| Carrier | Best for |
|---|---|
| inline | short answers — cheapest, no artifact overhead |
| tracked file | durable repo artifacts |
| visual tool | inspection / spatial / system-structure reasoning |
| document / deck / sheet | native-format or export requests |
| MCP / app tool | private or structured state the tool owns |

## Connected-app / MCP-first (FQ-08 — COVERED)

Already owned by `surface-agent-contracts` (MCP/connector row + surface-conflict
rule): if a real connected tool handles the category, use/suggest it instead of
simulating UI or inventing fake tool outputs. No new rule.

## Visual routing (FQ-09)

- **Triggers:** explicit "show / diagram / chart", spatial or system structure,
  data shape, a UI spec as a noun phrase.
- **Non-triggers:** text-only technical support, ordinary prose drafting.

## Evals (FQ-07/FQ-09)

Trigger evals + **five golden tasks** that force different carriers on
superficially similar prompts (e.g. "summarize the tradeoffs" → inline vs
"write up the tradeoffs as a doc" → file vs "diagram the tradeoffs" → visual vs
"put the tradeoffs in our tracker" → app vs "export the tradeoffs to PDF" →
document). Shape defined in [`eval-harness.md`](eval-harness.md); authored in
the follow-up.

## Disposition

FQ-07 + FQ-09 → follow-up implementation roadmap (a carrier-routing contract +
visual-routing triggers, reused by document / frontend / analysis / MCP skills).
FQ-08 → covered. No src change here.
