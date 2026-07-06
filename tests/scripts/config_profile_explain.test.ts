// Tests for src/scripts/config/profile_explain.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_profile_explain.py — the pure `profile-overlay`
// envelope + renderer. Pins plain + technical renders and proves the renderer
// never throws on a partial/missing-field envelope. Plus a golden-render
// block (python-free conversion of the retired python3 parity suite) pinning
// the full render output byte-for-byte via inline snapshots — the renderer
// is a pure template, fully deterministic and independent of repo state.
import { describe, expect, it } from 'vitest';

import {
    build_profile_envelope,
    render_profile_overlay,
} from '../../src/scripts/config/profile_explain.js';

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

// ---- Golden renders (python-free conversion of the retired parity block) ----
// Pure template → the full output is pinned byte-for-byte per case.
describe('config/profile_explain — golden renders (pinned)', () => {
    function render(active: string[], c: number, s: number, h: number, mode: string): string {
        return render_profile_overlay(build_profile_envelope(active, c, s, h), mode);
    }

    it('no overlay, plain', () => {
        expect(render([], 150, 227, 0, 'plain')).toMatchInlineSnapshot(`"Nothing is filtered — no profile is active, so you see every command and skill. The agent isn't hiding anything."`);
    });

    it('no overlay, technical', () => {
        expect(render([], 150, 227, 0, 'technical')).toMatchInlineSnapshot(`"profile-overlay: none active — full surface (no filtering)."`);
    });

    it('single overlay, plain', () => {
        expect(render(['engineering-base'], 40, 60, 167, 'plain')).toMatchInlineSnapshot(`
          "Why the surface looks different: a profile is active (engineering-base).
          It shows you 40 commands and 60 skills, and hides 167 behind packs you haven't turned on — that's why some commands aren't visible.
          Nothing is broken; the overlay just narrows the surface to this profile.
          It stays this way across sessions until you run \`/profile deactivate\`."
        `);
    });

    it('single overlay, technical', () => {
        expect(render(['ops-people'], 30, 50, 100, 'technical')).toMatchInlineSnapshot(`
          "profile-overlay: active=[ops-people]
            surfaced: commands=30 skills=50
            hidden:   100 (behind inactive packs)
            delta:    surface = full ∖ (artefacts whose packs ∉ active)
            staleness: persists across sessions (overlay has no timestamp)"
        `);
    });

    it('multi overlay, plain', () => {
        expect(
            render(['finance-basic', 'finance-advanced'], 12, 20, 300, 'plain'),
        ).toMatchInlineSnapshot(`
          "Why the surface looks different: a profile is active (finance-basic, finance-advanced).
          It shows you 12 commands and 20 skills, and hides 300 behind packs you haven't turned on — that's why some commands aren't visible.
          Nothing is broken; the overlay just narrows the surface to this profile.
          It stays this way across sessions until you run \`/profile deactivate\`."
        `);
    });
});
