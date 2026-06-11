// Tests for src/scripts/lint_bench_corpus.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: a lint_corpus unit check on a sandboxed
// corpus file (byte-identical error strings), plus a golden-parity layer
// (python3 vs tsx on the REAL REPO across the real CI args: default, --quiet,
// --require-full) asserting byte-identical stdout/stderr/exit. Skipped without
// python3. The real-repo CI invocation is `lint_bench_corpus --quiet`.
import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_bench_corpus.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_bench_corpus.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_bench_corpus.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_bench_corpus — lint_corpus', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('flags missing top-level keys + bad version', () => {
        const p = path.join(tmp, 'corpus-x.yaml');
        fs.writeFileSync(p, 'corpus_id: x\n');
        const errs = mod.lint_corpus(p, new Set<string>(), null);
        expect(errs).toContain('corpus-x.yaml: missing_top_level: version');
        expect(errs).toContain('corpus-x.yaml: missing_top_level: prompts');
    });

    it('flags an unknown skill and bad id format', () => {
        const p = path.join(tmp, 'corpus-y.yaml');
        fs.writeFileSync(
            p,
            [
                'version: 1',
                'corpus_id: y',
                'prompts:',
                '  - id: BAD_ID',
                '    category: canonical',
                '    prompt: hi',
                '    expected_skills: [no-such-skill]',
            ].join('\n') + '\n',
        );
        const errs = mod.lint_corpus(p, new Set(['real-skill']), null);
        expect(errs.some((e) => e.includes('bad_id_format'))).toBe(true);
        expect(errs).toContain('corpus-y.yaml:#0: unknown_skill: no-such-skill');
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_bench_corpus — golden parity (python3 vs tsx)', () => {
    const runPy = (args: readonly string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: readonly string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    for (const args of [[], ['--quiet'], ['--require-full']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
