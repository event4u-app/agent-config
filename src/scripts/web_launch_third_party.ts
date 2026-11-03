/**
 * The four outward rows of `check_web_launch_readiness`
 * (road-to-a-page-that-says-what-it-loads Phase 2): what a consumer build loads
 * from a third party, which superseded statute its imprint cites, which template
 * placeholder its legal pages still carry, and which loaded provider its privacy
 * page does not name.
 *
 * Every message states a technical fact — a load, a request, a citation, an
 * absence — and never a legal conclusion. The closed vocabulary is enforced by
 * `tests/scripts/web_launch_third_party_wording.test.ts`, because
 * `legal-safety-floor` is pack-gated and does not fire on a web audit.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const REGISTER_REL = 'src/config/third-party-origins.json';

export interface FileLike {
    rel: string;
    base: string;
    text: string;
    lines: string[];
}

export interface Hit {
    file: string;
    line: number;
    text: string;
}

export interface OriginRow {
    host: string;
    path_prefix?: string;
    provider: string;
    category: string;
    privacy_tokens: string[];
    evidence: string;
    review_by: string;
}

export interface Supersession {
    id: string;
    /** Regex source matching a citation of the superseded provision. */
    pattern: string;
    cites: string;
    replaced_by: string;
    effective: string;
    why: string;
    authority: string;
    review_by: string;
}

