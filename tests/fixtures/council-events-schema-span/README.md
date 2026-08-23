# Council events log spanning the v4 → v5 schema bump

Four `post_run`/`command=run` lines at schema v4 (no `stance_agreement`), three
at v5 (one per agreement value), plus two lines that must be excluded from every
rate: a `pre_run`/`command=estimate` line and a non-`quorum_result` action.

Its whole job is to make the Step 3.2 obligation checkable: the four registered
metrics must reproduce **unchanged** across the bump, and the agreement rate must
**exclude** the v4 stratum rather than default it.

Hand-written rather than captured, deliberately — `agents/runtime/council/events.log`
is gitignored and machine-local, so a captured span cannot be committed and a
fixture is the only form this evidence can take in the tree. The lines follow the
field set `appendQuorumEvent` writes; if that shape changes, this fixture is stale
and `attendance_metrics.test.ts` is where you find out.
