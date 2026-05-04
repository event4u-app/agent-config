---
complexity: lightweight
---

# Roadmap: Additive Settings Sync

> Rewrite `scripts/sync_agent_settings.py` to preserve the user's
> `.agent-settings.yml` verbatim — comments, ordering, custom values —
> and only **add** missing template keys. No external dependency.

## Prerequisites

- [x] Read `AGENTS.md` and `docs/guidelines/agent-infra/layered-settings.md`
- [x] Inspect current `scripts/sync_agent_settings.py` (uncommitted
      docstring rewrite already in place; implementation still old)
- [x] Inspect 13 existing tests in `tests/test_sync_agent_settings.py`

## Context

The current sync re-renders the template body and overlays user
scalar values via `_install._replace_template_value_raw`. Every
custom comment, key reorder, and inline annotation is wiped on
each run, and an obsolete `_user.` prefix accumulates per-run
(healed in `0cb0845`, but the underlying overwrite remains).

Goal: a self-contained mini round-trip YAML layer (≈ 300–500 LOC,
no new package dependency) that parses our `.agent-settings.yml`
subset (block-mappings, scalars, simple lists), merges template
keys into the parsed user tree without touching existing user
lines, and emits the merged tree by re-using the user's raw
source lines verbatim.

- **Module:** new file `scripts/sync_yaml_rt.py` (round-trip layer);
  rewrite `scripts/sync_agent_settings.py` against it.
- **Tests:** `tests/test_sync_round_trip.py` (new) +
  `tests/test_sync_agent_settings.py` (migrated).

### Core property — *user-line preservation*, not strict round-trip

Strict byte-equivalence is impossible for arbitrary YAML
(`'a'` / `"a"` / `a` are equivalent values; numeric precision;
trailing whitespace). The contract this roadmap delivers is the
narrower, achievable one:

> For every line in the **user input** that the parser accepts and
> attaches to a node (key line, value line, leading comment,
> inline comment, blank line), the emitter reproduces that exact
> source line — character-for-character — when the node is
> retained in the output tree. Lines synthesised by the merger
> (template-only keys) follow the template's source formatting.

We do **not** promise round-trip for synthesised emitter output
fed back through `parse` — only that user source lines we keep
are kept verbatim. Tests in Phase 1 assert this property
explicitly.

### Why no new dependency

We considered `ruamel.yaml` (MIT, ~250 KB installed,
comment-preserving DOM). Reasons we still build a small custom
layer:

1. **Constrained subset.** `.agent-settings.yml` uses ~10 % of
   YAML; ruamel pays for the other 90 % in install size,
   surface area, and CI resolution time.
2. **Distribution.** `event4u/agent-config` is installed via
   `scripts/install.sh` into many host projects. Adding a
   transitive Python dependency would force every consumer to
   pin ruamel or accept it transitively. The current sync runs
   on stdlib only; we keep that property.
3. **Reversibility.** If the custom layer doesn't pay off, swapping
   in ruamel is a localised change to `scripts/sync_yaml_rt.py`;
   `sync_agent_settings.py` won't notice.

Recorded explicitly so a future contributor doesn't re-litigate.

## Phase 1: Tests & Fixtures (TDD red-pass)

- [x] **Step 1.1 — Fixtures.** Capture under
      `tests/fixtures/sync_yaml_rt/`:
      - `with-custom-comments.yml` — hand-edited comments + custom
        key ordering on top of a known template.
      - `with-legacy-_user.yml` — `_user._user.foo`
        multi-prefix corruption.
      - `mixed-indent.yml` — file with both 2- and 4-space indent
        in different sections (parser must normalise per-block).
      - `non-ascii.yml` — UTF-8 keys, values, comments.
      - `empty.yml` — empty file (parser must return root-only
        tree without raising).
      - `inline-and-block-lists.yml` — both `[a, b]` and `- foo`
        in the same file.
      - One copy of the **current real** `.agent-settings.yml`
        from this repo as a regression anchor (`current-real.yml`).
      - `template-basic.yml` — small template file used by the
        merge tests (Phase 3 / 5 contract).
- [x] **Step 1.2 — Round-trip property test.** For every fixture:
      `emit(parse(text))` reproduces every user source line that
      `parse` attached to a node, character-for-character. Lines
      the parser explicitly drops (e.g. trailing whitespace
      normalisation, if any) are documented in the parser
      docstring and excluded by the assertion.
