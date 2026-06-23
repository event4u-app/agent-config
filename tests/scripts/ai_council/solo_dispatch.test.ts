// Tests for src/scripts/ai_council/solo_dispatch.ts (py2ts Phase 1).
//
// solo_dispatch is the single-member path: chain-walk + lazy auth-probe cache
// + escalation on low-confidence/split/refusal. Pure logic (no LLM transport;
// callers inject probe / run_solo / run_full). `now` is injected so nothing
// depends on the monotonic clock.
import { describe, expect, it } from 'vitest';

import type { MemberConfig, RoutingConfig } from '../../../src/scripts/ai_council/config.js';
import {
    AUTH_CACHE_TTL_SECONDS,
    AuthCache,
    AuthCacheEntry,
    dispatch_with_escalation,
    FORCE_FULL_ENV,
    force_full_council,
    select_solo_member,
    SoloDispatchResult,
} from '../../../src/scripts/ai_council/solo_dispatch.js';

function member(name: string, enabled: boolean, model = 'm'): MemberConfig {
    return {
        name,
        enabled,
        model,
        api_key_ref: null,
        mode: null,
        binary: null,
        model_ladder: [],
        participate_low_impact: true,
    };
}

function routing(chain: string[], timeout = 3): RoutingConfig {
    return { solo_member_fallback_chain: chain, auth_check_timeout_seconds: timeout };
}

// ── Unit tests ───────────────────────────────────────────────────────

describe('solo_dispatch — constants', () => {
    it('TTL is 15 minutes, env var name fixed', () => {
        expect(AUTH_CACHE_TTL_SECONDS).toBe(900);
        expect(FORCE_FULL_ENV).toBe('AGENT_CONFIG_FORCE_FULL_COUNCIL');
    });
});

describe('solo_dispatch — force_full_council', () => {
    it('only the literal "1" counts as force', () => {
        expect(force_full_council(new Map())).toBe(false);
        expect(force_full_council(new Map([[FORCE_FULL_ENV, '1']]))).toBe(true);
        expect(force_full_council(new Map([[FORCE_FULL_ENV, '2']]))).toBe(false);
        expect(force_full_council(new Map([[FORCE_FULL_ENV, 'true']]))).toBe(false);
        expect(force_full_council({ [FORCE_FULL_ENV]: '1' })).toBe(true);
    });
});

describe('solo_dispatch — AuthCache TTL', () => {
    it('expired entry returns null; fresh returns valid', () => {
        const c = new AuthCache();
        c.set('x', { valid: true, now: 1000 });
        expect(c.get('x', { now: 1000 })).toBe(true);
        expect(c.get('x', { now: 1000 + AUTH_CACHE_TTL_SECONDS - 1 })).toBe(true);
        // Python: entry.expires_at <= now → expired. expires_at = now+TTL.
        expect(c.get('x', { now: 1000 + AUTH_CACHE_TTL_SECONDS })).toBeNull();
        expect(c.get('missing', { now: 1000 })).toBeNull();
    });
    it('AuthCacheEntry holds valid + expiry', () => {
        const e = new AuthCacheEntry({ valid: false, expires_at: 42 });
        expect(e.valid).toBe(false);
        expect(e.expires_at).toBe(42);
    });
});

