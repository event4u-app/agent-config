// Tests for src/scripts/config/profile_explain.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_profile_explain.py — the pure `profile-overlay`
// envelope + renderer. Pins plain + technical renders and proves the renderer
// never throws on a partial/missing-field envelope. Plus a golden-parity block
// diffing python3 vs tsx render output byte-for-byte (the renderer is a pure
// template — fully deterministic).
import { describe, expect, it } from 'vitest';

import {
    build_profile_envelope,
    render_profile_overlay,
} from '../../src/scripts/config/profile_explain.js';
import { REPO_ROOT, hasPython3, runPy } from './_config_parity.js';

describe('config/profile_explain — envelope + renderer', () => {
    it('envelope shape', () => {
        const env = build_profile_envelope(['engineering-base'], 40, 60, 167);
        expect(env['envelope_type']).toBe('profile-overlay');
        expect(env['active']).toEqual(['engineering-base']);
        expect(env['delta']['hidden_behind_inactive_packs']).toBe(167);
        expect(env['persists_across_sessions']).toBe(true);
        // no seed/closure split and no staleness-age — not persisted, must be absent
        expect('staleness_days' in env).toBe(false);
        expect('seed_tokens' in env).toBe(false);
    });

    it('no overlay plain', () => {
        const out = render_profile_overlay(build_profile_envelope([], 150, 227, 0));
        expect(out).toContain('Nothing is filtered');
        expect(out).toContain('no profile is active');
    });

    it('single overlay plain', () => {
        const out = render_profile_overlay(build_profile_envelope(['engineering-base'], 40, 60, 167));
        expect(out).toContain('a profile is active (engineering-base)');
        expect(out).toContain('40 commands and 60 skills');
        expect(out).toContain('hides 167');
        expect(out).toContain('/profile deactivate');
        expect(out).not.toContain('days'); // staleness is persistence, not an age
    });

    it('multi overlay joins names', () => {
        const out = render_profile_overlay(
            build_profile_envelope(['finance-basic', 'finance-advanced'], 12, 20, 300),
        );
        expect(out).toContain('(finance-basic, finance-advanced)');
    });

    it('technical mode', () => {
        const out = render_profile_overlay(
            build_profile_envelope(['ops-people'], 30, 50, 100),
            'technical',
        );
        expect(out.startsWith('profile-overlay: active=[ops-people]')).toBe(true);
        expect(out).toContain('surfaced: commands=30 skills=50');
        expect(out).toContain('hidden:   100');
    });

    it('partial envelope never throws', () => {
        for (const env of [{}, { active: ['x'] }, { active: [], commands_shown: null }]) {
            const out = render_profile_overlay(env);
            expect(typeof out).toBe('string');
            expect(out.length).toBeGreaterThan(0);
        }
    });

    it('render is deterministic', () => {
        const a = render_profile_overlay(build_profile_envelope(['x'], 1, 2, 3));
        const b = render_profile_overlay(build_profile_envelope(['x'], 1, 2, 3));
        expect(a).toBe(b);
    });
});

// ---- Golden parity (python3 vs tsx) — byte-for-byte (pure template) ----
const py = hasPython3();
describe.skipIf(!py)('config/profile_explain — golden parity (python3 vs tsx)', () => {
    function pyRender(active: string[], c: number, s: number, h: number, mode: string): string {
        const driver =
            'import sys; sys.path.insert(0,"src");' +
            'from scripts.config import profile_explain as pe;' +
            `env=pe.build_profile_envelope(${JSON.stringify(active)}, ${c}, ${s}, ${h});` +
            `sys.stdout.write(pe.render_profile_overlay(env, mode=${JSON.stringify(mode)}))`;
        const res = runPy(['-c', driver]);
        expect(res.status).toBe(0);
        return res.stdout;
    }
    const cases: Array<[string[], number, number, number, string]> = [
        [[], 150, 227, 0, 'plain'],
        [[], 150, 227, 0, 'technical'],
        [['engineering-base'], 40, 60, 167, 'plain'],
        [['ops-people'], 30, 50, 100, 'technical'],
        [['finance-basic', 'finance-advanced'], 12, 20, 300, 'plain'],
    ];
    it.each(cases)('render(%j, %i, %i, %i, %s) matches', (active, c, s, h, mode) => {
        const ts = render_profile_overlay(build_profile_envelope(active, c, s, h), mode);
        expect(ts).toBe(pyRender(active, c, s, h, mode));
    });
    void REPO_ROOT;
});
