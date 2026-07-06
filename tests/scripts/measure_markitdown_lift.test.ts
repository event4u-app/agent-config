// Tests for src/scripts/measure_markitdown_lift.ts (py2ts Phase 8 / Wave 8c).
//
// The script is a read-only reporter over tests/fixtures/markitdown-corpus/;
// it never mutates the repo. The tsx twin is the source of truth (the python
// original was deleted in the teardown); output is corpus-derived → asserted
// structurally (exit 0, non-empty, deterministic). The --convert path needs
// the `markitdown` CLI on PATH; when absent it exits 3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_markitdown_lift.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasMarkitdown(): boolean {
    return spawnSync(process.platform === 'win32' ? 'where' : 'which', ['markitdown'], {
        encoding: 'utf8',
    }).status === 0;
}
function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe('measure_markitdown_lift — CLI contract', () => {
    it('baseline (default) runs deterministically over the corpus (exit 0)', () => {
        const a = runTs([]);
        expect(a.status, a.stderr).toBe(0);
        expect(a.stdout.length).toBeGreaterThan(0);
        expect(runTs([]).stdout).toBe(a.stdout);
    });

    it.skipIf(hasMarkitdown())('--convert without the markitdown binary → exit 3', () => {
        const ts = runTs(['--convert']);
        expect(ts.status).toBe(3);
    });

    it.runIf(hasMarkitdown())('--convert with the binary present runs (exit 0)', () => {
        expect(runTs(['--convert']).status).toBe(0);
    });

    it('bad flag → exit 2', () => {
        expect(runTs(['--bogus']).status).toBe(2);
    });
});
