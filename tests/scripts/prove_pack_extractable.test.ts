// Tests for src/scripts/prove_pack_extractable.ts (py2ts Phase 8 / Wave 8g).
//
// Ports tests/test_prove_pack_extractable.py 1:1 (laravel is extractable;
// unknown pack reports cleanly) plus a golden-parity layer comparing the
// `--json` payload from python3 vs tsx on the REAL repo. The `closure`,
// `hard_dangling`, and `advisory` arrays are compared as SORTED sets because
// the Python original iterates an unsorted glob (OS-order non-determinism),
// while the TS twin iterates the deterministic sorted agent_src view.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { prove } from '../../src/scripts/prove_pack_extractable.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('prove_pack_extractable — ported pytest suite', () => {
    it('laravel is extractable', () => {
        const { extractable: ok, hard, closure } = prove('laravel');
        expect(ok).toBe(true);
        expect(hard).toEqual([]);
        for (const p of ['laravel', 'php', 'engineering-base']) {
            expect(closure.has(p)).toBe(true);
        }
    });

    it('unknown pack reports cleanly', () => {
        const { extractable: ok, hard: msgs, closure } = prove('definitely-not-a-pack');
        expect(ok).toBe(false);
        expect(closure.size).toBe(0);
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0]).toContain('unknown pack');
    });
});

// ---- Golden parity: python3 vs tsx --json (sorted-set compare) -------------

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prove_pack_extractable.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'prove_pack_extractable.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface JsonOut {
    pack: string;
    extractable: boolean;
    closure: string[];
    hard_dangling: string[];
    advisory: string[];
}

describe.skipIf(!py3)('prove_pack_extractable — golden parity (python3 vs tsx)', () => {
    function runPy(args: string[]): ReturnType<typeof spawnSync> {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: string[]): ReturnType<typeof spawnSync> {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('laravel --json → same extractable + sorted closure/hard/advisory', () => {
        const p = runPy(['laravel', '--json']);
        const t = runTs(['laravel', '--json']);
        expect(t.status).toBe(p.status);
        const pj = JSON.parse(String(p.stdout ?? '')) as JsonOut;
        const tj = JSON.parse(String(t.stdout ?? '')) as JsonOut;
        expect(tj.pack).toBe(pj.pack);
        expect(tj.extractable).toBe(pj.extractable);
        // closure is already sorted in both; compare directly.
        expect(tj.closure).toEqual(pj.closure);
        // hard / advisory order is glob-order-dependent in Python — compare sets.
        expect([...tj.hard_dangling].sort()).toEqual([...pj.hard_dangling].sort());
        expect([...tj.advisory].sort()).toEqual([...pj.advisory].sort());
    });

    it('unknown pack → identical stderr/exit (exit 3)', () => {
        const p = runPy(['definitely-not-a-pack']);
        const t = runTs(['definitely-not-a-pack']);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(3);
        expect(t.stderr).toBe(p.stderr);
    });
});
