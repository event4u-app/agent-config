// Unit tests for the skill-menu census (`src/scripts/report_skill_menu_census.ts`
// — road-to-skill-menu-economy step 1.1). Every expectation is derived from the
// fixture constants below rather than copied from a real run, so a change in the
// live corpus cannot make a stale number pass.
//
// The classifier is the whole content of that report, and two of its properties
// are the ones a reviewer would doubt: that a bare skill name in ordinary prose
// is NOT read as a command reference, and that a flow's YAML `skills:` list IS
// read as a flow reference. Both are asserted in the failing direction as well
// as the passing one — the flow parser exists because the first pass returned a
// false zero, and a test that only proves the fix works cannot notice it
// regressing to that zero.
import { describe, expect, it } from 'vitest';

import {
    classify,
    flowSkillNames,
    menuFlags,
    referenceRe,
    tally,
    type SkillRow,
} from '../../src/scripts/report_skill_menu_census.js';

describe('referenceRe — disambiguating shapes only', () => {
    it('matches the three declared shapes', () => {
        const re = referenceRe('code-review');
        expect(re.test('route through skill:code-review here')).toBe(true);
        expect(re.test('see src/skills/code-review/SKILL.md')).toBe(true);
        expect(re.test('the `code-review` skill')).toBe(true);
    });

    it('does NOT match a bare name in prose — the reason a word-boundary match was rejected', () => {
        // `security`, `database` and `docker` are real skill names AND ordinary
        // English. A word-boundary matcher would count every prose mention as an
        // entry path and report near-100% command coverage.
        expect(referenceRe('security').test('run a security pass over the diff')).toBe(false);
        expect(referenceRe('database').test('the database is migrated first')).toBe(false);
        expect(referenceRe('docker').test('start docker before the suite')).toBe(false);
    });

    it('does not let one skill name match a longer sibling, in ANY of the three shapes', () => {
        // `skill:<name>\b` was the first form and it was wrong: the word boundary
        // between `w` and `-` made `skill:code-review-lens` a hit for `code-review`,
        // so a skill would have inherited its longer sibling's references. Found by
        // probing the regex directly rather than by a run, and pinned here in all
        // three shapes so the narrow fix cannot be undone by widening one of them.
        expect(referenceRe('code-review').test('the `code-review-lens` skill')).toBe(false);
        expect(referenceRe('code-review').test('route to skill:code-review-lens now')).toBe(false);
        expect(referenceRe('code-review').test('see src/skills/code-review-lens/SKILL.md')).toBe(false);
    });
});

describe('flowSkillNames — YAML lists, not the command shapes', () => {
    it('reads an inline list', () => {
        const names = flowSkillNames('  - title: x\n    skills: [code-review, adversarial-review]\n');
        expect([...names].sort()).toEqual(['adversarial-review', 'code-review']);
    });

    it('reads a block sequence', () => {
        const names = flowSkillNames('skills:\n  - alpha\n  - beta\nother: 1\n');
        expect([...names].sort()).toEqual(['alpha', 'beta']);
    });

    it('stops at the end of the block and ignores unrelated lists', () => {
        const names = flowSkillNames('commands:\n  - not-a-skill\nskills:\n  - alpha\n');
        expect(names.has('not-a-skill')).toBe(false);
        expect(names.has('alpha')).toBe(true);
    });

    it('the command regex would have found nothing here — the false zero, pinned', () => {
        const flow = '    skills: [code-review, adversarial-review]\n';
        expect(referenceRe('code-review').test(flow)).toBe(false);
        expect(flowSkillNames(flow).has('code-review')).toBe(true);
    });
});

describe('menuFlags', () => {
    it('reads both menu-economy keys, and defaults to absent', () => {
        expect(menuFlags('---\nname: x\n---\n')).toEqual({ userInvocable: null, disableModel: null });
        expect(menuFlags('---\nuser-invocable: false\n---\n').userInvocable).toBe(false);
        expect(menuFlags('---\ndisable-model-invocation: true\n---\n').disableModel).toBe(true);
    });
});

describe('classify — total, and orphan only when nothing reaches the skill', () => {
    it('assigns one label per signal combination', () => {
        expect(classify(1, 1, true)).toBe('both');
        expect(classify(2, 0, true)).toBe('command-only');
        expect(classify(0, 3, true)).toBe('flow-only');
        expect(classify(0, 0, true)).toBe('model-routed');
        expect(classify(0, 0, false)).toBe('orphan');
    });

    it('a referenced skill is never an orphan even when it is off the menu', () => {
        expect(classify(1, 0, false)).toBe('command-only');
        expect(classify(0, 1, false)).toBe('flow-only');
    });
});

describe('tally reconciles to the row count', () => {
    it('sums to the number of rows', () => {
        const row = (name: string, c: number, f: number, menu: boolean): SkillRow => ({
            name,
            commandRefs: c,
            flowRefs: f,
            menuPresent: menu,
            hasTriggerCorpus: false,
            entryPath: classify(c, f, menu),
            firstRef: '',
        });
        const rows = [row('a', 1, 1, true), row('b', 1, 0, true), row('c', 0, 1, true), row('d', 0, 0, true), row('e', 0, 0, false)];
        const t = tally(rows);
        expect(t.both + t['command-only'] + t['flow-only'] + t['model-routed'] + t.orphan).toBe(rows.length);
        expect(t).toEqual({ both: 1, 'command-only': 1, 'flow-only': 1, 'model-routed': 1, orphan: 1 });
    });
});
