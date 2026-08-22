import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { partition_rules_for_dir, projected_rule_trees } from '../../src/scripts/condense.js';
import { GLOBAL_RULE_DIRS, PROJECT_RULE_DIRS } from '../../src/install/globalRuleLayers.js';
import { isExclusivelyPackageOnly, partitionActive } from '../../src/install/partitionEligibility.js';

/**
 * Phase 2.2's verify clause: "with all five global layers present, the plan
 * narrows for all five; with one renamed, that one host alone stays full."
 *
 * The point of the change is ISOLATION. Before it, one claude fingerprint decided
 * for every host; after it, each host's own layer decides, so losing one layer must
 * cost exactly one host's narrowing and nothing else. A test that only checked
 * "narrowing happens" would pass against the old per-run filter too.
 */
const REPO = path.resolve(__dirname, '../..');

/**
 * The emitter classifies against `MODULE_STATE.RULES_SOURCE`, which is
 * `dist/agent-src/rules` — the projection, not the authored source. That is the
 * right source for it: a rule absent from `dist/` is compile-disabled and never
 * projected, so it can be neither withheld nor duplicated.
 *
 * Written out because the first version of this test read `src/rules` and failed by
 * exactly one file — `telegraph-speak.md`, which is compile-disabled and therefore
 * present in `src/` (119 rules, 16 package-only) and absent from `dist/` (118, 15).
 * A test that classified from a different directory than the code under test would
 * have to be "fixed" by a number, and the number would go stale the next time a
 * rule's compile toggle flips.
 */
const DIST_RULES = path.join(REPO, 'dist/agent-src/rules');

const allRules = (): string[] =>
    fs
        .readdirSync(DIST_RULES)
        .filter((f) => f.endsWith('.md'))
        .sort();

const packageOnly = (): string[] =>
    allRules().filter((f) => isExclusivelyPackageOnly(path.join(DIST_RULES, f)));

describe('per-host rule partition', () => {
    const homes: string[] = [];
    afterEach(() => {
        for (const h of homes.splice(0)) fs.rmSync(h, { recursive: true, force: true });
    });

    /** A temp HOME carrying a full global layer for every mapped host. */
    const seedAllLayers = (names: readonly string[]): string => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rph-'));
        homes.push(home);
        for (const toolId of Object.values(PROJECT_RULE_DIRS)) {
            const dir = path.join(home, GLOBAL_RULE_DIRS[toolId]!);
            fs.mkdirSync(dir, { recursive: true });
            for (const n of names) fs.writeFileSync(path.join(dir, n), '# x\n');
        }
        return home;
    };

    it('the partition is active in this environment (otherwise the rest proves nothing)', () => {
        // Stated as its own assertion rather than assumed: every expectation below
        // is vacuous when the partition is off, and a suite that silently degrades
        // to vacuous is worse than one that fails.
        expect(partitionActive(REPO)).toBe(true);
    });

    it.each(Object.keys(PROJECT_RULE_DIRS))('%s narrows to package-only when its layer carries', (dir) => {
        const home = seedAllLayers(allRules());
        const got = partition_rules_for_dir(dir, allRules(), home);
        expect(got).toEqual(packageOnly());
    });

    it.each(Object.keys(PROJECT_RULE_DIRS))(
        'renaming only %s’s layer keeps that host full and leaves the others narrowed',
        (victim) => {
            const home = seedAllLayers(allRules());
            const toolId = PROJECT_RULE_DIRS[victim]!;
            const dir = path.join(home, GLOBAL_RULE_DIRS[toolId]!);
            fs.renameSync(dir, `${dir}.gone`);

            expect(partition_rules_for_dir(victim, allRules(), home)).toEqual(allRules());

            for (const other of Object.keys(PROJECT_RULE_DIRS)) {
                if (other === victim) continue;
                // Two hosts share a scope root in no case here, but cursor's and
                // claude's layers are siblings under the same home — so this loop is
                // what proves the rename was surgical rather than home-wide.
                if (PROJECT_RULE_DIRS[other] === toolId) continue;
                expect(partition_rules_for_dir(other, allRules(), home)).toEqual(packageOnly());
            }
        },
    );

    it('a layer missing one single rule keeps the whole projection', () => {
        const short = allRules().filter((f) => !packageOnly().includes(f)).slice(1);
        const home = seedAllLayers([...short, ...packageOnly()]);
        // One global-scope rule absent → withholding it would delete it from that
        // host, so nothing is withheld at all.
        expect(partition_rules_for_dir('.cursor/rules', allRules(), home)).toEqual(allRules());
    });

    it('an unmapped directory is never narrowed', () => {
        const home = seedAllLayers(allRules());
        expect(partition_rules_for_dir('.someothertool/rules', allRules(), home)).toEqual(allRules());
    });

    it('projected_rule_trees still emits one key per active symlink tree', () => {
        const plan = projected_rule_trees();
        for (const [dir, names] of Object.entries(plan)) {
            expect(Array.isArray(names), `${dir} must map to a list`).toBe(true);
        }
        expect(Object.keys(plan).length).toBeGreaterThan(0);
    });
});

describe('the gate and the emitter classify identically', () => {
    /**
     * `check_rule_layer_partition` classifies from `src/rules` (the canonical
     * source); the emitter classifies from `dist/agent-src/rules` (what is actually
     * projected). Two sources are fine only while they agree on every rule they
     * share — otherwise the gate can report a duplicate the emitter never wrote, or
     * miss one it did.
     */
    it('agrees on every rule present in both trees', () => {
        const src = path.join(REPO, 'src/rules');
        const disagreements: string[] = [];
        for (const f of fs.readdirSync(DIST_RULES).filter((x) => x.endsWith('.md'))) {
            const srcPath = path.join(src, f);
            if (!fs.existsSync(srcPath)) continue;
            const a = isExclusivelyPackageOnly(srcPath);
            const b = isExclusivelyPackageOnly(path.join(DIST_RULES, f));
            if (a !== b) disagreements.push(`${f}: src=${String(a)} dist=${String(b)}`);
        }
        expect(disagreements).toEqual([]);
    });
});
