
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run } from '../../../src/scripts/first_run_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'first_run_gate_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const ACTION_FILE = '.augment/.first-run-action-needed.md';

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

interface RunResult {
    stdout: string;
    stderr: string;
    status: number | null;
    actionFile: string | null;
}
