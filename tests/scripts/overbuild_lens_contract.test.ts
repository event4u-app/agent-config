/**
 * Golden-set gate for `overbuild-review-lens`.
 *
 * Two halves, and the second is the one that matters:
 *
 *   1. Every reference review in `tests/fixtures/overbuild-lens/` satisfies the
 *      lens's output contract and scores clean against its own labels.
 *   2. Deliberately wrong outputs are REJECTED. A scorer that passes everything
 *      is worse than no scorer, so each failure mode this lens exists to
 *      prevent gets a negative case: an invented finding on the lean fixture,
 *      an unfenced deletion, a `shrink:` where the simpler form is longer, and
 *      a silent miss.
 *
 * What this does NOT gate: whether a live model finds the plant. That needs a
 * scored eval run and is human-invoked here. The fixtures and labels are the
 * input that run consumes; see the fixtures' README for the split.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseLensOutput,
    scoreAgainstExpected,
    type ExpectedLabels,
} from '../../src/scripts/_lib/overbuild_lens_contract.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'overbuild-lens');

/** Minimal reader for the flat subset of YAML these label files use. */
function readExpected(dir: string): ExpectedLabels {
    const raw = fs.readFileSync(path.join(dir, 'expected.yaml'), 'utf-8');
    const list = (key: string): string[] => {
        const m = raw.match(new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, 'm'));
        if (!m?.[1] || m[1].trim() === '') return [];
        return m[1].split(',').map((s) => s.trim());
    };
    const scalar = (key: string): string => {
        const m = raw.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, 'm'));
        return m?.[1] ?? '';
    };
    return {
        verdict: scalar('verdict'),
        must_tags: list('must_tags'),
        forbidden_tags: list('forbidden_tags'),
        must_be_null: scalar('must_be_null') === 'true',
        net_sign: scalar('net_sign') as ExpectedLabels['net_sign'],
        requires_fence: scalar('requires_fence') === 'true',
    };
}

const CASES = fs
    .readdirSync(FIXTURES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

describe('overbuild lens — golden set', () => {
    it('has the mixed shape the gate depends on', () => {
        // Three over-build traps, one lean case, one where simpler is longer.
        // Drop the lean case and the set stops testing the failure mode that
        // actually matters (a lens that always finds something).
        expect(CASES.length).toBeGreaterThanOrEqual(5);
        expect(CASES).toContain('lean-crud');
        expect(CASES).toContain('flatten-longer');
        const leanLabels = readExpected(path.join(FIXTURES, 'lean-crud'));
        expect(leanLabels.must_be_null).toBe(true);
    });

    it.each(CASES)('%s — the reference review satisfies the contract', (name) => {
        const dir = path.join(FIXTURES, name);
        const parsed = parseLensOutput(fs.readFileSync(path.join(dir, 'reference.txt'), 'utf-8'));
        expect(parsed.errors, parsed.errors.join('\n')).toEqual([]);
    });

    it.each(CASES)('%s — the reference review scores clean against its labels', (name) => {
        const dir = path.join(FIXTURES, name);
        const parsed = parseLensOutput(fs.readFileSync(path.join(dir, 'reference.txt'), 'utf-8'));
        const failures = scoreAgainstExpected(parsed, readExpected(dir));
        expect(failures, failures.join('\n')).toEqual([]);
    });
});

describe('overbuild lens — the scorer rejects each failure mode', () => {
    it('rejects an invented finding on the lean fixture', () => {
        const invented = [
            'Lens:    overbuild-review-lens',
            'Target:  lean-crud',
            '',
            'Verdict: trim',
            '',
            'Findings:',
            '1. shrink:  submitted.ts:4  Could inline the null check.',
            '',
            'Net: -2 lines',
        ].join('\n');
        const failures = scoreAgainstExpected(
            parseLensOutput(invented),
            readExpected(path.join(FIXTURES, 'lean-crud')),
        );
        expect(failures.join('\n')).toMatch(/invented a finding/);
    });

    it('rejects a `delete:` finding with no fence line', () => {
        const unfenced = [
            'Lens:    overbuild-review-lens',
            'Target:  trap-native',
            '',
            'Verdict: overbuilt',
            '',
            'Findings:',
            '1. native:  submitted.ts:6   Postgres full-text covers this.',
            '2. delete:  submitted.ts:25  dumpIndexStats has no caller.',
            '',
            'Net: -28 lines',
        ].join('\n');
        const parsed = parseLensOutput(unfenced);
        expect(parsed.errors.join('\n')).toMatch(/has no valid\s+Fence line/);
    });

    it('rejects a fence line missing the coverage field', () => {
        const partial = [
            'Verdict: overbuilt',
            'Findings:',
            '1. delete:  a.ts:1  Dead helper.',
            '   Fence: why=prototype  safe=grep clean',
            'Net: -5 lines',
        ].join('\n');
        expect(parseLensOutput(partial).errors.join('\n')).toMatch(/Fence line/);
    });

    it('rejects `shrink:` where the simpler form is longer (anti-golfing)', () => {
        const golfed = [
            'Lens:    overbuild-review-lens',
            'Target:  flatten-longer',
            '',
            'Verdict: trim',
            '',
            'Findings:',
            '1. shrink:  submitted.ts:2  Collapse the branches into one expression.',
            '',
            'Net: -3 lines',
        ].join('\n');
        const failures = scoreAgainstExpected(
            parseLensOutput(golfed),
            readExpected(path.join(FIXTURES, 'flatten-longer')),
        );
        expect(failures.join('\n')).toMatch(/forbidden tag `shrink:`/);
        expect(failures.join('\n')).toMatch(/missing required tag `flatten:`/);
    });

    it('rejects a silent miss on a seeded trap', () => {
        const missed = [
            'Lens:    overbuild-review-lens',
            'Target:  trap-stdlib',
            '',
            'Verdict: lean',
            '',
            'Findings: none — nothing in this diff exceeds the stated requirement.',
            '',
            'Net: 0 lines',
        ].join('\n');
        const failures = scoreAgainstExpected(
            parseLensOutput(missed),
            readExpected(path.join(FIXTURES, 'trap-stdlib')),
        );
        expect(failures.join('\n')).toMatch(/missed the plant/);
    });

    it('rejects a tag outside the grammar', () => {
        const bogus = [
            'Verdict: trim',
            'Findings:',
            '1. simplify:  a.ts:1  Not a legal tag.',
            'Net: -1 lines',
        ].join('\n');
        expect(parseLensOutput(bogus).errors.join('\n')).toMatch(/not a legal tag/);
    });
});
