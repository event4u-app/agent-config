// Tests for src/scripts/ai_council/modes.ts (py2ts Phase 1).
//
// Pure resolver — no I/O, no env.
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_MODE,
    InvalidModeError,
    VALID_MODES,
    resolve_mode,
    resolve_modes,
} from '../../../src/scripts/ai_council/modes.js';

describe('modes — constants', () => {
    it('VALID_MODES and DEFAULT_MODE match the Python contract', () => {
        expect(Array.from(VALID_MODES).sort()).toEqual(['api', 'cli', 'manual']);
        expect(DEFAULT_MODE).toBe('manual');
    });
});

describe('modes — resolve_mode precedence', () => {
    it('invocation flag wins (normalised + lowercased)', () => {
        expect(resolve_mode('anthropic', { invocationMode: '  API ' })).toBe('api');
    });

    it('per-member setting beats global', () => {
        expect(
            resolve_mode('openai', { memberSettings: { mode: 'CLI' }, globalMode: 'api' }),
        ).toBe('cli');
    });

    it('global used when no flag / member', () => {
        expect(resolve_mode('openai', { globalMode: 'manual' })).toBe('manual');
    });

    it('default manual when nothing set', () => {
        expect(resolve_mode('openai')).toBe('manual');
    });

    it('empty / whitespace / non-string layers normalise to null', () => {
        expect(resolve_mode('m', { invocationMode: '   ', memberSettings: { mode: '' } })).toBe(
            'manual',
        );
        expect(resolve_mode('m', { memberSettings: { mode: null }, globalMode: 'cli' })).toBe(
            'cli',
        );
    });

    it('invalid mode throws InvalidModeError with the Python message', () => {
        expect(() => resolve_mode('x', { invocationMode: 'bogus' })).toThrow(InvalidModeError);
        try {
            resolve_mode('x', { invocationMode: 'bogus' });
        } catch (e) {
            expect((e as Error).message).toBe(
                "/council mode= for 'x' requested mode='bogus'; expected one of: ['api', 'cli', 'manual']",
            );
        }
    });

    it('earliest layer validated first; later invalid layers not reached', () => {
        // invocation valid → member ignored even if it would be invalid.
        expect(resolve_mode('m', { invocationMode: 'api', memberSettings: { mode: 'nope' } })).toBe(
            'api',
        );
    });

    it('member-setting error message names the member path', () => {
        try {
            resolve_mode('openai', { memberSettings: { mode: 'nope' } });
        } catch (e) {
            expect((e as Error).message).toBe(
                "ai_council.members.openai.mode requested mode='nope'; expected one of: ['api', 'cli', 'manual']",
            );
        }
    });
});

describe('modes — resolve_modes batch', () => {
    it('forwards each member sub-dict', () => {
        expect(
            resolve_modes(['a', 'b', 'c'], {
                membersSettings: { a: { mode: 'cli' }, b: {} },
                globalMode: 'api',
            }),
        ).toEqual({ a: 'cli', b: 'api', c: 'api' });
    });

    it('empty members list → empty object', () => {
        expect(resolve_modes([])).toEqual({});
    });
});

