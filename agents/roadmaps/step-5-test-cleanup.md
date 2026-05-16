---
complexity: structural
status: draft
---

# Road to Test-Suite Cleanup (audit-only)

**Status:** OPEN — audit captured 2026-05-14, no deletion authorised.
**Parent roadmap:** [`road-to-productization.md`](archive/road-to-productization.md) (archived)
P5.5 produced this audit.
**Sequence position:** step-5 — runs after step-1 … step-4. Audit-only (no canonical `Phase <id>` headings), so it is excluded from the auto-dashboard by `status: draft` per [`roadmap-progress-sync`](../../.augment/rules/roadmap-progress-sync.md).
**Mode:** Audit-only candidate list. Every checkbox is a *review*
checkbox, not a *delete* checkbox. Deletion needs its own roadmap
(`road-to-test-consolidation`) plus operator sign-off per
[`non-destructive-by-default`](../../.agent-src.uncompressed/rules/non-destructive-by-default.md).

**Measured-vs-claimed disclaimer:** Every duplication / redundancy verdict in this roadmap is **claimed by the 2026-05-14 audit pass**, not re-validated since. The `828 tests across 32 files` count is a single-point measurement; drift is not tracked. No deletion is authorised on the basis of these claims alone — the follow-on `road-to-test-consolidation` roadmap owns the measure-then-delete loop.

---

## Why this roadmap exists

The `work_engine` test suite grew from 0 → 828 tests across 32 files
during the Phase-3 / Phase-4 build-out of the decision engine, hook
runner, scoring layer, and step pipeline. P5.5 of the productization
roadmap asked: *which of those tests are duplicative enough to
consolidate without losing signal?*

The audit answers that question. It does **not** answer the
deletion question — that needs human review per file, plus a
guarantee that any consolidated test still asserts the same
property each removed test asserted.

---

## Method

### Pass A — static (test-name suffix collisions)

```bash
python3 -m pytest --collect-only -q 2>&1 \
  | grep -E '^tests/' \
  | sed -E 's|.*::([^[]+).*|\1|' \
  | sort | uniq -c | sort -rn | head -40
```

Surfaces test-function suffixes that appear in 3+ files. **Two
suffixes appeared 106 times each** across the consumer-projection
test surface (`test_windsurf_workflow_link_resolves`,
`test_cursor_command_link_resolves`). These come from generated
fixture-parametrised tests in `tests/test_modern_editor_formats.py`
and similar — they are **not** redundant in intent (they assert one
file per generated artifact), but they are redundant in *shape*
(same body, different fixture). Consolidation candidate is a
single parametrised test per shape, not deletion.

### Pass B — dynamic (Jaccard coverage overlap)

```bash
coverage run --source=work_engine -m pytest -q tests/work_engine
# then per-test-file: coverage run --append → produces N data files
# combine → per-test-file line sets → pairwise Jaccard
python3 scripts/_tmp_test_redundancy_audit.py  # cluster ≥3 tests, J≥0.80
```

Result file: `/tmp/audit-result.json` (not committed — regenerable).

**Cluster threshold:** ≥ 3 tests hitting the same module with
≥ 80 % pairwise Jaccard overlap of covered line numbers in that
module. 35 unique cluster signatures across 66 source modules.

### Known caveat — import-time coupling inflates Jaccard

A large cluster of ~31 tests shows 100 % Jaccard on shared
modules like `chat_history_append.py`, `decision_trace.py`,
`runner.py`. **Most of that overlap is import-time line execution**
— Python records every `def` / `class` / module-level statement as
"covered" the moment the module loads. Tests that import the same
package (`work_engine.hooks.builtin.*`, `work_engine.steps.*`) all
share that import surface even if their bodies test entirely
different code paths.

Net effect: Jaccard ≥ 0.80 on a thin module is **weak** signal.
Jaccard ≥ 0.80 on a *thick* module (≥ 100 covered lines) is
**strong** signal. The candidate list below uses the strong signal.

