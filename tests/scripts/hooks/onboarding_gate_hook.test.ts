
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, STATE_DIR, STATE_FILE } from '../../../src/scripts/onboarding_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'onboarding_gate_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

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

interface RunResult {
    status: number | null;
    state: Record<string, unknown> | null;
}
