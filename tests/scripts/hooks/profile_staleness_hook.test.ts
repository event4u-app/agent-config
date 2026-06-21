// Tests for src/scripts/profile_staleness_hook.ts (py2ts Phase 6 — hooks).
//
// No Python suite exists for this hook (grep tests/ → none), so this is a
// focused DIFFERENTIAL suite over the TS twin's observable contract:
//   * active overlay → one `[profile] …` stderr line, exit 0, no stdout
//   * no / empty / corrupt overlay → silent, exit 0
//   * --root precedence + env fallback
//
// IMPLEMENTATION NOTE (noted, deliberate): the Python original imports
// `scripts.config.session_profiles`. In the src/scripts layout that import
// only resolves when `src` is on PYTHONPATH (pyproject sets
// pythonpath=["src","."] — the deployed import root). The TS twin inlines
// the `stale_notice` slice directly (per the batch contract: "read the file
// directly, NOTE it") rather than depend on the unported session_profiles
// module. With `PYTHONPATH=src` the two produce byte-identical output, so
// the golden-parity layer runs the .py hook with that env and asserts full
// stdout + stderr + exit parity.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../../src/scripts/profile_staleness_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'profile_staleness_hook.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'profile_staleness_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const OVERLAY_REL = path.join('agents', 'settings', '.agent-settings.local.yml');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function writeOverlay(root: string, body: string): void {
    const target = path.join(root, OVERLAY_REL);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
}

function captureStderr() {
    const chunks: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
        return true;
    }) as typeof process.stderr.write;
    return {
        restore: () => {
            process.stderr.write = orig;
        },
        text: () => chunks.join(''),
    };
}

let tmp: string;
let spy: ReturnType<typeof captureStderr>;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-stale-'));
    spy = captureStderr();
    delete process.env['CLAUDE_PROJECT_DIR'];
    delete process.env['AGENT_CONFIG_PROJECT_DIR'];
});
afterEach(() => {
    spy.restore();
    delete process.env['CLAUDE_PROJECT_DIR'];
    delete process.env['AGENT_CONFIG_PROJECT_DIR'];
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('profile_staleness — TS twin contract', () => {
    it('emits a notice for an active overlay', () => {
        writeOverlay(tmp, 'runtime:\n  active_packs:\n    - laravel\n    - php\n');
        const rc = main(['--root', tmp, '--platform', 'claude']);
        expect(rc).toBe(0);
        const err = spy.text();
        expect(err).toContain('[profile]');
        expect(err).toContain('profile still active from a previous session: laravel, php');
        expect(err).toContain('/profile deactivate');
    });

    it('is silent when there is no overlay file', () => {
        const rc = main(['--root', tmp, '--platform', 'claude']);
        expect(rc).toBe(0);
        expect(spy.text()).toBe('');
    });

    it('is silent for an empty active_packs list', () => {
        writeOverlay(tmp, 'runtime:\n  active_packs: []\n');
        const rc = main(['--root', tmp, '--platform', 'claude']);
        expect(rc).toBe(0);
        expect(spy.text()).toBe('');
    });

    it('is silent for a corrupt / unparseable overlay (fail-open)', () => {
        writeOverlay(tmp, 'runtime: : : not yaml [[[\n');
        const rc = main(['--root', tmp, '--platform', 'claude']);
        expect(rc).toBe(0);
        expect(spy.text()).toBe('');
    });

    it('is silent when runtime is the wrong shape', () => {
        writeOverlay(tmp, 'runtime: not-a-dict\n');
        const rc = main(['--root', tmp, '--platform', 'claude']);
        expect(rc).toBe(0);
        expect(spy.text()).toBe('');
    });

    it('falls back to CLAUDE_PROJECT_DIR when --root absent', () => {
        writeOverlay(tmp, 'runtime:\n  active_packs:\n    - php\n');
        process.env['CLAUDE_PROJECT_DIR'] = tmp;
        const rc = main(['--platform', 'claude']);
        expect(rc).toBe(0);
        expect(spy.text()).toContain('profile still active');
    });
});

// ── Golden parity vs python3 (full stdout + stderr + exit) ──────────

const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runScript(cmd: string, args: string[]): RunResult {
    // .py hook needs `src` on PYTHONPATH for `scripts.config.session_profiles`
    // to resolve (deployed import root). See header note.
    const env =
        cmd === 'python3'
            ? { ...process.env, PYTHONPATH: 'src', CLAUDE_PROJECT_DIR: '', AGENT_CONFIG_PROJECT_DIR: '' }
            : { ...process.env, CLAUDE_PROJECT_DIR: '', AGENT_CONFIG_PROJECT_DIR: '' };
    const res = spawnSync(cmd, args, {
        input: '{"hook_event_name": "session_start"}',
        encoding: 'utf8',
        env,
        cwd: REPO_ROOT,
    });
    return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

describe.skipIf(!py3)('profile_staleness — golden parity', () => {
    function scenario(name: string, body: string | null): void {
        it(name, () => {
            const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-py-'));
            const tsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-ts-'));
            try {
                if (body !== null) {
                    writeOverlay(pyDir, body);
                    writeOverlay(tsDir, body);
                }
                const pyOut = runScript('python3', [PY_SCRIPT, '--root', pyDir, '--platform', 'claude']);
                const tsOut = runScript(TSX_BIN, [TS_SCRIPT, '--root', tsDir, '--platform', 'claude']);
                expect(tsOut.status).toBe(pyOut.status);
                expect(tsOut.stdout).toBe(pyOut.stdout);
                expect(tsOut.stderr).toBe(pyOut.stderr);
            } finally {
                fs.rmSync(pyDir, { recursive: true, force: true });
                fs.rmSync(tsDir, { recursive: true, force: true });
            }
        });
    }

    scenario('active overlay', 'runtime:\n  active_packs:\n    - laravel\n');
    scenario('multiple packs', 'runtime:\n  active_packs:\n    - laravel\n    - php\n');
    scenario('no overlay', null);
    scenario('empty list', 'runtime:\n  active_packs: []\n');
});
