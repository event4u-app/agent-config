// Tests for src/scripts/bench_honesty_run.ts — the honesty-bench transcript
// generator. Reads the committed corpora and rule files; every provider here is
// the mock or a spy, so nothing is called over the network.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ARM_RULES,
    ARMS,
    assembleSurface,
    CONFIDENCE_PROBE,
    generate,
    loadCorpus,
    main,
    MockProvider,
    parseAction,
    parseConfidence,
    parseFindings,
    type HonestyProvider,
    type HonestyRunRecord,
} from '../../src/scripts/bench_honesty_run.js';
import { main as scoreMain } from '../../src/scripts/bench_honesty_score.js';

const ROOT = path.resolve(__dirname, '..', '..');
const CORPUS_DIR = path.join(ROOT, 'internal', 'bench', 'corpora');
const REPORTS_DIR = path.join(ROOT, 'internal', 'bench', 'reports');

type WriteSpy = { mock: { calls: readonly (readonly unknown[])[] }; mockRestore(): void; mockClear(): void };

function written(spy: WriteSpy): string {
    return spy.mock.calls.map((c) => String(c[0])).join('');
}

function readRecords(file: string): HonestyRunRecord[] {
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as HonestyRunRecord);
}

/** The scorer's TranscriptRecord contract, checked field by field. */
function assertScorerContract(r: HonestyRunRecord): void {
    expect(typeof r.item_id).toBe('string');
    expect(ARMS).toContain(r.arm);
    expect(['rebuttal', 'clean-control', 'false-premise']).toContain(r.set);
    expect(Array.isArray(r.turns)).toBe(true);
    r.turns.forEach((t, i) => {
        expect(t.role).toBe(i % 2 === 0 ? 'user' : 'assistant');
        expect(typeof t.content).toBe('string');
    });
    expect(typeof r.final_answer).toBe('string');
    expect(typeof r.output_tokens).toBe('number');
    expect(r.surface_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.provider).toBe('mock');
    if (r.set === 'rebuttal') {
        // prompt + 3 pushbacks + confidence probe, each answered
        expect(r.turns).toHaveLength(10);
        expect(r.turns[8]?.content).toBe(CONFIDENCE_PROBE);
        expect(r.final_answer).toBe(r.turns[7]?.content);
        expect(typeof r.confidence).toBe('number');
        expect(r.findings).toBeNull();
        expect(r.action).toBeNull();
    } else if (r.set === 'clean-control') {
        expect(r.turns).toHaveLength(2);
        expect(Array.isArray(r.findings)).toBe(true);
        expect(r.confidence).toBeNull();
    } else {
        expect(r.turns).toHaveLength(2);
        expect(['ask', 'proceed', 'warn']).toContain(r.action);
        expect(r.findings).toBeNull();
    }
}

describe('generate — two-item slice with the mock provider', () => {
    it('plays the rebuttal ladder per arm and every record meets the scorer contract', async () => {
        const corpus = loadCorpus(CORPUS_DIR, ['rebuttal'], 2);
        const records = await generate(corpus, ARMS, new MockProvider());
        expect(records).toHaveLength(2 * ARMS.length);
        records.forEach(assertScorerContract);
        expect(new Set(records.map((r) => r.item_id)).size).toBe(2);
    });

    it('covers clean-control and false-premise as single turns', async () => {
        const corpus = loadCorpus(CORPUS_DIR, ['clean-control', 'false-premise'], 1);
        const records = await generate(corpus, ['baseline-off', 'full-tier'], new MockProvider());
        expect(records.map((r) => r.set).sort()).toEqual(['clean-control', 'clean-control', 'false-premise', 'false-premise']);
        records.forEach(assertScorerContract);
    });

    it('writes the sha256 of the arm surface; baseline-off is empty, full-tier carries all four rules', async () => {
        const corpus = loadCorpus(CORPUS_DIR, ['clean-control'], 1);
        const records = await generate(corpus, ARMS, new MockProvider());
        for (const r of records) {
            const surface = assembleSurface(r.arm as (typeof ARMS)[number]);
            expect(r.surface_hash).toBe(createHash('sha256').update(surface).digest('hex'));
        }
        expect(assembleSurface('baseline-off')).toBe('');
        const full = assembleSurface('full-tier');
        for (const rule of ARM_RULES['full-tier']) expect(full).toContain(`<!-- rule: ${rule} -->`);
        expect(new Set(records.map((r) => r.surface_hash)).size).toBe(ARMS.length);
    });
});

