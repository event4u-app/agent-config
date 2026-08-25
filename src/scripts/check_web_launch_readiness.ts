#!/usr/bin/env tsx
/**
 * `check_web_launch_readiness` — the web-surface pre-ship audit, as a COMMAND.
 *
 * NOT a skill, and the container is a recorded decision rather than a default.
 * AI council 2/2 on 2026-08-25 (`road-to-web-launch-readiness`
 * § `b-estate-decision-web-launch`): the G0 evidence establishes a COVERAGE gap,
 * not a SKILL-SHAPED one. A site-type-conditional config, deterministic checks,
 * tiers and a hard pass/fail gate are *"the signature of a linter, not a skill"*,
 * and `production-validator` carries unscoped `Bash`, so it can invoke this
 * directly instead of depending on skill activation — which demonstrably is NOT
 * firing for web-facing deploys, since `launch-readiness` already exists and
 * scores 0 of 8 on these axes.
 *
 * CONDITIONAL, NOT FLAT. Every check declares `applies_to`, and a check that does
 * not apply is reported as **skipped with the site type as the reason** — never
 * silently dropped and never as a finding. A reader must be able to tell "this
 * does not apply to you" from "this passed", which a flat audit cannot express.
 *
 * DEFAULT-OFF until the pre-registered benchmark returns positive
 * (`claim:web-launch-readiness-finds-more`, status `unbacked`). Absent the
 * opt-in, this exits 0 and says why rather than auditing.
 *
 * Exit codes: 0 = no critical/high finding (or not enabled) · 1 = a blocking
 * finding · 2 = usage or a dead scan scope.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');
export const CONFIG_REL = 'src/config/web-launch-readiness.json';

export type SiteType = 'local-business' | 'marketing-site' | 'saas-app' | 'docs' | 'internal-tool';
export type Tier = 'critical' | 'high' | 'medium' | 'situational';
/**
 * The region axis (2.3), and it is deliberately NOT a second `applies_to`.
 *
 * `applies_to` decides WHETHER a check applies; a region decides HOW SEVERELY.
 * A legal page is not more or less *applicable* in Germany — it is more or less
 * *optional*, because TMG 5 and DSGVO Art. 13 make it owed rather than advisable.
 * Modelling it as a tier escalation keeps one check with one implementation and
 * puts the jurisdiction where it belongs: on the consequence.
 */
export type Region = 'de' | 'eu' | 'us' | 'unspecified';

export interface CheckDef {
    id: string;
    title: string;
    applies_to: SiteType[];
    tier: Tier;
    why: string;
    remediation: string;
    verification: string;
}

export interface Finding {
    check: string;
    tier: Tier;
    /** `path:line` — the step's own verify line requires a location, not a name. */
    location: string;
    evidence: string;
    remediation: string;
    verification: string;
}

export interface Skipped {
    check: string;
    tier: Tier;
    /** The SITE TYPE, verbatim — 2.3 requires the type to be the stated reason. */
    reason: string;
}

/** A tier the region axis moved, and why. Reported so the axis is visible. */
export interface Escalated {
    check: string;
    from: Tier;
    to: Tier;
    why: string;
}

export interface Report {
    site_type: SiteType;
    region: Region;
    enabled: boolean;
    findings: Finding[];
    skipped: Skipped[];
    /** Checks that applied and found nothing. */
    passed: string[];
    /** Applicable checks with no implementation yet — never counted as passed. */
    unimplemented: string[];
    /** Tiers the region axis raised. Empty on `unspecified`, by construction. */
    escalated: Escalated[];
    scanned_files: number;
}

export interface Escalation {
    check: string;
    region: Region;
    to: Tier;
    why: string;
}

