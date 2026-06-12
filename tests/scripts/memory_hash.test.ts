// Tests for src/scripts/memory_hash.ts — content-addressed entry hash.
//
// 1:1 port of tests/test_memory_hash.py (pytest → vitest, ADR-090 parity
// contract). The pytest suite imports the module and calls hash_entry()
// directly, so these mirror that by importing the TS twin. A trailing
// golden-parity block runs python3 + tsx on identical inputs (hash_entry via
// a python3 -c driver, plus both CLI surfaces) and asserts byte-identical
// output, skipped when python3 is absent.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonical_json, hash_entry, HASH_LEN } from '../../src/scripts/memory_hash.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_hash.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_hash.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

// --- 1:1 port of test_memory_hash.py -------------------------------------

describe('memory_hash.ts — hash_entry', () => {
    it('hash length is 12 hex', () => {
        const h = hash_entry({ id: 'x', body: 'b' });
        expect(h.length).toBe(12);
        expect([...h].every((c) => '0123456789abcdef'.includes(c))).toBe(true);
    });

    it('same entry same hash (key order differs)', () => {
        const a = { id: 'x', body: 'b', tags: ['z', 'a'] };
        const b = { tags: ['z', 'a'], body: 'b', id: 'x' };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('different entry different hash', () => {
        expect(hash_entry({ id: 'x' })).not.toBe(hash_entry({ id: 'y' }));
    });

    it('whitespace does not matter', () => {
        const a = { body: 'hello  world' };
        const b = { body: 'hello  world' };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('list order matters', () => {
        // Lists in YAML represent ordered sequences (e.g. path globs) —
        // reordering MUST produce a different hash.
        const a = { paths: ['a', 'b'] };
        const b = { paths: ['b', 'a'] };
        expect(hash_entry(a)).not.toBe(hash_entry(b));
    });

    it('nested dict keys sorted', () => {
        const a = { meta: { x: 1, y: 2 } };
        const b = { meta: { y: 2, x: 1 } };
        expect(hash_entry(a)).toBe(hash_entry(b));
    });

    it('HASH_LEN constant matches the Python value', () => {
        expect(HASH_LEN).toBe(12);
    });

    it('canonical_json sorts keys and omits whitespace', () => {
        expect(canonical_json({ b: 1, a: 2 }).toString('utf-8')).toBe('{"a":2,"b":1}');
    });
});

// --- golden parity vs python3 --------------------------------------------

describe.skipIf(!HAVE_PYTHON)('memory_hash — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'memhash-'));
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    // hash_entry is a function, not a CLI — differential it via a python3 -c
    // driver that imports the module and prints the hash for a JSON input.
    function pyHash(jsonInput: string): { hash: string; status: number } {
        const driver =
            'import sys, json; sys.path.insert(0, sys.argv[1]); ' +
            'import memory_hash as m; print(m.hash_entry(json.loads(sys.stdin.read())))';
        const r = spawnSync('python3', ['-c', driver, join(REPO_ROOT, 'src', 'scripts')], {
            input: jsonInput,
            encoding: 'utf8',
        });
        return { hash: r.stdout.trim(), status: r.status ?? -1 };
    }

    const cases: ReadonlyArray<unknown> = [
        { id: 'x', body: 'b', tags: ['z', 'a'] },
        { id: 'café ☕', nested: { z: 1, a: 2 }, list: [3, 2, 1] },
        ['a', 'b', { k: 'v' }],
        { bool: true, none: null, num: 42, flt: 3.14 },
        { unicode: 'naïve — résumé', emoji: '🎯' },
    ];

    it.each(cases.map((c) => [JSON.stringify(c)]))('hash_entry parity for %s', (jsonInput) => {
        expect(hash_entry(JSON.parse(jsonInput))).toBe(pyHash(jsonInput).hash);
    });

    function runTs(args: readonly string[], input?: string): { stdout: string; stderr: string; status: number } {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', ...(input !== undefined ? { input } : {}) });
        return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
    }
    function runPy(args: readonly string[], input?: string): { stdout: string; stderr: string; status: number } {
        const r = spawnSync('python3', [PY_SCRIPT, ...args], {
            encoding: 'utf8',
            ...(input !== undefined ? { input } : {}),
        });
        return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
    }

    it('CLI --json-stdin parity', () => {
        const input = JSON.stringify({ id: 'x', tags: ['z', 'a'], n: 1 });
        const ts = runTs(['--json-stdin'], input);
        const py = runPy(['--json-stdin'], input);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    it('CLI --json-stdin scalar error parity (exit 1)', () => {
        const input = '"justastring"';
        const ts = runTs(['--json-stdin'], input);
        const py = runPy(['--json-stdin'], input);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('CLI --yaml with date scalar parity', () => {
        const p = join(tmp, 'entry.yml');
        writeFileSync(
            p,
            ['id: own-01', 'status: active', 'last_validated: 2026-01-01', 'review_after_days: 180', 'path: "app/Http/**"'].join('\n') + '\n',
        );
        const ts = runTs(['--yaml', p]);
        const py = runPy(['--yaml', p]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    it('CLI --yaml with datetime scalar parity', () => {
        const p = join(tmp, 'dt.yml');
        writeFileSync(p, 'id: y\nts: 2026-01-01T13:45:30Z\n');
        const ts = runTs(['--yaml', p]);
        const py = runPy(['--yaml', p]);
        // `id: y` stays a string in PyYAML (bare y is not a 1.1 bool there).
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    // argparse derives the prog name from the script basename (`memory_hash.py`
    // vs `memory_hash`), so the prog token in usage + error lines is filename-
    // dependent and NOT a parity contract (per ADR-090). Normalize the prog
    // token away, then compare the (usage + error) body byte-for-byte.
    function errBody(stderr: string): string {
        return stderr.replace(/memory_hash\.py/g, 'memory_hash').trimEnd();
    }

    it('CLI mutually-exclusive args parity (exit 2)', () => {
        const p = join(tmp, 'm.yml');
        writeFileSync(p, 'id: x\n');
        const ts = runTs(['--yaml', p, '--json-stdin']);
        const py = runPy(['--yaml', p, '--json-stdin']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errBody(ts.stderr)).toBe(errBody(py.stderr));
    });

    it('CLI no-arg required-group parity (exit 2)', () => {
        const ts = runTs([]);
        const py = runPy([]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(errBody(ts.stderr)).toBe(errBody(py.stderr));
    });
});
