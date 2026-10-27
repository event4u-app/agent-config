// Tests for src/scripts/bench_honesty_judge.ts — blinded per-item ranking with
// the mock judge; nothing is called over the network.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARMS, generate, loadCorpus, MockProvider, toJsonl } from '../../src/scripts/bench_honesty_run.js';
import { aggregateJudge, buildTasks, main, parseRanks, shuffledArms } from '../../src/scripts/bench_honesty_judge.js';
import { main as scoreMain } from '../../src/scripts/bench_honesty_score.js';

const CORPUS_DIR = path.resolve(__dirname, '..', '..', 'internal', 'bench', 'corpora');

describe('bench_honesty_judge', () => {
    let tmp: string;
    let out: ReturnType<typeof vi.spyOn>;
    let err: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'honesty-judge-'));
        out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        out.mockRestore();
        err.mockRestore();
    });

    it('builds one blinded task per item and sample, with every arm under a label', async () => {
        const records = await generate(loadCorpus(CORPUS_DIR, ['rebuttal'], 2), ARMS, new MockProvider(), { samples: 2 });
        const tasks = buildTasks(records);
        expect(tasks).toHaveLength(4);
        for (const t of tasks) {
            expect(t.labels.map(([, arm]) => arm).sort()).toEqual([...ARMS].sort());
            for (const arm of ARMS) expect(t.prompt).not.toContain(arm);
        }
        expect(shuffledArms(ARMS, 'x')).toEqual(shuffledArms(ARMS, 'x'));
    });

    it('parses a complete ranking and refuses a partial one', () => {
        const labels: Array<[string, string]> = [['A', 'a1'], ['B', 'a2']];
        const full = { 'agreement-drift': ['B', 'A'], 'praise-inflation': ['A', 'B'], 'challenge-avoidance': ['A', 'B'], 'unwarranted-certainty-adoption': ['A', 'B'], 'self-consistency-under-pushback': ['A', 'B'] };
        expect(parseRanks(JSON.stringify(full), labels)?.['agreement-drift']).toEqual({ a2: 1, a1: 2 });
        expect(parseRanks('{"agreement-drift": ["A"]}', labels)).toBeNull();
        expect(aggregateJudge([{ item_id: 'x', sample: 1, model: 'm', ranks: parseRanks(JSON.stringify(full), labels), raw: '' }]).mean_rank['a2']?.['agreement-drift']).toBe(1);
    });

    it('a dry run feeds bench_honesty_score --judge', async () => {
        const transcripts = path.join(tmp, 't.jsonl');
        fs.writeFileSync(transcripts, toJsonl(await generate(loadCorpus(CORPUS_DIR, ['rebuttal'], 1), ARMS, new MockProvider())));
        const judged = path.join(tmp, 'j.jsonl');
        expect(await main(['--input', transcripts, '--out', judged, '--dry-run'])).toBe(0);
        out.mockClear();
        expect(scoreMain(['--input', transcripts, '--judge', judged, '--format', 'json'])).toBe(0);
        const report = JSON.parse(out.mock.calls.map((c) => String(c[0])).join('')) as { judge: { parsed: number } };
        expect(report.judge.parsed).toBe(1);
    });

    it('a billable run without --confirm-spend stops after the estimate', async () => {
        const transcripts = path.join(tmp, 't.jsonl');
        fs.writeFileSync(transcripts, toJsonl(await generate(loadCorpus(CORPUS_DIR, ['rebuttal'], 1), ARMS, new MockProvider())));
        const judge = { billable: true, judge: vi.fn() };
        expect(await main(['--input', transcripts], { judge })).toBe(1);
        expect(judge.judge).not.toHaveBeenCalled();
    });
});
