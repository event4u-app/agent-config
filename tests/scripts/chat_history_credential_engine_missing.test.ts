/**
 * With the egress engine unavailable, chat history writes no string leaf as
 * given: an unscanned leaf could carry a credential, so it is withheld.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/scripts/hooks/egress_engine_loader.js', () => ({
    loadEgressEngine: () => ({ ok: false, reason: 'missing' }),
}));

const { redact_credentials } = await import('../../src/scripts/_lib/chat_history_redact.js');

describe('chat history without the egress engine', () => {
    it('withholds every string leaf and keeps the structural keys', () => {
        const out = redact_credentials({ t: 'user', ts: 'T', s: 'S', text: 'anything', n: 3, nested: ['x'] });
        expect(out).toEqual({
            t: 'user',
            ts: 'T',
            s: 'S',
            text: '[chat-history: text withheld (egress engine missing)]',
            n: 3,
            nested: ['[chat-history: text withheld (egress engine missing)]'],
        });
    });
});
