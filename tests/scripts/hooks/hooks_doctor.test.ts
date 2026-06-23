
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as doctor from '../../../src/scripts/hooks_doctor.js';
import { _load_yaml } from '../../../src/scripts/hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks_doctor.ts');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function loadManifest() {
    return _load_yaml(MANIFEST);
}

let tmp: string;
const DEFAULT_TRAMP = doctor.TRAMPOLINE_DIR;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-doctor-'));
});
afterEach(() => {
    doctor._set_trampoline_dir(DEFAULT_TRAMP);
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('hooks_doctor — collect', () => {
    it('returns every concern declared in the manifest', () => {
        const manifest = loadManifest();
        const payload = doctor.collect(tmp, manifest);
        expect(payload.schema_version).toBe(1);
        const names = new Set(payload.concerns.map((c) => c.concern));
        const expected = new Set(Object.keys((manifest['concerns'] as object) ?? {}));
        expect(names).toEqual(expected);
        for (const c of payload.concerns) {
            expect(typeof c.fail_closed).toBe('boolean');
            expect(c.script).toBeTruthy();
        }
    });

    it('detects trampolines that ship in the package', () => {
        const payload = doctor.collect(tmp, loadManifest());
        const tramp = new Map(payload.trampolines.map((t) => [t.platform, t]));
        for (const p of ['augment', 'cursor', 'cline', 'windsurf', 'gemini', 'cowork']) {
            expect(tramp.get(p)?.present).toBe(true);
            expect(tramp.get(p)?.missing).toBe(false);
        }
        expect(tramp.get('copilot')?.required).toBe(false);
        expect(tramp.get('copilot')?.missing).toBe(false);
    });

    it('flags missing trampolines', () => {
        const fakeDir = path.join(tmp, 'trampolines-empty');
        fs.mkdirSync(fakeDir);
        doctor._set_trampoline_dir(fakeDir);
        const payload = doctor.collect(tmp, loadManifest());
        const tramp = new Map(payload.trampolines.map((t) => [t.platform, t]));
        for (const p of ['augment', 'cursor', 'cline', 'windsurf', 'gemini']) {
            expect(tramp.get(p)?.missing).toBe(true);
        }
        expect(tramp.get('copilot')?.missing).toBe(false);
    });

    it('last_feedback picks the latest session', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state', '.dispatcher');
        const older = path.join(stateDir, 'session-a');
        const newer = path.join(stateDir, 'session-b');
        fs.mkdirSync(older, { recursive: true });
        fs.mkdirSync(newer, { recursive: true });
        fs.writeFileSync(path.join(older, 'chat-history.json'), '{}');
        fs.writeFileSync(path.join(newer, 'chat-history.json'), '{}');
        const past = Date.now() / 1000 - 60;
        fs.utimesSync(path.join(older, 'chat-history.json'), past, past);
        const payload = doctor.collect(tmp, loadManifest());
        const chat = payload.concerns.find((c) => c.concern === 'chat-history');
        expect(chat?.last_feedback).not.toBeNull();
        expect(chat?.last_feedback?.endsWith(path.join('session-b', 'chat-history.json'))).toBe(true);
    });

    it('surfaces the concern state file', () => {
        const stateDir = path.join(tmp, 'agents', 'runtime', 'state');
        fs.mkdirSync(stateDir, { recursive: true });
        fs.writeFileSync(path.join(stateDir, 'context-hygiene.json'), '{}');
        const payload = doctor.collect(tmp, loadManifest());
        const ch = payload.concerns.find((c) => c.concern === 'context-hygiene');
        expect(ch?.state_file).toBe(path.join('agents', 'runtime', 'state', 'context-hygiene.json'));
    });
});

describe('hooks_doctor — main / strict', () => {
    it('json format is well-formed', () => {
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string | Uint8Array): boolean => {
            chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString());
            return true;
        }) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = doctor.main(['--format', 'json', '--project-root', tmp]);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(0);
        const parsed = JSON.parse(chunks.join(''));
        expect(parsed['schema_version']).toBe(1);
        expect('concerns' in parsed).toBe(true);
        expect('trampolines' in parsed).toBe(true);
        expect('platforms' in parsed).toBe(true);
    });

    it('strict fails on missing bridges', () => {
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = doctor.main(['--format', 'json', '--project-root', tmp, '--strict']);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(1);
    });

    it('strict zero when everything clean', () => {
        const manifest = loadManifest();
        for (const [platform, pair] of Object.entries(doctor.hooks_status.PLATFORM_BRIDGES)) {
            void platform;
            const rel = pair[0];
            if (!rel) continue;
            const bridge = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(bridge), { recursive: true });
            if (rel.endsWith('/hooks')) {
                fs.mkdirSync(bridge, { recursive: true });
                fs.writeFileSync(path.join(bridge, 'placeholder'), '{}');
            } else {
                fs.writeFileSync(bridge, '{}');
            }
        }
        const payload = doctor.collect(tmp, manifest);
        expect(doctor._final_exit_code(payload, true)).toBe(0);
    });
});

interface RunResult {
    status: number | null;
    stdout: string;
}