export function loadConfig(root = REPO_ROOT): {
    checks: CheckDef[];
    siteTypes: SiteType[];
    regions: Region[];
    escalations: Escalation[];
} {
    const abs = path.join(root, CONFIG_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(abs, 'utf-8');
    } catch {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `${CONFIG_REL} is missing — the config IS this command's corpus, and an absent ` +
                'one cannot be read as "no checks to run".',
        );
    }
    const doc = JSON.parse(raw) as {
        checks?: CheckDef[];
        site_types?: { values?: SiteType[] };
        regions?: { values?: Region[]; escalations?: Escalation[] };
    };
    const checks = doc.checks ?? [];
    const siteTypes = doc.site_types?.values ?? [];
    if (checks.length === 0 || siteTypes.length === 0) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `${CONFIG_REL} carries no checks or no site types — an empty corpus checks nothing.`,
        );
    }
    const regions = doc.regions?.values ?? [];
    const escalations = doc.regions?.escalations ?? [];
    if (regions.length === 0) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `${CONFIG_REL} carries no region axis — a DE site would silently get the ` +
                'situational tier for a legally owed page.',
        );
    }
    return { checks, siteTypes, regions, escalations };
}

/**
 * Apply the region escalation to a check's tier.
 *
 * Returns the escalated tier and the reason, or the original tier and null. The
 * reason travels with the tier because a reader seeing `required-legal-pages`
 * as CRITICAL on one run and SITUATIONAL on another needs the axis that moved
 * it, not just the outcome.
 */
export function tierFor(
    c: CheckDef,
    region: Region,
    escalations: readonly Escalation[],
): { tier: Tier; escalatedBy: string | null } {
    const e = escalations.find((x) => x.check === c.id && x.region === region);
    return e === undefined ? { tier: c.tier, escalatedBy: null } : { tier: e.to, escalatedBy: e.why };
}

/** `web_launch_readiness.enabled: true` in `.agent-settings.yml` — default OFF. */
export function enabled(root: string): boolean {
    let raw: string;
    try {
        raw = fs.readFileSync(path.join(root, '.agent-settings.yml'), 'utf-8');
    } catch {
        return false;
    }
    let inSection = false;
    for (const line of raw.split('\n')) {
        if (/^web_launch_readiness:\s*$/.test(line)) {
            inSection = true;
            continue;
        }
        if (/^\S/.test(line)) {
            inSection = false;
            continue;
        }
        if (inSection && /^\s{2}enabled:\s*true\s*$/.test(line)) return true;
    }
    return false;
}

/* ── the one implemented check: staging indexability ───────────────────────── */

const NOINDEX_RE = /<meta[^>]+name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex/i;
const XROBOTS_RE = /x-robots-tag[^\n]*noindex/i;
/** `Disallow: /` with nothing after it — a blanket block, not a path rule. */
const BLANKET_DISALLOW_RE = /^\s*Disallow:\s*\/\s*$/im;

export interface Located {
    file: string;
    line: number;
    text: string;
}

/**
 * Walk a build directory for indexability leftovers.
 *
 * Returns a LOCATION per hit, because the step's verify line asks for a
 * `file:line` and a finding without one cannot be acted on.
 */
export function scanIndexability(buildDir: string): { hits: Located[]; files: number } {
    const hits: Located[] = [];
    let files = 0;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules' || e.name === '.git') continue;
                walk(p);
                continue;
            }
            if (!/\.(html?|txt|xml|js|jsx|ts|tsx|vue|svelte|astro)$/i.test(e.name)) continue;
            files += 1;
            let text: string;
            try {
                text = fs.readFileSync(p, 'utf-8');
            } catch {
                continue;
            }
            const isRobots = path.basename(p).toLowerCase() === 'robots.txt';
            text.split('\n').forEach((line, i) => {
                const rel = path.relative(buildDir, p);
                if (NOINDEX_RE.test(line) || XROBOTS_RE.test(line)) {
                    hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
                } else if (isRobots && BLANKET_DISALLOW_RE.test(line)) {
                    hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
                }
            });
        }
    };
    walk(buildDir);
    return { hits, files };
}


/* ── the remaining checks (2.2 and 2.3) ─────────────────────────────────────── */

