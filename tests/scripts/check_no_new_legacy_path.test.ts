// Tests for src/scripts/check_no_new_legacy_path.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_no_new_legacy_path.py (8 tests) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO with a
// piped diff on --stdin (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
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
        // A full diff (gh pr diff) carries every path; only src/ and tests/ are in
        // scope. `tests/` was REMOVED from this ignore list on 2026-07-29 — see the
        // positive case below for why.
        for (const p of [
            'docs/governance.md',
            'agents/roadmaps/x.md',
            'taskfiles/ci-fast.yml',
        ]) {
            const diff = _diff(p, `the \`${LEGACY}/\` literal`);
            expect(g.find_offenders(diff), `${p} is out of scope — must be ignored`).toEqual([]);
        }
    });

    it('a NEW dead-root reference under tests/ is flagged (scope added 2026-07-29)', () => {
        // Four tests were found pinning the dead root — two via fixture paths, one
        // via a resolve_entry expectation, one asserting a missing root exits 0 —
        // and each kept a gate's blindness green, because test and implementation
        // agreed on a tree reality had abandoned. Diff-scoping is what makes this
        // tractable: tests/ already holds ~213 legitimate mentions (the legacy
        // detectors' own tests, validator_ignore substrings, tmpdir fixtures), so a
        // full-tree lint would be ~200 false positives. Existing debt stays here;
        // only NEW additions are caught.
        const diff = _diff('tests/scripts/some_gate.test.ts', `fixture at \`${LEGACY}/rules/a.md\``);
        expect(g.find_offenders(diff)).toHaveLength(1);
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

// --- Pass 2: EXISTING hardcoded scan roots, ratcheted ------------------------
//
// road-to-gates-that-can-fail Phase 5. The diff pass above is structurally
// blind to debt that is already in the tree, and all 14 dead gates were
// pre-existing. These tests pin the NARROWING that makes the count signal
// rather than the 213-hit noise a full-tree lint produces.

describe('check_no_new_legacy_path — existing hardcoded scan roots', () => {
    const tmpRoot = (): string =>
        fs.mkdtempSync(path.join(os.tmpdir(), 'hardcoded-scan-roots-'));

    function writeScript(root: string, rel: string, body: string): void {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf-8');
    }

    it('counts a path.join() against the retired tree', () => {
        const root = tmpRoot();
        writeScript(
            root,
            'src/scripts/some_gate.ts',
            `const SRC = path.join(ROOT, '${LEGACY}', 'skills');\n`,
        );
        const found = g.find_hardcoded_scan_roots(root, () => false);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('src/scripts/some_gate.ts:1');
    });

    it('does NOT count a comment, a message string, or data the gate matches on', () => {
        const root = tmpRoot();
        writeScript(
            root,
            'src/scripts/detector.ts',
            [
                `// the ${LEGACY}/ tree is retired — comment, not a scan root`,
                `const FORBIDDEN = ['${LEGACY}/', '../../docs/'];`,
                `process.stdout.write('links into \`${LEGACY}/\` are unshipped');`,
                `const short = fpath.replace('${LEGACY}/', '');`,
            ].join('\n'),
        );
        // This is the exact class the rejected full-tree lint drowned in.
        expect(g.find_hardcoded_scan_roots(root, () => false)).toEqual([]);
    });

    it('reads executable code only — no docs, prose, tests or fixtures', () => {
        const root = tmpRoot();
        writeScript(root, 'src/scripts/real.ts', `path.join(R, '${LEGACY}');\n`);
        writeScript(root, 'src/scripts/notes.md', `path.join(R, '${LEGACY}');\n`);
        writeScript(root, 'tests/scripts/fixture.test.ts', `path.join(R, '${LEGACY}');\n`);
        writeScript(root, 'src/skills/x/SKILL.md', `path.join(R, '${LEGACY}');\n`);
        const found = g.find_hardcoded_scan_roots(root, () => false);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('src/scripts/real.ts');
    });

    it('exempts the shared resolver — owning the constant is its job', () => {
        const root = tmpRoot();
        writeScript(
            root,
            'src/scripts/_lib/agent_src.ts',
            `LEGACY_SRC: path.join(root, '${LEGACY}'),\n`,
        );
        expect(g.find_hardcoded_scan_roots(root, () => false)).toEqual([]);
    });

    it('the committed baseline matches a fresh scan of the real tree', () => {
        // The ratchet's whole value is that the number in the diff is the number
        // the gate measures. A drift here means the baseline was edited by hand.
        const found = g.find_hardcoded_scan_roots(REPO_ROOT, () => false);
        const baselines = JSON.parse(
            fs.readFileSync(
                path.join(REPO_ROOT, 'src', 'config', 'gate-violation-baselines.json'),
                'utf-8',
            ),
        ) as { gates: Record<string, { count: number }> };
        const entry = baselines.gates[g.HARDCODED_ROOT_GATE];
        expect(entry, `${g.HARDCODED_ROOT_GATE} must be baselined`).toBeDefined();
        // At-or-below: a Phase-1 repair legitimately lowers the live count
        // before the baseline commit catches up. Above it is the defect.
        expect(found.length).toBeLessThanOrEqual(entry!.count);
    });

    it('the ratchet is green on the real tree today', () => {
        expect(g.checkHardcodedScanRoots(REPO_ROOT)).toBe(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

