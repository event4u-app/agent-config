/**
 * Tests for `src/scripts/check_standing_payload_delta.ts` — the per-PR
 * standing-payload delta reporter (`road-to-standing-payload-diet` 0.3–0.5).
 *
 * WHAT MAKES THIS GATE UNUSUAL, and what these tests therefore have to prove.
 * It is a REPORT: it must not fail on the number it publishes, in either
 * direction. So "the gate went red" is not evidence it works — the interesting
 * properties are (1) it exits 0 on a real movement, (2) it splits that movement
 * into a debit and a credit rather than one signed cell, and (3) it fails ONLY
 * when it cannot measure.
 *
 * RED BEFORE GREEN — the two defects below were found by the unmodified code on
 * its first run, and the verbatim readings are recorded rather than paraphrased:
 *
 *   1. `CLAUDE.md` in this repo is a symlink to `AGENTS.md` (mode `120000`).
 *      `git show <ref>:CLAUDE.md` returns the nine-byte link TARGET, so the
 *      base-side census read the string `AGENTS.md` as the whole file. Observed:
 *        `| CLAUDE.md hierarchy (project only) (1 → 1 files) | 2 | 746 | +744 | — |`
 *      A fabricated +744 debit out of a file nobody touched. `readBlob` now
 *      follows the link, and `resolves a tracked symlink` below is that fix's
 *      regression test.
 *
 *   2. `git archive` honours `export-ignore`, and `.gitattributes:26` carries
 *      `/CLAUDE.md export-ignore` — so the tarball omitted the file SILENTLY and
 *      the ref side measured a bucket that was not there. Recorded because the
 *      failure mode is invisible: an empty bucket and a genuinely small bucket
 *      print the same way.
 *
 * SABOTAGE PROBES, run before this file was trusted. Counts and assertion text
 * are the observed ones, not the expected ones.
 *
 *   1. `diffBuckets` neutralised to the one-sided form the two-sided ledger
 *      exists to replace (`debit: signed, credit: 0`) — the shape where a
 *      REMOVAL scores zero. **2 of 10 red**, both in `the two-sided ledger`:
 *        `AssertionError: expected +0 to be 60 // Object.is equality`
 *   2. The symlink hop removed from `readBlob` (returning `catBlob`'s bytes
 *      directly). **2 of 10 red**:
 *        `expected 9 to be greater than 100`
 *        `expected 744 to be +0 // Object.is equality`
 *      The second of those is the one that matters: it is the fabricated +744
 *      debit reappearing, i.e. the probe reproduced defect 1 above exactly.
 *
 * Restoring each gives 10/10, and `git diff --stat` over the gate path is empty
 * after both (verified by `cp` from a backup, never `git checkout`).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    type Bucket,
    checkoutRefTree,
    diffBuckets,
    main,
    measureBuckets,
    partitionCredit,
    rankRules,
    renderMarkdown,
} from '../../src/scripts/check_standing_payload_delta.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MERGE_BASE = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();

describe('the two-sided ledger', () => {
    const base: Bucket[] = [
        { name: 'a', tokens: 100, files: 1 },
        { name: 'b', tokens: 100, files: 1 },
        { name: 'c', tokens: 100, files: 1 },
    ];

    it('books a REMOVAL as a credit, never as a smaller debit', () => {
        const head: Bucket[] = [
            { name: 'a', tokens: 40, files: 1 },
            { name: 'b', tokens: 100, files: 1 },
            { name: 'c', tokens: 100, files: 1 },
        ];
        const rows = diffBuckets(base, head);
        const a = rows.find((r) => r.name === 'a');
        // The one-sided form this replaces would report debit -60 / credit 0.
        expect(a?.credit).toBe(60);
        expect(a?.debit).toBe(0);
    });

    it('keeps debit and credit separable when both directions occur at once', () => {
        const head: Bucket[] = [
            { name: 'a', tokens: 40, files: 1 },
            { name: 'b', tokens: 175, files: 1 },
            { name: 'c', tokens: 100, files: 1 },
        ];
        const rows = diffBuckets(base, head);
        expect(rows.reduce((s, r) => s + r.credit, 0)).toBe(60);
        expect(rows.reduce((s, r) => s + r.debit, 0)).toBe(75);
        // A signed total alone cannot distinguish "+75/−60" from "+15/−0"; the
        // whole point of step 0.5 is that those are different facts.
        expect(rows.reduce((s, r) => s + r.debit - r.credit, 0)).toBe(15);
    });

    it('treats a bucket absent at the base as a pure debit, not as an error', () => {
        const rows = diffBuckets([], [{ name: 'a', tokens: 30, files: 1 }]);
        expect(rows[0]?.debit).toBe(30);
        expect(rows[0]?.credit).toBe(0);
    });
});

describe('measurement parity with the ratchet it reports beside', () => {
    it('measures the three buckets the ratchet gates, by the ratchet own names', () => {
        const buckets = measureBuckets(REPO_ROOT);
        expect(buckets.map((b) => b.name)).toEqual([
            'project-scope rules',
            'preloaded skills catalog',
            'CLAUDE.md hierarchy (project only)',
        ]);
        // Every bucket must have read something; a zero here is the dead-scope
        // condition the gate exits 3 on, not a small payload.
        for (const b of buckets) expect(b.files).toBeGreaterThan(0);
    });

    it('resolves a tracked symlink, so the base side sees the file and not the link target', () => {
        const dir = checkoutRefTree(MERGE_BASE, REPO_ROOT);
        try {
            const claudeMd = path.join(dir, 'CLAUDE.md');
            expect(fs.existsSync(claudeMd)).toBe(true);
            // 9 bytes is the link target string `AGENTS.md` — the observed defect.
            expect(fs.statSync(claudeMd).size).toBeGreaterThan(100);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('reports a zero delta against its own HEAD', () => {
        const dir = checkoutRefTree(MERGE_BASE, REPO_ROOT);
        try {
            const rows = diffBuckets(measureBuckets(dir), measureBuckets(REPO_ROOT));
            expect(rows.reduce((s, r) => s + r.debit + r.credit, 0)).toBe(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('the exact-BPE ranking is a separate basis and is labelled as one', () => {
    it('ranks the projected rules descending', () => {
        const rows = rankRules(path.join(REPO_ROOT, 'dist', 'agent-src', 'rules'));
        expect(rows.length).toBeGreaterThan(100);
        for (let i = 1; i < rows.length; i += 1) {
            expect(rows[i - 1]!.tokens).toBeGreaterThanOrEqual(rows[i]!.tokens);
        }
    });

    it('returns an empty ranking for a missing directory rather than throwing', () => {
        expect(rankRules(path.join(os.tmpdir(), 'spd-no-such-dir-xyzzy'))).toEqual([]);
    });
});

describe('report-only contract', () => {
    it('exits 0 on a measured delta and 2 on an unreadable ref', () => {
        const chunks: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            chunks.push(String(c));
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(main(['--base', MERGE_BASE, '--quiet'])).toBe(0);
        } finally {
            process.stdout.write = write;
        }
        expect(chunks.join('')).toContain('scanned: 3');
        expect(main(['--base', 'no-such-ref-xyzzy', '--quiet'])).toBe(2);
    });

    it('renders unavailable credit as unavailable, never as zero', () => {
        const report = {
            base_ref: null,
            basis: 'x',
            rank_basis: 'y',
            buckets: [],
            rows: [],
            total_debit: 0,
            total_credit: 0,
            net: 0,
            credit_bookings: [],
            ranking: [],
        };
        const md = renderMarkdown(report);
        expect(md).toContain('never as zero');
        // `partitionCredit` returning null is a legitimate environment answer
        // (no host projection in a fresh checkout), not a measurement of zero.
        expect(partitionCredit(path.join(os.tmpdir(), 'spd-no-such-root'))).toBeNull();
    });
});
