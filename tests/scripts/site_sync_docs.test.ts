import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

// @ts-expect-error — plain .mjs module of the isolated site workspace, no types
import * as sync from '../../site/sync-docs.mjs';

const GH = 'https://github.com/event4u-app/agent-config/blob/main';
const pages = sync.parseManifest({
    pages: [
        { src: 'proof.md', route: 'proof' },
        { src: 'guides/works-with-agent-switch.md', route: 'guides/agent-switch' },
    ],
});
const ctx = sync.makeContext(pages);

describe('site/sync-docs link classifier', () => {
    it('synced page → site route, fragment kept, relative to the source file', () => {
        expect(sync.classifyLink('proof.md#x', 'docs/CLAIMS.md', ctx)).toEqual({ kind: 'page', url: '/agent-config/proof/#x' });
        expect(sync.classifyLink('../proof.md', 'docs/guides/a.md', ctx)).toEqual({ kind: 'page', url: '/agent-config/proof/' });
        expect(sync.classifyLink('./works-with-agent-switch.md', 'docs/guides/a.md', ctx).url).toBe('/agent-config/guides/agent-switch/');
        expect(sync.classifyLink('../docs/proof.md', 'docs/CLAIMS.md', ctx).kind).toBe('page');
    });

    it('other docs/ file → GitHub blob under docs/', () => {
        expect(sync.classifyLink('guidelines/php/sql.md', 'docs/catalog.md', ctx)).toEqual({ kind: 'docs', url: `${GH}/docs/guidelines/php/sql.md` });
        expect(sync.classifyLink('../docs/second-brain-scope.md#a', 'docs/proof.md', ctx).url).toBe(`${GH}/docs/second-brain-scope.md#a`);
    });

    it('anything else in the repo → GitHub blob', () => {
        expect(sync.classifyLink('../src/scripts/check_claims.ts', 'docs/CLAIMS.md', ctx)).toEqual({ kind: 'repo', url: `${GH}/src/scripts/check_claims.ts` });
        expect(sync.classifyLink('/README.md', 'docs/guides/a.md', ctx).url).toBe(`${GH}/README.md`);
    });

    it('docs/media → the copied static asset', () => {
        expect(sync.classifyLink('media/proof-demo.gif', 'docs/proof.md', ctx)).toEqual({ kind: 'media', url: '/agent-config/media/proof-demo.gif' });
    });

    it('external and same-page anchors are left alone; a repo escape throws', () => {
        expect(sync.classifyLink('https://x.dev/a.md', 'docs/proof.md', ctx).kind).toBe('external');
        expect(sync.classifyLink('mailto:a@example.com', 'docs/proof.md', ctx).kind).toBe('external');
        expect(sync.classifyLink('#honest-null', 'docs/proof.md', ctx)).toEqual({ kind: 'anchor', url: '#honest-null' });
        expect(() => sync.classifyLink('../../outside.md', 'docs/proof.md', ctx)).toThrow(/escapes the repository/);
    });

    // The pre-manifest rewriter escaped only the first `.` of a source path, so a
    // dotted name could match a link it was never meant to.
    it('matches exact paths only (no first-dot-only escape)', () => {
        expect(sync.classifyLink('proofxmd', 'docs/a.md', ctx).kind).toBe('docs');
        expect(sync.classifyLink('proof.md.bak', 'docs/a.md', ctx).kind).toBe('docs');
    });
});

describe('site/sync-docs rewriting', () => {
    it('rewrites inline links, images, titles and reference definitions, but not code', () => {
        const src = [
            'See [proof](proof.md "t") and ![demo](media/d.gif).',
            '`[code](proof.md)` stays.',
            '```',
            '[fenced](proof.md)',
            '```',
            '[ref]: ../src/x.ts',
        ].join('\n');
        const out = sync.rewriteLinks(src, 'docs/CLAIMS.md', ctx);
        expect(out).toContain('[proof](/agent-config/proof/ "t")');
        expect(out).toContain('![demo](/agent-config/media/d.gif)');
        expect(out).toContain('`[code](proof.md)` stays.');
        expect(out).toContain('[fenced](proof.md)');
        expect(out).toContain(`[ref]: ${GH}/src/x.ts`);
        expect(sync.findRelativeMdLinks(out)).toEqual([]);
    });

    it('findRelativeMdLinks reports a surviving relative .md link', () => {
        expect(sync.findRelativeMdLinks('a [b](c.md#d) [e](https://f/g.md) [h](/i.md)')).toEqual(['c.md#d']);
    });
});

