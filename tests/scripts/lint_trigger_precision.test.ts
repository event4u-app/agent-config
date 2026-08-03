/**
 * Trigger-precision budget (road-to-renewal-foundation Phase 3, step 2).
 *
 * The gate exists because a `keyword` trigger is matched as an UNANCHORED
 * substring, so a short one fires on every word that merely contains it —
 * `AC` fired `cross-source-consistency` on "black"/"contact", `CAC` fired the
 * finance floor on "cache". These assertions pin both halves: the counting
 * rule (what "short" means, and why emoji are out) and the ratchet direction.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SHORT_KEYWORD_BUDGET,
    short_keywords,
} from '../../src/scripts/lint_trigger_precision.js';

const REPO = path.resolve(__dirname, '..', '..');
const ROUTER = JSON.parse(
    fs.readFileSync(path.join(REPO, 'dist', 'router.json'), 'utf-8'),
) as Record<string, unknown>;

describe('short_keywords — the counting rule', () => {
    it('counts ASCII keyword triggers of at most three characters', () => {
        const found = short_keywords({
            tier_1: [{ id: 'r1', triggers: [{ keyword: 'why' }, { keyword: 'four' }] }],
            tier_2: [{ id: 'r2', triggers: [{ keyword: 'ab' }] }],
        });
        expect(found.map((s) => s.keyword)).toEqual(['ab', 'why']);
    });

    it('ignores non-keyword trigger kinds', () => {
        const found = short_keywords({
            tier_1: [
                {
                    id: 'r1',
                    triggers: [{ phrase: 'ab' }, { command: '/x' }, { path_prefix: 'sr' }],
                },
            ],
        });
        expect(found).toEqual([]);
    });

    it('excludes non-ASCII short keywords — an emoji cannot collide with prose', () => {
        // The eight emoji triggers on no-decorative-emojis-in-git-surfaces are
        // one code point each; counting them would be noise, not signal.
        const found = short_keywords({ tier_1: [{ id: 'r1', triggers: [{ keyword: '🤖' }] }] });
        expect(found).toEqual([]);
    });

    it('reports the owning rule and tier, so a failure names what to edit', () => {
        const found = short_keywords({ tier_2: [{ id: 'finance', triggers: [{ keyword: 'LTV' }] }] });
        expect(found).toEqual([{ keyword: 'LTV', rule: 'finance', tier: 'tier_2' }]);
    });

    it('survives a rule with no triggers and a malformed tier', () => {
        expect(short_keywords({ tier_1: [{ id: 'bare' }], tier_2: 'nonsense' })).toEqual([]);
    });
});

describe('the shipped router against the budget', () => {
    it('is within budget', () => {
        expect(short_keywords(ROUTER).length).toBeLessThanOrEqual(SHORT_KEYWORD_BUDGET);
    });

    it('no longer carries the two triggers removed as provably redundant', () => {
        // `AC` duplicated `acceptance criteria` on the same rule; `CAC`
        // collided with "cache" while LTV + payback already carry the signal.
        const shipped = short_keywords(ROUTER).map((s) => `${s.rule}:${s.keyword}`);
        expect(shipped).not.toContain('cross-source-consistency:AC');
        expect(shipped).not.toContain('finance-safety-floor:CAC');
    });

    it('keeps the budget honest — it is a ratchet, not headroom', () => {
        // A budget sitting far above the population stops being a gate. If
        // this fails after a legitimate removal, LOWER the budget; that is the
        // commit the ratchet is asking for.
        expect(SHORT_KEYWORD_BUDGET - short_keywords(ROUTER).length).toBeLessThanOrEqual(2);
    });
});
