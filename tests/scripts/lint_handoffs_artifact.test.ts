// HANDOFF.md artifact validation (workflow-contracts Phase 2).
import { expect, test } from 'vitest';

import { validate_handoff_artifact } from '../../src/scripts/lint_handoffs.js';

const FULL = `# HANDOFF
## Mode
Implement (TDD)
## Contract received
failing test for slugify edge case
## Contract owed
green run output
## Decisions
- kept current API
## Open questions
- none
## Next command
npx vitest run tests/slugify.test.ts
`;

test('complete artifact validates', () => {
    expect(validate_handoff_artifact(FULL)).toEqual([]);
});

test('missing "Contract owed" → red (acceptance fixture)', () => {
    const broken = FULL.replace('## Contract owed\ngreen run output\n', '');
    expect(validate_handoff_artifact(broken)).toEqual(['Contract owed']);
});
