// Tests for src/scripts/check_memory_proposal.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_memory_proposal.py — the pytest fixture's
// `monkeypatch.chdir` + `monkeypatch.setattr(gate, "INTAKE_ROOT", ...)` maps
// to _set_intake_root_for_test() pointed at a temp intake dir. Plus a
// golden-parity layer on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_memory_proposal.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_memory_proposal.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_memory_proposal.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
let intakeRoot: string;

function writeIntake(lines: Array<Record<string, unknown>>, name = 'signals-2026-04.jsonl'): void {
    fs.mkdirSync(intakeRoot, { recursive: true });
    const body = lines.map((o) => JSON.stringify(o)).join('\n') + (lines.length ? '\n' : '');
    fs.writeFileSync(path.join(intakeRoot, name), body, 'utf-8');
}

describe('check_memory_proposal — promotion gate (ported pytest)', () => {
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-'));
        intakeRoot = path.join(tmp, 'agents/memory/intake');
        gate._set_intake_root_for_test(intakeRoot);
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        gate._set_intake_root_for_test(path.join('agents', 'memory', 'intake'));
    });

    it('pattern signal passes on sibling paths', () => {
        writeIntake([
            { id: 'sig-1', entry_type: 'historical-patterns', path: 'app/A.php', body: 'null deref' },
            { id: 'sig-2', entry_type: 'historical-patterns', path: 'app/B.php', body: 'null deref' },
        ]);
        const record = gate._find_intake('sig-1');
        expect(record).not.toBeNull();
        expect(gate.check(record!, 'sig-1')).toEqual([]);
    });

    it('single path requires future_decisions', () => {
        writeIntake([
            { id: 'sig-solo', entry_type: 'incident-learnings', path: 'queue/x', body: 'timeout on retry' },
        ]);
        const record = gate._find_intake('sig-solo')!;
        const failures = gate.check(record, 'sig-solo');
        expect(failures.some((f) => f.includes('future_decisions'))).toBe(true);
    });

    it('future_decisions satisfies weak evidence', () => {
        writeIntake([
            {
                id: 'sig-fd',
                entry_type: 'domain-invariants',
                path: 'app/X.php',
                body: 'use service Y',
                future_decisions: [
                    { decision: 'A', expected_by: '2026-05-01', owner: 't1' },
                    { decision: 'B', expected_by: '2026-06-01', owner: 't2' },
                    { decision: 'C', expected_by: '2026-07-01', owner: 't3' },
                ],
            },
        ]);
        const record = gate._find_intake('sig-fd')!;
        expect(gate.check(record, 'sig-fd')).toEqual([]);
    });

    it('incomplete future decision fails', () => {
        writeIntake([
            {
                id: 'sig-part',
                entry_type: 'product-rules',
                path: 'app/x',
                body: 'cap N users',
                future_decisions: [
                    { decision: 'A', owner: 't1' }, // missing expected_by
                    { decision: 'B', expected_by: '2026-06-01', owner: 't2' },
                    { decision: 'C', expected_by: '2026-07-01', owner: 't3' },
                ],
            },
        ]);
        const record = gate._find_intake('sig-part')!;
        const failures = gate.check(record, 'sig-part');
        expect(failures.some((f) => f.includes('expected_by'))).toBe(true);
    });

    it('unknown type fails', () => {
        const failures = gate.check(
            { id: 'x', entry_type: 'not-real', path: 'a', body: 'b' },
            'inline',
        );
        expect(failures.some((f) => f.includes('entry_type'))).toBe(true);
    });

    it('missing required field fails', () => {
        const failures = gate.check({ id: 'x', entry_type: 'ownership', body: 'owner' }, 'inline');
        expect(failures.some((f) => f.includes('path'))).toBe(true);
    });

    it('intake not found returns null', () => {
        writeIntake([{ id: 'sig-1', entry_type: 'ownership', path: 'a', body: 'b' }]);
        expect(gate._find_intake('sig-missing')).toBeNull();
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_memory_proposal — golden parity (python3 vs tsx)', () => {
    let pdir: string;
    beforeEach(() => {
        pdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-gp-'));
    });
    afterEach(() => {
        fs.rmSync(pdir, { recursive: true, force: true });
    });

    function run(bin: string, script: string, args: readonly string[]) {
        return spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('intake-id not found matches (exit 1, stderr)', () => {
        const args = ['--intake-id', 'sig-does-not-exist-xyz'];
        const py = run('python3', PY_SCRIPT, args);
        const ts = run(TSX_BIN, TS_SCRIPT, args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    for (const fmt of ['text', 'json'] as const) {
        it(`proposal gate-fail matches (--format ${fmt})`, () => {
            const yml = path.join(pdir, 'p.yml');
            fs.writeFileSync(yml, 'id: x\nentry_type: ownership\nbody: owner\n', 'utf-8');
            const args = ['--proposal', yml, '--format', fmt];
            const py = run('python3', PY_SCRIPT, args);
            const ts = run(TSX_BIN, TS_SCRIPT, args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
