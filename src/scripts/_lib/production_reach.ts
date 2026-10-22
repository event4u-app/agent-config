/**
 * Which `src/` symbols a production entry reaches (road-to-a-tick-the-shipped-path-earns 3.1).
 *
 * Static and name-level, the same reading as `dispatch_import_closure`: relative specifiers only,
 * dynamic `import()` not followed. A symbol counts as reached when some module
 * in the closure imports it BY NAME from its defining module (or imports that
 * module whole), or when the defining module is itself an entry. Reaching the
 * module is not enough — `egress_normalize.ts` is in the closure for one regex
 * while `detectNormalized` has no production importer, and that is the case
 * this exists to see.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const ENTRIES_CONFIG_REL = 'src/config/production-entries.json';

export interface ReachTree {
    list(): readonly string[];
    read(rel: string): string | null;
}

/** The checkout under `root`: tracked plus untracked-not-ignored files. */
export function worktreeOf(root: string): ReachTree {
    let files: string[] | null = null;
    return {
        list() {
            if (files === null) {
                const res = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
                    cwd: root,
                    encoding: 'utf-8',
                    maxBuffer: 64 * 1024 * 1024,
                });
                files = res.status === 0 ? res.stdout.split('\n').filter((l) => l !== '') : [];
            }
            return files;
        },
        read(rel) {
            const abs = path.join(root, rel);
            return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf-8') : null;
        },
    };
}

/** A commit's tree, read from objects — for replaying an old range. */
export function commitTreeOf(root: string, ref: string): ReachTree {
    const ls = spawnSync('git', ['ls-tree', '-r', '--name-only', ref], { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    const files = ls.status === 0 ? ls.stdout.split('\n').filter((l) => l !== '') : [];
    const present = new Set(files);
    return {
        list: () => files,
        read(rel) {
            if (!present.has(rel)) return null;
            const res = spawnSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
            return res.status === 0 ? res.stdout : null;
        },
    };
}

export function globToRegExp(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i += 1) {
        const c = glob[i] as string;
        if (c === '*' && glob[i + 1] === '*') {
            re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
            i += glob[i + 2] === '/' ? 2 : 1;
        } else if (c === '*') re += '[^/]*';
        else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
}

/** Resolve a `.js` specifier from `fromRel` to the source it names in `tree`. */
function resolve(tree: ReachTree, fromRel: string, spec: string): string | null {
    const base = path.posix.join(path.posix.dirname(fromRel), spec);
    for (const c of [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, `${base}/index.ts`]) {
        const norm = path.posix.normalize(c);
        if (tree.read(norm) !== null) return norm;
    }
    return null;
}

/** `{ a, b as c }` → `['a', 'b']`; `* as ns` and a default import → `['*']`. */
export function importedNames(clause: string): string[] {
    const names: string[] = [];
    const braces = /\{([^}]*)\}/.exec(clause);
    if (braces) {
        for (const part of (braces[1] as string).split(',')) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
            if (name) names.push(name);
        }
    }
    const outside = clause.replace(/\{[^}]*\}/, '');
    if (/\*\s+as\s+\w+/.test(outside) || /^\s*(?:type\s+)?[A-Za-z_$][\w$]*\s*(?:,|$)/.test(outside)) names.push('*');
    return names;
}

export interface ModuleImport {
    readonly target: string;
    readonly names: readonly string[];
}

/** Every relative import of `rel`, resolved, with the names it takes. */
export function moduleImports(tree: ReachTree, rel: string): ModuleImport[] {
    const source = (tree.read(rel) ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const out: ModuleImport[] = [];
    const re = /\b(import|export)\s+(?:type\s+)?((?:(?!\b(?:import|export)\b)[^;'"])*?)\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
        const spec = (m[3] ?? m[4]) as string;
        const target = resolve(tree, rel, spec);
        if (target === null) continue;
        out.push({ target, names: m[4] !== undefined ? [] : importedNames(m[2] ?? '') });
    }
    return out;
}

/** Entries from the committed config: the fixed list plus every script an entry source names. */
export function productionEntries(tree: ReachTree): string[] {
    const raw = tree.read(ENTRIES_CONFIG_REL);
    if (raw === null) return [];
    const cfg = JSON.parse(raw) as { entries?: string[]; entry_sources?: string[] };
    const entries = new Set((cfg.entries ?? []).filter((e) => tree.read(e) !== null));
    const sources = (cfg.entry_sources ?? []).map(globToRegExp);
    for (const file of tree.list()) {
        if (!sources.some((re) => re.test(file))) continue;
        for (const m of (tree.read(file) ?? '').matchAll(/(?:src\/)?scripts\/([A-Za-z0-9_/.-]+?)(?:\.ts)?(?![A-Za-z0-9_/.-])/g)) {
            const candidate = `src/scripts/${m[1] as string}.ts`;
            if (tree.read(candidate) !== null) entries.add(candidate);
        }
    }
    return [...entries].sort();
}

/**
 * Exports the module's own code also uses — named again after their declaration.
 * A reached module's `main` runs its helpers without importing them, so a helper
 * a concern calls is reached; one only its test calls is not.
 */
export function usedExports(source: string): string[] {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const out: string[] = [];
    for (const m of code.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) {
        const name = m[1] as string;
        const uses = code.match(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'))?.length ?? 0;
        if (uses >= 2) out.push(name);
    }
    return out;
}

export interface Reach {
    readonly entries: ReadonlySet<string>;
    readonly modules: ReadonlySet<string>;
    /** `<module>#<name>`; `<module>#*` when a closure module takes it whole. */
    readonly symbols: ReadonlySet<string>;
}

export function productionReach(tree: ReachTree, extra: readonly string[] = []): Reach {
    const entries = new Set([...productionEntries(tree), ...extra.filter((e) => tree.read(e) !== null)]);
    const modules = new Set<string>();
    const symbols = new Set<string>();
    const queue = [...entries];
    while (queue.length > 0) {
        const rel = queue.shift() as string;
        if (modules.has(rel)) continue;
        modules.add(rel);
        for (const name of usedExports(tree.read(rel) ?? '')) symbols.add(`${rel}#${name}`);
        for (const imp of moduleImports(tree, rel)) {
            for (const n of imp.names) symbols.add(`${imp.target}#${n}`);
            if (!modules.has(imp.target)) queue.push(imp.target);
        }
    }
    return { entries, modules, symbols };
}

/** The `src/` symbols a test takes, and whether production reaches at least one. */
export function testReaches(tree: ReachTree, reach: Reach, testRel: string): { taken: string[]; reached: string[] } {
    const taken: string[] = [];
    const reached: string[] = [];
    for (const imp of moduleImports(tree, testRel)) {
        if (!imp.target.startsWith('src/') || /\.test\.ts$/.test(imp.target)) continue;
        for (const n of imp.names.length ? imp.names : ['*']) {
            const key = `${imp.target}#${n}`;
            taken.push(key);
            const hit =
                reach.entries.has(imp.target) ||
                reach.symbols.has(key) ||
                reach.symbols.has(`${imp.target}#*`) ||
                (n === '*' && reach.modules.has(imp.target));
            if (hit) reached.push(key);
        }
    }
    return { taken, reached };
}
