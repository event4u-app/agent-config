/**
 * Kernel-override audit (road-to-enforcement-proof P2.6).
 *
 * The class this guard defends is "tighten yes, replace never". The tests below
 * pin both directions, because a guard that only ever sees a clean tree is
 * indistinguishable from a guard that does nothing.
 */
import { describe, expect, it } from 'vitest';

import {
    has_citation,
    parse_mode,
    registered_rules,
} from '../../src/scripts/lint_override_kernel_guard.js';
import { KERNEL_RULE_IDS, is_kernel_rule } from '../../src/scripts/_lib/kernel_rules.js';

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
