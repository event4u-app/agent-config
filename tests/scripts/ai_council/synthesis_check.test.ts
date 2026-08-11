// Tests for the Phase-0 synthesis render-check (road-to-opt-council-deliberation).
//
// `assert_synthesis_sections` validates a COMPLETED synthesis (host/chairman
// output, not the template prompt): every lens must close with a non-empty
// `### Kill criteria` and `### Concrete next step`. Pure string validation —
// no CLI, no network.
import { describe, expect, it } from 'vitest';

import {
    assert_synthesis_matches_tally,
    assert_synthesis_sections,
    describe_verdict_mismatch,
    parse_verdict_line,
    SPLIT_VERDICT_LABEL,
    SynthesisRenderError,
    VERDICT_LINE_CONTRACT,
} from '../../../src/scripts/ai_council/prompts.js';
import { tally_stances } from '../../../src/scripts/ai_council/stance_tally.js';

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

// ── Phase 2.1: the verdict must agree with the tally it is rendered beside ──
//
// `assert_synthesis_sections` above is a SHAPE check — it never sees the tally,
// so a synthesis could report agreement over a tally that recorded dissent and
// nothing downstream disagreed. Same class as the recorded 9.14.0 release
// failure that `check_finding_dispositions.ts` closes on the release surface.

/** Build a real tally from member texts — never a hand-written struct. */
function tallyFrom(...stances: string[]) {
    return tally_stances(
        stances.map((s, i) => ({ member: `m${i}`, text: `prose\n${s}` })),
    );
}

const STANCE_A = 'STANCE: option A | CONFIDENCE: high | DEALBREAKER: no';
const STANCE_B = 'STANCE: option B | CONFIDENCE: high | DEALBREAKER: no';

describe('parse_verdict_line — explicit line, never prose inference', () => {
    it('parses the closing verdict line', () => {
        expect(parse_verdict_line('body\nVERDICT: option A')).toEqual({
            label: 'option a',
            display: 'option A',
        });
    });

    it('returns null when no verdict line exists — a repair marker, not a guess', () => {
        expect(parse_verdict_line(COMPLETE)).toBeNull();
    });

    it('does NOT mine agreement out of prose', () => {
        const prose = 'The council converged unanimously on option A. Consensus was total.';
        expect(parse_verdict_line(prose)).toBeNull();
    });

    it('takes the LAST line when several appear', () => {
        expect(parse_verdict_line('VERDICT: old\nmore\nVERDICT: final')?.label).toBe('final');
    });

    it('treats the contract’s own placeholder as absent', () => {
        // The templated render body IS this contract text; a parser without the
        // guard would read `<option-label>` as a claimed winner.
        expect(parse_verdict_line(VERDICT_LINE_CONTRACT)).toBeNull();
    });
});

