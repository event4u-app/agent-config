// Tests for src/scripts/onboarding_gate_hook.ts (py2ts Phase 6 — hooks).
//
// 1:1 port of tests/test_onboarding_gate_hook.py (the line-scan YAML parser
// + state-file writer) plus a golden-parity layer: python3 vs tsx run in an
// isolated tmp project (chdir via cwd), asserting identical exit + identical
// state JSON (checked_at normalised — it is a wall-clock timestamp). Parity
// skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, STATE_DIR, STATE_FILE } from '../../../src/scripts/onboarding_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'onboarding_gate_hook.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'onboarding_gate_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function state(root: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'));
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-gate-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('onboarding_gate — read_onboarded / state writer', () => {
    it('required when onboarded false', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: false\n');
        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['required']).toBe(true);
        expect(s['reason']).toBe('explicit_false');
        expect(s['settings_present']).toBe(true);
    });

    it('not required when onboarded true', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: true\n');
        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['required']).toBe(false);
        expect(s['reason']).toBe('already_onboarded');
    });

    it('legacy project — no settings file', () => {
        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['required']).toBe(false);
        expect(s['reason']).toBe('settings_file_missing');
        expect(s['settings_present']).toBe(false);
    });

    it('legacy project — no onboarding section', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'user_name: Matze\nide: vscode\n');
        expect(run({ consumer_root: tmp })).toBe(0);
        expect(state(tmp)['reason']).toBe('key_missing');
    });

    it('legacy project — section without onboarded key', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'onboarding:\n  hint: legacy\nuser_name: Matze\n',
        );
        expect(run({ consumer_root: tmp })).toBe(0);
        expect(state(tmp)['reason']).toBe('key_missing');
    });

    it('yaml with comments and blank lines', () => {
        const body =
            '# top comment\n' +
            'user_name: Matze\n' +
            '\n' +
            'onboarding:\n' +
            '  # walked through /onboard\n' +
            '  onboarded: false  # gate active\n';
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), body);
        expect(run({ consumer_root: tmp })).toBe(0);
        expect(state(tmp)['required']).toBe(true);
    });

    it('unknown value is not required', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: maybe\n');
        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['required']).toBe(false);
        expect(String(s['reason']).startsWith('unknown_value:')).toBe(true);
    });

    it('state payload has iso timestamp', () => {
        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(String(s['checked_at'])).toContain('T');
        expect(String(s['checked_at']).endsWith('+00:00')).toBe(true);
    });

    it('atomic write does not leave .tmp', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: true\n');
        expect(run({ consumer_root: tmp })).toBe(0);
        const leftovers = fs
            .readdirSync(path.join(tmp, STATE_DIR))
            .filter((n) => n.endsWith('.tmp'));
        expect(leftovers).toEqual([]);
    });

    it('repeat runs overwrite', () => {
        const settings = path.join(tmp, '.agent-settings.yml');
        fs.writeFileSync(settings, 'onboarding:\n  onboarded: false\n');
        run({ consumer_root: tmp });
        expect(state(tmp)['required']).toBe(true);
        fs.writeFileSync(settings, 'onboarding:\n  onboarded: true\n');
        run({ consumer_root: tmp });
        const s = state(tmp);
        expect(s['required']).toBe(false);
        expect(s['reason']).toBe('already_onboarded');
    });
});

// ── Golden parity vs python3 ─────────────────────────────────────────

const py3 = hasPython3();

interface RunResult {
    status: number | null;
    state: Record<string, unknown> | null;
}

function runScript(cmd: string, args: string[], cwd: string): RunResult {
    const res = spawnSync(cmd, args, {
        input: '{"foo": "bar"}',
        encoding: 'utf8',
        cwd,
        env: { ...process.env },
    });
    const sf = path.join(cwd, STATE_FILE);
    let parsed: Record<string, unknown> | null = null;
    if (fs.existsSync(sf)) {
        parsed = JSON.parse(fs.readFileSync(sf, 'utf8'));
        // checked_at is a wall-clock timestamp — normalise for comparison.
        if (parsed && 'checked_at' in parsed) parsed['checked_at'] = '<TS>';
    }
    return { status: res.status, state: parsed };
}

describe.skipIf(!py3)('onboarding_gate — golden parity', () => {
    function scenario(name: string, body: string | null): void {
        it(name, () => {
            const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obg-py-'));
            const tsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obg-ts-'));
            try {
                if (body !== null) {
                    fs.writeFileSync(path.join(pyDir, '.agent-settings.yml'), body);
                    fs.writeFileSync(path.join(tsDir, '.agent-settings.yml'), body);
                }
                const pyOut = runScript('python3', [PY_SCRIPT, '--platform', 'augment'], pyDir);
                const tsOut = runScript(TSX_BIN, [TS_SCRIPT, '--platform', 'augment'], tsDir);
                expect(tsOut.status).toBe(pyOut.status);
                expect(tsOut.state).toEqual(pyOut.state);
            } finally {
                fs.rmSync(pyDir, { recursive: true, force: true });
                fs.rmSync(tsDir, { recursive: true, force: true });
            }
        });
    }

    scenario('onboarded false', 'onboarding:\n  onboarded: false\n');
    scenario('onboarded true', 'onboarding:\n  onboarded: true\n');
    scenario('no settings file', null);
    scenario('no onboarding section', 'user_name: Matze\nide: vscode\n');
    scenario('unknown value', 'onboarding:\n  onboarded: maybe\n');
    scenario('comments + blank lines', '# c\nuser_name: x\n\nonboarding:\n  onboarded: false  # x\n');
});
