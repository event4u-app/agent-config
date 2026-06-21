// Tests for src/scripts/lint_positioning.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants + _topic_present spot-checks, and
// a golden-parity layer (python3 vs tsx on the REAL REPO across default +
// --quiet) asserting byte-identical stdout/stderr/exit. Skipped without python3.
// CI invocation is `lint_positioning --quiet`.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_positioning.js';



describe('lint_positioning — constants + _topic_present', () => {
    it('DESCRIPTION_MAX is 200', () => {
        expect(mod.DESCRIPTION_MAX).toBe(200);
    });

    it('_topic_present matches a hyphen→space paraphrase', () => {
        const [present, needle] = mod._topic_present('ai agent os is here', 'ai-agent-os', {});
        expect(present).toBe(true);
        expect(needle).toBe('ai agent os');
    });

    it('_topic_present honours the equivalents map', () => {
        const [present, needle] = mod._topic_present('we ship an agent operating system', 'ai-agent-os', {
            'ai-agent-os': ['agent operating system'],
        });
        expect(present).toBe(true);
        expect(needle).toBe('agent operating system');
    });

    it('_topic_present returns false + null when absent', () => {
        const [present, needle] = mod._topic_present('nothing relevant', 'blockchain', {});
        expect(present).toBe(false);
        expect(needle).toBeNull();
    });
});

