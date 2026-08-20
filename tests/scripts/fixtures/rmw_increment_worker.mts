/**
 * Worker for the cross-process mutual-exclusion test.
 *
 * NOT a `.test.ts` file, deliberately: vitest collects those, and a fixture that
 * gets collected runs as a suite with no tests (a known trap in this repo). The
 * `.mts` extension keeps it out of the glob while staying directly runnable
 * under `tsx`.
 *
 * Increments `n` in the target file `ITERATIONS` times through
 * `update_json_under_lock`. Several of these run AT THE SAME TIME; if the lock
 * holds, the final value equals workers × iterations. Without a lock, concurrent
 * load→compute→publish sequences overwrite each other and the total comes out
 * short — which is the whole point: this is the one shape a single-threaded test
 * cannot produce.
 *
 * argv: <target> <iterations>
 */
import { update_json_under_lock } from '../../../src/scripts/hooks/state_io.js';

const target = process.argv[2];
const iterations = Number(process.argv[3]);

if (!target || !Number.isFinite(iterations)) {
    process.stderr.write('usage: rmw_increment_worker.mts <target> <iterations>\n');
    process.exit(2);
}

let failed = 0;
for (let i = 0; i < iterations; i += 1) {
    // Compared against the union member, never coerced. `if (!ok)` was correct
    // against the old boolean and is a silent no-op against the union — every
    // member is a truthy string, so the failure counter would read 0 forever
    // and this worker would report a clean run through a broken lock. That is
    // the migration hazard named at `update_json_under_lock`; this fixture is
    // where it would have landed unnoticed.
    const outcome = update_json_under_lock<{ n: number }>(target, (loaded) => ({
        n: (typeof loaded.n === 'number' ? loaded.n : 0) + 1,
    }));
    if (outcome !== 'written') failed += 1;
}

// Report failed writes so the test can distinguish "the lock lost an update"
// from "the write never landed", which are different defects.
process.stdout.write(JSON.stringify({ failed }));
