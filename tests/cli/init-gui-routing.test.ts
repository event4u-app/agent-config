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

import {
    shouldInitLaunchGui,
    buildInitGuiOptions,
    buildProjectInitDelegation,
    findInitGuiConflict,
    hasGuiFlag,
    withoutGuiFlag,
} from '../../src/cli/initRouting.js';
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
        ['--project'],
    ])('falls back to CLI when a CLI-mode flag is present: %s', (...flags) => {
        expect(shouldInitLaunchGui(flags)).toBe(false);
    });

    it('launches the GUI when only GUI-compatible flags are present', () => {
        expect(shouldInitLaunchGui(['--no-open', '--port', '5050', '--global'])).toBe(true);
    });

    // --gui: overrides the capability probes, never the intent guards
    // (road-to-zero-ceremony-install § Phase 1; AI council 2026-07-31 Q1/B).

    it('--gui launches the GUI even when stdout is not a TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
        expect(shouldInitLaunchGui(['--gui'])).toBe(true);
    });

    it('--gui launches the GUI even when stdin is not a TTY', () => {
        Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
        expect(shouldInitLaunchGui(['--gui'])).toBe(true);
    });

    it('--gui launches the GUI even on a headless host', () => {
        headlessMock.mockReturnValue(true);
        expect(shouldInitLaunchGui(['--gui'])).toBe(true);
    });

    it('--gui does NOT defeat CI', () => {
        process.env['CI'] = 'true';
        expect(shouldInitLaunchGui(['--gui'])).toBe(false);
    });

    it('--gui does NOT defeat AGENT_CONFIG_NO_UI', () => {
        process.env['AGENT_CONFIG_NO_UI'] = '1';
        expect(shouldInitLaunchGui(['--gui'])).toBe(false);
    });

    it('--gui does NOT defeat a CLI-mode flag', () => {
        expect(shouldInitLaunchGui(['--gui', '--no-ui'])).toBe(false);
    });

    it('a bare init on a non-TTY still falls back — --gui changes no default', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
        expect(shouldInitLaunchGui([])).toBe(false);
    });
});

describe('findInitGuiConflict', () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ['CI', 'AGENT_CONFIG_NO_UI']) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of ['CI', 'AGENT_CONFIG_NO_UI']) {
            if (savedEnv[key] === undefined) delete process.env[key];
            else process.env[key] = savedEnv[key];
        }
    });

    it('GREEN: no --gui, no conflict', () => {
        expect(findInitGuiConflict(['--no-ui'])).toBeNull();
    });

    it('GREEN: --gui alone is not a conflict', () => {
        expect(findInitGuiConflict(['--gui'])).toBeNull();
    });

    it.each([
        ['--no-ui'],
        ['--tools=cursor'],
        ['--yes'],
        ['-q'],
        ['--project'],
        ['--fleet'],
    ])('RED: --gui with the CLI-mode flag %s is a conflict', (flag) => {
        const conflict = findInitGuiConflict(['--gui', flag]);
        expect(conflict).toContain('--gui conflicts with');
        expect(conflict).toContain(flag.split('=', 1)[0] as string);
    });

    it('RED: --gui under CI is a conflict', () => {
        process.env['CI'] = 'true';
        expect(findInitGuiConflict(['--gui'])).toContain('CI=true');
    });

    it('GREEN: CI=0 is not CI, so --gui is fine', () => {
        process.env['CI'] = '0';
        expect(findInitGuiConflict(['--gui'])).toBeNull();
    });

    it('RED: --gui under AGENT_CONFIG_NO_UI is a conflict', () => {
        process.env['AGENT_CONFIG_NO_UI'] = '1';
        expect(findInitGuiConflict(['--gui'])).toContain('AGENT_CONFIG_NO_UI=1');
    });

    it('a losing --gui is impossible: whenever the routing says no, a conflict was reported', () => {
        process.env['CI'] = 'true';
        expect(shouldInitLaunchGui(['--gui'])).toBe(false);
        expect(findInitGuiConflict(['--gui'])).not.toBeNull();
    });
});

describe('hasGuiFlag / withoutGuiFlag', () => {
    it('detects --gui anywhere in the args', () => {
        expect(hasGuiFlag([])).toBe(false);
        expect(hasGuiFlag(['--global', '--gui'])).toBe(true);
    });

    it('strips every --gui token before bash delegation', () => {
        expect(withoutGuiFlag(['init', '--gui', '--global'])).toEqual(['init', '--global']);
        expect(withoutGuiFlag(['init', '--gui', '--gui'])).toEqual(['init']);
    });

    it('leaves args without --gui untouched', () => {
        expect(withoutGuiFlag(['init', '--global'])).toEqual(['init', '--global']);
    });

    it('never leaves a --gui token that the bash installer would reject', () => {
        expect(withoutGuiFlag(['init', '--gui', '--tools=cursor']).includes('--gui')).toBe(false);
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

describe('buildProjectInitDelegation', () => {
    it('returns null without --project', () => {
        expect(buildProjectInitDelegation([])).toBeNull();
        expect(buildProjectInitDelegation(['--no-open'])).toBeNull();
    });

    it('routes --project to refresh --project', () => {
        expect(buildProjectInitDelegation(['--project'])).toEqual(['refresh', '--project']);
    });

    it('forwards remaining args after stripping --project', () => {
        expect(buildProjectInitDelegation(['--project', '--dry-run'])).toEqual([
            'refresh', '--project', '--dry-run',
        ]);
    });
});
