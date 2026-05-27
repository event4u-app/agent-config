/**
 * Tests for `init` install-front-end routing
 * (road-to-single-install-source-of-truth § Phase 4 follow-up).
 *
 * `shouldInitLaunchGui` decides GUI vs bash-CLI install; `buildInitGuiOptions`
 * maps the GUI-compatible flag subset onto `runUiServe` options.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `isHeadless` reads SSH/DISPLAY env — mock it so the GUI-capable baseline is
// deterministic on Linux CI runners (which have no DISPLAY).
vi.mock('../../src/cli/commands/uiServe.js', () => ({
    isHeadless: vi.fn(() => false),
    runUiServe: vi.fn(),
}));

import { shouldInitLaunchGui, buildInitGuiOptions } from '../../src/cli/initRouting.js';
import { isHeadless } from '../../src/cli/commands/uiServe.js';

const headlessMock = vi.mocked(isHeadless);

describe('shouldInitLaunchGui', () => {
    let stdinTTY: boolean | undefined;
    let stdoutTTY: boolean | undefined;
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // GUI-capable baseline: interactive TTY, no CI / NO_UI, not headless.
        stdinTTY = process.stdin.isTTY;
        stdoutTTY = process.stdout.isTTY;
        Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
        Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
        for (const key of ['CI', 'AGENT_CONFIG_NO_UI']) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
        headlessMock.mockReturnValue(false);
    });

    afterEach(() => {
        Object.defineProperty(process.stdin, 'isTTY', { value: stdinTTY, configurable: true });
        Object.defineProperty(process.stdout, 'isTTY', { value: stdoutTTY, configurable: true });
        for (const key of ['CI', 'AGENT_CONFIG_NO_UI']) {
            if (savedEnv[key] === undefined) delete process.env[key];
            else process.env[key] = savedEnv[key];
        }
        vi.clearAllMocks();
    });

    it('launches the GUI for a bare interactive init', () => {
        expect(shouldInitLaunchGui([])).toBe(true);
    });

    it('falls back to CLI when CI is set', () => {
        process.env['CI'] = 'true';
        expect(shouldInitLaunchGui([])).toBe(false);
    });

    it('CI=0 does not count as CI', () => {
        process.env['CI'] = '0';
        expect(shouldInitLaunchGui([])).toBe(true);
    });

    it('falls back to CLI when AGENT_CONFIG_NO_UI is set', () => {
        process.env['AGENT_CONFIG_NO_UI'] = '1';
        expect(shouldInitLaunchGui([])).toBe(false);
    });

    it('falls back to CLI when stdout is not a TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
        expect(shouldInitLaunchGui([])).toBe(false);
    });

    it('falls back to CLI on a headless host', () => {
        headlessMock.mockReturnValue(true);
        expect(shouldInitLaunchGui([])).toBe(false);
    });

    it.each([
        ['--no-ui'],
        ['--tools', 'cursor'],
        ['--tools=cursor'],
        ['--ai', 'cursor'],
        ['--yes'],
        ['-y'],
        ['--quiet'],
        ['--dry-run'],
        ['--minimal'],
        ['--settings-only'],
        ['--list-tools'],
    ])('falls back to CLI when a CLI-mode flag is present: %s', (...flags) => {
        expect(shouldInitLaunchGui(flags)).toBe(false);
    });

    it('launches the GUI when only GUI-compatible flags are present', () => {
        expect(shouldInitLaunchGui(['--no-open', '--port', '5050', '--global'])).toBe(true);
    });
});

describe('buildInitGuiOptions', () => {
    it('defaults to the install-wizard route', () => {
        expect(buildInitGuiOptions([])).toMatchObject({
            initialRoute: '/wizard',
            extendedSteps: true,
            initialStep: 0,
            wizardMode: 'install',
        });
    });

    it('maps --no-open to open:false', () => {
        expect(buildInitGuiOptions(['--no-open']).open).toBe(false);
    });

    it('parses --port (space and = forms)', () => {
        expect(buildInitGuiOptions(['--port', '5050']).port).toBe(5050);
        expect(buildInitGuiOptions(['--port=6060']).port).toBe(6060);
    });

    it('ignores a non-numeric --port', () => {
        expect(buildInitGuiOptions(['--port', 'abc']).port).toBeUndefined();
    });

    it('parses --project-root and --allow-headless', () => {
        const opts = buildInitGuiOptions(['--project-root', '/tmp/proj', '--allow-headless']);
        expect(opts.projectRoot).toBe('/tmp/proj');
        expect(opts.allowHeadless).toBe(true);
    });
});
