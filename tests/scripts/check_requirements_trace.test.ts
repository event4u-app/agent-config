import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { rmFixtureRepo } from '../_lib/rm_fixture_repo.js';
import {
    main,
    parseAcAnnotations,
    parseTrace,
    summarise,
} from '../../src/scripts/check_requirements_trace.js';

let tmp: string | null = null;
afterEach(() => {
    if (tmp !== null) rmFixtureRepo(tmp);
    tmp = null;
});

/** A fixture corpus: <tmp>/agents/roadmaps/<name>.md */
function corpus(files: Record<string, string>): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reqtrace-'));
    const dir = path.join(tmp, 'agents', 'roadmaps');
    fs.mkdirSync(dir, { recursive: true });
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), body, 'utf-8');
    return dir;
}

const BLOCK = `traceability:
  - requirement_id: a-requirement
    acceptance_id: an-acceptance
    evidence_refs:
      - real.txt
`;

describe('check_requirements_trace — the reader', () => {
    it('parses the repeated ROW form, one row per requirement/acceptance pair', () => {
        const { rows } = parseTrace(BLOCK);
        expect(rows).toEqual([
            { requirement_id: 'a-requirement', acceptance_id: 'an-acceptance', evidence_refs: ['real.txt'] },
        ]);
    });

    it('parses a block nested inside a blockquote', () => {
        // This roadmap dogfoods it that way, so the reader must survive it. A
        // real YAML parser could not: a roadmap is not a YAML document.
        const quoted = BLOCK.split('\n').map((l) => (l === '' ? '>' : `> ${l}`)).join('\n');
        expect(parseTrace(quoted).rows).toHaveLength(1);
    });

    it('keeps two rows separate rather than merging their refs', () => {
        // The whole point of the row form: a flat collection is countable and
        // not traceable, because nobody can say which evidence discharged which
        // criterion.
        const two = `traceability:
  - requirement_id: r-one
    acceptance_id: a-one
    evidence_refs:
      - one.txt
  - requirement_id: r-two
    acceptance_id: a-two
    evidence_refs:
      - two.txt
`;
        const { rows } = parseTrace(two);
        expect(rows.map((r) => r.evidence_refs)).toEqual([['one.txt'], ['two.txt']]);
    });

    it('flags an id that is not the reused kebab slug', () => {
        const bad = `traceability:
  - requirement_id: Not_A_Slug
    acceptance_id: fine-slug
`;
        const { malformed } = parseTrace(bad);
        expect(malformed).toHaveLength(1);
        expect(malformed[0]).toContain('Not_A_Slug');
    });

    it('reads `[AC:<id>]` on a verify line — the first structural reader of them', () => {
        expect(parseAcAnnotations('verify: [AC:some-criterion] the thing holds')).toEqual([
            'some-criterion',
        ]);
        expect(parseAcAnnotations('verify: no annotation here')).toEqual([]);
    });
});

describe('check_requirements_trace — the counts', () => {
    it('counts an unresolved ref at the CURRENT head, not at declaration time', () => {
        const dir = corpus({ 'a.md': BLOCK });
        const root = path.dirname(path.dirname(dir));
        // `real.txt` does not exist → unresolved 1.
        expect(summarise([{ file: 'a.md', ...parseTrace(BLOCK), ac_annotations: [] }], root).unresolved).toBe(1);
        fs.writeFileSync(path.join(root, 'real.txt'), 'x', 'utf-8');
        // Same roadmap, unedited; the tree moved under it → unresolved 0.
        expect(summarise([{ file: 'a.md', ...parseTrace(BLOCK), ac_annotations: [] }], root).unresolved).toBe(0);
    });

    it('separates unlinked from unresolved — they are different findings', () => {
        const noRefs = `traceability:
  - requirement_id: r
    acceptance_id: a
`;
        const s = summarise([{ file: 'a.md', ...parseTrace(noRefs), ac_annotations: [] }], '/nonexistent');
        expect(s.unlinked).toBe(1);
        expect(s.unresolved).toBe(0);
    });

    it('counts a dangling `[AC:…]` against the same file\'s acceptance ids', () => {
        const s = summarise(
            [{ file: 'a.md', ...parseTrace(BLOCK), ac_annotations: ['an-acceptance', 'nowhere'] }],
            '/nonexistent',
        );
        expect(s.dangling_ac).toBe(1);
    });
});

describe('check_requirements_trace — exits 0 always', () => {
    it('exits 0 on a corpus with a deliberately dangling ref, and prints a table', () => {
        // The property that makes this a listing and not a gate. A gate that can
        // fail on day one reds the whole backlog — the failure this tree already
        // recorded once, in road-to-plan-gates-measurement.
        const dir = corpus({
            'a.md': `${BLOCK}\n- [ ] step\n      verify: [AC:does-not-exist] nope\n`,
        });
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
            out.push(s);
            return true;
        };
        try {
            expect(main(['--dir', dir])).toBe(0);
        } finally {
            (process.stdout as unknown as { write: typeof orig }).write = orig;
        }
        const text = out.join('');
        expect(text).toContain('dangling');
        expect(text).toContain('| Roadmap |');
    });

    it('exits 0 on an EMPTY corpus and says so, rather than printing a clean bill', () => {
        const dir = corpus({});
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
            out.push(s);
            return true;
        };
        try {
            expect(main(['--dir', dir])).toBe(0);
        } finally {
            (process.stdout as unknown as { write: typeof orig }).write = orig;
        }
        expect(out.join('')).toContain('_none declared_');
    });
});
