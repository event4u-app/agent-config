/**
 * Ask the authorities, carry nothing (road-to-advisories-heard-the-same-day
 * Phase 2).
 *
 * Every adapter reports `ok | unavailable | error` — a timeout is never `ok`,
 * and "no findings" from a source that did not answer is never "no findings".
 * Every outbound request goes to a host on a fixed allowlist; no URL is built
 * from fetched content except an advisory ID that passed a strict shape check.
 * What leaves an adapter is IDs, versions, enums and numbers only — no advisory
 * prose — because the cache is the sanitising boundary (C3): nothing fetched
 * may reach model context as text.
 *
 * Transport and process execution are injected, so every adapter runs offline
 * against fixtures in tests.
 */

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

import type { Ecosystem, InventoryEntry } from './advisory_inventory.js';
import { compare_versions } from './version_order.js';

export type SourceName = 'native-npm' | 'native-composer' | 'osv' | 'lifecycle' | 'vendor-php' | 'vendor-node';
export type SourceStatus = 'ok' | 'unavailable' | 'error';

export interface SourceReport {
    source: SourceName;
    status: SourceStatus;
    /** A short machine reason (`timeout`, `http-503`, `private-names-present`), never fetched text. */
    reason: string | null;
}

export type FindingKind = 'vulnerability' | 'malware' | 'eol' | 'eol-soon' | 'pre-announced' | 'outdated';
export type Severity = 'low' | 'moderate' | 'high' | 'critical' | null;

/** One finding as a source reported it. IDs, versions, enums and numbers only. */
export interface RawFinding {
    id: string;
    aliases: string[];
    kind: FindingKind;
    ecosystem: Ecosystem;
    package: string;
    version: string | null;
    severity: Severity;
    /** CVSS base score when the source states one numerically. */
    score: number | null;
    /** Known exploited (CISA KEV) — only when a source asserts it. */
    kev: boolean;
    /** Smallest version that fixes it for this package, when known. */
    fixed: string | null;
    /** End of security support or announced release date (ISO day), for lifecycle and vendor findings. */
    date: string | null;
    source: SourceName;
    /** Source-side `modified` stamp, the key for corrected-advisory detection. */
    modified: string | null;
    file: string;
    line: number;
}

export interface FetchResponse {
    status: number;
    text: () => Promise<string>;
}
export type Fetcher = (url: string, init?: { method?: string; body?: string; timeoutMs?: number }) => Promise<FetchResponse>;
export type Runner = (cmd: string, args: string[], cwd: string, timeoutMs: number) => { code: number; stdout: string };

/** The only hosts any adapter may contact. */
export const ALLOWED_HOSTS = ['api.osv.dev', 'endoflife.date', 'www.php.net', 'nodejs.org'] as const;

/** A fetched advisory ID is used in a URL only after this shape check. */
const ID_SHAPE = /^[A-Z][A-Z0-9]*-[A-Za-z0-9._:-]{1,80}$/;

export function assertAllowed(url: string): void {
    const host = new URL(url).host;
    if (!(ALLOWED_HOSTS as readonly string[]).includes(host)) throw new Error(`host not allowed: ${host}`);
}

export const defaultFetcher: Fetcher = async (url, init = {}) => {
    assertAllowed(url);
    const res = await fetch(url, {
        method: init.method ?? 'GET',
        ...(init.body === undefined ? {} : { body: init.body, headers: { 'content-type': 'application/json' } }),
        signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
        redirect: 'error',
    });
    return { status: res.status, text: () => res.text() };
};

export const defaultRunner: Runner = (cmd, args, cwd, timeoutMs) => {
    try {
        const stdout = execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs });
        return { code: 0, stdout };
    } catch (e) {
        const err = e as { status?: number | null; stdout?: string };
        // `npm audit` and `composer audit` exit non-zero WHEN they find something;
        // their JSON is still on stdout and is the answer.
        return { code: typeof err.status === 'number' ? err.status : -1, stdout: typeof err.stdout === 'string' ? err.stdout : '' };
    }
};

function severityOf(v: unknown): Severity {
    const s = String(v ?? '').toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'moderate' || s === 'medium') return 'moderate';
    if (s === 'low') return 'low';
    return null;
}

