// Tests for src/scripts/profile_use.ts (py2ts Phase 8 / Wave 8e).
//
// No Python pytest suite exists, so this is a focused in-process suite plus
// a CLI subprocess layer. profile_use is a WRITER: every run mutates
// <root>/agents/settings/.agent-settings.yml. All mutation happens in
// throwaway temp dirs — the live repo settings file is never touched. The
// CLI layer (converted from the retired python3-vs-tsx golden parity block;
// the Python original was deleted) runs the real tsx entry point in a temp
// root and asserts stdout / stderr / exit code / written file directly, with
// the (root-dependent) absolute path normalized to <ROOT>.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LEGACY_ALL,
    VALID_PROFILES,
    main,
} from '../../src/scripts/profile_use.js';
import { runTs } from './_wave8e.js';

let tmpDir: string;
let prevCwd: string;
beforeEach(() => {
    // realpath so macOS /var → /private/var matches process.cwd() after chdir.
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'profile-use-')));
    prevCwd = process.cwd();
});
afterEach(() => {
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SETTINGS_REL = path.join('agents', 'settings', '.agent-settings.yml');

function readWritten(root: string): string {
    return fs.readFileSync(path.join(root, SETTINGS_REL), 'utf-8');
}

describe('profile_use — in-process differential', () => {
    it('VALID_PROFILES are the six seed ids', () => {
        expect([...VALID_PROFILES]).toEqual([
            'developer',
            'content_creator',
            'founder',
            'agency',
            'finance',
            'ops',
        ]);
        expect(LEGACY_ALL).toBe('legacy-all');
    });

    it('missing --profile → exit 2, nothing written', () => {
        process.chdir(tmpDir);
        const stderr = captureStderr(() => {
            expect(main([])).toBe(2);
        });
        expect(stderr).toContain('`use` requires --profile=<id>');
        expect(fs.existsSync(path.join(tmpDir, SETTINGS_REL))).toBe(false);
    });

    it('unknown profile → exit 2, nothing written', () => {
        process.chdir(tmpDir);
        const stderr = captureStderr(() => {
            expect(main(['--profile', 'wizard'])).toBe(2);
        });
        expect(stderr).toContain('unknown profile `wizard`');
        expect(fs.existsSync(path.join(tmpDir, SETTINGS_REL))).toBe(false);
    });

    it('fresh dir + --profile founder → appends both blocks', () => {
        process.chdir(tmpDir);
        const stdout = captureStdout(() => {
            expect(main(['--profile', 'founder'])).toBe(0);
        });
        const written = readWritten(tmpDir);
        expect(written).toContain('profile:');
        expect(written).toContain('id: founder');
        expect(written).toContain('projection:');
        expect(written).toContain('mode: scoped');
        expect(stdout).toContain('Experience set to `founder`; projection mode `scoped`');
    });

    it('--profile=legacy-all on a settings file → flips projection only', () => {
        process.chdir(tmpDir);
        fs.mkdirSync(path.join(tmpDir, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpDir, SETTINGS_REL),
            'profile:\n  id: founder\nprojection:\n  mode: scoped\n',
            'utf-8',
        );
        const stdout = captureStdout(() => {
            expect(main(['--profile=legacy-all'])).toBe(0);
        });
        const written = readWritten(tmpDir);
        expect(written).toContain('id: founder'); // profile.id untouched
        expect(written).toContain('mode: legacy-all');
        expect(stdout).toContain('Projection set to `legacy-all`');
    });

    it('legacy-all when already legacy-all → no-change message', () => {
        process.chdir(tmpDir);
        fs.mkdirSync(path.join(tmpDir, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpDir, SETTINGS_REL),
            'projection:\n  mode: legacy-all\n',
            'utf-8',
        );
        const stdout = captureStdout(() => {
            expect(main(['--profile', 'legacy-all'])).toBe(0);
        });
        expect(stdout).toContain('Already in `legacy-all` projection');
    });

    it('switching an existing profile shows the arrow transition', () => {
        process.chdir(tmpDir);
        fs.mkdirSync(path.join(tmpDir, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpDir, SETTINGS_REL),
            'profile:\n  id: developer\nprojection:\n  mode: scoped\n',
            'utf-8',
        );
        const stdout = captureStdout(() => {
            expect(main(['--profile', 'ops'])).toBe(0);
        });
        expect(stdout).toContain('Experience set to `developer` → `ops`');
        expect(readWritten(tmpDir)).toContain('id: ops');
    });
});

describe('profile_use — CLI subprocess (tsx, temp root)', () => {
    interface CliRun {
        status: number | null;
        stdout: string;
        stderr: string;
        root: string;
        file: string;
        written: string | null;
    }

    function freshRoot(seed?: string): string {
        // realpath so the (macOS /var → /private/var) path the CLI prints
        // matches the root token we normalize away.
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'profile-use-cli-')));
        if (seed !== undefined) {
            fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
            fs.writeFileSync(path.join(root, SETTINGS_REL), seed, 'utf-8');
        }
        return root;
    }

    // Normalize the absolute root path so assertions are machine-independent.
    function norm(s: string, root: string): string {
        return s.split(root).join('<ROOT>');
    }

    function runCli(args: string[], seed?: string): CliRun {
        const root = freshRoot(seed);
        try {
            const t = runTs('profile_use', args, { cwd: root });
            const file = path.join(root, SETTINGS_REL);
            return {
                status: t.status,
                stdout: norm(t.stdout, root),
                stderr: norm(t.stderr, root),
                root,
                file,
                written: fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null,
            };
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    it('fresh dir + --profile founder → writes both blocks + success stdout', () => {
        const r = runCli(['--profile', 'founder']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(r.stdout).toContain(
            'Experience set to `founder`; projection mode `scoped` in <ROOT>/agents/settings/.agent-settings.yml',
        );
        expect(r.written).toContain('profile:\n  id: founder');
        expect(r.written).toContain('projection:\n  mode: scoped');
    });

    it('--profile=content_creator (equals form) parses and writes', () => {
        const r = runCli(['--profile=content_creator']);
        expect(r.status).toBe(0);
        expect(r.written).toContain('id: content_creator');
    });

    it('legacy-all on a seeded file → surgical projection-only edit', () => {
        const r = runCli(['--profile', 'legacy-all'], 'profile:\n  id: founder\nprojection:\n  mode: scoped\n');
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Projection set to `legacy-all`');
        expect(r.written).toContain('id: founder'); // profile.id untouched
        expect(r.written).toContain('mode: legacy-all');
        expect(r.written).not.toContain('mode: scoped');
    });

    it('legacy-all already-set → no-change message', () => {
        const r = runCli(['--profile', 'legacy-all'], 'projection:\n  mode: legacy-all\n');
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Already in `legacy-all` projection');
        expect(r.written).toBe('projection:\n  mode: legacy-all\n');
    });

    it('switch existing profile → arrow transition + edit', () => {
        const r = runCli(['--profile', 'ops'], 'profile:\n  id: developer\nprojection:\n  mode: scoped\n');
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Experience set to `developer` → `ops`');
        expect(r.written).toContain('id: ops');
        expect(r.written).not.toContain('id: developer');
    });

    it('missing --profile → exit 2 + stderr, nothing written', () => {
        const r = runCli([]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('`use` requires --profile=<id>');
        expect(r.written).toBeNull();
    });

    it('unknown profile → exit 2 + stderr, nothing written', () => {
        const r = runCli(['--profile', 'wizard']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('unknown profile `wizard`');
        expect(r.written).toBeNull();
    });

    it('settings file comments survive the surgical edit', () => {
        const seed =
            '# top comment\nname: demo\n\n# --- Profile (experience) ---\nprofile:\n  # which experience\n  id: developer\n';
        const r = runCli(['--profile', 'finance'], seed);
        expect(r.status).toBe(0);
        expect(r.written).toContain('# top comment');
        expect(r.written).toContain('name: demo');
        expect(r.written).toContain('# which experience');
        expect(r.written).toContain('id: finance');
        expect(r.written).not.toContain('id: developer');
    });
});

// --- stdout / stderr capture helpers --------------------------------------

function captureStdout(fn: () => void): string {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
        return true;
    };
    try {
        fn();
    } finally {
        process.stdout.write = orig;
    }
    return chunks.join('');
}

function captureStderr(fn: () => void): string {
    const chunks: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    (process.stderr.write as unknown) = (chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
        return true;
    };
    try {
        fn();
    } finally {
        process.stderr.write = orig;
    }
    return chunks.join('');
}
