/**
 * stubs_due — the parked estate's front door.
 *
 * The load-bearing assertions are the three SEPARATE buckets and the
 * missing-date case. Collapsing overdue / no-probe / owner into one count would
 * tell a reader to re-read a file that needs a decision and to decide about a
 * file that needs a probe — and treating an absent `review_by:` as "fine" would
 * make the field optional in practice, which is the state this closed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listStubs, readStub, report, STUB_DIR } from '../../src/scripts/stubs_due.js';

let root: string;

const write = (name: string, body: string): void => {
    const abs = path.join(root, STUB_DIR, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf-8');
};

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'stubs-due-'));
    fs.mkdirSync(path.join(root, STUB_DIR), { recursive: true });
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('listStubs', () => {
    it('collects every .md and never the README, which is the contract', () => {
        write('README.md', '# contract');
        write('a.md', '---\nreview_by: 2027-01-01\n---\n');
        write('b.md', '---\nreview_by: 2027-01-01\n---\n');
        expect(listStubs(root)).toEqual([`${STUB_DIR}/a.md`, `${STUB_DIR}/b.md`]);
    });

    it('returns nothing rather than throwing when the directory is absent', () => {
        expect(listStubs(path.join(root, 'nope'))).toEqual([]);
    });
});

describe('readStub', () => {
    it('reads review_by and probe from the frontmatter only', () => {
        write('a.md', '---\ncomplexity: lightweight\nreview_by: 2027-03-04\nprobe: none\n---\n\nbody\n');
        const r = readStub(root, `${STUB_DIR}/a.md`);
        expect(r.reviewBy).toBe('2027-03-04');
        expect(r.probeNone).toBe(true);
    });

    it('does NOT read a review_by that only appears in the body', () => {
        write('a.md', '---\ncomplexity: lightweight\n---\n\nreview_by: 2027-03-04\n');
        expect(readStub(root, `${STUB_DIR}/a.md`).reviewBy).toBeNull();
    });

    it('matches an owner-routing phrase anywhere in the file', () => {
        write('a.md', '---\nreview_by: 2027-01-01\n---\n\nThis is owner-reserved.\n');
        expect(readStub(root, `${STUB_DIR}/a.md`).ownerPhrase).toBe('owner-reserved');
    });

    it('does not invent an owner phrase from the word "owner" alone', () => {
        write('a.md', '---\nreview_by: 2027-01-01\n---\n\nThe owner of this file is the parent roadmap.\n');
        expect(readStub(root, `${STUB_DIR}/a.md`).ownerPhrase).toBeNull();
    });
});

describe('report — three buckets, because they are three different problems', () => {
    beforeEach(() => {
        write('overdue.md', '---\nreview_by: 2026-08-01\n---\n');
        write('future.md', '---\nreview_by: 2027-01-01\n---\n');
        write('undated.md', '---\ncomplexity: lightweight\n---\n');
        write('noprobe.md', '---\nreview_by: 2027-01-01\nprobe: none\n---\n');
        write('owned.md', '---\nreview_by: 2027-01-01\n---\n\nThis is a maintainer decision.\n');
    });

    it('counts a past date as overdue and a future one as not', () => {
        const r = report(root, '2026-08-26');
        expect(r.overdue.map((s) => s.file)).toContain(`${STUB_DIR}/overdue.md`);
        expect(r.overdue.map((s) => s.file)).not.toContain(`${STUB_DIR}/future.md`);
    });

    it('counts an ABSENT date as overdue — the field is required, so missing means unscheduled', () => {
        expect(report(root, '2026-08-26').overdue.map((s) => s.file)).toContain(`${STUB_DIR}/undated.md`);
    });

    it('counts the review date INCLUSIVE of today', () => {
        write('today.md', '---\nreview_by: 2026-08-26\n---\n');
        expect(report(root, '2026-08-26').overdue.map((s) => s.file)).toContain(`${STUB_DIR}/today.md`);
    });

    it('keeps no-probe separate from overdue — one is late, the other has no finish line', () => {
        const r = report(root, '2026-08-26');
        expect(r.noProbe.map((s) => s.file)).toEqual([`${STUB_DIR}/noprobe.md`]);
        expect(r.overdue.map((s) => s.file)).not.toContain(`${STUB_DIR}/noprobe.md`);
    });

    it('keeps owner-routed separate too — no amount of re-reading moves it', () => {
        const r = report(root, '2026-08-26');
        expect(r.owner.map((s) => s.file)).toEqual([`${STUB_DIR}/owned.md`]);
    });

    it('reports the total over every stub, whatever bucket it fell in', () => {
        expect(report(root, '2026-08-26').total).toBe(5);
    });
});

describe('the real corpus', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');

    it('has a review_by on every stub — the state Phase 1.2 established', () => {
        const undated = listStubs(repoRoot)
            .map((rel) => readStub(repoRoot, rel))
            .filter((s) => s.reviewBy === null)
            .map((s) => s.file);
        expect(undated).toEqual([]);
    });

    it('scans a non-empty corpus, so a green result is not an empty one', () => {
        expect(listStubs(repoRoot).length).toBeGreaterThan(50);
    });
});
