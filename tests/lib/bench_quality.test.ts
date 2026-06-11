/**
 * Vitest twin parity suite for the bench quality probe
 * (`src/scripts/_lib/bench_quality.ts`). No pre-existing pytest suite
 * exists, so this is a focused differential suite: `score_corpus` is run
 * on shared synthetic prompt sets (rubric + regex assertions, with and
 * without an agent-output file) by both the TS port and the Python
 * original (via `tests/lib/bench_quality_py_driver.py`) and the result
 * blocks are asserted value-identical, including the
 * round-half-to-even `quality_score` (ADR-088 py2ts Phase 2 / Wave 2a).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { score_corpus, type Prompt } from '../../src/scripts/_lib/bench_quality.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DRIVER = path.join(HERE, 'bench_quality_py_driver.py');
const REPO_ROOT = path.resolve(HERE, '..', '..');

function pyDriver(spec: unknown): unknown {
    const out = execFileSync('python3', [DRIVER], {
        input: Buffer.from(JSON.stringify(spec), 'utf-8'),
        maxBuffer: 16 * 1024 * 1024,
        cwd: REPO_ROOT,
    }).toString('utf-8');
    return JSON.parse(out);
}
function pythonAvailable(): boolean {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
const PY = pythonAvailable();

// Prompt set: rubric (must_include / must_not_include / length_words) +
// regex assertion + a prompt with no assertion (excluded from `declared`).
const PROMPTS: Prompt[] = [
    { id: 'q-01', rubric: { must_include: ['rollback', 'hotfix'] } },
    { id: 'q-02', rubric: { must_not_include: ['TODO'] } },
    { id: 'q-03', rubric: { length_words: { min: 3, max: 8 } } },
    { id: 'q-04', quality_assertion: '^\\d+\\.' },
    { id: 'q-05' }, // no assertion → not declared
    { id: 'q-06', rubric: { must_include: ['café'], length_words: { min: 1 } } },
];

// Agent outputs: q-01 passes, q-02 passes, q-03 too-short (fail),
// q-04 matches, q-06 passes → 4/5 declared passing → 0.8.
const OUTPUTS: Record<string, string> = {
    'q-01': 'first rollback then hotfix if needed',
    'q-02': 'all clean here',
    'q-03': 'two words',
    'q-04': '1. do the thing',
    'q-06': 'café au lait served warm',
};

describe('bench_quality — score_corpus not_collected (no agent output)', () => {
    it.runIf(PY)('matches Python not_collected block', () => {
        const ts = score_corpus(PROMPTS, null);
        const py = pyDriver({ prompts: PROMPTS, agent_output_path: null });
        expect(ts).toEqual(py);
    });

    it('reports not_collected with the declared assertions only', () => {
        const block = score_corpus(PROMPTS, null);
        expect(block.source).toBe('not_collected');
        expect(block.prompts_with_assertion).toBe(5); // q-05 excluded
        expect(block.prompts_passing).toBe(0);
        expect(block.quality_score).toBe(0.0);
        for (const r of block.per_prompt) {
            expect(r.passed).toBe('not_collected');
        }
    });

    it('treats a missing file path as not_collected', () => {
        const block = score_corpus(PROMPTS, path.join(os.tmpdir(), 'does-not-exist-xyz.json'));
        expect(block.source).toBe('not_collected');
    });
});

describe('bench_quality — score_corpus scored (with agent output)', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
            tmp = null;
        }
    });

    it.runIf(PY)('matches Python scored block (incl. round-half-to-even score)', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-q-'));
        const outPath = path.join(tmp, 'out.json');
        fs.writeFileSync(outPath, JSON.stringify(OUTPUTS), 'utf-8');
        const ts = score_corpus(PROMPTS, outPath);
        const py = pyDriver({ prompts: PROMPTS, agent_output_path: outPath }) as Record<string, unknown>;
        // `source` is the absolute path → identical because both run from REPO_ROOT
        // with the same tmp path; assert the rest deep-equal and source equal.
        expect(ts).toEqual(py);
    });

    it('scores 4/5 declared → 0.8 with the expected per-prompt verdicts', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-q2-'));
        const outPath = path.join(tmp, 'out.json');
        fs.writeFileSync(outPath, JSON.stringify(OUTPUTS), 'utf-8');
        const block = score_corpus(PROMPTS, outPath);
        expect(block.source).toBe(outPath);
        expect(block.prompts_with_assertion).toBe(5);
        expect(block.prompts_passing).toBe(4);
        expect(block.quality_score).toBe(0.8);
        const byId = Object.fromEntries(block.per_prompt.map((r) => [r.id, r.passed]));
        expect(byId['q-01']).toBe(true);
        expect(byId['q-02']).toBe(true);
        expect(byId['q-03']).toBe(false); // too short
        expect(byId['q-04']).toBe(true);
        expect(byId['q-06']).toBe(true);
    });
});

describe('bench_quality — banker rounding of quality_score', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
            tmp = null;
        }
    });

    // 1/3 passing → round(0.3333…, 4) = 0.3333. Verify against Python.
    it.runIf(PY)('matches Python round(passing/total, 4) for a thirds ratio', () => {
        const prompts: Prompt[] = [
            { id: 't-1', rubric: { must_include: ['a'] } },
            { id: 't-2', rubric: { must_include: ['b'] } },
            { id: 't-3', rubric: { must_include: ['c'] } },
        ];
        const outputs = { 't-1': 'a', 't-2': 'x', 't-3': 'y' };
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-q3-'));
        const outPath = path.join(tmp, 'out.json');
        fs.writeFileSync(outPath, JSON.stringify(outputs), 'utf-8');
        const ts = score_corpus(prompts, outPath);
        const py = pyDriver({ prompts, agent_output_path: outPath });
        expect(ts).toEqual(py);
        expect(ts.quality_score).toBe(0.3333);
    });
});
