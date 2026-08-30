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
    it('names rules_applied as a producer constant', () => {
        expect(isProducerConstantField('rules_applied')).toBe(true);
        expect(constantFieldReason('rules_applied')).toMatch(/measures the writer rather than the work/);
    });

    it('does not claim a genuinely observed field is constant', () => {
        for (const f of ['outcome', 'phase', 'skills_applied', 'privacy_class']) {
            expect(isProducerConstantField(f)).toBe(false);
            expect(constantFieldReason(f)).toBeNull();
        }
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

    it('every producer still writes the literal this module records', () => {
        const expected = PRODUCER_CONSTANT_FIELDS.get('rules_applied')!;
        const literal = `rules_applied: [${expected.map((v) => `'${v}'`).join(', ')}]`;
        for (const p of PRODUCERS) {
            const src = fs.readFileSync(path.join(repoRoot, p), 'utf-8');
            expect(src, `${p} no longer writes ${literal}`).toContain(literal);
        }
    });
});

describe('the prose was deleted, not softened', () => {
    it('the contract no longer claims the field records rules that fired', () => {
        const contract = fs.readFileSync(path.join(repoRoot, 'docs/contracts/audit-log-v1.md'), 'utf-8');
        expect(contract).not.toContain('Stable rule ids whose Iron Law fired this phase');
        expect(contract).toContain('isProducerConstantField');
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
    });
});
