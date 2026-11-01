/**
 * The docs-site half of the `check_claims` witness sweep
 * (road-to-docs-that-sell 1.4). A number a newcomer reads on the site is the
 * same public claim as one in README, so it owes the same witness.
 *
 * Kept out of `check_claims.ts`, which sits past the source-size ceiling
 * (`check_source_size_budget`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { checkRatchet } from './gate_baseline.js';

/**
 * The hand-written pages of the docs site. Pages projected by
 * `site/sync-docs.mjs` are excluded: their source under `docs/` is governed
 * where it lives, and those pages are build output a fresh checkout does not
 * even contain.
 */
export const SITE_CONTENT_ROOT = 'site/src/content/docs';
const SITE_GENERATED_BANNER = /GENERATED from \S+ by site\/sync-docs\.mjs/;
/** The gitignored subtree `site/sync-docs.mjs` writes into. */
const SITE_GENERATED_DIR = 'generated';

/**
 * In `.mdx` an HTML comment is a syntax error, so the marker there is written
 * `{/* claim:ID *\/}`. Both spellings license a figure; nothing else changes.
 */
export const WITNESS_MARKER = /(?:<!--|\{\/\*)\s*claim:([A-Za-z0-9._-]+)\s*(?:-->|\*\/\})/g;

/** Repo-relative paths of every hand-written site page. */
export function siteWitnessSurfaces(repo: string): string[] {
    const root = path.join(repo, SITE_CONTENT_ROOT);
    if (!fs.existsSync(root)) return [];
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (dir === root && e.name === SITE_GENERATED_DIR) continue;
                walk(full);
            } else if (/\.mdx?$/.test(e.name)) {
                if (SITE_GENERATED_BANNER.test(fs.readFileSync(full, 'utf-8'))) continue;
                out.push(path.relative(repo, full).split(path.sep).join('/'));
            }
        }
    };
    walk(root);
    return out.sort();
}

/**
 * A site line as the claim scan sees it: an inline `style` attribute carries
 * CSS (`max-width: 100%`), which is markup and never a claim about this package.
 */
export function siteScannedLine(line: string): string {
    return line.replace(/\bstyle\s*=\s*(?:"[^"]*"|'[^']*'|\{\{.*?\}\})/g, '');
}

interface Finding {
    id: string;
    file: string;
    reason: string;
}

/**
 * The site findings that fail the run. Site findings meet a ratchet rather than
 * failing outright, because the sweep reaching the site REVEALS figures that
 * were published before any gate looked. Same anti-silencing shape as the
 * non-inference ratchet in `check_claims.ts`: a tree with NO baselines file is a
 * fixture and every site finding fails; a repository that records baselines
 * fails only when the count rises above `check_claims:site-witness`. Findings at
 * or under the baseline are still printed, so the debt stays visible on every run.
 */
export function settleSiteFindings(siteFindings: readonly Finding[], repo: string): Finding[] {
    const baselines = path.join(repo, 'src', 'config', 'gate-violation-baselines.json');
    if (!fs.existsSync(baselines)) return [...siteFindings];
    const verdict = checkRatchet({ gate: 'check_claims:site-witness', actual: siteFindings.length, repoRoot: repo });
    if (!verdict.ok) {
        return [...siteFindings, { id: 'site-witness', file: SITE_CONTENT_ROOT, reason: verdict.message }];
    }
    if (siteFindings.length > 0) {
        process.stderr.write(`⚠️  check_claims: ${siteFindings.length} unwitnessed site figure(s), within the recorded baseline:\n`);
        for (const f of siteFindings) process.stderr.write(`    ${f.file} — ${f.reason}\n`);
    }
    return [];
}
