// The `answered_at` column and the two predicates that read the same table.
//
// `block_exit: null` used to mean two opposite things at once — "read the
// host's contract, it honours no refusal here" and "nobody ever looked". The
// column separates them, and these tests pin the three places that separation
// has to hold: the parser that carries the field, the lint that requires it,
// and the emission predicate that must NOT read a freshly-dated row as a
// licence to write an envelope the host parses nothing of.
import { afterEach, describe, expect, it } from 'vitest';

import { UNDATED, buildRows, renderRegion } from '../../src/scripts/check_enforcement_matrix.js';
import { _resetHostLoweringCache, parseHostLowering } from '../../src/scripts/hooks/host_lowering.js';
import { usesNativeEmission } from '../../src/scripts/hooks/host_semantics.js';
import { _check_slot_answers } from '../../src/scripts/lint_hook_manifest.js';

/** A one-host table. `slot` is spliced in verbatim so a case can omit a field. */
function table(opts: { verified: string; slot: string; json_shape?: string; host?: string }) {
    return parseHostLowering(`
schema_version: 1
hosts:
  ${opts.host ?? 'fixturehost'}:
    surfaces:
      any:
        entry_shape: none
        json_shape: ${opts.json_shape ?? 'none'}
        fail_policy: propagate
        timeout_unit: unknown
        timeout_default: null
        verified: ${opts.verified}
        slots:
          pre_tool_use: { native: PreToolUse, block_exit: null, ${opts.slot} }
`);
}

const CITED = `
          docs_at: "2026-01-01"
          docs_url: https://example.invalid/hooks
          probe_at: "2026-01-01"
          host_version: "0.0.1"
          expires: "2099-01-01"`;

const UNCITED = `
          docs_at: "2026-01-01"
          docs_url: null
          probe_at: "2026-01-01"
          host_version: "0.0.1"
          expires: "2099-01-01"`;

function errorsFor(t: ReturnType<typeof table>): string[] {
    const errors: string[] = [];
    _check_slot_answers(t, errors);
    return errors;
}

describe('_check_slot_answers', () => {
    it('refuses a slot that carries no date at all', () => {
        const errors = errorsFor(table({ verified: CITED, slot: 'matcher: x' }));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('no `answered_at`');
        expect(errors[0]).toContain('fixturehost/any/pre_tool_use');
    });

    it('refuses a date that is not an ISO calendar day', () => {
        const errors = errorsFor(table({ verified: CITED, slot: 'answered_at: "yesterday"' }));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('is not an ISO');
    });

    it('accepts a dated slot that inherits the row citation', () => {
        expect(errorsFor(table({ verified: CITED, slot: 'answered_at: "2026-01-01"' }))).toEqual([]);
    });

    it('refuses a dated slot on a verified row that cites nothing', () => {
        const errors = errorsFor(table({ verified: UNCITED, slot: 'answered_at: "2026-01-01"' }));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('with no citation');
    });

    it('accepts a dated slot carrying its own citation on an uncited row', () => {
        const slot = 'answered_at: "2026-01-01", docs_url: "https://example.invalid/slot"';
        expect(errorsFor(table({ verified: UNCITED, slot }))).toEqual([]);
    });

    // The exemption the check's own block comment states. Before this was
    // implemented the branch fired on `verified: null` too, so an unverified
    // row reported its missing provenance twice — once at row level, once as a
    // missing citation — and the second report named a fix (add a docs_url)
    // that does not address the first.
    it('exempts an unverified row from the citation half, but not from the date', () => {
        expect(errorsFor(table({ verified: 'null', slot: 'answered_at: "2026-01-01"' }))).toEqual([]);
        const undated = errorsFor(table({ verified: 'null', slot: 'matcher: x' }));
        expect(undated).toHaveLength(1);
        expect(undated[0]).toContain('no `answered_at`');
    });
});

describe('usesNativeEmission', () => {
    afterEach(() => _resetHostLoweringCache());

    it('is false for a platform the committed table never verified', () => {
        expect(usesNativeEmission('nosuchhost')).toBe(false);
    });

    // The regression this predicate exists for: dating seven rows made them
    // verified, and reading verified-ness alone would have started emitting
    // Claude Code's envelope onto hosts that declare `json_shape: none`.
    it('is false for a verified platform whose row declares no envelope', () => {
        _resetHostLoweringCache(
            table({ host: 'claude', verified: CITED, slot: 'answered_at: "2026-01-01"', json_shape: 'none' }),
        );
        expect(usesNativeEmission('claude')).toBe(false);
    });

    // The optional chain's default. A row that is absent altogether must read
    // as "no envelope"; falling through to `undefined !== "none"` would make a
    // missing row more permissive than a row that says `none` out loud.
    it('is false for a verified platform whose row is absent from the table', () => {
        _resetHostLoweringCache(
            table({ verified: CITED, slot: 'answered_at: "2026-01-01"', json_shape: 'claude-code' }),
        );
        expect(usesNativeEmission('claude')).toBe(false);
    });

    it('is true only when the row is both verified and declares an envelope', () => {
        _resetHostLoweringCache(
            table({ host: 'claude', verified: CITED, slot: 'answered_at: "2026-01-01"', json_shape: 'claude-code' }),
        );
        expect(usesNativeEmission('claude')).toBe(true);
    });
});

describe('the Answered column', () => {
    it('prints the date for a dated pair', () => {
        const t = table({ verified: CITED, slot: 'answered_at: "2026-01-01"' });
        expect(buildRows(t).rows[0]?.answered).toBe('2026-01-01');
        expect(renderRegion(t)).toContain('| Answered |');
    });

    it('prints a word, not an empty cell, for an undated pair', () => {
        const t = table({ verified: CITED, slot: 'matcher: x' });
        expect(buildRows(t).rows[0]?.answered).toBe(UNDATED);
        expect(renderRegion(t)).toContain(`| ${UNDATED} |`);
    });
});
