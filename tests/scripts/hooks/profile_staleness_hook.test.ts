
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../../src/scripts/profile_staleness_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'profile_staleness_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const OVERLAY_REL = path.join('agents', 'settings', '.agent-settings.local.yml');

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

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}
