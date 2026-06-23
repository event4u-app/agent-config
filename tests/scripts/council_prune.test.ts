// Intent tests for src/scripts/council_prune.ts (py2ts Phase 1, ADR-094).
//
// council_prune is the manual CLI wrapper around the council artefact pruner.
// The python twin is gone (py2ts teardown), so these assert the tsx twin's OWN
// contract directly — the same surface the former byte-parity rig exercised:
//   - operational paths exit 0 with their deterministic status lines
//     (--days <=0 → disabled, --dry-run → cutoff banner),
//   - --help exits 0 with the argparse usage line,
//   - arg errors exit 2 with the usage line + a `prog: error: …` line.
// The default (no --days) path is intentionally not exercised here because it
// prunes the real working tree; the prune logic itself is covered by
// session.test.ts against tmp fixtures.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// tests/scripts/council_prune.test.ts → two levels up is the repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'council_prune.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs(args: string[]): { status: number; stdout: string; stderr: string } {
    const r: SpawnSyncReturns<string> = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

const USAGE = 'usage: council_prune.py [-h] [--days DAYS] [--dry-run]';

describe('council_prune CLI — intent', () => {
    for (const [label, args, expectedLines] of [
        [
            '--days 0 (pruning disabled)',
            ['--days', '0'],
            ['council-prune: retention_days=0 → pruning disabled.'],
        ],
        [
            '--days -1 (pruning disabled)',
            ['--days', '-1'],
            ['council-prune: retention_days=-1 → pruning disabled.'],
        ],
        [
            '--days 7 --dry-run',
            ['--days', '7', '--dry-run'],
            [
                'council-prune: dry-run, cutoff = retention_days=7',
                'council-prune: actual deletion requires omitting --dry-run',
            ],
        ],
        [
            '--days=7 --dry-run (=-form)',
            ['--days=7', '--dry-run'],
            [
                'council-prune: dry-run, cutoff = retention_days=7',
                'council-prune: actual deletion requires omitting --dry-run',
            ],
        ],
    ] as const) {
        it(`operational path exits 0 with its status line — ${label}`, () => {
            const ts = runTs([...args]);
            // Operational paths always exit 0.
            expect(ts.status, 'exit code').toBe(0);
            const out = ts.stdout.split('\n').filter((l) => l.length > 0);
            expect(out, 'stdout lines').toEqual([...expectedLines]);
        });
    }

    it('--help: exit 0 + usage line', () => {
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.split('\n')[0]).toBe(USAGE);
    });

    for (const [label, args, errFragment] of [
        ['unrecognized arg', ['--bogus'], 'unrecognized arguments: --bogus'],
        ['bad --days int value', ['--days', 'abc'], "argument --days: invalid int value: 'abc'"],
        ['--days missing value', ['--days'], 'argument --days: expected one argument'],
    ] as const) {
        it(`arg error: exit 2 + usage/error lines — ${label}`, () => {
            const ts = runTs([...args]);
            expect(ts.status, 'exit code').toBe(2);
            // argparse writes usage + a `prog: error: …` line to stderr.
            expect(ts.stderr.split('\n')[0]).toBe(USAGE);
            expect(ts.stderr).toContain(`council_prune.py: error: ${errFragment}`);
        });
    }
});