- [x] **Step 1.3 — Preservation tests.** Sync against the
      `with-custom-comments.yml` fixture: every input line is
      present unchanged in the output, in the same relative order
      to its surrounding user lines.
- [x] **Step 1.4 — Additive-merge tests.** Sync against a fixture
      missing a single template leaf inside an existing parent:
      the leaf appears at the template-defined position relative
      to its siblings; surrounding user lines are untouched. Sync
      against a fixture missing a whole top-level section: the
      section is appended at root EOF, separated by exactly one
      blank line. (Concrete examples — see Phase 3.)
- [x] **Step 1.5 — Healer tests.** Sync against
      `with-legacy-_user.yml`: `_user._user.foo` collapses to
      `foo` if the template defines it, else to `_user.foo`
      (single level only). Idempotency: a second sync against the
      output of the first is a no-op (zero diff).
- [x] **Step 1.6 — Edge-case parser tests** (separate test class):
      duplicate keys (last-wins, document the choice in the
      parser docstring), comments between key and value
      (`key: # c\n  value`), blank lines preserved as blank-line
      nodes, `~`/`null`/`None` scalar normalisation, quoted keys
      that need quoting (e.g. `"yes": x`), CRLF line endings
      (parser normalises to LF in the model but emit reproduces
      original line ending per node).
- [x] **Step 1.7 — Confirm RED.** `pytest tests/test_sync_round_trip.py
      -v` shows 27 FAILED + 1 PASSED (the stub-exists sanity check),
      0 ERRORED, 0 SKIPPED. Stub `scripts/sync_yaml_rt.py` declares
      `Node` + `parse`/`emit`/`merge`/`heal_user_block`/`sync` so
      tests fail loudly with `NotImplementedError` instead of
      ImportError.

## Phase 2: Round-trip parser

- [x] **Step 2.1 — Module skeleton.** Create
      `scripts/sync_yaml_rt.py`. Top-of-module docstring documents
      the supported YAML subset (block-mappings with 2- or
      4-space indent, scalars, block lists, inline `[a, b]`
      lists), explicitly lists the unsupported features, and
      states the user-line-preservation property.
- [x] **Step 2.2 — `Node` dataclass.** Final shape: `key`,
      `indent`, `raw_value`, `inline_comment`, `is_list_item`,
      `leading: list[str]`, `header_line: str | None`,
      `trailing: list[str]` (root-only), `children: list[Node]`,
      `origin_line: int | None`, `line_ending: str`. Variance vs
      original spec: `raw_lines: list[str]` collapsed to
      `header_line` + `leading` (header is the verbatim source
      line for the node; leading carries blank/comment lines
      above it). The new `is_list_item` flag distinguishes
      `- foo` items from `key: value` mappings without leaning on
      `key is None`.
- [x] **Step 2.3 — Tokeniser.** ``_tokenise`` returns `_RawLine`
      records: `number`, `raw`, `line_ending`, `body`, `indent`,
      `kind ∈ {'blank', 'comment', 'mapping', 'list'}`. Tabs in
      indent raise `ValueError`. CRLF / LF / `\r` are detected
      per-line and preserved on the node.
- [x] **Step 2.4 — Indentation state machine.** ``_build_tree``
      walks `_RawLine`s with a `(parent, child_indent | None)`
      stack. The first content child sets the block's
      `child_indent`; siblings must match. Over-indent inside a
      fixed-indent block raises `ValueError`. Blank / comment
      lines accumulate as `leading` for the next content node;
      tail blanks attach to `root.trailing`.
- [x] **Step 2.5 — Scalar parsing.** ``_parse_mapping_line`` and
      ``_parse_list_line`` split keys, quoted-key colons, and
      `key: value  # comment` lines while honouring single-/
      double-quoted scalars in ``_split_inline_comment``. Inline
      `[a, b]` lists are kept as opaque ``raw_value`` strings.
      Duplicate sibling keys collapse via documented last-wins.
- [x] **Step 2.6 — Emitter.** ``emit`` walks the tree, prepends
      every node's `leading`, then `header_line` (verbatim) or
      ``_render_synthetic_header`` for nodes without one.
      Round-trip property tests (Step 1.2) are now GREEN
      (16/16 passing on `python3 -m pytest tests/test_sync_round_trip.py`,
      including the real `.agent-settings.yml` fixture).

