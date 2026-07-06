// Gated LIVE smoke for the council curl transport (teardown Phase 2b).
//
// Guards against the throwing-twin regression: every enabled council member's
// client silently became a stub during the py2ts migration, so the council
// could make no live call until the curl bridge was wired. This smoke makes
// ONE minimal real API call per enabled member so that regression cannot
// recur silently.
//
// COST GATE — skipped unless BOTH hold:
//   * env `COUNCIL_LIVE_SMOKE=1` (explicit operator opt-in; never set in CI)
//   * the member's key file is installed (`load_*_key()` resolves)
//
// Each call is capped at 16 output tokens against the member's default model
// — worst case well under $0.01 per run. This is an operator-invoked spend
// gate, the same shape as the live trigger-eval human gate.
//
// Run manually:
//   COUNCIL_LIVE_SMOKE=1 npx vitest run tests/ai_council/clients_live_smoke.test.ts
import { describe, expect, it } from 'vitest';

import {
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
} from '../../src/scripts/ai_council/clients.js';

const LIVE = process.env['COUNCIL_LIVE_SMOKE'] === '1';

function keyOrNull(loader: () => string): string | null {
    try {
        return loader();
    } catch {
        return null;
    }
}

const anthropicKey = LIVE ? keyOrNull(load_anthropic_key) : null;
const openaiKey = LIVE ? keyOrNull(load_openai_key) : null;

describe('council live-transport smoke (gated — COUNCIL_LIVE_SMOKE=1)', () => {
    it.skipIf(!LIVE || anthropicKey === null)(
        'anthropic: one minimal live call returns text, no error',
        () => {
            const client = new AnthropicClient({ api_key: anthropicKey });
            const r = client.ask('Reply with exactly: ok', 'ping', 16);
            // A throwing-twin / dead-transport regression surfaces as r.error.
            expect(r.error ?? '').toBe('');
            expect(r.text.length).toBeGreaterThan(0);
            expect(r.input_tokens).toBeGreaterThan(0);
        },
        60_000,
    );

    it.skipIf(!LIVE || openaiKey === null)(
        'openai: one minimal live call returns text, no error',
        () => {
            const client = new OpenAIClient({ api_key: openaiKey });
            const r = client.ask('Reply with exactly: ok', 'ping', 16);
            expect(r.error ?? '').toBe('');
            expect(r.text.length).toBeGreaterThan(0);
            expect(r.input_tokens).toBeGreaterThan(0);
        },
        60_000,
    );

    it('gate documentation — suite is a silent no-op without the env flag', () => {
        // Always-on marker so the file never reports "no tests"; documents the
        // opt-in for anyone running the file without the flag.
        if (!LIVE) {
            expect(anthropicKey).toBeNull();
            expect(openaiKey).toBeNull();
        }
        expect(true).toBe(true);
    });
});
