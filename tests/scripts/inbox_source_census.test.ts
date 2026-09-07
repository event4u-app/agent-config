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

import { afterAll, describe, expect, it } from 'vitest';

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
