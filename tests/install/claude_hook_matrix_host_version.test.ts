// road-to-a-tick-the-shipped-path-earns 5.7: a native event the host accepts only
// from a recorded version on is not written for a host known to be older.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    build_claude_hook_matrix,
    min_host_versions,
    parse_host_version,
} from '../../src/scripts/_lib/claude_settings_hooks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(HERE, '..', '..', 'src', 'scripts', 'hook_manifest.yaml');

describe('StopFailure binding gated on the oldest host version recorded as accepting it', () => {
    it('records 2.1.308 for StopFailure, the one observation', () => {
        expect(min_host_versions(MANIFEST)['StopFailure']).toBe('2.1.308');
    });

    it('emits no StopFailure key for a host below the recorded version', () => {
        for (const v of ['2.1.307', '2.1.0', '1.9.999', '2.1.307 (Claude Code)']) {
            expect(Object.keys(build_claude_hook_matrix(MANIFEST, { hostVersion: v }))).not.toContain('StopFailure');
        }
    });

    it('emits it at and above the recorded version', () => {
        for (const v of ['2.1.308', '2.1.308 (Claude Code)', '2.1.400', '2.2.0', '3.0.0']) {
            expect(Object.keys(build_claude_hook_matrix(MANIFEST, { hostVersion: v }))).toContain('StopFailure');
        }
    });

    it('withholds it when the installer could not read the version', () => {
        for (const v of [null, 'unknown', 'not a version']) {
            expect(Object.keys(build_claude_hook_matrix(MANIFEST, { hostVersion: v }))).not.toContain('StopFailure');
        }
    });

    it('keeps it for the static plugin carrier, which has no host to ask', () => {
        expect(Object.keys(build_claude_hook_matrix(MANIFEST))).toContain('StopFailure');
    });

    it('leaves every ungated event alone below the gate', () => {
        const below = Object.keys(build_claude_hook_matrix(MANIFEST, { hostVersion: '2.1.0' }));
        const all = Object.keys(build_claude_hook_matrix(MANIFEST)).filter((k) => !(k in min_host_versions(MANIFEST)));
        expect(below.sort()).toEqual(all.sort());
    });

    it('parses the host version line', () => {
        expect(parse_host_version('2.1.308 (Claude Code)')).toEqual([2, 1, 308]);
        expect(parse_host_version('unknown')).toBeNull();
        expect(parse_host_version(null)).toBeNull();
    });
});

describe('a withheld event loses the managed entry an earlier install wrote', () => {
    it('strips only the managed group and keeps the user group', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const { ensure_managed_hooks } = await import('../../src/scripts/_lib/claude_settings_hooks.js');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-gate-'));
        const file = path.join(dir, 'settings.json');
        const full = build_claude_hook_matrix(MANIFEST, { hostVersion: '2.1.308' });
        ensure_managed_hooks(file, full);
        const before = JSON.parse(fs.readFileSync(file, 'utf8'));
        before.hooks.StopFailure.unshift({ hooks: [{ type: 'command', command: 'echo mine' }] });
        fs.writeFileSync(file, JSON.stringify(before));
        const res = ensure_managed_hooks(file, build_claude_hook_matrix(MANIFEST, { hostVersion: '2.1.0' }), ['StopFailure']);
        const after = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(res.events).toContain('StopFailure');
        expect(after.hooks.StopFailure).toEqual([{ hooks: [{ type: 'command', command: 'echo mine' }] }]);
        ensure_managed_hooks(file, full);
        after.hooks.StopFailure = JSON.parse(fs.readFileSync(file, 'utf8')).hooks.StopFailure.slice(1);
        fs.writeFileSync(file, JSON.stringify(after));
        ensure_managed_hooks(file, build_claude_hook_matrix(MANIFEST, { hostVersion: '2.1.0' }), ['StopFailure']);
        expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks).not.toHaveProperty('StopFailure');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
