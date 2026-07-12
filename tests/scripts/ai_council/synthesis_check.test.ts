// Tests for the Phase-0 synthesis render-check (road-to-opt-council-deliberation).
//
// `assert_synthesis_sections` validates a COMPLETED synthesis (host/chairman
// output, not the template prompt): every lens must close with a non-empty
// `### Kill criteria` and `### Concrete next step`. Pure string validation —
// no CLI, no network.
import { describe, expect, it } from 'vitest';

import {
    assert_synthesis_sections,
    SynthesisRenderError,
} from '../../../src/scripts/ai_council/prompts.js';

const COMPLETE = `## Convergence / Divergence

### Recommendation
Ship option A — it is the strongest converged point.

### Kill criteria
- p95 latency regresses past 250ms on the checkout path.
- the migration backfill fails on > 0.1% of rows.

### Concrete next step
Open a PR wiring the option-A adapter behind the existing feature flag.`;

const MISSING_KILL_CRITERIA = `## Convergence / Divergence

### Recommendation
Ship option A.

### Concrete next step
Open the PR.`;

const MISSING_NEXT_STEP = `## Convergence / Divergence

### Recommendation
Ship option A.

### Kill criteria
- latency regresses past 250ms.`;

const EMPTY_KILL_CRITERIA = `## Convergence / Divergence

### Kill criteria

### Concrete next step
Open the PR.`;

const CREATIVE_COMPLETE = `Free-form design synthesis: the council converged on a
calmer palette and diverged on the hero treatment.

### Kill criteria
- the contrast ratio drops below WCAG AA on the CTA.

### Concrete next step
Produce a single hi-fi mock of the agreed hero.`;

describe('assert_synthesis_sections — verdict-discipline render check (Phase 0)', () => {
    it('passes a complete decision synthesis with both required sections', () => {
        expect(() => assert_synthesis_sections(COMPLETE)).not.toThrow();
    });

    it('passes a creative synthesis (free-form body + the two required sections)', () => {
        expect(() => assert_synthesis_sections(CREATIVE_COMPLETE)).not.toThrow();
    });

    it('throws SynthesisRenderError naming Kill criteria when it is absent', () => {
        expect(() => assert_synthesis_sections(MISSING_KILL_CRITERIA)).toThrow(
            SynthesisRenderError,
        );
        expect(() => assert_synthesis_sections(MISSING_KILL_CRITERIA)).toThrow(
            /Kill criteria/,
        );
    });

    it('throws when Concrete next step is absent', () => {
        expect(() => assert_synthesis_sections(MISSING_NEXT_STEP)).toThrow(
            /Concrete next step/,
        );
    });

    it('throws on a placeholder-empty required section', () => {
        expect(() => assert_synthesis_sections(EMPTY_KILL_CRITERIA)).toThrow(
            /empty \(placeholder\)/,
        );
    });

    it('matches the heading case-insensitively', () => {
        const lowered = COMPLETE.replace('### Kill criteria', '### kill criteria').replace(
            '### Concrete next step',
            '### CONCRETE NEXT STEP',
        );
        expect(() => assert_synthesis_sections(lowered)).not.toThrow();
    });
});
