// Tests for src/scripts/check_no_new_legacy_path.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_no_new_legacy_path.py (8 tests) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO with a
// piped diff on --stdin (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as g from '../../src/scripts/check_no_new_legacy_path.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_new_legacy_path.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_new_legacy_path.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const LEGACY = '.agent-src.uncondensed';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// Mirror the pytest helper `_diff(path, added_line, sign="+")`.
function _diff(p: string, addedLine: string, sign = '+'): string {
    return `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n${sign}${addedLine}\n`;
}

describe('check_no_new_legacy_path — 1:1 port of test_check_no_new_legacy_path.py', () => {
    it('test_new_reference_in_src_skill_is_flagged', () => {
        const diff = _diff('src/skills/foo/SKILL.md', `see \`${LEGACY}/rules/x.md\``);
        const offenders = g.find_offenders(diff);
        expect(offenders.length > 0 && offenders[0]!.includes('src/skills/foo/SKILL.md')).toBe(
            true,
        );
    });

    it('test_removed_reference_is_not_flagged', () => {
        // a `-` line removing the legacy path is the GOOD direction — never a failure
        const diff = _diff('src/skills/foo/SKILL.md', `see \`${LEGACY}/rules/x.md\``, '-');
        expect(g.find_offenders(diff)).toEqual([]);
    });

    it('test_clean_addition_is_not_flagged', () => {
        const diff = _diff('src/skills/foo/SKILL.md', 'see `src/rules/x.md`');
        expect(g.find_offenders(diff)).toEqual([]);
    });

    it('test_exempt_files_are_not_flagged', () => {
        // the three detection/legacy-const files legitimately contain the literal
        for (const exempt of [
            'src/scripts/_lib/agent_src.py',
            'src/scripts/check_references.py',
            'src/scripts/check_condensed_paths.py',
        ]) {
            const diff = _diff(exempt, `LEGACY = "${LEGACY}/"`);
            expect(g.find_offenders(diff), `${exempt} must be exempt`).toEqual([]);
        }
    });

    it('test_non_src_files_are_ignored', () => {
        // a full diff (gh pr diff) carries every path; only src/ is in scope —
        // docs/, tests/, agents/, taskfiles/ mentions must NOT be flagged
        for (const p of [
            'docs/governance.md',
            'tests/test_check_no_new_legacy_path.py',
            'agents/roadmaps/x.md',
            'taskfiles/ci-fast.yml',
        ]) {
            const diff = _diff(p, `the \`${LEGACY}/\` literal`);
            expect(g.find_offenders(diff), `${p} is outside src/ — must be ignored`).toEqual([]);
        }
    });

    it('test_multiple_files_in_one_diff', () => {
        const diff =
            _diff('src/rules/a.md', `\`${LEGACY}/rules/a.md\``) +
            _diff('src/agent-src/contexts/b.md', `\`${LEGACY}/contexts/b.md\``);
        const offenders = g.find_offenders(diff);
        expect(offenders.length).toBe(2);
    });

    it('test_faithful_ts_twin_is_exempt_via_injected_check', () => {
        // A *.ts whose same-stem *.py sibling already carries the literal is a
        // faithful port, not a new dead-path. The sibling check is injected so the
        // test does not depend on the real filesystem.
        const diff = _diff('src/scripts/_lib/agent_src.ts', `const _LEGACY_PREFIX = "${LEGACY}/";`);
        const twinYes = g.find_offenders(diff, () => true);
        expect(twinYes, 'faithful TS twin must be exempt').toEqual([]);
        // Same diff, but no faithful sibling → it IS a new dead-path.
        const twinNo = g.find_offenders(diff, () => false);
        expect(twinNo.length, 'a .ts with no legacy-carrying .py sibling is flagged').toBe(1);
    });

    it('test_faithful_twin_default_reads_sibling_from_disk', () => {
        // After the Python→TS final deletion there are no `.py` siblings left on
        // disk, so the default predicate never exempts via a real sibling — a
        // `.ts` with no legacy-carrying `.py` sibling is correctly not a faithful
        // twin. (The injected-predicate exemption path is covered by the test
        // above.) The sibling lookup is cwd-relative, so run from the repo root.
        const cwd = process.cwd();
        try {
            process.chdir(REPO_ROOT);
            // No `.py` sibling exists post-deletion → not a faithful twin.
            expect(g._is_faithful_twin('src/scripts/_lib/agent_src.ts')).toBe(false);
            expect(g._is_faithful_twin('src/scripts/_lib/__does_not_exist__.ts')).toBe(false);
        } finally {
            process.chdir(cwd);
        }
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_no_new_legacy_path — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[], input: string) {
        return spawnSync('python3', [PY_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            input,
        });
    }
    function runTs(args: readonly string[], input: string) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            input,
        });
    }

    it('--stdin clean diff: identical stdout/stderr/exit', () => {
        const diff = _diff('src/skills/foo/SKILL.md', 'see `src/rules/x.md`');
        const py = runPy(['--stdin'], diff);
        const ts = runTs(['--stdin'], diff);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--stdin offending diff: identical stdout/stderr/exit', () => {
        const diff = _diff('src/rules/a.md', `\`${LEGACY}/rules/a.md\``);
        const py = runPy(['--stdin'], diff);
        const ts = runTs(['--stdin'], diff);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--stdin empty diff (no-op): identical', () => {
        const py = runPy(['--stdin'], '');
        const ts = runTs(['--stdin'], '');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--base unavailable ref: identical no-op', () => {
        const py = runPy(['--base', '__no_such_ref_xyz__'], '');
        const ts = runTs(['--base', '__no_such_ref_xyz__'], '');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
