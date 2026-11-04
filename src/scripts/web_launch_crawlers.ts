/**
 * Indexability, read by meaning: robots meta tags through the shared attribute
 * reader, `robots.txt` as user-agent groups, and crawler names through a dated
 * register of what each operator says its crawler is for.
 *
 * The verdict this module feeds is `staging-noindex-leftover`. A blanket block
 * is a staging leftover when it hides the site from search: for `*`, or for a
 * crawler whose operator documents that blocking it removes the site from
 * search results. A block on a training, ads or user-fetch crawler is a
 * deliberate opt-out and is never that finding. A crawler the register does not
 * know is not judged; a row past `review_by` reads `unknown`, never live.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { HEAD_TAGS, attr, tagsOf } from './_lib/html_tags.js';

export const CRAWLER_REGISTER_REL = 'src/config/crawler-register.json';

export type CrawlerPurpose = 'search' | 'training' | 'user-fetch' | 'ads';
export const CRAWLER_PURPOSES: readonly CrawlerPurpose[] = ['search', 'training', 'user-fetch', 'ads'];

export interface CrawlerRow {
    token: string;
    operator: string;
    purpose: CrawlerPurpose;
    affects_search_inclusion: boolean;
    /** Operator documentation stating the purpose. */
    source: string;
    checked_at: string;
    review_by: string;
    /** A robots meta `name` the operator documents for this crawler. */
    meta_name?: string;
    meta_source?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https:\/\/[^\s/]+\.[^\s/]+\//;

/** Schema violations of a register's rows (empty = valid). Lapsed dates are NOT violations. */
export function crawlerRowViolations(rows: readonly Partial<CrawlerRow>[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
        const id = `row ${String(i)} (${r.token ?? '?'})`;
        if (typeof r.token !== 'string' || r.token.trim() === '') out.push(`${id}: no token`);
        else if (seen.has(r.token.toLowerCase())) out.push(`${id}: duplicate token`);
        else seen.add(r.token.toLowerCase());
        if (typeof r.operator !== 'string' || r.operator.trim() === '') out.push(`${id}: no operator`);
        if (!CRAWLER_PURPOSES.includes(r.purpose as CrawlerPurpose)) out.push(`${id}: purpose "${String(r.purpose)}" is not one of ${CRAWLER_PURPOSES.join(', ')}`);
        if (typeof r.affects_search_inclusion !== 'boolean') out.push(`${id}: affects_search_inclusion is not a boolean`);
        if (r.affects_search_inclusion === true && r.purpose !== 'search') out.push(`${id}: only a search crawler can affect search inclusion`);
        if (typeof r.source !== 'string' || !URL_RE.test(r.source)) out.push(`${id}: no https source URL — a row enters with the operator page that states its purpose`);
        for (const k of ['checked_at', 'review_by'] as const) {
            const v = r[k];
            if (typeof v !== 'string' || !ISO.test(v) || Number.isNaN(Date.parse(v))) out.push(`${id}: ${k} is not a YYYY-MM-DD date`);
        }
        if (typeof r.checked_at === 'string' && typeof r.review_by === 'string' && r.review_by <= r.checked_at) {
            out.push(`${id}: review_by is not after checked_at`);
        }
        if (r.meta_name !== undefined && (typeof r.meta_source !== 'string' || !URL_RE.test(r.meta_source))) {
            out.push(`${id}: meta_name without a meta_source URL`);
        }
    });
    return out;
}

/** The register at `root`. Throws on a missing file or a schema violation — a broken register is a dead scope. */
export function loadCrawlerRegister(root: string): CrawlerRow[] {
    const abs = path.join(root, CRAWLER_REGISTER_REL);
    let doc: { rows?: Partial<CrawlerRow>[] };
    try {
        doc = JSON.parse(fs.readFileSync(abs, 'utf-8')) as { rows?: Partial<CrawlerRow>[] };
    } catch (e) {
        throw new Error(`${CRAWLER_REGISTER_REL} is missing or unreadable (${(e as Error).message})`);
    }
    const rows = doc.rows ?? [];
    const bad = crawlerRowViolations(rows);
    if (rows.length === 0) bad.push('the register carries no rows');
    if (bad.length > 0) throw new Error(`${CRAWLER_REGISTER_REL}:\n  - ${bad.join('\n  - ')}`);
    return rows as CrawlerRow[];
}

