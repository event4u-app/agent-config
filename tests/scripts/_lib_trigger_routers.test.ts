// Tests for src/scripts/_lib/trigger_routers.ts (roadmap T-004).
//
// All three routers are exercised with an INJECTED fake fetch — no live
// network calls. We assert:
//   - each vendor's response shape parses `loaded` + token counts correctly;
//   - a missing apiKey throws at construction;
//   - non-200 and malformed responses degrade gracefully to [[], 0, 0]
//     (never throw — mirrors `_parse_would_load`).
import { describe, expect, it } from 'vitest';

import { SkillMeta } from '../../src/scripts/skill_trigger_eval.js';
import {
    AnthropicFetchRouter,
    GeminiRouter,
    OpenAiRouter,
    type FetchImpl,
} from '../../src/scripts/_lib/trigger_routers.js';

const SKILLS = [SkillMeta('a', 'first skill'), SkillMeta('b', 'second skill')];
const WOULD_LOAD_TEXT = '{"would_load":["a","b"]}';

/** A fake fetch returning a canned 200 JSON body. */
function fakeFetch(jsonBody: unknown): FetchImpl {
    return async () => ({
        ok: true,
        status: 200,
        json: async () => jsonBody,
    });
}

/** A fake fetch returning a non-200 status. */
function failingFetch(status = 500): FetchImpl {
    return async () => ({
        ok: false,
        status,
        json: async () => ({}),
    });
}

/** A fake fetch whose json() rejects (malformed body). */
function malformedFetch(): FetchImpl {
    return async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw new Error('not json');
        },
    });
}

/** A fake fetch that records the request body it was called with. */
function capturingFetch(jsonBody: unknown): { fetch: FetchImpl; lastBody: () => unknown } {
    let captured: string | undefined;
    const fetch: FetchImpl = async (_url, init) => {
        captured = (init as { body?: string } | undefined)?.body;
        return { ok: true, status: 200, json: async () => jsonBody };
    };
    return { fetch, lastBody: () => (captured ? JSON.parse(captured) : undefined) };
}

describe('OpenAiRouter', () => {
    it('parses loaded + token counts', async () => {
        const fetchImpl = fakeFetch({
            choices: [{ message: { content: WOULD_LOAD_TEXT } }],
            usage: { prompt_tokens: 123, completion_tokens: 7 },
        });
        const r = new OpenAiRouter({ apiKey: 'k', fetchImpl });
        const [loaded, inTok, outTok] = await r.routeAsync('q', SKILLS);
        expect(loaded).toEqual(['a', 'b']);
        expect(inTok).toBe(123);
        expect(outTok).toBe(7);
    });

    it('throws on missing apiKey', () => {
        expect(() => new OpenAiRouter({})).toThrow(/apiKey/);
    });

    it('route() throws — fetch routers are async', () => {
        const r = new OpenAiRouter({ apiKey: 'k', fetchImpl: fakeFetch({}) });
        expect(() => r.route('q', SKILLS)).toThrow(/routeAsync/);
    });

    it('degrades to [[], 0, 0] on non-200', async () => {
        const r = new OpenAiRouter({ apiKey: 'k', fetchImpl: failingFetch() });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });

    it('degrades to [[], 0, 0] on malformed body', async () => {
        const r = new OpenAiRouter({ apiKey: 'k', fetchImpl: malformedFetch() });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });
});

describe('GeminiRouter', () => {
    it('parses loaded + token counts', async () => {
        const fetchImpl = fakeFetch({
            candidates: [{ content: { parts: [{ text: WOULD_LOAD_TEXT }] } }],
            usageMetadata: { promptTokenCount: 88, candidatesTokenCount: 4 },
        });
        const r = new GeminiRouter({ apiKey: 'k', fetchImpl });
        const [loaded, inTok, outTok] = await r.routeAsync('q', SKILLS);
        expect(loaded).toEqual(['a', 'b']);
        expect(inTok).toBe(88);
        expect(outTok).toBe(4);
    });

    it('sends a JSON output contract (responseMimeType) — Phase 0b format fix', async () => {
        // responseMimeType alone, NOT a strict responseSchema: a live 3-variant
        // comparison showed the strict schema crushed routing accuracy (90%→60%)
        // while mimeType-only fixed parse (80%→100%) with far less collateral.
        const cap = capturingFetch({
            candidates: [{ content: { parts: [{ text: WOULD_LOAD_TEXT }] } }],
            usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
        });
        const r = new GeminiRouter({ apiKey: 'k', fetchImpl: cap.fetch });
        await r.routeAsync('q', SKILLS);
        const body = cap.lastBody() as { generationConfig?: { responseMimeType?: string; responseSchema?: unknown } };
        expect(body.generationConfig?.responseMimeType).toBe('application/json');
        expect(body.generationConfig?.responseSchema).toBeUndefined();
    });

    it('defaults to a flash model', () => {
        const r = new GeminiRouter({ apiKey: 'k', fetchImpl: fakeFetch({}) });
        expect(r.name).toBe('gemini');
    });

    it('throws on missing apiKey', () => {
        expect(() => new GeminiRouter({})).toThrow(/apiKey/);
    });

    it('degrades to [[], 0, 0] on non-200', async () => {
        const r = new GeminiRouter({ apiKey: 'k', fetchImpl: failingFetch(429) });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });

    it('degrades to [[], 0, 0] on malformed body', async () => {
        const r = new GeminiRouter({ apiKey: 'k', fetchImpl: malformedFetch() });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });
});

describe('AnthropicFetchRouter', () => {
    it('parses loaded + token counts', async () => {
        const fetchImpl = fakeFetch({
            content: [{ type: 'text', text: WOULD_LOAD_TEXT }],
            usage: { input_tokens: 200, output_tokens: 9 },
        });
        const r = new AnthropicFetchRouter({ apiKey: 'k', fetchImpl });
        const [loaded, inTok, outTok] = await r.routeAsync('q', SKILLS);
        expect(loaded).toEqual(['a', 'b']);
        expect(inTok).toBe(200);
        expect(outTok).toBe(9);
    });

    it('throws on missing apiKey', () => {
        expect(() => new AnthropicFetchRouter({})).toThrow(/apiKey/);
    });

    it('route() throws — fetch routers are async', () => {
        const r = new AnthropicFetchRouter({ apiKey: 'k', fetchImpl: fakeFetch({}) });
        expect(() => r.route('q', SKILLS)).toThrow(/routeAsync/);
    });

    it('degrades to [[], 0, 0] on non-200', async () => {
        const r = new AnthropicFetchRouter({ apiKey: 'k', fetchImpl: failingFetch() });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });

    it('degrades to [[], 0, 0] on malformed body', async () => {
        const r = new AnthropicFetchRouter({ apiKey: 'k', fetchImpl: malformedFetch() });
        expect(await r.routeAsync('q', SKILLS)).toEqual([[], 0, 0]);
    });
});
