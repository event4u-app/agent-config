// Tests for src/scripts/config/presets.ts (py2ts Phase 8).
//
// 1:1 port of tests/test_config_presets.py — the resolution chain
// (profile → pack → user → env → runtime, last writer wins), per-knob
// overrides, unknown-id error, default fallback. Plus a golden-structure
// block (python-free conversion of the retired python3 parity suite)
// asserting the resolved-knob bag is deterministic and JSON-clean.
import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_PRESET_ID,
    PRESET_ID_ENV,
    PresetError,
    SEED_PRESET_IDS,
    SOURCE_DEFAULT,
    SOURCE_ENV,
    SOURCE_PACK,
    SOURCE_PROFILE,
    SOURCE_RUNTIME,
    SOURCE_USER,
    resolve_preset,
} from '../../src/scripts/config/presets.js';
import { REPO_ROOT } from './_config_parity.js';

const SEED_ROOT = REPO_ROOT;

// Snapshot + restore env keys the tests mutate (mirrors monkeypatch.setenv).
const _ENV_KEYS = [
    PRESET_ID_ENV,
    'AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD',
];
const _saved: Record<string, string | undefined> = {};
afterEach(() => {
    for (const k of _ENV_KEYS) {
        if (_saved[k] === undefined) delete process.env[k];
        else process.env[k] = _saved[k];
        delete _saved[k];
    }
});
function setEnv(key: string, value: string): void {
    if (!(key in _saved)) _saved[key] = process.env[key];
    process.env[key] = value;
}

describe('config/presets — resolution chain', () => {
    it('seed set complete', () => {
        for (const preset_id of SEED_PRESET_IDS) {
            const r = resolve_preset({ project_root: SEED_ROOT, runtime_id: preset_id });
            expect(r.id).toBe(preset_id);
        }
    });

    it.each([...SEED_PRESET_IDS])('each seed preset resolves: %s', (preset_id) => {
        const r = resolve_preset({ project_root: SEED_ROOT, runtime_id: preset_id });
        expect(r.id).toBe(preset_id);
        expect(r.source).toBe(SOURCE_RUNTIME);
        expect('autonomy' in r.knobs).toBe(true);
        expect('cost' in r.knobs).toBe(true);
        expect(r.knobs['cost']['daily_max_usd']).toBeGreaterThan(0);
    });

    it('default when nothing specified', () => {
        const r = resolve_preset({ project_root: SEED_ROOT });
        expect(r.id).toBe(DEFAULT_PRESET_ID);
        expect(r.source).toBe(SOURCE_DEFAULT);
    });

    it('profile preset id wins over default', () => {
        const r = resolve_preset({ project_root: SEED_ROOT, profile_preset_id: 'fast' });
        expect(r.id).toBe('fast');
        expect(r.source).toBe(SOURCE_PROFILE);
    });

    it('pack wins over profile', () => {
        const r = resolve_preset({
            project_root: SEED_ROOT,
            pack_preset_id: 'strict',
            profile_preset_id: 'fast',
        });
        expect(r.id).toBe('strict');
        expect(r.source).toBe(SOURCE_PACK);
    });

    it('user settings win over pack', () => {
        const r = resolve_preset({
            project_root: SEED_ROOT,
            pack_preset_id: 'strict',
            profile_preset_id: 'fast',
            user_settings: { preset: { id: 'balanced' } },
        });
        expect(r.id).toBe('balanced');
        expect(r.source).toBe(SOURCE_USER);
    });

    it('env wins over user', () => {
        setEnv(PRESET_ID_ENV, 'strict');
        const r = resolve_preset({
            project_root: SEED_ROOT,
            user_settings: { preset: { id: 'balanced' } },
        });
        expect(r.id).toBe('strict');
        expect(r.source).toBe(SOURCE_ENV);
    });

    it('runtime wins over env', () => {
        setEnv(PRESET_ID_ENV, 'strict');
        const r = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'fast' });
        expect(r.id).toBe('fast');
        expect(r.source).toBe(SOURCE_RUNTIME);
    });

    it('unknown preset id raises', () => {
        expect(() =>
            resolve_preset({ project_root: SEED_ROOT, runtime_id: 'not_a_real_preset' }),
        ).toThrow(PresetError);
    });

    it('user per-knob override', () => {
        const r = resolve_preset({
            project_root: SEED_ROOT,
            runtime_id: 'balanced',
            user_settings: { preset: { cost: { daily_max_usd: 7.5 } } },
        });
        expect(r.knobs['cost']['daily_max_usd']).toBe(7.5);
        expect(r.overrides).toContain('cost.daily_max_usd');
        // Untouched knobs keep their seed values.
        expect(r.knobs['cost']['weekly_max_usd']).toBe(50.0);
    });

    it('env per-knob override', () => {
        setEnv('AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD', '3.50');
        const r = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'balanced' });
        expect(r.knobs['cost']['daily_max_usd']).toBe(3.5);
        expect(r.overrides).toContain('cost.daily_max_usd');
    });

    it('runtime per-knob override', () => {
        const r = resolve_preset({
            project_root: SEED_ROOT,
            runtime_id: 'balanced',
            runtime_overrides: new Map([[['cost', 'daily_max_usd'], 0.99]]),
        });
        expect(r.knobs['cost']['daily_max_usd']).toBe(0.99);
        expect(r.overrides).toContain('cost.daily_max_usd');
    });

    it('strict blocks more risk categories', () => {
        const strict = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'strict' });
        const fast = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'fast' });
        expect(strict.knobs['risk']['block_on'].length).toBeGreaterThan(
            fast.knobs['risk']['block_on'].length,
        );
    });

    it('fast has higher daily cap than strict', () => {
        const fast = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'fast' });
        const strict = resolve_preset({ project_root: SEED_ROOT, runtime_id: 'strict' });
        expect(fast.knobs['cost']['daily_max_usd']).toBeGreaterThan(
            strict.knobs['cost']['daily_max_usd'],
        );
    });
});

// ---- Golden structure (python-free conversion of the retired parity block) ----
// The resolved knob bag comes from the live seed YAMLs, so exact values are
// repo state — asserted structurally (deterministic, JSON-clean, plain data)
// rather than pinned byte-for-byte.
describe('config/presets — golden structure (tsx resolved-knob bag)', () => {
    it.each([...SEED_PRESET_IDS])('resolved knobs deterministic + JSON-clean for %s', (preset_id) => {
        const r = resolve_preset({ project_root: REPO_ROOT, runtime_id: preset_id });
        const ts = { id: r.id, source: r.source, knobs: r.knobs };
        expect(ts.id).toBe(preset_id);
        expect(ts.source).toBe(SOURCE_RUNTIME);
        // JSON round-trip is lossless — the knob bag holds only plain JSON
        // values (no undefined / NaN / class instances leak into the bag).
        expect(JSON.parse(JSON.stringify(ts))).toEqual(ts);
        // Repeat resolution is deterministic — same shape, same values.
        const again = resolve_preset({ project_root: REPO_ROOT, runtime_id: preset_id });
        expect({ id: again.id, source: again.source, knobs: again.knobs }).toEqual(ts);
    });
});
