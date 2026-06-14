// Tests for src/scripts/ai_council/solo_dispatch.ts (py2ts Phase 1).
//
// solo_dispatch is the single-member path: chain-walk + lazy auth-probe cache
// + escalation on low-confidence/split/refusal. Pure logic (no LLM transport;
// callers inject probe / run_solo / run_full). Golden parity drives the LIVE
// Python twin via a `python3 -c` importlib direct-file load with <repo>/src on
// sys.path so config + confidence_gate resolve; solo_dispatch.py loads off
// disk. `now` is injected so nothing depends on the monotonic clock.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

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

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const SOLO_PY = 'src/scripts/ai_council/solo_dispatch.py';
const REPO_SRC = path.resolve('src');

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

function pyDriver(body: string): string {
    return [
        'import importlib.util, sys, json',
        `sys.path.insert(0, ${JSON.stringify(REPO_SRC)})`,
        `_spec = importlib.util.spec_from_file_location("sd", ${JSON.stringify(SOLO_PY)})`,
        'sd = importlib.util.module_from_spec(_spec)',
        'sys.modules["sd"] = sd',
        '_spec.loader.exec_module(sd)',
        'from scripts.ai_council.config import MemberConfig, RoutingConfig',
        body,
    ].join('\n');
}

function py(body: string): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('python3', ['-c', pyDriver(body)], { encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
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

// ── Golden parity vs the CPython twin ────────────────────────────────

describe.runIf(py3)('solo_dispatch — golden parity vs CPython twin', () => {
    // select_solo_member scenarios: each drives a Python lambda probe and
    // compares the selected provider + the resulting cache verdict map.
    interface SelCase {
        chain: string[];
        members: Array<[string, boolean]>; // [name, enabled]
        validNames: string[]; // probe returns true for these
        env: Record<string, string>;
    }
    const SEL_CASES: Record<string, SelCase> = {
        first_valid: { chain: ['x', 'y'], members: [['x', true]], validNames: ['x'], env: {} },
        skip_disabled: { chain: ['x', 'y'], members: [['x', false], ['y', true]], validNames: ['y'], env: {} },
        all_invalid: { chain: ['x', 'y'], members: [['x', true], ['y', true]], validNames: [], env: {} },
        missing_member: { chain: ['ghost', 'y'], members: [['y', true]], validNames: ['y'], env: {} },
        force_full: { chain: ['x'], members: [['x', true]], validNames: ['x'], env: { AGENT_CONFIG_FORCE_FULL_COUNCIL: '1' } },
        second_valid: { chain: ['x', 'y', 'z'], members: [['x', true], ['y', true], ['z', true]], validNames: ['z'], env: {} },
    };

    it.each(Object.keys(SEL_CASES))('select_solo_member(%s) matches', (key) => {
        const cse = SEL_CASES[key]!;
        const pyMembers = cse.members
            .map(
                ([n, e]) =>
                    `${JSON.stringify(n)}: MemberConfig(name=${JSON.stringify(n)}, enabled=${e ? 'True' : 'False'}, model="m", api_key_ref=None, mode=None, binary=None, model_ladder=(), participate_low_impact=True)`,
            )
            .join(', ');
        const pyValid = JSON.stringify(cse.validNames);
        const pyEnv = JSON.stringify(cse.env);
        const r = py(
            `routing = RoutingConfig(solo_member_fallback_chain=${JSON.stringify(cse.chain)}, auth_check_timeout_seconds=3)\n` +
                `members = {${pyMembers}}\n` +
                `valid = set(${pyValid})\n` +
                `cache = sd.AuthCache()\n` +
                `sel = sd.select_solo_member(routing, members, auth_cache=cache, probe=lambda n, t: n in valid, now=1000.0, env=${pyEnv})\n` +
                `entries = {k: [v.valid, v.expires_at] for k, v in cache.entries.items()}\n` +
                `print(json.dumps([sel, entries], sort_keys=True))`,
        );
        expect(r.status).toBe(0);
        const cache = new AuthCache();
        const valid = new Set(cse.validNames);
        const members = new Map<string, MemberConfig>(cse.members.map(([n, e]) => [n, member(n, e)]));
        const sel = select_solo_member(
            { solo_member_fallback_chain: cse.chain, auth_check_timeout_seconds: 3 },
            members,
            {
                auth_cache: cache,
                probe: (n) => valid.has(n),
                now: 1000.0,
                env: cse.env,
            },
        );
        const entries: Record<string, [boolean, number]> = {};
        for (const [k, v] of cache.entries) {
            entries[k] = [v.valid, v.expires_at];
        }
        expect([sel, entries]).toEqual(JSON.parse(r.stdout.trim()));
    });

    // dispatch_with_escalation: vary the solo response to hit each reason.
    const DISPATCH_CASES: Record<string, { chain: string[]; solo: string; floor: number }> = {
        no_solo_member: { chain: [], solo: 'unused', floor: 0.5 },
        refusal: { chain: ['y'], solo: 'I cannot decide on this.', floor: 0.5 },
        short_response: { chain: ['y'], solo: 'Yes do it.', floor: 0.5 },
        split: {
            chain: ['y'],
            solo: 'You could either ship it or hold it — both would be defensible choices here today.',
            floor: 0.5,
        },
        low_confidence: {
            chain: ['y'],
            solo: 'Maybe this works, perhaps it does, I think possibly it might be fine, probably, unsure though.',
            floor: 0.9,
        },
        ok: {
            chain: ['y'],
            solo: 'Ship it. The migration is reversible, tests cover the critical path, and the blast radius is small.',
            floor: 0.5,
        },
    };

    it.each(Object.keys(DISPATCH_CASES))('dispatch_with_escalation(%s) matches', (key) => {
        const cse = DISPATCH_CASES[key]!;
        const r = py(
            `routing = RoutingConfig(solo_member_fallback_chain=${JSON.stringify(cse.chain)}, auth_check_timeout_seconds=3)\n` +
                `members = {"y": MemberConfig(name="y", enabled=True, model="m", api_key_ref=None, mode=None, binary=None, model_ladder=(), participate_low_impact=True)}\n` +
                `res = sd.dispatch_with_escalation(routing, members, auth_cache=sd.AuthCache(), ` +
                `probe=lambda n, t: True, run_solo=lambda n: ${JSON.stringify(cse.solo)}, run_full=lambda: "FULL", ` +
                `confidence_floor=${cse.floor}, now=1.0, env={})\n` +
                'print(json.dumps({"verdict": res.verdict, "escalated": res.escalated, ' +
                '"escalation_reason": res.escalation_reason, "solo_member": res.solo_member, ' +
                '"solo_response": res.solo_response, "solo_confidence": res.solo_confidence}))',
        );
        expect(r.status).toBe(0);
        const members = new Map([['y', member('y', true)]]);
        const res = dispatch_with_escalation(
            { solo_member_fallback_chain: cse.chain, auth_check_timeout_seconds: 3 },
            members,
            {
                auth_cache: new AuthCache(),
                probe: () => true,
                run_solo: () => cse.solo,
                run_full: () => 'FULL',
                confidence_floor: cse.floor,
                now: 1.0,
                env: {},
            },
        );
        expect({
            verdict: res.verdict,
            escalated: res.escalated,
            escalation_reason: res.escalation_reason,
            solo_member: res.solo_member,
            solo_response: res.solo_response,
            solo_confidence: res.solo_confidence,
        }).toEqual(JSON.parse(r.stdout.trim()));
    });

    it('force_full_council matches across env values', () => {
        const cases = ['', '1', '0', '2', 'true', 'yes'];
        const r = py(
            `vals = ${JSON.stringify(cases)}\n` +
                'print(json.dumps([sd.force_full_council({"AGENT_CONFIG_FORCE_FULL_COUNCIL": v}) for v in vals]))',
        );
        expect(r.status).toBe(0);
        const got = cases.map((v) => force_full_council({ [FORCE_FULL_ENV]: v }));
        expect(got).toEqual(JSON.parse(r.stdout.trim()));
    });
});
