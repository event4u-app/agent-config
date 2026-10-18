/**
 * `maskingEnd` decides, once, how far a masking surface removes a credential it
 * cannot refuse. Each branch of its fallback is pinned here directly, so a change
 * to `replacementEnd` or `pemMaskEnd` that reorders the precedence fails a named
 * case rather than slipping past an integration fixture.
 */
import { describe, expect, it } from 'vitest';

import { detect, maskingEnd } from './egress_rules.js';

const BEGIN = (label: string): string => `-----BEGIN ${label}PRIVATE ` + 'KEY-----';
const END = (label: string): string => `-----END ${label}PRIVATE ` + 'KEY-----';

function onlySpan(text: string, rule: string): ReturnType<typeof detect>[number] {
    const span = detect(text).find((s) => s.rule === rule);
    if (span === undefined) throw new Error(`no ${rule} span`);
    return span;
}

describe('maskingEnd', () => {
    it('a proven key block ends at its own END marker', () => {
        const text = `${BEGIN('RSA ')}\nbody1\n${END('RSA ')}\ntail`;
        const span = onlySpan(text, 'pem-private-key');
        expect(maskingEnd(text, span)).toBe(text.indexOf('\ntail'));
    });

    it('an unproven block masks through the nearest END of any label', () => {
        const text = `${BEGIN('RSA ')}\nbody2\n${END('EC ')}\nmid\n${END('RSA ')}\ntail`;
        const span = onlySpan(text, 'pem-private-key');
        const first = text.indexOf(END('EC ')) + END('EC ').length;
        expect(maskingEnd(text, span)).toBe(first);
    });

    it('a block with no END marker falls back to its detection span', () => {
        const text = `${BEGIN('RSA ')}\nbody3 never closed`;
        const span = onlySpan(text, 'pem-private-key');
        expect(maskingEnd(text, span)).toBe(span.end);
    });

    it('a detection-grade row ends at its detection span', () => {
        const text = `x AKIA${'ABCDEFGHIJ234567'} y`;
        const span = onlySpan(text, 'aws-access-key');
        expect(maskingEnd(text, span)).toBe(span.end);
    });
});
