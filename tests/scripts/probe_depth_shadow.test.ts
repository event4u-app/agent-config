import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    flipReadiness,
    parseReviewCorpus,
    receiptCoverage,
    reviewEscapes,
    roundTable,
    type ReviewRow,
} from '../../src/scripts/probe_depth_shadow.js';

const header = (round?: number): string =>
    `<!-- completion-review: v1 | reviewed: 2026-10-21 | scope: ${'a'.repeat(64)} | diff: ${'b'.repeat(40)} | reviewer: r${round === undefined ? '' : ` | round: ${String(round)}`} -->`;
const row = (n: number, sev: string, status = 'fixed'): string => `| ${String(n)} | ${sev} | a.ts:1 | f | ${status} | ref |`;

function corpus(files: Record<string, string[]>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'depth-corpus-'));
    for (const [name, lines] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), `${lines.join('\n')}\n`);
    return dir;
}

describe('review corpus parse', () => {
    it('reads archived round records, the round: header, and a suffix only where the slug has siblings', () => {
        const dir = corpus({
            // archived § 2.7 record of round 1, then the live artefact re-bound in place as round 2
            'feat.round1-review.md': [header(), row(1, 'high')],
            'feat.findings.md': [header(2), row(1, 'critical'), row(2, 'low')],
            // a subject name that merely contains "round7": one file, so round 1
            'conformance-round7.findings.md': [header(), row(1, 'high')],
            // a genuine suffixed round with a sibling
            'x-round2.findings.md': [header(), row(1, 'medium')],
            'x.findings.md': [header(), row(1, 'medium')],
            // an illustrative row is not a finding
            'y.findings.md': [header(), row(1, 'high', 'example')],
        });
        const rows = parseReviewCorpus(dir);
        const key = (r: { slug: string; round: number; sev: string }): string => `${r.slug}:${String(r.round)}:${r.sev}`;
        expect(rows.map(key).sort()).toEqual(
            ['conformance-round7:1:high', 'feat:1:high', 'feat:2:critical', 'feat:2:low', 'x:1:medium', 'x:2:medium'].sort(),
        );
    });

    it('the round table counts artefacts, rows and reviews ending at each round', () => {
        const t = roundTable([
            { slug: 'a', round: 1, sev: 'high' },
            { slug: 'a', round: 2, sev: 'low' },
            { slug: 'b', round: 1, sev: 'medium' },
        ]);
        expect(t.find((r) => r.band === '1')).toMatchObject({ artefacts: 2, findings: 2, hc: 1, ending: 1 });
        expect(t.find((r) => r.band === '2')).toMatchObject({ artefacts: 1, findings: 1, hc: 0, ending: 1 });
    });
});

const roadmap = [
    '## Phase 1',
    '- [x] **1.1 One.** Done. <!-- receipt: class=R0 · shadow · would-skip=review · bound=x -->',
    '- [x] **1.2 Two.** Done. <!-- receipt: class=R1 · shadow · would-skip=council · bound=y -->',
    '- [x] **1.3 Three.** Done, no receipt.',
    '- [ ] **1.4 Four.** <!-- receipt: class=R0 · shadow · would-skip=review · bound=z -->',
    '- [x] **1.5 Five.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=w -->',
].join('\n');

describe('probe_depth_shadow', () => {
    it('counts receipts on ticked steps by class, and the ticked steps without one', () => {
        const c = receiptCoverage([roadmap]);
        expect(c.ticked).toBe(4);
        expect(c.byClass).toEqual({ R0: 1, R1: 1, R2: 0, R3: 1 });
        expect(c.missing).toBe(1);
    });

    it('a since-window counts only ticks dated on or after it', () => {
        const dated = ['- [x] **2.1 A.** Done 2026-10-20. <!-- receipt: class=R0 · shadow · would-skip=review · bound=a -->', '- [x] **2.2 B.** Done 2026-10-22.', '- [x] **2.3 C.** Undated.'].join('\n');
        const c = receiptCoverage([dated], '2026-10-21');
        expect(c.ticked).toBe(1);
        expect(c.missing).toBe(1);
    });

    it('a would-have-escape is a high/critical row the class row would not have reviewed', () => {
        const rows: ReviewRow[] = [
            { cls: 'R0', round: 1, sev: 'high' },
            { cls: 'R1', round: 1, sev: 'critical' },
            { cls: 'R1', round: 2, sev: 'high' },
            { cls: 'R1', round: 3, sev: 'low' },
            { cls: 'R2', round: 4, sev: 'critical' },
        ];
        const e = reviewEscapes(rows);
        expect(e.R0).toEqual({ rows: 1, escaped: 1, critical: 0 });
        expect(e.R1).toEqual({ rows: 2, escaped: 1, critical: 0 });
        expect(e.R2).toEqual({ rows: 1, escaped: 0, critical: 0 });
    });
});

describe('flipReadiness — D14 (2) per flip class', () => {
    const flip = {
        scope: 'structurally-safe-paths' as const,
        classes: ['R0', 'R1'] as ('R0' | 'R1')[],
        requires: { min_steps: 30, max_escaped: 1, max_critical: 0 },
        reading: null,
    };
    const coverage = (r0: number, r1: number) => ({ ticked: r0 + r1, byClass: { R0: r0, R1: r1, R2: 0, R3: 0 }, missing: 0 });
    const escapes = (r0: number, r0crit: number) => ({
        R0: { rows: r0, escaped: r0, critical: r0crit },
        R1: { rows: 0, escaped: 0, critical: 0 },
        R2: { rows: 0, escaped: 0, critical: 0 },
        R3: { rows: 0, escaped: 0, critical: 0 },
    });

    it('thirty steps with at most one escape and no critical is ready', () => {
        expect(flipReadiness(coverage(30, 30), escapes(1, 0), flip).map((r) => r.ready)).toEqual([true, true]);
    });

    it('too few steps, a second escape, a critical, or an unread review half is not', () => {
        expect(flipReadiness(coverage(29, 30), escapes(0, 0), flip)[0]!.ready).toBe(false);
        expect(flipReadiness(coverage(30, 30), escapes(2, 0), flip)[0]!.ready).toBe(false);
        expect(flipReadiness(coverage(30, 30), escapes(1, 1), flip)[0]!.ready).toBe(false);
        expect(flipReadiness(coverage(30, 30), null, flip).map((r) => r.ready)).toEqual([false, false]);
    });
});
