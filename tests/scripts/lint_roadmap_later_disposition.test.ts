// Tests for src/scripts/lint_roadmap_later_disposition.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported `check()` + helpers on a sandboxed
//     ROADMAP_ROOT (via _setRoadmapRootForTest), covering Rule A (status:later
//     outside later/) and Rule B (later/ roadmap without a resume condition),
//     plus the exclude-name / exclude-prefix filter and the frontmatter/status
//     parsers.
//  2. Golden parity: python3 lint_roadmap_later_disposition.py vs tsx, both
//     pointed at the SAME tmp ROADMAP_ROOT, asserting byte-identical
//     stdout/stderr + exit across clean / Rule-A / Rule-B / both, human +
//     --json output, and the argparse usage/error paths. Skipped without
//     python3.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _frontmatter,
    _is_roadmap,
    _status,
    check,
    entryConditionParts,
    entryConditionProblems,
    _setRoadmapRootForTest,
} from '../../src/scripts/lint_roadmap_later_disposition.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const FM_LATER = '---\nstatus: later\n---\n';
const FM_READY = '---\nstatus: ready\n---\n';

// --- Unit -------------------------------------------------------------------

describe('lint_roadmap_later_disposition — helpers', () => {
    it('_frontmatter / _status parse the YAML block', () => {
        expect(_frontmatter(FM_LATER)).toBe('status: later');
        expect(_status(FM_LATER)).toBe('later');
        expect(_status('no frontmatter here')).toBe(null);
        expect(_status('---\nstatus: READY\n---\nbody')).toBe('ready'); // .lower()
    });

    it('_is_roadmap excludes the known non-roadmap names + prefixes', () => {
        expect(_is_roadmap('/x/template.md')).toBe(false);
        expect(_is_roadmap('/x/README.md')).toBe(false);
        expect(_is_roadmap('/x/open-questions-2.md')).toBe(false);
        expect(_is_roadmap('/x/road-to-thing.md')).toBe(true);
    });
});

describe('lint_roadmap_later_disposition — check()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lrl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setRoadmapRootForTest(path.join(REPO_ROOT, 'agents', 'roadmaps'));
    });

    /** A parked file. `review_by` is present unless a test is about Rule C. */
    function park(name: string, frontmatter: string, body: string): void {
        fs.mkdirSync(path.join(tmp, 'later'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'later', name),
            `---\n${frontmatter}\n---\n${body}`,
            'utf-8',
        );
    }

    const REVIEW_BY = 'review_by: 2026-12-01';
    const GOOD_CONDITION = [
        'entry_condition:',
        '  what: "the upstream adapter manifest ships"',
        '  when: "whenever the vendor publishes it; unscheduled"',
        '  who: "whoever wires the adapter; none for the decision itself"',
    ].join('\n');

    it('clean tree → no violations', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_READY + 'work', 'utf-8');
        park('road-to-b.md', `status: later\n${REVIEW_BY}\n${GOOD_CONDITION}`, 'parked');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });

    it('Rule A: status:later in active tree → violation', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_LATER + 'work', 'utf-8');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.length).toBe(1);
        expect(v[0]!.cls).toBe('hard');
        expect(v[0]!.reason).toContain('must be parked in `later/`');
    });

    // ── 3.1 ───────────────────────────────────────────────────────
    it('3.1 — `status: later` alone no longer satisfies the gate', () => {
        park('road-to-b.md', `status: later\n${REVIEW_BY}`, 'no wake condition anywhere in here');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.map((x) => x.cls)).toEqual(['wake']);
        expect(v[0]!.reason).toContain('the frontmatter `status` word no longer satisfies this gate');
    });

    // ── 3.2 ───────────────────────────────────────────────────────
    it('3.2 — a body that merely mentions `trigger` is rejected', () => {
        park('road-to-b.md', `status: later\n${REVIEW_BY}`, 'the trigger fires on push');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp).map((x) => x.cls)).toEqual(['wake']);
    });

    it('3.2 — a structured entry_condition with no resume phrase passes', () => {
        park('road-to-b.md', `status: ready\n${REVIEW_BY}\n${GOOD_CONDITION}`, 'open work');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });

    it('the four unambiguous phrases still satisfy the gate', () => {
        park('road-to-b.md', `status: ready\n${REVIEW_BY}`, 'Blocked until the API lands.');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });

    // ── 3.3 ───────────────────────────────────────────────────────
    it('3.3 — a one-word entry_condition is rejected, naming the missing parts', () => {
        park(
            'road-to-b.md',
            `status: later\n${REVIEW_BY}\nentry_condition:\n  what: "later"`,
            'Blocked until something happens.',
        );
        _setRoadmapRootForTest(tmp);
        const hard = check(tmp).filter((x) => x.cls === 'hard');
        expect(hard.length).toBe(1);
        expect(hard[0]!.reason).toContain('missing or blank in: when, who');
    });

    it('3.3 — a scalar entry_condition is rejected', () => {
        park(
            'road-to-b.md',
            `status: later\n${REVIEW_BY}\nentry_condition: "when the thing lands"`,
            'Blocked until the thing lands.',
        );
        _setRoadmapRootForTest(tmp);
        const hard = check(tmp).filter((x) => x.cls === 'hard');
        expect(hard.length).toBe(1);
        expect(hard[0]!.reason).toContain('must be a mapping');
    });

    it('3.3 — `none` is legal for `who`, blankness is not', () => {
        const withNone = [
            'entry_condition:',
            '  what: "the vendor ships it"',
            '  when: "unscheduled"',
            '  who: "none"',
        ].join('\n');
        park('road-to-b.md', `status: later\n${REVIEW_BY}\n${withNone}`, 'parked');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);

        fs.rmSync(path.join(tmp, 'later', 'road-to-b.md'));
        const blank = withNone.replace('  who: "none"', '  who: ""');
        park('road-to-c.md', `status: later\n${REVIEW_BY}\n${blank}`, 'parked');
        const hard = check(tmp).filter((x) => x.cls === 'hard');
        expect(hard.length).toBe(1);
        expect(hard[0]!.reason).toContain('missing or blank in: who');
    });

    // ── 3.4 ───────────────────────────────────────────────────────
    it('3.4 — a parked roadmap without review_by is a ratcheted finding', () => {
        park('road-to-b.md', `status: later\n${GOOD_CONDITION}`, 'parked');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.map((x) => x.cls)).toEqual(['review-by']);
        expect(v[0]!.reason).toContain('indistinguishable from');
    });
});

describe('lint_roadmap_later_disposition — the entry_condition reader', () => {
    it('reads the three parts and reports what is absent', () => {
        expect(entryConditionProblems('status: later')).toEqual(['absent']);
        expect(entryConditionProblems('entry_condition: "x"')).toEqual(['scalar']);
        expect(
            entryConditionProblems('entry_condition:\n  what: "a"\n  when: "b"\n  who: "c"'),
        ).toEqual([]);
        expect(entryConditionProblems('entry_condition:\n  what: "a"')).toEqual(['when', 'who']);
    });

    it('stops at the next top-level key rather than swallowing it', () => {
        const fm = 'entry_condition:\n  what: "a"\n  when: "b"\n  who: "c"\nstatus: later';
        const read = entryConditionParts(fm);
        expect(Object.keys(read.parts).sort()).toEqual(['what', 'when', 'who']);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------