function numberOrNull(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Native audits — the package managers' own answer
// ---------------------------------------------------------------------------

/**
 * `npm audit` and `composer audit` send the dependency names to the registry
 * they query. Run them only where every package in that lockfile is public, so
 * a private name never leaves the machine through a native audit either (D7).
 */
export function nativeAudits(
    root: string,
    entries: InventoryEntry[],
    run: Runner = defaultRunner,
): { findings: RawFinding[]; reports: SourceReport[] } {
    const findings: RawFinding[] = [];
    const reports: SourceReport[] = [];
    const byFile = new Map<string, InventoryEntry[]>();
    for (const e of entries) {
        if (e.provenance !== 'lockfile') continue;
        byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]);
    }
    for (const [file, list] of byFile) {
        const npm = path.basename(file) === 'package-lock.json';
        const source: SourceName = npm ? 'native-npm' : 'native-composer';
        if (list.some((e) => e.private)) {
            reports.push({ source, status: 'unavailable', reason: 'private-names-present' });
            continue;
        }
        const cwd = path.join(root, path.dirname(file));
        const r = npm
            ? run('npm', ['audit', '--json', '--package-lock-only'], cwd, 30000)
            : run('composer', ['audit', '--format=json', '--locked', '--no-interaction'], cwd, 30000);
        let doc: unknown;
        try {
            doc = JSON.parse(r.stdout);
        } catch {
            reports.push({ source, status: r.code === -1 ? 'unavailable' : 'error', reason: r.code === -1 ? 'not-installed' : 'unparseable' });
            continue;
        }
        const line = (name: string): number => list.find((e) => e.name === name)?.line ?? 1;
        const version = (name: string): string | null => list.find((e) => e.name === name)?.version ?? null;
        if (npm) {
            const vulns = (doc as { vulnerabilities?: Record<string, { via?: unknown[]; fixAvailable?: unknown }> }).vulnerabilities ?? {};
            for (const [name, v] of Object.entries(vulns)) {
                for (const via of v.via ?? []) {
                    if (typeof via !== 'object' || via === null) continue;
                    const o = via as { url?: string; severity?: string; cvss?: { score?: number } };
                    const ghsa = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.exec(o.url ?? '')?.[0];
                    if (ghsa === undefined) continue;
                    const fix = v.fixAvailable as { name?: string; version?: string } | boolean | undefined;
                    findings.push({
                        id: `GHSA-${ghsa.slice(5).toLowerCase()}`,
                        aliases: [],
                        kind: 'vulnerability',
                        ecosystem: 'npm',
                        package: name,
                        version: version(name),
                        severity: severityOf(o.severity),
                        score: numberOrNull(o.cvss?.score),
                        kev: false,
                        fixed: typeof fix === 'object' && fix?.name === name ? (fix.version ?? null) : null,
                        date: null,
                        source,
                        modified: null,
                        file,
                        line: line(name),
                    });
                }
            }
        } else {
            const adv = (doc as { advisories?: Record<string, Array<{ advisoryId?: string; cve?: string | null; severity?: string }>> }).advisories ?? {};
            for (const [name, list2] of Object.entries(adv)) {
                for (const a of list2) {
                    const id = String(a.advisoryId ?? '');
                    if (!ID_SHAPE.test(id)) continue;
                    findings.push({
                        id,
                        aliases: a.cve && ID_SHAPE.test(a.cve) ? [a.cve] : [],
                        kind: 'vulnerability',
                        ecosystem: 'Packagist',
                        package: name,
                        version: version(name),
                        severity: severityOf(a.severity),
                        score: null,
                        kev: false,
                        fixed: null,
                        date: null,
                        source,
                        modified: null,
                        file,
                        line: line(name),
                    });
                }
            }
        }
        reports.push({ source, status: 'ok', reason: null });
    }
    return { findings, reports };
}

// ---------------------------------------------------------------------------
// OSV — cross-ecosystem, public packages only
// ---------------------------------------------------------------------------

const OSV_ECOSYSTEMS: Partial<Record<Ecosystem, string>> = {
    npm: 'npm',
    Packagist: 'Packagist',
    'GitHub Actions': 'GitHub Actions',
};