describe('assert_synthesis_matches_tally — verdict vs. counted stances', () => {
    it('passes when the verdict names the option the tally cleared', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(tally.consensus?.label).toBe('option A');
        expect(() =>
            assert_synthesis_matches_tally('body\nVERDICT: option A', tally),
        ).not.toThrow();
    });

    it('throws when the synthesis claims a winner over a recorded split', () => {
        const tally = tallyFrom(STANCE_A, STANCE_B);
        expect(tally.split).toBe(true);
        expect(() =>
            assert_synthesis_matches_tally('body\nVERDICT: option A', tally),
        ).toThrow(SynthesisRenderError);
        expect(() =>
            assert_synthesis_matches_tally('body\nVERDICT: option A', tally),
        ).toThrow(/recorded no consensus/);
    });

    it('accepts an honest split verdict over a split tally', () => {
        const tally = tallyFrom(STANCE_A, STANCE_B);
        expect(() =>
            assert_synthesis_matches_tally(`body\nVERDICT: ${SPLIT_VERDICT_LABEL}`, tally),
        ).not.toThrow();
    });

    it('throws when the synthesis claims a split the tally did not record', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(() =>
            assert_synthesis_matches_tally(`body\nVERDICT: ${SPLIT_VERDICT_LABEL}`, tally),
        ).toThrow(/claims a split but the tally cleared/);
    });

    it('throws when the verdict names a different option than the tally cleared', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(() =>
            assert_synthesis_matches_tally('body\nVERDICT: option B', tally),
        ).toThrow(/but the tally cleared "option A"/);
    });

    it('matches the cleared label case-insensitively', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(() =>
            assert_synthesis_matches_tally('body\nVERDICT: OPTION A', tally),
        ).not.toThrow();
    });

    it('an absent verdict line never throws — backward compatible', () => {
        const tally = tallyFrom(STANCE_A, STANCE_B);
        expect(() => assert_synthesis_matches_tally(COMPLETE, tally)).not.toThrow();
    });

    it('does not throw on prose that merely sounds like agreement', () => {
        // The false-positive a prose detector would produce: this text records
        // a split in words and claims nothing machine-readable.
        const tally = tallyFrom(STANCE_A, STANCE_B);
        const prose = 'The council did NOT converge; two reviewers agree on nothing here.';
        expect(() => assert_synthesis_matches_tally(prose, tally)).not.toThrow();
    });

    // R2 finding 2. The version above tests AROUND the real false positive: it
    // uses prose with no line-initial marker, so it passed under the
    // case-insensitive regex that was the defect. These are the shapes that
    // actually reached the parser.
    it('ignores lower-case prose opening a line with "Verdict:"', () => {
        const tally = tallyFrom(STANCE_A, STANCE_B);
        const prose = 'Verdict: option A is the stronger choice, but the split stands.';
        expect(parse_verdict_line(prose)).toBeNull();
        expect(() => assert_synthesis_matches_tally(prose, tally)).not.toThrow();
    });

    it('ignores mixed-case "VerDict:" prose', () => {
        expect(parse_verdict_line('VerDict: we should probably ship A')).toBeNull();
    });

    it('still reads the contract-literal uppercase token', () => {
        expect(parse_verdict_line('VERDICT: option A')?.label).toBe('option a');
    });

    it('reports an empty tally honestly rather than as a split across zero', () => {
        // R2 finding 7: `consensus === null` was assumed to mean "split", so a
        // tally with no parsed stances read as "split across 0 option(s)".
        const empty = tallyFrom('no stance line at all');
        expect(empty.consensus).toBeNull();
        expect(empty.split).toBe(true);
        expect(empty.options.length).toBe(0);
        const msg = describe_verdict_mismatch('VERDICT: option A', {
            consensus: null,
            split: false,
            options: [],
        });
        expect(msg).toMatch(/no option-level stances parsed/);
        expect(msg).not.toMatch(/across 0 option/);
    });
});

describe('the reserved split label yields to a real option (R2 finding 8)', () => {
    const STANCE_SPLIT = 'STANCE: split | CONFIDENCE: high | DEALBREAKER: no';

    it('accepts VERDICT: split when the tally cleared an option named split', () => {
        const tally = tallyFrom(STANCE_SPLIT, STANCE_SPLIT);
        expect(tally.consensus?.label).toBe('split');
        expect(() =>
            assert_synthesis_matches_tally(`body\nVERDICT: ${SPLIT_VERDICT_LABEL}`, tally),
        ).not.toThrow();
    });

    it('keeps the reserved sense when no option carries that label', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(() =>
            assert_synthesis_matches_tally(`body\nVERDICT: ${SPLIT_VERDICT_LABEL}`, tally),
        ).toThrow(/claims a split but the tally cleared/);
    });
});

describe('describe_verdict_mismatch — the render-path shape', () => {
    // R2 finding 1: the render path must not throw. A throw inside `render()`
    // discards the whole artifact after every provider call is already paid for.
    it('returns null when the verdict matches the cleared option', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        expect(describe_verdict_mismatch('VERDICT: option A', tally)).toBeNull();
    });

    it('returns null when no verdict line exists', () => {
        expect(describe_verdict_mismatch(COMPLETE, tallyFrom(STANCE_A, STANCE_B))).toBeNull();
    });

    it('returns a message instead of throwing on a contradiction', () => {
        const tally = tallyFrom(STANCE_A, STANCE_B);
        let threw = false;
        let msg: string | null = null;
        try {
            msg = describe_verdict_mismatch('VERDICT: option A', tally);
        } catch {
            threw = true;
        }
        expect(threw).toBe(false);
        expect(msg).toMatch(/recorded no consensus/);
    });

    it('agrees with the throwing wrapper on every case it flags', () => {
        const tally = tallyFrom(STANCE_A, STANCE_A);
        for (const text of ['VERDICT: option B', `VERDICT: ${SPLIT_VERDICT_LABEL}`]) {
            expect(describe_verdict_mismatch(text, tally)).not.toBeNull();
            expect(() => assert_synthesis_matches_tally(text, tally)).toThrow(
                SynthesisRenderError,
            );
        }
    });
});
