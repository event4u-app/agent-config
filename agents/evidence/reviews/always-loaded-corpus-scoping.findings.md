# Completion review — road-to-always-loaded-corpus-scoping

**Skipped:** no code surface for this completion — the branch changes 7 files and 0 of them is a code path: one new evidence page, one new ADR plus its regenerated index, the roadmap moved to archive with its checkboxes resolved, the regenerated dashboard, one sibling roadmap step re-pointed at the archive, and one per-line `ref-ignore` marker in a committed review record, scope b7e8703d57804e196c5bf8524635ccf49cfe46d25f00e067159f492643e3bf46, declared 2026-08-13

## Why there is no code to review

The roadmap's own Phase 3 was the only phase that would have edited anything
executable, and it did not run: the `paths:` axis is at 100 % conversion, so the
target set its pre-registration requires is empty. **Zero rules were edited and
zero scripts were touched**, which is also how the "no rule's routing-matrix
positives regress" acceptance criterion is satisfied.

The three measurement probes behind the verdict page were scratchpad-only and
compose already-shipped functions (`gpt_tokens`, `rule_in_scope`,
`compute_active_pack_ids`); none was added to the tree, so none is reviewable
surface. The verdict page records how to reproduce them.

## What a reviewer should check instead, if they check anything

The claims are all falsifiable in-repo without reading code:

- `grep -lE '^\s*-?\s*(file_pattern|path_prefix):' src/rules/*.md | wc -l` → 25,
  against `ls src/rules/*.md | wc -l` → 116, and
  `grep -l '^paths:' .claude/rules/*.md | wc -l` → 25. That triple is the
  saturation finding.
- The `/compact` constraint is quoted verbatim from
  `agents/evidence/analysis/claude-code-rules-dir-contract.md:67-69`, a fixture
  this branch did not touch.
- The gate figures were taken as prerequisites and are recorded in the archived
  roadmap; neither gate moved, because nothing changed.

## The one repair that did land

`complexity: standard` → `lightweight` in the roadmap being closed — a one-token
frontmatter fix, taken under the `active-remediation` fix-now tier because it was
the sole failure of `lint_roadmap_complexity` and sat in a file this change was
already editing. Verified: `42 roadmap(s) complexity-clean`, `0 untagged`, exit 0.
