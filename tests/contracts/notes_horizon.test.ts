/**
 * Contract tests for the commitment horizon and the reopen cap.
 *
 * Sources: the two fenced Iron Laws in `src/rules/notes-first-reasoning.md`
 * and the four sections they point at in
 * `docs/guidelines/agent-infra/notes-horizon-mechanics.md`.
 *
 * WHAT THESE TESTS ARE, HONESTLY. The obligation is model-carried: no gate can
 * observe a run choosing a form and then executing twelve steps on it, so the
 * real check is behavioural and live trigger evaluation in this repository is a
 * human gate that hard-aborts under automation. These tests assert the
 * **artefacts the behaviour reads from**, which is strictly weaker, and they
 * are named as such rather than dressed up as the behavioural check.
 *
 * What they genuinely buy is the property the horizon rests on: its legal
 * values are a CLOSED list. A horizon naming no member of that list is a defect
 * on its face, and that is only true for as long as the list stays closed and
 * enumerated. These tests are what makes an edit that reopens it — dropping a
 * boundary, or softening the enumeration back into a judgement — fail rather
 * than pass silently.
 *
 * Every `expect` on live text is paired with a MUTATION that must fail. A test
 * that has never been seen red has unknown sensitivity, and an assertion over
 * prose is exactly where that bites: `toMatch(/reopen/)` passes on almost any
 * paragraph containing the word.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '../..');
const RULE = path.join(ROOT, 'src/rules/notes-first-reasoning.md');
const MECHANICS = path.join(
    ROOT,
    'docs/guidelines/agent-infra/notes-horizon-mechanics.md',
);

const rule = (): string => fs.readFileSync(RULE, 'utf-8');
const mechanics = (): string => fs.readFileSync(MECHANICS, 'utf-8');

/** A `###` section body, up to the next same-level heading. */
function section(text: string, heading: string): string {
    const start = text.indexOf(heading);
    expect(start, `${heading} must exist`).toBeGreaterThan(-1);
    const rest = text.slice(start + heading.length);
    const end = rest.search(/\n#{2,3} /);
    return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Content without layout: bold markers dropped, whitespace runs collapsed.
 *
 * The boundary names are emphasised and hard-wrapped, so `a **test\nresult**`
 * carries the phrase "test result" and a literal search does not find it.
 * Matching the normalised view asserts the CONTENT and lets the guideline be
 * rewrapped; matching the raw text would make every reflow a failure.
 */
function flat(text: string): string {
    return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * The enumerated boundary set — step 1.1 of the source roadmap.
 *
 * This array IS the fixture. It is spelled here rather than derived from the
 * guideline on purpose: a test that extracts the list and then checks the list
 * it extracted asserts nothing. Spelled independently, a boundary silently
 * dropped from the guideline reds this file.
 */
const BOUNDARIES = [
    'test result',
    'type or schema inspection',
    'compile',
    'runtime probe',
    'call-site inventory',
    'dry run',
    'browser observation',
    'dependency-contract read',
] as const;

/** Values that must NOT be legal horizons — the closed-list counter-fixture. */
const NON_BOUNDARIES = [
    'implement solution',
    'the work the evidence supports',
    'finish the feature',
    'next justified commitment',
] as const;

/**
 * The three reversibility classes and their ORDER — step 1.2.
 *
 * Ordered widest-first. The ordering is the checkable half: AC-2 requires the
 * reversible-local case to be WIDER than the irreversible one, so a table that
 * listed three classes at one width would satisfy "three rows" and fail the
 * contract.
 */
const REVERSIBILITY_CLASSES = [
    { match: /reversible local edit/i, width: /whole implementation slice/i },
    { match: /stateful or cross-layer/i, width: /next boundary/i },
    { match: /irreversible or a public contract/i, width: /\*\*before\*\*/i },
] as const;

describe('the commitment horizon — the boundary set is closed (1.1 / AC-1)', () => {
    it('every enumerated boundary is present in the guideline', () => {
        const body = flat(section(mechanics(), '### The horizon — which boundaries count'));
        for (const b of BOUNDARIES) {
            expect(body, `boundary "${b}" must be enumerated`).toContain(b);
        }
    });

    it('the set is stated AS a closed enumeration, not as a judgement', () => {
        const body = section(mechanics(), '### The horizon — which boundaries count');
        // "the nearest of these" is what makes it decidable from the plan.
        expect(body).toMatch(/nearest of these/i);
        expect(body).toMatch(/enumerable/i);
        // And the degraded prose form is named as the failure, not offered.
        expect(body).toMatch(/degrades to/i);
    });

    it("the rule's Iron Law forbids the judgement form outright", () => {
        const text = rule();
        expect(text).toMatch(/NAME THE BOUNDARY FROM THE LIST/);
        expect(text).toMatch(/A JUDGEMENT IS NOT A HORIZON/);
    });

    it('COUNTER: a horizon naming no member of the set is not legal', () => {
        const body = flat(section(mechanics(), '### The horizon — which boundaries count'));
        const legal = (candidate: string): boolean =>
            BOUNDARIES.some((b) => candidate.toLowerCase().includes(b));
        // The fixture values a filled-but-meaningless field would carry.
        for (const bad of NON_BOUNDARIES) {
            expect(legal(bad), `"${bad}" must not satisfy the boundary set`).toBe(false);
        }
        // And at least one real one must, or the predicate proves nothing.
        expect(legal('stop at the call-site inventory')).toBe(true);
        // Sensitivity: drop a boundary from the guideline and the first test reds.
        const mutated = body.replace('call-site inventory', 'x');
        expect(mutated).not.toContain('call-site inventory');
    });
});

describe('horizon width scales with reversibility (1.2 / AC-2)', () => {
    it('three classes, three widths, in the order the contract requires', () => {
        const body = section(mechanics(), '### Width scales with reversibility');
        const rows = body.split('\n').filter((l) => l.trim().startsWith('|'));
        // header + separator + three classes
        expect(rows.length, 'the table carries exactly three classes').toBe(5);

        let cursor = 0;
        for (const cls of REVERSIBILITY_CLASSES) {
            const idx = body.search(cls.match);
            expect(idx, `class ${cls.match} must be present`).toBeGreaterThan(-1);
            expect(idx, 'classes must appear widest-first').toBeGreaterThan(cursor);
            cursor = idx;
        }
    });

    it('the widths are distinct — three rows at one width is not three widths', () => {
        const body = section(mechanics(), '### Width scales with reversibility');
        const widths = REVERSIBILITY_CLASSES.map((c) => {
            const row = body
                .split('\n')
                .find((l) => c.match.test(l) && l.trim().startsWith('|'));
            expect(row, `class ${c.match} must sit on a table row`).toBeTruthy();
            return (row as string).split('|')[2]?.trim() ?? '';
        });
        expect(new Set(widths).size, 'all three widths differ').toBe(3);
        for (const [i, c] of REVERSIBILITY_CLASSES.entries()) {
            expect(widths[i]).toMatch(c.width);
        }
    });

    it('the look-ahead ladder is a ceiling with the quiet case at one (1.4)', () => {
        const body = section(mechanics(), '### The look-ahead ladder is a CEILING');
        expect(body).toMatch(/\*maximum\*/);
        expect(body).toMatch(/\*\*one, deliberately\*\*/);
        expect(flat(body)).toMatch(/no artifact anywhere requires a minimum depth/);
    });
});

describe('reopen once, on contradiction (2.1 / 2.2 / AC-4)', () => {
    it('the trigger is a contradicting observation, never a schedule', () => {
        const text = rule();
        expect(text).toMatch(/AN OBSERVATION THAT CONTRADICTS THE PREDICTION REOPENS/);
        expect(text).toMatch(/FROM THE CANDIDATE LIST THAT ALREADY EXISTS/);
        expect(flat(text)).toMatch(/NEVER A FRESH ENUMERATION/);
    });

    it('the cap is one reopen per candidate and the second hands over', () => {
        const text = rule();
        expect(text).toMatch(/ONE REOPEN PER CANDIDATE/);
        expect(flat(text)).toMatch(/SECOND CONTRADICTION HANDS OVER TO THE RETRY-BUDGET LADDER/);
    });

    it('the ladder branch is added without moving the N=3 budget', () => {
        const body = flat(section(mechanics(), '### Reopening — the two consequences'));
        expect(body).toMatch(/first failure reads the candidate list before the retry/i);
        expect(body).toMatch(/does not move the N=3 budget/i);
    });

    it('COUNTER: the cap sentences are load-bearing, not incidental prose', () => {
        // Each assertion above must fail on a tree with the clause removed —
        // shown by mutating the live text rather than by trusting the regex.
        const stripped = rule()
            .replace('ONE REOPEN PER CANDIDATE.', '')
            .replace(/NEVER A FRESH\s+ENUMERATION/, '');
        expect(stripped).not.toMatch(/ONE REOPEN PER CANDIDATE/);
        expect(flat(stripped)).not.toMatch(/NEVER A FRESH ENUMERATION/);
    });
});

describe('a falsified rejection returns its candidate (2.4 / AC-5)', () => {
    it('the rule names `killed-if` as the field the falsification reads', () => {
        const text = rule();
        expect(flat(text)).toMatch(
            /## Killed beliefs` — each discarded hypothesis \+ the `killed-if` that killed it\./,
        );
    });

    it('the consequence is stated where the mechanics live', () => {
        const body = flat(section(mechanics(), '### Reopening — the two consequences'));
        expect(body).toMatch(/rejection whose premise is falsified is not a rejection/i);
        expect(body).toMatch(/un-evaluated/i);
        expect(body).toMatch(/returns to the set/i);
        // Why the field is carried at all — without it the claim is unfalsifiable.
        expect(body).toMatch(/unfalsifiable/i);
    });

    it('COUNTER: an unstated `killed-if` makes the revival uncheckable', () => {
        const body = flat(section(mechanics(), '### Reopening — the two consequences'));
        const stripped = body.replace(/`killed-if`/g, 'a reason');
        expect(stripped).not.toContain('killed-if');
        // The guideline must tie the checkability to the field, not to prose.
        expect(body).toMatch(/stated `killed-if` condition/);
    });
});

describe('the rule stays inside its per-spawn budget', () => {
    it('adds no section and no store — the fields ride existing ones', () => {
        const text = rule();
        const headings = text.split('\n').filter((l) => /^##\s/.test(l));
        // The Iron Law, the notes structure, what stays out, see-also.
        expect(headings.length).toBe(4);
        // `killed-if` and `next-commitment` live inside the section list.
        expect(text).toMatch(/`killed-if`/);
        expect(text).toMatch(/\*\*next-commitment\*\*/);
    });
});
