// Tests for src/scripts/council_prune.ts (py2ts Phase 1, ADR-094).
//
// council_prune is the manual CLI wrapper around session.prune_all_council_
// artifacts. Exit code is always 0 for the operational paths; arg errors exit
// 2 with the argparse-shaped usage + error lines.
//
// Golden parity: run the REAL python3 script and the tsx twin with identical
// argv and assert byte-identical stdout/stderr + exit code for the
// side-effect-free paths (--days 0 → disabled, --dry-run, bad args). Per the
// migration convention we do NOT byte-compare the full --help prose — only the
// exit code and the usage line. The default (no --days) path is intentionally
// not exercised here because it prunes the real working tree; the prune logic
// itself is covered by session.test.ts against tmp fixtures.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { hasPython3, runPyScript, runTsScript } from './ai_council/_harness.js';

const py3 = hasPython3();

// tests/scripts/council_prune.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

function runPy(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = runPyScript('council_prune', args, { cwd: REPO_ROOT });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function runTs(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = runTsScript('council_prune', args, { cwd: REPO_ROOT });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

const USAGE = 'usage: council_prune.py [-h] [--days DAYS] [--dry-run]';

describe.runIf(py3)('council_prune CLI — byte-parity with python3', () => {
    for (const [label, args] of [
        ['--days 0 (pruning disabled)', ['--days', '0']],
        ['--days -1 (pruning disabled)', ['--days', '-1']],
        ['--days 7 --dry-run', ['--days', '7', '--dry-run']],
        ['--days=7 --dry-run (=-form)', ['--days=7', '--dry-run']],
    ] as const) {
        it(`exit + stdout + stderr identical — ${label}`, () => {
            const py = runPy([...args]);
            const ts = runTs([...args]);
            expect(ts.status, 'exit code').toBe(py.status);
            expect(ts.stdout, 'stdout byte-parity').toBe(py.stdout);
            expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
            // Operational paths always exit 0.
            expect(ts.status).toBe(0);
        });
    }

    it('--help: exit 0 + usage line (prose not byte-compared per convention)', () => {
        const py = runPy(['--help']);
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        expect(ts.stdout.split('\n')[0]).toBe(USAGE);
        expect(py.stdout.split('\n')[0]).toBe(USAGE);
    });

    for (const [label, args] of [
        ['unrecognized arg', ['--bogus']],
        ['bad --days int value', ['--days', 'abc']],
        ['--days missing value', ['--days']],
    ] as const) {
        it(`arg error: exit 2 + identical usage/error lines — ${label}`, () => {
            const py = runPy([...args]);
            const ts = runTs([...args]);
            expect(ts.status, 'exit code').toBe(2);
            expect(py.status, 'exit code').toBe(2);
            // argparse writes usage + a `prog: error: …` line to stderr.
            expect(ts.stderr, 'stderr byte-parity').toBe(py.stderr);
            expect(ts.stderr.split('\n')[0]).toBe(USAGE);
        });
    }
});
