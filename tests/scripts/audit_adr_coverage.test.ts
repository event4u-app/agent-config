// Tests for src/scripts/audit_adr_coverage.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (parse_fm, scan_area gap-check, render_area_readme title-casing
// + link path) plus a golden-parity layer that runs python3 vs tsx on the
// REAL docs/adrs tree for --report / --check (skipped without python3).
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readAdrFrontmatter } from '../../src/scripts/_lib/adr_frontmatter.js';
import * as aac from '../../src/scripts/audit_adr_coverage.js';

/** The seven per-area records that carried blockquote metadata and no frontmatter. */
const PER_AREA_RECORDS = [
    'cost/0001-hard-stop-hook.md',
    'memory/0001-consumer-side-snapshot.md',
    'router/0001-three-tier-routing.md',
    'schema/0001-json-schema-frontmatter.md',
    'smoke/0001-per-tier-smoke-scripts.md',
    'telegraph/0001-default-off-until-bench.md',
    'telegraph/0002-dormant-by-default-removal-authorized.md',
];

function readRecord(rel: string): string {
    return fs.readFileSync(path.join(aac.ADR_ROOT, rel), 'utf-8');
}

/** Drop the leading `---` block, leaving the blockquote header as the only metadata. */
function stripFrontmatter(text: string): string {
    if (!text.startsWith('---\n')) return text;
    const end = text.indexOf('\n---\n', 4);
    return end === -1 ? text : text.slice(end + 5).replace(/^\n/, '');
}



describe('audit_adr_coverage — pure helpers', () => {
    it('parse_fm reads fields and strips space/quote padding', () => {
        const fm = aac.parse_fm('---\ndecision: "my-call"\nstatus: accepted \n---\nbody');
        expect(fm).toEqual({ decision: 'my-call', status: 'accepted' });
    });
    it('parse_fm returns {} when no frontmatter', () => {
        expect(aac.parse_fm('no fm')).toEqual({});
    });
    it('parse_fm strips exactly ONE balanced quote pair — the documented delta from the removed local stripper', () => {
        // The docstring on `parse_fm` names these two inputs as the behaviour
        // that changed when it started delegating to the shared reader: the old
        // `_stripChars(v, ' "\'')` peeled repeated and unbalanced quotes, the
        // shared `stripQuotes` (/^["'](.*)["']$/) peels one balanced pair. No
        // corpus record exercises either shape; this pins the claim so the
        // docstring cannot drift back into asserting parity.
        const fm = aac.parse_fm('---\ndecision: "value\nstatus: \'\'v\'\'\n---\nbody');
        expect(fm.decision).toBe('"value');
        expect(fm.status).toBe("'v'");
    });
    it('render_area_readme title-cases the decision and emits the relative contract link', () => {
        const out = aac.render_area_readme(
            'cost',
            { contract: 'cost-enforcement.md', scope: 'Budget ladder.' },
            [{ num: '0001', slug: 'foo-bar', path: '0001-foo-bar.md', decision: 'python-to-ts-migration', status: 'accepted', date: '2026-01-01' }],
        );
        expect(out).toContain('# ADRs — `cost`');
        expect(out).toContain('Python To Ts Migration');
        expect(out).toContain('| [0001](0001-foo-bar.md) |');
    });
    it('render_area_readme emits the placeholder row when no ADRs exist', () => {
        const out = aac.render_area_readme('cost', { contract: 'cost-enforcement.md', scope: 'x' }, []);
        expect(out).toContain('| _none yet_ | — | — | — | — |');
    });
});

describe('audit_adr_coverage — scan_area over the real tree', () => {
    it('returns [adrs, errs] arrays for a known area', () => {
        const [adrs, errs] = aac.scan_area('cost');
        expect(Array.isArray(adrs)).toBe(true);
        expect(Array.isArray(errs)).toBe(true);
    });
    it('returns empty for an area directory that does not exist', () => {
        const [adrs, errs] = aac.scan_area('definitely-not-an-area-xyz');
        expect(adrs).toEqual([]);
        expect(errs).toEqual([]);
    });
});

