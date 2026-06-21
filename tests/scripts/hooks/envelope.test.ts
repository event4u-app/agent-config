// Tests for src/scripts/hooks/envelope.ts (py2ts Phase 6 — hooks core).
//
// No dedicated pytest suite targets envelope.py directly (it is exercised
// transitively by the chat-history / minimal-safe-diff hook suites). This
// file covers the full exported surface as unit tests, plus a differential
// golden-parity layer (python3 -c driver vs the TS functions) over unwrap /
// looks_like_envelope / envelope_field. Skipped without python3.
import { describe, expect, it } from 'vitest';

import {
    envelope_field,
    ENVELOPE_KEYS,
    looks_like_envelope,
    unwrap,
} from '../../../src/scripts/hooks/envelope.js';



describe('envelope — looks_like_envelope', () => {
    it('true when all four envelope keys present at top level', () => {
        expect(
            looks_like_envelope({ schema_version: 1, platform: 'a', event: 'stop', payload: {} }),
        ).toBe(true);
    });
    it('false for non-dict', () => {
        expect(looks_like_envelope('x')).toBe(false);
        expect(looks_like_envelope(null)).toBe(false);
        expect(looks_like_envelope([1, 2])).toBe(false);
    });
    it('false when a required key is missing', () => {
        expect(looks_like_envelope({ schema_version: 1, platform: 'a', event: 'stop' })).toBe(false);
    });
    it('payload carrying schema_version does not trigger', () => {
        // Only top-level keys count.
        expect(looks_like_envelope({ payload: { schema_version: 1, platform: 'a', event: 'x' } })).toBe(
            false,
        );
    });
    it('ENVELOPE_KEYS matches the contract', () => {
        expect([...ENVELOPE_KEYS]).toEqual(['schema_version', 'platform', 'event', 'payload']);
    });
});

describe('envelope — unwrap', () => {
    it('empty / whitespace stdin yields empty triple', () => {
        expect(unwrap('')).toEqual([{}, {}, 'generic']);
        expect(unwrap('   ')).toEqual([{}, {}, 'generic']);
        expect(unwrap(null)).toEqual([{}, {}, 'generic']);
        expect(unwrap(undefined)).toEqual([{}, {}, 'generic']);
    });
    it('non-JSON stdin yields empty triple with default platform', () => {
        expect(unwrap('{not json', 'claude')).toEqual([{}, {}, 'claude']);
    });
    it('full envelope returned as-is with payload + platform extracted', () => {
        const env = {
            schema_version: 1,
            platform: 'augment',
            event: 'stop',
            payload: { session_id: 'x' },
        };
        const [e, p, plat] = unwrap(JSON.stringify(env));
        expect(e).toEqual(env);
        expect(p).toEqual({ session_id: 'x' });
        expect(plat).toBe('augment');
    });
    it('envelope with non-dict payload coerces payload to {}', () => {
        const env = { schema_version: 1, platform: 'augment', event: 'stop', payload: 'oops' };
        const [, p] = unwrap(JSON.stringify(env));
        expect(p).toEqual({});
    });
    it('envelope with falsy platform falls back to default', () => {
        const env = { schema_version: 1, platform: '', event: 'stop', payload: {} };
        const [, , plat] = unwrap(JSON.stringify(env), 'cline');
        expect(plat).toBe('cline');
    });
    it('legacy raw dict payload synthesises a minimal envelope', () => {
        const [e, p, plat] = unwrap('{"session_id": "raw-1", "tool_name": "view"}', 'cursor');
        expect(p).toEqual({ session_id: 'raw-1', tool_name: 'view' });
        expect(plat).toBe('cursor');
        expect(e).toEqual({
            schema_version: 1,
            platform: 'cursor',
            event: '',
            native_event: '',
            session_id: '',
            workspace_root: '',
            payload: { session_id: 'raw-1', tool_name: 'view' },
            settings: {},
        });
    });
    it('legacy non-dict JSON (array) synthesises empty payload', () => {
        const [e, p] = unwrap('[1, 2, 3]');
        expect(p).toEqual({});
        expect(e['payload']).toEqual({});
    });
});

describe('envelope — envelope_field', () => {
    it('returns the value when present', () => {
        expect(envelope_field({ a: 1 }, 'a')).toBe(1);
    });
    it('returns default for missing key', () => {
        expect(envelope_field({ a: 1 }, 'b')).toBe('');
        expect(envelope_field({ a: 1 }, 'b', 'fallback')).toBe('fallback');
    });
    it('null value returns default', () => {
        expect(envelope_field({ a: null }, 'a', 'd')).toBe('d');
    });
    it('non-dict envelope returns default', () => {
        // @ts-expect-error — exercising the runtime guard with a bad type.
        expect(envelope_field('nope', 'a', 'd')).toBe('d');
        expect(envelope_field(null, 'a', 'd')).toBe('d');
    });
});

