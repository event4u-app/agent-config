/**
 * Seat resolution: inert when undeclared, frozen once resolved, and honest when
 * it cannot meet what was asked.
 *
 * The load-bearing case is the FIRST one. An extension that claims to be inert
 * when unused has to prove it, or the claim is just a comment — and this
 * extension sits in the loader of a quality council, where a behaviour change
 * nobody declared would be invisible until a verdict came back different.
 */
import { describe, expect, it } from 'vitest';

import type { MemberConfig } from '../../../src/scripts/ai_council/config.js';
import {
    ADMISSIBLE_SENTINELS,
    checkModelAdmissibility,
    familyOf,
    freezeSeating,
    resolveSeating,
} from '../../../src/scripts/ai_council/seating.js';

function member(name: string, model: string, extra: Partial<MemberConfig> = {}): MemberConfig {
    return {
        name,
        enabled: true,
        model,
        api_key_ref: null,
        mode: null,
        binary: null,
        model_ladder: [],
        participate_low_impact: false,
        tier: null,
        prompt_cache_ttl: '5m',
        verified_at: null,
        ...extra,
    } as MemberConfig;
}

describe('seating — undeclared means unchanged', () => {
    it('no constraint seats every enabled member and emits no header', () => {
        const ms = [member('anthropic', 'sonnet'), member('openai', 'codex-default')];
        const s = resolveSeating(ms);
        expect(s.seats.map((m) => m.name)).toEqual(['anthropic', 'openai']);
        expect(s.degraded).toBeNull();
    });

    it('the seated list is byte-identical to the enabled list, in config order', () => {
        // The inertness claim, asserted rather than asserted-about: the ONLY
        // thing an absent declaration may do is reproduce today's ask-all.
        const ms = [
            member('anthropic', 'sonnet'),
            member('gemini', 'gemini-2.5-pro', { enabled: false }),
            member('openai', 'codex-default'),
        ];
        expect(JSON.stringify(resolveSeating(ms).seats)).toBe(JSON.stringify(ms.filter((m) => m.enabled)));
    });

    it('min_families: 1 is also no constraint', () => {
        expect(resolveSeating([member('anthropic', 'sonnet')], { min_families: 1 }).degraded).toBeNull();
    });
});

describe('seating — family diversity, and exactly one line when it cannot be met', () => {
    it('two families available seats two families and emits no header', () => {
        const s = resolveSeating([member('anthropic', 'sonnet'), member('openai', 'codex-default')], {
            min_families: 2,
        });
        expect(s.families.length).toBe(2);
        expect(s.degraded).toBeNull();
    });

    it('one family available seats it and emits exactly ONE line', () => {
        const s = resolveSeating([member('anthropic', 'sonnet')], { min_families: 2 });
        expect(s.seats.length).toBe(1);
        expect(s.degraded).not.toBeNull();
        // Asserted BY COUNT, both directions. A wall of warnings is the same
        // failure as a silent fallback: the reader stops reading either way.
        expect((s.degraded ?? '').split('\n').filter((l) => l.includes('tier-degraded')).length).toBe(1);
        expect(s.degraded).toContain('asked for 2 model families, seated 1');
    });

    it('the run proceeds — a diversity shortfall never refuses to convene', () => {
        // Failing closed here would break every single-provider install, which
        // is worse than a stated shortfall.
        expect(resolveSeating([member('anthropic', 'sonnet')], { min_families: 3 }).seats.length).toBe(1);
    });

    it('family is the PROVIDER, not a capability band', () => {
        // Two Claude bands share a vendor, a training pipeline and a failure
        // mode, so they are one family for the purpose a second opinion serves.
        const s = resolveSeating([member('anthropic', 'sonnet'), member('anthropic-2', 'opus')], {
            min_families: 2,
        });
        expect(familyOf(s.seats[0] as MemberConfig)).toBe('anthropic');
        expect(s.degraded).toBeNull(); // two distinct provider keys
    });
});

describe('seating — frozen once resolved', () => {
    it('a later mutation of the member list cannot change the frozen seating', () => {
        // The property behind "resolve once per run": seating that changed
        // between round 1 and round 3 would silently invalidate the
        // anonymised-peer-reply contract — "reviewer B" in round 3 would not be
        // the "reviewer B" of round 1, and every cross-reference in the
        // synthesis would be wrong while looking fine.
        const ms = [member('anthropic', 'sonnet'), member('openai', 'codex-default')];
        const frozen = freezeSeating(resolveSeating(ms));
        ms.push(member('gemini', 'gemini-2.5-pro'));
        expect(frozen.seats.map((m) => m.name)).toEqual(['anthropic', 'openai']);
        expect(Object.isFrozen(frozen.seats)).toBe(true);
        expect(() => (frozen.seats as MemberConfig[]).push(member('x', 'sonnet'))).toThrow();
    });
});

describe('admissibility — the source of the id, not the id itself', () => {
    it('a vendor sentinel or latest-in-band alias is admissible', () => {
        for (const id of ADMISSIBLE_SENTINELS) {
            expect(checkModelAdmissibility(member('m', id)).admissible).toBe(true);
        }
    });

    it('a dated pin with a verified_at stamp is admissible', () => {
        expect(
            checkModelAdmissibility(member('gemini', 'gemini-2.5-pro', { verified_at: '2026-08-22' })).admissible,
        ).toBe(true);
    });

    it('a dated pin with NO stamp is the recall case and is refused', () => {
        const r = checkModelAdmissibility(member('gemini', 'gemini-2.5-pro'));
        expect(r.admissible).toBe(false);
        // The message must name where the vocabulary lives, or a reader hitting
        // it has to go looking.
        expect(r.reason).toContain('src/scripts/_lib/model_tier.ts');
        expect(r.reason).toContain('verified_at');
    });

    it('a plausible-sounding invented id is refused — the failure this exists for', () => {
        // Indistinguishable from a real one at review time, which is exactly
        // why the check is on the SOURCE and not on the string.
        expect(checkModelAdmissibility(member('anthropic', 'claude-sonnet-9-2')).admissible).toBe(false);
    });
});