describe('site/sync-docs native pages', () => {
    const source = '<!-- generated -->\n\n# Proof — `verify` it\n\n> lead quote\n\nThe first **real** paragraph\ncontinues [here](CLAIMS.md).\n\n## Next\n';

    it('takes the first H1 as title and strips it from the body', () => {
        const { title, body } = sync.extractTitle(source);
        expect(title).toBe('Proof — verify it');
        expect(body).not.toMatch(/^# /m);
    });

    it('takes the first paragraph as description; a lead blockquote wins only before the next heading', () => {
        expect(sync.extractDescription(source)).toBe('The first real paragraph continues here.');
        expect(sync.extractDescription('> only a quote\n\n## H\n\nlater prose\n')).toBe('only a quote');
        expect(sync.extractDescription('x '.repeat(200), 40).length).toBeLessThanOrEqual(40);
    });

    it('renders slug, editUrl, description and the generated aside', () => {
        const page = sync.renderPage(pages[1], '# Works\n\nIntro [p](../proof.md).\n', ctx);
        expect(page).toContain('title: "Works"');
        expect(page).toContain('slug: "guides/agent-switch"');
        expect(page).toContain('editUrl: "https://github.com/event4u-app/agent-config/edit/main/docs/guides/works-with-agent-switch.md"');
        expect(page).toContain('description: "Intro p."');
        expect(page).toMatch(/:::note\[Generated page\]\nGenerated from \[`docs\/guides\/works-with-agent-switch.md`\]/);
        expect(page).toContain('[p](/agent-config/proof/)');
        expect(page).toContain('by site/sync-docs.mjs');
    });

    it('fails a page without any title', () => {
        expect(() => sync.renderPage(pages[0], 'no heading\n', ctx)).toThrow(/no H1/);
    });
});

describe('site/docs-manifest.json', () => {
    it('rejects malformed entries', () => {
        expect(() => sync.parseManifest({ pages: [{ src: 'a.txt', route: 'a' }] })).toThrow(/src/);
        expect(() => sync.parseManifest({ pages: [{ src: 'a.md', route: 'A/B' }] })).toThrow(/route/);
        expect(() => sync.parseManifest({ pages: [{ src: '../x.md', route: 'x' }] })).toThrow(/inside docs/);
        expect(() => sync.parseManifest({ pages: [{ src: 'a.md', route: 'a' }, { src: 'b.md', route: 'a' }] })).toThrow(/duplicate route/);
    });

    it('the committed manifest is valid and every source exists', () => {
        const root = path.resolve(__dirname, '..', '..');
        const committed = sync.parseManifest(fs.readFileSync(path.join(root, 'site', 'docs-manifest.json'), 'utf8'));
        expect(committed.length).toBeGreaterThan(0);
        for (const p of committed) expect(fs.existsSync(path.join(root, 'docs', p.src)), p.src).toBe(true);
    });
});

describe('site/sync-docs media copy', () => {
    it('copies media in subfolders, so docs/media/<dir>/x is served at /media/<dir>/x', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-media-'));
        const src = path.join(tmp, 'src');
        const out = path.join(tmp, 'out');
        fs.mkdirSync(path.join(src, 'code-map'), { recursive: true });
        fs.writeFileSync(path.join(src, 'top.gif'), 'a');
        fs.writeFileSync(path.join(src, 'code-map', 'demo.webp'), 'b');
        expect(sync.syncMedia(src, out)).toBe(2);
        expect(fs.readFileSync(path.join(out, 'top.gif'), 'utf8')).toBe('a');
        expect(fs.readFileSync(path.join(out, 'code-map', 'demo.webp'), 'utf8')).toBe('b');
        fs.rmSync(tmp, { recursive: true, force: true });
    });
});
