// Adversarial spot-check for the global-knowledge redaction gate — the
// pre-flip validation the ADR-103 council re-evaluation required
// (claude-sonnet-4-5 + gpt-4o, 2026-07-11: flip-with-validation).
//
// Three named attack classes from the council's dissent:
//   1. homoglyph / encoding smuggling (Cyrillic confusables, zero-width chars)
//   2. composite inference (quasi-identifier combinations around direct ids)
//   3. temporal context collapse (stale card resurfacing as current fact)
//
// Fixtures: tests/fixtures/global-knowledge-redaction/. A red test here
// blocks the default flip (road-to-opt-decision-flips Phase 1).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    gate_card_for_global,
    redaction_scan,
} from '../../src/scripts/_lib/knowledge_global_redaction.js';
import { gate_sensitivity_for_promotion } from '../../src/scripts/_lib/knowledge_global_promote.js';
import { _freshness_state } from '../../src/scripts/knowledge_global_cli.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const FIXTURES = join(REPO_ROOT, 'tests', 'fixtures', 'global-knowledge-redaction');

function fixture(name: string): string {
    return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('attack class 1 — homoglyph / encoding smuggling', () => {
    it('catches a Cyrillic-homoglyph email (confusable local/domain letters)', () => {
        const violations = redaction_scan(fixture('homoglyph-email.md'));
        // The email pattern is Unicode-aware (\p{L}) — a confusable email is
        // still an email to the scanner.
        expect(violations.length).toBeGreaterThan(0);
        expect(violations.map((v) => v.category)).toContain('email');
    });

    it('does not let zero-width characters smuggle a raw key or email past the scan', () => {
        const violations = redaction_scan(fixture('zerowidth-secret.md'));
        // Two acceptable detection routes: the invisible characters are
        // flagged as their own violation class, or the identifiers are caught
        // after invisible-character stripping. Either way: non-clean.
        expect(violations.length).toBeGreaterThan(0);
    });

    it('gate blocks the zero-width card on the halt-on-trigger path', () => {
        const res = gate_card_for_global(fixture('zerowidth-secret.md'), {
            tier: 'public',
        });
        expect(res.eligible).toBe(false);
    });
});

describe('attack class 2 — composite inference', () => {
    it('catches direct identifiers even inside composite quasi-identifier phrasing', () => {
        const violations = redaction_scan(fixture('composite-inference.md'), {
            customer_names: ['Acme-Corp'],
        });
        const cats = violations.map((v) => v.category);
        // internal hostname (*.internal) + caller-supplied customer name
        expect(violations.length).toBeGreaterThanOrEqual(2);
        expect(cats.join(',')).toMatch(/hostname|customer/);
    });

    it('documents the accepted residual: a pure quasi-identifier combination passes', () => {
        // Council-accepted residual (2026-07-11): k-anonymity over
        // quasi-identifier combinations is out of scope for a write-time text
        // gate; the single-install trust boundary bounds the threat (an actor
        // with filesystem access already reads the raw projects). Recorded in
        // the ADR superseding ADR-103 — this assertion pins the boundary so a
        // future change to it is a deliberate decision, not drift.
        const violations = redaction_scan(fixture('composite-quasi-only.md'));
        expect(violations).toEqual([]);
    });
});

describe('attack class 3 — temporal context collapse', () => {
    const cfg = {
        freshness: { hypothesis_after_days: 90, stale_after_days: 180 },
    };

    // Dates are computed relative to the test run (never pinned in fixture
    // files) so the assertions cannot rot with the calendar.
    function cardVerifiedDaysAgo(days: number): string {
        const d = new Date(Date.now() - days * 86_400_000);
        const iso = d.toISOString().slice(0, 10);
        return [
            '# Card: temporal probe',
            '',
            'Positive structure claim that must not resurface as current fact.',
            '',
            '<!-- global-provenance:start -->',
            '- first_seen: 2026-01-01',
            `- last_verified: ${iso}`,
            '- tier: public',
            '- seen_in: repo-a',
            '<!-- global-provenance:end -->',
            '',
        ].join('\n');
    }

    it('a card unverified for >180 days classifies stale (skipped until re-verified)', () => {
        expect(_freshness_state(cardVerifiedDaysAgo(200), cfg)).toBe('stale');
    });

    it('a card unverified for 90–180 days degrades to hypothesis (lead-only)', () => {
        expect(_freshness_state(cardVerifiedDaysAgo(120), cfg)).toBe('hypothesis');
    });

    it('a recently verified card stays fresh', () => {
        expect(_freshness_state(cardVerifiedDaysAgo(10), cfg)).toBe('fresh');
    });

    it('a card with no provenance footer is unclassifiable, never silently fresh', () => {
        expect(_freshness_state('# Card: naked claim\n\nNo footer.\n', cfg)).toBe('?');
    });
});

describe('attack class 4 — cross-project contamination (sensitivity axis, Phase 1 road-to-feedback-8.11)', () => {
    it('a card carrying project-identifying content marked `project` never promotes', () => {
        // The card content itself is clean — the point is that `project`
        // sensitivity alone refuses promotion, independent of redaction.
        const card =
            '# Card: internal runbook\n\nProject-local notes about our deploy process.\n';
        const violations = redaction_scan(card);
        expect(violations).toEqual([]); // clean, but that must not matter

        const res = gate_sensitivity_for_promotion('project', {
            violations_present: violations.length > 0,
            promotion_reason: 'looks safe to me',
        });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('project');
    });

    it('a `shareable` card that acquires redaction-class content on update blocks — never a silent shareable', () => {
        // Simulates an edit that introduces a secret into a previously-clean
        // shareable card. The stale `sensitivity: shareable` declaration on
        // the card must not survive the update.
        const updated = '# Card: webhook structure\n\nContact ops-lead@example.com for access.\n';
        const violations = redaction_scan(updated);
        expect(violations.length).toBeGreaterThan(0);

        const res = gate_sensitivity_for_promotion('shareable', {
            violations_present: violations.length > 0,
            promotion_reason: 'was reviewed before the edit that introduced the contact',
        });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('prohibited'); // never a silent shareable
    });

    it('never auto-assigns shareable — an unset sensitivity defaults to project and is refused', () => {
        const res = gate_sensitivity_for_promotion('', { violations_present: false });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('project');
    });
});
