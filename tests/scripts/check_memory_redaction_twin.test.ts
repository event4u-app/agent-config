// The consumer template of check_memory.ts cannot import `_lib/egress_rules`, so it
// keeps a hand-written literal of the inline-credential pattern the dev side builds
// with `assignmentPattern`. memory-twin-verdicts.yml bounds the two files by changed
// LINE COUNT only, which cannot see a regex that drifted inside an unchanged line.
// This pins the content: a change to the shared detector reds here until the
// shipped template's literal follows it.
import { describe, expect, it } from 'vitest';

import { REDACTION_PATTERNS as DEV } from '../../src/scripts/check_memory.js';
import { REDACTION_PATTERNS as TEMPLATE } from '../../src/agent-src/templates/scripts/check_memory.js';

describe('check_memory redaction patterns — template twin', () => {
    it('ships the same patterns, source and flags, as the dev side builds', () => {
        const shape = (rows: typeof DEV) => rows.map(([re, label]) => [re.source, re.flags, label]);
        expect(shape(TEMPLATE)).toEqual(shape(DEV));
    });
});
