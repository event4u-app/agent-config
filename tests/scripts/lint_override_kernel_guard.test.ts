/**
 * Kernel-override audit (road-to-enforcement-proof P2.6).
 *
 * The class this guard defends is "tighten yes, replace never". The tests below
 * pin both directions, because a guard that only ever sees a clean tree is
 * indistinguishable from a guard that does nothing.
 */
import { describe, expect, it } from 'vitest';

import {
    classify_violations,
    has_citation,
    parse_mode,
    registered_rules,
} from '../../src/scripts/lint_override_kernel_guard.js';
import { KERNEL_RULE_IDS, is_kernel_rule } from '../../src/scripts/_lib/kernel_rules.js';

describe('parse_mode — first-match-wins bypass (Phase 6.2 finding 5)', () => {
    // The override contract doc carries two example `**Mode:**` lines, so an
    // example above the real declaration used to decide the verdict. On a
    // safety-floor rule that is the difference between a blocked override and a
    // permitted one — so disagreement must fail closed, never pick the earliest.
    it('does not let an earlier example shadow the real declaration', () => {
        const text = [
            '# Override: Rule — commit-policy',
            '',
            'For example, a light override declares:',
            '',
            '**Mode:** `extend`',
            '',
            'This file, however, declares:',
            '',
            '**Mode:** `replace`',
            '',
        ].join('\n');
        // Before the repair this returned 'extend' — the permitted mode — from
        // the example, while the file actually declares the blocked one.
        expect(parse_mode(text)).toBe('unknown');
    });

    it('CONTROL — repeated agreeing declarations still resolve, so the fix is not blanket refusal', () => {
        expect(parse_mode('**Mode:** `replace`\n\nprose\n\n**Mode:** `replace`\n')).toBe('replace');
    });

    it('resolves to a violation-bearing verdict, not a silent pass', () => {
        // `unknown` is what the caller turns into a violation; assert the contract
        // the repair depends on rather than assuming it.
        expect(['unknown', 'replace']).toContain(parse_mode('**Mode:** `extend`\n**Mode:** `replace`\n'));
    });
});

describe('parse_mode', () => {
    it('reads a backticked extend header', () => {
        expect(parse_mode('---\n**Mode:** `extend`\n---\n')).toBe('extend');
    });

    it('reads a replace header without backticks', () => {
        expect(parse_mode('**Mode:** replace\n')).toBe('replace');
    });

    it('returns unknown when no mode header exists', () => {
        // An override on this class with no declared mode is itself a finding —
        // it must not silently read as `extend`.
        expect(parse_mode('# Override: Rule — commit-policy\n\nsome prose\n')).toBe('unknown');
    });
});

describe('has_citation', () => {
    it('accepts the contract form', () => {
        expect(
            has_citation('> Overrides: verify-before-complete §The Gate — ships a browser UI.\n'),
        ).toBe(true);
    });

    it('rejects a citation with no reason after the dash', () => {
        expect(has_citation('> Overrides: commit-policy §Exceptions\n')).toBe(false);
    });

    it('rejects prose that merely mentions overriding', () => {
        expect(has_citation('This overrides the commit policy because we say so.\n')).toBe(false);
    });
});

describe('registered_rules', () => {
    const reg = [
        'schema_version: 1',
        '',
        'exceptions:',
        '  - rule: verify-before-complete',
        '    mode: extend',
        '    justification: >-',
        '      ships a browser UI',
        '    approved_by: maintainer',
        '',
        'other_block:',
        '  - rule: not-an-exception',
    ].join('\n');

    it('reads rules under exceptions:', () => {
        expect(registered_rules(reg).has('verify-before-complete')).toBe(true);
    });

    it('stops at the end of the exceptions block', () => {
        // A `rule:` under an unrelated top-level key must not grant coverage.
        expect(registered_rules(reg).has('not-an-exception')).toBe(false);
    });

    it('treats an empty registry as granting nothing', () => {
        expect(registered_rules('schema_version: 1\n').size).toBe(0);
    });
});

describe('is_kernel_rule — the class boundary', () => {
    it('matches every kernel rule by bare id', () => {
        for (const id of KERNEL_RULE_IDS) expect(is_kernel_rule(id)).toBe(true);
    });

    it('matches by filename and by path', () => {
        expect(is_kernel_rule('commit-policy.md')).toBe(true);
        expect(is_kernel_rule('agents/overrides/rules/scope-control.md')).toBe(true);
    });

    it('does not match a non-kernel rule', () => {
        expect(is_kernel_rule('output-discipline')).toBe(false);
        expect(is_kernel_rule('src/rules/telegraph-speak.md')).toBe(false);
    });

    it('holds the set at exactly 9', () => {
        expect(KERNEL_RULE_IDS.length).toBe(9);
    });
});

