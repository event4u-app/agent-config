// Defect D5 — the council never read the provider stop reason, so an answer cut
// off at `max_tokens` whose text still parsed counted as a full vote.
//
// Three layers: the per-provider mapping (pure), the clients that attach it to
// `CouncilResponse.stop_class`, and every reader that turns a response into a
// vote — findings parse, consensus round, post-run quorum. The stance tally is
// owner-reserved under ADR-268 and is not changed here.

import { describe, expect, it } from 'vitest';

import { normaliseGeminiRest } from '../../../src/scripts/ai_council/api_transport.js';
import {
    AnthropicClient,
    CouncilResponse,
    ExternalAIClient,
    GeminiClient,
    OpenAIClient,
    XAIClient,
} from '../../../src/scripts/ai_council/clients.js';
import { parse_findings_outcome } from '../../../src/scripts/ai_council/consensus.js';
import { run_consensus_scoring } from '../../../src/scripts/ai_council/consensus_round.js';
import { harvest_inline_findings } from '../../../src/scripts/ai_council/inline_findings.js';
import { _postRunQuorum } from '../../../src/scripts/ai_council/quorum_wiring.js';
import { serializeResponses } from '../../../src/scripts/ai_council/response_record.js';
import {
    anthropicStopClass,
    geminiStopClass,
    isIncompleteStop,
    openAiStopClass,
    storedStopClass,
} from '../../../src/scripts/ai_council/stop_class.js';

describe('stop_class — provider mapping', () => {
    it.each([
        ['end_turn', 'complete'],
        ['stop_sequence', 'complete'],
        ['tool_use', 'complete'],
        ['max_tokens', 'truncated'],
        ['model_context_window_exceeded', 'context_exceeded'],
        ['pause_turn', 'unknown'],
        ['refusal', 'unknown'],
    ])('anthropic stop_reason %s → %s', (raw, want) => {
        expect(anthropicStopClass({ stop_reason: raw })).toBe(want);
    });

    it.each([
        ['stop', 'complete'],
        ['length', 'truncated'],
        ['content_filter', 'unknown'],
        ['tool_calls', 'unknown'],
    ])('openai-compatible finish_reason %s → %s', (raw, want) => {
        expect(openAiStopClass({ choices: [{ finish_reason: raw }] })).toBe(want);
    });

    it.each([
        ['STOP', 'complete'],
        ['MAX_TOKENS', 'truncated'],
        ['SAFETY', 'unknown'],
        ['FINISH_REASON_UNSPECIFIED', 'unknown'],
    ])('gemini finishReason %s → %s (raw envelope and normalised shape)', (raw, want) => {
        expect(geminiStopClass({ candidates: [{ finishReason: raw }] })).toBe(want);
        expect(geminiStopClass(normaliseGeminiRest({ candidates: [{ finishReason: raw }] }))).toBe(want);
    });

    it('absent, malformed or inherited stop fields are unknown, never complete', () => {
        for (const r of [null, undefined, {}, 'text', { stop_reason: 42 }, { stop_reason: 'toString' }]) {
            expect(anthropicStopClass(r)).toBe('unknown');
        }
        expect(openAiStopClass({})).toBe('unknown');
        expect(openAiStopClass({ choices: [] })).toBe('unknown');
        expect(openAiStopClass({ choices: [{}] })).toBe('unknown');
        expect(geminiStopClass({})).toBe('unknown');
        expect(geminiStopClass(normaliseGeminiRest({}))).toBe('unknown');
    });

    it('only truncated and context_exceeded are incomplete', () => {
        expect(isIncompleteStop('truncated')).toBe(true);
        expect(isIncompleteStop('context_exceeded')).toBe(true);
        expect(isIncompleteStop('complete')).toBe(false);
        expect(isIncompleteStop('unknown')).toBe(false);
        expect(isIncompleteStop(undefined)).toBe(false);
    });
});