describe('solo_dispatch — select_solo_member', () => {
    it('returns first enabled + auth-valid member', () => {
        const c = new AuthCache();
        const probed: string[] = [];
        const sel = select_solo_member(routing(['x', 'y', 'z']), new Map([
            ['x', member('x', false)],
            ['y', member('y', true)],
            ['z', member('z', true)],
        ]), {
            auth_cache: c,
            probe: (n) => {
                probed.push(n);
                return n === 'y';
            },
            now: 1000,
            env: new Map(),
        });
        expect(sel).toBe('y');
        expect(probed).toEqual(['y']); // x skipped (disabled), y valid → stop
    });
    it('caches probe verdicts; cached-false skips, cached-true short-circuits', () => {
        const c = new AuthCache();
        const members = new Map([
            ['x', member('x', true)],
            ['y', member('y', true)],
        ]);
        let calls = 0;
        const probe = (n: string): boolean => {
            calls += 1;
            return n === 'y';
        };
        const s1 = select_solo_member(routing(['x', 'y']), members, { auth_cache: c, probe, now: 1, env: new Map() });
        expect(s1).toBe('y');
        expect(calls).toBe(2); // x→false (cached), y→true (cached)
        // second walk: x cached-false skipped without probe, y cached-true returned
        const s2 = select_solo_member(routing(['x', 'y']), members, {
            auth_cache: c,
            probe: () => {
                throw new Error('should not probe');
            },
            now: 1,
            env: new Map(),
        });
        expect(s2).toBe('y');
    });
    it('probe throwing → treated as auth-invalid, walks on', () => {
        const sel = select_solo_member(routing(['x']), new Map([['x', member('x', true)]]), {
            auth_cache: new AuthCache(),
            probe: () => {
                throw new Error('boom');
            },
            now: 1,
            env: new Map(),
        });
        expect(sel).toBeNull();
    });
    it('all unavailable → null', () => {
        const sel = select_solo_member(routing(['x', 'y']), new Map([
            ['x', member('x', false)],
            ['y', member('y', true)],
        ]), { auth_cache: new AuthCache(), probe: () => false, now: 1, env: new Map() });
        expect(sel).toBeNull();
    });
    it('force-full env short-circuits to null', () => {
        const sel = select_solo_member(routing(['x']), new Map([['x', member('x', true)]]), {
            auth_cache: new AuthCache(),
            probe: () => true,
            now: 1,
            env: new Map([[FORCE_FULL_ENV, '1']]),
        });
        expect(sel).toBeNull();
    });
    it('missing member name in chain is skipped', () => {
        const sel = select_solo_member(routing(['ghost', 'y']), new Map([['y', member('y', true)]]), {
            auth_cache: new AuthCache(),
            probe: () => true,
            now: 1,
            env: new Map(),
        });
        expect(sel).toBe('y');
    });
});

describe('solo_dispatch — dispatch_with_escalation', () => {
    const members = new Map([['y', member('y', true)]]);
    it('no solo member → run_full + no_solo_member', () => {
        const r = dispatch_with_escalation(routing([]), new Map(), {
            auth_cache: new AuthCache(),
            probe: () => true,
            run_solo: () => 'solo',
            run_full: () => 'FULL',
            confidence_floor: 0.5,
            now: 1,
            env: new Map(),
        });
        expect(r).toBeInstanceOf(SoloDispatchResult);
        expect(r.verdict).toBe('FULL');
        expect(r.escalated).toBe(true);
        expect(r.escalation_reason).toBe('no_solo_member');
        expect(r.solo_member).toBeNull();
    });
    it('refusal → escalate, keeps solo on result', () => {
        const r = dispatch_with_escalation(routing(['y']), members, {
            auth_cache: new AuthCache(),
            probe: () => true,
            run_solo: () => 'I cannot decide this one.',
            run_full: () => 'FULL',
            confidence_floor: 0.5,
            now: 1,
            env: new Map(),
        });
        expect(r.escalated).toBe(true);
        expect(r.escalation_reason).toBe('refusal');
        expect(r.solo_member).toBe('y');
        expect(r.solo_response).toBe('I cannot decide this one.');
        expect(r.verdict).toBe('FULL');
    });
    it('confident long answer → no escalation, solo verdict', () => {
        const confident =
            'Ship it. The migration is reversible, tests cover the critical path, and the blast radius is small.';
        const r = dispatch_with_escalation(routing(['y']), members, {
            auth_cache: new AuthCache(),
            probe: () => true,
            run_solo: () => confident,
            run_full: () => 'FULL',
            confidence_floor: 0.5,
            now: 1,
            env: new Map(),
        });
        expect(r.escalated).toBe(false);
        expect(r.escalation_reason).toBe('ok');
        expect(r.verdict).toBe(confident);
        expect(r.solo_confidence).toBe(1.0);
    });
});
