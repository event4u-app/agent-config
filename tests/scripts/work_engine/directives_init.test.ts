// Intent test for work_engine/directives/index.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer). Was a python3-vs-tsx parity rig asserting
// the python `__init__.__all__ = []` matched the TS empty package-marker module;
// the `.py` original is gone, so the python-internal half is dropped. The TS
// contract — an empty public surface — is asserted directly below.
import { describe, expect, it } from 'vitest';

import * as directives from '../../../src/agent-src/templates/scripts/work_engine/directives/index.js';

describe('directives/index — empty package marker', () => {
    it('exposes no runtime members (mirrors __all__ = [])', () => {
        // `export {}` yields a module object with no own enumerable members.
        expect(Object.keys(directives)).toEqual([]);
    });
});
