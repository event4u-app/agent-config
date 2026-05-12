---
complexity: structural
---

# Road to Multi-Package Coexistence

**Status:** DRAFT — synthesised 2026-05-12 from a side-by-side analysis
of `feat/global-content-deployment` (PR #121) against
`nextlevelbuilder/ui-ux-pro-max-skill` (`init.ts`, `uninstall.ts`,
`types/index.ts` direct fetch).
**Started:** 2026-05-12
**Trigger:** PR #121 closed the functional-alignment gap (install,
uninstall, sync, prune, versions, marketplace audit). The comparison
surfaced the next architectural gap: **`agent-config` has no
file-level ownership.** We know *which* tools we installed (lockfile
v1), not *which files* we wrote. `ui-ux-pro-max-skill` sidesteps the
problem by installing every asset under a single namespace
(`<root>/skills/ui-ux-pro-max/`). We can't adopt their namespace
without breaking the established top-level layout (`.cursor/rules/*.md`)
— but we can match their robustness by recording every written path in
the lockfile. Goal: make two independent agent-config-style packages
coexist in one project without last-writer-wins collisions, without
the prune command guessing, and without inline file-tagging being the
source of truth.
**Mode:** Single-branch execution. ALL phases land on
`feat/global-content-deployment` (= PR #121). No stacked PRs, no
side-branches. The roadmap file itself ships in PR #121 as part of
the same scope.

## Purpose

Cross from **tool-level ownership** to **file-level ownership**:

- **Lockfile knows what we wrote** — every path our install touches is
  recorded in `agents/installed-tools.lock` (schema v2,
  backward-compatible reader). Truth source for prune, doctor, and
  conflict detection.
- **Prune becomes data-driven** — orphans = files-in-manifest minus
  files-belonging-to-currently-installed-tools. The hardcoded
  `PROJECT_BRIDGE_MARKERS` table downgrades to a v1→v2 migration
  fallback, not the source of truth.
- **Install refuses to overwrite foreign files** — pre-write existence
  check: if a target path exists AND is not in our manifest, the
  install stops with numbered options (`--force` / skip / abort).
- **Merged configs round-trip cleanly** — for files we merge into
  (`.cursor/hooks.json`), the lockfile records which JSON pointers we
  injected, so uninstall can remove our keys without nuking the file.
- **Doctor surface for drift** — new `agent-config doctor` command
  compares manifest vs filesystem, surfaces missing files, manual
  edits (sha256 mismatch), and foreign files in our deploy paths.
- **Inline package tag is UX, not truth** — `.md` files we deploy may
  carry a `package: event4u/agent-config` frontmatter line for
  discoverability. The lockfile remains the authoritative ownership
  record.

## Decisions (locked 2026-05-12)

- **File-manifest is the foundation, not inline tags.** Lockfile
  schema v2 carries `files[]` per tool. Inline frontmatter tags are
  optional UX in Phase 5, not the ownership mechanism.
- **Schema v2 is additive.** v1 readers keep working (missing `files[]`
  key tolerated). v2 writers populate the new fields. No forced
  migration — first re-install rewrites the manifest in v2 shape.
- **No namespace-subfolder migration.** The reference repo's
  `<root>/skills/ui-ux-pro-max/` pattern is not adopted. Top-level
  layout stays. Namespace-as-opt-in lives in Phase 6 (deferred until
  a real consumer asks).
- **Conflict-detection is hard-stop, not warn.** Existing file at
  target path that we don't own → install stops, numbered options.
  `--force` is the explicit override.
- **Single-PR scope.** All phases of this roadmap ship in PR #121.
  Splitting risks losing the multi-package story across two reviews
  and creates merge-base divergence on `install.py`, `cmd_prune.py`,
  `installed_tools.py`.
- **Rollback is config-only.** Schema v2 entries are ignored by v1
  readers; reverting writers to v1 yields a manifest the next install
  cycle re-fills. No DB state, no forward-only migration.

## Scope

Phases 1–4 = own work, 4/5 Hard Cap slots.
Phase 5 = UX add-on (1 slot).
Phase 6 = deferred, not counted.

## Phase 1 — Lockfile Schema v2 Foundation

- [x] **P1.0 — Atomic-write primitive.** Add `write_atomic(path, data,
  *, mode="w")` helper in `scripts/_lib/fs_atomic.py`: write to
  `<path>.tmp.<pid>`, `fsync(tmp_fd)`, `os.replace(tmp, path)`,
  `fsync(parent_dir_fd)`. Single primitive used by every v2 writer in
  P1.3, P1.5, P2.2, P3.x. Acceptance: unit test asserts crash-mid-
  write leaves the target file untouched (simulated by writing to a
  tmp, raising, asserting target stat unchanged); existing `write_
  manifest()` migrates to this helper without behavior change.
  Council-amendment (Anthropic 2026-05-12): atomic-write mechanism
  was unspecified across phases, creating per-phase implementation
  drift risk. **Done 2026-05-12** — `scripts/_lib/fs_atomic.py` ships
  the helper (file + parent-dir fsync, temp cleanup on raise);
  `installed_tools.write_manifest()` delegates to it; 10 new tests in
  `tests/test_fs_atomic.py` cover str/bytes/missing-parent/overwrite/
  crash-midwrite (with and without prior target) / TypeError /
  custom-encoding / Path-return / dir-fsync-failure; full sweep
  (`test_fs_atomic`, `test_installed_tools`, `test_cmd_prune`,
  `test_cmd_sync`, `test_cmd_validate`, `test_cmd_export`,
  `test_installed_lock`) = 75 passed.
- [x] **P1.1 — Schema definition.** Extend `scripts/_lib/installed_tools.py`
  with `SCHEMA_VERSION = 2`. Per-tool entries gain optional `files:
  list[FileEntry]` and `merged_keys: list[MergeEntry]`. `FileEntry`
  shape: `{path: str, kind: "bridge"|"deployed"|"marker", sha256:
  str|None}`. `MergeEntry` shape: `{file: str, json_pointer: str}`.
  Top-level manifest gains `deploy_roots: list[str]` — the explicit
  set of directories under which the doctor command considers
  "foreign files" possible (e.g. `.augment/rules/`, `.cursor/rules/`,
  `.claude/skills/`, `.windsurf/rules/`). Files outside `deploy_
  roots` are never surveyed. Acceptance: schema documented in
  `docs/contracts/installed-tools-lockfile.md`; unit tests cover
  round-trip for v1, v2, and mixed. Council-amendment (Anthropic
  2026-05-12): deploy-roots boundary was undefined, doctor would
  have no way to scope "foreign file" detection. **Done 2026-05-12**
  — `SCHEMA_VERSION = 2`, `SCHEMA_VERSIONS_SUPPORTED = (1, 2)`,
  `FILE_KINDS = {bridge, deployed, marker}`, `DEFAULT_DEPLOY_ROOTS`
  constants added; `_render()` and `write_manifest()` gained
  `deploy_roots` kwarg + emit nested `files[]` / `merged_keys[]` /
  `status` only when present; manual fallback parser degrades
  gracefully on v2 (drops nested fields, keeps tool scalars);
  contract published at `docs/contracts/installed-tools-lockfile.md`;
  7 new tests in `tests/test_installed_tools.py` (schema-version,
  v2 round-trip, omit-when-absent, FILE_KINDS, DEFAULT_DEPLOY_ROOTS,
  manual-parser-skips-v2, v1-still-readable); 82 tests pass across
  `test_fs_atomic`, `test_installed_tools`, `test_cmd_prune`,
  `test_cmd_sync`, `test_cmd_validate`, `test_cmd_export`,
  `test_installed_lock`.
- [x] **P1.2 — v1 reader tolerance.** `read_manifest()` returns the
  same shape whether the file is v1 or v2; missing `files[]` defaults
  to empty list. Acceptance: existing v1 fixtures in `tests/`
  continue to pass without modification. **Done 2026-05-12** —
  `read_manifest()` now routes both pyyaml and manual-parser paths
  through `_normalise_v2_shape()`, which backfills `deploy_roots`,
  per-tool `files`, and per-tool `merged_keys` to `[]` when absent
  or YAML-null. Idempotent. Two new tests
  (`test_read_manifest_normalises_v2_shape`, `test_read_manifest_
  empty_tools_safe`) plus the v1 round-trip test cover the contract;
  84 tests pass across the same surface as P1.0/P1.1.
- [x] **P1.3 — v2 writer plumbing.** `write_manifest()` accepts the
  enriched tool dict and serialises `files[]` and `merged_keys[]`
  deterministically (sorted by `path`). Atomic write preserved.
  Acceptance: golden-file test for v2 output shape. **Done 2026-05-12**
  — `_render()` sorts `files[]` by `path` ascending and `merged_keys[]`
  by `(file, json_pointer)` ascending. Atomic write preserved via
  `fs_atomic.write_atomic`. Two new tests:
  `test_v2_writer_sorts_files_and_merged_keys_deterministically`
  (reversed-input → byte-identical output) and
  `test_v2_writer_golden_file_shape` (pins the canonical v2 wire
  format byte-for-byte). 86 tests pass across the sweep.
- [x] **P1.4 — Install records writes.** `install_project()` and
  `install_global()` collect the list of paths each `_copy_dir_*` /
  marker-write call touched, then hand them to `write_manifest()`.
  Bridge markers (e.g. `.cursorrules`) get `kind=bridge`; deployed
  bundle files get `kind=deployed`; one-off markers (e.g.
  `claude-desktop` marker) get `kind=marker`. Acceptance: end-to-end
  install in a temp project produces a v2 manifest listing every
  written path; sha256 matches the on-disk file.
  *Landed 2026-05-12 on `feat/global-content-deployment`*: signature
  refactor on `_copy_dir_dereferencing_symlinks` + `_write_claude_
  desktop_marker` returns `(written, skipped, written_paths)`;
  `_deploy_global_content` aggregates per tool; new helpers
  `_sha256_of_file`, `_file_entry`, `_files_by_tool_from_deploy`,
  `_files_by_tool_from_bridges` translate runtime paths into v2 entries
  with `kind` and content hash; `_update_installed_tools_manifest`
  accepts `files_by_tool` keyword and routes it into `upsert_tool`.
  3,377 tests pass; new unit coverage in `tests/test_install_py.py
  ::FilesByToolHelpers` (4 cases) and `tests/test_installed_tools.py`
  (3 `upsert_tool` plumbing cases).
- [x] **P1.5 — Merge tracking.** When we mutate a JSON file
  (`.cursor/hooks.json`, etc.), record the JSON pointers we wrote
  into `merged_keys[]`. **Constraint:** JSON pointers MUST target
  named object keys only — never array indices. Array merges are
  recorded as the parent object key plus a `value_hash` discriminator;
  uninstall finds the array element by content-hash, not position.
  Rationale (Anthropic 2026-05-12): array-index pointers shift when
  another package modifies the same array, breaking uninstall.
  Acceptance: install + uninstall round-trip on a project that had
  pre-existing keys in the same JSON file leaves the foreign keys
  intact; array-merge test plants two packages writing array
  entries to the same key, uninstalling one leaves the other
  regardless of insertion order.

## Phase 2 — Data-driven Prune (gated on P1)

- [x] **P2.1 — Prune reads the manifest.** `cmd_prune.py` swaps its
  hardcoded `PROJECT_BRIDGE_MARKERS` scan for a manifest-driven scan:
  enumerate `files[]` from the manifest, drop entries whose tool is
  still in `tools[]`, the rest are orphans. Acceptance: orphan list
  matches manually-curated test fixture; the v1-only fallback path
  is preserved for manifests without `files[]`.
- [x] **P2.2 — Merged-keys round-trip on uninstall.** Uninstall reads
  `merged_keys[]` for the tool being removed, edits the target JSON
  file to delete those pointers only, never the whole file.
  **Two-phase commit:** before file deletion, write the tool's manifest
  entry with `status: "uninstalling"`; delete files / strip JSON
  pointers; remove tool entry on success. Prune treats `status:
  "uninstalling"` entries as recoverable — it offers to complete the
  removal (`agent-config prune --resume-uninstall`) instead of
  treating their files as orphans. Rationale (Anthropic 2026-05-12):
  crash mid-uninstall would otherwise leave files prune cannot
  reclaim. Acceptance: integration test installs two synthetic tools
  that both merge into `.cursor/hooks.json`, uninstalls one, asserts
  the other tool's keys survive; crash-simulation test marks tool as
  `uninstalling`, runs `prune --resume-uninstall`, asserts
  consistent state.
- [x] **P2.3 — Drift warning.** If `sha256` on disk differs from the
  recorded value, prune surfaces it as `modified` (not `orphan`),
  skips deletion, prints the path. Acceptance: hand-editing a
  deployed rule, then running prune, shows the file as modified and
  leaves it alone.
- [x] **P2.4 — `--all-missing-lock` semantics carry over.** The
  existing escape hatch (delete everything `PROJECT_BRIDGE_MARKERS`
  knows about when no lockfile exists) keeps working — it is the
  pre-manifest fallback. Acceptance: `cmd_prune.py` test suite
  unchanged for the no-lockfile path.

## Phase 3 — Conflict Detection at Install (gated on P1)

- [x] **P3.1 — Pre-write existence check.** Each `_copy_dir_*` call
  checks: does the target path exist? Is it in **our** manifest?
  Yes-no-no → conflict. Conflict resolution: numbered options
  (`--force` / `skip-file` / `abort`). Default (no flag) =
  interactive prompt; non-interactive context = abort with non-zero
  exit. Acceptance: synthetic test plants a foreign file at a
  deploy path, install detects and refuses.
- [x] **P3.2 — `--force` opt-out.** Passing `--force` overrides the
  conflict check globally for the install run. **Semantics
  (Anthropic 2026-05-12 amendment):** for plain files, `--force` is
  byte-replace (target file overwritten with our content; original
  content not preserved). For JSON-merge targets, `--force` is
  pointer-replace at the recorded JSON pointer — we overwrite the
  value at that pointer with our value; sibling keys in the same
  object are not touched. `--force` is never deep-merge; users
  wanting partial JSON preservation must edit the file manually
  before re-installing. Acceptance: same test as P3.1 with
  `--force` succeeds and records the previously-foreign file as
  ours (kind=deployed); JSON-merge variant asserts only the merged
  pointer is replaced, sibling keys intact.
- [x] **P3.3 — Merge-config conflict-handling.** For JSON merges
  (`.cursor/hooks.json`), conflict = the target JSON pointer we
  want to write already exists and was not written by us. Same
  numbered-options resolution. Acceptance: integration test on
  a `hooks.json` with a foreign `skills.agent-config` key.
- [x] **P3.4 — Conflict-detection skippable in CI.** `AGENT_CONFIG_
  ALLOW_OVERWRITE=1` env-var enables `--force` semantics globally
  for CI / scripted environments. Documented in
  `docs/contracts/installed-tools-lockfile.md`.

## Phase 4 — `agent-config doctor` (gated on P1)

- [x] **P4.1 — Command surface.** New subcommand
  `scripts/_cli/cmd_doctor.py` wired into `scripts/agent-config`.
  Read manifest, walk filesystem, produce three lists: `missing`
  (manifest path absent on disk), `modified` (sha256 mismatch),
  `foreign` (file under a deploy path not in manifest). Exit codes:
  0 = clean, 1 = drift, 2 = error.
- [x] **P4.2 — `--json` output.** Machine-readable output mode
  matching the convention already used by `cmd_prune.py` and
  `cmd_sync.py`. Acceptance: structured JSON with the three
  category lists, each entry carrying `path`, `tool`, `kind`.
- [x] **P4.3 — Remediation hints.** Each surfaced item carries a
  one-line `fix:` hint: `missing` → run `install`; `modified` →
  `--force` re-install or commit the local change; `foreign` →
  identify owner manually or `prune` if confirmed orphan.
  Acceptance: snapshot test against a hand-crafted drift fixture.
- [x] **P4.4 — Doctor in CI smoke.** Optional task target
  `task doctor-smoke` that runs install → doctor (expects clean)
  → manual edit → doctor (expects `modified`). Not part of `task ci`
  default; opt-in for manifest-correctness validation.

## Phase 5 — Inline Package Tag (UX add-on, gated on P1)

- [x] **P5.1 — Frontmatter injection.** `_copy_dir_dereferencing_
  symlinks()` post-processes deployed `.md` files: if existing
  frontmatter present, inject `package: event4u/agent-config` and
  `source: <relative-path>` keys; if no frontmatter, leave the file
  alone (no synthetic frontmatter on rules that don't have one).
  Acceptance: rule files in `.augment/rules/` carry the tag after
  install; the package field survives a re-install (idempotent).
- [x] **P5.2 — Tag verification in doctor.** `cmd_doctor.py` cross-
  checks the inline tag against the manifest entry for the same
  path; mismatch → surface as `tag-drift`. Acceptance: hand-editing
  a tag value, then running doctor, surfaces the mismatch.
- [x] **P5.3 — Tag is non-authoritative.** Document explicitly in
  `docs/contracts/installed-tools-lockfile.md` that the inline tag
  is for human-readability only. Lockfile remains truth source.
  Removing or editing the tag does not affect prune / uninstall.

## Phase 6 — Namespace-as-opt-in (DEFERRED)

Not implemented now. Captured here so the option is documented,
not lost. A future `--namespace=<package-id>` install flag would
deploy under `<root>/skills/<package-id>/` (matching the
`ui-ux-pro-max-skill` layout) for skills only — bridges stay
top-level. Trigger: a real second agent-config-style package
shipping in production and reporting a top-level collision that
schema v2 + conflict detection cannot resolve cleanly.

## Acceptance — roadmap-level done criteria

- [x] All steps in Phases 1–5 closed.
- [x] `docs/contracts/installed-tools-lockfile.md` exists and
  documents v2 schema, conflict-handling, doctor exit codes,
  inline-tag semantics.
- [x] End-to-end scenario test passes: two synthetic packages
  (`pkg-a` + `pkg-b`) both install into the same temp project,
  both record their own files in their own manifest entries,
  uninstalling one leaves the other untouched, prune on the
  survivor reports zero orphans, doctor reports clean
  (`tests/test_e2e_multi_package_coexistence.py`).
- [x] PR #121 carries all of the above as additional commits on
  `feat/global-content-deployment` (no stacked PR, no side-branch).

## Out of scope

- Cross-package manifest standardisation (we don't publish a
  schema for *other* packages to adopt — we only own our own
  manifest).
- Symlink-based install (we already dereference; staying with
  copies).
- Runtime ownership database (no SQLite, no JSON-DB; the lockfile
  remains the single committed source).
- Automatic owner-detection for foreign files (P4.3 emits hints,
  does not heuristically guess).
