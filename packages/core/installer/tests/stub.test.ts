/**
 * Retirement marker test — see `../tsconfig.json` for the rationale.
 * The legacy `.github/workflows/tests.yml` Node-Tests matrix runs
 * `npx vitest run` inside this directory; a zero-test run exits
 * non-zero, so one trivial assertion keeps the step green until a
 * maintainer with `workflow` OAuth scope removes the step entirely.
 */
import { describe, expect, it } from 'vitest';

import { RETIRED } from '../src/index.js';

describe('packages/core/installer (retired)', () => {
    it('exports the RETIRED marker so the legacy CI step has work to do', () => {
        expect(RETIRED).toBe(true);
    });
});
