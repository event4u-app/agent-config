/**
 * The update banner names the command that does what it says, per install origin.
 *
 * `upgrade` replaces the global binary; `update` flips a project pin; an ephemeral
 * `npx` run and an origin nobody enumerated get no command line at all.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _format_banner,
    check_for_update,
    classify_install_origin,
    type InstallOrigin,
} from '../../src/scripts/_lib/update_check';
import { _detect_origin } from '../../src/scripts/check_update_banner';

const GLOBAL_ROOT = '/usr/local/lib/node_modules/@event4u/agent-config';
const WINDOWS_GLOBAL_ROOT = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\@event4u\\agent-config';
const NPX_ROOT = '/Users/dev/.npm/_npx/0a1b2c3d/node_modules/@event4u/agent-config';
const LOCAL_ROOT = '/work/app/node_modules/@event4u/agent-config';
const CHECKOUT_ROOT = '/work/agent-config';

function command_line(banner: string): string | null {
    const lines = banner.split('\n');
    return lines.length > 1 ? (lines[1] ?? '').trim() : null;
}

describe('classify_install_origin', () => {
    it.each<[string, Parameters<typeof classify_install_origin>[0], InstallOrigin]>([
        ['global npm tree', { package_root: GLOBAL_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: false }, 'global'],
        ['global npm tree on Windows', { package_root: WINDOWS_GLOBAL_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: false }, 'global'],
        ['global-only consumer marker', { package_root: CHECKOUT_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: true }, 'global'],
        ['pinned project running from the npx cache', { package_root: NPX_ROOT, project_pin: '1.0.0', latest: '2.0.0', is_global_consumer: false }, 'project-pin'],
        ['ephemeral npx run', { package_root: NPX_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: false }, 'ephemeral'],
        ['ephemeral npx run inside a global consumer', { package_root: NPX_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: true }, 'ephemeral'],
        ['project-local dependency', { package_root: LOCAL_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: false }, 'unknown'],
        ['source checkout', { package_root: CHECKOUT_ROOT, project_pin: null, latest: '2.0.0', is_global_consumer: false }, 'unknown'],
    ])('%s', (_label, signals, expected) => {
        expect(classify_install_origin(signals)).toBe(expected);
    });
});

describe('a project pin earns `update` only while the registry is ahead of it', () => {
    // `agent-config update` moves the pin, not the running executable, so the
    // comparison that matters is latest-vs-pin.
    it.each<[string, string, InstallOrigin]>([
        ['pin behind latest', '1.0.0', 'project-pin'],
        ['pin equal to latest', '2.0.0', 'unknown'],
        ['pin ahead of latest', '3.0.0', 'unknown'],
        ['v-prefixed pin equal to latest', 'v2.0.0', 'unknown'],
    ])('%s', (_label, pin, expected) => {
        expect(
            classify_install_origin({
                package_root: NPX_ROOT,
                project_pin: pin,
                latest: '2.0.0',
                is_global_consumer: false,
            }),
        ).toBe(expected);
    });

    it('a pin with no known latest is not called behind', () => {
        expect(
            classify_install_origin({ package_root: NPX_ROOT, project_pin: '1.0.0', latest: null, is_global_consumer: false }),
        ).toBe('unknown');
    });
});

describe('_detect_origin reads the pin from a real settings file', () => {
    let project: string;

    beforeEach(() => {
        project = fs.mkdtempSync(path.join(os.tmpdir(), 'update-check-pin-'));
    });

    afterEach(() => {
        fs.rmSync(project, { recursive: true, force: true });
    });

    it.each<[string, InstallOrigin]>([
        ['1.0.0', 'project-pin'],
        ['2.0.0', 'unknown'],
        ['3.0.0', 'unknown'],
    ])('pin %s against latest 2.0.0', (pin, expected) => {
        fs.writeFileSync(path.join(project, '.agent-settings.yml'), `agent_config_version: "${pin}"\n`, 'utf-8');
        expect(_detect_origin(NPX_ROOT, project, '2.0.0')).toBe(expected);
    });

    it('no settings file in an npx run is ephemeral', () => {
        expect(_detect_origin(NPX_ROOT, project, '2.0.0')).toBe('ephemeral');
    });
});

describe('_format_banner names one command per origin', () => {
    it('global → upgrade', () => {
        expect(command_line(_format_banner('2.0.0', '1.0.0', 'global'))).toBe('Update: agent-config upgrade');
    });

    it('project pin → update', () => {
        expect(command_line(_format_banner('2.0.0', '1.0.0', 'project-pin'))).toBe('Update: agent-config update');
    });

    it.each<InstallOrigin>(['ephemeral', 'unknown'])('%s → notice only, no command line', (origin) => {
        const banner = _format_banner('2.0.0', '1.0.0', origin);
        expect(banner).toBe('ℹ️  agent-config 2.0.0 available (you have 1.0.0).');
        expect(banner).not.toMatch(/Update:|upgrade|update$/);
    });

    it('omitted origin is unknown, never a guessed command', () => {
        expect(command_line(_format_banner('2.0.0', '1.0.0'))).toBeNull();
    });
});

describe('check_for_update threads the origin into the banner', () => {
    let tmp_dir: string;

    beforeEach(() => {
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-check-origin-'));
    });

    afterEach(() => {
        fs.rmSync(tmp_dir, { recursive: true, force: true });
    });

    it.each<[InstallOrigin, string | null]>([
        ['global', 'Update: agent-config upgrade'],
        ['project-pin', 'Update: agent-config update'],
        ['ephemeral', null],
        ['unknown', null],
    ])('%s', async (origin, expected) => {
        const banner = await check_for_update('1.0.0', {
            now: new Date(Date.UTC(2026, 9, 16, 9, 0, 0)),
            state_path: path.join(tmp_dir, `${origin}.json`),
            env: {},
            is_tty: true,
            fetcher: () => '2.0.0',
            origin,
        });
        expect(banner).not.toBeNull();
        expect(command_line(banner as string)).toBe(expected);
    });

    it.each<[string, string | null]>([
        ['1.5.0', 'Update: agent-config update'],
        ['2.0.0', null],
        ['2.1.0', null],
    ])('an origin resolver sees the fetched latest (pin %s)', async (pin, expected) => {
        const banner = await check_for_update('1.0.0', {
            now: new Date(Date.UTC(2026, 9, 16, 9, 0, 0)),
            state_path: path.join(tmp_dir, `resolver-${pin}.json`),
            env: {},
            is_tty: true,
            fetcher: () => '2.0.0',
            origin: (latest) =>
                classify_install_origin({ package_root: NPX_ROOT, project_pin: pin, latest, is_global_consumer: false }),
        });
        expect(banner).not.toBeNull();
        expect(command_line(banner as string)).toBe(expected);
    });
});
