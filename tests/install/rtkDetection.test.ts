/**
 * Regression tests for the rtk (Rust Token Killer) two-stage detection —
 * born from two confirmed-red bugs (fixes already implemented):
 *
 *   Bug 1 (dead URL): the old code pointed at
 *     `https://github.com/event4u-app/rtk` (does not resolve) and
 *     `cargo install --git <that url>` for linux/win32. Fixed: the real
 *     upstream `https://github.com/rtk-ai/rtk`, verified per-OS commands.
 *   Bug 2 (false positive): the old code used a filename-only PATH check,
 *     so ANY binary named `rtk` (e.g. the unrelated Rust Type Kit) was
 *     reported installed. Fixed: a two-stage probe (presence + `rtk gain`
 *     output-signature identity), four states.
 *
 * See src/install/rtkDetection.ts for the module under test.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RTK_UPSTREAM_REPO,
    classifyGainOutput,
    detectRtk,
    detectRtkCached,
    resolveBinaryOnPath,
    rtkInstallCommands,
    type ProbeResult,
} from '../../src/install/rtkDetection.js';

/** Write an executable stub file (POSIX mode bits) and return its path. */
function writeExecutable(dir: string, name: string, contents: string): string {
    const filePath = join(dir, name);
    writeFileSync(filePath, contents, 'utf-8');
    chmodSync(filePath, 0o755);
    return filePath;
}

describe('resolveBinaryOnPath', () => {
    let binDir: string;

    beforeEach(() => {
        binDir = mkdtempSync(join(tmpdir(), 'rtk-resolve-'));
    });
    afterEach(() => {
        rmSync(binDir, { recursive: true, force: true });
    });

    it('returns null for an empty PATH string', () => {
        expect(resolveBinaryOnPath('rtk', '')).toBeNull();
    });

    it('returns null for a nonexistent PATH directory', () => {
        const missing = join(binDir, 'does-not-exist');
        expect(resolveBinaryOnPath('rtk', missing)).toBeNull();
    });

    it('returns null when the PATH directory exists but has no matching binary', () => {
        expect(resolveBinaryOnPath('rtk', binDir)).toBeNull();
    });

    it('resolves an executable stub placed on a fake PATH string', () => {
        const stub = writeExecutable(binDir, 'rtk', '#!/bin/sh\nexit 0\n');
        expect(resolveBinaryOnPath('rtk', binDir)).toBe(stub);
    });
});

describe('classifyGainOutput', () => {
    it('classifies a completed probe carrying the dashboard marker as token-killer', () => {
        const probe: ProbeResult = {
            completed: true,
            stdout: 'RTK Token Savings\n60% output-token reduction\n',
            stderr: '',
        };
        expect(classifyGainOutput(probe)).toBe('token-killer');
    });

    it('classifies a completed probe with non-empty output but no marker as unknown-rtk', () => {
        const probe: ProbeResult = {
            completed: true,
            stdout: '',
            stderr: "error: no such subcommand: gain\n",
        };
        expect(classifyGainOutput(probe)).toBe('unknown-rtk');
    });

    it('classifies a completed probe with empty output as unverified (ambiguous, not accused)', () => {
        const probe: ProbeResult = { completed: true, stdout: '', stderr: '' };
        expect(classifyGainOutput(probe)).toBe('unverified');
    });

    it('classifies a non-completed probe (timeout/crash) as unverified', () => {
        const probe: ProbeResult = { completed: false, stdout: '', stderr: '' };
        expect(classifyGainOutput(probe)).toBe('unverified');
    });

    it('classifies a non-completed probe as unverified even if stray output happens to contain the marker', () => {
        // completed:false short-circuits before the signature check — a
        // killed/timed-out process never gets to claim token-killer.
        const probe: ProbeResult = { completed: false, stdout: 'RTK Token Savings', stderr: '' };
        expect(classifyGainOutput(probe)).toBe('unverified');
    });
});

