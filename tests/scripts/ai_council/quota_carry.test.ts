import { describe, expect, it } from 'vitest';

import { cliFailureText } from '../../../src/scripts/ai_council/cli_launch_env.js';
import { CouncilResponse, ExternalAIClient, OpenAICliClient } from '../../../src/scripts/ai_council/clients.js';
import { runSkippingExhausted } from '../../../src/scripts/ai_council/quota_carry.js';
import {
    consult,
    CouncilQuestion,
    run_debate,
    run_peer_review,
} from '../../../src/scripts/ai_council/orchestrator.js';

class Counting extends ExternalAIClient {
    calls = 0;
    constructor(
        name: string,
        private readonly answer: (call: number) => { text?: string; error?: string | null },
    ) {
        super();
        this.name = name;
        this.model = `${name}-m`;
        this.transport = 'cli';
        this.billable = false;
    }
    override ask(): CouncilResponse {
        this.calls += 1;
        const a = this.answer(this.calls);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: a.text ?? '',
            error: a.error ?? null,
            latency_ms: 1,
        });
    }
}

const q = new CouncilQuestion({ mode: 'prompt', user_prompt: 'x' });
const quotaThenAnswer = (call: number) => (call === 1 ? { error: 'cli_quota_exhausted' } : { text: 'late answer' });

describe('a codex usage-limit refusal is classified as quota exhaustion', () => {
    // Captured verbatim from a council seat on 2026-11-04: exit 1, empty stderr.
    const stdout = [
        '{"type":"thread.started","thread_id":"t"}',
        '{"type":"turn.started"}',
        '{"type":"error","message":"You’ve hit your usage limit. Upgrade to Pro or try again at 3:34 PM."}',
        '{"type":"turn.failed","error":{"message":"You’ve hit your usage limit. Upgrade to Pro or try again at 3:34 PM."}}',
    ].join('\n');

    it('reads the refusal from the stdout events when stderr is empty', () => {
        expect(cliFailureText('', stdout)).toContain('usage limit');
        expect(OpenAICliClient._classify_stderr(cliFailureText('', stdout), 1)).toBe('cli_quota_exhausted');
        expect(OpenAICliClient._classify_stderr('', 1)).not.toBe('cli_quota_exhausted');
    });

    it('never reads token counts from ordinary event lines', () => {
        const counts = '{"type":"turn.completed","usage":{"input_tokens":4291,"output_tokens":401}}';
        expect(cliFailureText('', counts)).toBe('');
    });
});

describe('runSkippingExhausted position contract', () => {
    it('refuses a round that returns fewer responses than live seats', () => {
        const a = new Counting('anthropic', () => ({ text: 'x' }));
        const b = new Counting('openai', () => ({ text: 'y' }));
        expect(() => runSkippingExhausted([a, b], new Set(['gemini']), () => [])).toThrow(/positions would shift/);
        const extra = new CouncilResponse({ provider: 'x', model: 'x', text: '' });
        expect(() => runSkippingExhausted([a, b], new Set(['openai']), () => [extra, extra])).toThrow(/positions would shift/);
    });
});

