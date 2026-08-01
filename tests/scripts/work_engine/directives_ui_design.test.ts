import { describe, expect, it } from 'vitest';

import {
    AMBIGUITIES,
    PLACEHOLDER_PATTERNS,
    REQUIRED_BRIEF_KEYS,
    REQUIRED_STATE_KEYS,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';

describe('directives/ui/design — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect([...REQUIRED_BRIEF_KEYS]).toEqual(['layout', 'components', 'states', 'microcopy', 'a11y']);
        expect([...REQUIRED_STATE_KEYS]).toEqual(['empty', 'loading', 'error', 'success', 'disabled']);
        expect([...PLACEHOLDER_PATTERNS]).toEqual(['<placeholder>', 'lorem', 'todo:', 'tbd', 'xxx']);
        // 4 since the port branch: `design_provided_without_contract` joins the
        // three brief-lock codes (road-to-provided-artifact-honesty Phase 2).
        expect(AMBIGUITIES).toHaveLength(4);
        expect(AMBIGUITIES.map((a) => a['code'])).toContain(
            'design_provided_without_contract',
        );
    });
});
