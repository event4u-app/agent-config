// road-to-admissible-council-seats 1.1 — the api transport the council claims.
//
// Before this step exactly one of the five configured providers could make an
// `mode: api` call. `GeminiClient` and `_OpenAICompatibleClient` (xAI,
// Perplexity) both ran an unconditional
// `throw new Error('… package not installed. pip install …')` immediately
// after the api-key check, so a correctly configured key produced a dead seat
// rather than a `CouncilResponse`.
//
// The seam under test is deliberately the REAL construction path: every case
// below passes a real `api_key` AND a transport double. Passing an injected
// `client:` object instead would skip the shim-building code entirely — which
// is exactly the code that used to throw — and the test would pass on the
// broken tree. The `it('… threw before 1.1 …')` cases pin that: they assert
// the constructor now reaches the transport rather than the throw.

import { describe, expect, it } from 'vitest';

import {
    GeminiClient,
    PerplexityClient,
    XAIClient,
} from '../../../src/scripts/ai_council/clients.js';
import {
    geminiRestClient,
    normaliseGeminiRest,
    openAiCompatibleClient,
} from '../../../src/scripts/ai_council/api_transport.js';

/** Records every call and answers with an OpenAI-shaped chat completion. */
function openAiDouble(text: string) {
    const calls: Array<{ url: string; headers: string[]; body: unknown }> = [];
    const post = (url: string, headers: string[], body: unknown): unknown => {
        calls.push({ url, headers, body });
        return {
            choices: [{ message: { content: text } }],
            usage: { prompt_tokens: 11, completion_tokens: 7 },
            model: 'served-model-id',
        };
    };
    return { calls, post };
}

/** Records every call and answers with a Gemini REST envelope. */
function geminiDouble(text: string) {
    const calls: Array<{ url: string; headers: string[]; body: unknown }> = [];
    const post = (url: string, headers: string[], body: unknown): unknown => {
        calls.push({ url, headers, body });
        return {
            candidates: [{ content: { parts: [{ text }] } }],
            usageMetadata: { promptTokenCount: 13, candidatesTokenCount: 5 },
            modelVersion: 'gemini-served-id',
        };
    };
    return { calls, post };
}

describe('api transport — every configured provider reaches a CouncilResponse', () => {
    it('GeminiClient with an api_key + transport double answers (threw before 1.1)', () => {
        const d = geminiDouble('gemini says hello');
        const c = new GeminiClient({ api_key: 'k-gemini', transport: d.post });
        const r = c.ask('sys', 'user', 256);
        expect(r.error).toBeNull();
        expect(r.text).toBe('gemini says hello');
        expect(r.provider).toBe('gemini');
        expect(r.input_tokens).toBe(13);
        expect(r.output_tokens).toBe(5);
        expect(r.model_served).toBe('gemini-served-id');
        expect(d.calls).toHaveLength(1);
        expect(d.calls[0]?.url).toContain(':generateContent');
        expect(d.calls[0]?.headers.join(' ')).toContain('x-goog-api-key: k-gemini');
    });

    it('XAIClient with an api_key + transport double answers (threw before 1.1)', () => {
        const d = openAiDouble('grok says hello');
        const c = new XAIClient({ api_key: 'k-xai', transport: d.post });
        const r = c.ask('sys', 'user', 256);
        expect(r.error).toBeNull();
        expect(r.text).toBe('grok says hello');
        expect(r.provider).toBe('xai');
        expect(r.input_tokens).toBe(11);
        expect(r.output_tokens).toBe(7);
        expect(d.calls[0]?.url).toBe('https://api.x.ai/v1/chat/completions');
        expect(d.calls[0]?.headers.join(' ')).toContain('authorization: Bearer k-xai');
    });

    it('PerplexityClient with an api_key + transport double answers (threw before 1.1)', () => {
        const d = openAiDouble('sonar says hello');
        const c = new PerplexityClient({ api_key: 'k-pplx', transport: d.post });
        const r = c.ask('sys', 'user', 256);
        expect(r.error).toBeNull();
        expect(r.text).toBe('sonar says hello');
        expect(r.provider).toBe('perplexity');
        expect(d.calls[0]?.url).toBe('https://api.perplexity.ai/chat/completions');
        expect(d.calls[0]?.headers.join(' ')).toContain('authorization: Bearer k-pplx');
    });

    it('no constructor path reaches a package-not-installed error (AC-1)', () => {
        const noop = (): unknown => ({});
        for (const build of [
            () => new GeminiClient({ api_key: 'k', transport: noop }),
            () => new XAIClient({ api_key: 'k', transport: noop }),
            () => new PerplexityClient({ api_key: 'k', transport: noop }),
        ]) {
            expect(build).not.toThrow(/package not installed/);
        }
    });

    it('a missing api_key is still refused — the key gate is not weakened', () => {
        expect(() => new GeminiClient({})).toThrow(/requires explicit api_key/);
        expect(() => new XAIClient({})).toThrow(/requires explicit api_key/);
        expect(() => new PerplexityClient({})).toThrow(/requires explicit api_key/);
    });
});

describe('api transport — shim shapes', () => {
    it('the compatible shim appends /chat/completions exactly once', () => {
        const d = openAiDouble('x');
        const client = openAiCompatibleClient('https://example.test/v1/', 'k', d.post) as {
            chat: { completions: { create: (kw: Record<string, unknown>) => unknown } };
        };
        client.chat.completions.create({ model: 'm' });
        expect(d.calls[0]?.url).toBe('https://example.test/v1/chat/completions');
    });

    it('the gemini shim carries the model into the REST path', () => {
        const d = geminiDouble('x');
        const client = geminiRestClient('k', d.post) as {
            models: { generate_content: (kw: Record<string, unknown>) => unknown };
        };
        client.models.generate_content({ model: 'gemini-2.5-pro', contents: 'hi', config: {} });
        expect(d.calls[0]?.url).toContain('/models/gemini-2.5-pro:generateContent');
    });

    it('normaliseGeminiRest joins multi-part text and defaults missing usage to 0', () => {
        const out = normaliseGeminiRest({
            candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }],
        });
        expect(out.text).toBe('ab');
        expect(out.usage_metadata.prompt_token_count).toBe(0);
        expect(out.usage_metadata.candidates_token_count).toBe(0);
    });

    it('normaliseGeminiRest survives an empty envelope rather than throwing', () => {
        const out = normaliseGeminiRest({});
        expect(out.text).toBe('');
        expect(out.model_version).toBe('');
    });
});
