/**
 * `doctor --json`'s `update_verdict` block — road-to-a-release-that-says-whether-it-needs-you
 * step 4.3: `classifyUpdate`'s verdict reported read-only, nothing acting on it.
 *
 * Two properties carry the step. The report is computed from the cached probe
 * state only: doctor never queries the registry for it, and never writes the
 * state file the banner reads. And the fields that cache does not hold — the
 * impact map, `engines`, the provenance attestation — are reported as unknowns,
 * so the verdict can never come out `auto` on what doctor cannot see.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    readCachedUpdateState,
    updateVerdictFor,
    updateVerdictJson,
    type UpdateVerdictSources,
} from '../../src/scripts/_cli/doctor_update_verdict.js';

const tmpRoots: string[] = [];

function mkTmp(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-update-verdict-'));
    tmpRoots.push(root);
    return root;
}

afterEach(() => {
    vi.restoreAllMocks();
    for (const r of tmpRoots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

const BASE: UpdateVerdictSources = {
    installed: '16.5.0',
    state: { last_check_utc: '2026-10-18T10:00:00Z', last_seen_version: '16.6.0' },
    origin: 'global',
    env: {},
    nodeVersion: 'v22.11.0',
    now: new Date('2026-10-18T12:00:00Z'),
    projectPin: null,
};

function verdict(patch: Partial<UpdateVerdictSources> = {}): Record<string, unknown> {
    return updateVerdictJson({ ...BASE, ...patch });
}

describe('updateVerdictJson', () => {
    it('reports the classifier verdict and its reasons for a newer cached candidate', () => {
        const v = verdict();
        expect(v['installed']).toBe('16.5.0');
        expect(v['candidate']).toBe('16.6.0');
        expect(v['origin']).toBe('global');
        expect(v['action']).toBe('notify');
        expect(v['reasons']).toEqual(
            expect.arrayContaining([
                'candidate declares no engines.node',
                'impact map unavailable',
                'provenance attestation missing',
                'update mode not set',
            ]),
        );
        expect(v['reporting_read_only']).toBe(true);
        expect(v['not_cached']).toEqual(['agentConfig.impact', 'engines', 'dist.attestations', 'time', 'deprecated']);
    });

    it('never reports auto: the inputs doctor cannot see stay unknowns', () => {
        for (const origin of ['global', 'project-pin', 'unknown'] as const) {
            for (const candidate of ['16.6.0', '17.0.0', '16.6.0-next.1']) {
                const v = verdict({ origin, state: { last_seen_version: candidate } });
                expect(v['action']).not.toBe('auto');
            }
        }
    });

    it('reports none, with the reason, when the probe has never cached a version', () => {
        for (const state of [{}, { last_seen_version: '' }, { last_seen_version: 42 }]) {
            const v = verdict({ state });
            expect(v['candidate']).toBeNull();
            expect(v['action']).toBe('none');
            expect(v['reasons']).toEqual(['no cached registry version: the update probe has not run']);
        }
    });

    it('reports none when the installed version is unreadable', () => {
        const v = verdict({ installed: null });
        expect(v['action']).toBe('none');
        expect(v['reasons']).toEqual(['installed version unreadable']);
    });

    it('mirrors the suppressions: CI, the opt-out and a source checkout', () => {
        expect(verdict({ env: { CI: 'true' } })['reasons']).toEqual(['suppressed: CI']);
        expect(verdict({ env: { GITHUB_ACTIONS: 'true' } })['reasons']).toEqual(['suppressed: CI']);
        expect(verdict({ env: { AGENT_CONFIG_NO_UPDATE_CHECK: '1' } })['reasons']).toEqual([
            'suppressed: AGENT_CONFIG_NO_UPDATE_CHECK=1',
        ]);
        expect(verdict({ origin: 'source-checkout' })['reasons']).toEqual(['suppressed: source checkout']);
        for (const env of [{ CI: 'true' }, { AGENT_CONFIG_NO_UPDATE_CHECK: '1' }]) {
            expect(verdict({ env })['action']).toBe('none');
        }
    });

    it('carries a project pin into the verdict as an uncertainty', () => {
        const v = verdict({ origin: 'project-pin', projectPin: '16.5.0' });
        expect(v['action']).toBe('notify');
        expect(v['reasons']).toEqual(expect.arrayContaining(['project pins 16.5.0']));
    });

    it('is not newer when the cached candidate is the installed version', () => {
        expect(verdict({ state: { last_seen_version: '16.5.0' } })['action']).toBe('none');
    });
});

describe('readCachedUpdateState', () => {
    it('reads the state file without writing it and without touching the network', () => {
        const dir = mkTmp();
        const file = path.join(dir, 'update-check.json');
        const body = JSON.stringify({ last_seen_version: '16.6.0' }, null, 2);
        fs.writeFileSync(file, body);
        const before = fs.statSync(file).mtimeMs;
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        expect(readCachedUpdateState(file)).toEqual({ last_seen_version: '16.6.0' });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(fs.readFileSync(file, 'utf-8')).toBe(body);
        expect(fs.statSync(file).mtimeMs).toBe(before);
    });

    it('treats a missing or corrupt file as an empty cache', () => {
        const dir = mkTmp();
        expect(readCachedUpdateState(path.join(dir, 'absent.json'))).toEqual({});
        expect(readCachedUpdateState(null)).toEqual({});
        const bad = path.join(dir, 'bad.json');
        fs.writeFileSync(bad, '{not json');
        expect(readCachedUpdateState(bad)).toEqual({});
        fs.writeFileSync(bad, '[1,2]');
        expect(readCachedUpdateState(bad)).toEqual({});
    });
});

describe('updateVerdictFor', () => {
    it('reads a package root carrying .git as a source checkout and reports none', () => {
        const pkg = mkTmp();
        fs.mkdirSync(path.join(pkg, '.git'));
        const v = updateVerdictFor(mkTmp(), pkg, '16.5.0');
        expect(v['origin']).toBe('source-checkout');
        expect(v['action']).toBe('none');
    });

    it('does not take a published tarball (dist/agent-src, no .git) for a source checkout', () => {
        const pkg = mkTmp();
        fs.mkdirSync(path.join(pkg, 'dist', 'agent-src'), { recursive: true });
        expect(updateVerdictFor(mkTmp(), pkg, '16.5.0')['origin']).not.toBe('source-checkout');
    });
});
