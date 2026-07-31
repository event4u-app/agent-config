---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
related_adrs: [ADR-020]
---

# Road to consistent rule scoping — the CLI global install ships rules the wizard filters out

> Two global-install paths, one settings file, two different rule sets. The
> consumer-scoping flip that shipped 2026-07-13 is unmet on the path most
> consumers actually take.

## Goal

`agent-config init` (CLI global) and the browser wizard ship the **same** rule
set for the same settings, with a test that fails if they diverge again.

## Context

Found by the emitter audit in `road-to-zero-ceremony-install` Phase 5
(2026-07-31), which is archived; the finding is carried here so it is not
buried with it.

The shared predicate is `ruleFileArrives` (`src/install/rule_scope.ts:87`). The
wizard plan path applies it (`src/install/wizard-plan.ts`, filter attached when
`srcRel === 'dist/agent-src/rules'`), and so does the bash payload sync
(`install.sh :: sync_hybrid` via `rule_scope_cli.ts`). The CLI global path does
not.

Verified directly, not inferred:

- `src/scripts/install.ts` has **no import** of `../install/rule_scope.js`.
- The shipped bundle `dist/install/install.mjs` contains **zero** occurrences
  of `ruleFileArrives` or `source-of-truth.md`.
- `src/scripts/install --global` sets `SKIP_SYNC=true`, so `install.sh` — the
  path that *does* filter — never runs for a global install.

Effect: the CLI global install ships all 110 rules including
`source-of-truth.md` (a maintainer-only rule that tells the reader to edit
`src/`, which a consumer does not have); the wizard ships 94.

Why no test caught it: `tests/install/rule_scoping_plan.test.ts` exercises
`expandWizardSources` — the plan path — not `_deploy_global_content`.

## Phase 1 — Filter the copy and the inventory together

- [x] Thread a `fileFilter` through `_copy_dir_dereferencing_symlinks`
      (`src/scripts/install.ts`), applied when the source is
      `dist/agent-src/rules`, mirroring `wizard-plan.ts`.
- [x] Apply the same predicate inside
      `global_deploy_inventory.expected_deploy_files`. **Both, or neither** —
      `expected_deploy_files` feeds the reaper, so filtering only the copy
      leaves previously-installed maintainer rules behind on upgrade, which is
      worse than the status quo.
- [x] Resolve the scope from settings the same way the wizard does
      (`ruleScopeFromSettings`), falling back to `LEGACY_ALL` on any read
      failure — the compat exclusion still applies in that case.

**Exit criteria:** a global install with a scoped settings file writes the same
rule basenames the wizard plan would, and an upgrade from an unscoped install
reaps the now-excluded rules.
**Rollback:** revert the filter; behaviour returns to shipping everything.

## Phase 2 — Pin it where nothing looks today

- [x] Cover `_deploy_global_content` directly: same settings in, same rule set
      out as `expandWizardSources`. The assertion is the *equality of the two
      paths*, not a hardcoded count — a count would rot on the next rule added.
- [x] Add the upgrade case: install unscoped, re-install scoped, assert the
      maintainer-only rules are gone rather than merely un-refreshed.

**Exit criteria:** both tests fail against the pre-fix code.
**Rollback:** drop the tests.

## Acceptance criteria

- The CLI global install and the wizard global install produce identical rule
  sets for identical settings.
- The equality is asserted by a test that fails on the pre-fix code.
- Upgrades reap rules that scoping newly excludes.
- No change to the projection: `dist == rewrite(src)` byte equality untouched.

## Provenance

`road-to-zero-ceremony-install` Phase 5 emitter audit, 2026-07-31. Recorded
there as blocker `cli-global-install-skips-rule-scoping`; promoted here on
archival of that roadmap. Not fixed in the originating PR by deliberate scope
control: it changes write behaviour and upgrade semantics on the
highest-blast-radius surface in the package, inside a change that was otherwise
documentation and CI gates.

## Execution notes (2026-07-31)

Four things the plan did not say, each of which changed the patch:

1. **A third call site.** `_preview_global_reap` (`src/scripts/install.ts`, the
   `--dry-run` path) computes `expected_deploy_files` independently of the
   deploy loop. Filtering only the deploy would have left `--dry-run`
   under-reporting exactly the rules a scoped upgrade is about to reap — the
   preview would have promised less deletion than the real run performs. Both
   sites now derive the filter from the same helper.

2. **`GLOBAL_DEPLOY_SOURCES` exists twice** — `src/scripts/install.ts` defines
   its own copy alongside the exported one in `src/install/wizard-plan.ts`. The
   acceptance criterion ("identical rule sets") silently depends on those two
   tables agreeing. Not restructured here (out of scope), but the new equality
   test compares the two paths' actual output, so a divergence in the rules row
   now fails a test instead of shipping. The shared `RULE_SOURCE_REL` constant
   removes the narrower risk that the two paths filter *different* sources.

3. **Measured counts differ from the plan's.** The plan says 110 rules → 94
   scoped; measured on the trunk today it is 109 legacy-all → 95 scoped (110
   files on disk, minus the always-excluded `source-of-truth.md`, then 14 more
   under the shipped workspace set). The drift is why the acceptance criterion
   is stated as path-equality rather than a count — that phrasing survived the
   drift, a count would not have.

4. **`complexity: moderate` was not a legal value.** `lint_roadmap_complexity`
   accepts only `lightweight|structural`, so this roadmap read as *untagged* and
   failed that gate. `moderate` has been used six times across the tree, so this
   is vocabulary drift rather than a one-off typo — retagged `lightweight` here
   (92 lines, 2 phases, well inside the caps); the remaining occurrences are
   left for whoever owns those files.

One premise re-verified after an initial mis-read: `SKIP_SYNC` is **not** dead.
It lives in the extensionless bash orchestrator `src/scripts/install:181`
(`--global) GLOBAL=true; SKIP_SYNC=true`), which a `*.ts`/`*.sh` grep misses —
so the plan's account of *why* the global path never filtered is correct.
