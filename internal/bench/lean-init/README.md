# lean-init — lookup-class routing correctness comparison

> Scope: this repo (`event4u/agent-config`, TypeScript), one machine,
> 2026-07-28. Deliverable of `road-to-lean-agent-init.md` Phase 1 Step 3.
> Deterministic — zero model calls, zero spend.

## What is measured — and what is not

**Measured:** correctness equivalence — for ≥10 golden lookup tasks
(including analogs of the four live-observed 2026-07-28 shapes), the routed
deterministic primitive's answer ≡ the agent answer (ground truth established
by orchestrator full-context inspection, then independently confirmed by the
primitive run). Acceptance per the roadmap: **any mismatch is a routing bug,
not a rounding error.**

**Not measured (already evidenced elsewhere):** the token cost of the agent
arm. The live 2026-07-28 session screenshot is the agent-arm cost evidence
(four `general-purpose` workers at 308.0k / 327.1k / 299.0k / 280.8k ≈ 1.21M
tokens on four lookup tasks); re-burning ~300k × 10 tasks to reproduce known
waste would be the exact failure the roadmap stops. Primitive-arm cost is
recorded per golden (output size / 4 ≈ tokens).

## Method

1. Each golden is a lookup task in one of the four `LookupClass` shapes
   (`classifyLookup`, `src/scripts/_lib/auto_dispatch.ts`).
2. Ground truth per golden: established by direct source inspection, pinned
   as file:line.
3. The routed primitive (per
   `auto-dispatch-classification.md § Lookup-class rung`: capped `rg`,
   FTS/capped-grep, direct script run) is executed verbatim; output recorded.
4. Match verdict: primitive answer contains the ground-truth location(s) /
   verdict, with no wrong locations asserted.

## Corpus

Golden table + verdicts: [`results-2026-07-28.md`](results-2026-07-28.md).
The four observed task shapes map to goldens as: definition-location →
G01/G02/G03/G11 · import-call-sites → G04/G05/G06/G12 · report-run →
G09 (same script as observed, `check_enforcement_coverage`) / G10 ·
string-probe → G07/G08.

## Honest limitations

- Single repo, single language (TS) — the shape most hostile to the native
  code graph per `code-graph-retrieval-null`, which is why the routed
  primitive is capped `rg`, not `code_graph query` (council 2026-07-28).
- Ground truth and primitive run share the orchestrator (no independent
  second annotator); mitigated by pinning every claim to file:line any
  reviewer can re-check with the committed command.
- The agent arm's ANSWERS for the four observed shapes lived in another
  repo's session; the goldens here are same-shape analogs in this repo.

## Reproduce

Every golden's exact command is committed in the results table. Run from the
repo root; primitives are plain `rg`/`npx tsx`/`./agent-config` invocations.
