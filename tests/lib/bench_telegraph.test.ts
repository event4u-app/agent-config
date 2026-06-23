/**
 * Vitest twin suite for the telegraph bench core
 * (`src/scripts/_lib/bench_telegraph.ts`). Focused unit suite over
 * carve-out detection, three-arm aggregation, cost math, the savings
 * properties, corpus loading, and the orchestrator on shared synthetic
 * data (ADR-088 py2ts Phase 2 / Wave 2a).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    ARMS,
    ArmResult,
    PromptResult,
    SYSTEM_PROMPT_CONDENSED,
    SYSTEM_PROMPT_TERSE,
    SYSTEM_PROMPT_UNCONDENSED,
    ARM_SYSTEM_PROMPT,
    carve_out_chars,
    compute_cost,
    load_corpus,
    run_arm,
    run_telegraph_bench,
    type BenchClient,
    type ArmResponse,
} from '../../src/scripts/_lib/bench_telegraph.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

// ── synthetic spec helpers ────────────────────────────────────────────────

interface ArmSpec {
    text: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    error?: string | null;
}
interface PromptSpec {
    id: string;
    category: string;
    expected_carve_out_pct: number;
    arms: Record<string, ArmSpec>;
}

function buildResults(specs: PromptSpec[]): PromptResult[] {
    return specs.map((spec) => {
        const pr = new PromptResult({
            id: spec.id,
            category: spec.category,
            expected_carve_out_pct: spec.expected_carve_out_pct,
        });
        for (const arm of Object.keys(spec.arms)) {
            const a = spec.arms[arm] as ArmSpec;
            pr.arms[arm] = new ArmResult({
                arm,
                text: a.text,
                input_tokens: a.input_tokens,
                output_tokens: a.output_tokens,
                latency_ms: a.latency_ms,
                output_chars: a.text.length,
                carve_out_chars: carve_out_chars(a.text),
                error: a.error ?? null,
            });
        }
        return pr;
    });
}

const SAMPLE_SPECS: PromptSpec[] = [
    {
        id: 'telegraph-01',
        category: 'iron-law-fence',
        expected_carve_out_pct: 0.45,
        arms: {
            condensed: { text: '```X```\nok', input_tokens: 50, output_tokens: 30, latency_ms: 100 },
            terse_control: { text: 'terse', input_tokens: 50, output_tokens: 40, latency_ms: 90 },
            uncondensed: { text: 'long answer here', input_tokens: 50, output_tokens: 60, latency_ms: 120 },
        },
    },
    {
        id: 'telegraph-08',
        category: 'pure-prose',
        expected_carve_out_pct: 0.0,
        arms: {
            condensed: { text: 'plain prose', input_tokens: 40, output_tokens: 20, latency_ms: 80 },
            terse_control: { text: 't', input_tokens: 40, output_tokens: 25, latency_ms: 70 },
            uncondensed: { text: 'plain prose longer', input_tokens: 40, output_tokens: 33, latency_ms: 110 },
        },
    },
    {
        id: 'telegraph-09',
        category: 'pure-prose',
        expected_carve_out_pct: 0.05,
        arms: {
            condensed: { text: 'a `b` c', input_tokens: 30, output_tokens: 17, latency_ms: 60 },
            terse_control: { text: 'a `b` c d', input_tokens: 30, output_tokens: 17, latency_ms: 55 },
            uncondensed: { text: 'a `b` c d e', input_tokens: 30, output_tokens: 50, latency_ms: 90 },
        },
    },
];

// ── module-level constants ─────────────────────────────────────────────────

describe('bench_telegraph — constants', () => {
    it('ARMS order matches Python', () => {
        expect([...ARMS]).toEqual(['condensed', 'terse_control', 'uncondensed']);
    });

    it('ARM_SYSTEM_PROMPT maps each arm to its prompt', () => {
        expect(ARM_SYSTEM_PROMPT['condensed']).toBe(SYSTEM_PROMPT_CONDENSED);
        expect(ARM_SYSTEM_PROMPT['terse_control']).toBe(SYSTEM_PROMPT_TERSE);
        expect(ARM_SYSTEM_PROMPT['uncondensed']).toBe(SYSTEM_PROMPT_UNCONDENSED);
    });
});

// ── carve_out_chars ─────────────────────────────────────────────────────────

describe('bench_telegraph — carve_out_chars', () => {
    it('returns 0 for empty string', () => {
        expect(carve_out_chars('')).toBe(0);
    });
});

// ── ArmResult / PromptResult properties ─────────────────────────────────────

describe('bench_telegraph — result dataclasses', () => {
    it('realised_carve_out_pct is carve/out_chars, 0 when output_chars=0', () => {
        const a = new ArmResult({
            arm: 'condensed',
            text: '`x`',
            input_tokens: 1,
            output_tokens: 1,
            latency_ms: 1,
            output_chars: 3,
            carve_out_chars: 3,
        });
        expect(a.realised_carve_out_pct).toBe(1.0);
        const empty = new ArmResult({
            arm: 'condensed',
            text: '',
            input_tokens: 0,
            output_tokens: 0,
            latency_ms: 0,
            output_chars: 0,
            carve_out_chars: 0,
        });
        expect(empty.realised_carve_out_pct).toBe(0.0);
    });

    it('savings_vs_raw / savings_vs_terse compute and null-guard', () => {
        const [r] = buildResults([SAMPLE_SPECS[0] as PromptSpec]);
        expect((r as PromptResult).savings_vs_raw).toBeCloseTo(0.5, 12);
        expect((r as PromptResult).savings_vs_terse).toBeCloseTo(0.25, 12);

        const missing = new PromptResult({ id: 'x', category: 'c', expected_carve_out_pct: 0 });
        expect(missing.savings_vs_raw).toBeNull();
        expect(missing.savings_vs_terse).toBeNull();

        // Zero-denominator guard.
        const zero = new PromptResult({ id: 'z', category: 'c', expected_carve_out_pct: 0 });
        zero.arms['condensed'] = new ArmResult({
            arm: 'condensed', text: '', input_tokens: 0, output_tokens: 5,
            latency_ms: 0, output_chars: 0, carve_out_chars: 0,
        });
        zero.arms['uncondensed'] = new ArmResult({
            arm: 'uncondensed', text: '', input_tokens: 0, output_tokens: 0,
            latency_ms: 0, output_chars: 0, carve_out_chars: 0,
        });
        expect(zero.savings_vs_raw).toBeNull();
    });
});

// ── compute_cost ────────────────────────────────────────────────────────────

describe('bench_telegraph — compute_cost', () => {
    it('counts errors per arm', () => {
        const specs: PromptSpec[] = [
            {
                id: 'e1',
                category: 'c',
                expected_carve_out_pct: 0,
                arms: {
                    condensed: { text: '', input_tokens: 0, output_tokens: 0, latency_ms: 0, error: 'boom' },
                    uncondensed: { text: 'x', input_tokens: 5, output_tokens: 5, latency_ms: 1 },
                },
            },
        ];
        const cost = compute_cost(buildResults(specs), { input: 1, output: 1 });
        expect(cost.totals.errors).toBe(1);
        expect(cost.totals.calls).toBe(2);
    });
});

// ── load_corpus ─────────────────────────────────────────────────────────────

describe('bench_telegraph — load_corpus', () => {
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
            tmp = null;
        }
    });

    it('parses the real telegraph corpus and returns the prompt list', () => {
        const corpus = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'telegraph', 'prompts.yaml');
        const prompts = load_corpus(corpus);
        expect(prompts.length).toBe(10);
        expect(prompts[0]?.['id']).toBe('telegraph-01');
    });

    it('throws on an empty corpus', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-tg-'));
        const p = path.join(tmp, 'empty.yaml');
        fs.writeFileSync(p, 'version: 1\ncorpus_id: x\n', 'utf-8');
        expect(() => load_corpus(p)).toThrow(/empty corpus/);
    });
});

// ── run_arm / run_telegraph_bench with a fake client ────────────────────────

describe('bench_telegraph — run_arm + orchestrator (fake client)', () => {
    class FakeClient implements BenchClient {
        calls: Array<{ system: string; prompt: string }> = [];
        ask(system: string, userPrompt: string): ArmResponse {
            this.calls.push({ system, prompt: userPrompt });
            return {
                text: `reply to ${userPrompt} via ${system.slice(0, 6)}`,
                input_tokens: 10,
                output_tokens: 7,
                latency_ms: 42,
                error: null,
            };
        }
    }

    it('run_arm packs the response into an ArmResult', () => {
        const c = new FakeClient();
        const r = run_arm(c, 'condensed', 'hello', { max_tokens: 64 });
        expect(r.arm).toBe('condensed');
        expect(r.input_tokens).toBe(10);
        expect(r.output_tokens).toBe(7);
        expect(r.latency_ms).toBe(42);
        expect(r.output_chars).toBe(r.text.length);
        expect(r.error).toBeNull();
    });

    it('run_arm captures a thrown error', () => {
        const throwing: BenchClient = {
            ask() {
                throw new Error('network down');
            },
        };
        const r = run_arm(throwing, 'condensed', 'hello');
        expect(r.error).toContain('network down');
        expect(r.output_tokens).toBe(0);
        expect(r.text).toBe('');
    });

    it('run_telegraph_bench runs every arm per prompt with progress', () => {
        const corpus = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'telegraph', 'prompts.yaml');
        const c = new FakeClient();
        const progress: Array<[number, number]> = [];
        const results = run_telegraph_bench(c, corpus, {
            max_prompts: 2,
            on_progress: (done, total) => progress.push([done, total]),
        });
        expect(results.length).toBe(2);
        for (const r of results) {
            expect(Object.keys(r.arms).sort()).toEqual([...ARMS].sort());
        }
        // 2 prompts × 3 arms = 6 calls, total reported as 6.
        expect(c.calls.length).toBe(6);
        expect(progress[progress.length - 1]).toEqual([6, 6]);
    });
});