/**
 * Every scannable file in a build directory, read once.
 *
 * The single walk replaces the per-check walk the one-check version could get
 * away with: eight checks each walking the tree is eight times the IO for the
 * same bytes, and — worse — eight chances for the walkers to disagree about
 * what counts as a file.
 */
export interface SourceFile {
    rel: string;
    base: string;
    text: string;
    lines: string[];
}

const SCANNABLE_RE = /\.(html?|txt|xml|js|jsx|ts|tsx|vue|svelte|astro|md)$/i;

export function readTree(buildDir: string): SourceFile[] {
    const out: SourceFile[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules' || e.name === '.git') continue;
                walk(abs);
                continue;
            }
            if (!SCANNABLE_RE.test(e.name)) continue;
            let text: string;
            try {
                text = fs.readFileSync(abs, 'utf-8');
            } catch {
                continue;
            }
            out.push({
                rel: path.relative(buildDir, abs),
                base: e.name.toLowerCase(),
                text,
                lines: text.split('\n'),
            });
        }
    };
    walk(buildDir);
    return out;
}

/** An HTML page, as opposed to a robots.txt or a source module. */
function isPage(f: SourceFile): boolean {
    return /\.html?$/i.test(f.base);
}

/**
 * A check's implementation: files in, located hits out.
 *
 * Returning an EMPTY array means "applied and found nothing" — which is a pass.
 * A check that cannot decide must not return an empty array; it must not be in
 * `IMPLEMENTED` at all, so it reports as unimplemented instead. That is the one
 * rule keeping the silent-green defect out of this table.
 */
type Impl = (files: readonly SourceFile[]) => Located[];

/** `http://` on a host we serve, excluding the XML/DTD namespace URLs. */
const INSECURE_ASSET_RE =
    /(?:src|href|action)\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1|schemas?\.|www\.w3\.org)/i;

const httpsEnforcement: Impl = (files) => {
    const hits: Located[] = [];
    for (const f of files) {
        if (!isPage(f)) continue;
        f.lines.forEach((line, i) => {
            if (INSECURE_ASSET_RE.test(line)) {
                hits.push({ file: f.rel, line: i + 1, text: line.trim().slice(0, 160) });
            }
        });
    }
    return hits;
};

/**
 * A custom 404 page exists somewhere in the build.
 *
 * A whole-tree question, not a per-file one, so the hit it reports is located at
 * the build root rather than at a file — an absence has no line number, and
 * inventing one would be worse than admitting the shape of the finding.
 */
const customErrorRoute: Impl = (files) => {
    const found = files.some((f) => /^(404|not-found)(\.html?|\/index\.html?)?$/i.test(f.rel.replace(/\\/g, '/')) || /(^|\/)404\.html?$/i.test(f.rel));
    return found ? [] : [{ file: '.', line: 0, text: 'no 404.html or not-found page in the build output' }];
};

