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

export interface Report {
    site_type: SiteType;
    enabled: boolean;
    findings: Finding[];
    skipped: Skipped[];
    /** Checks that applied and found nothing. */
    passed: string[];
    /** Applicable checks with no implementation yet — never counted as passed. */
    unimplemented: string[];
    scanned_files: number;
}

export function loadConfig(root = REPO_ROOT): { checks: CheckDef[]; siteTypes: SiteType[] } {
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
    };
    const checks = doc.checks ?? [];
    const siteTypes = doc.site_types?.values ?? [];
    if (checks.length === 0 || siteTypes.length === 0) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `${CONFIG_REL} carries no checks or no site types — an empty corpus checks nothing.`,
        );
    }
    return { checks, siteTypes };
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

/** Checks with a real implementation. Everything else reports UNIMPLEMENTED. */
export const IMPLEMENTED: readonly string[] = ['staging-noindex-leftover'];

export function audit(buildDir: string, siteType: SiteType, root = REPO_ROOT): Report {
    const { checks, siteTypes } = loadConfig(root);
    if (!siteTypes.includes(siteType)) {
        throw new DeadScopeError(
            'check_web_launch_readiness',
            `unknown site type "${siteType}" — registered: ${siteTypes.join(', ')}`,
        );
    }
    const findings: Finding[] = [];
    const skipped: Skipped[] = [];
    const passed: string[] = [];
    const unimplemented: string[] = [];
    let scanned = 0;

    for (const c of checks) {
        if (!c.applies_to.includes(siteType)) {
            // The site type IS the reason, verbatim. 2.3 requires exactly this.
            skipped.push({ check: c.id, tier: c.tier, reason: `site type is ${siteType}` });
            continue;
        }
        if (!IMPLEMENTED.includes(c.id)) {
            // Never counted as passed: an unimplemented check that reported
            // "clean" would be the silent-green defect this repository names.
            unimplemented.push(c.id);
            continue;
        }
        const { hits, files } = scanIndexability(buildDir);
        scanned = files;
        if (hits.length === 0) {
            passed.push(c.id);
            continue;
        }
        for (const h of hits) {
            findings.push({
                check: c.id,
                tier: c.tier,
                location: `${h.file}:${String(h.line)}`,
                evidence: h.text,
                remediation: c.remediation,
                verification: c.verification,
            });
        }
    }
    return {
        site_type: siteType,
        enabled: enabled(root),
        findings,
        skipped,
        passed,
        unimplemented,
        scanned_files: scanned,
    };
}

const TIER_ORDER: readonly Tier[] = ['critical', 'high', 'medium', 'situational'];

/** Report order: critical → high → medium → situational-applicable → skipped. */
export function render(r: Report): string {
    const out: string[] = [];
    out.push(`site type: ${r.site_type}`);
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
    if (build === undefined || siteType === undefined) {
        process.stderr.write(
            'usage: check_web_launch_readiness --build <dir> --site-type <type> [--json]\n',
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
        r = audit(build, siteType, root);
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