export interface ThirdPartyCtx {
    register: readonly OriginRow[];
    supersessions: readonly Supersession[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Load the register; a lapsed or malformed `review_by` is an error, not a warning. */
export function loadRegister(root: string, asOf: string): OriginRow[] {
    const doc = JSON.parse(fs.readFileSync(path.join(root, REGISTER_REL), 'utf-8')) as {
        origins?: OriginRow[];
    };
    const rows = doc.origins ?? [];
    const bad: string[] = [];
    for (const r of rows) {
        if (!ISO.test(r.review_by ?? '')) bad.push(`${r.host}: review_by "${r.review_by}" is not YYYY-MM-DD`);
        else if (r.review_by < asOf) bad.push(`${r.host}: review_by lapsed on ${r.review_by} (as of ${asOf})`);
        if ((r.privacy_tokens ?? []).length === 0) bad.push(`${r.host}: no privacy_tokens`);
        if ((r.evidence ?? '').trim() === '') bad.push(`${r.host}: no evidence — a row enters with the defect that evidences it`);
    }
    if (bad.length > 0) throw new Error(`${REGISTER_REL}:\n  - ${bad.join('\n  - ')}`);
    return rows;
}

const isPage = (f: FileLike): boolean => /\.html?$/i.test(f.base);
const isCss = (f: FileLike): boolean => /\.css$/i.test(f.base);

/**
 * Loadable contexts only. An anchor is followed by the visitor, prose is not
 * markup, and a `dns-prefetch` hint resolves a name without contacting the
 * provider — it is reported undecided, never as a load.
 *
 * Tags are found over the WHOLE file text, not per line, so a tag a formatter
 * wrapped over several lines and a minified one-line page are both read. A tag
 * runs to the first `>` after it, of any length, unless another tag start comes
 * first: then it is unclosed. Each character belongs to at most one tag, which
 * keeps the scan linear on a page of unterminated `<link`. An unclosed tag is
 * never dropped silently — the file is reported as carrying unread tags.
 */
const TAG_START_RE = /<(link|script|iframe|img|video|audio|source|embed)\b/gi;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^"')\s]+)/gi;
const CSS_URL_RE = /\burl\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi;
const LOAD_RELS = new Set(['stylesheet', 'preconnect', 'preload', 'modulepreload', 'icon']);

/** A file-level marker that a load may sit behind a consent or click-to-load gate. */
const GATE_RE = /(click-to-load|data-consent|consent|cookiebanner|cookie-banner|cookieconsent|klaro|usercentrics|borlabs|osano)/i;
/** A file-level marker that a lazy loader fetches `data-src` on viewport entry, without a click. */
const LAZY_RE = /(lazysizes|lazyload|lozad|IntersectionObserver)/i;

interface Load {
    file: string;
    line: number;
    url: URL;
    how: string;
}

function absolute(raw: string): URL | null {
    const s = raw.startsWith('//') ? `https:${raw}` : raw;
    if (!/^https?:\/\//i.test(s)) return null;
    try {
        return new URL(s);
    } catch {
        return null;
    }
}

/** The attribute itself — preceded by whitespace, so `data-src` is never read as `src`. */
const ATTR_RE = new Map<string, RegExp>();
function attr(tag: string, name: string): string | undefined {
    let re = ATTR_RE.get(name);
    if (re === undefined) {
        re = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i');
        ATTR_RE.set(name, re);
    }
    return re.exec(tag)?.[1];
}

interface Tag {
    name: string;
    /** Empty when the tag is unclosed. */
    tag: string;
    line: number;
    closed: boolean;
}

/** Every loadable tag of a page with the 1-based line it starts on. Linear: one window per tag start. */
export function tagsOf(text: string): Tag[] {
    const starts: number[] = [0];
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    const lineAt = (pos: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] ?? 0) <= pos) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const found = [...text.matchAll(TAG_START_RE)];
    const out: Tag[] = [];
    // The next `>` only moves forward, so all the searches together read the text once.
    let gt = -2;
    found.forEach((m, k) => {
        const at = m.index ?? 0;
        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
        const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
        const name = (m[1] ?? '').toLowerCase();
        const closed = gt !== -1 && gt < next;
        out.push({ name, tag: closed ? text.slice(at, gt + 1) : '', line: lineAt(at), closed });
    });
    return out;
}

/**
 * Hosts the build itself claims through rel="canonical" — absolute self-references,
 * not third parties. A registered provider's host is never one: the page that loads
 * a provider also writes its canonical, so trusting that claim would let one tag
 * silence the finding.
 */
function ownHosts(files: readonly FileLike[], register: readonly OriginRow[]): Set<string> {
    const providers = new Set(register.map((r) => r.host.toLowerCase()));
    const out = new Set<string>();
    for (const f of files.filter(isPage)) {
        for (const t of tagsOf(f.text)) {
            if (!t.closed || t.name !== 'link' || (attr(t.tag, 'rel') ?? '').toLowerCase() !== 'canonical') continue;
            const u = absolute(attr(t.tag, 'href') ?? '');
            if (u !== null && !providers.has(u.host.toLowerCase())) out.add(u.host.toLowerCase());
        }
    }
    return out;
}

interface Extracted {
    loads: Load[];
    prefetch: Hit[];
    /** One per page carrying loadable tags that never close. */
    unread: Hit[];
}

export function extractLoads(files: readonly FileLike[], register: readonly OriginRow[]): Extracted {
    const own = ownHosts(files, register);
    const loads: Load[] = [];
    const prefetch: Hit[] = [];
    const unread: Hit[] = [];
    const push = (f: FileLike, line: number, raw: string, how: string): void => {
        const url = absolute(raw);
        if (url === null || own.has(url.host.toLowerCase())) return;
        loads.push({ file: f.rel, line, url, how });
    };
    for (const f of files) {
        if (!isPage(f) && !isCss(f)) continue;
        if (isPage(f)) {
            const tags = tagsOf(f.text);
            const unclosed = tags.filter((t) => !t.closed);
            if (unclosed.length > 0) {
                const n = unclosed.length;
                unread.push({
                    file: f.rel,
                    line: unclosed[0]?.line ?? 1,
                    text:
                        `${String(n)} loadable tag${n === 1 ? '' : 's'} (link, script, iframe, img, video, audio, source, embed) ` +
                        `never close${n === 1 ? 's' : ''} before the next tag or the end of the file; whether ${n === 1 ? 'it loads' : 'they load'} is undecided.`,
                });
            }
            for (const t of tags) {
                if (!t.closed) continue;
                if (t.name !== 'link') {
                    // `data-src` only when no `src`: a load if a lazy loader fetches it, not a click.
                    const src = attr(t.tag, 'src');
                    const lazy = attr(t.tag, 'data-src');
                    if (src !== undefined) push(f, t.line, src, `<${t.name} src>`);
                    else if (lazy !== undefined) push(f, t.line, lazy, `<${t.name} data-src>`);
                    continue;
                }
                const rels = (attr(t.tag, 'rel') ?? '').toLowerCase().split(/\s+/);
                const href = attr(t.tag, 'href') ?? '';
                if (rels.includes('dns-prefetch')) {
                    const u = absolute(href);
                    if (u !== null && !own.has(u.host.toLowerCase())) {
                        prefetch.push({
                            file: f.rel,
                            line: t.line,
                            text: `dns-prefetch for \`${u.host}\` resolves a name without a request to the provider; whether a load follows is undecided.`,
                        });
                    }
                    continue;
                }
                const rel = rels.find((r) => LOAD_RELS.has(r));
                if (rel !== undefined) push(f, t.line, href, `<link rel="${rel}">`);
            }
        }
        // CSS rules, in a stylesheet or an inline <style> block of a page. Both
        // patterns start at a literal and hold no nested quantifier: linear.
        f.lines.forEach((line, i) => {
            for (const m of line.matchAll(CSS_IMPORT_RE)) push(f, i + 1, m[1] ?? '', 'CSS @import');
            if (!/@import/i.test(line)) {
                for (const m of line.matchAll(CSS_URL_RE)) push(f, i + 1, m[1] ?? '', 'CSS url()');
            }
        });
    }
    return { loads, prefetch, unread };
}

export function resolveOrigin(url: URL, register: readonly OriginRow[]): OriginRow | undefined {
    const host = url.host.toLowerCase();
    return register.find(
        (r) => r.host.toLowerCase() === host && (r.path_prefix === undefined || url.pathname.startsWith(r.path_prefix)),
    );
}

interface Classified {
    findings: Hit[];
    undecided: Hit[];
    /** The unread-tag subset of `undecided`: file-local, so write time reports it too. */
    unread: Hit[];
    loaded: Map<string, OriginRow>;
}

/** 2.1 — split the loads into findings and undecided, with the providers that load. */
export function classifyLoads(files: readonly FileLike[], register: readonly OriginRow[]): Classified {
    const { loads, prefetch, unread } = extractLoads(files, register);
    const gated = new Set(files.filter((f) => GATE_RE.test(f.text)).map((f) => f.rel));
    const lazy = new Set(files.filter((f) => LAZY_RE.test(f.text)).map((f) => f.rel));
    const findings: Hit[] = [];
    const undecided: Hit[] = [...prefetch, ...unread];
    const loaded = new Map<string, OriginRow>();
    for (const l of loads) {
        // Without a lazy loader in its file, a data-src waits for a click when a gate
        // is there, and for an unseen script otherwise.
        if (l.how.endsWith('data-src>') && !lazy.has(l.file)) {
            if (!gated.has(l.file)) undecided.push({ file: l.file, line: l.line, text: `${l.how} names \`${l.url.host}\`; no lazy loader or gate in its file, so a first-paint load is undecided.` });
            continue;
        }
        const row = resolveOrigin(l.url, register);
        if (row === undefined) {
            undecided.push({
                file: l.file,
                line: l.line,
                text: `${l.how} requests \`${l.url.host}\`, an unknown third party (not in ${REGISTER_REL}); its provider is undecided.`,
            });
            continue;
        }
        // Analytics ordering is `analytics-and-consent-wiring`'s question, and it
        // answers it with source order this row does not read. Reporting the same
        // tag here would make one script two findings. It still counts as LOADED
        // for privacy-page coverage unless a gate sits in its file.
        if (row.category === 'analytics') {
            if (!gated.has(l.file)) loaded.set(row.provider, row);
            continue;
        }
        if (gated.has(l.file)) {
            undecided.push({
                file: l.file,
                line: l.line,
                text:
                    `${l.how} loads \`${l.url.host}\` (${row.provider}) in a file that also carries a consent or ` +
                    'click-to-load mechanism; whether the request waits for it is undecided statically.',
            });
            continue;
        }
        loaded.set(row.provider, row);
        const extra = l.how === '<link rel="preconnect">' ? ' — a connection carrying the visitor IP opens before any request' : '';
        findings.push({
            file: l.file,
            line: l.line,
            text: `${l.how} loads \`${l.url.host}\` (${row.provider}, ${row.category}) on first paint, before any visitor interaction${extra}.`,
        });
    }
    return { findings, undecided, unread, loaded };
}

const IMPRINT_RE = /(impressum|imprint|legal-notice)/i;
const PRIVACY_RE = /(datenschutz|privacy)/i;
const legalPages = (files: readonly FileLike[], re: RegExp): FileLike[] =>
    files.filter((f) => isPage(f) && re.test(f.rel.replace(/\\/g, '/')));

/**
 * Visible text of a page: tags, scripts and styles removed, in one forward
 * pass. Not regex-based on purpose: `<[^>]+>` and a lazy script matcher are
 * quadratic on a page of unclosed `<`, which agent-written markup can be. An
 * unclosed tag, script or style swallows the rest of the input.
 */
export function visibleText(html: string): string {
    const lower = html.toLowerCase();
    let out = '';
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt < 0) {
            out += html.slice(i);
            break;
        }
        out += `${html.slice(i, lt)} `;
        const block = /^<(script|style)\b/.exec(lower.slice(lt, lt + 8));
        const end = block === null ? html.indexOf('>', lt) : lower.indexOf(`</${block[1] ?? ''}`, lt);
        if (end < 0) break;
        const close = block === null ? end : html.indexOf('>', end);
        if (close < 0) break;
        i = close + 1;
    }
    return out.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 2.2 — a located imprint citing a provision the supersession table marks replaced. */