const TITLE_RE = /<title[^>]*>\s*([^<]{1,200}?)\s*<\/title>/i;
const DESC_RE = /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']\s*([^"']{1,400}?)\s*["']/i;

/**
 * Per-route title and description, and the DUPLICATE case counts.
 *
 * The obvious implementation checks presence. Presence is the easy half: a
 * layout that puts one hard-coded title on every route passes a presence check
 * and is exactly the defect the step names ("per-route"). So a title shared by
 * more than one page is a hit, with both locations reported.
 */
const perRouteMetadata: Impl = (files) => {
    const hits: Located[] = [];
    const titles = new Map<string, string[]>();
    for (const f of files) {
        if (!isPage(f)) continue;
        const tm = TITLE_RE.exec(f.text);
        if (tm === null) {
            hits.push({ file: f.rel, line: lineOf(f, '<title'), text: 'no <title> on this page' });
        } else {
            const key = (tm[1] ?? '').toLowerCase();
            titles.set(key, [...(titles.get(key) ?? []), f.rel]);
        }
        if (!DESC_RE.test(f.text)) {
            hits.push({
                file: f.rel,
                line: lineOf(f, 'name="description"'),
                text: 'no <meta name="description"> on this page',
            });
        }
    }
    for (const [title, where] of titles) {
        if (where.length < 2) continue;
        hits.push({
            file: where[0] ?? '.',
            line: 0,
            text: `title "${title}" is shared by ${String(where.length)} pages (${where.join(', ')}) — present, but not per-route`,
        });
    }
    return hits;
};

/** Content images without alt. `alt=""` is DECORATIVE and deliberately valid. */
const IMG_RE = /<img\b[^>]*>/gi;
const imageAlternativeText: Impl = (files) => {
    const hits: Located[] = [];
    for (const f of files) {
        if (!isPage(f)) continue;
        f.lines.forEach((line, i) => {
            for (const tag of line.match(IMG_RE) ?? []) {
                // `alt=""` is the ARIA-correct marking for a decorative image
                // and must NOT be a finding: flagging it would push authors to
                // write filler alt text, which is worse for a screen reader
                // than the empty string that tells it to skip.
                if (/\balt\s*=/i.test(tag)) continue;
                hits.push({ file: f.rel, line: i + 1, text: tag.slice(0, 160) });
            }
        });
    }
    return hits;
};

const documentHeadBasics: Impl = (files) => {
    const hits: Located[] = [];
    for (const f of files) {
        if (!isPage(f)) continue;
        if (!/<html[^>]+\blang\s*=\s*["'][a-z]/i.test(f.text)) {
            hits.push({ file: f.rel, line: lineOf(f, '<html'), text: 'no lang on <html>' });
        }
        if (!/<meta[^>]+charset\s*=/i.test(f.text)) {
            hits.push({ file: f.rel, line: lineOf(f, '<head'), text: 'no <meta charset>' });
        }
        if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(f.text)) {
            hits.push({ file: f.rel, line: lineOf(f, '<head'), text: 'no <meta name="viewport">' });
        }
    }
    return hits;
};

/**
 * Canonical and sitemap agree with each other.
 *
 * Two failure shapes, and the second is the one a presence check misses: a
 * canonical pointing at a host the sitemap never mentions means one of the two
 * was copied from another project, and the page that ends up indexed is not the
 * page anyone chose.
 */
const canonicalAndSitemap: Impl = (files) => {
    const hits: Located[] = [];
    const sitemap = files.find((f) => f.base === 'sitemap.xml');
    for (const f of files) {
        if (!isPage(f)) continue;
        const m = /<link[^>]+rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(f.text);
        if (m === null) {
            hits.push({ file: f.rel, line: lineOf(f, '<head'), text: 'no rel="canonical"' });
            continue;
        }
        const href = m[1] ?? '';
        const host = /^https?:\/\/([^/]+)/i.exec(href)?.[1];
        if (sitemap !== undefined && host !== undefined && !sitemap.text.includes(host)) {
            hits.push({
                file: f.rel,
                line: lineOf(f, 'rel="canonical"'),
                text: `canonical host ${host} appears nowhere in sitemap.xml`,
            });
        }
    }
    return hits;
};

const LEGAL_DE = [/impressum/i, /datenschutz/i];
const LEGAL_GENERIC = [/privacy/i, /(terms|imprint|legal)/i];

/**
 * The legally owed pages exist.
 *
 * Matched on the PATH, never on page text: a link to `/impressum` from a footer
 * is not an Impressum, and a check that accepted the link would pass every site
 * that links to a page it never built.
 */
const requiredLegalPages: Impl = (files) => {
    const paths = files.map((f) => f.rel.replace(/\\/g, '/'));
    const missing: string[] = [];
    const has = (res: RegExp[]): boolean => res.every((re) => paths.some((p) => re.test(p)));
    if (!has(LEGAL_DE) && !has(LEGAL_GENERIC)) {
        if (!paths.some((p) => /impressum|imprint|legal/i.test(p))) missing.push('imprint/Impressum');
        if (!paths.some((p) => /datenschutz|privacy/i.test(p))) missing.push('privacy/Datenschutz');
    }
    return missing.length === 0
        ? []
        : [{ file: '.', line: 0, text: `no page found for: ${missing.join(', ')}` }];
};

/**
 * Analytics loads only behind consent.
 *
 * The finding is analytics present with NO consent mechanism anywhere in the
 * build — never "analytics present", which would flag every site that does
 * consent correctly. The gate cannot see the wiring order, and says so in the
 * evidence rather than implying it checked.
 */
const ANALYTICS_RE = /(googletagmanager\.com|google-analytics\.com|gtag\(|plausible\.io|matomo|segment\.com|hotjar)/i;
const CONSENT_RE = /(consent|cookiebanner|cookie-banner|cookieconsent|klaro|usercentrics|borlabs|osano)/i;
const analyticsAndConsent: Impl = (files) => {
    const hits: Located[] = [];
    // Prose is excluded from BOTH sides, and the fixture is why: a `.md` file
    // in the build tree describing the consent banner matched CONSENT_RE, so
    // the check reported a pass on a fixture seeded to fire it. Documentation
    // saying a thing exists is not the thing existing — and the same argument
    // runs the other way, so an analytics name mentioned in a README must not
    // count as analytics either.
    const code = files.filter((f) => !/\.md$/i.test(f.base));
    const anyConsent = code.some((f) => CONSENT_RE.test(f.text));
    if (anyConsent) return hits;
    for (const f of code) {
        f.lines.forEach((line, i) => {
            if (!ANALYTICS_RE.test(line)) return;
            hits.push({
                file: f.rel,
                line: i + 1,
                text:
                    `${line.trim().slice(0, 120)} — analytics present and no consent mechanism ` +
                    'found anywhere in the build. Load order is NOT checked here.',
            });
        });
    }
    return hits;
};

/** First line containing `needle`, 1-indexed; 1 when absent (an absence has no line). */
function lineOf(f: SourceFile, needle: string): number {
    const i = f.lines.findIndex((l) => l.toLowerCase().includes(needle.toLowerCase()));
    return i < 0 ? 1 : i + 1;
}

export const IMPLS: Readonly<Record<string, Impl>> = {
    'https-enforcement': httpsEnforcement,
    'custom-error-route': customErrorRoute,
    'per-route-metadata': perRouteMetadata,
    'image-alternative-text': imageAlternativeText,
    'document-head-basics': documentHeadBasics,
    'canonical-and-sitemap-coherence': canonicalAndSitemap,
    'required-legal-pages': requiredLegalPages,
    'analytics-and-consent-wiring': analyticsAndConsent,
};

/** Checks with a real implementation. Everything else reports UNIMPLEMENTED. */
export const IMPLEMENTED: readonly string[] = [
    'staging-noindex-leftover',
    ...Object.keys(IMPLS),
];

export function audit(
    buildDir: string,
    siteType: SiteType,
    root = REPO_ROOT,
    region: Region = 'unspecified',
): Report {
    const { checks, siteTypes, regions, escalations } = loadConfig(root);
    if (!siteTypes.includes(siteType)) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `unknown site type "${siteType}" — registered: ${siteTypes.join(', ')}`,
        );
    }
    if (!regions.includes(region)) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `unknown region "${region}" — registered: ${regions.join(', ')}`,
        );
    }
    const findings: Finding[] = [];
    const skipped: Skipped[] = [];
    const passed: string[] = [];
    const unimplemented: string[] = [];
    const escalated: Escalated[] = [];
    // ONE walk for every check. Eight walkers over the same bytes is eight
    // times the IO and eight chances to disagree about what counts as a file.
    const files = readTree(buildDir);

    for (const c of checks) {
        const { tier, escalatedBy } = tierFor(c, region, escalations);
        if (escalatedBy !== null) {
            escalated.push({ check: c.id, from: c.tier, to: tier, why: escalatedBy });
        }
        if (!c.applies_to.includes(siteType)) {
            // The site type IS the reason, verbatim. 2.3 requires exactly this.
            skipped.push({ check: c.id, tier, reason: `site type is ${siteType}` });
            continue;
        }
        if (!IMPLEMENTED.includes(c.id)) {
            // Never counted as passed: an unimplemented check that reported
            // "clean" would be the silent-green defect this repository names.
            unimplemented.push(c.id);
            continue;
        }
        const impl = IMPLS[c.id];
        const hits =
            impl === undefined
                ? scanIndexability(buildDir).hits
                : impl(files);
        if (hits.length === 0) {
            passed.push(c.id);
            continue;
        }
        for (const h of hits) {
            findings.push({
                check: c.id,
                tier,
                location: `${h.file}:${String(h.line)}`,
                evidence: h.text,
                remediation: c.remediation,
                verification: c.verification,
            });
        }
    }
    return {
        site_type: siteType,
        region,
        enabled: enabled(root),
        findings,
        skipped,
        passed,
        unimplemented,
        escalated,
        scanned_files: files.length,
    };
}

