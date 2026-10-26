import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decisionId, isDecisionFile, parseAdrRefs, pathMentions, readDecisions } from '../../src/scripts/code_graph/lanes/decisions/decisions.js';
import { spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';

let root: string;
const files: string[] = [];

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    files.push(rel);
}

function adr(n: number, fields: Record<string, string>, body = ''): string {
    const rel = `docs/decisions/ADR-${String(n).padStart(3, '0')}-record-${n}.md`;
    const fm = Object.entries({ adr: String(n), status: 'accepted', date: '2026-01-0' + ((n % 9) + 1), supersedes: '—', superseded_by: '—', ...fields })
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    write(rel, `---\n${fm}\n---\n\n# ADR-${n} — Record number ${n}\n\n${body}\n`);
    return rel;
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-decisions-')));
    files.length = 0;
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const read = () => readDecisions(root, { files: [...files] });
const sup = (out: ReturnType<typeof read>) => out.relations.filter((r) => r.relation === 'supersedes').map((r) => `${r.from}>${r.to}`);

describe('readDecisions — decision facts', () => {
    it('turns each record into a decision fact with number, title, status, date and links', () => {
        const file = adr(12, { status: 'superseded', amends: 'ADR-3, ADR-4', amended_by: 'ADR-20' });
        adr(3, {});
        const out = read();
        const d = out.facts.find((f) => f.id === decisionId(12));
        expect(d?.kind).toBe('decision');
        expect(d?.attrs).toMatchObject({ number: 12, title: 'Record number 12', status: 'superseded', date: '2026-01-04', amends: ['ADR-3', 'ADR-4'], amended_by: ['ADR-20'] });
        expect(d?.witness).toEqual({ file, line: 11, hash: spanHash('# ADR-12 — Record number 12') });
        expect(d?.owner).toBe(file);
        expect(out.facts.map((f) => f.attrs.number)).toEqual([3, 12]);
    });

    it('reads a MADR record from its file name, heading and status section', () => {
        write('docs/adr/0007-use-sqlite.md', '# 7. Use SQLite\n\nDate: 2026-02-02\n\n## Status\n\nSuperseded by [ADR-0009](0009-use-files.md)\n\n## Context\n');
        write('docs/adr/0009-use-files.md', '# 9. Use files\n\n* Status: accepted\n');
        const out = read();
        expect(out.facts.find((f) => f.id === decisionId(7))?.attrs).toMatchObject({ title: 'Use SQLite', status: 'superseded', date: '2026-02-02', superseded_by: ['ADR-9'] });
        expect(out.facts.find((f) => f.id === decisionId(9))?.attrs.status).toBe('accepted');
        expect(sup(out)).toEqual(['decision:ADR-9>decision:ADR-7']);
        expect(out.relations[0]?.attrs.partial).toBe(false);
    });

    it('ignores files that are no decision record and reports a record without a number', () => {
        write('docs/decisions/README.md', '# Decisions\n');
        write('docs/notes/ADR-5-not-here.md', '# x\n');
        write('docs/adr/template.md', '# template\n');
        write('docs/adr/0001-x.md', '---\nstatus: draft\n---\n# One\n');
        const out = read();
        expect(out.facts.map((f) => f.id)).toEqual([decisionId(1)]);
        expect(isDecisionFile('docs/decisions/README.md')).toBe(false);
    });
});

describe('readDecisions — supersedes direction', () => {
    it('superseded_by on A pointing to B yields B supersedes A, never the reverse', () => {
        adr(10, { status: 'superseded', superseded_by: 'ADR-20' });
        adr(20, {});
        const out = read();
        expect(sup(out)).toEqual(['decision:ADR-20>decision:ADR-10']);
        const r = out.relations[0];
        expect(r?.witness.file).toBe('docs/decisions/ADR-010-record-10.md');
        expect(r?.witness.line).toBe(6);
    });

    it('supersedes on B pointing to A yields the same edge, once, when both records state it', () => {
        adr(10, { superseded_by: '20' });
        adr(20, { supersedes: 'ADR-10 (§ 2 only)' });
        const out = read();
        expect(sup(out)).toEqual(['decision:ADR-20>decision:ADR-10']);
        // The newer record's own statement is the witness.
        expect(out.relations[0]?.witness.file).toBe('docs/decisions/ADR-020-record-20.md');
    });

    it('drops a link to a record that does not exist and says which', () => {
        adr(10, { superseded_by: 'ADR-99' });
        const out = read();
        expect(sup(out)).toEqual([]);
        expect(out.skipped.map((s) => s.reason)).toEqual(['supersedes link to missing ADR-99']);
    });

    it('parses lists, bare numbers, qualifiers with commas and the none markers', () => {
        expect(parseAdrRefs('ADR-268, ADR-118')).toEqual([{ number: 268, partial: false }, { number: 118, partial: false }]);
        expect(parseAdrRefs('206')).toEqual([{ number: 206, partial: false }]);
        expect(parseAdrRefs('ADR-255 (§ 4, § 5 only), ADR-239')).toEqual([{ number: 255, partial: true }, { number: 239, partial: false }]);
        for (const none of ['—', '-', 'none', '']) expect(parseAdrRefs(none)).toEqual([]);
    });
});

describe('readDecisions — governs', () => {
    it('links a record to a file named by a unique path-qualified mention', () => {
        write('src/lib/store.ts', '');
        const rec = adr(30, {}, 'The store lives in `src/lib/store.ts:12`.');
        const out = read();
        const g = out.relations.filter((r) => r.relation === 'governs');
        expect(g).toHaveLength(1);
        expect(g[0]).toMatchObject({ from: decisionId(30), to: 'src/lib/store.ts', guess: false });
        expect(g[0]?.witness).toEqual({ file: rec, line: 11, hash: spanHash('The store lives in `src/lib/store.ts:12`.') });
    });

    it('resolves a partial path when exactly one file ends in it', () => {
        write('packages/api/src/lib/store.ts', '');
        adr(31, {}, 'See lib/store.ts.');
        expect(read().relations.find((r) => r.relation === 'governs')?.to).toBe('packages/api/src/lib/store.ts');
    });

    it('drops and counts an ambiguous mention, an unresolved one and a bare file name', () => {
        write('a/lib/store.ts', '');
        write('b/lib/store.ts', '');
        adr(32, {}, 'lib/store.ts and gone/file.ts and store.ts and https://example.com/x/y.html');
        const out = read();
        expect(out.relations.filter((r) => r.relation === 'governs')).toEqual([]);
        expect(out.dropped).toEqual({ ambiguous: 1, unresolved: 1 });
    });

    it('does not count a mention of itself or another record as governance', () => {
        adr(33, {});
        adr(34, {}, 'Amends docs/decisions/ADR-033-record-33.md and docs/decisions/ADR-034-record-34.md');
        expect(read().relations.filter((r) => r.relation === 'governs')).toEqual([]);
    });
});

describe('pathMentions', () => {
    it('needs a slash and an extension, strips line suffixes, punctuation and URLs', () => {
        expect(pathMentions('see `src/a/b.ts:40`, docs/x.md. and src/dir/ and http://h.io/p/q.js')).toEqual(['src/a/b.ts', 'docs/x.md']);
    });
});