interface OsvVuln {
    id?: string;
    aliases?: string[];
    modified?: string;
    database_specific?: { severity?: string };
    affected?: Array<{ package?: { name?: string; ecosystem?: string }; ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
}

/** Detail cache: an advisory is fetched again only when its `modified` stamp moved. */
export type OsvDetailCache = Map<string, { modified: string; vuln: OsvVuln }>;

export async function osvQuery(
    entries: InventoryEntry[],
    opts: { fetcher?: Fetcher | undefined; cache?: OsvDetailCache; timeoutMs?: number } = {},
): Promise<{ findings: RawFinding[]; report: SourceReport }> {
    const fetcher = opts.fetcher ?? defaultFetcher;
    const cache = opts.cache ?? new Map();
    // Private names never leave (1.3); entries without an exact version have nothing to query.
    const queryable = entries.filter((e) => !e.private && e.version !== null && OSV_ECOSYSTEMS[e.ecosystem] !== undefined);
    if (queryable.length === 0) return { findings: [], report: { source: 'osv', status: 'ok', reason: 'nothing-queryable' } };
    const findings: RawFinding[] = [];
    try {
        for (let i = 0; i < queryable.length; i += 1000) {
            const batch = queryable.slice(i, i + 1000);
            const body = JSON.stringify({
                queries: batch.map((e) => ({ package: { name: e.name, ecosystem: OSV_ECOSYSTEMS[e.ecosystem] }, version: e.version })),
            });
            const res = await fetcher('https://api.osv.dev/v1/querybatch', { method: 'POST', body, timeoutMs: opts.timeoutMs ?? 10000 });
            if (res.status !== 200) return { findings: [], report: { source: 'osv', status: 'error', reason: `http-${res.status}` } };
            const doc = JSON.parse(await res.text()) as { results?: Array<{ vulns?: Array<{ id?: string; modified?: string }> }> };
            const results = doc.results ?? [];
            for (let j = 0; j < batch.length; j++) {
                const entry = batch[j]!;
                for (const ref of results[j]?.vulns ?? []) {
                    const id = String(ref.id ?? '');
                    if (!ID_SHAPE.test(id)) continue;
                    const modified = String(ref.modified ?? '');
                    let vuln = cache.get(id)?.modified === modified ? cache.get(id)!.vuln : null;
                    if (vuln === null) {
                        const det = await fetcher(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { timeoutMs: opts.timeoutMs ?? 10000 });
                        if (det.status !== 200) continue;
                        vuln = JSON.parse(await det.text()) as OsvVuln;
                        cache.set(id, { modified, vuln });
                    }
                    findings.push({
                        id,
                        aliases: (vuln.aliases ?? []).filter((a: string) => ID_SHAPE.test(a)),
                        kind: id.startsWith('MAL-') ? 'malware' : 'vulnerability',
                        ecosystem: entry.ecosystem,
                        package: entry.name,
                        version: entry.version,
                        severity: severityOf(vuln.database_specific?.severity),
                        score: null,
                        kev: false,
                        fixed: smallestFix(vuln, entry),
                        date: null,
                        source: 'osv',
                        modified: modified === '' ? null : modified,
                        file: entry.file,
                        line: entry.line,
                    });
                }
            }
        }
        return { findings, report: { source: 'osv', status: 'ok', reason: null } };
    } catch (e) {
        return { findings: [], report: { source: 'osv', status: 'unavailable', reason: (e as Error).name === 'TimeoutError' ? 'timeout' : 'network' } };
    }
}

/** Smallest `fixed` event above the installed version, for this package only. */
function smallestFix(vuln: OsvVuln, entry: InventoryEntry): string | null {
    let best: string | null = null;
    for (const a of vuln.affected ?? []) {
        if (a.package?.name !== entry.name) continue;
        for (const r of a.ranges ?? []) {
            for (const ev of r.events ?? []) {
                if (typeof ev.fixed !== 'string') continue;
                if (entry.version !== null && compare_versions(ev.fixed, entry.version) !== 1) continue;
                if (best === null || compare_versions(ev.fixed, best) === -1) best = ev.fixed;
            }
        }
    }
    return best;
}

// ---------------------------------------------------------------------------
// Runtime lifecycle and vendor pre-announcements
// ---------------------------------------------------------------------------

const EOL_PRODUCT: Record<string, string> = { php: 'php', node: 'nodejs' };
/** Days before end of security support that count as `eol-soon`. */
export const EOL_SOON_DAYS = 90;

/** The release line a version belongs to: `8.3` for PHP, `22` for Node. */
export function releaseLine(runtime: string, version: string): string | null {
    const m = /^(\d+)(?:\.(\d+))?/.exec(version);
    if (!m) return null;
    return runtime === 'php' ? (m[2] === undefined ? null : `${m[1]}.${m[2]}`) : m[1]!;
}

/** A distro-patched version (`8.2.7-1+deb12u1`) is not judged on its upstream number (2.5). */
export function isVendorPatched(version: string): boolean {
    return /\+deb\d|ubuntu\d|[-.]el\d|\.amzn\d|-r\d+$/.test(version);
}

export async function lifecycle(
    entries: InventoryEntry[],
    opts: { fetcher?: Fetcher | undefined; now?: Date; timeoutMs?: number } = {},
): Promise<{ findings: RawFinding[]; report: SourceReport }> {
    const fetcher = opts.fetcher ?? defaultFetcher;
    const now = opts.now ?? new Date();
    const runtimes = entries.filter((e) => e.ecosystem === 'runtime' && e.version !== null && EOL_PRODUCT[e.name] !== undefined);
    if (runtimes.length === 0) return { findings: [], report: { source: 'lifecycle', status: 'ok', reason: 'no-runtime' } };
    const findings: RawFinding[] = [];
    try {
        const tables = new Map<string, Array<{ cycle?: string; eol?: string | boolean }>>();
        for (const name of new Set(runtimes.map((e) => e.name))) {
            const res = await fetcher(`https://endoflife.date/api/${EOL_PRODUCT[name]}.json`, { timeoutMs: opts.timeoutMs ?? 8000 });
            if (res.status !== 200) return { findings: [], report: { source: 'lifecycle', status: 'error', reason: `http-${res.status}` } };
            tables.set(name, JSON.parse(await res.text()));
        }
        for (const e of runtimes) {
            const line = releaseLine(e.name, e.version!);
            const row = (tables.get(e.name) ?? []).find((r) => String(r.cycle) === line);
            if (row === undefined || typeof row.eol !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.eol)) continue;
            const days = (Date.parse(`${row.eol}T00:00:00Z`) - now.getTime()) / 86400000;
            if (days > EOL_SOON_DAYS) continue;
            findings.push({
                id: `EOL-${e.name}-${line}`,
                aliases: [],
                kind: days <= 0 ? 'eol' : 'eol-soon',
                ecosystem: 'runtime',
                package: e.name,
                version: e.version,
                severity: null,
                score: null,
                kev: false,
                fixed: null,
                date: row.eol,
                source: 'lifecycle',
                modified: null,
                file: e.file,
                line: e.line,
            });
        }
        return { findings, report: { source: 'lifecycle', status: 'ok', reason: null } };
    } catch (e) {
        return { findings: [], report: { source: 'lifecycle', status: 'unavailable', reason: (e as Error).name === 'TimeoutError' ? 'timeout' : 'network' } };
    }
}

