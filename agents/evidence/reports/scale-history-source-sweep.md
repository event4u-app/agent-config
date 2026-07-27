# Source sweep — scale-discipline Phase 2 (Source A / Source B)

> Fresh-clone source-level sweep 2026-07-27, per
> `road-to-scale-and-history-discipline` Phase 2. Real identities live in the
> local inbox archive (`agents/tmp.old/scalable-projects.txt`, gitignored) per
> `source-confidentiality`; clones were made to a local scratch dir and are
> not retained in the tree.

## Source A — the Laravel ecosystem's official agent-skill collection

- **Inspected:** full tree (three product plugins; the framework plugin
  carries agents + exactly ONE skill, a starter-kit upgrade walkthrough).
- **Persistence/scale coverage:** none — no query, index, migration, queue,
  or audit content.
- **License:** no license file present at the repo root at sweep time.
- **Verdict:** no overlap, nothing to borrow.

## Source B — community Laravel skill package (slow-query command)

- **Inspected:** skill tree (~25 skills) + the slow-query skill source
  (187-line SKILL.md), LICENSE (MIT).
- **Mechanism:** the slow-query skill is an **LLM-prompt skill** — it
  instructs the agent to Grep/Read at inference time and judge findings
  itself. Detection quality is model-dependent per run; there is no
  deterministic backstop, no fixture corpus, no measured TP/FP floor.
- **Coverage convergence:** its checklist covers F1 (queries in loops),
  F2 (missing indexes incl. FK note), F3 (unbounded selects) — independent
  convergence with our failure-class table; read as validation of the class
  selection, not as lineage.
- **Verdict:** **rebuild (already built), no borrow.** Our
  `lint_persistence` detectors are deterministic code with pre-registered
  spike thresholds (docs/spikes/scale-history-spikes.md); adopting prompt
  prose would import exactly the non-determinism the roadmap's Iron Law
  rejects. MIT would have permitted a borrow — the mechanism mismatch, not
  the license, decides.
- **Follow-up noted (not adopted now):** its checklist also names
  `groupBy`/`having` columns as index-parity surface — a candidate widening
  for `detect_index_parity` if real-world FP data supports it.

## Decision

No borrow from either source. The detection half ships as our own
deterministic substrate; the skill layer (schema-review / history-design)
is prompt-shaped but grounded in the linter's output rather than free
inference.