export type CrawlerState = 'live' | 'lapsed';
export const rowState = (r: CrawlerRow, asOf: string): CrawlerState => (r.review_by < asOf ? 'lapsed' : 'live');

export interface IndexHit {
    file: string;
    line: number;
    text: string;
}

export interface Indexability {
    /** Blocks that hide the site from search. */
    hits: IndexHit[];
    /** Blocks resting on a register row past its `review_by`. */
    undecided: IndexHit[];
}

/** Tokens of a robots `content` value, lowercased: `noindex, nofollow` → [noindex, nofollow]. */
const directives = (content: string): string[] =>
    content
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((t) => t.length > 0);

const isNoindex = (content: string): boolean => directives(content).some((t) => t === 'noindex' || t === 'none');

/**
 * Robots meta tags that remove a page from search: `name` is `robots` or a
 * search crawler's documented meta name, `content` carries `noindex` or `none`.
 */
export function metaNoindex(file: string, text: string, register: readonly CrawlerRow[], asOf: string): Indexability {
    const byName = new Map<string, CrawlerRow>();
    for (const r of register) if (r.meta_name !== undefined && r.affects_search_inclusion) byName.set(r.meta_name.toLowerCase(), r);
    const out: Indexability = { hits: [], undecided: [] };
    for (const t of tagsOf(text, HEAD_TAGS)) {
        if (!t.closed || t.name !== 'meta') continue;
        const name = (attr(t.tag, 'name') ?? '').trim().toLowerCase();
        const content = attr(t.tag, 'content');
        if (content === undefined || !isNoindex(content)) continue;
        const hit = { file, line: t.line, text: t.tag.trim().slice(0, 160) };
        if (name === 'robots') {
            out.hits.push(hit);
            continue;
        }
        const row = byName.get(name);
        if (row === undefined) continue;
        if (rowState(row, asOf) === 'live') out.hits.push(hit);
        else out.undecided.push({ ...hit, text: lapsedText(row, asOf, hit.text) });
    }
    return out;
}

interface SearchMeta {
    line: number;
    tag: string;
    tokens: string[];
    /** The register row behind the meta name; `null` for `robots`, which no row governs. */
    row: CrawlerRow | null;
}

/** Robots meta tags addressed to search: `robots`, or a search crawler's documented meta name, live or lapsed. */
function searchMetaDirectives(text: string, register: readonly CrawlerRow[]): SearchMeta[] {
    const byName = new Map<string, CrawlerRow | null>([['robots', null]]);
    for (const r of register) if (r.meta_name !== undefined && r.affects_search_inclusion) byName.set(r.meta_name.toLowerCase(), r);
    const out: SearchMeta[] = [];
    for (const t of tagsOf(text, HEAD_TAGS)) {
        if (!t.closed || t.name !== 'meta') continue;
        const row = byName.get((attr(t.tag, 'name') ?? '').trim().toLowerCase());
        if (row === undefined) continue;
        out.push({ line: t.line, tag: t.tag.trim().slice(0, 160), tokens: directives(attr(t.tag, 'content') ?? ''), row });
    }
    return out;
}

/**
 * `nosnippet` or `max-snippet:0` on a page search may index. A page that is
 * `noindex` is not indexable to begin with, and that is a different finding.
 * A directive resting on a lapsed register row reads `undecided`, exactly as
 * `metaNoindex` does — and so does a snippet block on a page whose only
 * `noindex` rests on one, since whether that page is indexable is unknown.
 */
export function snippetBlocks(file: string, text: string, register: readonly CrawlerRow[], asOf: string): Indexability {
    const out: Indexability = { hits: [], undecided: [] };
    const lapsed = (m: SearchMeta): m is SearchMeta & { row: CrawlerRow } => m.row !== null && rowState(m.row, asOf) === 'lapsed';
    const metas = searchMetaDirectives(text, register);
    const noindex = metas.filter((m) => m.tokens.some((t) => t === 'noindex' || t === 'none'));
    if (noindex.some((m) => !lapsed(m))) return out;
    for (const m of metas) {
        if (!m.tokens.some((t) => t === 'nosnippet' || /^max-snippet:\s*0$/.test(t))) continue;
        const hit = { file, line: m.line, text: m.tag };
        const doubt = lapsed(m) ? m : noindex.find(lapsed);
        if (doubt === undefined) out.hits.push(hit);
        else out.undecided.push({ ...hit, text: lapsedText(doubt.row, asOf, hit.text) });
    }
    return out;
}