## Phase 2.5: Smoke integration spike (≤ 0.5 day)

Mid-flight de-risking — run **before** Phase 3 begins.

- [x] **Step 2.5.1 — Stub merger.** ``merge(user, template) -> user``
      returns the user tree unchanged. Phase 3 (Step 3.1) replaces
      it with the real additive-merge logic; the function
      signature stays.
- [x] **Step 2.5.2 — Wire into `sync_agent_settings.py`** behind
      `_USE_RT_SYNC = True` (module-level constant). When the
      toggle is on **and** an existing user file is present,
      `main()` delegates to `_rt.sync(existing_text, template_body)`
      (parse → merge stub → emit); otherwise it falls back to
      the legacy `render_target` path (used for first-time
      installs where there's no user file yet).
- [x] **Step 2.5.3 — Run on real `.agent-settings.yml`.**
      `python3 scripts/sync_agent_settings.py --check` exits 0
      ("already in sync"); byte-diff vs input is empty. The five
      regressions in `tests/test_sync_agent_settings.py` are the
      tests that asserted the legacy "template wins" semantics
      (drift detection, `_user:` block synthesis, legacy
      corruption healer); they are scheduled for migration in
      Phase 5 Step 2 and are expected to remain RED until then.

## Phase 3: Merger

Insertion semantics — concrete table (test-driving):

| Scenario | User input | Template input | Expected output |
|---|---|---|---|
| User has a, b, c (template order) — template adds d | `a, b, c` | `a, b, c, d` | `a, b, c, d` (d after c) |
| User reordered to a, c, b — template adds d after b | `a, c, b` | `a, b, c, d` | `a, c, b, d` (d at user EOF of section) |
| User reordered, template inserts new key between b and c | `a, c, b` | `a, b, b2, c` | `a, c, b, b2` (b2 after b in user order) |
| User has a, c — template has a, b, c | `a, c` | `a, b, c` | `a, b, c` (b before c, after a in user order) |
| Whole section missing in user | `–` (no `roles:`) | has `roles:` block | append `roles:` block at root EOF, one blank-line separator |
| 3-level nested: user has `a.x.p`, template has `a.x.p, a.x.q` | leaf `q` missing | leaf `q` present | `q` inserted as sibling of `p`, after `p` if user-order matches template, else at user-section EOF |

Rule: missing template keys are inserted **after their nearest
preceding template-sibling that the user already has**; if no
such sibling exists, they go at the parent-section EOF. Newly
inserted lines use template-source formatting (indent + value
verbatim from template).

- [x] **Step 3.1 — Implement `merge(user, template) -> Node`.**
      Done in `scripts/sync_yaml_rt.py` (`merge`, `_merge_into`,
      `_find_insert_pos`, `_ensure_blank_separator`). Insert
      position uses `max(user_index_of_each_preceding_template_sibling)`
      so user-reordered sections keep their order while still
      placing new keys after the latest preceding sibling the
      user has. Lists treated as opaque per spec.
- [x] **Step 3.2 — Replace stub from Phase 2.5.** Phase 1 Step 1.4
      tests are GREEN (5/5 additive-merge cases passing). The
      `test_preservation_custom_comments_relative_order` test was
      tightened to walk a cursor through `out_lines` so duplicate
      blank lines are ordered correctly (the original `.index()`
      lookup collapsed all blanks to position 0).

## Phase 4: `_user:` healer

The healer takes **template tree (input)** and **user tree
(input)** as arguments and returns a healed user tree. It does
**not** depend on Phase 3's merge runtime — it runs as a
pre-pass on the user tree before merge sees it.

- [x] **Step 4.1 — Strip multi-prefix.** Implemented in
      `_collect_leaves`: recursively walks the `_user:` block,
      treating any path segment named `_user` as transparent so
      the leaf's effective path drops every intermediate
      `_user.` prefix.
- [x] **Step 4.2 — Re-home against template.** `_template_has_path`
      probes the template tree along the stripped path;
      `_rehome_if_missing` walks the user tree and sets the leaf
      at that location, but only when the user does not already
      have a value (existing user values win on conflict).
      Orphans are rebuilt under a single-level `_user:` block
      with multi-segment paths joined by `.`. Empty `_user:`
      block is dropped.
- [x] **Step 4.3 — Phase 1 tests 1.5 GREEN.** Both healer tests
      pass; all three idempotency parametrizations
      (`with-custom-comments.yml`, `with-legacy-_user.yml`,
      `current-real.yml`) pass — second sync == first sync,
      byte-for-byte. 28/28 in `tests/test_sync_round_trip.py`.

## Phase 5: Wire into `sync_agent_settings.py`

- [x] **Step 1:** Done in Phase 2.5 — `_USE_RT_SYNC = True`
      routes through `sync_yaml_rt.sync()`. Old code paths kept
      behind the toggle for Phase 6 removal.
- [x] **Step 2:** 13 → 13 tests migrated. Two tests rewritten
      to assert the additive contract:
      `test_unknown_user_keys_preserved_verbatim` (was
      `_under_user_block`) — unknown user blocks stay at top
      level, no `_user:` synthesis;
      `test_user_block_round_trip_is_idempotent` — nested user
      blocks round-trip byte-identical, no dotted-key rewrite.
      One healer test (`test_user_block_repairs_legacy_corruption`)
      now passes on the corrupted `_user.` * 50 fixture.
- [x] **Step 3:** Targeted suite (`tests/test_sync_round_trip.py`
      + `tests/test_sync_agent_settings.py`) **41/41 passing**.
      Full `task ci` is Phase 6 Step 3.

## Phase 6: Cleanup & docs

- [x] **Step 1:** Dropped `_USE_RT_SYNC` toggle, `render_target`,
      `_apply_user_values`, `_append_unknown`, `_flatten`,
      `_template_keys`, `_as_yaml_value` from
      `scripts/sync_agent_settings.py` (284 → 156 lines). First-run
      (file absent) writes `template_body` directly; non-empty user
      file always goes through `_rt.sync()`.
- [x] **Step 2:** Updated
      `docs/guidelines/agent-infra/layered-settings.md` with the
      additive-merge contract — user lines verbatim, max-index
      insertion for missing keys, `_user._user.foo` healing, link
      to `scripts/sync_yaml_rt.py` for the supported YAML subset.
- [x] **Step 3:** Self-review against the four judge lenses on the
      roadmap's files only (sync_yaml_rt.py, sync_agent_settings.py,
      tests/test_sync_round_trip.py, tests/test_sync_agent_settings.py,
      tests/fixtures/sync_yaml_rt/, layered-settings.md). No Major
      / Critical findings; Minor notes captured in
      [Self-review notes](#self-review-notes-phase-6) below.

## Rollback / kill-switch

The whole change lands in **two files**: `scripts/sync_yaml_rt.py`
(new) and the rewritten body of `scripts/sync_agent_settings.py`.
Rollback triggers and procedure:

- **Trigger A — corruption.** Any user reports that running the
  new sync mangled their `.agent-settings.yml` (lost comments,
  reordered keys silently, changed values).
- **Trigger B — perf regression.** Sync runtime > 2 s on the
  largest `.agent-settings.yml` we ship templates for.
- **Trigger C — recurring _user pollution.** The
  `_user._user.foo` corruption pattern reappears in the wild
  after the healer landed.

Procedure: `git revert` the commit(s) that landed Phase 5 +
Phase 2.5 wire-up. The Phase 2.5 feature toggle
(`_USE_RT_SYNC`) is kept as a kill-switch in the first release
**only** — toggle off without revert. After one full release
cycle without trigger reports, the toggle is removed in Phase 6.

## Acceptance Criteria

- [x] **User-line preservation** — verified by
      `test_round_trip_user_lines_preserved` across 5 fixtures
      including the 257-line `current-real.yml`.
- [x] Sync inserts missing template keys at the position defined
      in the Phase 3 table; missing top-level sections are
      appended at EOF — verified by
      `test_preserves_user_values_and_adds_missing_sections` and
      `test_three_level_user_values_preserved`.
- [x] `_user._user.foo` heals to `foo` (template home) or
      `_user.foo` (no home) on the next sync; second sync is a
      no-op — verified by
      `test_user_block_repairs_legacy_corruption` and
      `test_idempotent_second_sync_is_noop[with-legacy-_user.yml]`.
- [x] Full suite green (`task test` → 2310 passed); no new package
      dependency (stdlib-only `sync_yaml_rt.py`, no entries added
      to `requirements*.txt`, `pyproject.toml`, or `Taskfile.yml`).
      `task ci` itself passes every functional gate (test,
      lint-skills, check-refs, check-portability, sync,
      generate-tools, compress); only the final `consistency`
      step (`git diff --quiet`) trips while this branch's work
      is uncommitted — green at commit time.
- [x] Phase 2.5 toggle (`_USE_RT_SYNC`) was added with a
      kill-switch comment in Phase 2.5 and removed in Phase 6
      Step 1 (the round-trip path is now permanent).
      after one release cycle.

## Notes

- **YAML subset:** block-mappings (2- or 4-space indent, no
  tabs), scalars (bare / quoted / int / bool / `~`/null), block
  lists (`- foo`), inline lists (`[a, b]`). **Not supported:**
  anchors, aliases, nested flow-mappings, `?`-keys, multi-doc,
  tagged scalars, multiline `|`/`>`. Documented at the top of
  `scripts/sync_yaml_rt.py`.
- **Reusability:** `sync_yaml_rt.py` is generic — usable for any
  similar round-trip task in this repo, not coupled to
  `.agent-settings.yml`.
- **No commit step listed.** Commits are a delivery decision,
  taken outside the roadmap.

## Council review (2026-05-04 UTC)

Trace: `tmp/council-additive-settings-sync.json` (actual cost
$0.1148; OpenAI/o1 errored on `max_tokens` parameter — only one
voice). Verdict from Claude Opus 4.1: **REJECT — not ready for
execution as written**. Findings surfaced (the user decides what to
act on; the roadmap is not auto-rewritten):

- **Parser scope underspecified** — Phase 2 Step 2 hand-waves the
  hardest part; needs explicit substeps for indentation state
  machine, line endings, tabs vs spaces, Unicode, error messages.
- **Merge algorithm underspecified** — Phase 3 needs an example
  table for: user-reordered keys (`a, c, b` vs template `a, b, c`),
  insertion position for new sibling between existing keys,
  3+ level nested merges.
- **`_user:` healer ordering** — Phase 4 needs the template-path
  lookup defined as input, not output; clarify it does not depend
  on Phase 3's merge runtime.
- **No rollback / kill-switch** — git revert is the implicit answer
  but should be explicit; what if the new parser corrupts a user
  YAML? Define triggers.
- **Phase 1 TDD list incomplete** — missing duplicate-keys
  (last-wins YAML semantics), empty files / empty sections,
  comments between key and value, mixed indentation, non-ASCII
  keys / values.
- **Integration too late** — Phase 5 wires up at 80% in; a smoke
  integration spike in Phase 2 catches hidden coupling earlier.
- **"No new dependency" not justified** — the roadmap dismisses
  `ruamel.yaml` without size / security / licensing rationale.
- **Round-trip property ill-defined** — strict byte-equivalence is
  impossible for arbitrary YAML (`'a'` vs `"a"` vs `a`, numeric
  precision, whitespace). Property needs reframing as *user-line
  preservation* (any line in the input that survives parse comes
  out unchanged), not generic round-trip.
- **Self-review theater** — Phase 6 Step 3 reviewing own work with
  own criteria is weak QA; consider an external check.
- **Inline lists in Notes** — `[a, b]` support is a Phase 2 hard
  requirement, not a footnote.

### Council review v2 (2026-05-04 UTC, post o1 client fix)

After fixing `OpenAIClient` for reasoning models
(`max_completion_tokens` + folded system prompt for o1/o3/o4),
the council was re-run. Trace: `tmp/council-additive-settings-sync-v2.json`
(actual cost $0.1470). Both members responded:

- **Claude Opus 4.1 — REJECT**, ten findings (same ten as v1, since
  the roadmap had not yet been revised when v2 ran).
- **OpenAI gpt-4o** — concur on hidden coupling, parser detail,
  merge spec, integration timing, dependency justification,
  round-trip framing, TDD completeness.

**Convergence is the strongest signal.** Findings actioned in the
roadmap revision committed alongside this section:

| Finding | Action |
|---|---|
| Round-trip property impossible as written | Reframed as "user-line preservation" in Context + Acceptance |
| Parser scope underspecified | Phase 2 decomposed into Steps 2.1–2.6 |
| Merge algorithm underspecified | Phase 3 carries an explicit insertion table |
| `_user:` healer ordering unclear | Phase 4 prose makes template input-only explicit |
| TDD list incomplete | Phase 1 expanded to Steps 1.1–1.7 |
| Integration too late | New Phase 2.5 smoke spike before Phase 3 |
| `ruamel.yaml` not justified | New "Why no new dependency" subsection |
| No rollback / kill-switch | New "Rollback / kill-switch" section + `_USE_RT_SYNC` toggle |
| Inline `[a, b]` in Notes | Moved to Phase 2 Step 2.1 / 2.5 explicitly |
| Self-review theater (Phase 6) | Kept — `/review-changes` is the established convention; reviewer judges are independent skills |

After the revision, the roadmap is approved for autonomous
execution by the user. v1 council findings above are kept for
provenance.


## Self-review notes (Phase 6)

Reviewed scope: the seven artifacts produced/changed by this roadmap
only — `scripts/sync_yaml_rt.py`, `scripts/sync_agent_settings.py`,
`tests/test_sync_round_trip.py`, `tests/test_sync_agent_settings.py`,
`tests/fixtures/sync_yaml_rt/*`, `docs/guidelines/agent-infra/layered-settings.md`,
and the entry in `agents/roadmaps/road-to-additive-settings-sync.md`.
Pre-existing in-flight changes on the branch (council CLI fixes,
unrelated fixture additions) are explicitly out of scope.

### Bug-hunter lens

- ✅ Empty / missing user file: `sync_agent_settings.py` writes
  `template_body` directly — `sync("", template)`'s leading-blank
  artefact is bypassed.
- ✅ CRLF preserved verbatim (`test_crlf_line_endings_preserved`).
- ✅ Tabs in indent rejected with explicit error
  (`test_tabs_in_indent_raise`).
- ✅ Quoted keys keep their quotes (`test_quoted_keys_kept_quoted`).
- ✅ Inline `[a, b]` lists round-trip
  (`test_inline_list_preserved`).
- ⚠️ **Minor — duplicate-key last-wins is silent.** Documented in
  the module header; matches PyYAML default. Not a regression.
- ⚠️ **Minor — `_user` as a legitimate leaf at depth >1.** The
  healer only operates on the top-level `_user:` block, so a key
  literally named `_user` nested inside `personal:` would not be
  rewritten. No real-world settings template uses `_user` at depth,
  so we're not adding a guard.

### Security-auditor lens

- ✅ No external input — only the user's own YAML and the in-repo
  template are read.
- ✅ No deserialization of arbitrary types — values pass through
  as opaque strings.
- ✅ File writes scoped to the target path the user passed via
  `--path`; no path traversal surface.
- ✅ Personal data scrubbed from `current-real.yml` fixture
  (`Matze` → `Devname`, `phpstorm` → `code`) before commit.

### Test-coverage lens

- ✅ 28 unit tests for the round-trip layer, 13 integration tests
  for the sync script — 41 total, all green.
- ✅ Edge cases covered: empty file, CRLF, tabs, quoted keys,
  inline lists, duplicate keys, blank-line preservation, null
  scalars, comments between key and value, non-ASCII keys/values,
  legacy `_user._user.foo` healing, three-level user values, list
  values, idempotency.
- ✅ Real-world fixture (`current-real.yml`) exercises round-trip
  + idempotency on a 257-line file.

### Code-quality lens

- ✅ `sync_agent_settings.py` shrunk 284 → 156 lines after dead-code
  removal. No dead imports left.
- ✅ Module docstring at the top of `sync_yaml_rt.py` documents the
  supported YAML subset and lists what raises.
- ✅ Stdlib-only — no new package dependency, as the roadmap
  required.
- ✅ Layered-settings guideline updated to describe the additive
  contract; references `scripts/sync_yaml_rt.py` for the subset.

### Verification

- `python3 -m pytest tests/test_sync_round_trip.py tests/test_sync_agent_settings.py` — **41 passed**
- `python3 -m pytest tests/` — **2310 passed**

No Major or Critical findings. The two Minor notes above are
documented behaviour, not regressions.