export function supersededStatute(files: readonly FileLike[], table: readonly Supersession[]): Hit[] {
    const hits: Hit[] = [];
    const compiled = table.map((s) => [s, new RegExp(s.pattern, 'i')] as const);
    for (const f of legalPages(files, IMPRINT_RE)) {
        f.lines.forEach((line, i) => {
            const text = visibleText(line);
            for (const [s, re] of compiled) {
                if (!re.test(text)) continue;
                hits.push({
                    file: f.rel,
                    line: i + 1,
                    text: `cites ${s.cites}; superseded on ${s.effective} by ${s.replaced_by} (authority: ${s.authority.split(' -- ')[0]}).`,
                });
            }
        });
    }
    return hits;
}

/**
 * 2.3 — a bracketed template token left in a legal page. A bracket holding a
 * number (`[1]`) is a footnote; one holding a word is a slot nobody filled.
 */
const PLACEHOLDER_RE = /\[(?=[^\]\d]{0,40}[A-Za-zÄÖÜäöüß])[^\]\d]{2,40}\]|\blorem\s+ipsum\b/i;

export function legalPagePlaceholders(files: readonly FileLike[]): Hit[] {
    const hits: Hit[] = [];
    const pages = [...legalPages(files, IMPRINT_RE), ...legalPages(files, PRIVACY_RE)];
    for (const f of pages) {
        f.lines.forEach((line, i) => {
            const m = PLACEHOLDER_RE.exec(visibleText(line));
            if (m === null) return;
            hits.push({ file: f.rel, line: i + 1, text: `carries the template token \`${m[0]}\` where a value belongs.` });
        });
    }
    return hits;
}

