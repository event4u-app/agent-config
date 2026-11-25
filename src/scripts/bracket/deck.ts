/**
 * The built-in approach deck for a bracket run. Without one, every line gets the
 * same brief and the first dedupe wave collapses the field; with one, each line
 * is dealt a different angle — a reasoning mode, a workflow and a trade-off
 * stance — so the matches compare genuinely different solutions.
 *
 * The three axis sizes are pairwise coprime (7, 5, 6), so line i takes
 * (i mod 7, i mod 5, i mod 6): by the Chinese remainder theorem no two of the
 * first 210 lines share an angle, and every axis value is used once before any
 * value is used twice. The seed only permutes each axis.
 */
import { createHash } from 'node:crypto';

import { BracketError } from './errors.js';

export interface DeckEntry {
    readonly id: string;
    readonly name: string;
    readonly how: string;
}

export interface Angle {
    readonly reasoning: DeckEntry;
    readonly workflow: DeckEntry;
    readonly strategy: DeckEntry;
}

export const DECK = {
    reasoning: [
        { id: 'first-principles', name: 'First principles', how: 'Reduce the task to the facts and requirements that cannot be argued with, and rebuild from those; keep a convention only where it earns its place again.' },
        { id: 'failure-first', name: 'Failure first', how: 'List the ways an answer to this task fails in practice, then shape the answer so each of them cannot happen.' },
        { id: 'concrete-case', name: 'Concrete case', how: 'Solve one realistic instance end to end with real values first, and generalise only what that instance taught you.' },
        { id: 'constraint-led', name: 'Constraint led', how: 'Enumerate every hard constraint, stated or implied, and let the tightest one drive the design.' },
        { id: 'borrowed-shape', name: 'Borrowed shape', how: 'Find an already-solved problem from another field with the same structure, carry its solution over, and repair every place the comparison breaks.' },
        { id: 'whole-system', name: 'Whole system', how: 'Map the moving parts and their second-order effects, and optimise the whole rather than the one part the task points at.' },
        { id: 'against-the-default', name: 'Against the default', how: 'Write down the obvious answer, argue seriously against it, and keep only what survives the argument.' },
    ],
    workflow: [
        { id: 'outline-then-fill', name: 'Outline, then fill', how: 'Fix the skeleton of the answer before any detail, then fill each part completely and check the joins.' },
        { id: 'end-state-backwards', name: 'From the end state', how: 'Describe the finished result precisely as if it existed, then work backwards to the steps that produce it.' },
        { id: 'draft-review-revise', name: 'Draft, review, revise', how: 'Write a complete first version fast, review it as a hostile expert would, and rewrite every part the review hit.' },
        { id: 'split-and-integrate', name: 'Split and integrate', how: 'Break the task into independent parts, finish each one, then integrate and test the seams.' },
        { id: 'checks-first', name: 'Checks first', how: 'Write down how a correct answer would be verified before writing the answer, then build until every check passes.' },
    ],
    strategy: [
        { id: 'smallest-change', name: 'Smallest change', how: 'Prefer the least new surface that fully meets the task; every addition has to justify itself.' },
        { id: 'robust-at-edges', name: 'Robust at the edges', how: 'Spend the effort on edge cases, bad input and failure paths; the happy path is the easy part.' },
        { id: 'reader-first', name: 'Reader first', how: 'Optimise for the person who has to use the answer tomorrow: obvious structure, no guessing, nothing to decode.' },
        { id: 'reuse-what-exists', name: 'Reuse what exists', how: 'Build on what the context already provides before inventing anything new, and say what you reused.' },
        { id: 'measurable', name: 'Measurable', how: 'Make every claim checkable: numbers, exact names, steps someone can run and see succeed or fail.' },
        { id: 'reversible', name: 'Reversible', how: 'Prefer choices that are cheap to undo, and name the rollback for each one that is not.' },
    ],
} as const satisfies Record<keyof Angle, readonly DeckEntry[]>;

export const DECK_SIZE = DECK.reasoning.length * DECK.workflow.length * DECK.strategy.length;

function permute<T>(xs: readonly T[], seed: number, salt: string): T[] {
    const key = (i: number): string => createHash('sha256').update(`${seed}:${salt}:${i}`).digest('hex');
    return xs.map((x, i) => ({ x, k: key(i) })).sort((p, q) => (p.k < q.k ? -1 : p.k > q.k ? 1 : 0)).map((p) => p.x);
}

export function dealAngles(n: number, seed: number): Angle[] {
    if (!Number.isInteger(n) || n < 0) throw new BracketError('bad-n', `n must be a non-negative integer, got ${n}`);
    if (n > DECK_SIZE) throw new BracketError('deck-exhausted', `${n} lines exceed the ${DECK_SIZE} distinct angles; pass --angles or lower N`);
    const r = permute(DECK.reasoning, seed, 'reasoning');
    const w = permute(DECK.workflow, seed, 'workflow');
    const s = permute(DECK.strategy, seed, 'strategy');
    return Array.from({ length: n }, (_, i) => ({
        reasoning: r[i % r.length] as DeckEntry,
        workflow: w[i % w.length] as DeckEntry,
        strategy: s[i % s.length] as DeckEntry,
    }));
}

export function angleKey(c: Angle): string {
    return `${c.reasoning.id}/${c.workflow.id}/${c.strategy.id}`;
}

export function renderAngle(c: Angle): string {
    return [
        `- Reasoning — ${c.reasoning.name}: ${c.reasoning.how}`,
        `- Workflow — ${c.workflow.name}: ${c.workflow.how}`,
        `- Trade-off — ${c.strategy.name}: ${c.strategy.how}`,
    ].join('\n');
}
