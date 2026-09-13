/**
 * The two test gates — `road-to-adversarial-verification-and-long-runs` 2.4.
 *
 * These cover the PURE decisions. The gates' own `--self-test` covers the
 * binaries a contributor actually invokes, which is the layer that has silently
 * no-opped in this repository before; the two are complementary rather than
 * duplicated, and neither substitutes for the other.
 *
 * Every case here is written against a direction the classifier could plausibly
 * have gone wrong, not against a line of its source. The load-bearing ones are
 * the ACCEPTS on `check_test_weakening`: a gate that reds a legitimate test edit
 * gets its exemption widened until it finds nothing, which is Risk 4 of the
 * roadmap that commissioned it.
 */

import { describe, expect, it } from 'vitest';

import { classify, findingFor, labelsFrom } from '../../src/scripts/check_test_delta.js';
import { analyse } from '../../src/scripts/check_test_weakening.js';
import {
    isCodePath,
    isTestPath,
    isVerdictArtefact,
    parseUnifiedDiff,
    weakeningSignal,
} from '../../src/scripts/_lib/test_delta.js';

describe('path classification', () => {
    it.each([
        'src/scripts/thing.ts',
        'src/shared/missionExecution.ts',
        'scripts/helper.mjs',
    ])('%s is code', (p) => expect(isCodePath(p)).toBe(true));

    it.each([
        'docs/x.md',
        'README.md',
        'src/config/agent-settings.template.yml',
        'src/rules/test-first.md',
        'src/types.d.ts',
        // A projection is not an independent change — counting it would make a
        // regeneration look like untested code every time.
        'dist/agent-src/scripts/thing.ts',
        '.claude/rules/thing.ts',
    ])('%s is NOT code', (p) => expect(isCodePath(p)).toBe(false));

    it.each([
        'tests/scripts/thing.test.ts',
        'tests/e2e/x.spec.ts',
        'src/scripts/thing.test.ts',
        'tests/fixtures/whatever.json',
    ])('%s is a test path', (p) => expect(isTestPath(p)).toBe(true));

    it('a co-located test is a test and never also code', () => {
        expect(isTestPath('src/a.test.ts')).toBe(true);
        expect(isCodePath('src/a.test.ts')).toBe(false);
    });

    it('only a markdown file under the reviews tree is a verdict artefact', () => {
        expect(isVerdictArtefact('agents/evidence/reviews/r.md')).toBe(true);
        expect(isVerdictArtefact('agents/evidence/analysis/r.md')).toBe(false);
        expect(isVerdictArtefact('agents/evidence/reviews/r.json')).toBe(false);
    });
});

describe('check_test_delta — the decision', () => {
    it('code with no test is the finding', () => {
        expect(findingFor(classify(['src/a.ts']))).toMatch(/no test path did/);
    });

    it('code with a test is not', () => {
        expect(findingFor(classify(['src/a.ts', 'tests/a.test.ts']))).toBeNull();
    });

    it('no code at all is not a finding, however many files moved', () => {
        expect(findingFor(classify(['docs/a.md', 'README.md', 'dist/x.ts']))).toBeNull();
    });

    it('an empty diff is not a finding', () => {
        expect(findingFor(classify([]))).toBeNull();
    });

    it('the finding names the label, so the reader is not left guessing the escape', () => {
        expect(findingFor(classify(['src/a.ts']))).toMatch(/test-delta-acknowledged/);
    });

    it('the finding truncates a long list rather than printing all of it', () => {
        const many = Array.from({ length: 9 }, (_, i) => `src/f${String(i)}.ts`);
        expect(findingFor(classify(many))).toMatch(/\+4 more/);
    });

    it('labelsFrom survives every shape a missing or malformed event can take', () => {
        expect(labelsFrom(null)).toEqual([]);
        expect(labelsFrom('')).toEqual([]);
        expect(labelsFrom('/definitely/not/a/file.json')).toEqual([]);
    });
});

