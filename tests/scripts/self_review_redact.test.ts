// `--redact-egress`: the detector's own tests carry credential-shaped fixtures
// the egress guard refuses to send; redaction turns them into typed tokens the
// same guard then lets through.

import { describe, expect, it } from 'vitest';

import { councilEgress } from '../../src/scripts/ai_council/council_egress.js';
import { REDACTION_NOTE, redactEgress } from '../../src/scripts/self_review_gate.js';

const FAKE_URI = ['postgres://admin', ':hunter2', '@db.internal:5432/prod'].join('');
const DIFF = `+const fixture = '${FAKE_URI}';\n+expect(detect(fixture)).toHaveLength(1);\n`;

describe('redactEgress', () => {
    it('the unredacted fixture is refused by the egress guard', () => {
        expect(councilEgress().check(DIFF)).not.toBeNull();
    });

    it('the redacted chunk passes the same guard and keeps the surrounding logic', () => {
        const out = redactEgress(DIFF);
        expect(out).not.toContain(FAKE_URI);
        expect(out).toContain('expect(detect(fixture)).toHaveLength(1);');
        expect(councilEgress().check(`${REDACTION_NOTE}${out}`)).toBeNull();
    });
});
