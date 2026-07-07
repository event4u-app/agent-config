import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as ags from '../../../src/agent-src/templates/scripts/work_engine/_lib/agent_settings';

const tmp_dirs: string[] = [];

function write_tmp_yaml(body: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'we-dp-test-')));
    tmp_dirs.push(dir);
    const p = path.join(dir, 'host-capabilities.yml');
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

afterEach(() => {
    for (const d of tmp_dirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

const CAPS_MEASURED: ags.HostCapabilities = {
    lift_disabled_models: ['claude-sonnet-4-6'],
    unknown_default: 'lift_enabled',
};

describe('load_host_capabilities', () => {
    it('parses mapping entries (id + measured provenance) and unknown_default', () => {
        const p = write_tmp_yaml(
            [
                'lift_disabled_models:',
                '  - id: claude-sonnet-4-6',
                '    measured: "2026-07-05 · report · n=84"',
                '  - plain-string-model',
                'unknown_default: lift_enabled',
            ].join('\n'),
        );
        const caps = ags.load_host_capabilities(p);
        expect(caps.lift_disabled_models).toEqual(['claude-sonnet-4-6', 'plain-string-model']);
        expect(caps.unknown_default).toBe('lift_enabled');
    });

    it('missing file → fail-safe fallback (empty list, lift_enabled)', () => {
        const caps = ags.load_host_capabilities('/nonexistent/host-capabilities.yml');
        expect(caps.lift_disabled_models).toEqual([]);
        expect(caps.unknown_default).toBe('lift_enabled');
    });

    it('the shipped src/config/host-capabilities.yml loads and contains only measured entries', () => {
        const repo_root = path.resolve(__dirname, '..', '..', '..');
        const caps = ags.load_host_capabilities(path.join(repo_root, 'src', 'config', 'host-capabilities.yml'));
        expect(caps.lift_disabled_models).toContain('claude-sonnet-4-6');
        expect(caps.unknown_default).toBe('lift_enabled');
        // Council lock: every entry carries measured/extrapolated provenance.
        const raw = fs.readFileSync(path.join(repo_root, 'src', 'config', 'host-capabilities.yml'), 'utf-8');
        const entry_count = caps.lift_disabled_models.length;
        const provenance_count = (raw.match(/^\s+(measured|extrapolated):/gm) ?? []).length;
        expect(provenance_count).toBeGreaterThanOrEqual(entry_count);
    });
});

describe('resolve_discipline_profile', () => {
    it('explicit off/essential/full win over everything', () => {
        for (const v of ['off', 'essential', 'full'] as const) {
            expect(
                ags.resolve_discipline_profile(
                    { discipline_profile: v, rule_loading_tier: 'minimal' },
                    'claude-sonnet-4-6',
                    CAPS_MEASURED,
                ),
            ).toBe(v);
        }
    });

    it('auto: measured NULL-lift model → off', () => {
        expect(
            ags.resolve_discipline_profile({ discipline_profile: 'auto' }, 'claude-sonnet-4-6', CAPS_MEASURED),
        ).toBe('off');
        // prefix match: dated/full model ids of the measured family also match
        expect(
            ags.resolve_discipline_profile(
                { discipline_profile: 'auto' },
                'claude-sonnet-4-6-20260701',
                CAPS_MEASURED,
            ),
        ).toBe('off');
    });

    it('auto: unknown or missing model id → essential (fail-safe lift_enabled)', () => {
        expect(
            ags.resolve_discipline_profile({ discipline_profile: 'auto' }, 'gpt-4o-mini', CAPS_MEASURED),
        ).toBe('essential');
        expect(ags.resolve_discipline_profile({ discipline_profile: 'auto' }, null, CAPS_MEASURED)).toBe(
            'essential',
        );
    });

    it('legacy rule_loading_tier maps when discipline_profile is absent', () => {
        expect(ags.resolve_discipline_profile({ rule_loading_tier: 'minimal' }, null, CAPS_MEASURED)).toBe('off');
        expect(ags.resolve_discipline_profile({ rule_loading_tier: 'balanced' }, null, CAPS_MEASURED)).toBe(
            'essential',
        );
        expect(ags.resolve_discipline_profile({ rule_loading_tier: 'full' }, null, CAPS_MEASURED)).toBe('full');
        expect(ags.resolve_discipline_profile({ rule_loading_tier: 'custom' }, null, CAPS_MEASURED)).toBe('custom');
    });

    it('both keys absent → essential (successor of the documented balanced default)', () => {
        expect(ags.resolve_discipline_profile({}, null, CAPS_MEASURED)).toBe('essential');
    });
});