const TIER_ORDER: readonly Tier[] = ['critical', 'high', 'medium', 'situational'];

/** Report order: critical → high → medium → situational-applicable → skipped. */
export function render(r: Report): string {
    const out: string[] = [];
    out.push(`site type: ${r.site_type}  ·  region: ${r.region}`);
    for (const e of r.escalated) {
        // Printed BEFORE the findings, because a reader who sees a check at
        // CRITICAL on one run and SITUATIONAL on another needs the axis that
        // moved it, not just the outcome.
        out.push(`  escalated by region: ${e.check} ${e.from} → ${e.to} — ${e.why}`);
    }
    for (const tier of TIER_ORDER) {
        const f = r.findings.filter((x) => x.tier === tier);
        if (f.length === 0) continue;
        out.push('', `${tier.toUpperCase()} (${String(f.length)})`);
        for (const x of f) {
            out.push(`  ${x.location}  ${x.check}`);
            out.push(`    evidence:     ${x.evidence}`);
            out.push(`    remediation:  ${x.remediation}`);
            out.push(`    verification: ${x.verification}`);
        }
    }
    if (r.passed.length > 0) out.push('', `PASSED: ${r.passed.join(', ')}`);
    if (r.unimplemented.length > 0) {
        out.push('', `NOT YET IMPLEMENTED (applicable, not audited): ${r.unimplemented.join(', ')}`);
    }
    if (r.skipped.length > 0) {
        out.push('', 'SKIPPED — not applicable to this site type');
        for (const s of r.skipped) out.push(`  ${s.check}: ${s.reason}`);
    }
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    const arg = (f: string): string | undefined => {
        const i = argv.indexOf(f);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const build = arg('--build');
    const siteType = arg('--site-type') as SiteType | undefined;
    const region = (arg('--region') ?? 'unspecified') as Region;
    if (build === undefined || siteType === undefined) {
        process.stderr.write(
            'usage: check_web_launch_readiness --build <dir> --site-type <type> ' +
                '[--region <de|eu|us|unspecified>] [--json]\n',
        );
        return 2;
    }
    if (!enabled(root) && !argv.includes('--force')) {
        process.stdout.write(
            'web-launch-readiness is DEFAULT-OFF until the pre-registered benchmark returns\n' +
                'positive (claim:web-launch-readiness-finds-more, status unbacked). Enable with\n' +
                '`web_launch_readiness.enabled: true` in .agent-settings.yml, or pass --force.\n',
        );
        return 0;
    }
    let r: Report;
    try {
        r = audit(build, siteType, root, region);
        reportScanned({
            gate: 'check_web_launch_readiness',
            scanned: r.scanned_files,
            units: 'build file(s)',
            roots: [build],
            allowEmpty:
                'OPTIONAL_INPUT: a build directory may legitimately hold no scannable file ' +
                'when the caller points at an unbuilt tree; a missing config is a separate ' +
                'hard error in loadConfig()',
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    } else {
        process.stdout.write(`${render(r)}\n`);
    }
    const blocking = r.findings.filter((f) => f.tier === 'critical' || f.tier === 'high');
    return blocking.length > 0 ? 1 : 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
