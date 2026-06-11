// Tests for src/scripts/lint_new_skill_gate.ts (py2ts Phase 4 / Wave 4b — PORT).
//
// No pytest suite exists. Coverage:
//   1. Constants spot-check (MIN_TRIGGER, DEDUPE_THRESHOLD).
//   2. check_triggers behaviour against a sandboxed evals/triggers.json — the
//      byte-identical message strings the Python original emits.
//   3. Golden parity — python3 vs tsx on the REAL REPO across the real CI args
//      (default + --quiet). Both binaries shell out to the SAME git state, so
//      the comparison is deterministic within a run. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_new_skill_gate.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_new_skill_gate.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_new_skill_gate.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_new_skill_gate — constants', () => {
    it('MIN_TRIGGER is 5', () => {
        expect(mod.MIN_TRIGGER).toBe(5);
    });
    it('DEDUPE_THRESHOLD is 0.7', () => {
        expect(mod.DEDUPE_THRESHOLD).toBe(0.7);
    });
});

// --- check_triggers gate against a sandboxed skill dir ----------------------

describe('lint_new_skill_gate — check_triggers', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lnsg-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('reports missing triggers.json with the contract message', () => {
        const skillDir = path.join(tmp, 'skill');
        fs.mkdirSync(skillDir, { recursive: true });
        const msg = mod.check_triggers(skillDir);
        expect(msg).not.toBeNull();
        expect(msg).toContain('a new skill needs a triggers stub');
        expect(msg).toContain('5 should-trigger + 5');
    });

    it('reports too-few queries with the count message', () => {
        const skillDir = path.join(tmp, 'skill');
        fs.mkdirSync(path.join(skillDir, 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(skillDir, 'evals', 'triggers.json'),
            JSON.stringify({ queries: [{ trigger: true }, { trigger: false }] }),
        );
        const msg = mod.check_triggers(skillDir);
        expect(msg).toBe(
            'triggers.json has 1 should-trigger / 1 should-not-trigger — need >= 5 of each',
        );
    });

    it('reports a missing queries list', () => {
        const skillDir = path.join(tmp, 'skill');
        fs.mkdirSync(path.join(skillDir, 'evals'), { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'evals', 'triggers.json'), JSON.stringify({}));
        expect(mod.check_triggers(skillDir)).toBe('triggers.json has no `queries` list');
    });

    it('passes when both buckets meet the floor', () => {
        const skillDir = path.join(tmp, 'skill');
        fs.mkdirSync(path.join(skillDir, 'evals'), { recursive: true });
        const queries = [
            ...Array.from({ length: 5 }, () => ({ trigger: true })),
            ...Array.from({ length: 5 }, () => ({ trigger: false })),
        ];
        fs.writeFileSync(
            path.join(skillDir, 'evals', 'triggers.json'),
            JSON.stringify({ queries }),
        );
        expect(mod.check_triggers(skillDir)).toBeNull();
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_new_skill_gate — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    for (const args of [[], ['--quiet']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
