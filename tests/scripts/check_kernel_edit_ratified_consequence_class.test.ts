import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONSEQUENCE_CLASS_PATHS,
    classifyPaths,
    consequenceRuleSlugs,
    isMechanismPath,
    requiresRatification,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 4.2 of `road-to-self-modification-that-a-council-must-pass`.
 *
 * Nine kernel rules were gated and the 28 rules of the high-consequence class
 * were not, so the rules that carry the most authority outside the kernel could
 * be edited with no record at all. The class is selected by the criterion in
 * `rule.schema.json`, not by a name list this gate keeps, and both the list and
 * the schema join the watch list so that a change cannot DROP a member in order
 * to edit the rule that member names.
 */

describe('rule law beyond the nine kernel rules', () => {
    it('reads the class members from the list', () => {
        const slugs = consequenceRuleSlugs();
        expect(slugs.size).toBeGreaterThan(0);
        const declared = JSON.parse(
            fs.readFileSync(CONSEQUENCE_CLASS_PATHS[0] as string, 'utf8'),
        ) as { members: Record<string, unknown> };
        expect([...slugs].sort()).toEqual(Object.keys(declared.members).sort());
    });

    it('gates a class member that is not a kernel rule', () => {
        const slug = [...consequenceRuleSlugs()][0] as string;
        const p = `src/rules/${slug}.md`;
        const gated = classifyPaths([p], []);
        expect(gated.consequenceRules).toEqual([p]);
        expect(gated.kernelRules).toEqual([]);
        expect(requiresRatification(gated)).toBe(true);
        expect(gatedFilesOf([p], [])).toContain(p);
    });

    // Polarity: a rule outside the class is still an ordinary rule.
    it('leaves a rule outside the class ungated', () => {
        const slugs = consequenceRuleSlugs();
        const outside = 'definitely-not-a-governed-rule-slug';
        expect(slugs.has(outside)).toBe(false);
        const gated = classifyPaths([`src/rules/${outside}.md`], []);
        expect(gated.consequenceRules).toEqual([]);
        expect(requiresRatification(gated)).toBe(false);
    });

    it('still reports a kernel rule as a kernel rule, not as a class member', () => {
        const gated = classifyPaths(['src/rules/non-destructive-by-default.md'], []);
        expect(gated.kernelRules).toEqual(['src/rules/non-destructive-by-default.md']);
        expect(gated.consequenceRules).toEqual([]);
    });

    it('watches the list and the criterion schema', () => {
        for (const p of CONSEQUENCE_CLASS_PATHS) {
            expect(isMechanismPath(p)).toBe(true);
            expect(classifyPaths([p], []).self).toBe(true);
        }
    });

    /**
     * The drop-then-edit move, which is the reason the list is watched: a diff
     * that removes a member AND edits the rule it named still carries a record,
     * because removing the member edits the watched list.
     */
    it('refuses the drop-then-edit diff either way', () => {
        const slug = [...consequenceRuleSlugs()][0] as string;
        const gated = classifyPaths(
            [CONSEQUENCE_CLASS_PATHS[0] as string, `src/rules/${slug}.md`],
            [],
        );
        expect(gated.self).toBe(true);
        expect(requiresRatification(gated)).toBe(true);
    });
});

/**
 * The list is read from the gate's OWN tree, never from `--root`, for the reason
 * the quorum policy is: in CI this code is the base revision's, so a candidate
 * that shortened the list would otherwise be judged against its own shortened
 * copy.
 */
describe('the class list is read from the gate tree', () => {
    let dir = '';
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consequence-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('ignores a shortened list in a candidate root', () => {
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string),
            JSON.stringify({ members: {} }),
        );
        // The default read is the gate's own tree and is unchanged by the above.
        expect(consequenceRuleSlugs().size).toBeGreaterThan(0);
        // Asked for the candidate root explicitly, it reads the short list —
        // which is exactly why `classifyPaths` never passes one.
        expect(consequenceRuleSlugs(dir).size).toBe(0);
    });

    /**
     * One deliberate asymmetry with the quorum policy, recorded rather than
     * silently chosen: a missing or unparseable list yields an EMPTY set rather
     * than a refusal. The policy fails closed because it decides whether a
     * control can measure at all; this list only WIDENS, so failing closed on it
     * would red every kernel PR over a file whose absence costs only the
     * widening.
     */
    it('falls back to an empty set on a missing or unparseable list', () => {
        expect(consequenceRuleSlugs(dir).size).toBe(0);
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string), '{ not json');
        expect(consequenceRuleSlugs(dir).size).toBe(0);
        fs.writeFileSync(
            path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string),
            JSON.stringify({ members: [] }),
        );
        expect(consequenceRuleSlugs(dir).size).toBe(0);
    });
});
