/**
 * S0.3 — do safety-relevant markers survive output post-processing?
 *
 * `road-to-governance-invariants` Phase 0. The adversarial source that
 * motivated this roadmap ships an output normaliser whose stated purpose is
 * stripping hedges and refusal shapes from what a reader finally sees. This
 * package ships its own telegraph condenser whose grammar deliberately drops
 * linking auxiliaries and pronouns. The question is whether that grammar can
 * silently remove a signal an auditor needs.
 *
 * **The question is narrow on purpose.** `validate_telegraph_carveouts.ts`
 * already asserts byte-identical preservation for its carve-out set. Neither
 * uncertainty, nor hedge, nor provenance markers are in that set — so "the
 * existing carve-outs hold" is not an answer to this question, and this file
 * does not ask it.
 *
 * PRE-REGISTERED VERDICTS (fixed in this source before the first run, per the
 * roadmap's Phase-0 contract):
 *
 *   NULL      — every marker class survives condensation into the audited
 *               text. Publish the null, keep this file as the regression test.
 *   FINDING   — any marker class is lost or negated. High severity; do not
 *               resolve the claim; open Phase 3.
 *   INCONCLUSIVE — a fixture premise is unmet (e.g. the transform is a no-op
 *               on the fixture, so nothing was actually exercised). Repair the
 *               fixture; a null may not be claimed.
 *
 * The INCONCLUSIVE guard is the one that matters: a spike that accidentally
 * feeds the condenser text it does not touch would report a triumphant null
 * having measured nothing. `exercises the transform at all` below is that
 * premise check, and it runs first.
 */
import { describe, expect, it } from 'vitest';

import { condense_text } from '../../src/scripts/condense_memory.js';

/**
 * A marker class, its fixture line, and the tokens that carry the signal.
 *
 * `carriers` is the load-bearing part: survival is not "the line still exists"
 * but "the words an auditor would grep for are still there". A line that keeps
 * its shape while losing `unverified` has lost the signal.
 *
 * Carriers are **tokens, not phrases**, and that distinction was learned from
 * this fixture's first run. Two cases were written with phrase carriers
 * containing an article — `not the production shape`, `Per the council of …` —
 * and both "failed" because the condenser dropped `the`, exactly as its
 * documented grammar says it will. The signal was intact in both
 * (`not` · `production shape`; `Per` · `council` · the date). Scoring a phrase
 * that embeds a drop-token measures the condenser's grammar, not marker
 * survival, and would have manufactured a FINDING out of correct behaviour.
 * Per the pre-registered rules that is an unmet fixture premise — INCONCLUSIVE,
 * repair the fixture — and it is recorded here rather than quietly edited away.
 */
interface MarkerCase {
    readonly cls: 'uncertainty' | 'hedge' | 'provenance';
    readonly label: string;
    readonly line: string;
    readonly carriers: readonly string[];
}

const MARKER_CASES: readonly MarkerCase[] = [
    // ── uncertainty ────────────────────────────────────────────────────
    {
        cls: 'uncertainty',
        label: 'bare unverified',
        line: 'The endpoint shape is unverified.',
        carriers: ['unverified'],
    },
    {
        cls: 'uncertainty',
        label: 'assumed-from-card',
        line: 'That field is assumed from the context card, not confirmed against a live source.',
        carriers: ['assumed', 'not confirmed'],
    },
    {
        cls: 'uncertainty',
        label: 'negated verification',
        line: 'This result was not verified on this host.',
        carriers: ['not verified'],
    },
    {
        cls: 'uncertainty',
        label: 'explicit unknown',
        line: 'Whether the gate fires under indirection is unknown.',
        carriers: ['unknown'],
    },
    // ── hedge / confidence ─────────────────────────────────────────────
    {
        cls: 'hedge',
        label: 'confidence label',
        line: 'Confidence: low — the sample is a single run.',
        carriers: ['Confidence: low'],
    },
    {
        cls: 'hedge',
        label: 'modal hedge',
        line: 'The fix may regress the polish loop, and might need a second pass.',
        carriers: ['may', 'might'],
    },
    {
        cls: 'hedge',
        label: 'estimate qualifier',
        line: 'Roughly 38% of the payload, measured on a fixture that is not the production shape.',
        carriers: ['Roughly', 'not', 'production shape'],
    },
    // ── provenance ─────────────────────────────────────────────────────
    {
        cls: 'provenance',
        label: 'source pointer',
        line: 'Source: agents/evidence/reports/run-2026-07-31.md, observed 2026-07-31.',
        carriers: ['Source:', 'agents/evidence/reports/run-2026-07-31.md', 'observed'],
    },
    {
        cls: 'provenance',
        label: 'trust marker',
        line: 'trust: low — this row was copied from a card, which was itself unverified.',
        carriers: ['trust: low', 'unverified'],
    },
    {
        cls: 'provenance',
        label: 'attribution',
        line: 'Per the council of 2026-07-28, the threshold was missed and the null stands.',
        carriers: ['Per', 'council', '2026-07-28', 'null stands'],
    },
];

/** Survival is measured on the carriers, not on the line. */
function survives(c: MarkerCase): { ok: boolean; lost: string[]; after: string } {
    const after = condense_text(`${c.line}\n`);
    const lost = c.carriers.filter((tok) => !after.includes(tok));
    return { ok: lost.length === 0, lost, after };
}

describe('S0.3 — marker survival through the telegraph condenser', () => {
    it('PREMISE: the transform is actually exercised (else INCONCLUSIVE, not NULL)', () => {
        // A spike that feeds the condenser text it happens not to touch would
        // report a null having measured nothing. At least one fixture line must
        // come out changed, or every result below is vacuous.
        const changed = MARKER_CASES.filter((c) => condense_text(`${c.line}\n`) !== `${c.line}\n`);
        expect(
            changed.length,
            'no fixture line was modified by condense_text — the fixture is invalid, ' +
                'so the verdict is INCONCLUSIVE and no null may be claimed',
        ).toBeGreaterThan(0);
    });

    it('PREMISE: the condenser drops the tokens it claims to drop', () => {
        // Pins the transform's own contract, so a future no-op refactor turns
        // the premise check red instead of silently making this suite vacuous.
        expect(condense_text('the result is a value that was checked\n').trim()).toBe(
            'result value checked',
        );
    });

    for (const c of MARKER_CASES) {
        it(`${c.cls} · ${c.label} — carriers survive`, () => {
            const r = survives(c);
            expect(
                r.ok,
                `lost ${JSON.stringify(r.lost)} from ${c.cls}/${c.label}\n` +
                    `  before: ${c.line}\n  after:  ${r.after.trim()}`,
            ).toBe(true);
        });
    }

    it('every marker class is represented — a class with no case cannot be nulled', () => {
        const classes = new Set(MARKER_CASES.map((c) => c.cls));
        expect(classes).toEqual(new Set(['uncertainty', 'hedge', 'provenance']));
    });

    it('the condenser never introduces an affirmation where a negation stood', () => {
        // The sharpest failure mode: not losing a word, but inverting the
        // sentence. `not` is not in DROP_TOKENS today; this asserts it stays
        // out, because dropping it would turn every hedge into a claim.
        for (const c of MARKER_CASES) {
            const before = (c.line.match(/\bnot\b/g) ?? []).length;
            const after = (condense_text(`${c.line}\n`).match(/\bnot\b/g) ?? []).length;
            expect(after, `negation count changed for ${c.label}`).toBe(before);
        }
    });
});
