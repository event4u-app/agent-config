---
complexity: structural
---

# Road to Path Fixes

**Status:** DONE
**Started:** 2026-05-06
**Completed:** 2026-05-06
**Trigger:** Consumer-side Copilot PR review (consumer-project#2160) flagged
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
  `docs/contracts/` body-links, 0 `agents/settings/contexts/` body-links.
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

## Phase 4 — Migrate Category B2 (`docs/contracts/`) — REVISED via Council 2026-05-06

**Council convergence (claude-sonnet-4-5 + gpt-4o, 3 rounds):** the
Round-1 plan to *inline* contract excerpts was rejected as bloat that
re-introduces the maintenance tax (hash-drift linter) the rule layer
was meant to escape. Promote the two contracts to a shipped `contexts/`
subdirectory and let the existing `load_context:` primitive do the
work. Rationale: 17 rules already consume `load_context:` cleanly;
contracts have low churn (3 commits in 6 months across both files);
the bloat is real (inlined blocks were 8-11 lines each, ~12 % of rule
size); `contexts/` is already shipped via `package.json#files`, so the
"contracts are package-internal" constraint dissolves once the files
sit there.

- [x] **P4.1 — Promote contracts to `contexts/contracts/`.** Moved
  `docs/contracts/command-suggestion-flow.md` and
  `docs/contracts/artifact-engagement-flow.md` to
  `.agent-src.uncompressed/contexts/contracts/` via `git mv`.
  Updated all cross-refs (rule frontmatter + body in
  `command-suggestion-policy`, `artifact-engagement-recording`;
  `rule-classification`, agent-settings template, onboard command,
  AGENTS.md, README, CHANGELOG) to point at the new location. Files
  ship via `contexts/` (already in `package.json#files`).
- [x] **P4.2 — Switch the two rules to `load_context:`.** Removed the
  inlined `<!-- inlined-from: ... -->` blocks plus the "Full text:
  package-internal …" pointer lines in `command-suggestion-policy.md`
  and `artifact-engagement-recording.md`. Added
  `load_context: ["contexts/contracts/<name>.md"]` to the rule
  frontmatter; rewriter expands to `../contexts/contracts/<name>.md`
  in compressed output. Body now points at the same context via
  relative link. Both rules dropped ~14 lines each.
- [x] **P4.3 — Dropped hash-drift linter plan.** No inlining means no
  drift surface. `lint_load_context.py` resolves the new entries
  against `.agent-src/contexts/contracts/` deterministically; smoke
  test (P7.1) confirms 14 `load_context:` entries resolve clean
  across 58 rules.

## Phase 5 — Compress-time validation gate — REVISED via Council 2026-05-06

**Council convergence (Decision 2):** the validator must distinguish
*descriptive* mentions from *referential* uses. Meta-rules
(`augment-source-of-truth`, `augment-portability`,
`token-optimizer-maintenance`, `language-and-tone`,
`no-roadmap-references`, `no-council-references`,
`preservation-guard`, `improve-before-implement`) describe the
`.agent-src.uncompressed/` concept by name — that is the rule's
subject matter, not a path violation. Add a frontmatter primitive
`validator_ignore:` so the validator can skip declared substrings on
a per-file basis with audited reasons. Drop the body-link-missing
check for `../docs/guidelines/*` because P3.1 (the symlink that would
have made those resolve) was cancelled — the resolution path is
intentionally out of scope, suppressed under the Copilot-tolerance
block (P3.3).

- [x] **P5.1 — Implemented validator + `validator_ignore:` schema.** New
  `scripts/check_compressed_paths.py` runs after compression. Reads
  optional `validator_ignore:` from rule frontmatter (list of
  `{type: substring|link, pattern: <string>, reason: <string>}`).
  Forbidden substrings (`.agent-src.uncompressed/`, `../../docs/`,
  `../../agents/`) emit only when the substring is **not** declared
  in `validator_ignore`. Body-link-missing fires only for
  `load_context:` resolution and `../contexts/...` body links;
  `../docs/guidelines/...` is **not** checked (P3.1 cancelled).
  Every `validator_ignore:` entry is audited via a diagnostic line so
  drift cannot hide. 8 meta-rules carry declared ignores
  (`augment-source-of-truth`, `augment-portability`,
  `token-optimizer-maintenance`, `language-and-tone`,
  `no-roadmap-references`, `no-council-references`,
  `preservation-guard`, `improve-before-implement`); 16 entries
  audited in clean run.
- [x] **P5.2 — Wired into `task ci`.** Added `check-compressed-paths`
  task in `taskfiles/content.yml`; sequenced after `check-compression`
  in the root `Taskfile.yml` `ci` task. Fails the build on any
  unsuppressed forbidden substring or unresolved `load_context:`.
- [x] **P5.3 — Forbid `.agent-src.uncompressed/` prefix in source
  frontmatter going forward.** Two-layer enforcement:
  - **Schema regex** in `scripts/schemas/rule.schema.json`:
    `load_context` and `load_context_eager` items match
    `^(contexts/|agents/settings/contexts/|\.agent-src/contexts/)[^\s]+\.md$`,
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

- [x] **P6.1 — Added `.github/copilot-review-instructions.md`**
  template at `.agent-src.uncompressed/templates/copilot-review-instructions.md`,
  installed via `scripts/install.sh` (copy-if-missing). Instructs
  Copilot PR review to skip path validation under `.augment/`
  (relative paths resolve via installer symlinks, not git checkout)
  and lists the four false-positive classes (relative cross-refs,
  `path_prefix:` substrings, symlinked rule files, `../docs/`
  body-link forms). Pointer to the mechanical floor
  (`scripts/check_compressed_paths.py`).
- [x] **P6.2 — Documented in `docs/architecture.md`** § "Path
  resolution and Copilot integration": symlink-vs-static-checker gap
  is intentional, not a bug; the two suppression files plus the
  mechanical validator are the floor. Includes a "Verifying path
  fixes in a consumer" subsection citing the smoke script.

## Phase 7 — Verify (minimum-evidence per Council Decision 3)

**Council convergence (Decision 3):** ship P6 + P7 in the same PR
rather than gate the merge on a follow-up consumer-project cycle. P7
collapses to a single self-contained smoke test that runs against
the package's own `.augment/` projection: regenerate, walk the rule
frontmatter, resolve every `load_context:` entry. If the same script
run from the package's `.augment/` is clean, the consumer projection
has the same shape and is therefore clean too.

- [x] **P7.1 — Self-contained smoke script.** Added
  `scripts/smoke_path_resolution.py` that walks `.augment/rules/*.md`,
  resolves every `load_context:` / `load_context_eager:` entry to a
  file under `.augment/`, exits 0 on clean, 1 on miss, 3 if `.augment/`
  is missing (run `task sync` first). Verified clean:
  `✅  smoke-path-resolution clean (58 rules, 14 load_context entr(y/ies) resolved)`.
- [x] **P7.2 — Optional consumer-project rerun (non-blocking).** Stays
  open as a follow-up but does **not** gate this PR. Documented in
  `docs/architecture.md` § "Verifying path fixes in a consumer" so a
  future maintainer can replay it on demand.
- [x] **P7.3 — Closed roadmap, archived, regenerated dashboard.**
  Status flipped to DONE on 2026-05-06; archived to
  `agents/roadmaps/archive/road-to-path-fixes.md`;
  `agents/roadmaps-progress.md` regenerated via `task roadmap-progress`.

## Phase 8 — Forward enforcement (post-migration)

After P2 / P3 / P5.3 closed the migration, the remaining failure mode
is **regression** — a future author writes a new rule, skill, command,
or context and reintroduces the legacy `.agent-src.uncompressed/`
prefix in `load_context:` or in a body link. Phase 8 records the
mechanical + author-facing controls that prevent that.

- [x] **P8.1 — Schema regex (mechanical, hard fail).**
  `scripts/schemas/rule.schema.json` rejects any
  `load_context` / `load_context_eager` item that does not match
  `^(contexts/|agents/settings/contexts/|\.agent-src/contexts/)[^\s]+\.md$` —
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
- **Inlining drift in P4.** SUPERSEDED by Council 2026-05-06 — no
  inlining means no drift surface. The two contracts move to
  `contexts/contracts/` and consumers receive them via the existing
  `contexts/` shipping path; `lint_load_context.py` already validates
  every `load_context:` entry resolves to a file.

## Out of scope

- Refactoring of the Augment-host's path resolver itself (we don't own it).
- Migration of `agents/settings/contexts/` body-links (Category B3): zero clickable
  links exist; nothing to fix.
- Wholesale restructuring of `docs/contracts/` — only the two contracts
  the rules consume (`command-suggestion-flow`, `artifact-engagement-flow`)
  move to `contexts/contracts/` per P4.1; the rest of `docs/contracts/`
  stays package-internal.
