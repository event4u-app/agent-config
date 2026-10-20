/**
 * The bundled prefix projection is the table's list, byte for byte in order.
 * A row that gains or loses a prefix reds this until `egress_prefixes.ts` is
 * regenerated, so the projection can never carry a prefix the table dropped or
 * miss one it added.
 */
import { describe, expect, it } from 'vitest';

import { API_KEY_ASSIGNMENT_KEYWORD, CREDENTIAL_PREFIXES as PROJECTION } from './egress_prefixes.js';
import { ASSIGNMENT_KEYWORDS, CREDENTIAL_PREFIXES } from './egress_rules.js';

describe('egress_prefixes projection', () => {
    it('equals the rule table', () => {
        const body = CREDENTIAL_PREFIXES.map((p) => `    '${p}',`).join('\n');
        expect(PROJECTION, `regenerate the list in egress_prefixes.ts as:\n${body}`).toEqual(CREDENTIAL_PREFIXES);
    });

    it('carries the api-key keyword exactly as the table spells it', () => {
        expect(API_KEY_ASSIGNMENT_KEYWORD).toBe(ASSIGNMENT_KEYWORDS.apiKey);
    });
});
