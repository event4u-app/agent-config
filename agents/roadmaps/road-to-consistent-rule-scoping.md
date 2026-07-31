---
complexity: moderate
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

- [ ] Thread a `fileFilter` through `_copy_dir_dereferencing_symlinks`
      (`src/scripts/install.ts`), applied when the source is
      `dist/agent-src/rules`, mirroring `wizard-plan.ts`.
- [ ] Apply the same predicate inside
      `global_deploy_inventory.expected_deploy_files`. **Both, or neither** —
      `expected_deploy_files` feeds the reaper, so filtering only the copy
      leaves previously-installed maintainer rules behind on upgrade, which is
      worse than the status quo.
- [ ] Resolve the scope from settings the same way the wizard does
      (`ruleScopeFromSettings`), falling back to `LEGACY_ALL` on any read
      failure — the compat exclusion still applies in that case.

**Exit criteria:** a global install with a scoped settings file writes the same
rule basenames the wizard plan would, and an upgrade from an unscoped install
reaps the now-excluded rules.
**Rollback:** revert the filter; behaviour returns to shipping everything.

## Phase 2 — Pin it where nothing looks today

- [ ] Cover `_deploy_global_content` directly: same settings in, same rule set
      out as `expandWizardSources`. The assertion is the *equality of the two
      paths*, not a hardcoded count — a count would rot on the next rule added.
- [ ] Add the upgrade case: install unscoped, re-install scoped, assert the
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