/** Below this many characters of visible text, a privacy page is treated as rendered client-side. */
const MIN_PRIVACY_TEXT = 40;

export interface Coverage {
    findings: Hit[];
    undecided: Hit[];
}

/** 2.4 — every provider 2.1 found loading is named on the located privacy page. */
export function privacyCoverage(files: readonly FileLike[], register: readonly OriginRow[]): Coverage {
    const { loaded } = classifyLoads(files, register);
    if (loaded.size === 0) return { findings: [], undecided: [] };
    const pages = legalPages(files, PRIVACY_RE);
    // No privacy page at all is `required-legal-pages`'s finding; reporting it
    // again here as an undecided would make every such site exit 1 twice over.
    if (pages.length === 0) return { findings: [], undecided: [] };
    const text = pages.map((p) => visibleText(p.text)).join(' ');
    const where = pages[0]!;
    if (text.length < MIN_PRIVACY_TEXT) {
        return {
            findings: [],
            undecided: [{ file: where.rel, line: 1, text: 'the privacy page carries no readable text in the build (rendered client-side?); coverage is undecided.' }],
        };
    }
    const lower = text.toLowerCase();
    const anchor = Math.max(1, where.lines.findIndex((l) => /<h1\b/i.test(l)) + 1);
    const findings: Hit[] = [];
    for (const [provider, row] of loaded) {
        if (row.privacy_tokens.some((t) => lower.includes(t.toLowerCase()))) continue;
        findings.push({
            file: where.rel,
            line: anchor,
            text: `the build loads ${provider}; the privacy page found at \`${where.rel}\` does not name it.`,
        });
    }
    return { findings, undecided: [] };
}

