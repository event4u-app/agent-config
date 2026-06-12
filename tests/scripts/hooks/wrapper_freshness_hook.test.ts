// Tests for src/scripts/wrapper_freshness_hook.ts (py2ts Phase 6 — hooks).
//
// 1:1 port of tests/hooks/test_wrapper_freshness.py (refresh stale, never
// create, no-op in source repo, no-op when fresh) plus a golden-parity
// layer: python3 vs tsx run with --root pointed at an isolated tmp project,
// asserting identical exit + identical resulting wrapper bytes +
// stdout/stderr shape. Parity skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../../src/scripts/wrapper_freshness_hook.js';
import { install_cli_wrapper } from '../../../src/scripts/_lib/cli_wrapper.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'wrapper_freshness_hook.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'wrapper_freshness_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const STALE = '#!/usr/bin/env bash\n# old fallback-less wrapper\nexit 127\n';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapper-fresh-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('wrapper_freshness — self-heal', () => {
    it('refreshes a stale wrapper', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        const body = fs.readFileSync(wrapper, 'utf8');
        expect(body).toContain('globally-installed');
        expect(body).not.toContain('old fallback-less wrapper');
    });

    it('does not create a wrapper', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'agent-config'))).toBe(false);
    });

    it('no-op in source repo', () => {
        fs.mkdirSync(path.join(tmp, 'dist', 'agent-src'), { recursive: true });
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(wrapper, 'utf8')).toBe(STALE);
    });

    it('no-op when already fresh', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        install_cli_wrapper(tmp); // identical to template
        const before = fs.readFileSync(path.join(tmp, 'agent-config'), 'utf8');
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(path.join(tmp, 'agent-config'), 'utf8')).toBe(before);
    });

    it('source-repo guard fires on package.json name', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "@event4u/agent-config"}');
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(wrapper, 'utf8')).toBe(STALE);
    });
});

// ── Golden parity vs python3 ─────────────────────────────────────────

const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    wrapper: string | null;
}

function runScript(cmd: string, args: string[], root: string): RunResult {
    // The .py hook imports `scripts._lib.cli_wrapper`; in the src/scripts
    // layout that only resolves with `src` on PYTHONPATH (mirrors the
    // deployed import root — pyproject sets pythonpath=["src","."]). Without
    // it the .py hook is inert. tsx imports the real cli_wrapper.ts directly.
    const env =
        cmd === 'python3'
            ? { ...process.env, PYTHONPATH: 'src' }
            : { ...process.env };
    const res = spawnSync(cmd, args, {
        input: '{"hook_event_name": "session_start"}',
        encoding: 'utf8',
        env,
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const wp = path.join(root, 'agent-config');
    return {
        status: res.status,
        stdout: res.stdout ?? '',
        wrapper: fs.existsSync(wp) ? fs.readFileSync(wp, 'utf8') : null,
    };
}

describe.skipIf(!py3)('wrapper_freshness — golden parity', () => {
    function scenario(name: string, setup: (root: string) => void): void {
        it(name, () => {
            const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-py-'));
            const tsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-ts-'));
            try {
                setup(pyDir);
                setup(tsDir);
                const pyOut = runScript(
                    'python3',
                    [PY_SCRIPT, '--root', pyDir, '--platform', 'claude'],
                    pyDir,
                );
                const tsOut = runScript(
                    TSX_BIN,
                    [TS_SCRIPT, '--root', tsDir, '--platform', 'claude'],
                    tsDir,
                );
                expect(tsOut.status).toBe(pyOut.status);
                expect(tsOut.wrapper).toBe(pyOut.wrapper);
                // stdout carries the JSON decision with the absolute --root
                // path baked in; compare with each dir's path normalised out.
                expect(tsOut.stdout.replace(tsDir, '<ROOT>')).toBe(
                    pyOut.stdout.replace(pyDir, '<ROOT>'),
                );
            } finally {
                fs.rmSync(pyDir, { recursive: true, force: true });
                fs.rmSync(tsDir, { recursive: true, force: true });
            }
        });
    }

    scenario('stale wrapper → re-stamped', (root) => {
        fs.writeFileSync(path.join(root, 'package.json'), '{"name": "some-app"}');
        fs.writeFileSync(path.join(root, 'agent-config'), STALE);
    });

    scenario('no wrapper → never create', (root) => {
        fs.writeFileSync(path.join(root, 'package.json'), '{"name": "some-app"}');
    });

    scenario('source repo → no-op', (root) => {
        fs.mkdirSync(path.join(root, 'dist', 'agent-src'), { recursive: true });
        fs.writeFileSync(path.join(root, 'agent-config'), STALE);
    });
});
