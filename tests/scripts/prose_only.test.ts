import { describe, expect, it } from 'vitest';

import { proseOnly } from '../../src/scripts/report_invocation_surface.js';

/**
 * The placeholder ratchet's `{{…}}` ceiling is zero, so everything this stripper
 * lets through becomes a finding and everything it wrongly removes becomes a
 * blind spot. Each case below is a shape an independent review found an earlier
 * regex-based version getting wrong — three leaks and one over-strip — kept as
 * named cases so a future simplification cannot quietly reintroduce them.
 */
const has = (text: string, token: string): boolean => proseOnly(text).includes(token);

describe('proseOnly — fenced code is removed', () => {
    it('a plain fence', () => {
        expect(has('before\n\n```\n{{x}}\n```\n\nafter\n', '{{x}}')).toBe(false);
    });

    it('a tilde fence', () => {
        expect(has('~~~\n{{x}}\n~~~\n', '{{x}}')).toBe(false);
    });

    it('an UNCLOSED fence runs to end of file', () => {
        // The leak: a regex needing a closing fence left the rest of the file
        // counted as prose.
        expect(has('text\n\n```sh\n{{x}}\nstill code\n', '{{x}}')).toBe(false);
    });

    it('a closing fence indented one to three spaces still closes it', () => {
        // Legal CommonMark. An exact-indent match treated this as unclosed.
        const text = '```\ncode\n  ```\n\n{{x}} is prose here.\n';
        expect(has(text, '{{x}}')).toBe(true);
    });

    it('a four-backtick fence wrapping a three-backtick one', () => {
        // The inner fence must not close the outer: a closer is at least as long.
        expect(has('````\n```\n{{x}}\n```\n````\n', '{{x}}')).toBe(false);
    });

    it('an indented fence is removed with its content', () => {
        expect(has('- item\n\n  ```\n  {{x}}\n  ```\n', '{{x}}')).toBe(false);
    });
});

describe('proseOnly — indented code vs list continuation', () => {
    it('an indented code block after a blank line is removed', () => {
        expect(has('text\n\n    {{x}}\n\nmore\n', '{{x}}')).toBe(false);
    });

    it('a nested bullet is KEPT — it is prose, not code', () => {
        // The over-strip: a naive four-space rule blanked 217 prose lines across
        // the corpus, 74 of them list-shaped, so a placeholder in a nested
        // bullet was invisible to the ratchet.
        expect(has('- outer\n    - nested {{x}} here\n', '{{x}}')).toBe(true);
    });

    it('a list continuation paragraph is KEPT', () => {
        expect(has('- item\n\n    continuation with {{x}}\n', '{{x}}')).toBe(true);
    });

    it('an indented block after the list closes is removed again', () => {
        const text = '- item\n  - nested\n\nplain paragraph\n\n    {{x}}\n';
        expect(has(text, '{{x}}')).toBe(false);
    });
});

describe('proseOnly — inline code', () => {
    it('a token inside backticks is removed', () => {
        expect(has('the marker `<TBD>` is described here\n', '<TBD>')).toBe(false);
    });

    it('a token outside backticks survives', () => {
        expect(has('the marker <TBD> is used here\n', '<TBD>')).toBe(true);
    });
});

describe('proseOnly — prose is otherwise preserved', () => {
    it('ordinary paragraphs survive intact', () => {
        const text = 'One line.\n\nAnother with ${a} in it.\n';
        expect(proseOnly(text)).toContain('${a}');
        expect(proseOnly(text)).toContain('One line.');
    });

    it('line count is preserved, so offsets do not shift', () => {
        const text = 'a\n\n```\ncode\n```\n\nb\n';
        expect(proseOnly(text).split('\n')).toHaveLength(text.split('\n').length);
    });
});