/** Every message template the four rows can emit, for the wording test. */
export const MESSAGE_SAMPLES = (): string[] => {
    const row: OriginRow = {
        host: 'x.example',
        provider: 'P',
        category: 'font',
        privacy_tokens: ['P'],
        evidence: 'e',
        review_by: '2099-01-01',
    };
    const page = (rel: string, body: string): FileLike => ({ rel, base: path.basename(rel), text: body, lines: body.split('\n') });
    const files = [
        page('index.html', '<link rel="stylesheet" href="https://x.example/a.css">\n<link rel="preconnect" href="https://x.example">\n<link rel="dns-prefetch" href="https://y.example">\n<script src="https://z.example/a.js"></script>'),
        page('gated.html', '<iframe src="https://x.example/v"></iframe><div class="click-to-load"></div>'),
        page('impressum.html', '<p>Angaben gemäß § 5 TMG</p>\n<p>[Firmenname]</p>'),
        page('datenschutz.html', '<h1>Datenschutz</h1><p>' + 'Text '.repeat(20) + '</p>'),
    ];
    const table: Supersession[] = [
        { id: 's', pattern: 'TMG', cites: 'A', replaced_by: 'B', effective: '2024-05-14', why: '', authority: 'C', review_by: '2099-01-01' },
    ];
    const c = classifyLoads(files, [row]);
    const thin = privacyCoverage([files[0]!, page('datenschutz.html', '<h1>x</h1>')], [row]);
    return [
        ...c.findings,
        ...c.undecided,
        ...supersededStatute(files, table),
        ...legalPagePlaceholders(files),
        ...privacyCoverage(files, [row]).findings,
        ...thin.undecided,
    ].map((h) => h.text);
};

export interface WriteTimeHit extends Hit {
    check: 'third-party-load-in-markup' | 'third-party-load-unread' | 'superseded-statute-in-legal-page';
}

/**
 * The write-time half (road-to-a-page-that-says-what-it-loads 4.2): rows 2.1 and
 * 2.2 over ONE file the agent just wrote, for `design_pass_hook`. Findings, plus
 * unclosed loadable tags — the one undecided a single file settles; every other
 * undecided needs the whole build and is left to the checker.
 */
export function writeTimeFindings(
    rel: string,
    content: string,
    register: readonly OriginRow[],
    supersessions: readonly Supersession[],
): WriteTimeHit[] {
    if (!/\.(html?|css)$/i.test(rel)) return [];
    const file: FileLike = { rel, base: path.basename(rel), text: content, lines: content.split('\n') };
    return [
        ...((c) => [
            ...c.findings.map((h) => ({ ...h, check: 'third-party-load-in-markup' as const })),
            ...c.unread.map((h) => ({ ...h, check: 'third-party-load-unread' as const })),
        ])(classifyLoads([file], register)),
        ...supersededStatute([file], supersessions).map((h) => ({ ...h, check: 'superseded-statute-in-legal-page' as const })),
    ];
}
