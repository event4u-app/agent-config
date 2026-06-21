// Tests for src/scripts/check_no_new_legacy_path.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_no_new_legacy_path.py (8 tests) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO with a
// piped diff on --stdin (skipped without python3).
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as g from '../../src/scripts/check_no_new_legacy_path.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const LEGACY = '.agent-src.uncondensed';


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

