// Tests for src/scripts/skill_tools/run_block_d_eval.ts (py2ts Phase 8 /
// Wave 8h). No pytest suite exists, so this is a focused differential suite
// over the pure aggregator (run_all) plus a golden parity layer (python3 vs
// tsx) over temp skill/persona/corpus fixtures. The runner invokes no model —
// D2/D3/D4 are pure scoring — so the whole surface is deterministic given a
// fixed corpus.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run_all } from '../../src/scripts/skill_tools/run_block_d_eval.js';
import {
    hasPython3,
    mkTmp,
    rmTmp,
    runBoth,
    writePersona,
    writeSkillFull,
} from './_skill_tools.js';

let tmp: string;
beforeEach(() => {
    tmp = mkTmp();
});
afterEach(() => {
    rmTmp(tmp);
});

interface Fixture {
    skills: string;
    personas: string;
    corpus: string;
}

function buildFixture(): Fixture {
    const skills = path.join(tmp, 'skills');
    const personas = path.join(tmp, 'p');
    const corpus = path.join(tmp, 'corpus');
    fs.mkdirSync(corpus, { recursive: true });
    writeSkillFull(skills, 'livewire-architect', 'shape livewire components reactive state', ['frontend-engineer']);
    writeSkillFull(skills, 'form-handler', 'design forms validation submission', ['frontend-engineer']);
    writeSkillFull(skills, 'terraform', 'terraform aws modules', []);
    writePersona(personas, 'frontend-engineer', 'specialist');
    writePersona(personas, 'qa', 'specialist');
    writePersona(personas, 'developer', 'core');
    fs.writeFileSync(
        path.join(corpus, 'd2-tasks.json'),
        JSON.stringify({
            tasks: [
                { id: 1, task: 'shape a livewire component reactive state', expected_top3: ['livewire-architect'] },
                { id: 2, task: 'design forms validation submission', expected_top3: ['form-handler'] },
            ],
        }),
        'utf-8',
    );
    fs.writeFileSync(
        path.join(corpus, 'd4-tasks.json'),
        JSON.stringify({
            tasks: [
                { id: 1, task: 'shape a livewire component reactive state', expected_top1: 'livewire-architect' },
                { id: 2, task: 'design forms validation submission', expected_top1: 'form-handler' },
                { id: 3, task: 'terraform aws modules', expected_top1: 'terraform' },
                { id: 4, task: 'nope nothing', expected_top1: 'x' },
                { id: 5, task: 'nope two', expected_top1: 'y' },
            ],
        }),
        'utf-8',
    );
    return { skills, personas, corpus };
}

describe('run_block_d_eval — run_all aggregator', () => {
    it('passes the pilot on a curated fixture', () => {
        const { skills, personas, corpus } = buildFixture();
        const report = run_all(skills, personas, corpus);
        expect(report.D2.passed).toBe(true);
        expect(report.D2.hits).toBe(2);
        expect(report.D2.total).toBe(2);
        expect(report.D2.pct).toBe(1.0);
        expect(report.D3.passed).toBe(true);
        expect(report.D3.count).toBeGreaterThanOrEqual(2);
        expect(report.D4.passed).toBe(true);
        expect(report.D4.hits).toBe(3);
        expect(report.tools_passed).toBe(3);
        expect(report.pilot_passed).toBe(true);
    });

    it('fails the pilot on empty corpora + empty dirs', () => {
        const corpus = path.join(tmp, 'c2');
        fs.mkdirSync(corpus, { recursive: true });
        fs.writeFileSync(path.join(corpus, 'd2-tasks.json'), JSON.stringify({ tasks: [] }), 'utf-8');
        fs.writeFileSync(path.join(corpus, 'd4-tasks.json'), JSON.stringify({ tasks: [] }), 'utf-8');
        const report = run_all(path.join(tmp, 'empty-s'), path.join(tmp, 'empty-p'), corpus);
        expect(report.D2.pct).toBe(0.0);
        expect(report.D2.passed).toBe(false);
        expect(report.D3.passed).toBe(false);
        expect(report.D4.passed).toBe(false);
        expect(report.tools_passed).toBe(0);
        expect(report.pilot_passed).toBe(false);
    });
});

describe.runIf(hasPython3())('run_block_d_eval — golden parity (python3 vs tsx)', () => {
    it('human summary is byte-identical (pilot PASS)', () => {
        const { skills, personas, corpus } = buildFixture();
        const { py, ts } = runBoth('run_block_d_eval', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
            '--corpus-dir',
            corpus,
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--json is byte-identical incl. pct=1.0 float (pilot PASS)', () => {
        const { skills, personas, corpus } = buildFixture();
        const { py, ts } = runBoth('run_block_d_eval', [
            '--skills-dir',
            skills,
            '--personas-dir',
            personas,
            '--corpus-dir',
            corpus,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        // pct must serialize WITH the trailing `.0` (Python float repr).
        expect(ts.stdout).toContain('"pct": 1.0');
    });

    it('pilot FAIL exits 1 with byte-identical --json (pct=0.0)', () => {
        const corpus = path.join(tmp, 'c2');
        fs.mkdirSync(corpus, { recursive: true });
        fs.writeFileSync(path.join(corpus, 'd2-tasks.json'), JSON.stringify({ tasks: [] }), 'utf-8');
        fs.writeFileSync(path.join(corpus, 'd4-tasks.json'), JSON.stringify({ tasks: [] }), 'utf-8');
        const { py, ts } = runBoth('run_block_d_eval', [
            '--skills-dir',
            path.join(tmp, 'empty-s'),
            '--personas-dir',
            path.join(tmp, 'empty-p'),
            '--corpus-dir',
            corpus,
            '--json',
        ]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stdout).toContain('"pct": 0.0');
    });
});
