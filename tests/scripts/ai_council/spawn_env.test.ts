// Falsifiable env-injection regression test for the hardened subprocess env
// (road-to-runtime-security-hardening Phase 1).
//
// Two layers:
//   1. Unit — `hardenedSpawnEnv` scrubs the code-execution-injection families
//      and preserves everything else.
//   2. End-to-end — the REAL `CliClient._runSubprocess` (not the stubbed seam)
//      spawns `/bin/sh` with a set of attacker-influenced env vars present in
//      the parent; the child prints them back and NONE must survive. Revert the
//      `spawnOpts.env = hardenedSpawnEnv()` wiring and this test goes red — that
//      is the falsifiability.
import { describe, expect, it } from 'vitest';

import { hardenedSpawnEnv } from '../../../src/scripts/_lib/spawn_env.js';
import {
    AnthropicCliClient,
    type SubprocessResult,
} from '../../../src/scripts/ai_council/clients.js';

// The vectors that must never reach a spawned child.
const INJECTION_VARS: Record<string, string> = {
    GIT_EXTERNAL_DIFF: 'evil-diff',
    LD_PRELOAD: '/tmp/evil.so',
    DYLD_INSERT_LIBRARIES: '/tmp/evil.dylib',
    NODE_OPTIONS: '--require /tmp/evil.js',
    BASH_ENV: '/tmp/evil.sh',
    PYTHONSTARTUP: '/tmp/evil.py',
    GIT_SSH_COMMAND: 'sh -c evil',
    // family-matched (not in the exact set): a GIT_*_COMMAND variant + an LD_ one
    GIT_ALTERNATE_OBJECT_DIRECTORIES_COMMAND: 'evil',
    LD_AUDIT: '/tmp/evil-audit.so',
    // git config-injection (the reproduced core.fsmonitor RCE): the GIT_CONFIG*
    // family sets arbitrary git config; git runs core.fsmonitor as shell on
    // every `git status`, which the consumer-runtime hooks trigger.
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.fsmonitor',
    GIT_CONFIG_VALUE_0: 'sh -c "touch /tmp/pwned"',
    GIT_CONFIG_GLOBAL: '/tmp/evil.gitconfig',
    GIT_ALTERNATE_OBJECT_DIRECTORIES: '/tmp/evil-objects',
    HOSTALIASES: '/tmp/evil-hostaliases',
    // git path-redirection: point git at an attacker-controlled repo/index/
    // ref-namespace so a child's ordinary git ops read+write attacker state.
    GIT_DIR: '/tmp/evil-repo/.git',
    GIT_INDEX_FILE: '/tmp/evil-index',
    GIT_NAMESPACE: 'evil-ns',
};

function withEnv<T>(vars: Record<string, string>, fn: () => T): T {
    const saved: Record<string, string | undefined> = {};
    for (const k of Object.keys(vars)) saved[k] = process.env[k];
    Object.assign(process.env, vars);
    try {
        return fn();
    } finally {
        for (const k of Object.keys(vars)) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    }
}

describe('hardenedSpawnEnv — unit', () => {
    it('scrubs every injection vector (exact + family) and preserves good vars', () => {
        withEnv({ ...INJECTION_VARS, HOME: '/home/me', ANTHROPIC_API_KEY: 'keep-me' }, () => {
            const env = hardenedSpawnEnv();
            for (const k of Object.keys(INJECTION_VARS)) {
                expect(env[k], `${k} must be scrubbed`).toBeUndefined();
            }
            // legitimate vars the CLIs need survive
            expect(env.HOME).toBe('/home/me');
            expect(env.ANTHROPIC_API_KEY).toBe('keep-me');
        });
    });

    it('applies overrides after scrubbing (explicit call-site re-supply wins)', () => {
        const env = hardenedSpawnEnv({ PATH: '/scoped/bin', NODE_OPTIONS: '' });
        expect(env.PATH).toBe('/scoped/bin');
        // an override can deliberately re-set a scrubbed var — that is an
        // explicit, reviewable decision, never ambient inheritance.
        expect(env.NODE_OPTIONS).toBe('');
    });

    it('does NOT scrub GIT_ASKPASS (a path, not a shell-command hook)', () => {
        withEnv({ GIT_ASKPASS: '/usr/bin/askpass-helper' }, () => {
            expect(hardenedSpawnEnv().GIT_ASKPASS).toBe('/usr/bin/askpass-helper');
        });
    });
});

describe('CliClient._runSubprocess — end-to-end env-injection defence', () => {
    it('no injection vector reaches the spawned child process', () => {
        // Construct a real concrete CLI client; binary passed explicitly so the
        // ctor never touches PATH. We then call the REAL _runSubprocess with our
        // own argv (it uses cmd[0] as argv0, ignoring this.binary).
        const client = new AnthropicCliClient({ binary: '/bin/sh' });
        const run = (
            client as unknown as {
                _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
            }
        )._runSubprocess.bind(client);

        // Child prints each var back, one per line; with the fix all are empty.
        const names = Object.keys(INJECTION_VARS);
        const script = names.map((n) => `printf '%s\\n' "$${n}"`).join('; ');

        const result = withEnv(INJECTION_VARS, () => run(['/bin/sh', '-c', script], null));

        const printed = (result.stdout ?? '').split('\n').filter((l) => l.length > 0);
        expect(
            printed,
            `injection vars leaked into the child: ${printed.join(', ')}`,
        ).toHaveLength(0);
    });

    it('preserves a benign env var into the child (proves it is not empty-env)', () => {
        const client = new AnthropicCliClient({ binary: '/bin/sh' });
        const run = (
            client as unknown as {
                _runSubprocess: (c: string[], s: string | null) => SubprocessResult;
            }
        )._runSubprocess.bind(client);

        const result = withEnv({ SPAWN_ENV_TEST_MARKER: 'present' }, () =>
            run(['/bin/sh', '-c', 'printf %s "$SPAWN_ENV_TEST_MARKER"'], null),
        );
        expect((result.stdout ?? '').trim()).toBe('present');
    });
});
