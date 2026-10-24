<!-- evidence-type: review -->

# Independent test review — step 4.7 (`projection.mode` retired)

**Reviewer:** one independent read-only subagent session (same provider, separate context; owner
rule of 2026-10-24: one reviewer for non-security, non-irreversible changes). **Date:** 2026-10-24.
**Subject:** net-removed assertions `check_test_weakening` reported on branch
`drain/setup-4-7-impl-20261024` — `tests/scripts/catalogue_capture.test.ts` (10),
`tests/scripts/install.test.ts` (3), `tests/scripts/profile_use.test.ts` (8).
**Question asked (neutral):** per removed assertion group, was it removed because the behaviour no
longer exists, or does it weaken coverage of behaviour that still exists?

| File | Removed | Behaviour still exists and is untested? |
|---|---|---|
| `catalogue_capture.test.ts` | the `migrationEligibility` / `migrationPromptLines` block | no — both functions and their only caller (`_scoped_migration_notice`) are deleted |
| `install.test.ts` | the `mode` assertions of `_resolve_scoped_projection` and two mode-only cases | no — the function returns only `active_packs`; the remaining behaviour is asserted with exact `toEqual`, a leftover `projection.mode` is newly asserted ignored; the per-host prune is tested in `tests/install/projection_mode_retired.test.ts` |
| `profile_use.test.ts` | the `projection.mode` write assertions and the `legacy-all` flip/no-change cases | no — `_set_projection_mode` is deleted and `legacy-all` exits 2; replaced by assertions of the new behaviour, in-process and as a subprocess |

The reviewer ran the three files and the new test: 4 files, 103 tests, green. Gaps named that are not
weakening: the wiring of `install_global` into the per-host prune is untested (it was before too);
two comments described removed code (`skill_catalogue.ts`, `globalRuleScope.ts`) — fixed in the same
change.

**VERDICT: legitimate**
