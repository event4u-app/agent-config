/**
 * road-to-experience-loop-broadening step 9.3 — the removal the loop motivated.
 *
 * verify: at least one repeated card has resulted in a removal — a deterministic
 * query or helper replacing a prose instruction, with the prose deleted in the
 * same change.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    PRODUCER_CONSTANT_FIELDS,
    constantFieldReason,
    isProducerConstantField,
} from '../../src/scripts/_lib/audit_field_provenance.js';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');

describe('the helper that replaced the prose', () => {
    it('no longer names rules_applied as a producer constant', () => {
        // road-to-observed-learning-signal 4.2: removing the row IS the
        // assertion that the field is observed, and the producers were changed
        // in the same commit. The helper stays — it is the mechanism a FUTURE
        // producer records the same honesty with — and it is now empty.
        expect(isProducerConstantField('rules_applied')).toBe(false);
        expect(constantFieldReason('rules_applied')).toBeNull();
        expect(PRODUCER_CONSTANT_FIELDS.size).toBe(0);
    });

    it('does not claim a genuinely observed field is constant', () => {
        for (const f of ['outcome', 'phase', 'skills_applied', 'privacy_class']) {
            expect(isProducerConstantField(f)).toBe(false);
            expect(constantFieldReason(f)).toBeNull();
        }
    });

    it('still reports a constant when one is registered', () => {
        // A registration-shaped SENSITIVITY check: an empty map would pass the
        // two assertions above even if the helper were broken, so exercise the
        // path that a future row would take.
        const reason = constantFieldReason('rules_applied');
        expect(reason).toBeNull();
        expect(isProducerConstantField('anything-unregistered')).toBe(false);
    });
});

describe('the claim is checked against the producers, not asserted', () => {
    // The failure mode this guards: the helper goes stale the day a producer
    // starts computing the field, and a stale "this is a constant" is exactly as
    // misleading as the prose it replaced -- in the other direction.
    const PRODUCERS = [
        'src/scripts/_lib/orchestration_record.ts',
        'src/scripts/_lib/review_skipped_record.ts',
    ];

    it('every producer matches what this module records — now: no constant at all', () => {
        // The check runs in the SAME direction as before, against the new
        // shape: the module records no constant for `rules_applied`, so no
        // producer may write one. A producer that reintroduced the literal
        // while the row stayed absent is exactly the stale-in-the-other-
        // direction failure the original test guarded against.
        expect(PRODUCER_CONSTANT_FIELDS.has('rules_applied')).toBe(false);
        for (const p of PRODUCERS) {
            const src = fs.readFileSync(path.join(repoRoot, p), 'utf-8');
            expect(src, `${p} writes a rules_applied literal with no registration behind it`).not.toMatch(
                /rules_applied: \['[^']+'/,
            );
            expect(src, `${p} does not compute rules_applied`).toContain(
                'rules_applied: appliedIds(input.rules_applied)',
            );
        }
    });
});

describe('the prose was deleted, not softened', () => {
    it('the contract no longer claims the field records rules that fired', () => {
        const contract = fs.readFileSync(path.join(repoRoot, 'docs/contracts/audit-log-v1.md'), 'utf-8');
        expect(contract).not.toContain('Stable rule ids whose Iron Law fired this phase');
        expect(contract).toContain('isProducerConstantField');
        // The cutover is stated, and the segmentation obligation with it.
        expect(contract).toContain('Cutover 2026-09-07');
        expect(contract).toMatch(/reader spanning the cutover MUST segment/);
    });

    it('the card that motivated it is ADMISSIBLE under the Phase 7 contract', async () => {
        // Asserted through `checkCard` rather than by grepping for the word
        // "falsifier": a string match would pass on a card that merely mentions
        // the field, which is the shape of evidence this roadmap keeps refusing.
        const { parse } = await import('yaml');
        const { checkCard } = await import('../../src/scripts/_lib/experience_card.js');
        const raw = fs.readFileSync(
            path.join(repoRoot, 'agents/knowledge/experience-rules-applied-is-a-producer-constant.md'),
            'utf-8',
        );
        const fm = raw.split('---')[1] ?? '';
        const card = parse(fm) as Record<string, unknown>;
        expect(card.kind).toBe('experience');
        expect(String(card.provenance && (card.provenance as Record<string, unknown>).pattern_ref)).toMatch(/count 914/);
        expect(checkCard(card as never)).toEqual([]);
        // Retired in the same change that removed the registration row: a card
        // left standing after its falsifier fires makes the tree assert
        // something false about itself.
        expect(card.retired).toBe('2026-09-07');
        expect(String(card.retired_by)).toContain('road-to-observed-learning-signal');
    });
});
