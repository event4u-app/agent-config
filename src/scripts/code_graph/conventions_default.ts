/**
 * The default convention pass (ADR-298): runs for every project, names no
 * framework, and links only what a string can state about a file.
 *
 *   literal-path    './x' · 'views/a.html'      code --reads-->     the one code, doc or template file it names
 *   literal-dotted  render('a.b')               code --renders-->   the one template at a/b.<template ext>
 *   fs-route        pages/a/[id].tsx            route --routes-to-> the page module
 *
 * Every edge is INFERRED, drawn only on a single match, and never where an
 * edge between the same two files already exists — an import, a provider's
 * edge or an earlier literal outranks it.
 */
import * as path from 'node:path';

import type { SourceFile } from './build.js';
import type { CodeEdge, CodeNode, ResolvedVia } from './types.js';
import { EXT_LANG, MAX_FILE_BYTES } from './types.js';

export type DefaultMechanism = 'literal-path' | 'literal-dotted' | 'fs-route';

/**
 * Which mechanisms run. A mechanism under the 90 % precision bar is switched off
 * here, never the pass (readings: `graph-providers-baseline-2026-10-23.md`).
 * `literal-dotted` measured 3 of 6 on Fixture L — a translation key such as
 * `trans('common.sort')` matches a view of the same name — so dotted names are
 * left to providers, which know which call takes a template.
 */
export const DEFAULT_MECHANISMS: Readonly<Record<DefaultMechanism, boolean>> = {
    'literal-path': true,
    'literal-dotted': false,
    'fs-route': true,
};

/** Template extensions a dotted name may resolve to; longest first so `.blade.php` wins over `.php`. */
const TEMPLATE_EXTS = [
    '.blade.php',
    '.handlebars',
    '.mustache',
    '.jinja2',
    '.cshtml',
    '.liquid',
    '.jinja',
    '.razor',
    '.twig',
    '.html',
    '.htm',
    '.hbs',
    '.ejs',
    '.pug',
    '.njk',
    '.erb',
    '.tpl',
    '.j2',
];

const PAGE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.astro', '.mdx']);

export interface DefaultInput {
    files: readonly SourceFile[];
    /** Every path in the project, code or not; the code and doc paths when the build knows no more. */
    paths: readonly string[];
    nodes: readonly CodeNode[];
    edges: readonly CodeEdge[];
    mechanisms?: Readonly<Record<DefaultMechanism, boolean>>;
}

export interface DefaultStats {
    'literal-path': number;
    'literal-dotted': number;
    'fs-route': number;
}

function templateBase(p: string): string | null {
    for (const ext of TEMPLATE_EXTS) if (p.endsWith(ext) && p.length > ext.length) return p.slice(0, -ext.length);
    return null;
}

/** `pages/a/[id].tsx` → `/a/[id]`; null when the file is no page module. */
export function fsRoutePath(p: string, pageDirs: ReadonlySet<string>): { verb: string; route: string } | null {
    const ext = path.posix.extname(p);
    if (!PAGE_EXTS.has(ext)) return null;
    const segs = p.split('/');
    const base = segs[segs.length - 1] as string;
    const stem = base.slice(0, -ext.length);
    const clean = (parts: string[]): string =>
        `/${parts.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@') && s !== 'index').join('/')}`.replace(/\/$/, '') || '/';
    const at = (dir: string): number => segs.lastIndexOf(dir, segs.length - 2);
    const app = at('app');
    if (app >= 0 && (stem === 'page' || stem === 'route') && pageDirs.has(segs.slice(0, app + 1).join('/'))) {
        return { verb: stem === 'route' ? 'ROUTE' : 'PAGE', route: clean(segs.slice(app + 1, -1)) };
    }
    const routes = at('routes');
    if (routes >= 1 && segs[routes - 1] === 'src' && /^\+(page|server)$/.test(stem)) {
        return { verb: stem === '+server' ? 'ROUTE' : 'PAGE', route: clean(segs.slice(routes + 1, -1)) };
    }
    const pages = at('pages');
    if (pages >= 0 && !stem.startsWith('_') && pageDirs.has(segs.slice(0, pages + 1).join('/'))) {
        const rest = [...segs.slice(pages + 1, -1), stem];
        return { verb: rest[0] === 'api' ? 'ROUTE' : 'PAGE', route: clean(rest) };
    }
    return null;
}

/** Directories that hold page-shaped modules: an `app/` with a `page.*`, a `pages/` with an `index.*`. */
function pageDirectories(paths: readonly string[]): Set<string> {
    const dirs = new Set<string>();
    for (const p of paths) {
        const segs = p.split('/');
        const base = segs[segs.length - 1] as string;
        const ext = path.posix.extname(base);
        if (!PAGE_EXTS.has(ext)) continue;
        const stem = base.slice(0, -ext.length);
        for (let i = segs.length - 2; i >= 0; i--) {
            if (segs[i] === 'app' && stem === 'page') dirs.add(segs.slice(0, i + 1).join('/'));
            if (segs[i] === 'pages' && stem === 'index') dirs.add(segs.slice(0, i + 1).join('/'));
        }
    }
    return dirs;
}

