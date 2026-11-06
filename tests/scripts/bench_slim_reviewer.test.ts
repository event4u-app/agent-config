// The pure surface of bench_slim_reviewer: fixture set, prompt neutrality, arm
// definitions and the per-call spend flag. No CLI call is made here.
import { describe, expect, it } from 'vitest';

import { agentsJson, cliArgs, loadFixtures, parseEnvelope, userPrompt } from '../../src/scripts/bench_slim_reviewer.js';

const rates = { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 };

describe('bench_slim_reviewer', () => {
    const fixtures = loadFixtures();

    it('loads the wedge pair, the 12-fixture defect corpus and the 3 contested controls', () => {
        expect(fixtures).toHaveLength(17);
        expect(fixtures.filter((f) => f.source === 'wedge').map((f) => f.id)).toEqual(['pv-01-hollow', 'pv-02-control']);
        expect(fixtures.filter((f) => f.source === 'defect-finding')).toHaveLength(12);
        expect(fixtures.filter((f) => f.contested).map((f) => f.id)).toEqual(['ac-clean-01', 'ac-clean-02', 'ac-clean-03']);
        expect(fixtures.filter((f) => f.kind === 'planted')).toHaveLength(11);
        for (const f of fixtures.filter((x) => x.kind === 'planted')) expect(f.planted_file).toMatch(/\.\w+$/);
    });

    it('keeps the user prompt free of ground truth and expected outcomes', () => {
        for (const f of fixtures) {
            const p = userPrompt(f);
            expect(p).toMatch(/^Scope: /);
            expect(p).not.toMatch(/ground.truth|planted|negative control|false positive|expected/i);
        }
    });

    it('differs between arms only in the omit flag and the digest', () => {
        const full = JSON.parse(agentsJson('full', 'm'))['production-validator'];
        const slim = JSON.parse(agentsJson('slim', 'm'))['production-validator'];
        expect(full.omitClaudeMd).toBeUndefined();
        expect(slim.omitClaudeMd).toBe(true);
        expect(slim.prompt.startsWith(full.prompt)).toBe(true);
        expect(slim.prompt).toContain('# Review digest');
        expect(slim.tools).toEqual(full.tools);
    });

    it('passes the per-call budget cap to the CLI', () => {
        const a = cliArgs('q', '/tmp/a.json', 'claude-sonnet-4-6', 0.75);
        expect(a[a.indexOf('--max-budget-usd') + 1]).toBe('0.75');
        expect(a[a.indexOf('--model') + 1]).toBe('claude-sonnet-4-6');
    });

    it('prices an envelope from modelUsage and keeps the reported cost', () => {
        const env = parseEnvelope(
            JSON.stringify({
                result: 'VERDICT: READY',
                total_cost_usd: 0.05,
                modelUsage: { 'claude-sonnet-4-6': { inputTokens: 1000, outputTokens: 100, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } },
            }),
            rates,
        );
        expect(env.usd_envelope).toBe(0.05);
        expect(env.usd_priced).toBeCloseTo(0.0045);
        expect(parseEnvelope('not json', rates).errored).toBe(true);
    });
});
