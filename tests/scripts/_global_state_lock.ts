// Cross-process serialization lock for golden-parity tests that mutate FIXED,
// shared repo paths (agents/reports/*, agents/evidence/*, a temp `packages/`
// dir, or a temp `.agent-src.uncondensed/skills` symlink).
//
// Vitest runs test FILES in parallel (forks pool, default). The py2ts Phase 8
// Wave 8c scripts that read those shared paths (`audit_auto_rules`,
// `audit_likelihood`, `audit_skill_overlap`, `inventory_abstraction_budget`)
// would otherwise observe each other's transient mutations mid-comparison —
// e.g. the skill-overlap suite's `.agent-src.uncondensed/skills` symlink
// leaking into the likelihood suite's corpus, or the inventory suite's
// `packages/` dir flipping another script's root walk. This mkdir-based lock
// (mkdir is atomic on POSIX) serializes those critical sections across
// processes so each py-vs-ts comparison runs against a stable on-disk state.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const LOCK_DIR = path.join(os.tmpdir(), 'py2ts-wave8c-global-state.lock');

function sleepSyncMs(ms: number): void {
    // Busy-wait without async (vitest hooks here are sync). Short, bounded.
    const end = Date.now() + ms;
    while (Date.now() < end) {
        /* spin */
    }
}

/** Acquire the lock (spin until free or timeout). Returns a release function. */
export function acquireGlobalStateLock(timeoutMs = 120_000): () => void {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            fs.mkdirSync(LOCK_DIR);
            break;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw err;
            }
            // Stale-lock guard: if the lock dir is older than the timeout, steal it.
            try {
                const age = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
                if (age > timeoutMs) {
                    fs.rmdirSync(LOCK_DIR);
                    continue;
                }
            } catch {
                // raced with a release; retry
            }
            if (Date.now() > deadline) {
                throw new Error('acquireGlobalStateLock: timed out waiting for the lock');
            }
            sleepSyncMs(25);
        }
    }
    return () => {
        try {
            fs.rmdirSync(LOCK_DIR);
        } catch {
            // already released
        }
    };
}