describe('detectRtk', () => {
    let binDir: string;

    beforeEach(() => {
        binDir = mkdtempSync(join(tmpdir(), 'rtk-detect-'));
    });
    afterEach(() => {
        rmSync(binDir, { recursive: true, force: true });
    });

    it('reports absent when rtk is not resolvable on PATH', () => {
        expect(detectRtk({ pathEnv: binDir })).toEqual({ present: false });
    });

    it('reports token-killer identity + version when the injected probe matches the gain signature', () => {
        const binPath = writeExecutable(binDir, 'rtk', '#!/bin/sh\nexit 0\n');
        const probe = (): ProbeResult => ({ completed: true, stdout: 'RTK Token Savings\n', stderr: '' });
        const versionReader = (): string => '0.43.0';
        const result = detectRtk({ pathEnv: binDir, probe, versionReader });
        expect(result).toEqual({
            present: true,
            identity: 'token-killer',
            version: '0.43.0',
            binPath,
        });
    });

    it('reports unknown-rtk (no version field) when the injected probe returns a usage/unknown-subcommand error', () => {
        const binPath = writeExecutable(binDir, 'rtk', '#!/bin/sh\nexit 0\n');
        const probe = (): ProbeResult => ({
            completed: true,
            stdout: '',
            stderr: "error: no such subcommand: gain\n",
        });
        const result = detectRtk({ pathEnv: binDir, probe });
        expect(result).toEqual({ present: true, identity: 'unknown-rtk', binPath });
        expect(result.version).toBeUndefined();
    });

    it('reports unverified when the injected probe does not complete', () => {
        const binPath = writeExecutable(binDir, 'rtk', '#!/bin/sh\nexit 0\n');
        const probe = (): ProbeResult => ({ completed: false, stdout: '', stderr: '' });
        const result = detectRtk({ pathEnv: binDir, probe });
        expect(result).toEqual({ present: true, identity: 'unverified', binPath });
    });

    it('REGRESSION (bug 2): a plain shell-script stub named `rtk` on PATH never yields token-killer identity unless the gain signature actually matches', () => {
        // No injected probe here — this is the one test in the suite that
        // spawns the stub for real via the module's default spawnSync path,
        // mirroring the real collision: the unrelated Rust Type Kit answers
        // `gain` with an unknown-subcommand error, never the savings banner.
        const binPath = writeExecutable(
            binDir,
            'rtk',
            "#!/bin/sh\necho \"error: unrecognized subcommand 'gain'\" 1>&2\nexit 1\n",
        );
        const result = detectRtk({ pathEnv: binDir });
        expect(result.present).toBe(true);
        expect(result.binPath).toBe(binPath);
        // The old filename-only check would have reported this as installed;
        // the two-stage probe must not, since presence alone proves nothing.
        expect(result.identity).not.toBe('token-killer');
        expect(result.identity).toBe('unknown-rtk');
        expect(result.version).toBeUndefined();
    });
});

describe('rtkInstallCommands', () => {
    it('darwin recommends the official Homebrew formula', () => {
        const cmds = rtkInstallCommands('darwin');
        expect(cmds.recommended).toBe('brew install rtk');
    });

    it('linux (and other non-darwin/win32 platforms) recommend the upstream install.sh one-liner', () => {
        const platforms: NodeJS.Platform[] = ['linux', 'freebsd'];
        for (const platform of platforms) {
            const cmds = rtkInstallCommands(platform);
            expect(cmds.recommended).toContain('rtk-ai/rtk');
            expect(cmds.recommended).toMatch(/install\.sh/);
        }
    });

    it('win32 recommends winget, offers a manual msvc-zip path, and notes the ripgrep dependency', () => {
        const cmds = rtkInstallCommands('win32');
        expect(cmds.recommended).toBe('winget install rtk-ai.rtk');
        expect(cmds.manual).toMatch(/msvc/i);
        expect(cmds.note).toMatch(/ripgrep/i);
    });

    it('REGRESSION (S0.3): no emitted command, on any platform, recommends the bare crates.io crate or the dead event4u-app URL', () => {
        const platforms: NodeJS.Platform[] = ['darwin', 'linux', 'win32', 'freebsd'];
        for (const platform of platforms) {
            const cmds = rtkInstallCommands(platform);
            const emitted = [cmds.recommended, cmds.manual].filter(
                (value): value is string => typeof value === 'string',
            );
            expect(emitted.length).toBeGreaterThan(0);
            for (const value of emitted) {
                // The bare crates.io `rtk` crate resolves to the unrelated
                // Rust Type Kit, not Rust Token Killer — never recommend it.
                expect(value).not.toMatch(/\bcargo install rtk\b/);
                // The old dead fork URL must never resurface.
                expect(value).not.toContain('event4u-app/rtk');
            }
        }
    });
});

describe('RTK_UPSTREAM_REPO', () => {
    it('points at the real upstream repo, not the dead event4u-app fork', () => {
        expect(RTK_UPSTREAM_REPO).toBe('https://github.com/rtk-ai/rtk');
    });
});

describe('detectRtkCached', () => {
    let binDir: string;

    beforeEach(() => {
        binDir = mkdtempSync(join(tmpdir(), 'rtk-cache-'));
    });
    afterEach(() => {
        rmSync(binDir, { recursive: true, force: true });
    });

    it('reports absent for a nonexistent pathEnv without ever reaching the identity cache', () => {
        const missing = join(binDir, 'does-not-exist');
        expect(detectRtkCached({ pathEnv: missing })).toEqual({ present: false });
    });

    // detectRtkCached() has no home-directory injection point — cacheFile()
    // always resolves via node:os homedir(), unconditionally. Any assertion
    // past the `binPath === null` early return (a resolved stub + injected
    // probe) would read and/or write the real, user-global
    // ~/.event4u/agent-config/state/rtk-identity.json, which the test's brief
    // explicitly forbids polluting. So only the pre-cache early-return path
    // (rtk absent on PATH) is exercised above; deeper cache-hit / cache-write
    // behavior is left untested here.
});
