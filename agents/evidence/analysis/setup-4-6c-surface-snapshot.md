<!-- evidence-type: analysis -->

# Step 4.6c of road-to-a-setup-that-decides-itself — the settings-surface snapshot and the cut

Moved verbatim from the step on 2026-10-24, when the step's own size gate
first counted it (the blocked-by comment that used to precede its title had
hidden it from the counter).

## The step's reasoning, 2026-10-20

`tests/scripts/consumer_matrix_settings_delta.test.ts` is red on this branch
and green on `main`, and the cause is the phase title rather than a defect.
TWO cases, not one — corrected 2026-10-20 after reading the CI output rather
than the earlier note: `an identical pair produces no delta and no
disagreement` and `the leg itself throws on a disagreement, and returns on
agreement`. They are one cause, because the second asserts that
`assertUpgradeDelta` THROWS exactly when the first finds a disagreement, so a
real delta reds both by construction. The cases compare the committed
snapshot of the LAST released surface against a surface flattened from the
LIVE schema; removing three keys makes those two genuinely different, so the
comparison correctly reports a delta the installer fixture does not carry.
Checked rather than assumed: all three keys ARE registered in
`_lib/settings_removed_keys.ts:157-159`, so they classify as
`carried_removals` — the ALLOWED class — not as `untombstoned_removals`,
which is the one that refuses. A release cut would accept them.
The snapshot may not be refreshed here: its own contract says `release.ts`
"rewrites it inside the cut, which is its only writer", and
`check_release_pr_shape` allows the file only on a release PR. Editing it on
this branch would be the silent surface change Phase 4 exists to prevent.

## Closure, 2026-10-24

Landed 2026-10-24: the cut came — `release: 17.0.0` (`14bd7c7db3`, 2026-10-22) wrote `tests/fixtures/settings_surface_released.json` with `lean_projection.hosts`, `lean_projection.mode` and `projection.rule_workspaces` under `removedKeys`, and 17.1.0 through 17.4.0 kept them. `npx vitest run tests/scripts/consumer_matrix_settings_delta.test.ts` -> 10/10 at `ff276c482a`, with no edit to the test since that cut. Said rather than left for a reader to find: the test DID change once, in the Phase 4 PR itself (#2532, 2026-10-21, before the cut) — its identical-pair case now compares the committed surface with itself and its agreeing case derives the delta from the tree — so the green no longer depends on a cut at all. The snapshot was never written outside a cut, which is the property this step existed to keep.
