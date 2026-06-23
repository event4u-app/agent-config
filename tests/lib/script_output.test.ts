
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as so from '../../src/scripts/_lib/script_output';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'so-test-')));
    tmp_dirs.push(dir);
    return dir;
}

function patch_env(key: string, value: string | undefined): void {
    saved_env.push([key, process.env[key]]);
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

/** Capture stdout + stderr the way pytest's `capsys` does. */
interface Captured {
    out: string;
    err: string;
}

function capture(fn: () => void): Captured {
    let out = '';
    let err = '';
    const out_spy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
            return true;
        });
    const err_spy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            err += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
            return true;
        });
    try {
        fn();
    } finally {
        out_spy.mockRestore();
        err_spy.mockRestore();
    }
    return { out, err };
}

/** Write a minimal `.agent-settings.yml`; returns its path. Mirrors `_write_settings`. */
function write_settings(tmp: string, level: string | null): string {
    const settings = path.join(tmp, '.agent-settings.yml');
    if (level === null) {
        fs.writeFileSync(settings, 'verbosity:\n  preview_artifacts: false\n', 'utf-8');
    } else {
        fs.writeFileSync(settings, `verbosity:\n  script_output: ${level}\n`, 'utf-8');
    }
    return settings;
}

beforeEach(() => {
    // autouse _reset_state: clean level cache + clean env vars.
    patch_env(so.ENV_VAR, undefined);
    patch_env(so.ENV_ALIAS, undefined);
    so.reset_level();
});

afterEach(() => {
    so.reset_level();
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

// --- resolution order -------------------------------------------------------

describe('resolve_level — resolution order', () => {
    it('default level is minimal', () => {
        const tmp = make_tmp();
        const missing = path.join(tmp, 'does-not-exist.yml');
        expect(so.resolve_level(missing)).toBe('minimal');
    });

    it('settings file minimal wins', () => {
        const p = write_settings(make_tmp(), 'minimal');
        expect(so.resolve_level(p)).toBe('minimal');
    });

    it('settings file silent wins', () => {
        const p = write_settings(make_tmp(), 'silent');
        expect(so.resolve_level(p)).toBe('silent');
    });

    it('settings file verbose wins', () => {
        const p = write_settings(make_tmp(), 'verbose');
        expect(so.resolve_level(p)).toBe('verbose');
    });

    it('env var overrides settings', () => {
        const p = write_settings(make_tmp(), 'minimal');
        patch_env(so.ENV_VAR, 'verbose');
        expect(so.resolve_level(p)).toBe('verbose');
    });

    it('env alias forces verbose', () => {
        const p = write_settings(make_tmp(), 'silent');
        patch_env(so.ENV_ALIAS, '1');
        expect(so.resolve_level(p)).toBe('verbose');
    });

    it('invalid settings value falls back to default', () => {
        const tmp = make_tmp();
        const p = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(p, 'verbosity:\n  script_output: chatty\n', 'utf-8');
        expect(so.resolve_level(p)).toBe('minimal');
    });

    it('resolved level exported for inheritance', () => {
        const p = write_settings(make_tmp(), 'verbose');
        expect(so.resolve_level(p)).toBe('verbose');
        expect(process.env[so.ENV_VAR]).toBe('verbose');
    });
});

// --- level behaviour (stdout / stderr channels) -----------------------------

describe('emitters — level behaviour', () => {
    it('info silent at minimal', () => {
        const p = write_settings(make_tmp(), 'minimal');
        so.resolve_level(p);
        const captured = capture(() => so.info('step 1'));
        expect(captured.out).toBe('');
    });

    it('info prints at verbose', () => {
        const p = write_settings(make_tmp(), 'verbose');
        so.resolve_level(p);
        const captured = capture(() => so.info('step 1'));
        expect(captured.out).toContain('step 1');
    });

    it('success collected at minimal', () => {
        const p = write_settings(make_tmp(), 'minimal');
        so.resolve_level(p);
        let captured = capture(() => so.success('did the thing'));
        expect(captured.out).toBe('');
        captured = capture(() => so.flush_summary());
        expect(captured.out).toContain('did the thing');
    });

    it('success immediate at verbose', () => {
        const p = write_settings(make_tmp(), 'verbose');
        so.resolve_level(p);
        const captured = capture(() => so.success('did the thing'));
        expect(captured.out).toContain('did the thing');
    });

    it('success dropped at silent', () => {
        const p = write_settings(make_tmp(), 'silent');
        so.resolve_level(p);
        const captured = capture(() => {
            so.success('did the thing');
            so.flush_summary();
        });
        expect(captured.out).toBe('');
    });

    it('error always to stderr', () => {
        const p = write_settings(make_tmp(), 'silent');
        so.resolve_level(p);
        const captured = capture(() => so.error('boom'));
        expect(captured.out).toBe('');
        expect(captured.err).toContain('boom');
    });

    it('warn to stderr unless silent', () => {
        const p = write_settings(make_tmp(), 'minimal');
        so.resolve_level(p);
        const captured = capture(() => so.warn('careful'));
        expect(captured.err).toContain('careful');
    });
});

// === Differential block: TS port vs live Python module =====================

const DRIVER = path.join(REPO_ROOT, 'tests', 'lib', 'script_output_py_driver.py');

/**
 * Resolve in the TS module under a clean env applied like the driver does
 * (null deletes the key), capturing the exported value, then restore.
 * Mirrors the Python driver's reset + resolve + read-back.
 */
function ts_resolve(
    settings_arg: string,
    env: Record<string, string | null> = {},
): { level: string; exported: string | null } {
    const saved: Array<[string, string | undefined]> = [];
    for (const [key, value] of Object.entries(env)) {
        saved.push([key, process.env[key]]);
        if (value === null) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    try {
        so.reset_level();
        const settings_path = settings_arg === '-' ? null : settings_arg;
        const level = so.resolve_level(settings_path);
        return { level, exported: process.env[so.ENV_VAR] ?? null };
    } finally {
        while (saved.length > 0) {
            const [key, value] = saved.pop() as [string, string | undefined];
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}
