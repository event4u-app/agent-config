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

// ---------------------------------------------------------------------------
// CLAUDE_CONFIG_DIR inheritance — pinned, deliberately, as-is
// (road-to-zero-ceremony-detection Phase 5)
//
// `hardenedSpawnEnv` is deny-by-FAMILY, not an allowlist (ADR-123): the
// provider CLIs legitimately need arbitrary env, so an allowlist would break
// them and rot. `CLAUDE_CONFIG_DIR` matches no deny family — note the near
// miss, `GIT_CONFIG_` is a PREFIX test, and `CLAUDE_CONFIG_DIR` merely
// *contains* `CONFIG_` — so it is inherited by every spawned child today.
//
// That variable points a provider CLI at the directory it loads configuration
// from, and that directory carries instruction-bearing content. Nothing
// asserted its behaviour either way before this test. These cases record the
// CURRENT behaviour so a future change to it is a visible, deliberate diff
// rather than a silent one — see `docs/threat-model.md` row i and the
// `claude-config-dir-inheritance-decision` blocker for why the decision landed
// on accepted-risk rather than a strip.
//
// If a later change denies the variable, THESE TESTS MUST FLIP, and flipping
// them is the signal that a considered ADR-123 decision is being reversed.
describe('hardenedSpawnEnv — CLAUDE_CONFIG_DIR is inherited (pinned)', () => {
    it('passes an inherited CLAUDE_CONFIG_DIR through to the child env', () => {
        withEnv({ CLAUDE_CONFIG_DIR: '/tmp/attacker-config' }, () => {
            expect(hardenedSpawnEnv()['CLAUDE_CONFIG_DIR']).toBe('/tmp/attacker-config');
        });
    });

    it('matches no deny family — the GIT_CONFIG_ check is a prefix, not a substring', () => {
        withEnv(
            {
                CLAUDE_CONFIG_DIR: '/tmp/a',
                // The genuinely-denied neighbour, for contrast in one assertion.
                GIT_CONFIG_GLOBAL: '/tmp/evil.gitconfig',
            },
            () => {
                const env = hardenedSpawnEnv();
                expect(env['CLAUDE_CONFIG_DIR']).toBe('/tmp/a');
                expect(env['GIT_CONFIG_GLOBAL']).toBeUndefined();
            },
        );
    });

    it('inherits CODEX_HOME the same way — the same class, the same verdict', () => {
        // agent-switch drives per-account profiles through both variables
        // (src/install/agentSwitchProfile.ts PROVIDER_ENV_VARS), so they stand
        // or fall together.
        withEnv({ CODEX_HOME: '/tmp/profile/codex' }, () => {
            expect(hardenedSpawnEnv()['CODEX_HOME']).toBe('/tmp/profile/codex');
        });
    });

    it('an explicit override still wins over the inherited value', () => {
        // The assignment path already works and is how a caller would scope a
        // child deliberately — option (c) in the blocker would build on this.
        withEnv({ CLAUDE_CONFIG_DIR: '/tmp/inherited' }, () => {
            const env = hardenedSpawnEnv({ CLAUDE_CONFIG_DIR: '/tmp/validated' });
            expect(env['CLAUDE_CONFIG_DIR']).toBe('/tmp/validated');
        });
    });

    it('reaches a real spawned child, not just the computed env map', () => {
        const client = new AnthropicCliClient({
            name: 'anthropic',
            model: 'claude-sonnet-4-5',
            binary: '/bin/sh',
        });
        withEnv({ CLAUDE_CONFIG_DIR: '/tmp/reaches-child' }, () => {
            const res = (
                client as unknown as {
                    _runSubprocess(cmd: string[], stdin: string | null): SubprocessResult;
                }
            )._runSubprocess(['/bin/sh', '-c', 'printf %s "$CLAUDE_CONFIG_DIR"'], null);
            expect(res.stdout).toBe('/tmp/reaches-child');
        });
    });
});
