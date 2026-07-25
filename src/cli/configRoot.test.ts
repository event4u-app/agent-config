/**
 * Unit tests for the host-supplied config-root seam.
 *
 *   - `resolveConfigRoot` applies `flag > env > default` precedence.
 *   - `ensureConfigRoot` validates + creates the dir (0700), rejects empty.
 *   - `applyConfigRootFromArgv` extracts the flag, exports the env, cleans
 *     argv, and is a pure passthrough (no side effects) when absent.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    CONFIG_ROOT_ENV,
    applyConfigRootFromArgv,
    ensureConfigRoot,
    resolveConfigRoot,
} from './configRoot.js';

describe('config root', () => {
    let scratch: string;
    let savedEnv: string | undefined;

    beforeEach(() => {
        scratch = mkdtempSync(join(tmpdir(), 'configroot-'));
        savedEnv = process.env[CONFIG_ROOT_ENV];
        delete process.env[CONFIG_ROOT_ENV];
    });
    afterEach(() => {
        rmSync(scratch, { recursive: true, force: true });
        if (savedEnv === undefined) {
            delete process.env[CONFIG_ROOT_ENV];
        } else {
            process.env[CONFIG_ROOT_ENV] = savedEnv;
        }
    });

    describe('resolveConfigRoot (precedence flag > env > default)', () => {
        it('returns the flag value (absolute-resolved) when set — even if env is also set', () => {
            const flag = join(scratch, 'from-flag');
            const res = resolveConfigRoot({
                flag,
                env: { [CONFIG_ROOT_ENV]: join(scratch, 'from-env') },
            });
            expect(res).toBe(resolve(flag));
        });

        it('returns the env value when no flag is set', () => {
            const envRoot = join(scratch, 'from-env');
            const res = resolveConfigRoot({ env: { [CONFIG_ROOT_ENV]: envRoot } });
            expect(res).toBe(envRoot);
        });

        it('returns the vendor-namespaced default when neither flag nor env is set', () => {
            const res = resolveConfigRoot({ env: {} });
            expect(res).toBe(join(homedir(), '.event4u', 'agent-config'));
        });
    });

    describe('ensureConfigRoot', () => {
        it('creates the directory (mode 0700, no group/other access)', () => {
            const target = join(scratch, 'nested', 'root');
            expect(existsSync(target)).toBe(false);

            const abs = ensureConfigRoot(target);

            expect(abs).toBe(resolve(target));
            expect(statSync(abs).isDirectory()).toBe(true);
            const mode = statSync(abs).mode & 0o777;
            // Owner rwx present; group/other stripped (umask only restricts).
            expect(mode & 0o700).toBe(0o700);
            expect(mode & 0o077).toBe(0);
        });

        it('rejects an empty path', () => {
            expect(() => ensureConfigRoot('   ')).toThrow(/non-empty/);
        });
    });

    describe('applyConfigRootFromArgv', () => {
        it('extracts `--config-root <path>`, exports the env, and cleans argv', () => {
            const root = join(scratch, 'profile-a');
            const env: NodeJS.ProcessEnv = {};
            const res = applyConfigRootFromArgv(['config', '--config-root', root, '--port', '8080'], env);

            expect(res.configRoot).toBe(resolve(root));
            expect(env[CONFIG_ROOT_ENV]).toBe(resolve(root));
            expect(res.argv).toEqual(['config', '--port', '8080']);
            expect(existsSync(resolve(root))).toBe(true);
        });

        it('supports the `--config-root=<path>` form', () => {
            const root = join(scratch, 'profile-b');
            const env: NodeJS.ProcessEnv = {};
            const res = applyConfigRootFromArgv([`--config-root=${root}`, 'setup'], env);

            expect(res.configRoot).toBe(resolve(root));
            expect(env[CONFIG_ROOT_ENV]).toBe(resolve(root));
            expect(res.argv).toEqual(['setup']);
        });

        it('is a pure passthrough with no side effects when the flag is absent', () => {
            const env: NodeJS.ProcessEnv = {};
            const res = applyConfigRootFromArgv(['config', '--port', '8080'], env);

            expect(res.configRoot).toBeNull();
            expect(env[CONFIG_ROOT_ENV]).toBeUndefined();
            expect(res.argv).toEqual(['config', '--port', '8080']);
        });

        it('throws when the flag is present without a value', () => {
            expect(() => applyConfigRootFromArgv(['config', '--config-root'], {})).toThrow(
                /requires a path/,
            );
            expect(() => applyConfigRootFromArgv(['--config-root', '--port'], {})).toThrow(
                /requires a path/,
            );
        });
    });
});
