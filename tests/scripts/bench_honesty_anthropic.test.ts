// Tests for src/scripts/_lib/bench_honesty_anthropic.ts — request shape and the
// retry path, with an injected fetch; nothing leaves the machine.

import { describe, expect, it } from 'vitest';

import { AnthropicBenchClient, buildBody } from '../../src/scripts/_lib/bench_honesty_anthropic.js';

const opts = { model: 'm', temperature: 1, maxTokens: 64, keyPath: null };

describe('bench_honesty_anthropic', () => {
    it('pins model and sampling and marks the system and the newest message for the prompt cache', () => {
        const body = buildBody(opts, 'sys', [
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' },
        ]) as { model: string; temperature: number; system: Array<{ cache_control?: unknown }>; messages: Array<{ content: Array<{ cache_control?: unknown }> }> };
        expect(body.model).toBe('m');
        expect(body.temperature).toBe(1);
        expect(body.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
        expect(body.messages.map((m) => m.content[0]?.cache_control !== undefined)).toEqual([false, false, true]);
        expect('system' in buildBody(opts, '', [{ role: 'user', content: 'a' }])).toBe(false);
    });

    it('retries a 529 and returns text, served model and usage', async () => {
        const replies = [
            new Response('overloaded', { status: 529 }),
            new Response(JSON.stringify({ model: 'm-2026', content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 3, output_tokens: 1, cache_read_input_tokens: 2 } }), { status: 200 }),
        ];
        const client = new AnthropicBenchClient({
            ...opts,
            fetchImpl: (() => Promise.resolve(replies.shift() as Response)) as typeof fetch,
            sleep: () => Promise.resolve(),
        });
        (client as unknown as { key: string }).key = 'test';
        const res = await client.complete('', [{ role: 'user', content: 'x' }]);
        expect(res).toEqual({ text: 'hi', served_model: 'm-2026', usage: { input_tokens: 3, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 } });
    });

    it('fails on a non-retryable status', async () => {
        const client = new AnthropicBenchClient({ ...opts, fetchImpl: (() => Promise.resolve(new Response('bad', { status: 400 }))) as typeof fetch });
        (client as unknown as { key: string }).key = 'test';
        await expect(client.complete('', [{ role: 'user', content: 'x' }])).rejects.toThrow(/HTTP 400/);
    });
});
