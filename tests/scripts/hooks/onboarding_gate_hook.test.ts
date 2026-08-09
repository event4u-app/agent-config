
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    resolve_settings_path,
    run,
    SETTINGS_CANDIDATES,
    STATE_DIR,
    STATE_FILE,
} from '../../../src/scripts/onboarding_gate_hook.js';

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

    // road-to-capability-answerability 4.2. The hook read ONLY the repo-root
    // legacy path, so on a canonically installed consumer the settings file was
    // always "missing" and the gate resolved to do-not-block. An Iron-Law gate
    // that cannot fire on a correct install is not a gate.
    it('fires on a canonically installed consumer (agents/settings/)', () => {
        const canonical = path.join(tmp, 'agents', 'settings', '.agent-settings.yml');
        fs.mkdirSync(path.dirname(canonical), { recursive: true });
        fs.writeFileSync(canonical, 'onboarding:\n  onboarded: false\n');

        expect(run({ consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['required']).toBe(true);
        expect(s['reason']).toBe('explicit_false');
        expect(s['settings_present']).toBe(true);
    });

    it('prefers the canonical file over the legacy root file', () => {
        const canonical = path.join(tmp, 'agents', 'settings', '.agent-settings.yml');
        fs.mkdirSync(path.dirname(canonical), { recursive: true });
        fs.writeFileSync(canonical, 'onboarding:\n  onboarded: false\n');
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: true\n');

        run({ consumer_root: tmp });
        // Canonical wins: the legacy file must not be able to silence the gate
        // on an install that has already moved to the current layout.
        expect(state(tmp)['reason']).toBe('explicit_false');
        expect(resolve_settings_path(tmp)).toBe(canonical);
    });

    it('still reads the legacy root file when it is the only one', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'onboarding:\n  onboarded: false\n');
        expect(resolve_settings_path(tmp)).toBe(path.join(tmp, '.agent-settings.yml'));
        run({ consumer_root: tmp });
        expect(state(tmp)['required']).toBe(true);
    });

    it('names the canonical path when neither file exists', () => {
        // The "missing" branch stays do-not-block by design, but it should point
        // at the file a consumer ought to create, not the legacy one.
        expect(resolve_settings_path(tmp)).toBe(path.join(tmp, SETTINGS_CANDIDATES[0] as string));
        run({ consumer_root: tmp });
        const s = state(tmp);
        expect(s['required']).toBe(false);
        expect(s['settings_present']).toBe(false);
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

