// A gate whose report is read through a pipe must not end with `process.exit()`.
//
// Measured 2026-10-14: `check_ci_local_parity` intermittently lost its final
// `CI ↔ local parity:` line under vitest on the ubuntu shard (runs 38583523411,
// 38590983958). `process.exit()` terminates before libuv drains a write queue,
// and a pipe whose reader is slow puts stdout writes in that queue. Reproduced
// locally with the reader stalled on a socketpair: 8 192 of 14 523 bytes arrived
// with `process.exit(main())`, all of them with `process.exitCode = main()`.
//
// The harness makes the slow reader deterministic, so this does not depend on
// the host's pipe capacity or on CI load.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const HARNESS = path.join(REPO, 'tests', 'scripts', 'fixtures', 'stalled_stdout_harness.ts');

function run(args: string[]): { stdout: string; status: number | null } {
    const r = spawnSync(TSX, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
    return { stdout: r.stdout ?? '', status: r.status };
}

// The gates whose report exceeds a socketpair's capacity (8 KiB on macOS). The
// parity gate's text report shrinks as gates get wired, so its JSON form keeps it
// above the capacity; both forms leave through the same exit path.
const GATES: readonly (readonly [string, readonly string[]])[] = [
    ['check_ci_local_parity.ts', ['--format', 'json']],
    ['check_memory.ts', []],
    ['lint_roadmap_blockers.ts', []],
];

describe('large-output gates exit without discarding queued stdout', () => {
    for (const [gate, args] of GATES) {
        it(`${gate} delivers its whole report to a reader that lags`, () => {
            const script = path.join(REPO, 'src', 'scripts', gate);
            const direct = run([script, ...args]);
            // Guard the guard: a gate printing nothing would pass the equality below.
            expect(direct.stdout.length).toBeGreaterThan(8192);
            const lagged = run([HARNESS, script, ...args]);
            // A harness that crashes truncates too; the status tells that apart from a gate loss.
            expect(lagged.status).toBe(direct.status);
            expect(lagged.stdout).toBe(direct.stdout);
        }, 120_000);
    }
});
