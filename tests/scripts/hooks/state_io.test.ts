// Tests for src/scripts/hooks/state_io.ts (py2ts Phase 6 — hooks core).
//
// Ports the TS-portable cases from tests/hooks/test_concurrency.py
// (state-dir creation, clean overwrite, JSON round-trip) plus replay-mode
// no-op and feedback_dir path-traversal coverage. Adds a JSON-byte parity
// layer: Python atomic_write_json vs TS atomic_write_json must write the
// exact same bytes (the Python json.dumps(indent=2) + "\n" contract).
// Skipped without python3 for the parity layer only.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    atomic_write_json,
    atomic_write_text,
    FEEDBACK_DIRNAME,
    feedback_dir,
    is_replay_mode,
    LOCK_BASENAME,
    REPLAY_ENV_VAR,
} from '../../../src/scripts/hooks/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'state_io.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-'));
    delete process.env[REPLAY_ENV_VAR];
});
afterEach(() => {
    delete process.env[REPLAY_ENV_VAR];
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('state_io — constants', () => {
    it('exports the documented constants', () => {
        expect(LOCK_BASENAME).toBe('.dispatcher.lock');
        expect(FEEDBACK_DIRNAME).toBe('.dispatcher');
        expect(REPLAY_ENV_VAR).toBe('AGENT_CONFIG_REPLAY');
    });
});

describe('state_io — atomic_write_json', () => {
    it('auto-creates the nested state dir', () => {
        const target = path.join(tmp, 'deeper', 'agents', 'runtime', 'state', 'fresh.json');
        expect(fs.existsSync(path.dirname(target))).toBe(false);
        atomic_write_json(target, { hello: 'world' });
        expect(fs.statSync(target).isFile()).toBe(true);
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))['hello']).toBe('world');
        // Lock sentinel appears alongside.
        expect(fs.existsSync(path.join(path.dirname(target), LOCK_BASENAME))).toBe(true);
    });

    it('overwrites cleanly without leaking tmp siblings', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'overwrite.json');
        for (let i = 0; i < 5; i += 1) {
            atomic_write_json(target, { i });
        }
        expect(JSON.parse(fs.readFileSync(target, 'utf8'))['i']).toBe(4);
        const siblings = fs.readdirSync(path.dirname(target)).sort();
        const leftover = siblings.filter(
            (n) => n !== path.basename(target) && n !== LOCK_BASENAME,
        );
        expect(leftover).toEqual([]);
    });

    it('writes Python-style indent=2 JSON with trailing newline', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'shape.json');
        atomic_write_json(target, { b: 2, a: [1, 2], nested: { x: true } });
        const body = fs.readFileSync(target, 'utf8');
        // Insertion order preserved (Python dict order), 2-space indent, trailing \n.
        expect(body).toBe(
            '{\n  "b": 2,\n  "a": [\n    1,\n    2\n  ],\n  "nested": {\n    "x": true\n  }\n}\n',
        );
    });

    it('empty containers render compactly', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'empty.json');
        atomic_write_json(target, { arr: [], obj: {} });
        expect(fs.readFileSync(target, 'utf8')).toBe('{\n  "arr": [],\n  "obj": {}\n}\n');
    });
});

describe('state_io — atomic_write_text', () => {
    it('writes verbatim text + creates dir', () => {
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'note.txt');
        atomic_write_text(target, 'raw transcript\n');
        expect(fs.readFileSync(target, 'utf8')).toBe('raw transcript\n');
    });
});

describe('state_io — replay mode', () => {
    it('is_replay_mode reflects the env flag', () => {
        expect(is_replay_mode()).toBe(false);
        process.env[REPLAY_ENV_VAR] = '1';
        expect(is_replay_mode()).toBe(true);
        process.env[REPLAY_ENV_VAR] = ' 1 ';
        expect(is_replay_mode()).toBe(true);
        process.env[REPLAY_ENV_VAR] = '0';
        expect(is_replay_mode()).toBe(false);
    });

    it('atomic_write_json is a no-op under replay', () => {
        process.env[REPLAY_ENV_VAR] = '1';
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'replay.json');
        atomic_write_json(target, { x: 1 });
        expect(fs.existsSync(target)).toBe(false);
    });

    it('atomic_write_text is a no-op under replay', () => {
        process.env[REPLAY_ENV_VAR] = '1';
        const target = path.join(tmp, 'agents', 'runtime', 'state', 'replay.txt');
        atomic_write_text(target, 'x');
        expect(fs.existsSync(target)).toBe(false);
    });
});

describe('state_io — feedback_dir', () => {
    it('builds the per-session slot', () => {
        expect(feedback_dir('/root', 'sess-1')).toBe(path.join('/root', '.dispatcher', 'sess-1'));
    });
    it('empty session id falls back to unknown-session', () => {
        expect(feedback_dir('/root', '')).toBe(path.join('/root', '.dispatcher', 'unknown-session'));
    });
    it('neutralises path traversal', () => {
        const out = feedback_dir('/root', '../etc/passwd');
        expect(out).not.toContain('..');
        expect(out).toBe(path.join('/root', '.dispatcher', '__etc_passwd'));
    });
    it('neutralises backslashes', () => {
        expect(feedback_dir('/root', 'a\\b')).toBe(path.join('/root', '.dispatcher', 'a_b'));
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('state_io — JSON byte parity (python3 vs TS)', () => {
    const DRIVER = `
import json, sys
sys.path.insert(0, sys.argv[1])
import state_io as s
target = sys.argv[2]
payload = json.loads(sys.argv[3])
s.atomic_write_json(target, payload)
sys.stdout.buffer.write(open(target, "rb").read())
`;
    const HOOKS_DIR = path.dirname(PY);

    function pyBytes(payload: unknown): Buffer {
        const pyTarget = path.join(tmp, 'py.json');
        const r = spawnSync('python3', ['-c', DRIVER, HOOKS_DIR, pyTarget, JSON.stringify(payload)], {
            encoding: 'buffer',
        });
        expect(r.status, r.stderr?.toString()).toBe(0);
        return r.stdout;
    }

    function tsBytes(payload: unknown): Buffer {
        const tsTarget = path.join(tmp, 'agents', 'runtime', 'state', 'ts.json');
        atomic_write_json(tsTarget, payload);
        return fs.readFileSync(tsTarget);
    }

    const PAYLOADS: unknown[] = [
        { hello: 'world' },
        { b: 2, a: [1, 2], nested: { x: true, y: null } },
        { arr: [], obj: {}, flag: false },
        { unicode: 'café — naïve — 日本語', emoji: '🚀' },
        { schema_version: 1, concerns: [{ concern: 'x', exit_code: 0, severity: 'allow' }] },
        { ints: [0, -1, 42, 1000000] },
    ];

    for (const [idx, payload] of PAYLOADS.entries()) {
        it(`payload #${idx} bytes match`, () => {
            expect(tsBytes(payload).equals(pyBytes(payload))).toBe(true);
        });
    }
});
