/**
 * Installer settings-surface snapshot + upgrade delta
 * (road-to-settings-change-review).
 *
 * Every global install writes `state/settings-surface.json` (the
 * flattened live Zod schema + package version). When a PREVIOUS snapshot
 * from a DIFFERENT version exists, the semantic delta lands in
 * `state/settings-delta.json` — the pending-review flag the GUI banner,
 * the review page, and doctor consume. Root override via
 * `EVENT4U_CONFIG_HOME` keeps the test hermetic.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    _write_settings_surface_snapshot,
    _current_settings_surface,
    state,
} from '../../src/scripts/install.js';
import type { SettingsSurface, SurfaceDelta } from '../../src/shared/settingsSurface.js';

let root: string;
let prevEnv: string | undefined;
let prevQuiet: boolean;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'e4u-surface-'));
    prevEnv = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = root;
    prevQuiet = state.QUIET;
    state.QUIET = true;
});
afterEach(() => {
    if (prevEnv === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = prevEnv;
    state.QUIET = prevQuiet;
    rmSync(root, { recursive: true, force: true });
});

function surfacePath(): string {
    return join(root, 'state', 'settings-surface.json');
}
function deltaPath(): string {
    return join(root, 'state', 'settings-delta.json');
}
function readSurface(): SettingsSurface {
    return JSON.parse(readFileSync(surfacePath(), 'utf8')) as SettingsSurface;
}

describe('_current_settings_surface', () => {
    it('flattens the live Zod schema to dotted leaves with defaults', () => {
        const s = _current_settings_surface('9.9.9');
        expect(s.version).toBe('9.9.9');
        expect(s.entries['personal.autonomy']).toBeDefined();
        expect(s.entries['personal.autonomy']?.enum).toContain('auto');
        expect(Object.keys(s.entries).length).toBeGreaterThan(20);
    });
});

describe('_write_settings_surface_snapshot', () => {
    it('first run seeds the snapshot only — no delta (council Q1)', () => {
        _write_settings_surface_snapshot('9.9.9');
        expect(existsSync(surfacePath())).toBe(true);
        expect(existsSync(deltaPath())).toBe(false);
        expect(readSurface().version).toBe('9.9.9');
    });

    it('same-version re-install refreshes the snapshot, no delta', () => {
        _write_settings_surface_snapshot('9.9.9');
        _write_settings_surface_snapshot('9.9.9');
        expect(existsSync(deltaPath())).toBe(false);
    });

    it('upgrade with a changed surface writes the delta and refreshes the snapshot', () => {
        // Seed an OLD snapshot: same live schema, but doctor one entry so a
        // default_changed + removed key show up against the live surface.
        const old = _current_settings_surface('9.0.0');
        const doctored: SettingsSurface = {
            version: '9.0.0',
            entries: {
                ...old.entries,
                'personal.autonomy': { ...(old.entries['personal.autonomy'] ?? { type: 'string' }), default: 'LEGACY' },
                'legacy.only_key': { type: 'string', default: 'x' },
            },
        };
        mkdirSync(join(root, 'state'), { recursive: true });
        writeFileSync(surfacePath(), JSON.stringify(doctored));

        _write_settings_surface_snapshot('9.9.9');

        expect(existsSync(deltaPath())).toBe(true);
        const delta = JSON.parse(readFileSync(deltaPath(), 'utf8')) as SurfaceDelta;
        expect(delta.oldVersion).toBe('9.0.0');
        expect(delta.newVersion).toBe('9.9.9');
        const kinds = delta.changes.map((c) => `${c.key}:${c.kind}`);
        expect(kinds).toContain('personal.autonomy:default_changed');
        expect(kinds).toContain('legacy.only_key:removed');
        // Snapshot advanced to the new surface.
        expect(readSurface().version).toBe('9.9.9');
        expect(readSurface().entries['personal.autonomy']?.default).not.toBe('LEGACY');
    });

    it('version bump with an IDENTICAL surface writes no delta', () => {
        const old = _current_settings_surface('9.0.0');
        mkdirSync(join(root, 'state'), { recursive: true });
        writeFileSync(surfacePath(), JSON.stringify(old));
        _write_settings_surface_snapshot('9.9.9');
        expect(existsSync(deltaPath())).toBe(false);
        expect(readSurface().version).toBe('9.9.9');
    });

    it('a corrupt existing snapshot degrades to seed-only, never throws', () => {
        mkdirSync(join(root, 'state'), { recursive: true });
        writeFileSync(surfacePath(), '{corrupt');
        expect(() => { _write_settings_surface_snapshot('9.9.9'); }).not.toThrow();
        expect(readSurface().version).toBe('9.9.9');
        expect(existsSync(deltaPath())).toBe(false);
    });
});
