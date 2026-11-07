// The pure surface of bench_slim_reviewer: fixture set, prompt neutrality, arm
// definitions and the per-call spend flag. No CLI call is made here.
import { describe, expect, it } from 'vitest';

import { agentsJson, cliArgs, loadFixtures, parseStream, userPrompt } from '../../internal/bench/core/bench_slim_reviewer.js';

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
        expect(a).not.toContain('--agent');
        expect(a[a.length - 1]).toContain('<<<PROMPT\nq\nPROMPT>>>');
    });

    const ev = (o: unknown): string => JSON.stringify(o);
    const stream = [
        ev({ type: 'system', subtype: 'init' }),
        ev({
            type: 'assistant',
            parent_tool_use_id: null,
            message: { content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: { subagent_type: 'production-validator', prompt: 'q' } }] },
        }),
        ev({ type: 'assistant', parent_tool_use_id: 't1', message: { usage: { input_tokens: 5, cache_creation_input_tokens: 900, cache_read_input_tokens: 100 }, content: [] } }),
        ev({ type: 'assistant', parent_tool_use_id: 't1', message: { usage: { input_tokens: 9, cache_read_input_tokens: 1000 }, content: [] } }),
        ev({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: '  VERDICT: READY\n<usage>subagent_tokens: 10675\ntool_uses: 0</usage>' }] }] } }),
        ev({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'DONE' }] } }),
        ev({
            type: 'result',
            is_error: false,
            result: 'DONE',
            total_cost_usd: 0.05,
            num_turns: 2,
            modelUsage: { 'claude-sonnet-4-6': { inputTokens: 1000, outputTokens: 100, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 } },
        }),
    ].join('\n');

    it('scores the subagent return, not the parent relay, and prices the whole call', () => {
        const r = parseStream(stream, rates);
        expect(r.dispatched).toBe(true);
        expect(r.errored).toBe(false);
        expect(r.text).toContain('VERDICT: READY');
        expect(r.subagent_tokens).toBe(10675);
        expect(r.subagent_first_input).toBe(1005);
        expect(r.subagent_requests).toBe(2);
        expect(r.usd_envelope).toBe(0.05);
        expect(r.usd_priced).toBeCloseTo(0.0045);
    });

    it('marks a call errored when the parent never dispatched the reviewer or the stream is empty', () => {
        const noDispatch = stream.split('\n').filter((l) => !l.includes('tool_use')).join('\n');
        expect(parseStream(noDispatch, rates)).toMatchObject({ dispatched: false, errored: true, reason: 'no dispatch' });
        expect(parseStream('not json', rates)).toMatchObject({ errored: true, reason: 'no events' });
    });
});