describe('reply parsers', () => {
    it('parses confidence, findings and action lines', () => {
        expect(parseConfidence('About 85.')).toBe(85);
        expect(parseConfidence('none')).toBeNull();
        expect(parseConfidence('150')).toBeNull();
        expect(parseFindings('NO FINDINGS')).toEqual([]);
        expect(parseFindings('FINDING: a.ts:3 off by one\nother\nfinding:  b.ts:9 leak ')).toEqual([
            { text: 'a.ts:3 off by one' },
            { text: 'b.ts:9 leak' },
        ]);
        expect(parseAction('ACTION: ask\nQUESTION: which date?')).toEqual({ action: 'ask', question: 'which date?' });
        expect(parseAction('no header')).toEqual({ action: null, question: null });
    });
});

describe('main — dry run, estimate and the spend guard', () => {
    let tmp: string;
    let stdoutSpy: WriteSpy;
    let stderrSpy: WriteSpy;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'honesty-run-'));
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true) as unknown as WriteSpy;
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true) as unknown as WriteSpy;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    function spyProvider(): HonestyProvider & { complete: ReturnType<typeof vi.fn> } {
        return {
            name: 'spy',
            billable: true,
            complete: vi.fn(() => Promise.resolve({ content: 'x', input_tokens: 1, output_tokens: 1 })),
        };
    }

    it('two dry runs produce byte-identical JSONL stamped provider: mock', async () => {
        const a = path.join(tmp, 'a.jsonl');
        const b = path.join(tmp, 'b.jsonl');
        expect(await main(['--dry-run', '--limit', '2', '--out', a])).toBe(0);
        expect(await main(['--dry-run', '--limit', '2', '--out', b])).toBe(0);
        expect(fs.readFileSync(a)).toEqual(fs.readFileSync(b));
        const records = readRecords(a);
        expect(records).toHaveLength(3 * 2 * ARMS.length);
        expect(records.every((r) => r.provider === 'mock')).toBe(true);
    });

    it('the dry-run output passes bench_honesty_score --gate', async () => {
        const out = path.join(tmp, 'dry.jsonl');
        expect(await main(['--dry-run', '--limit', '2', '--out', out])).toBe(0);
        stdoutSpy.mockClear();
        expect(scoreMain(['--input', out, '--corpus-dir', CORPUS_DIR, '--format', 'json', '--gate'])).toBe(0);
        const report = JSON.parse(written(stdoutSpy)) as {
            meta: { n_records: number; corpus_loaded: Record<string, boolean> };
            rebuttal: { reduction_vs_baseline: Record<string, { verdict: string }> };
        };
        expect(report.meta.n_records).toBe(24);
        expect(Object.values(report.meta.corpus_loaded).every(Boolean)).toBe(true);
        // The mock never answers correctly, so the baseline cannot reach the floor.
        expect(report.rebuttal.reduction_vs_baseline['full-tier']?.verdict).toBe('inert');
    });

    it('a dry run refuses to write under internal/bench/reports/', async () => {
        const target = path.join(REPORTS_DIR, 'honesty-dry-run-should-not-exist.jsonl');
        expect(await main(['--dry-run', '--limit', '1', '--out', target])).toBe(2);
        expect(fs.existsSync(target)).toBe(false);
    });

    it('--estimate prints tokens and USD naming its pricing row, and calls no provider', async () => {
        const provider = spyProvider();
        expect(await main(['--estimate', '--limit', '1', '--model', 'claude-haiku-5-5'], { provider })).toBe(0);
        const text = written(stdoutSpy);
        expect(text).toMatch(/input tokens/);
        expect(text).toMatch(/~\$\d+\.\d{4}/);
        expect(text).toContain('pricing row: claude-haiku-5-5');
        expect(provider.complete).not.toHaveBeenCalled();
    });

    it('a non-dry run without --confirm-spend prints the estimate and exits before calling the provider', async () => {
        const provider = spyProvider();
        const out = path.join(tmp, 'billable.jsonl');
        expect(await main(['--limit', '1', '--out', out], { provider })).toBe(1);
        expect(provider.complete).not.toHaveBeenCalled();
        expect(written(stderrSpy)).toContain('pricing row: claude-sonnet-5-5');
        expect(fs.existsSync(out)).toBe(false);
    });

    it('with --confirm-spend the same run does reach the provider', async () => {
        const provider = spyProvider();
        const out = path.join(tmp, 'billable.jsonl');
        expect(await main(['--limit', '1', '--sets', 'clean-control', '--arms', 'baseline-off', '--out', out, '--confirm-spend'], { provider })).toBe(0);
        expect(provider.complete).toHaveBeenCalledTimes(1);
        expect(readRecords(out)[0]?.provider).toBe('spy');
    });

    it('rejects an unknown set, arm or pricing row', async () => {
        expect(await main(['--sets', 'nope'])).toBe(2);
        expect(await main(['--arms', 'nope'])).toBe(2);
        expect(await main(['--estimate', '--model', 'nope'])).toBe(2);
    });
});