describe('classify_violations — kernel / safety-floor path (unchanged behavior)', () => {
    it('refuses `replace` on a kernel rule', () => {
        const v = classify_violations({
            kernel: true,
            is_floor: false,
            mode: 'replace',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual(['`replace` on a kernel rule — this class may be tightened, never replaced']);
    });

    it('refuses `replace` on a safety-floor rule (distinct wording)', () => {
        const v = classify_violations({
            kernel: false,
            is_floor: true,
            mode: 'replace',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual([
            '`replace` on a safety-floor rule — this class may be tightened, never replaced',
        ]);
    });

    it('refuses an undeclared mode', () => {
        const v = classify_violations({
            kernel: true,
            is_floor: false,
            mode: 'unknown',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual([
            'no readable `**Mode:**` header — an override on this class must declare its mode',
        ]);
    });

    it('refuses an unregistered `extend`', () => {
        const v = classify_violations({
            kernel: true,
            is_floor: false,
            mode: 'extend',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual([
            '`extend` on a kernel rule with no entry in agents/overrides/kernel-exceptions.yml',
        ]);
    });

    it('accepts a registered `extend` with a citation — clean', () => {
        const v = classify_violations({
            kernel: true,
            is_floor: false,
            mode: 'extend',
            cited: true,
            is_registered: true,
        });
        expect(v).toEqual([]);
    });

    it('still flags a missing citation on a kernel rule (existing class, unchanged wording)', () => {
        const v = classify_violations({
            kernel: true,
            is_floor: false,
            mode: 'extend',
            cited: false,
            is_registered: true,
        });
        expect(v).toEqual(['missing `> Overrides: <rule> §<section> — <reason>` citation']);
    });
});

describe('classify_violations — ordinary override (new: citation obligation now linted)', () => {
    it('flags an ordinary override missing the citation line', () => {
        const v = classify_violations({
            kernel: false,
            is_floor: false,
            mode: 'extend',
            cited: false,
            is_registered: false,
        });
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('missing-citation');
    });

    it('does not apply the non-overridable-class checks to an ordinary `replace`', () => {
        // Replace is legitimate for an ordinary override — only kernel /
        // safety-floor files are non-replaceable.
        const v = classify_violations({
            kernel: false,
            is_floor: false,
            mode: 'replace',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual([]);
    });

    it('accepts an ordinary override with the citation line — clean', () => {
        const v = classify_violations({
            kernel: false,
            is_floor: false,
            mode: 'extend',
            cited: true,
            is_registered: false,
        });
        expect(v).toEqual([]);
    });
});

describe('has_citation — ordinary-override fixture text (red/green)', () => {
    it('red: an ordinary override file with no `> Overrides: …` line', () => {
        const text = [
            '# Override: Rule — some-ordinary-rule',
            '',
            '> Override for `.augment/rules/some-ordinary-rule.md`',
            '',
            '---',
            '**Mode:** `extend`',
            '**Original:** `.augment/rules/some-ordinary-rule.md`',
            '---',
            '',
            '## Project-specific addition',
            '',
            'Some prose with no citation line at all.',
            '',
        ].join('\n');
        expect(has_citation(text)).toBe(false);
        expect(
            classify_violations({
                kernel: false,
                is_floor: false,
                mode: parse_mode(text),
                cited: has_citation(text),
                is_registered: false,
            }),
        ).toEqual([
            'missing-citation: no `> Overrides: <rule> §<section> — <reason>` line ' +
                '(override-system.md § Citation obligation)',
        ]);
    });

    it('green: the same fixture with the citation line added', () => {
        const text = [
            '# Override: Rule — some-ordinary-rule',
            '',
            '> Override for `.augment/rules/some-ordinary-rule.md`',
            '',
            '---',
            '**Mode:** `extend`',
            '**Original:** `.augment/rules/some-ordinary-rule.md`',
            '---',
            '',
            '> Overrides: some-ordinary-rule §Some Section — project needs a stricter check here.',
            '',
            '## Project-specific addition',
            '',
            'Some prose.',
            '',
        ].join('\n');
        expect(has_citation(text)).toBe(true);
        expect(
            classify_violations({
                kernel: false,
                is_floor: false,
                mode: parse_mode(text),
                cited: has_citation(text),
                is_registered: false,
            }),
        ).toEqual([]);
    });
});
