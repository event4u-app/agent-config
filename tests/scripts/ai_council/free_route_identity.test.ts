// A route's identity is derived from the model it says it served, never from
// what the config declared it to be.

import { describe, expect, it } from 'vitest';

import { OpenAIClient } from '../../../src/scripts/ai_council/clients.js';
import { familyOf, parseRouteFields, servedMatches } from '../../../src/scripts/ai_council/free_route.js';
import { FreeRouteClient } from '../../../src/scripts/ai_council/free_route_client.js';

function stubRoute(servedId: string, requested = 'llama-3.3-70b-instruct'): FreeRouteClient {
    return new FreeRouteClient({
        name: 'hands',
        model: requested,
        base_url: 'https://route.example.test/v1',
        api_key: null,
        billing: 'free-quota',
        content_ceiling: 'public-artifact',
        post: () => ({ model: servedId, choices: [{ message: { content: 'an answer' } }] }),
    });
}

describe('2.4 — identity derived, not declared', () => {
    it('a stub route answering with another family\'s id is absent with policy_model_mismatch', () => {
        const r = stubRoute('qwen/qwen3-32b').ask('s', 'u');
        expect(r.text).toBe('');
        expect(r.error).toMatch(/^policy_model_mismatch/);
        expect(r.metadata['absent_reason']).toBe('policy_model_mismatch');
        expect(r.model_served).toBe('qwen/qwen3-32b');
    });

    it('a route that reports no served id is absent too — identity cannot be derived', () => {
        expect(stubRoute('').ask('s', 'u').metadata['absent_reason']).toBe('policy_model_mismatch');
    });

    it('the requested model under a vendor prefix or a snapshot suffix is kept, with its derived family', () => {
        const r = stubRoute('meta-llama/llama-3.3-70b-instruct-2026-01').ask('s', 'u');
        expect(r.error).toBeNull();
        expect(r.text).toBe('an answer');
        expect(r.metadata['family']).toBe('llama');
    });

    it('family comes from the served id', () => {
        expect(familyOf('meta-llama/Llama-3.3-70B-Instruct')).toBe('llama');
        expect(familyOf('qwen/qwen3-32b')).toBe('qwen');
        expect(familyOf('deepseek-r1')).toBe('deepseek');
        expect(servedMatches('gpt-oss-120b', 'openai/gpt-oss-120b')).toBe(true);
        expect(servedMatches('gpt-oss-120b', 'gpt-oss-20b')).toBe(false);
    });

    it('random/auto routers are refused at config time', () => {
        for (const model of ['auto', 'some-router/auto', 'openish/free', 'x/random']) {
            const r = parseRouteFields('hands', { base_url: 'https://route.example.test/v1', model }, false);
            expect('error' in r && r.error).toMatch(/random\/auto router/);
        }
    });

    it('a paid provider alias keeps attribution-only behaviour', () => {
        const client = new OpenAIClient({
            model: 'gpt-4o',
            client: {
                chat: { completions: { create: () => ({ model: 'gpt-4o-2024-11-20-other', choices: [{ message: { content: 'kept' } }] }) } },
            },
        });
        const r = client.ask('s', 'u');
        expect(r.error).toBeNull();
        expect(r.text).toBe('kept');
    });
});
