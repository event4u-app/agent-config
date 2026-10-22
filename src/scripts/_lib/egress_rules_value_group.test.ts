/**
 * The alternative-group discard rule of `valueGroupOf`, asserted through the
 * exported `evaluateMatch`.
 *
 * A rule that declares its value as ALTERNATIVE capture groups must take the
 * first group that participated, and must DISCARD a match in which none did.
 * Falling back to the whole match there would hand a replacer the keyword along
 * with the value — for a credential row, a placeholder that swallows `token:`
 * and leaves a reader unable to tell what was removed, or a span that reaches
 * past the secret.
 *
 * `egress_rules_parity.test.ts` cannot see this: it compares each rule against
 * its pre-move pattern, and the one rule that uses alternatives
 * (`review-assignment`) was added after the move, so the parity loop skips it.
 * Removing the discard rule left all 723 parity cases green, which is why this
 * file exists.
 */
import { describe, expect, it } from 'vitest';

import { evaluateMatch, findSpans, REVIEW_CREDENTIAL_ROWS, type EgressRule } from './egress_rules.js';

/** A row with two alternative value groups behind a keyword. */
function rule(valueGroup: number | readonly number[]): EgressRule {
    return {
        rule: 'probe-alternatives',
        type: 'PROBE',
        class: 'credential',
        // Group 1 is the keyword. Groups 2 and 3 are the two shapes a value can
        // take; the trailing `|keyword:$` branch matches with neither present.
        pattern: /(token):\s*(?:"([^"]+)"|([A-Za-z0-9]+)|$)/dgu,
        replacement: 'detection',
        valueGroup,
    } as unknown as EgressRule;
}

function firstMatch(r: EgressRule, text: string): RegExpExecArray {
    const re = new RegExp(r.pattern.source, r.pattern.flags);
    const m = re.exec(text);
    if (m === null) throw new Error(`probe pattern did not match ${JSON.stringify(text)}`);
    return m;
}

describe('valueGroupOf — alternative groups', () => {
    it('takes the first group that participated (quoted shape)', () => {
        const text = 'token: "abc123"';
        const r = rule([2, 3]);
        const hit = evaluateMatch(r, text, firstMatch(r, text));
        expect(hit).not.toBeNull();
        expect(text.slice(hit!.start, hit!.end)).toBe('abc123');
    });

    it('takes the first group that participated (bare shape)', () => {
        const text = 'token: abc123';
        const r = rule([2, 3]);
        const hit = evaluateMatch(r, text, firstMatch(r, text));
        expect(hit).not.toBeNull();
        expect(text.slice(hit!.start, hit!.end)).toBe('abc123');
    });

    it('DISCARDS a match in which no alternative participated — never reads it as the whole match', () => {
        const text = 'token:';
        const r = rule([2, 3]);
        const m = firstMatch(r, text);
        // Precondition, so a passing case means what it says: the regex DID
        // match, and neither value group took part.
        expect(m[0]).toBe('token:');
        expect(m[2]).toBeUndefined();
        expect(m[3]).toBeUndefined();
        expect(evaluateMatch(r, text, m)).toBeNull();
    });

    it('a single numeric group is unaffected by the alternatives rule', () => {
        const text = 'token: abc123';
        const r = rule(3);
        const hit = evaluateMatch(r, text, firstMatch(r, text));
        expect(text.slice(hit!.start, hit!.end)).toBe('abc123');
    });
});

describe('review-assignment — a quoted literal is not a code expression', () => {
    const values = (text: string): string[] =>
        findSpans(text, REVIEW_CREDENTIAL_ROWS).map((s) => text.slice(s.start, s.end));

    it('masks a quoted value carrying password punctuation', () => {
        expect(values('password = "p@ss,word$1"')).toEqual(['p@ss,word$1']);
        expect(values("secret: 'ab.cd1234'")).toEqual(['ab.cd1234']);
    });

    it('still reads a bare code expression as code', () => {
        expect(values('secret: opts.secret')).toEqual([]);
        expect(values('token = load(x)')).toEqual([]);
    });
});