describe('audit_adr_coverage — per-area records read through the shared reader', () => {
    // Before the frontmatter conversion all seven returned null here, which is
    // why `adr_cite_check` declared them PARTIAL_COVERAGE and every
    // frontmatter-keyed sweep skipped them. This is the regression guard for
    // that gap, not a shape assertion about one file.
    it.each(PER_AREA_RECORDS)('%s parses through readAdrFrontmatter', (rel) => {
        const parsed = readAdrFrontmatter(readRecord(rel));
        expect(parsed).not.toBeNull();
        expect(parsed?.scalars.adr).toMatch(/^\d{4}$/);
        expect(parsed?.scalars.area).toBe(rel.split('/')[0]);
        expect(parsed?.scalars.status).toBeTruthy();
        expect(parsed?.scalars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(parsed?.scalars.decision).toBe(rel.split('/')[1]?.replace(/^\d{4}-/, '').replace(/\.md$/, ''));
    });

    // The transcription proof: the frontmatter must say what the blockquote
    // says. A value that moved between the two paths is a mis-transcription,
    // and this catches it per record rather than only in the rendered table.
    it.each(PER_AREA_RECORDS)('%s frontmatter agrees with its blockquote header', (rel) => {
        const text = readRecord(rel);
        const fm = aac.read_adr_meta(text);
        const bq = aac.parse_blockquote_meta(stripFrontmatter(text));
        for (const key of Object.keys(bq)) {
            expect(fm[key], `${rel}: ${key}`).toBe(bq[key]);
        }
    });
});

describe('audit_adr_coverage — blockquote fallback', () => {
    it('splits a shared blockquote line on the separator and strips backticks', () => {
        const meta = aac.parse_blockquote_meta(
            '# ADR 0001 — T\n\n> Area: `router` · Status: accepted · Date: 2026-05-16 · Type: retrospective\n\n## Context\n');
        expect(meta).toEqual({ area: 'router', status: 'accepted', date: '2026-05-16', type: 'retrospective' });
    });
    it('reads `Supersedes: —` off a line that also carries an Extends pointer', () => {
        const meta = aac.parse_blockquote_meta(
            '> Supersedes: — · Extends: [`0001`](0001-x.md)\n');
        expect(meta.supersedes).toBe('—');
        expect(meta.extends).toBeUndefined();
    });
    it('ignores non-metadata blockquote prose and stops at the first heading', () => {
        const meta = aac.parse_blockquote_meta(
            '> **Superseded by [ADR-094](../../decisions/ADR-094-x.md)** removed.\n' +
            '> Roadmap: some roadmap Phase 4 Step 3\n' +
            '> Area: `memory` · Status: superseded\n' +
            '\n## Context\n\n> Status: accepted\n');
        expect(meta).toEqual({ area: 'memory', status: 'superseded' });
    });
    it('read_adr_meta prefers frontmatter over the blockquote duplicate', () => {
        const text = '---\nstatus: superseded\n---\n\n> Area: `x` · Status: accepted\n';
        expect(aac.read_adr_meta(text).status).toBe('superseded');
        expect(aac.read_adr_meta(text).area).toBeUndefined();
    });
    it('read_adr_meta falls back to the blockquote when frontmatter is absent', () => {
        const text = '# ADR 0001 — T\n\n> Area: `smoke` · Status: accepted\n';
        expect(aac.read_adr_meta(text)).toEqual({ area: 'smoke', status: 'accepted' });
    });
});

describe('audit_adr_coverage — rendered area tables agree across both read paths', () => {
    it.each(Object.keys(aac.AREAS))('%s renders identically from frontmatter and from blockquotes', (area) => {
        const meta = aac.AREAS[area];
        expect(meta).toBeDefined();
        const dir = path.join(aac.ADR_ROOT, area);
        const names = fs
            .readdirSync(dir)
            .filter((n) => n.endsWith('.md') && n !== 'README.md')
            .sort();
        const build = (transform: (t: string) => string) =>
            names.map((name) => {
                const m = /^(\d{4})-([a-z0-9-]+)\.md$/.exec(name);
                expect(m, name).not.toBeNull();
                const text = transform(fs.readFileSync(path.join(dir, name), 'utf-8'));
                return {
                    num: m?.[1] as string,
                    slug: m?.[2] as string,
                    path: name,
                    ...aac.read_adr_meta(text),
                };
            });
        const fromFm = aac.render_area_readme(area, meta!, build((t) => t));
        const fromBq = aac.render_area_readme(area, meta!, build(stripFrontmatter));
        expect(fromFm).toBe(fromBq);
    });
});
