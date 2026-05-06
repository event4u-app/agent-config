---
complexity: structural
---

# Road to Path Fixes

**Status:** ACTIVE
**Started:** 2026-05-06
**Trigger:** Consumer-side Copilot PR review (galawork-web#2160) flagged
broken cross-references in `.augment/` rules. Audit confirmed 36 sites
across three categories: 16 frontmatter entries that hardcode
`.agent-src.uncompressed/` (12 `load_context:` across 11 rules + 4
`path_prefix:`), 18 body-links to package-internal `docs/guidelines/`
across 11 rules, and 2 body-links to `docs/contracts/`. Council
(claude-sonnet-4-5 + gpt-4o,
2026-05-06) reviewed five candidate strategies; converged on a
hybrid: logical names in source, compress-time path rewriting,
selective symlinks for genuinely-shipped material, suppression doc
for the symlink-vs-Copilot gap.
**Mode:** Phased rollout. Phase 0 freezes the audit, Phase 1 ships the
compress-time rewriter (load-bearing primitive), Phases 2-4 migrate
the three categories on top of it, Phase 5 wires in the validation
gate, Phase 6 documents the Copilot suppression floor, Phase 7
verifies end-to-end in a consumer.

## Acceptance criteria

- Zero `.agent-src.uncompressed/` substrings in shipped `.agent-src/rules/`.
- Zero broken markdown links in `.agent-src/rules/` resolved against the
  consumer's expected `.augment/` layout.
- `task ci` green; new compress-time validator catches regressions.
- Smoke-tested in one consumer project (path resolution + Copilot
  noise check).

## Phase 0 — Lock the audit

- [x] **P0.1 — Pin audit numbers in this roadmap.** 16 frontmatter sites
  (12 `load_context:` entries across 11 rules + 4 `path_prefix:`
  declarations), 18 `docs/guidelines/` body-links in 11 rules, 2
  `docs/contracts/` body-links, 0 `agents/contexts/` body-links.
  Re-audit greps run 2026-05-06; numbers locked. Drift from earlier
  draft: `scope-control` was missing from the `load_context:` list
  (now in P2.1); `guidelines.md` was double-counted in B1 (the
  `docs/guidelines/` mention there is plain text inside backticks,
  not a markdown link — removed from P3.2).
- [x] **P0.2 — Decide canonical `.augment/` layout for shipped docs.**
  Symlink target: `.augment/docs/guidelines/` → `vendor/event4u/agent-config/docs/guidelines/`.
  No `.augment/docs/contracts/` symlink (B2 is inlined). Documented
  in `docs/architecture.md` § Installer layout.
- [x] **P0.3 — Confirm `compress.py` is the right rewrite host.**
  `scripts/compress.py` already runs `.agent-src.uncompressed/` →
  `.agent-src/` (via `should_compress` + `strip_frontmatter`); the
  rewriter goes between `strip_frontmatter` and the write step in
  `project_to_augment()` / per-file compression. Confirmed —
  extending, not forking.

## Phase 1 — Compress-time path rewriter

- [x] **P1.1 — Logical-name schema in source.** Frontmatter
  `load_context:` and `path_prefix:` accept paths without the
  `.agent-src.uncompressed/` prefix; the prefix is forbidden going
  forward. Documented in `.agent-src.uncompressed/templates/rule.md`
  + JSON schema field descriptions (`scripts/schemas/rule.schema.json`).
  Strict pattern enforcement deferred to P5.3 to keep the migration
  in P2 unblocked.
- [x] **P1.2 — Implement rewriter in `scripts/compress.py`.** Added
  `_rewrite_paths(content, source_relative_path)` (depth-aware,
  idempotent) plus `apply_path_rewriter(relative_path)` wired into
  `mark_done`, so each compressed file is rewritten in-place at the
  moment the agent stamps it done. Rewrites:
  - frontmatter `load_context:` / `load_context_eager:` entries → relative path
    from the file's directory (e.g. `../contexts/execution/foo.md`)
  - frontmatter `triggers[].path_prefix:` declarations → strip
    `.agent-src.uncompressed/` to `.agent-src/`
  - body links `../../docs/guidelines/...` and `../../docs/contracts/...`
    → depth-aware single-up form.
- [x] **P1.3 — Unit-test the rewriter.** `tests/test_compress_paths.py`
  ships 14 cases across four classes: load_context (logical + legacy
  + load_context_eager), path_prefix (legacy + unrelated-passthrough),
  body-links (guidelines + contracts + already-relative), depth +
  idempotence + no-frontmatter, plus three wiring tests for
  `apply_path_rewriter` (modifies file, returns False when already
  rewritten, returns False when target missing).

## Phase 2 — Migrate Category A (frontmatter)

- [x] **P2.1 — Strip prefix from 12 `load_context:` entries (11 rules).**
  Files: `verify-before-complete`, `augment-source-of-truth`,
  `autonomous-execution` (3 entries), `token-efficiency`, `guidelines`,
  `commit-policy`, `user-interaction`, `non-destructive-by-default`,
  `think-before-action`, `scope-control`. Path now
  `contexts/<area>/<file>.md` in source; rewriter expands to
  `../contexts/<area>/<file>.md` in `.agent-src/rules/`. `lint_load_context.py`
  extended with `contexts/` allowed root + `resolve_entry()` helper that
  resolves logical names against `SOURCE_ROOT`.
- [x] **P2.2 — Treat `path_prefix:` as literal match pattern (Modified Option 1).**
  AI-Council 2026-05-06 convergence: `path_prefix:` is the host's
  router-side match string, **not** a file reference. Rewriter
  `_rewrite_path_prefix_value()` is a documented no-op; existing
  `.agent-src.uncompressed/` declarations in `skill-quality`,
  `docs-sync`, `rule-type-governance`, `augment-portability` stay
  verbatim (each fires when the agent edits source-of-truth files).
  Schema description in `scripts/schemas/rule.schema.json` and
  rewriter docstring in `scripts/compress.py` updated. Test
  `test_legacy_prefix_left_alone` inverted to verify no-op.
- [x] **P2.3 — Re-compressed and verified.** Ran `--mark-done` per
  rule on all 10 files (autonomous-execution covers 3 entries in
  one file). Compressed output uses `../contexts/...` form;
  zero `.agent-src.uncompressed/` substrings remain in
  `.agent-src/rules/*.md` `load_context:` entries.
- [x] **P2.4 — Linters green.** `lint_load_context.py` reports
  `load_context schema clean (10 declarer(s))`. `check_always_budget.py`
  emits its trend line (concentration breach is a separate eager-budget
  topic, not a P2 regression).

## Phase 3 — Body-link strategy (Modified Strategy A)

- [-] **P3.1 — `.augment/docs/guidelines/` install symlink.** CANCELLED
  per AI-Council 2026-05-06. Strategy A (status-quo + Copilot tolerance)
  was selected over Strategy B (logical body-link form + install symlink):
  the audit shows all 18 body-links target `docs/guidelines/` reference
  material the agent reads internally, no consumer-facing UX clicks
  through them. Building/maintaining the symlink for noise that is
  already silenced by the Copilot tolerance block is net-negative.
- [x] **P3.2 — Body-link rewriter retained as built; no source migration.**
  `compress.py` `_BODY_DOCS_RE` rewrites `../../docs/{guidelines,contracts}/...`
  to depth-aware single-up form at compress time and is idempotent —
  source files keep the verbatim `../../docs/...` form, so authoring
  works in any markdown viewer. The 18 body-links in the 11 audit
  files (`architecture`, `ask-when-uncertain`, `direct-answers`,
  `improve-before-implement`, `language-and-tone`, `no-cheap-questions`,
  `role-mode-adherence`, `security-sensitive-stop`, `size-enforcement`,
  `think-before-action`, `verify-before-complete`) need no manual edit.
- [x] **P3.3 — Copilot-review tolerance documented.** Added "Known
  False Positives" section to
  `.agent-src.uncompressed/templates/copilot-instructions.md` covering
  (a) relative cross-references inside `.augment/` rules/skills,
  (b) `path_prefix:` triggers containing `.agent-src.uncompressed/`,
  (c) symlinked rule files under `.claude/rules/`, `.cursor/rules/`,
  `.clinerules/`. The `copilot-agents-optimization` skill now refuses
  to delete this section during optimization runs and adds it during
  init/optimize when the consumer file is missing it.

## Phase 4 — Migrate Category B2 (`docs/contracts/`)

- [ ] **P4.1 — Inline the 2 contract references.** Replace links in
  `command-suggestion-policy.md:19` and `artifact-engagement-recording.md:24`
  with a 2-3 line excerpt of the contract surface; keep the link as
  "(full text: package-internal `docs/contracts/<name>.md`)".

## Phase 5 — Compress-time validation gate

- [ ] **P5.1 — Implement validator.** New
  `scripts/check_compressed_paths.py` runs after compression: every
  `load_context:` entry, every body-link in `.agent-src/rules/*.md`
  must resolve relative to `.agent-src/rules/<file>.md` to an
  existing file. Forbidden substrings: `.agent-src.uncompressed/`,
  `../../docs/`, `../../agents/`.
- [ ] **P5.2 — Wire into `task ci`.** Add as new task; fail loudly.
- [x] **P5.3 — Forbid `.agent-src.uncompressed/` prefix in source
  frontmatter going forward.** Two-layer enforcement:
  - **Schema regex** in `scripts/schemas/rule.schema.json`:
    `load_context` and `load_context_eager` items match
    `^(contexts/|agents/contexts/|\.agent-src/contexts/)[^\s]+\.md$`,
    so any `.agent-src.uncompressed/contexts/...` entry fails
    `task validate-schema` with a per-item pattern violation.
  - **Linter** in `scripts/lint_load_context.py`: removed the legacy
    prefix from `ALLOWED_PREFIXES`, added a dedicated `LEGACY_PREFIX`
    branch that emits `legacy .agent-src.uncompressed/ prefix in
    load_context → ... — use logical name 'contexts/<area>/<file>.md'
    instead (road-to-path-fixes.md P5.3)` so the failure points authors
    at the canonical form rather than a generic "disallowed root".
  - `path_prefix:` is **deliberately not in scope** — P2.2 council
    decision: it is a literal match pattern, source-of-truth rules
    legitimately use the `.agent-src.uncompressed/` prefix there
    (`skill-quality`, `docs-sync`, `rule-type-governance`,
    `augment-portability`). The rewriter leaves it verbatim.

## Phase 6 — Copilot suppression floor

- [ ] **P6.1 — Add `.github/copilot-review-instructions.md`**
  template to package: instructs Copilot PR review to skip path
  validation under `.augment/` (relative paths resolve via
  installer symlinks, not git checkout).
- [ ] **P6.2 — Document in `docs/architecture.md`** § Copilot
  integration: symlink-vs-static-checker gap is intentional, not a
  bug; suppression instruction is the floor.

## Phase 7 — Verify in consumer

- [ ] **P7.1 — Re-install package** in `galawork-web` (or scratch
  consumer); regenerate `.augment/`; spot-check that the 15 + 18 + 2
  sites resolve.
- [ ] **P7.2 — Re-run Copilot PR review** on a follow-up branch in
  galawork-web; confirm noise dropped to zero (or symlinked-only
  warnings, suppressed by P6.1).
- [ ] **P7.3 — Close roadmap, archive, regen dashboard.**

## Phase 8 — Forward enforcement (post-migration)

After P2 / P3 / P5.3 closed the migration, the remaining failure mode
is **regression** — a future author writes a new rule, skill, command,
or context and reintroduces the legacy `.agent-src.uncompressed/`
prefix in `load_context:` or in a body link. Phase 8 records the
mechanical + author-facing controls that prevent that.

- [x] **P8.1 — Schema regex (mechanical, hard fail).**
  `scripts/schemas/rule.schema.json` rejects any
  `load_context` / `load_context_eager` item that does not match
  `^(contexts/|agents/contexts/|\.agent-src/contexts/)[^\s]+\.md$` —
  fails `task validate-schema` at the per-item level.
- [x] **P8.2 — Linter remediation hint (mechanical, hard fail).**
  `scripts/lint_load_context.py` removed the legacy prefix from
  `ALLOWED_PREFIXES`, added a dedicated `LEGACY_PREFIX` branch that
  emits a remediation pointing at the canonical logical name —
  fails `task lint-load-context`.
- [x] **P8.3 — Author-facing canonical reference.** Path-conventions
  block in `.agent-src.uncompressed/templates/rule.md` distinguishes
  `load_context:` (logical, rewritten), `triggers[].path_prefix:`
  (literal, verbatim), and body links (`../../docs/...`, rewriter
  handles depth). Cited from `rule-writing` § 3b, `skill-writing`
  Cross-references, `command-writing` § 3b, `context-authoring`
  Path conventions when a context cites another context.
- [x] **P8.4 — Contract update.** `docs/contracts/load-context-schema.md`
  leads with logical names; the `.agent-src.uncompressed/` prefix is
  documented as rejected by both the schema regex and the linter.
- [x] **P8.5 — `path_prefix:` deliberately out of scope.** P2.2
  council decision recorded in P5.3 and in `templates/rule.md`:
  `path_prefix:` is a literal match pattern the host evaluates against
  the file the agent edits. Source-of-truth rules
  (`skill-quality`, `docs-sync`, `rule-type-governance`,
  `augment-portability`) legitimately use the `.agent-src.uncompressed/`
  prefix there, and the rewriter leaves it verbatim.

## Risks

- **Augment-Host path resolution is empirical, not contracted.**
  Compressed output uses relative-from-rule paths; if Augment
  resolves `load_context:` repo-root-relative instead, P2 breaks
  silently. Mitigation: P2.3 + P2.4 tests against real Augment run,
  not just file-existence check. Roll back to absolute-from-`.augment/`
  paths if needed.
- **Windows symlink fragility for P3.1.** Installer already creates
  symlinks; this adds one more. Same constraint, no new risk surface.
- **Inlining drift in P4.** Inlined contract excerpts can drift from
  source. Mitigation: add a `<!-- inlined-from: docs/contracts/<X>.md -->`
  marker + linter check that the source paragraph hash is current.

## Out of scope

- Refactoring of the Augment-host's path resolver itself (we don't own it).
- Migration of `agents/contexts/` body-links (Category B3): zero clickable
  links exist; nothing to fix.
- Restructuring `docs/contracts/` to be consumer-shipped (only
  `docs/guidelines/` is genuinely consumer-useful per the audit).
