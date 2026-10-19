/**
 * The identifier rows over this tree's shipped surfaces, pinned as ceilings.
 *
 * The census the unvalidated copies were measured with (one phone regex alone
 * matched tens of thousands of times over the tracked tree) re-run through the
 * table. A row that starts matching ordinary code or prose raises a count past
 * its ceiling and turns this red; lowering a ceiling after a precision gain is
 * the expected direction. A ceiling bounds false positives only: a row that
 * stops detecting stays green here, which the rule tests guard instead.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { detect, IDENTIFIER_RULES } from './egress_rules.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Per identifier rule, the most hits `src/` and `docs/` may carry. */
const CEILING: Readonly<Record<string, number>> = {
    iban: 0,
    'payment-card': 0,
    email: 2,
    'phone-international': 0,
    'phone-national': 0,
    'phone-nanp': 0,
    'de-tax-id': 0,
    'us-ssn': 0,
};

describe('identifier census over src/ and docs/', () => {
    it('stays within each pinned ceiling', () => {
        const files = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--', 'src', 'docs'], { encoding: 'utf8' })
            .split('\0')
            .filter(Boolean);
        const counts: Record<string, number> = Object.fromEntries(IDENTIFIER_RULES.map((r) => [r.rule, 0]));
        for (const f of files) {
            const full = path.join(REPO, f);
            // A tracked path deleted in the working tree is not part of the corpus; any other read failure is.
            if (!fs.existsSync(full)) continue;
            const body = fs.readFileSync(full);
            if (body.length > 2_000_000 || body.includes(0)) continue;
            for (const s of detect(body.toString('utf8'))) {
                if (s.class === 'identifier') counts[s.rule] = (counts[s.rule] ?? 0) + 1;
            }
        }
        expect(Object.keys(CEILING).sort()).toEqual(IDENTIFIER_RULES.map((r) => r.rule).sort());
        for (const [rule, n] of Object.entries(counts)) {
            expect(n, `${rule}: ${n} hits, ceiling ${CEILING[rule]}`).toBeLessThanOrEqual(CEILING[rule] as number);
        }
    }, 60_000);
});