---

## Strong-signal candidates (review, do not delete)

### Cluster 1 — UI directive 5-way symmetry

- [ ] **C1.1 — Review `test_step_{apply,audit,design,polish,review}.py`.**
  All five tests hit the same five UI-directive modules
  (`directives/ui/{apply,audit,design,polish,review}.py`,
  `directives/ui/_passthrough.py`) with pairwise Jaccard = 1.0 on
  the non-self modules. Likely cause: each test imports
  `directives.ui.__init__`, which re-exports its siblings. The
  *bodies* of each test still cover one directive's logic — but
  the per-sibling import lines are double-counted. Consolidation
  candidate: a single `test_directives_ui_passthrough_init.py`
  for the shared init wiring, leaving each per-directive test to
  cover only its own module's logic.

### Cluster 2 — Mixed-directive 3-way symmetry

- [ ] **C2.1 — Review `test_step_{contract,stitch,ui_mixed}.py`.**
  Same pattern as C1 against `directives/mixed/__init__.py`.
  Three tests, pairwise Jaccard = 1.0 on the shared init module.
  Consolidation candidate: extract a single
  `test_directives_mixed_init.py` for the wiring, keep per-step
  tests for behaviour.

### Cluster 3 — Step-runner import surface

- [ ] **C3.1 — Review 16-test cluster on `confidence.py`,
  `refine.py`, `report.py`, `memory.py`, `plan.py`, `analyze.py`,
  `implement.py`, `test.py`, `verify.py`.** Sixteen of the
  `test_step_*.py` tests hit each other's step modules with
  Jaccard = 1.0. Cause: `work_engine.steps.__init__` imports all
  siblings for the runner. This is **legitimate import coupling**
  — likely no consolidation opportunity without restructuring
  `steps/__init__.py` to lazy-import. **Decision:** leave alone
  unless `steps/__init__.py` is refactored independently.

### Cluster 4 — Hook-runner import surface

- [ ] **C4.1 — Review 31-test cluster on `chat_history_append`,
  `chat_history_halt_append`, `decision_gate`, `decision_trace`,
  `directive_set_guard`, `halt_surface_audit`,
  `memory_visibility`, `state_shape_validation`, `trace`,
  `runner`, `registry`, `settings`, `user_global_paths`,
  `exceptions`, `decision_engine`.** Largest cluster — every
  hook test plus every step test plus every scoring test hits
  these. Cause: `work_engine.hooks.builtin.__init__` imports all
  built-in hooks; `work_engine.hooks.runner` imports the registry.
  Same diagnosis as C3: **import coupling, not test redundancy**.
  Leave alone.

---

## Pass-A candidates (test-name shape redundancy)

- [ ] **A1 — Review `test_modern_editor_formats.py` and siblings.**
  Two test-function suffixes appear **106 times each**. These
  are generated fixture cases that assert one artifact per
  generated file. Candidate: collapse to one `@pytest.mark.parametrize`
  per shape; each fixture becomes a parameter, not a test
  function. Risk: parametrised assertion-failure messages lose
  the file-name suffix; mitigate with `ids=` per parameter.

---

## Out of scope

- **Deletion.** This roadmap audits; it does not delete. A
  follow-up roadmap (`road-to-test-consolidation`) needs operator
  sign-off and a per-cluster regression-test plan before any
  test file shrinks.
- **`work_engine` package-init refactor.** Clusters 3 and 4 would
  shrink if the package inits lazy-imported. That is an
  architectural decision (cold-start cost vs cohesion) that does
  not belong in a test-cleanup roadmap.
- **Coverage configuration.** This audit used `coverage run`
  with default include rules. A future pass could use
  `--branch` coverage for stronger signal; deferred.

---

## Done

When each `[ ]` above has a documented decision (consolidate,
leave-alone, or defer), this roadmap closes. **No tests are
deleted under this roadmap.**
