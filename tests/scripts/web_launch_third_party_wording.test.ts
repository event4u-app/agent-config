// road-to-a-page-that-says-what-it-loads 5.1: the four outward rows state facts
// and never a legal conclusion. `legal-safety-floor` is pack-gated and does not
// fire on a web audit, so the vocabulary is enforced here, over every message
// template the rows can emit, and over the config rows that back them.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { MESSAGE_SAMPLES } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');

const FORBIDDEN: readonly RegExp[] = [
    /\bcompliant\b/i,
    /\bnon-?compliant\b/i,
    /DSGVO-konform/i,
    /\brechtssicher/i,
    /\babmahnsicher/i,
    /\billegal\b/i,
    /\bunlawful\b/i,
    /\bviolat(es|ion)\b/i,
    /\d+\s?(€|EUR\b|euro\b)/i,
    /€\s?\d/,
];
const ALLOWED_VERB = /\b(loads|requests|cites|superseded on|does not name|undecided|carries)\b/;

function forbiddenIn(text: string): string[] {
    return FORBIDDEN.filter((re) => re.test(text)).map((re) => re.source);
}

describe('closed output vocabulary', () => {
    const samples = MESSAGE_SAMPLES();
    const rows = ['third-party-load-in-markup', 'superseded-statute-in-legal-page', 'placeholder-in-legal-page', 'privacy-page-provider-coverage'];

    it('the sampler reaches every template class', () => {
        // finding (load, preconnect), undecided (unknown origin, dns-prefetch, gate),
        // statute, placeholder, coverage finding, thin-page undecided
        expect(samples.length).toBeGreaterThanOrEqual(8);
    });

    it('every emitted message is a fact in the allowed vocabulary', () => {
        for (const m of samples) {
            expect(forbiddenIn(m), m).toEqual([]);
            expect(ALLOWED_VERB.test(m), m).toBe(true);
        }
    });

    it('the configured rows that back the messages carry no verdict word either', () => {
        for (const c of loadConfig(REPO).checks.filter((x) => rows.includes(x.id))) {
            for (const field of [c.title, c.why, c.remediation, c.verification]) {
                expect(forbiddenIn(field), `${c.id}: ${field}`).toEqual([]);
            }
        }
    });

    it('the test bites: an injected verdict is caught', () => {
        expect(forbiddenIn(`${samples[0]} — the page is not DSGVO-konform`)).not.toEqual([]);
        expect(forbiddenIn('exposure of 100 € per visit')).not.toEqual([]);
        expect(forbiddenIn('this is illegal')).not.toEqual([]);
    });
});
