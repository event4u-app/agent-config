/**
 * Two head-level checks of the web-launch gate, kept beside it so the gate stays
 * inside its source-size budget. Both read tags through the shared attribute
 * reader, so attribute order, quoting and case never change a verdict.
 */
import { HEAD_TAGS, attr, tagsOf } from './_lib/html_tags.js';
import type { Located, SourceFile } from './check_web_launch_readiness.js';

const isPage = (f: SourceFile): boolean => /\.html?$/i.test(f.base);

/** First line containing `needle`, 1-indexed; 1 when absent. */
function lineOf(f: SourceFile, needle: string): number {
    const i = f.lines.findIndex((l) => l.toLowerCase().includes(needle.toLowerCase()));
    return i < 0 ? 1 : i + 1;
}

/**
 * Canonical and sitemap agree with each other.
 *
 * Two failure shapes, and the second is the one a presence check misses: a
 * canonical pointing at a host the sitemap never mentions means one of the two
 * was copied from another project, and the page that ends up indexed is not the
 * page anyone chose.
 */
export const canonicalAndSitemap = (files: readonly SourceFile[]): Located[] => {
    const hits: Located[] = [];
    const sitemap = files.find((f) => f.base === 'sitemap.xml');
    const sitemapHosts = new Set<string>();
    for (const m of sitemap?.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) ?? []) {
        const u = absoluteUrl(m[1] ?? '');
        if (u !== null) sitemapHosts.add(u.host.toLowerCase());
    }
    for (const f of files) {
        if (!isPage(f)) continue;
        const canon = tagsOf(f.text, HEAD_TAGS).filter(
            (t) => t.closed && t.name === 'link' && (attr(t.tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'),
        );
        if (canon.length === 0) {
            hits.push({ file: f.rel, line: lineOf(f, '<head'), text: 'no rel="canonical"' });
            continue;
        }
        const hrefs = canon.map((t) => ({ href: (attr(t.tag, 'href') ?? '').trim(), line: t.line }));
        for (const h of hrefs) {
            if (absoluteUrl(h.href) === null) {
                hits.push({ file: f.rel, line: h.line, text: `relative canonical "${h.href}" — a canonical must be an absolute URL` });
            }
        }
        const distinct = [...new Set(hrefs.map((h) => h.href))];
        if (distinct.length > 1) {
            hits.push({
                file: f.rel,
                line: hrefs[1]?.line ?? 1,
                text: `conflicting canonicals on one page: ${distinct.join(', ')} — a search engine picks one, or ignores all`,
            });
        }
        if (sitemap === undefined) continue;
        for (const h of hrefs) {
            const u = absoluteUrl(h.href);
            if (u === null || sitemapHosts.has(u.host.toLowerCase())) continue;
            hits.push({ file: f.rel, line: h.line, text: `canonical host ${u.host} appears nowhere in sitemap.xml` });
        }
    }
    return hits;
};

/** An absolute http(s) URL, or null. Protocol-relative is not absolute for a canonical. */
function absoluteUrl(raw: string): URL | null {
    if (!/^https?:\/\//i.test(raw)) return null;
    try {
        return new URL(raw);
    } catch {
        return null;
    }
}

/** Every `<script type="application/ld+json">` parses as JSON. Whether its types are rich or right is not scored. */
export const structuredDataParses = (files: readonly SourceFile[]): Located[] => {
    const hits: Located[] = [];
    for (const f of files) {
        if (!isPage(f)) continue;
        const lower = f.text.toLowerCase();
        for (const t of tagsOf(f.text, ['script'])) {
            if (!t.closed || (attr(t.tag, 'type') ?? '').trim().toLowerCase() !== 'application/ld+json') continue;
            const close = lower.indexOf('</script', t.end + 1);
            const body = f.text.slice(t.end + 1, close < 0 ? undefined : close);
            try {
                JSON.parse(body);
            } catch (e) {
                hits.push({ file: f.rel, line: t.line, text: `JSON-LD does not parse: ${(e as Error).message.slice(0, 120)}` });
            }
        }
    }
    return hits;
};
