# Findings: drain-typed-grants-close
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

**Skipped:** no code surface for this completion — the diff is one roadmap file carrying step dispositions, evidence paragraphs and two blocker re-measurements; every code-bearing step in the roadmap was refused or held on order and nothing under src/ or tests/ changed, scope 1e3f73bc6ece049c2daeef59650efe9b8e537a6544b573755dd7f3214629ca8c, declared 2026-10-01

## Why this run produced no code

`road-to-typed-grants-that-persist` is the authority-model roadmap. Of its 27 open
steps, five edit kernel rules behind `block_kernel_rule_writes`, which this run
reproduced at tool-call time rather than inferring; the remainder either widen the
agent's own authority or wait on a mechanism whose construction would.

The code this run did NOT write, and why, so a reviewer can check the judgement
rather than the absence:

- **`src/rules/non-destructive-by-default.md` (1.1) and four sibling kernel edits** —
  `block-kernel-rule-writes: BLOCKED` returned by the `pre_tool_use` dispatcher.
  Nothing written; `git status --short` empty afterwards.
- **`personal.autonomy: on` (1.4)** — authority-expanding. ADR-268 § 4 requires a
  ratification artifact, and `check_kernel_edit_ratified` does not scope to this
  file, so the restraint is model-carried. Recorded in the step rather than relied on.
- **A persisted grant ledger (3.1)** — a grant store the acting session can write is
  a self-grant. The design question *who may append, and what makes an append
  owner-attributable* is unanswered, and it precedes the code.
- **`check_typed_op_grant.ts` (4.3)** — in bounds and wanted, but specified to read a
  ledger that has no writer, no reader and no file.
- **`lint_skill_frontmatter_safety.ts` demotions (1.7)** — demotes live security
  findings to advisory with no replacement gate in the tree.
- **`decision-revisit-gate.md` rows (5.3)** — moves governance self-amendment out of
  the owner-reserved column into a mechanism agent sessions run.
- **`report_autonomy_disposition.ts` plus its ratchet (6.1)** — the report half is in
  bounds; the shrink-only `legacy_human_gate` ratchet is a one-way governance ratchet
  registered by its own beneficiary. The step's verify requires the second.

## Verification run on this diff

- `lint_roadmap_blockers` — exit 0, 136 roadmaps blocker-contract-clean.
- `lint_roadmap_complexity` — this roadmap passes. Suite exit 1 is pre-existing on
  `road-to-a-stop-that-holds.md`, last touched by `5689c2d12` on `main` and untouched
  by this branch.
- `check_references` — exit 0, 2141 scanned, no broken references.
- `check_md_language` — exit 0, no German content.
- `scanOpenSteps` — `{open: 14, blocked: 7}` before this change, `{open: 0, blocked: 7}` after.
- `check_platform_anchor --as-of 2026-10-01` — exit 0, `PASS_WITH_ACCEPTED_RISK`.
- `update_roadmap_progress --archive` — exit 0. `roadmap-progress-check` exit 1 on
  `road-to-host-claims-the-tree-contradicts.md`, pre-existing (`14ff4a3ca`, PR #2124).