const VENDOR_FEEDS: Record<'php' | 'node', { url: string; source: SourceName }> = {
    php: { url: 'https://www.php.net/feed.atom', source: 'vendor-php' },
    node: { url: 'https://nodejs.org/en/feed/vulnerability.xml', source: 'vendor-node' },
};
const ANNOUNCES_RELEASE = /security release/i;
const ANNOUNCES_AHEAD = /upcoming|pre-?announce|will be released|scheduled|planned/i;
/** A pre-announcement older than this is no longer "ahead" of anything. */
export const PREANNOUNCE_WINDOW_DAYS = 14;

/**
 * A runtime vendor's own feed — the one signal that exists BEFORE an advisory
 * record does. The release JSON of PHP carries no security flag at all, and the
 * worked case of 2026-10-21 was announced a day before its release, with the
 * patched versions not yet named. Only the title's class and the entry's date
 * are kept: the finding says "announced for <runtime> on <day>", never the text.
 */
export async function vendorAnnouncements(
    entries: InventoryEntry[],
    opts: { fetcher?: Fetcher | undefined; now?: Date; timeoutMs?: number } = {},
): Promise<{ findings: RawFinding[]; reports: SourceReport[] }> {
    const fetcher = opts.fetcher ?? defaultFetcher;
    const now = opts.now ?? new Date();
    const findings: RawFinding[] = [];
    const reports: SourceReport[] = [];
    for (const runtimeName of ['php', 'node'] as const) {
        const users = entries.filter((e) => e.ecosystem === 'runtime' && e.name === runtimeName);
        if (users.length === 0) continue;
        const feed = VENDOR_FEEDS[runtimeName];
        try {
            const res = await fetcher(feed.url, { timeoutMs: opts.timeoutMs ?? 8000 });
            if (res.status !== 200) {
                reports.push({ source: feed.source, status: 'error', reason: `http-${res.status}` });
                continue;
            }
            const xml = await res.text();
            const items = xml.split(/<(?:entry|item)[\s>]/).slice(1);
            let criticalAhead = false;
            const releases: Array<{ version: string; day: string }> = [];
            for (const item of items) {
                // A released version: "PHP 8.3.27 Released!" / "Node v22.11.1 (LTS)", whose
                // body says it is a security release. Only the version and day are kept.
                const t = /<title[^>]*>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? '';
                const ver = /(\d+\.\d+\.\d+)/.exec(t)?.[1];
                const when = Date.parse(/<(?:published|updated|pubDate)>([^<]+)</.exec(item)?.[1] ?? '');
                if (ver !== undefined && /released|\(lts\)|\(current\)/i.test(t) && /security/i.test(item) && Number.isFinite(when)) {
                    const ageDays = (now.getTime() - when) / 86400000;
                    if (ageDays >= 0 && ageDays <= PREANNOUNCE_WINDOW_DAYS) releases.push({ version: ver, day: new Date(when).toISOString().slice(0, 10) });
                }
            }
            for (const item of items) {
                const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? '';
                const stamp = /<(?:published|updated|pubDate)>([^<]+)</.exec(item)?.[1] ?? '';
                const at = Date.parse(stamp);
                if (!Number.isFinite(at)) continue;
                const age = (now.getTime() - at) / 86400000;
                if (age < 0 || age > PREANNOUNCE_WINDOW_DAYS) continue;
                if (!ANNOUNCES_RELEASE.test(title) || !ANNOUNCES_AHEAD.test(title)) continue;
                const day = new Date(at).toISOString().slice(0, 10);
                if (/critical/i.test(title)) criticalAhead = true;
                // The release it announced is out: the release finding speaks instead.
                if (releases.some((r) => r.day >= day)) continue;
                const subject = users[0]!;
                findings.push({
                    id: `PRE-${runtimeName}-${day}`,
                    aliases: [],
                    kind: 'pre-announced',
                    ecosystem: 'runtime',
                    package: runtimeName,
                    version: subject.version,
                    severity: /critical/i.test(title) ? 'critical' : null,
                    score: null,
                    kev: false,
                    fixed: null,
                    date: day,
                    source: feed.source,
                    modified: null,
                    file: subject.file,
                    line: subject.line,
                });
            }
            // Once the release is out, each project pin on the same line below it
            // has a fix — and the pre-announcement's severity carries over.
            for (const u of users) {
                if (u.version === null || isVendorPatched(u.version)) continue;
                const lineOfUse = releaseLine(runtimeName, u.version);
                const rel = releases.find((r) => releaseLine(runtimeName, r.version) === lineOfUse && compare_versions(r.version, u.version) === 1);
                if (rel === undefined) continue;
                findings.push({
                    id: `REL-${runtimeName}-${rel.version}`,
                    aliases: [],
                    kind: 'vulnerability',
                    ecosystem: 'runtime',
                    package: runtimeName,
                    version: u.version,
                    severity: criticalAhead ? 'critical' : 'high',
                    score: null,
                    kev: false,
                    fixed: rel.version,
                    date: rel.day,
                    source: feed.source,
                    modified: null,
                    file: u.file,
                    line: u.line,
                });
            }
            reports.push({ source: feed.source, status: 'ok', reason: null });
        } catch (e) {
            reports.push({ source: feed.source, status: 'unavailable', reason: (e as Error).name === 'TimeoutError' ? 'timeout' : 'network' });
        }
    }
    return { findings, reports };
}
