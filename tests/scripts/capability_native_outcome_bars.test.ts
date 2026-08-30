/**
 * The SHAPE CHECK for the pre-registered outcome bars
 * (`src/config/capability-native-outcome-bars.json`,
 * road-to-capability-native-execution step 0.6).
 *
 * The step's verify clause is stated as a refusal: *"every bar has a numeric
 * threshold and a named falsifier … a bar with no falsifier FAILS the shape
 * check rather than passing."* So this file is that check, and its assertions
 * are written so that an incomplete bar cannot pass by being vague — a
 * falsifier of `"it gets worse"` is caught by the length and shape floors
 * below, not only a missing key.
 *
 * It is a test rather than a new gate script deliberately. A test runs in CI on
 * every push, needs no gate-coverage row, no self-test and no reachability
 * exemption — and the thing being checked is a committed constant, which is
 * exactly the corpus a test is good at. Adding a gate would have cost four
 * registrations to watch one file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BARS_REL = 'src/config/capability-native-outcome-bars.json';

interface Bar {
    id: string;
    what: string;
    threshold: number;
    direction: 'at-least' | 'at-most';
    unit: string;
    basis: string;
    falsifier: string;
    measured_by: string;
}

const doc = JSON.parse(fs.readFileSync(path.join(REPO, BARS_REL), 'utf8')) as {
    registered_at: string;
    owner: string;
    review_by: string;
    step: string;
    bars: Bar[];
};

/** The seven the roadmap step names, verbatim and in its order. */
const NAMED_IN_STEP = [
    'dispatch-success',
    'evidence-completeness',
    'token-context-cost',
    'wall-clock',
    'setup-friction',
    'deterministic-replay',
    'degraded-run-honesty',
];

describe('0.6 — the bar set is exactly what the step names', () => {
    it('covers every named bar, with none missing', () => {
        expect(doc.bars.map((b) => b.id)).toEqual(NAMED_IN_STEP);
    });

    it('has none the step does not name', () => {
        // Phase 3.4 binds this direction explicitly: the published set may
        // carry nothing 0.6 does not name. Asserting it here means a bar added
        // later has to change the step too.
        for (const b of doc.bars) expect(NAMED_IN_STEP).toContain(b.id);
    });

    it('carries the ownership fields every budget config in src/config/ carries', () => {
        expect(doc.owner.length).toBeGreaterThan(0);
        expect(doc.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(doc.registered_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(doc.step).toBe('0.6');
    });
});

describe('0.6 — a bar with no falsifier FAILS rather than passes', () => {
    it('every bar has a NUMERIC threshold', () => {
        for (const b of doc.bars) {
            expect(typeof b.threshold, b.id).toBe('number');
            expect(Number.isFinite(b.threshold), b.id).toBe(true);
        }
    });

    it('every bar states a direction — a threshold with no direction decides nothing', () => {
        for (const b of doc.bars) {
            expect(['at-least', 'at-most'], b.id).toContain(b.direction);
        }
    });

    it('every bar names a falsifier, and it is a CONDITION rather than a wish', () => {
        for (const b of doc.bars) {
            expect(b.falsifier.length, b.id).toBeGreaterThan(60);
            // A falsifier says what would be observed. "improves" / "is better"
            // is a hope; the floor below is deliberately crude but it catches
            // the shape that reads as answered while asserting nothing.
            expect(b.falsifier, b.id).toMatch(/\b(any|exceeds|fewer|more than|differ|missing|cannot)\b/);
        }
    });

    it('every bar names where it is measured, and it is a phase that exists', () => {
        for (const b of doc.bars) {
            expect(b.measured_by, b.id).toMatch(/phase \d+\.\d+/);
        }
    });

    it('every bar states its BASIS, and says which kind it is', () => {
        // The honesty requirement: a pre-registered threshold nobody can source
        // is worse than none, because it looks measured. Each basis must
        // declare itself DERIVED or a STATED DEFAULT.
        for (const b of doc.bars) {
            expect(b.basis.length, b.id).toBeGreaterThan(80);
            expect(b.basis, b.id).toMatch(/DERIVED|STATED DEFAULT/);
        }
    });

    it('every STATED DEFAULT carries a revisit-if; a DERIVED bar need not', () => {
        // The asymmetry is the point. A number derived from a contract is
        // revisited when the contract changes; a number somebody chose needs to
        // say what would prove it wrong.
        for (const b of doc.bars) {
            if (b.basis.includes('STATED DEFAULT')) {
                expect(b.basis.toLowerCase(), b.id).toContain('revisit-if');
            }
        }
    });

    it('the three ratio bars that must be perfect are 1.0, not 0.99', () => {
        // evidence-completeness, deterministic-replay and degraded-run-honesty
        // are contract restatements. A 0.99 there would make the contract
        // advisory, and a partial envelope is what a reader mistakes for a
        // complete one.
        const perfect = ['evidence-completeness', 'deterministic-replay', 'degraded-run-honesty'];
        for (const id of perfect) {
            const bar = doc.bars.find((b) => b.id === id);
            expect(bar?.threshold, id).toBe(1.0);
            expect(bar?.direction, id).toBe('at-least');
        }
    });
});

describe('0.6 — the shape check refuses a malformed bar', () => {
    // The verify clause is a REFUSAL, so it is exercised rather than asserted:
    // each case below is a bar that must not pass the checks above.
    const good = doc.bars[0] as Bar;

    it('rejects a bar with no falsifier', () => {
        const bad = { ...good, falsifier: '' };
        expect(bad.falsifier.length > 60).toBe(false);
    });

    it('rejects a falsifier that is a wish rather than a condition', () => {
        const bad = { ...good, falsifier: 'the adapter is better than the baseline and everyone is happy with it' };
        expect(/\b(any|exceeds|fewer|more than|differ|missing|cannot)\b/.test(bad.falsifier)).toBe(false);
    });

    it('rejects a non-numeric threshold', () => {
        const bad = { ...good, threshold: 'high' as unknown as number };
        expect(typeof bad.threshold === 'number').toBe(false);
    });

    it('rejects a basis that declares neither DERIVED nor STATED DEFAULT', () => {
        const bad = { ...good, basis: 'this number felt about right to the author on the day' };
        expect(/DERIVED|STATED DEFAULT/.test(bad.basis)).toBe(false);
    });
});
