// Pure-TS coverage for the `explain.enable_last: false` short-circuit of
// `agent-config explain last` (ADR-200 py2ts). The golden-parity suite in
// `cmd_explain.test.ts` exercises happy-path / quiet / json / missing-state /
// v0-skew but NOT the disabled-by-settings exit gate; this twin closes that
// gap, porting tests/cli/explain_last/test_cli.py
// (`test_disabled_by_settings_exits_zero` + `test_disabled_via_in_process_returns_zero`).
//
// Drives the exported `main(argv)` directly and captures `process.stdout`
// (the command's `print` helper writes there) — no python, no subprocess.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/_cli/cmd_explain.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let tmp: string;

// Minimal seeded project root (router + preset + profile) — same shape the
// explain_last conftest builds, so the resolvers don't fall over before the
// disabled gate fires.
const ROUTER = JSON.stringify({
    schema_version: 1,
    kernel: ['direct-answers', 'no-cheap-questions'],
    tier_1: [{ id: 'architecture', triggers: [{ keyword: 'controller' }] }],
    tier_2: [],
});

function seedProject(root: string): void {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), ROUTER, 'utf-8');
    const presets = path.join(root, '.agent-src.uncondensed', 'presets');
    fs.mkdirSync(presets, { recursive: true });
    fs.writeFileSync(
        path.join(presets, 'balanced.yml'),
        'preset:\n  id: balanced\n  cost: {daily_max_usd: 10, weekly_max_usd: 50, monthly_max_usd: 150}\n  autonomy: {default: auto}\n',
        'utf-8',
    );
    const profiles = path.join(root, '.agent-src.uncondensed', 'profiles');
    fs.mkdirSync(profiles, { recursive: true });
    fs.writeFileSync(
        path.join(profiles, 'developer.yml'),
        'profile:\n  id: developer\n  preset: balanced\n',
        'utf-8',
    );
}

/** Copy a canonical `.work-state.json` fixture into the project root by name. */
function copyState(root: string, name: string): void {
    const src = path.resolve(HERE, '..', '..', 'fixtures', 'explain_last', name);
    fs.copyFileSync(src, path.join(root, '.work-state.json'));
}

let stdoutSpy: { mockRestore: () => void };
let captured: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'explain-disabled-'));
    seedProject(tmp);
    captured = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        return true;
    });
});

afterEach(() => {
    stdoutSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('cmd_explain — explain.enable_last: false short-circuit', () => {
    it('disabled-by-settings exits 0 with the disabled-by-settings message', () => {
        copyState(tmp, 'work-state.success.json');
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'explain:\n  enable_last: false\n',
            'utf-8',
        );

        const rc = main(['last', '--project', tmp]);
        expect(rc).toBe(0);
        // Same surface the python CLI test asserts: "disabled by settings"
        // wording + the `explain.enable_last` key name, both on stdout.
        expect(captured).toContain('disabled by settings');
        expect(captured).toContain('explain.enable_last');
    });
});
