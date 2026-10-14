/**
 * inbox_source_census — the counting half of `/analyze:inbox`'s coverage ledger.
 *
 * What this pins is narrow on purpose. The census exists to produce a
 * denominator the *reading* cannot shrink, so the only properties worth
 * asserting are the ones a reader could otherwise argue about: which files are
 * one source set, how many anchors a source carries, which decision ids it
 * argues in, and that an empty scan root fails rather than certifying coverage.
 *
 * Sensitivity is proven in both directions per class — a stem rule that groups
 * everything and a stem rule that groups nothing would both pass a test that
 * only checked one revision family.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as census from '../../src/scripts/inbox_source_census.js';
import {
    censusTopic,
    countAnchors,
    decisionIds,
    main,
    stemOf,
} from '../../src/scripts/inbox_source_census.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-census-'));
afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

describe('stemOf — a revision family reduces to one stem', () => {
    it.each([
        // `-master` is itself a revision marker, so the master, its consolidated
        // form and the deep/final cut of the same plan reduce to ONE stem —
        // which is what makes the 10-member family in round `inbox-2026-09-r`
        // report as one revision set instead of ten unrelated plans.
        ['road-to-eleven-master.v1.md', 'road-to-eleven'],
        ['road-to-eleven-master.v3.md', 'road-to-eleven'],
        ['road-to-eleven-master.consolidated.v2.md', 'road-to-eleven'],
        // `-deep`, `-final` and the date all strip, so the later synthesis joins
        // the master's family rather than reading as an unrelated plan. That
        // grouping is the point: in round `inbox-2026-09-r` the deep-final cut
        // was written AFTER master.v3, criticises it, and is absent from its
        // declared parent set — one revision set is what forces the diff.
        ['road-to-eleven-deep-final-2026-09-06.md', 'road-to-eleven'],
        ['ac-10plus-loop-1-gap-analysis-2026-09-06.md', 'ac-10plus'],
        ['road-to-x-final.md', 'road-to-x'],
        ['plan-2026-09-06.md', 'plan'],
    ])('%s → %s', (name, stem) => {
        expect(stemOf(name)).toBe(stem);
    });

    it('does NOT collapse two genuinely different sources', () => {
        // The failure in the other direction: a stem rule aggressive enough to
        // group every `road-to-*` file would report a whole topic as one set and
        // the revision-diff obligation would fire on unrelated plans.
        expect(stemOf('road-to-delivery-for-every-host.md')).not.toBe(
            stemOf('road-to-delivery-on-hook-hosts.md'),
        );
        expect(stemOf('chat.txt')).not.toBe(stemOf('chat-2.txt'));
    });
});

describe('countAnchors', () => {
    it('counts each class and skips fenced content', () => {
        const text = [
            '# Title',
            '',
            '------',
            '',
            '## Section',
            '- [ ] a step',
            '- [x] a done step',
            '1. numbered',
            '**Bold lead-in** carries a point.',
            '',
            '```',
            '# not a heading',
            '- [ ] not a step',
            '```',
            '',
            '### Deeper',
        ].join('\n');
        expect(countAnchors(text)).toEqual({
            separators: 1,
            headings: 3,
            steps: 2,
            enumerated: 2,
        });
    });

    it('returns zeros for prose with no structure', () => {
        expect(countAnchors('just a sentence.\nand another.\n')).toEqual({
            separators: 0,
            headings: 0,
            steps: 0,
            enumerated: 0,
        });
    });
});

describe('decisionIds', () => {
    it('extracts the ids a source argues in, deduplicated and sorted', () => {
        expect(decisionIds('Decide E1 and E1 again, then D2, then K7.')).toEqual([
            'D2',
            'E1',
            'K7',
        ]);
    });

    it('does not fire on ordinary prose tokens', () => {
        // A wider pattern matches HTTP codes, versions and every capitalised
        // word followed by a digit — a noisy id set is worse than none, because
        // the run stops reading the row.
        expect(decisionIds('returned 404 and v2 of the ABCD1234 blob')).toEqual([]);
    });
});

describe('censusTopic', () => {
    it('groups a revision family into one set and leaves singletons alone', () => {
        const dir = path.join(TMP, 'topic');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'road-to-x.v1.md'), '# A\n- [ ] one\n');
        fs.writeFileSync(path.join(dir, 'road-to-x.v2.md'), '# A\n- [ ] one\n- [ ] two\n');
        fs.writeFileSync(path.join(dir, 'chat.txt'), '------\nask E1\n------\n');
        fs.writeFileSync(path.join(dir, 'notes.png'), 'binary-ish');

        const c = censusTopic(dir, 'topic');

        expect(c.fileCount).toBe(3); // .png is not a text source
        const revision = c.sets.find((s) => s.stem === 'road-to-x');
        expect(revision?.isRevisionSet).toBe(true);
        expect(revision?.members).toHaveLength(2);
        expect(c.sets.find((s) => s.stem === 'chat')?.isRevisionSet).toBe(false);
        expect(c.decisionIds).toContain('E1');
        expect(c.anchorTotal).toBeGreaterThan(0);
    });
});

describe('main — an empty scan root must fail, not certify coverage', () => {
    it('exits 2 on a missing root', () => {
        expect(main(['--root', path.join(TMP, 'does-not-exist')])).toBe(2);
    });

    it('exits 2 on a root holding no text sources', () => {
        const empty = path.join(TMP, 'empty');
        fs.mkdirSync(empty, { recursive: true });
        expect(main(['--root', empty])).toBe(2);
    });

    it('exits 2 when --root is omitted', () => {
        expect(main([])).toBe(2);
    });

    it('exits 0 on a populated root', () => {
        expect(main(['--root', path.join(TMP, 'topic'), '--json'])).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// The walk itself. Everything above asserts what the census does with the
// files it was handed; these assert WHICH files it is handed, which is the
// half that was wrong: `censusTopic` read only the files directly in a topic
// directory, so a nested folder of later-loop plans was never opened while the
// closing line still said every anchor left the run carrying a ledger row.
// ---------------------------------------------------------------------------

function mkTopic(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'census-nested-'));
    // Eleven at the top level, each with its own stem.
    const top = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda'];
    for (const stem of top) {
        fs.writeFileSync(path.join(dir, `${stem}.md`), `# ${stem}\n\n- a step\n`, 'utf-8');
    }
    // Three more a directory down, sharing a stem with three of the eleven.
    // A loop-2 plan filed under its own folder is the shape that was missed.
    const nested = path.join(dir, 'schleifen', 'v2');
    fs.mkdirSync(nested, { recursive: true });
    for (const stem of ['alpha', 'beta', 'gamma']) {
        fs.writeFileSync(path.join(nested, `${stem}.md`), `# ${stem} loop 2\n\n- a step\n`, 'utf-8');
    }
    return dir;
}

describe('inbox_source_census — nested-topic-folder', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkTopic();
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads every text file under the topic, not only the top level', () => {
        expect(census.censusTopic(dir, 't').fileCount).toBe(14);
    });

    it('groups a stem that appears at two directory levels into one revision set', () => {
        const t = census.censusTopic(dir, 't');
        const revisions = t.sets.filter((x) => x.isRevisionSet);
        expect(revisions.map((x) => x.stem).sort()).toEqual(['alpha', 'beta', 'gamma']);
        // Each member keeps its path relative to the topic, so a cross-level
        // set is visible as one — two unrelated files that happen to share a
        // stem at different depths group too, and a reader has to be able to
        // see that from the output rather than infer it.
        const alpha = revisions.find((x) => x.stem === 'alpha');
        expect(alpha?.members.map((m) => m.file).sort()).toEqual(['alpha.md', 'schleifen/v2/alpha.md']);
    });

    it('positive control — the pre-repair walk sees eleven files and no revision set', () => {
        // `recursive: false` IS the old reader: the non-recursive pass that
        // `censusRoot` still uses for the round root.
        //
        // NOTE on the planned numbers: the step was written expecting a control
        // of twelve files and zero sets. Those came from the real round folder,
        // and a synthetic fixture cannot carry both — fourteen files with three
        // cross-level stems means three of them are nested, so the blind walk
        // sees eleven. The property is identical and the figure is the fixture's.
        const old = census.censusTopic(dir, 't', false);
        expect(old.fileCount).toBe(11);
        expect(old.sets.filter((x) => x.isRevisionSet)).toEqual([]);
    });

    it('a round root still counts each subdirectory once', () => {
        // The repair's own hazard: a recursive root pass plus a recursive
        // per-topic pass would count the nested files twice.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'census-root-'));
        try {
            fs.writeFileSync(path.join(root, 'readme.md'), '# r\n', 'utf-8');
            fs.mkdirSync(path.join(root, 'topic', 'deep'), { recursive: true });
            fs.writeFileSync(path.join(root, 'topic', 'one.md'), '# one\n', 'utf-8');
            fs.writeFileSync(path.join(root, 'topic', 'deep', 'two.md'), '# two\n', 'utf-8');
            const total = census.censusRoot(root).reduce((n, t) => n + t.fileCount, 0);
            expect(total).toBe(3);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('inbox_source_census — uncounted-files-named', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkTopic();
        fs.writeFileSync(path.join(dir, 'prototype.mjs'), 'export const x = 1;\n', 'utf-8');
        fs.writeFileSync(path.join(dir, 'schleifen', 'v2', 'screenshot.png'), 'not-a-png', 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('names every file it did not read, with its path', () => {
        const t = census.censusTopic(dir, 't');
        expect(t.uncounted).toEqual(['prototype.mjs', 'schleifen/v2/screenshot.png']);
        // They are named, not counted: the file total is unchanged by them.
        expect(t.fileCount).toBe(14);
    });

    it('a folder of only unreadable files is reported, not silently empty', () => {
        const only = fs.mkdtempSync(path.join(os.tmpdir(), 'census-bin-'));
        try {
            fs.writeFileSync(path.join(only, 'a.mjs'), 'x\n', 'utf-8');
            const t = census.censusTopic(only, 't');
            expect(t.fileCount).toBe(0);
            expect(t.uncounted).toEqual(['a.mjs']);
        } finally {
            fs.rmSync(only, { recursive: true, force: true });
        }
    });

    it('a topic with nothing skipped reports an empty uncounted list', () => {
        // The negative control: without it, an `uncounted` that always carried
        // something would pass the two cases above.
        const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'census-clean-'));
        try {
            fs.writeFileSync(path.join(clean, 'a.md'), '# a\n', 'utf-8');
            expect(census.censusTopic(clean, 't').uncounted).toEqual([]);
        } finally {
            fs.rmSync(clean, { recursive: true, force: true });
        }
    });
});