describe('stop_class — API clients attach it', () => {
    it('AnthropicClient reads stop_reason', () => {
        const mock = { messages: { create: () => ({ content: [{ text: 'x' }], stop_reason: 'max_tokens' }) } };
        expect(new AnthropicClient({ client: mock }).ask('s', 'u').stop_class).toBe('truncated');
    });

    it('OpenAIClient reads choices[0].finish_reason', () => {
        const mock = {
            chat: { completions: { create: () => ({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }) } },
        };
        expect(new OpenAIClient({ client: mock, model: 'gpt-4o' }).ask('s', 'u').stop_class).toBe('truncated');
    });

    it('OpenAI-compatible (xAI) reads choices[0].finish_reason', () => {
        const mock = {
            chat: { completions: { create: () => ({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] }) } },
        };
        expect(new XAIClient({ client: mock, model: 'grok-4' }).ask('s', 'u').stop_class).toBe('complete');
    });

    it('GeminiClient over the REST transport carries finishReason through the normaliser', () => {
        const post = (): unknown => ({
            candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
        });
        expect(new GeminiClient({ api_key: 'k', transport: post }).ask('s', 'u').stop_class).toBe('truncated');
    });

    it('a response with no stop reason reports unknown; an error response carries none', () => {
        const ok = { messages: { create: () => ({ content: [{ text: 'x' }] }) } };
        expect(new AnthropicClient({ client: ok }).ask('s', 'u').stop_class).toBe('unknown');
        const boom = { messages: { create: () => { throw new Error('down'); } } };
        expect(new AnthropicClient({ client: boom }).ask('s', 'u').stop_class).toBeUndefined();
    });

    it('a CouncilResponse built without stop_class (every CLI seat) leaves the key unset', () => {
        const r = new CouncilResponse({ provider: 'p', model: 'm', text: 't' });
        expect(r.stop_class).toBeUndefined();
        expect(Object.keys(r)).not.toContain('stop_class');
    });
});

const STANCE = 'Reasoning…\nSTANCE: ship | CONFIDENCE: high | DEALBREAKER: no';

function resp(provider: string, text: string, stop_class?: 'complete' | 'truncated' | 'context_exceeded'): CouncilResponse {
    return new CouncilResponse({ provider, model: 'm', text, ...(stop_class ? { stop_class } : {}) });
}

describe('stop_class — a truncated parseable answer is not a full vote', () => {
    it('findings parse: a valid array from a truncated answer is `truncated`, with no findings', () => {
        const text = '[{"id": "f1", "text": "a finding"}]';
        expect(parse_findings_outcome(text, { source: 's' }).outcome).toBe('parsed');
        const ex = parse_findings_outcome(text, { source: 's', stop_class: 'truncated' });
        expect(ex).toEqual({ findings: [], outcome: 'truncated', item_count: 0 });
        expect(parse_findings_outcome(text, { source: 's', stop_class: 'context_exceeded' }).outcome).toBe('truncated');
        expect(parse_findings_outcome(text, { source: 's', stop_class: 'unknown' }).outcome).toBe('parsed');
    });

    it('inline harvest leaves a truncated reply untouched', () => {
        const member = { name: 'a', model: 'm' } as unknown as ExternalAIClient;
        const text = 'prose\n\n```json\n[{"id": "f1", "text": "a finding"}]\n```';
        const cut = resp('a', text, 'truncated');
        expect(harvest_inline_findings([member], [cut]).size).toBe(0);
        expect(cut.text).toBe(text);
    });

    it('consensus round: a truncated deliberation is recorded `truncated` and contributes no findings', () => {
        let asked = 0;
        class Stub extends ExternalAIClient {
            override name = 'a';
            override model = 'm';
            ask(): CouncilResponse {
                asked += 1;
                return resp('a', '[{"id": "f1", "text": "x"}]', 'complete');
            }
        }
        const r = run_consensus_scoring([new Stub()], [resp('a', STANCE, 'truncated')]);
        expect(r.parse_outcomes.get('a:m')).toBe('truncated');
        expect(r.findings).toEqual([]);
        expect(asked).toBe(0); // no extraction call, no re-ask, no continuation
    });

    it('post-run quorum: a truncated answer is an abstention, not attendance', () => {
        class Stub extends ExternalAIClient {
            constructor(override name: string) {
                super();
            }
            ask(): CouncilResponse {
                throw new Error('not called');
            }
        }
        const members = [new Stub('a'), new Stub('b')];
        const responses = [resp('a', STANCE, 'complete'), resp('b', STANCE, 'truncated')];
        const { quorum, absent } = _postRunQuorum(members, responses, { quorum: 2 });
        expect(quorum.present).toBe(1);
        expect(quorum.status).toBe('inconclusive');
        expect(absent).toEqual([
            { member: 'b', reason: 'truncated', detail: 'answer cut off by the provider (stop_class: truncated)' },
        ]);

        const whole = _postRunQuorum(members, [resp('a', STANCE), resp('b', STANCE, 'complete')], { quorum: 2 });
        expect(whole.quorum.present).toBe(2);
        expect(whole.absent).toEqual([]);
    });
});

describe('stop_class — persisted session record', () => {
    it('is written only when set and read back only when valid', () => {
        const [withClass, without] = serializeResponses([resp('a', 't', 'truncated'), resp('b', 't')]);
        expect(withClass!['stop_class']).toBe('truncated');
        expect(Object.keys(without!)).not.toContain('stop_class');
        expect(storedStopClass('context_exceeded')).toEqual({ stop_class: 'context_exceeded' });
        expect(storedStopClass('bogus')).toEqual({});
        expect(storedStopClass(undefined)).toEqual({});
    });
});
