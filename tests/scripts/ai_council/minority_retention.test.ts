/**
 * The permanent majority-laundering fixture — step 5.3.
 *
 * Every "synthesizer" here is a scripted string. No model call, no network, no
 * corpus: the fixture carries the ground truth by construction, so a
 * synthesizer that drops the correct minority is caught deterministically.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    anchorPresent,
    auditMinorityRetention,
    loadLaunderingFixture,
    renderRetentionVerdict,
} from '../../../src/scripts/ai_council/minority_retention.js';

const FIXTURE_REL = 'internal/bench/council-synthesis/majority-laundering.json';
const FIXTURE_ABS = path.resolve(__dirname, '../../..', FIXTURE_REL);
const FIXTURE = loadLaunderingFixture(FIXTURE_ABS);

/* ── scripted synthesizers ───────────────────────────────────────────────── */

/** THE FAILURE 5.3 EXISTS TO CATCH: three members agreed, so that is the verdict. */
const LAUNDERING = `## Convergence / Divergence

### Recommendation
Three of four members converge: add the index on orders.customer_id. It is a
one-migration change with no application edit, and an unindexed foreign key is
the usual cause of a slow list page. Ship the migration.`;

/** Names the minority and rejects it with a reason — a PASS, and wrong. */
const REJECTS_WITH_REASON = `### Recommendation
Add the index. member-d argues the query count is unchanged by an index and that
eager loading is the real fix; that position is rejected because the measured p95
on this page is dominated by scan time rather than by round trips.`;

/** Names the minority and accepts it with a reason — a PASS, and right. */
const ACCEPTS_WITH_REASON = `### Recommendation
member-d's minority position is accepted: the page issues N+1 queries and an
index does not change the query count, because an index changes what one lookup
costs and not how many lookups are issued. Eager load the customer relation.`;

/** Mentions the minority, disposes of nothing. */
const MENTIONS_NO_DISPOSITION = `### Recommendation
Add the index. member-d raised the query count point and noted eager loading as
an alternative. Three members prefer the index.`;

/** Disposes with no reason attached. */
const BARE_DISPOSITION = `### Recommendation
Add the index. The minority position on query count and eager loading is
rejected. Three of four members converge on the migration.`;

/** The most seductive drop: it discusses indexes at length and never the minority. */
const ELABORATE_DROP = `### Recommendation
The index converts each per-row customer lookup from a scan into a b-tree seek.
That is the cheapest available fix — one migration, no application change — and
it is what the majority recommends. Kill criteria: p95 fails to improve.`;

/* ── the gate ────────────────────────────────────────────────────────────── */

describe('the fixture is permanent and well formed', () => {
    it('declares permanent: true, which the loader enforces', () => {
        expect(FIXTURE.permanent).toBe(true);
        const tmp = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'laundering-')),
            'f.json',
        );
        fs.writeFileSync(tmp, JSON.stringify({ ...FIXTURE, permanent: false }), 'utf8');
        expect(() => loadLaunderingFixture(tmp)).toThrow(/PERMANENT/);
    });

    it('seeds ONE correct minority against SEVERAL plausible-but-wrong majority answers', () => {
        expect(FIXTURE.ground_truth).toBe('minority');
        expect(FIXTURE.majority.length).toBeGreaterThanOrEqual(3);
        expect(FIXTURE.minority.anchors.length).toBeGreaterThan(0);
        // "Plausible" is a property of the fixture, not a hope: every majority
        // answer records WHY it is wrong, so a later reader can check the
        // wrongness rather than take it on trust.
        for (const m of FIXTURE.majority) expect(m.why_wrong.length).toBeGreaterThan(20);
    });

    it('lives at a stable path the roadmap can cite', () => {
        expect(fs.existsSync(FIXTURE_ABS)).toBe(true);
        expect(FIXTURE_REL).toBe('internal/bench/council-synthesis/majority-laundering.json');
    });
});

describe('a synthesizer that silently drops the minority FAILS', () => {
    it('fails the majority-only synthesis', () => {
        const v = auditMinorityRetention(LAUNDERING, FIXTURE);
        expect(v.passed).toBe(false);
        expect(v.failures).toEqual(['minority-silently-dropped']);
        expect(v.anchorsFound).toEqual([]);
    });

    it('fails an elaborate drop that discusses the topic without the minority', () => {
        expect(auditMinorityRetention(ELABORATE_DROP, FIXTURE).passed).toBe(false);
    });

    it('names the drop explicitly in the rendered verdict', () => {
        const out = renderRetentionVerdict(auditMinorityRetention(LAUNDERING, FIXTURE), FIXTURE);
        expect(out).toContain('FAILS');
        expect(out).toContain('minority-silently-dropped');
        expect(out).toContain('the minority is correct');
    });
});

describe('accepting and rejecting are BOTH passes, unjustified is not', () => {
    it('passes an accept with a reason', () => {
        const v = auditMinorityRetention(ACCEPTS_WITH_REASON, FIXTURE);
        expect(v.passed).toBe(true);
        expect(v.disposition).toBe('accept');
    });

    it('passes a reject with a reason — even though that verdict is wrong', () => {
        const v = auditMinorityRetention(REJECTS_WITH_REASON, FIXTURE);
        expect(v.passed).toBe(true);
        expect(v.disposition).toBe('reject');
    });

    it('fails a mention with no disposition', () => {
        const v = auditMinorityRetention(MENTIONS_NO_DISPOSITION, FIXTURE);
        expect(v.passed).toBe(false);
        expect(v.failures).toEqual(['no-disposition']);
    });

    it('fails a disposition with no reason attached', () => {
        const v = auditMinorityRetention(BARE_DISPOSITION, FIXTURE);
        expect(v.passed).toBe(false);
        expect(v.failures).toEqual(['unjustified-disposition']);
    });
});

describe('anchor matching is tolerant of inflection, not of absence', () => {
    it('matches an inflected anchor', () => {
        expect(anchorPresent('the fix is eager loading the relation', 'eager load')).toBe(true);
        expect(anchorPresent('QUERY COUNTS are unchanged', 'query count')).toBe(true);
    });

    it('DENIAL — does not match an unrelated sentence, so a drop verdict means "absent"', () => {
        expect(anchorPresent('add the index on the foreign key column', 'eager load')).toBe(false);
        expect(anchorPresent('add the index on the foreign key column', 'query count')).toBe(false);
    });
});