export interface RobotsGroup {
    /** User-agent tokens, as written. */
    agents: string[];
    rules: { kind: 'allow' | 'disallow'; path: string; line: number }[];
}

/** `robots.txt` as groups: consecutive `User-agent` lines open a group, rules follow it. */
export function robotsGroups(text: string): RobotsGroup[] {
    const groups: RobotsGroup[] = [];
    let current: RobotsGroup | null = null;
    text.split('\n').forEach((raw, i) => {
        const line = raw.replace(/#.*$/, '').trim();
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
        if (m === null) return;
        const key = (m[1] ?? '').toLowerCase();
        const value = (m[2] ?? '').trim();
        if (key === 'user-agent') {
            if (current === null || current.rules.length > 0) {
                current = { agents: [], rules: [] };
                groups.push(current);
            }
            current.agents.push(value);
            return;
        }
        if ((key === 'allow' || key === 'disallow') && current !== null) {
            current.rules.push({ kind: key, path: value, line: i + 1 });
        }
    });
    return groups;
}

/** Blanket `Disallow: /` groups in a `robots.txt`, judged by who they block. */
export function robotsBlocks(file: string, text: string, register: readonly CrawlerRow[], asOf: string): Indexability {
    const byToken = new Map(register.map((r) => [r.token.toLowerCase(), r] as const));
    const out: Indexability = { hits: [], undecided: [] };
    for (const g of robotsGroups(text)) {
        const block = g.rules.find((r) => r.kind === 'disallow' && r.path === '/');
        if (block === undefined) continue;
        if (g.rules.some((r) => r.kind === 'allow' && r.path === '/')) continue;
        const hit = { file, line: block.line, text: `Disallow: / for ${g.agents.join(', ')}` };
        const rows = g.agents.map((a) => byToken.get(a.toLowerCase()));
        const search = rows.filter((r): r is CrawlerRow => r !== undefined && r.affects_search_inclusion);
        if (g.agents.includes('*') || search.some((r) => rowState(r, asOf) === 'live')) {
            out.hits.push(hit);
            continue;
        }
        const lapsed = rows.filter((r): r is CrawlerRow => r !== undefined && rowState(r, asOf) === 'lapsed');
        if (lapsed.length > 0) out.undecided.push({ ...hit, text: lapsedText(lapsed[0] as CrawlerRow, asOf, hit.text) });
    }
    return out;
}

function lapsedText(r: CrawlerRow, asOf: string, what: string): string {
    return (
        `${what} — the register row for ${r.token} lapsed on ${r.review_by} (as of ${asOf}), so whether this ` +
        `block hides the site from search is unknown. Re-read ${r.source}, then move the row's review_by.`
    );
}

const XROBOTS_RE = /x-robots-tag[^\n]*\b(noindex|none)\b/i;

/** Every indexability leftover in a set of files. `robots.txt` is read as groups, every other file for meta tags and headers. */
export function indexability(
    files: readonly { rel: string; base: string; text: string; lines: string[] }[],
    register: readonly CrawlerRow[],
    asOf: string,
): Indexability {
    const out: Indexability = { hits: [], undecided: [] };
    for (const f of files) {
        const part =
            f.base === 'robots.txt' ? robotsBlocks(f.rel, f.text, register, asOf) : metaNoindex(f.rel, f.text, register, asOf);
        out.hits.push(...part.hits);
        out.undecided.push(...part.undecided);
        if (f.base === 'robots.txt') continue;
        f.lines.forEach((line, i) => {
            if (XROBOTS_RE.test(line) && !/<meta\b/i.test(line)) out.hits.push({ file: f.rel, line: i + 1, text: line.trim().slice(0, 160) });
        });
    }
    out.hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    return out;
}
