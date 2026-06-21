// Tests for src/scripts/profile_use.ts (py2ts Phase 8 / Wave 8e).
//
// No Python pytest suite exists, so this is a focused differential plus a
// golden-parity layer. profile_use is a WRITER: every run mutates
// <root>/agents/settings/.agent-settings.yml. All mutation happens in
// throwaway temp dirs — the live repo settings file is never touched. The
// golden-parity layer runs python3 and tsx in SEPARATE temp roots, then
// asserts the written file is byte-identical and the stdout matches once the
// (root-dependent) absolute path is normalized.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LEGACY_ALL,
    VALID_PROFILES,
    main,
} from '../../src/scripts/profile_use.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

const py3 = hasPython3();

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

describe.skipIf(!py3)('profile_use — golden parity (python3 vs tsx, separate temp roots)', () => {
    function freshRoot(label: string, seed?: string): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), `profile-use-${label}-`));
        if (seed !== undefined) {
            fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
            fs.writeFileSync(path.join(root, SETTINGS_REL), seed, 'utf-8');
        }
        return root;
    }

    // Normalize the absolute root path so stdout from two temp roots compares.
    function norm(s: string, root: string): string {
        return s.split(root).join('<ROOT>');
    }

    function parityFresh(args: string[], seed?: string): void {
        const pyRoot = freshRoot('py', seed);
        const tsRoot = freshRoot('ts', seed);
        try {
            const p = runPy('profile_use', args, { cwd: pyRoot });
            const t = runTs('profile_use', args, { cwd: tsRoot });
            expect(t.status).toBe(p.status);
            expect(norm(t.stdout, tsRoot)).toBe(norm(p.stdout, pyRoot));
            expect(norm(t.stderr, tsRoot)).toBe(norm(p.stderr, pyRoot));
            const pyFile = path.join(pyRoot, SETTINGS_REL);
            const tsFile = path.join(tsRoot, SETTINGS_REL);
            expect(fs.existsSync(tsFile)).toBe(fs.existsSync(pyFile));
            if (fs.existsSync(pyFile)) {
                expect(fs.readFileSync(tsFile, 'utf-8')).toBe(fs.readFileSync(pyFile, 'utf-8'));
            }
        } finally {
            fs.rmSync(pyRoot, { recursive: true, force: true });
            fs.rmSync(tsRoot, { recursive: true, force: true });
        }
    }

    it('fresh dir + --profile founder → identical write + stdout', () => {
        parityFresh(['--profile', 'founder']);
    });

    it('--profile=content_creator (equals form) → identical', () => {
        parityFresh(['--profile=content_creator']);
    });

    it('legacy-all on a seeded file → identical surgical edit', () => {
        parityFresh(['--profile', 'legacy-all'], 'profile:\n  id: founder\nprojection:\n  mode: scoped\n');
    });

    it('legacy-all already-set → identical no-change message', () => {
        parityFresh(['--profile', 'legacy-all'], 'projection:\n  mode: legacy-all\n');
    });

    it('switch existing profile → identical arrow + edit', () => {
        parityFresh(['--profile', 'ops'], 'profile:\n  id: developer\nprojection:\n  mode: scoped\n');
    });

    it('missing --profile → identical exit 2 + stderr', () => {
        parityFresh([]);
    });

    it('unknown profile → identical exit 2 + stderr', () => {
        parityFresh(['--profile', 'wizard']);
    });

    it('settings file with comments preserved byte-for-byte', () => {
        parityFresh(
            ['--profile', 'finance'],
            '# top comment\nname: demo\n\n# --- Profile (experience) ---\nprofile:\n  # which experience\n  id: developer\n',
        );
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