describe('quota exhaustion carries across rounds', () => {
    it('debate: a seat refused for quota in round 1 is not called again', () => {
        const tired = new Counting('anthropic', quotaThenAnswer);
        const fresh = new Counting('openai', () => ({ text: 'fine' }));
        const rounds = run_debate([tired, fresh], q, { max_rounds: 3 });
        expect(tired.calls).toBe(1);
        expect(fresh.calls).toBe(3);
        expect(rounds).toHaveLength(3);
        for (const round of rounds.slice(1)) {
            // Its row stays in place, carrying the reason, so the render still names it.
            expect(round[0]!.provider).toBe('anthropic');
            expect(round[0]!.error).toBe('cli_quota_exhausted');
            expect(round[0]!.metadata['not_called']).toBe(true);
            expect(round[1]!.text).toBe('fine');
        }
    });

    it('consult: multi-round deliberation skips the exhausted seat after round 1', () => {
        const tired = new Counting('anthropic', quotaThenAnswer);
        const fresh = new Counting('openai', () => ({ text: 'fine' }));
        const last = consult([tired, fresh], q, null, { rounds: 3 });
        expect(tired.calls).toBe(1);
        expect(fresh.calls).toBe(3);
        expect(last.map((r) => r.provider)).toEqual(['anthropic', 'openai']);
    });

    it('a seat answered via the api_on_quota fallback is not retired', () => {
        const tired = new Counting('anthropic', () => ({ error: 'cli_quota_exhausted' }));
        const rounds = run_debate([tired], q, {
            max_rounds: 3,
            cli_fallback: {
                api_on_quota: true,
                construct: () => new Counting('anthropic', () => ({ text: 'via api' })),
            },
        });
        for (const round of rounds) {
            expect(round[0]!.error).toBeNull();
            expect(round[0]!.metadata['not_called']).toBeUndefined();
        }
    });

    it('a non-quota error does not retire the seat', () => {
        const flaky = new Counting('anthropic', (c) => (c === 1 ? { error: 'timeout' } : { text: 'ok' }));
        run_debate([flaky], q, { max_rounds: 3 });
        expect(flaky.calls).toBe(3);
    });

    it('a seat exhausted in the restate pass is not called in the debate rounds', () => {
        const tired = new Counting('anthropic', () => ({ error: 'cli_quota_exhausted' }));
        const fresh = new Counting('openai', () => ({ text: 'fine' }));
        run_debate([tired, fresh], q, { max_rounds: 2, restate: true });
        expect(tired.calls).toBe(1);
        expect(fresh.calls).toBe(3);
    });

    it('a seat exhausted by a gate repair is not called in the next round', () => {
        // Same text every round → near-duplicate → one repair in round 2, which hits the quota.
        const seat = new Counting('anthropic', (c) => (c === 3 ? { error: 'cli_quota_exhausted' } : { text: 'I hold my position for the stated reasons.' }));
        run_debate([seat], q, { max_rounds: 3, debate_gates: true, on_repair: () => true });
        expect(seat.calls).toBe(3);
    });

    it('a stance repair that hits the quota keeps the answer and marks the seat for peer review', () => {
        const seat = new Counting('anthropic', (c) => (c === 1 ? { text: 'an answer without a stance line' } : { error: 'cli_quota_exhausted' }));
        const last = consult([seat], q, null, { stance_tally: true, on_stance_repair: () => true });
        expect(seat.calls).toBe(2);
        expect(last[0]!.text).toBe('an answer without a stance line');
        const other = new Counting('openai', () => ({ text: 'review' }));
        const third = new Counting('gemini', () => ({ text: 'review' }));
        run_peer_review([seat, other, third], [
            last[0]!,
            new CouncilResponse({ provider: 'openai', model: 'openai-m', text: 'a' }),
            new CouncilResponse({ provider: 'gemini', model: 'gemini-m', text: 'b' }),
        ]);
        expect(seat.calls).toBe(2);
    });

    it('peer review does not ask a seat whose deliberation hit the quota', () => {
        const tired = new Counting('anthropic', () => ({ error: 'cli_quota_exhausted' }));
        const a = new Counting('openai', () => ({ text: 'review a' }));
        const b = new Counting('gemini', () => ({ text: 'review b' }));
        const deliberation = [
            new CouncilResponse({ provider: 'anthropic', model: 'anthropic-m', text: '', error: 'cli_quota_exhausted' }),
            new CouncilResponse({ provider: 'openai', model: 'openai-m', text: 'answer a' }),
            new CouncilResponse({ provider: 'gemini', model: 'gemini-m', text: 'answer b' }),
        ];
        run_peer_review([tired, a, b], deliberation);
        expect(tired.calls).toBe(0);
        expect(a.calls).toBe(1);
        expect(b.calls).toBe(1);
    });
});
