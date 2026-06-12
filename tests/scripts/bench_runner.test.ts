// Tests for src/scripts/bench_runner.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists for bench_runner, so this is a focused differential
// suite over the pure helpers (tokenize, rank_skills) plus a golden-parity
// layer that runs python3 vs tsx and compares stdout + stderr + exit code
// byte-for-byte. bench_runner is read-only (no writers), so the golden layer
// leaves zero git drift. All outputs here are fully deterministic — the
// keyword-overlap ranking has no timing or OS-order dependence (skills are
// iterated in sorted-path order in both implementations).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as br from '../../src/scripts/bench_runner.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_runner.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_runner.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('bench_runner — pure helpers', () => {
    it('tokenize lowercases, drops stopwords + short tokens', () => {
        const toks = br.tokenize('The Quick brown FOX and a cat');
        // "the","and","a" are stopwords; "fox","cat" are length 3 → kept;
        // "quick","brown" kept. Tokens must be > 2 chars.
        expect([...toks].sort()).toEqual(['brown', 'cat', 'fox', 'quick']);
    });

    it('tokenize keeps hyphenated tokens matching [a-z][a-z0-9-]+', () => {
        const toks = br.tokenize('laravel-migration test-1');
        expect(toks.has('laravel-migration')).toBe(true);
        expect(toks.has('test-1')).toBe(true);
    });

    it('rank_skills returns [] for an all-stopword prompt', () => {
        const skills = new Map([['a', 'a alpha skill']]);
        expect(br.rank_skills('the a an', skills, 3)).toEqual([]);
    });

    it('rank_skills ranks by Jaccard overlap and caps at top-K', () => {
        const skills = new Map<string, string>([
            ['alpha', 'alpha database migration schema'],
            ['beta', 'beta unrelated thing'],
            ['gamma', 'gamma database query tuning'],
        ]);
        const ranked = br.rank_skills('database migration', skills, 2);
        // alpha shares {database, migration}; gamma shares {database}; beta none.
        expect(ranked[0]).toBe('alpha');
        expect(ranked.length).toBe(2);
        expect(ranked).not.toContain('beta');
    });

    it('rank_skills breaks score ties by reverse name order (tuple sort)', () => {
        // Two skills with identical token sets → identical Jaccard → Python
        // tuple sort reverse=True compares the name descending.
        const skills = new Map<string, string>([
            ['aaa', 'database migration'],
            ['zzz', 'database migration'],
        ]);
        const ranked = br.rank_skills('database migration', skills, 2);
        expect(ranked).toEqual(['zzz', 'aaa']);
    });
});

describe.runIf(hasPython3())('bench_runner — golden parity (python3 vs tsx)', () => {
    const cases: string[][] = [
        ['--corpus', 'dev', '--json'],
        ['--corpus', 'non-dev', '--json'],
        ['--corpus', 'dev'],
        ['--corpus', 'non-dev'],
        ['--corpus', 'dev', '--top-k', '1', '--json'],
        ['--corpus', 'dev', '--top-k', '5'],
        ['--corpus', 'does-not-exist'],
    ];
    for (const args of cases) {
        it(`stdout + stderr + exit match for: ${args.join(' ')}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
        });
    }
});