describe('check_test_weakening — NET counts, which is the whole gate', () => {
    const d = (p: string, body: string): string =>
        `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@\n${body}`;

    it('a net-removed assertion is a signal', () => {
        const r = analyse(d('tests/a.test.ts', '-expect(x).toBe(1);\n'), []);
        expect(r.signals).toHaveLength(1);
        expect(r.signals[0]?.assertionsLost).toBe(1);
    });

    it('EDITING an assertion is not — removed and added cancel', () => {
        const r = analyse(
            d('tests/a.test.ts', '-expect(x).toBe(1);\n+expect(x).toBe(2);\n'),
            [],
        );
        expect(r.signals).toHaveLength(0);
    });

    it('a net-added suppression is a signal; removing one is not', () => {
        expect(
            analyse(d('tests/a.test.ts', "+it.skip('x', () => {});\n"), []).signals,
        ).toHaveLength(1);
        expect(
            analyse(d('tests/a.test.ts', "-it.skip('x', () => {});\n"), []).signals,
        ).toHaveLength(0);
    });

    it('recognises suppressions outside vitest — the rule ships to other stacks', () => {
        for (const line of [
            '+@pytest.mark.skip\n',
            '+@pytest.mark.xfail\n',
            '+    t.Skip("flaky")\n',
            '+        $this->markTestSkipped("x");\n',
            '+xit("a", () => {});\n',
        ]) {
            expect(analyse(d('tests/a.test.ts', line), []).signals.length).toBe(1);
        }
    });

    it('a diff line held as STRING DATA is not a suppression — the gate found this itself', () => {
        // A suite that tests a suppression detector necessarily contains
        // suppression-shaped fixtures. Counting them made this gate report the
        // one file whose job is to prove it works, which is the shape that makes
        // a detector unfalsifiable. Generalised rather than path-exempted.
        const asData = d('tests/gate.test.ts', "+            '+@pytest.mark.skip\\n',\n");
        expect(analyse(asData, []).signals).toHaveLength(0);
        // The same construct written as CODE still reds — the guard narrows the
        // detector, it does not disable it.
        expect(analyse(d('tests/gate.test.ts', '+@pytest.mark.skip\n'), []).signals).toHaveLength(
            1,
        );
    });

    it('production code is out of scope — a gate for tests, not for every removal', () => {
        expect(analyse(d('src/a.ts', '-expect(x).toBe(1);\n'), []).signals).toHaveLength(0);
    });

    it('a committed verdict artefact discharges the finding without hiding it', () => {
        const r = analyse(d('tests/a.test.ts', '-expect(x).toBe(1);\n'), [
            'agents/evidence/reviews/r.md',
        ]);
        // Discharged, not erased: the signal is still reported so a reviewer can
        // check the verdict actually covers it.
        expect(r.discharged).toBe(true);
        expect(r.signals).toHaveLength(1);
    });

    it('a deleted file contributes nothing — /dev/null is not a path', () => {
        const diff =
            'diff --git a/tests/a.test.ts b/tests/a.test.ts\n--- a/tests/a.test.ts\n+++ /dev/null\n@@\n-expect(x).toBe(1);\n';
        expect(analyse(diff, []).signals).toHaveLength(0);
    });

    it('an unparseable diff yields no signal rather than throwing', () => {
        expect(() => analyse('not a diff at all\n@@@\n', [])).not.toThrow();
        expect(analyse('not a diff at all\n', []).signals).toHaveLength(0);
    });

    it('a rename counts against the destination, which is the file that exists now', () => {
        const diff =
            'diff --git a/tests/old.test.ts b/tests/new.test.ts\n--- a/tests/old.test.ts\n+++ b/tests/new.test.ts\n@@\n-expect(x).toBe(1);\n';
        expect(parseUnifiedDiff(diff)[0]?.path).toBe('tests/new.test.ts');
    });

    it('multiple files are measured independently, not summed', () => {
        const diff =
            d('tests/a.test.ts', '-expect(x).toBe(1);\n') +
            d('tests/b.test.ts', '+expect(y).toBe(2);\n');
        const r = analyse(diff, []);
        // b GAINED an assertion; a lost one. A summed measure would cancel them
        // and report nothing, which is the bug this asserts against.
        expect(r.signals.map((s) => s.path)).toEqual(['tests/a.test.ts']);
    });

    it('weakeningSignal is pure arithmetic over the two line lists', () => {
        expect(
            weakeningSignal({
                path: 'tests/a.test.ts',
                removed: ['expect(a)', 'expect(b)'],
                added: ['expect(c)'],
            }).assertionsLost,
        ).toBe(1);
    });
});
