// Golden-parity tests for src/agent-src/templates/scripts/memory_hash.ts.
//
// The CONSUMER-shipped template twin. Its template `.py` is byte-identical to
// the dev-side `src/scripts/memory_hash.py`, so this twin reuses the dev-side
// logic verbatim. These tests differential python3 vs tsx on the template files
// directly (distinct `templates_` prefix to avoid colliding with the dev-side
// `tests/scripts/memory_hash.test.ts`). ADR-094 parity contract: byte-identical
// stdout/stderr/exit. argparse derives the prog token from the script basename
// (`memory_hash.py` vs `memory_hash`), so usage/error prog tokens are NOT a
// parity contract — normalized away before comparing.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] !== undefined
        ? resolve(REPO_ROOT, process.env['TSX_BIN'])
        : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(DIR, 'memory_hash.ts');
const PY_SCRIPT = join(DIR, 'memory_hash.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

interface Run {
    stdout: string;
    stderr: string;
    status: number;
}
function runTs(args: readonly string[], input?: string): Run {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        ...(input !== undefined ? { input } : {}),
    });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
function runPy(args: readonly string[], input?: string): Run {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        ...(input !== undefined ? { input } : {}),
    });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 };
}
// Prog token is filename-derived (memory_hash.py vs memory_hash) — not parity.
function normProg(s: string): string {
    return s.replace(/memory_hash\.py/g, 'memory_hash').trimEnd();
}

describe.skipIf(!HAVE_PYTHON)('templates/memory_hash — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-memhash-'));
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    const jsonCases: ReadonlyArray<unknown> = [
        { id: 'x', body: 'b', tags: ['z', 'a'] },
        { id: 'café ☕', nested: { z: 1, a: 2 }, list: [3, 2, 1] },
        ['a', 'b', { k: 'v' }],
        { bool: true, none: null, num: 42, flt: 3.14 },
        { unicode: 'naïve — résumé', emoji: '🎯' },
    ];

    it.each(jsonCases.map((c) => [JSON.stringify(c)]))('--json-stdin parity for %s', (input) => {
        const ts = runTs(['--json-stdin'], input);
        const py = runPy(['--json-stdin'], input);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--json-stdin scalar error parity (exit 1)', () => {
        const input = '"justastring"';
        const ts = runTs(['--json-stdin'], input);
        const py = runPy(['--json-stdin'], input);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
    });

    it('--yaml date scalar parity', () => {
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

    it('--yaml datetime scalar parity', () => {
        const p = join(tmp, 'dt.yml');
        writeFileSync(p, 'id: y\nts: 2026-01-01T13:45:30Z\n');
        const ts = runTs(['--yaml', p]);
        const py = runPy(['--yaml', p]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    it('mutually-exclusive args parity (exit 2)', () => {
        const p = join(tmp, 'm.yml');
        writeFileSync(p, 'id: x\n');
        const ts = runTs(['--yaml', p, '--json-stdin']);
        const py = runPy(['--yaml', p, '--json-stdin']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(normProg(ts.stderr)).toBe(normProg(py.stderr));
    });

    it('no-arg required-group parity (exit 2)', () => {
        const ts = runTs([]);
        const py = runPy([]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(normProg(ts.stderr)).toBe(normProg(py.stderr));
    });
});