export function conventionsDefault(input: DefaultInput): { nodes: CodeNode[]; edges: CodeEdge[]; stats: DefaultStats } {
    const on = input.mechanisms ?? DEFAULT_MECHANISMS;
    const stats: DefaultStats = { 'literal-path': 0, 'literal-dotted': 0, 'fs-route': 0 };
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const fileNodes = new Set(input.nodes.filter((n) => n.kind === 'file').map((n) => n.id));
    // A literal may name code, a document or a template — never a data file or
    // a dotfile, which would fill the map with what the code merely configures.
    const inventory = new Set([...input.paths.filter((p) => templateBase(p) !== null), ...fileNodes]);
    const nodeIds = new Set(input.nodes.map((n) => n.id));
    const fileOf = new Map(input.nodes.map((n) => [n.id, n.source_file] as const));
    const linked = new Set<string>();
    for (const e of input.edges) {
        const a = fileOf.get(e.source);
        const b = fileOf.get(e.target) ?? (inventory.has(e.target) ? e.target : undefined);
        if (a && b) linked.add(`${a}\0${b}`);
    }
    const ensureFile = (p: string): void => {
        if (nodeIds.has(p)) return;
        nodeIds.add(p);
        nodes.push({ id: p, label: p, kind: 'file', source_file: p, source_location: [] });
    };
    const link = (source: string, target: string, relation: CodeEdge['relation'], via: ResolvedVia & DefaultMechanism): void => {
        const key = `${source}\0${target}`;
        if (source === target || linked.has(key)) return;
        linked.add(key);
        ensureFile(target);
        edges.push({ source, target, relation, confidence: 'INFERRED', resolved_via: via, provider: 'native' });
        stats[via] += 1;
    };

    // Dotted names: `a/b/c` → the template files whose path ends there.
    const byDotted = new Map<string, string[]>();
    if (on['literal-dotted']) {
        for (const p of input.paths) {
            const base = templateBase(p);
            if (!base) continue;
            const segs = base.split('/');
            for (let i = 0; i <= segs.length - 2; i++) {
                const key = segs.slice(i).join('/');
                byDotted.set(key, [...(byDotted.get(key) ?? []), p]);
            }
        }
    }

    for (const f of [...input.files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        if (Buffer.byteLength(f.source, 'utf-8') > MAX_FILE_BYTES) continue;
        const dir = path.posix.dirname(f.path);
        const lang = EXT_LANG[path.posix.extname(f.path).toLowerCase()];
        const infer = lang === 'php' ? ['.php'] : lang === 'python' ? ['.py'] : ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue'];
        if (on['literal-path']) {
            // Single and double quotes only: a backtick span is usually a mention in a comment.
            for (const m of f.source.matchAll(/(['"])([^'"`\s\\${}()<>|,;]{3,200})\1/g)) {
                const lit = m[2] as string;
                if (lit.includes('://') || lit.startsWith('/') || lit.includes('*') || lit.endsWith('/')) continue;
                const hasExt = /\.[A-Za-z0-9]{1,10}$/.test(path.posix.basename(lit));
                if (!lit.includes('/') && !hasExt) continue;
                const relative = lit.startsWith('./') || lit.startsWith('../');
                const bases = relative ? [path.posix.join(dir, lit)] : [path.posix.normalize(lit), path.posix.join(dir, lit)];
                const hits = new Set<string>();
                for (const b of bases) {
                    if (b.startsWith('..')) continue;
                    if (inventory.has(b)) hits.add(b);
                    if (!hasExt) for (const ext of infer) for (const c of [`${b}${ext}`, `${b}/index${ext}`]) if (inventory.has(c)) hits.add(c);
                }
                if (hits.size === 1) link(f.path, [...hits][0] as string, 'reads', 'literal-path');
            }
        }
        if (on['literal-dotted']) {
            for (const m of f.source.matchAll(/\(\s*(['"])([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)+)\1/g)) {
                const hits = byDotted.get((m[2] as string).replace(/\./g, '/')) ?? [];
                if (hits.length === 1) link(f.path, hits[0] as string, 'renders', 'literal-dotted');
            }
        }
    }

    if (on['fs-route']) {
        const pageDirs = pageDirectories(input.paths);
        const seen = new Set<string>();
        for (const p of input.paths) {
            const r = fsRoutePath(p, pageDirs);
            if (!r) continue;
            const id = `${p}#route:${r.verb} ${r.route}`;
            if (seen.has(id)) continue;
            seen.add(id);
            ensureFile(p);
            nodes.push({ id, label: `${r.verb} ${r.route}`, kind: 'route', source_file: p, source_location: [] });
            edges.push({ source: p, target: id, relation: 'member', confidence: 'EXTRACTED', resolved_via: 'same-file', provider: 'native' });
            edges.push({ source: id, target: p, relation: 'routes-to', confidence: 'INFERRED', resolved_via: 'fs-route', provider: 'native' });
            stats['fs-route'] += 1;
        }
    }
    return { nodes, edges, stats };
}
