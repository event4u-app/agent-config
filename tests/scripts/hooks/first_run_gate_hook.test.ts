// Tests for src/scripts/first_run_gate_hook.ts (py2ts Phase 6 — hooks).
//
// 1:1 port of tests/hooks/test_first_run_gate.py (fixtures A/B/C —
// enabled+unscaffolded, enabled+complete, not-enabled) plus a golden-parity
// layer: python3 first_run_gate_hook.py vs tsx first_run_gate_hook.ts fed
// identical stdin + CLAUDE_PROJECT_DIR, asserting byte-identical
// stdout+stderr+exit AND identical action-file writes in an isolated tmp
// project. Parity skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run } from '../../../src/scripts/first_run_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'first_run_gate_hook.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'first_run_gate_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const ACTION_FILE = '.augment/.first-run-action-needed.md';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function makeSettings(root: string, pluginEnabled: boolean): void {
    const target = path.join(root, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        JSON.stringify({ enabledPlugins: { 'agent-config@event4u-agent-config': true } }),
    );
    if (!pluginEnabled) {
        // mirror python helper: don't write when not enabled — caller passes
        // pluginEnabled=true only; false handled by the caller not invoking this.
    }
}

function makeSymlinkExecutable(root: string): void {
    const target = path.join(root, 'agent-config');
    fs.writeFileSync(target, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(target, 0o755);
}

function makeRegenerator(root: string): void {
    const target = path.join(root, '.augment', 'scripts', 'update_roadmap_progress.py');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "#!/usr/bin/env python3\nprint('regen')\n");
}

let tmp: string;
let stderrSpy: ReturnType<typeof captureStderr>;

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

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'first-run-gate-'));
    stderrSpy = captureStderr();
    delete process.env['AGENT_CONFIG_REPLAY'];
});
afterEach(() => {
    stderrSpy.restore();
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ── Fixture A — enabled + unscaffolded → action file + stderr ───────

describe('first_run_gate — fixture A (enabled + unscaffolded)', () => {
    it('writes action file + stderr', () => {
        makeSettings(tmp, true);
        const rc = run(tmp);
        expect(rc).toBe(0);
        const actionFile = path.join(tmp, ACTION_FILE);
        expect(fs.existsSync(actionFile)).toBe(true);
        const body = fs.readFileSync(actionFile, 'utf8');
        expect(body).toContain('First-run action needed');
        expect(body).toContain('hooks:install --claude --regen');
        const err = stderrSpy.text();
        expect(err).toContain('first-run-gate');
        expect(err).toContain('scaffolding is missing');
    });

    it('partial scaffolding still writes', () => {
        makeSettings(tmp, true);
        makeSymlinkExecutable(tmp);
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(true);
    });
});

// ── Fixture B — enabled + setup complete → silent + cleanup ─────────

describe('first_run_gate — fixture B (enabled + complete)', () => {
    it('is silent when setup complete', () => {
        makeSettings(tmp, true);
        makeSymlinkExecutable(tmp);
        makeRegenerator(tmp);
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(false);
        expect(stderrSpy.text()).not.toContain('first-run-gate');
    });

    it('cleans up a stale action file', () => {
        makeSettings(tmp, true);
        makeSymlinkExecutable(tmp);
        makeRegenerator(tmp);
        const stale = path.join(tmp, ACTION_FILE);
        fs.mkdirSync(path.dirname(stale), { recursive: true });
        fs.writeFileSync(stale, 'stale content');
        expect(fs.existsSync(stale)).toBe(true);
        run(tmp);
        expect(fs.existsSync(stale)).toBe(false);
    });
});

// ── Fixture C — plugin not enabled → silent ─────────────────────────

describe('first_run_gate — fixture C (not enabled)', () => {
    it('no settings file is silent', () => {
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(false);
        expect(stderrSpy.text()).not.toContain('first-run-gate');
    });

    it('enabledPlugins false is silent', () => {
        const target = path.join(tmp, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            JSON.stringify({ enabledPlugins: { 'agent-config@event4u-agent-config': false } }),
        );
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(false);
    });

    it('malformed settings treated as not enabled', () => {
        const target = path.join(tmp, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'not json {');
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(false);
    });
});

// ── Replay mode no-op ────────────────────────────────────────────────

describe('first_run_gate — replay mode', () => {
    it('is a no-op under AGENT_CONFIG_REPLAY=1', () => {
        makeSettings(tmp, true);
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        const rc = run(tmp);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(tmp, ACTION_FILE))).toBe(false);
    });
});

// ── Golden parity vs python3 ─────────────────────────────────────────

const py3 = hasPython3();

interface RunResult {
    stdout: string;
    stderr: string;
    status: number | null;
    actionFile: string | null;
}

function runScript(cmd: string, args: string[], projectDir: string): RunResult {
    const res = spawnSync(cmd, args, {
        input: '{"hook_event_name": "session_start", "session_id": "s1"}',
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, AGENT_CONFIG_REPLAY: '' },
    });
    const af = path.join(projectDir, ACTION_FILE);
    return {
        stdout: res.stdout ?? '',
        // strip the project-dir absolute path so the two runs compare equal
        // (the script only mentions a relative file path in stderr).
        stderr: res.stderr ?? '',
        status: res.status,
        actionFile: fs.existsSync(af) ? fs.readFileSync(af, 'utf8') : null,
    };
}

describe.skipIf(!py3)('first_run_gate — golden parity', () => {
    function scenario(name: string, setup: (root: string) => void): void {
        it(name, () => {
            const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frg-py-'));
            const tsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frg-ts-'));
            try {
                setup(pyDir);
                setup(tsDir);
                const pyOut = runScript('python3', [PY_SCRIPT, '--platform', 'claude'], pyDir);
                const tsOut = runScript(TSX_BIN, [TS_SCRIPT, '--platform', 'claude'], tsDir);
                expect(tsOut.status).toBe(pyOut.status);
                expect(tsOut.stdout).toBe(pyOut.stdout);
                expect(tsOut.stderr).toBe(pyOut.stderr);
                expect(tsOut.actionFile).toBe(pyOut.actionFile);
            } finally {
                fs.rmSync(pyDir, { recursive: true, force: true });
                fs.rmSync(tsDir, { recursive: true, force: true });
            }
        });
    }

    scenario('enabled + unscaffolded', (root) => {
        const t = path.join(root, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(t), { recursive: true });
        fs.writeFileSync(
            t,
            JSON.stringify({ enabledPlugins: { 'agent-config@event4u-agent-config': true } }),
        );
    });

    scenario('not enabled (no settings)', () => {
        /* empty project */
    });

    scenario('enabled + complete', (root) => {
        const t = path.join(root, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(t), { recursive: true });
        fs.writeFileSync(
            t,
            JSON.stringify({ enabledPlugins: { 'agent-config@event4u-agent-config': true } }),
        );
        const ac = path.join(root, 'agent-config');
        fs.writeFileSync(ac, '#!/bin/sh\nexit 0\n');
        fs.chmodSync(ac, 0o755);
        const reg = path.join(root, '.augment', 'scripts', 'update_roadmap_progress.py');
        fs.mkdirSync(path.dirname(reg), { recursive: true });
        fs.writeFileSync(reg, '#!/usr/bin/env python3\n');
    });
});
