// Tests for src/scripts/ai_team/availability.ts::checkCodexAvailability.
//
// m5 fix (independent-review finding): `detectEnvironment()`'s host probe is
// hardcoded to the literal binary name `codex` and has no way to be told
// "check this other name instead". So an operator who configured
// `members.openai.binary:` in `.ai-council.yml` (honoured under an effective
// mode of `cli` OR `auto` — `cmd_doctor.ts::_mayRunOverCli`) was invisible to
// this check: `/team` could report "codex CLI not available" even with a
// working, custom-named binary configured and functional.
//
// Every case injects PATH / CODEX_HOME / EVENT4U_CONFIG_HOME so provider rows
// are fully controlled — no dependency on this machine's real environment.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { checkCodexAvailability } from '../../../src/scripts/ai_team/availability.js';
import { resetEnvironmentCache } from '../../../src/scripts/_lib/environment_detector.js';

interface Env {
    root: string;
    bin: string;
    codexHome: string;
    home: string;
}

const ENV_KEYS = ['PATH', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'EVENT4U_CONFIG_HOME', 'AI_COUNCIL_CONFIG'];
const dirs: string[] = [];

function withEnv(setup: (t: Env) => void, fn: (t: Env) => void): void {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'team-availability-'));
    dirs.push(base);
    const t: Env = {
        root: path.join(base, 'proj'),
        bin: path.join(base, 'bin'),
        codexHome: path.join(base, 'codex-home'),
        home: path.join(base, 'e4u-home'),
    };
    fs.mkdirSync(t.root, { recursive: true });
    fs.mkdirSync(t.bin, { recursive: true });
    const prev: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) prev[k] = process.env[k];
    process.env['PATH'] = t.bin;
    process.env['CODEX_HOME'] = t.codexHome;
    process.env['CLAUDE_CONFIG_DIR'] = path.join(base, 'claude-does-not-exist');
    process.env['EVENT4U_CONFIG_HOME'] = t.home;
    delete process.env['AI_COUNCIL_CONFIG'];
    resetEnvironmentCache();
    try {
        setup(t);
        fn(t);
    } finally {
        for (const k of ENV_KEYS) {
            if (prev[k] === undefined) delete process.env[k];
            else process.env[k] = prev[k] as string;
        }
        resetEnvironmentCache();
    }
}

afterEach(() => {
    while (dirs.length > 0) {
        fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
    }
});

function fakeBinary(dir: string, name: string): string {
    const p = path.join(dir, name);
    fs.writeFileSync(p, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(p, 0o755);
    return p;
}

function codexAuth(t: Env): void {
    fs.mkdirSync(t.codexHome, { recursive: true });
    fs.writeFileSync(path.join(t.codexHome, 'auth.json'), '{"tokens":{}}');
}

function writeCouncil(t: Env, body: string): void {
    const councilPath = path.join(t.home, 'settings', '.ai-council.yml');
    fs.mkdirSync(path.dirname(councilPath), { recursive: true });
    fs.writeFileSync(councilPath, body);
}

describe('checkCodexAvailability — no council config (default binary name)', () => {
    it('unavailable when the default-named `codex` binary is not on PATH', () => {
        withEnv(
            () => {},
            (t) => {
                const result = checkCodexAvailability(t.root);
                expect(result.available).toBe(false);
                expect(result.reason).toContain('codex CLI not available');
            },
        );
    });

    it('available when the default-named `codex` binary + auth are present', () => {
        withEnv(
            (t) => {
                fakeBinary(t.bin, 'codex');
                codexAuth(t);
            },
            (t) => {
                const result = checkCodexAvailability(t.root);
                expect(result.available).toBe(true);
                expect(result.reason).toBeNull();
            },
        );
    });
});

describe('checkCodexAvailability — custom `binary:` override (m5 regression)', () => {
    it('a custom-named binary under an UNSET member mode (defaults.mode: auto) is found — was invisible before the fix', () => {
        withEnv(
            (t) => {
                const customBin = fakeBinary(t.bin, 'my-custom-codex');
                writeCouncil(
                    t,
                    [
                        'enabled: true',
                        'members:',
                        '  openai:',
                        '    enabled: true',
                        '    model: gpt-5',
                        `    binary: ${customBin}`,
                    ].join('\n'),
                );
                codexAuth(t);
            },
            (t) => {
                const result = checkCodexAvailability(t.root);
                expect(result.available).toBe(true);
            },
        );
    });

    it('a custom-named binary under an EXPLICIT `mode: auto` member is found', () => {
        withEnv(
            (t) => {
                const customBin = fakeBinary(t.bin, 'my-custom-codex');
                writeCouncil(
                    t,
                    [
                        'enabled: true',
                        'members:',
                        '  openai:',
                        '    enabled: true',
                        '    model: gpt-5',
                        '    mode: auto',
                        `    binary: ${customBin}`,
                    ].join('\n'),
                );
                codexAuth(t);
            },
            (t) => {
                const result = checkCodexAvailability(t.root);
                expect(result.available).toBe(true);
            },
        );
    });

    it('still unavailable when the OVERRIDDEN name is not on PATH, even if the default-named `codex` happens to be', () => {
        withEnv(
            (t) => {
                // Default-named `codex` present, but the configured override
                // points at a name that does NOT exist — the override wins;
                // this proves the check reads the override rather than
                // falling back to the default-name probe once one exists.
                fakeBinary(t.bin, 'codex');
                writeCouncil(
                    t,
                    [
                        'enabled: true',
                        'members:',
                        '  openai:',
                        '    enabled: true',
                        '    model: gpt-5',
                        '    binary: /does/not/exist/my-custom-codex',
                    ].join('\n'),
                );
                codexAuth(t);
            },
            (t) => {
                const result = checkCodexAvailability(t.root);
                expect(result.available).toBe(false);
                expect(result.reason).toContain('codex CLI not available');
            },
        );
    });
});
