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
 * Read-only. Exit 0 clean / 1 on any broken internal link, 2 if the build is
 * missing OR stale (run `cd site && npm run build` first). Staleness matters as much
 * as absence: a green verdict over an old partial build is a gate that cannot fail.
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
    // A missing dist was already an exit-2; a STALE one was not, so the checker
    // reported green over an old partial build (measured: 6 pages against 25 content
    // sources, every source newer than the build). Green over a build that does not
    // contain the pages being checked is worse than red — it is a gate that cannot
    // fail. Same silent-green class as the per-pack matrix removed alongside this.
    const stale = _stalenessVerdict(distDir);
    if (stale !== null) {
        process.stderr.write(`❌  site build is stale: ${stale}. Run \`cd site && npm ci && npm run build\` first.\n`);
        return 2;
    }
    const broken = findBrokenLinks(distDir, base);
    if (broken.length > 0) {
        process.stdout.write(`❌  ${broken.length} broken internal link(s) in the built site:\n`);
        for (const b of broken) process.stdout.write(`  - ${b.page}: ${b.link}\n`);
        process.stderr.write(`scanned: ${_walkHtml(distDir).length}\n`);
        return 1;
    }
    const pages = _walkHtml(distDir).length;
    // Machine-readable count for check_gate_coverage — emitted regardless of
    // --quiet, and on every exit path above too, so a gate with real findings
    // still reports what it inspected (the emission bug found on #1047).
    process.stderr.write(`scanned: ${pages}\n`);
    if (!quiet) {
        process.stdout.write(`✅  site links: ${pages} page(s), no broken internal links (base ${base}).\n`);
    }
    return 0;
}

/**
 * Why the built site cannot be trusted, or `null` when it looks current.
 *
 * Two independent signals, because they catch different failures:
 *  - a content source newer than every built page  → the build predates an edit;
 *  - materially fewer pages than content sources   → the build is partial.
 *
 * Both are cheap `stat` walks. Exported for the test.
 */
export function _stalenessVerdict(distDir: string, contentDir?: string): string | null {
    const content = contentDir ?? path.join(REPO, 'site', 'src', 'content');
    if (!fs.existsSync(content)) {
        return null; // nothing to compare against — not this checker's verdict to make
    }
    const sources = _walkFiles(content).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
    if (sources.length === 0) {
        return null;
    }
    const pages = _walkHtml(distDir);
    if (pages.length === 0) {
        return 'the build contains no HTML pages';
    }
    const newestPage = Math.max(...pages.map((p) => fs.statSync(p).mtimeMs));
    const newer = sources.filter((s) => fs.statSync(s).mtimeMs > newestPage);
    if (newer.length > 0) {
        return `${newer.length} of ${sources.length} content source(s) are newer than the newest built page`;
    }
    if (pages.length < sources.length) {
        return `only ${pages.length} page(s) built for ${sources.length} content source(s)`;
    }
    return null;
}

function _walkFiles(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(..._walkFiles(full));
        else if (e.isFile()) out.push(full);
    }
    return out;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isCli =
    _isCliEntry();
if (_isCli) process.exit(main());
