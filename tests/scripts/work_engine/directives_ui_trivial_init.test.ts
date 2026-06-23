// Intent tests for work_engine/directives/ui_trivial/index.ts (ADR-096 py2ts
// Phase 1 — work_engine TOP/integration layer). The python byte-parity rig is
// gone; this asserts the tsx module's own contract directly. Note:
// DIRECTIVE_SET_NAME is the hyphenated wire form `ui-trivial` while the package
// dir is underscore `ui_trivial`.
import { describe, expect, it } from 'vitest';

import {
    DIRECTIVE_SET_NAME,
    ROADMAP,
    SUPPORTED_KINDS,
    get_steps,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui_trivial/index.js';

describe('directives/ui_trivial index — shape', () => {
    it('hyphenated wire name + roadmap + kinds', () => {
        expect(DIRECTIVE_SET_NAME).toBe('ui-trivial');
        expect(ROADMAP).toBe('agents/roadmaps/road-to-product-ui-track.md');
        expect([...SUPPORTED_KINDS]).toEqual(['ticket', 'prompt', 'diff', 'file']);
    });
    it('get_steps order', () => {
        expect([...get_steps().keys()]).toEqual([
            'refine', 'memory', 'analyze', 'plan', 'implement', 'test', 'verify', 'report',
        ]);
    });
    it('all callables', () => {
        for (const h of get_steps().values()) expect(typeof h).toBe('function');
    });
});
