// Tests for src/scripts/ai_council/modes.ts (py2ts Phase 1).
//
// Pure resolver — no I/O, no env.
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_MODE,
    InvalidModeError,
    VALID_MODES,
    resolve_global_mode,
    resolve_mode,
    resolve_modes,
} from '../../../src/scripts/ai_council/modes.js';

describe('modes — constants', () => {
    it('VALID_MODES carries the four accepted values; DEFAULT_MODE is the free one', () => {
        expect(Array.from(VALID_MODES).sort()).toEqual(['api', 'auto', 'cli', 'manual']);
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
                "/council mode= for 'x' requested mode='bogus'; expected one of: ['api', 'auto', 'cli', 'manual']",
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
                "ai_council.members.openai.mode requested mode='nope'; expected one of: ['api', 'auto', 'cli', 'manual']",
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


// ── road-to-zero-ceremony-detection Phase 2 ───────────────────────────
//
// The full four-layer precedence chain, pinned end to end, plus the global-mode
// key-shape fix and the two-defaults reconciliation.

describe('modes — resolve_global_mode accepts both block shapes', () => {
    it('reads the flattened top-level `mode` (synthesized shape)', () => {
        expect(resolve_global_mode({ mode: 'cli' })).toBe('cli');
    });

    it('reads the nested `defaults.mode` (raw .ai-council.yml shape)', () => {
        expect(resolve_global_mode({ defaults: { mode: 'api' } })).toBe('api');
    });

    it('prefers the flattened key when both are present', () => {
        expect(resolve_global_mode({ mode: 'cli', defaults: { mode: 'manual' } })).toBe('cli');
    });

    it('normalises case and whitespace like every other layer', () => {
        expect(resolve_global_mode({ defaults: { mode: '  AUTO ' } })).toBe('auto');
    });

    it('returns null for every shape that carries no usable string', () => {
        expect(resolve_global_mode(null)).toBeNull();
        expect(resolve_global_mode(undefined)).toBeNull();
        expect(resolve_global_mode({})).toBeNull();
        expect(resolve_global_mode({ mode: '   ' })).toBeNull();
        expect(resolve_global_mode({ defaults: {} })).toBeNull();
        expect(resolve_global_mode({ defaults: null })).toBeNull();
        expect(resolve_global_mode({ defaults: 'nope' })).toBeNull();
        expect(resolve_global_mode({ defaults: ['api'] })).toBeNull();
        expect(resolve_global_mode({ defaults: { mode: 42 } })).toBeNull();
    });

    it('works on Map-shaped blocks as well as plain objects', () => {
        expect(resolve_global_mode(new Map<string, unknown>([['mode', 'cli']]))).toBe('cli');
        expect(
            resolve_global_mode(
                new Map<string, unknown>([['defaults', new Map([['mode', 'api']])]]),
            ),
        ).toBe('api');
    });

    it('does not validate — an unknown value is passed on for resolve_mode to reject', () => {
        expect(resolve_global_mode({ defaults: { mode: 'bogus' } })).toBe('bogus');
        expect(() => resolve_mode('openai', { globalMode: 'bogus' })).toThrow(InvalidModeError);
    });
});

describe('modes — the four-layer precedence chain, both shapes', () => {
    /** Resolve as `build_members` does: global mode extracted from the block. */
    function resolveVia(
        aiBlock: Record<string, unknown>,
        opts: { invocationMode?: string | null; member?: Record<string, unknown> } = {},
    ): string {
        return resolve_mode('anthropic', {
            invocationMode: opts.invocationMode ?? null,
            memberSettings: opts.member ?? null,
            globalMode: resolve_global_mode(aiBlock),
        });
    }

    const NESTED = { defaults: { mode: 'cli' } };
    const FLAT = { mode: 'cli' };

    for (const [label, block] of [
        ['nested defaults.mode', NESTED],
        ['flattened mode', FLAT],
    ] as const) {
        it(`layer 1 — invocation flag beats everything (${label})`, () => {
            expect(resolveVia(block, { invocationMode: 'manual', member: { mode: 'api' } })).toBe(
                'manual',
            );
        });

        it(`layer 2 — per-member mode beats the global (${label})`, () => {
            expect(resolveVia(block, { member: { mode: 'api' } })).toBe('api');
        });

        it(`layer 3 — the global applies when no flag and no member mode (${label})`, () => {
            expect(resolveVia(block)).toBe('cli');
        });
    }

    it('layer 4 — built-in fallback when no layer supplies anything', () => {
        expect(resolveVia({})).toBe(DEFAULT_MODE);
        expect(resolveVia({})).toBe('manual');
    });

    it('carries `auto` through every layer', () => {
        expect(resolveVia({ defaults: { mode: 'auto' } })).toBe('auto');
        expect(resolveVia({}, { member: { mode: 'auto' } })).toBe('auto');
        expect(resolveVia({}, { invocationMode: 'auto' })).toBe('auto');
    });

    it('keeps `manual` reachable — auto never deletes the safest transport', () => {
        expect(VALID_MODES.has('manual')).toBe(true);
        expect(resolveVia({ defaults: { mode: 'auto' } }, { member: { mode: 'manual' } })).toBe(
            'manual',
        );
    });
});

describe('modes — the two defaults are distinct and both documented', () => {
    it('the built-in fallback is the free transport, not the billable/auto one', () => {
        // A caller who supplied no transport preference has not asked to spend
        // money. The loader's `defaults.mode` default (`auto`, since
        // road-to-always-on-orchestration Phase 3.1) is a different layer.
        expect(DEFAULT_MODE).toBe('manual');
        expect(resolve_mode('anthropic')).toBe('manual');
    });

    it('the loader default only reaches the resolver as an explicit global', () => {
        // Once a config file exists, `defaults.mode` is always populated
        // (`auto` since the Phase 3.1 flip), so layer 3 wins and the built-in
        // fallback is not consulted.
        expect(resolve_mode('anthropic', { globalMode: 'auto' })).toBe('auto');
    });
});
