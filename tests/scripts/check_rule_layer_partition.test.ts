import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { auditRuleLayers, partitionEnforces, renderTable } from '../../src/scripts/check_rule_layer_partition.js';
import { GLOBAL_RULE_DIRS, PROJECT_RULE_DIRS } from '../../src/install/globalRuleLayers.js';

/**
 * Phase 4.1's verify clause has two halves and this file is both:
 *
 *   "sabotage — copy one global-only rule into `.cursor/rules`, assert non-zero and
 *    that the message names the file; remove it, assert zero. Then run with `HOME`
 *    pointed at an empty directory and assert the skip line appears for all five."
 *
 * The audit runs over a synthetic project root rather than the live repository. A
 * test that plants a file in the real `.cursor/rules` and asserts a failure is a
 * test that leaves the tree dirty when it dies between the plant and the cleanup,
 * and this gate's whole subject is a directory nobody reviews because it is
 * gitignored.
 */
describe('check_rule_layer_partition', () => {
    const tmps: string[] = [];
    afterEach(() => {
        for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
    });

    const mk = (): string => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'crlp-'));
        tmps.push(d);
        return d;
    };

    /**
     * A project root with `src/rules` holding one package-only rule and one
     * global-scope rule, plus whichever project directories the caller names.
     */
    const seedProject = (dirs: readonly string[]): string => {
        const root = mk();
        const src = path.join(root, 'src/rules');
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(
            path.join(src, 'pkg-only.md'),
            '---\nworkspaces:\n  - agent-config-maintainer\n---\n# pkg\n',
        );
        fs.writeFileSync(path.join(src, 'global-scope.md'), '---\ntier: 1\n---\n# global\n');
        for (const d of dirs) {
            const abs = path.join(root, d);
            fs.mkdirSync(abs, { recursive: true });
            fs.writeFileSync(path.join(abs, 'pkg-only.md'), '# pkg\n');
        }
        return root;
    };

    const seedHome = (names: readonly string[]): string => {
        const home = mk();
        for (const toolId of Object.values(PROJECT_RULE_DIRS)) {
            const dir = path.join(home, GLOBAL_RULE_DIRS[toolId]!);
            fs.mkdirSync(dir, { recursive: true });
            for (const n of names) fs.writeFileSync(path.join(dir, n), '# x\n');
        }
        return home;
    };

    it('a clean tree reports zero duplicates and completes every directory', () => {
        const root = seedProject(Object.keys(PROJECT_RULE_DIRS));
        const home = seedHome(['global-scope.md']);
        const a = auditRuleLayers(root, home);
        expect(a.dirs.every((d) => d.duplicated.length === 0)).toBe(true);
        expect(a.ledger.finalize().completed).toBe(5);
    });

    it('one planted global-scope rule fails that directory and names the file', () => {
        const root = seedProject(Object.keys(PROJECT_RULE_DIRS));
        const home = seedHome(['global-scope.md']);
        // The sabotage, in .mdc so it also exercises the normalisation path that
        // makes cursor comparable at all.
        fs.writeFileSync(path.join(root, '.cursor/rules/global-scope.mdc'), '# x\n');
        const a = auditRuleLayers(root, home);
        const cursor = a.dirs.find((d) => d.dir === '.cursor/rules');
        expect(cursor?.duplicated).toEqual(['global-scope.md']);
        expect(a.dirs.filter((d) => d.duplicated.length > 0)).toHaveLength(1);
        expect(renderTable(a).join('\n')).toContain('.cursor/rules');
    });

    it('removing it returns the tree to clean — the other half of the sabotage', () => {
        const root = seedProject(Object.keys(PROJECT_RULE_DIRS));
        const home = seedHome(['global-scope.md']);
        const planted = path.join(root, '.cursor/rules/global-scope.mdc');
        fs.writeFileSync(planted, '# x\n');
        expect(auditRuleLayers(root, home).dirs.some((d) => d.duplicated.length > 0)).toBe(true);
        fs.rmSync(planted);
        expect(auditRuleLayers(root, home).dirs.every((d) => d.duplicated.length === 0)).toBe(true);
    });

    it('an empty HOME skips all five with a named reason and reports nothing', () => {
        const root = seedProject(Object.keys(PROJECT_RULE_DIRS));
        // Every project directory carries a global-scope duplicate, so a gate that
        // ignored the missing global layer would report five failures here. It must
        // report none, because with no global layer the project copy is the only
        // carrier and removing it would delete the rule.
        for (const d of Object.keys(PROJECT_RULE_DIRS)) {
            fs.writeFileSync(path.join(root, d, 'global-scope.md'), '# x\n');
        }
        const a = auditRuleLayers(root, mk());
        expect(a.dirs).toHaveLength(0);
        expect(Object.keys(a.skipped).sort()).toEqual(Object.keys(PROJECT_RULE_DIRS).sort());
        for (const why of Object.values(a.skipped)) {
            expect(why).toContain('only carrier');
        }
        const tally = a.ledger.finalize();
        expect(tally.completed).toBe(0);
        expect(tally.skipped).toBe(5);
    });

    it('a global layer missing the rule is a sole-carrier case, never a duplicate', () => {
        const root = seedProject(['.cursor/rules']);
        fs.writeFileSync(path.join(root, '.cursor/rules/global-scope.mdc'), '# x\n');
        // The layer exists but does not hold `global-scope.md`.
        const home = seedHome(['something-else.md']);
        const a = auditRuleLayers(root, home);
        const cursor = a.dirs.find((d) => d.dir === '.cursor/rules');
        expect(cursor?.duplicated).toEqual([]);
        expect(cursor?.soleCarrier).toEqual(['global-scope.md']);
    });

    it('an absent project directory is skipped, not failed', () => {
        const root = seedProject(['.cursor/rules']);
        const a = auditRuleLayers(root, seedHome(['global-scope.md']));
        expect(a.dirs.map((d) => d.dir)).toEqual(['.cursor/rules']);
        expect(Object.keys(a.skipped)).toHaveLength(4);
    });
});

describe('partitionEnforces', () => {
    it('enforces only where the partition actually ran', () => {
        expect(partitionEnforces('dual-layer/partitioned')).toBe(true);
    });

    it('does NOT enforce while the projection is standalone/full', () => {
        // 2026-08-22: a release push was blocked here with no reachable repair.
        // Building 14.8.0 against an installed 14.7.0 makes `resolvePartitionVerdict`
        // return `standalone/full`, so the generators emit every rule by design —
        // and `task generate-tools` re-writes exactly the files this gate demanded be
        // gone, deadlocking it against `check_bridge_derivation`. Every release hits
        // this by construction: the building version is always ahead of the installed
        // one for the whole release window.
        expect(partitionEnforces('standalone/full')).toBe(false);
    });

    it('treats an unrecognised mode as non-enforcing (fail-safe, not fail-loud)', () => {
        expect(partitionEnforces('some-future-mode')).toBe(false);
    });
});
