#!/usr/bin/env node
/**
 * B4 — CI link-checker for the built Starlight site (no new dependency).
 *
 * Astro `build` completes even with dangling internal links, so a plain build is
 * NOT a link gate. This scans the built `site/dist/**` HTML for internal links
 * (`href` / `src`) and verifies every one resolves to a real file in `dist/` —
 * accounting for the `base` prefix (`/agent-config`), trailing-slash dirs
 * (`…/x/` → `…/x/index.html`), and `#fragment` / `?query` stripping. External
 * (`http(s):`, `mailto:`, `data:`, protocol-relative `//`) links and pure `#`
 * anchors are skipped — this gate owns *internal* integrity only.
 *
 * Read-only. Exit 0 clean / 1 on any broken internal link, 2 if the site has not
 * been built yet (run `cd site && npm run build` first).
 *
 * Usage:
 *   ./scripts-run src/scripts/check_site_links            # scan site/dist
 *   ./scripts-run src/scripts/check_site_links --dist DIR --base /prefix
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _FILE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_FILE), '..', '..');

/** Read `base:` from site/astro.config.mjs (default '/agent-config'). */
export function readBase(repo: string = REPO): string {
    const cfg = path.join(repo, 'site', 'astro.config.mjs');
    if (fs.existsSync(cfg)) {
        const m = /base:\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(cfg, 'utf-8'));
        if (m && m[1]) return m[1].replace(/\/+$/, '');
    }
    return '/agent-config';
}

function _walkHtml(dir: string): string[] {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length > 0) {
        const cur = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const full = path.join(cur, e.name);
            if (e.isDirectory()) stack.push(full);
            else if (e.isFile() && e.name.endsWith('.html')) out.push(full);
        }
    }
    return out.sort();
}

const _LINK_RE = /(?:href|src)\s*=\s*"([^"]*)"/gi;
const _EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:|data:)/i;

/** Resolve one internal link to a candidate dist-relative file, or null to skip. */
export function resolveTarget(link: string, base: string): string | null {
    let l = link.trim();
    if (l === '' || _EXTERNAL.test(l)) return null;
    // Strip fragment + query.
    l = l.split('#')[0]!.split('?')[0]!;
    if (l === '') return null;
    if (!l.startsWith('/')) return null; // relative links are rare in Astro output; skip (not internal-root)
    // Strip the base prefix.
    if (base && (l === base || l.startsWith(base + '/'))) {
        l = l.slice(base.length);
    }
    if (l === '' || l === '/') return 'index.html';
    l = l.replace(/^\/+/, '');
    if (l.endsWith('/')) return l + 'index.html';
    return l;
}

export function findBrokenLinks(distDir: string, base: string): Array<{ page: string; link: string }> {
    const broken: Array<{ page: string; link: string }> = [];
    const seenOk = new Set<string>();
    for (const html of _walkHtml(distDir)) {
        const text = fs.readFileSync(html, 'utf-8');
        const pageRel = path.relative(distDir, html);
        let m: RegExpExecArray | null;
        _LINK_RE.lastIndex = 0;
        const linksInPage = new Set<string>();
        while ((m = _LINK_RE.exec(text)) !== null) {
            const raw = m[1] as string;
            const target = resolveTarget(raw, base);
            if (target === null) continue;
            if (linksInPage.has(raw)) continue;
            linksInPage.add(raw);
            const cacheKey = target;
            if (seenOk.has(cacheKey)) continue;
            const candidates = [
                path.join(distDir, target),
                path.join(distDir, target, 'index.html'), // extensionless dir link
            ];
            if (candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) {
                seenOk.add(cacheKey);
            } else {
                broken.push({ page: pageRel, link: raw });
            }
        }
    }
    return broken;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const distArg = argv.indexOf('--dist');
    const baseArg = argv.indexOf('--base');
    const distDir = distArg !== -1 && argv[distArg + 1] ? path.resolve(argv[distArg + 1] as string) : path.join(REPO, 'site', 'dist');
    const base = baseArg !== -1 && argv[baseArg + 1] ? (argv[baseArg + 1] as string).replace(/\/+$/, '') : readBase();

    if (!fs.existsSync(distDir)) {
        process.stderr.write(`❌  site not built: ${distDir} is missing. Run \`cd site && npm ci && npm run build\` first.\n`);
        return 2;
    }
    const broken = findBrokenLinks(distDir, base);
    if (broken.length > 0) {
        process.stdout.write(`❌  ${broken.length} broken internal link(s) in the built site:\n`);
        for (const b of broken) process.stdout.write(`  - ${b.page}: ${b.link}\n`);
        return 1;
    }
    if (!quiet) {
        const pages = _walkHtml(distDir).length;
        process.stdout.write(`✅  site links: ${pages} page(s), no broken internal links (base ${base}).\n`);
    }
    return 0;
}

const _isCli =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCli) process.exit(main());
