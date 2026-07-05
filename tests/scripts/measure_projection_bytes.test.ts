// Tests for src/scripts/measure_projection_bytes.ts (py2ts Phase 8 / Wave 8c).
//
// The script is a read-only reporter (without --regenerate); it walks per-tool
// projection surfaces and prints a table (default) or JSON (--json). The tsx
// twin is the source of truth (the python original was deleted in the
// teardown); output is corpus-derived → asserted structurally (exit 0, valid,
// deterministic), not snapshotted. The --regenerate path is out of scope
// (mutates the whole tool tree).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_projection_bytes.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe('measure_projection_bytes — CLI contract', () => {
    it('default + --json run deterministically over the repo (exit 0)', () => {
        for (const args of [[], ['--json']]) {
            const a = runTs(args);
            expect(a.status, `${args.join(' ')}: ${a.stderr}`).toBe(0);
            expect(a.stdout.length).toBeGreaterThan(0);
            expect(runTs(args).stdout, `${args.join(' ')} deterministic`).toBe(a.stdout);
        }
        expect(() => JSON.parse(runTs(['--json']).stdout)).not.toThrow();
    });

    it('bad flag → exit 2', () => {
        expect(runTs(['--nope']).status).toBe(2);
    });
});
