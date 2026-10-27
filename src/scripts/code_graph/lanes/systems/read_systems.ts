/**
 * Systems lane: what a project runs — runtimes, frameworks and packages — why
 * each package is installed, and where the code uses it.
 *
 * Facts: `package:<ecosystem>:<name>@<version>` per locked (or, without a
 * lockfile, declared) package and `runtime:<name>` per runtime with every
 * witness side by side. Relations: `requires` between packages, as the lockfile
 * resolved them, and `uses` from a code file to the package an import binds to.
 *
 * Uses without an import count: a manifest script running a package's binary,
 * a CI step doing the same, a tool config naming it, framework auto-discovery,
 * a type package for a used package, a peer another package needs. A package
 * none of these reach is a *candidate* for removal, never a verdict — dynamic
 * loading and reflection stay invisible to a file reader (K21).
 *
 * Offline: files only, no package manager, no registry (K25).
 */
import { phpClassRefs, phpOwner, readComposerAutoload } from './php_autoload.js';
import { scopeOf } from '../../scope.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readInventory } from '../../../_lib/advisory_inventory.js';
import { walkFiles } from '../../../_lib/infra_files/walk.js';
import type { CodeGraph } from '../../types.js';
import type { LaneOutput } from '../lane_fact.js';
import { Emitter, posix } from '../runtime/emit.js';
import {
    attachManifestLines,
    composerRoots,
    type Ecosystem,
    type LockGraph,
    type LockPackage,
    type LockRoot,
    manifestRoots,
    markDevOnly,
    readBunLock,
    readComposerLock,
    readNpmLock,
    readPnpmLock,
    readYarnLock,
} from './lockfiles.js';
import { packageOfSpecifier, satisfies } from './semver.js';

/** Packages whose locked version names the framework a project is built on. */
export const FRAMEWORKS: ReadonlySet<string> = new Set([
    'laravel/framework',
    'symfony/framework-bundle',
    'symfony/http-kernel',
    'slim/slim',
    'cakephp/cakephp',
    'yiisoft/yii2',
    'laminas/laminas-mvc',
    'react',
    'next',
    'vue',
    'nuxt',
    '@angular/core',
    'svelte',
    '@sveltejs/kit',
    'express',
    '@nestjs/core',
    'fastify',
    'koa',
    'hono',
    'astro',
    'solid-js',
    'preact',
    '@remix-run/react',
]);

const LOCK_NAMES = new Set(['package-lock.json', 'composer.lock', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
const DEPTH = 6;

/** A file only tests, fixtures or tooling load: a dev package used there is fine. Scope decides the first half; the tooling half is no scope. */
export const isDevPath = (file: string): boolean =>
    scopeOf(file) !== 'product' ||
    /(^|\/)(e2e|stories|\.storybook|scripts|tools|bin|database\/(seeders|factories))\//.test(file) ||
    /\.(stories|e2e)\.[cm]?[jt]sx?$/.test(file) ||
    /(^|\/)[^/]*\.config\.[cm]?[jt]s$/.test(file);

const CONFIG_FILE =
    /(^|\/)(\.eslintrc(\.\w+)?|eslint\.config\.\w+|\.prettierrc(\.\w+)?|prettier\.config\.\w+|babel\.config\.\w+|\.babelrc(\.\w+)?|postcss\.config\.\w+|tailwind\.config\.\w+|\.stylelintrc(\.\w+)?|stylelint\.config\.\w+|jest\.config\.\w+|vitest\.config\.\w+|vite\.config\.\w+|webpack\.config\.\w+|rollup\.config\.\w+|tsconfig[\w.-]*\.json|commitlint\.config\.\w+|\.commitlintrc(\.\w+)?|\.lintstagedrc(\.\w+)?|lint-staged\.config\.\w+|phpstan\.neon(\.dist)?|psalm\.xml(\.dist)?|rector\.php|ecs\.php|\.php-cs-fixer(\.dist)?\.php|phpunit\.xml(\.dist)?|playwright\.config\.\w+|nuxt\.config\.\w+|next\.config\.\w+|astro\.config\.\w+|svelte\.config\.\w+|\.mocharc(\.\w+)?|nodemon\.json|\.swcrc|deptrac\.ya?ml|infection\.json(5)?(\.dist)?)$/;

export interface SystemsOptions {
    /** test seam: the code graph whose `external:` edges bind imports to packages */
    graph?: Pick<CodeGraph, 'nodes' | 'edges'>;
}

interface Pkg {
    id: string;
    eco: Ecosystem;
    p: LockPackage;
    locked: boolean;
    lockfiles: Set<string>;
    roots: LockRoot[];
    lockfile: string;
    nonimport: string[];
    users: Map<string, { names: Set<string>; line: number }>;
    /** composer only: whether `vendor/` autoload maps bound its classes, or only the lockfile's PSR maps */
    binding?: 'complete' | 'partial';
    /** declared beside a lockfile that does not hold it */
    notInstalled?: boolean;
    /** 6.2: `used`, `used-through <pkg>`, `unused-candidate`, `not-installed`, `virtual/meta`, `ignored (<reason>)` */
    verdict?: string;
    /** 6.4: one JSON row per importer — {lockfile, workspace, specifier, relation, scope} */
    importers?: string[];
}

const factKey = (eco: Ecosystem, key: string): string => `${eco}:${key}`;
const pkgId = (eco: Ecosystem, key: string): string => `package:${factKey(eco, key)}`;
const majorOf = (v: string): string => /^v?(\d+)/.exec(v)?.[1] ?? v;

export function readSystems(root: string, opts: SystemsOptions = {}): LaneOutput {
    const em = new Emitter(root);
    const walk = (match: (name: string, rel: string) => boolean): string[] => walkFiles(root, match, { maxDepth: DEPTH }).map(posix);
    const text = new Map<string, string>();
    const read = (rel: string): string | null => {
        if (text.has(rel)) return text.get(rel) as string;
        const t = em.read(rel);
        if (t !== null) text.set(rel, t);
        return t;
    };

    const manifests = walk((n) => n === 'package.json' || n === 'composer.json');
    for (const m of manifests) read(m);
    const graphs: LockGraph[] = [];
    for (const lock of walk((n) => LOCK_NAMES.has(n))) {
        const name = lock.slice(lock.lastIndexOf('/') + 1);
        if (name === 'bun.lockb') {
            em.skip(lock, 'binary bun lockfile: run `bun install --save-text-lockfile` to get bun.lock');
            continue;
        }
        const t = read(lock);
        if (t === null) continue;
        const dir = lock.includes('/') ? lock.slice(0, lock.lastIndexOf('/')) : '';
        const near = (file: string): { file: string; text: string } | null => {
            const rel = dir ? `${dir}/${file}` : file;
            const body = text.get(rel);
            return body === undefined ? null : { file: rel, text: body };
        };
        const wsManifests = manifests.filter((m) => m.endsWith('package.json') && (dir === '' || m.startsWith(`${dir}/`))).map((m) => ({ file: m, text: text.get(m) ?? '' }));
        const r =
            name === 'package-lock.json'
                ? readNpmLock(lock, t)
                : name === 'composer.lock'
                  ? readComposerLock(lock, t, near('composer.json'))
                  : name === 'pnpm-lock.yaml'
                    ? readPnpmLock(lock, t)
                    : name === 'yarn.lock'
                      ? readYarnLock(lock, t, wsManifests)
                      : readBunLock(lock, t);
        if ('unread' in r) {
            em.skip(lock, r.unread);
            continue;
        }
        markDevOnly(r);
        attachManifestLines(r, text);
        graphs.push(r);
    }

    // Packages, deduplicated across lockfiles; a manifest without a lockfile still declares.
    const pkgs = new Map<string, Pkg>();
    for (const g of graphs) {
        for (const p of g.packages.values()) {
            const id = pkgId(g.ecosystem, p.key);
            const known = pkgs.get(id);
            if (known) {
                known.lockfiles.add(g.file);
                continue;
            }
            pkgs.set(id, { id, eco: g.ecosystem, p, locked: true, lockfiles: new Set([g.file]), roots: [], lockfile: g.file, nonimport: [], users: new Map() });
        }
        for (const r of g.roots) {
            const id = r.to ? pkgId(g.ecosystem, r.to) : null;
            if (id && pkgs.has(id)) pkgs.get(id)!.roots.push(r);
            if (r.to === null && r.manifest.slice(0, r.manifest.lastIndexOf('/') + 1) === g.file.slice(0, g.file.lastIndexOf('/') + 1)) {
                // Declared beside this lockfile, and the lockfile does not hold it: not installed.
                const key = `${r.name}@not-installed`;
                const nid = pkgId(g.ecosystem, key);
                const known = pkgs.get(nid);
                if (known) known.roots.push(r);
                else {
                    const p: LockPackage = { key, name: r.name, version: 'not-installed', line: r.line, dev: r.kind === 'dev', optional: r.kind === 'optional', requires: [], bins: [], namespaces: [], autoloadFiles: false, classmap: false, providers: [], peers: [], private: false };
                    pkgs.set(nid, { id: nid, eco: g.ecosystem, p, locked: false, lockfiles: new Set([g.file]), roots: [r], lockfile: r.manifest, nonimport: [], users: new Map(), notInstalled: true });
                }
            }
        }
    }
    const lockedManifests = new Set(graphs.flatMap((g) => g.roots.map((r) => r.manifest)));
    for (const m of manifests) {
        if (lockedManifests.has(m)) continue;
        const eco: Ecosystem = m.endsWith('composer.json') ? 'composer' : 'npm';
        const roots = eco === 'composer' ? composerRoots({ file: m, text: text.get(m) ?? '' }) : manifestRoots({ file: m, text: text.get(m) ?? '' });
        for (const r of roots) {
            const id = pkgId(eco, `${r.name}@unlocked`);
            const known = pkgs.get(id);
            if (known) {
                known.roots.push(r);
                continue;
            }
            const p: LockPackage = { key: `${r.name}@unlocked`, name: r.name, version: 'unlocked', line: r.line, dev: r.kind === 'dev', optional: r.kind === 'optional', requires: [], bins: [], namespaces: [], autoloadFiles: false, classmap: false, providers: [], peers: [], private: false };
            pkgs.set(id, { id, eco, p, locked: false, lockfiles: new Set(), roots: [r], lockfile: m, nonimport: [], users: new Map() });
        }
    }
    if (pkgs.size === 0 && graphs.length === 0) {
        runtimes(root, em, graphs);
        return em.output('systems');
    }

    const byName = new Map<string, Pkg[]>();
    for (const k of pkgs.values()) byName.set(`${k.eco}:${k.p.name.toLowerCase()}`, [...(byName.get(`${k.eco}:${k.p.name.toLowerCase()}`) ?? []), k]);
    /** The version a project resolves a name to: a direct one first, then the only one. */
    const preferred = (eco: Ecosystem, name: string): Pkg | undefined => {
        const all = byName.get(`${eco}:${name.toLowerCase()}`) ?? [];
        return all.find((k) => k.roots.length > 0) ?? all[0];
    };

    usesFromGraph(root, opts.graph, pkgs, preferred, read);
    phpUses(root, em, walk, read, pkgs, preferred);
    nonImportUses(walk, read, pkgs, byName, preferred);

    assignVerdicts(graphs, pkgs, read);
    for (const k of pkgs.values()) emitPackage(em, k, read);
    for (const g of graphs) {
        for (const p of g.packages.values()) {
            const from = pkgId(g.ecosystem, p.key);
            for (const r of p.requires) {
                if (!r.to) continue;
                em.rel('requires', from, pkgId(g.ecosystem, r.to), { range: r.range, kind: r.kind }, g.file, p.line);
            }
        }
    }
    for (const k of pkgs.values()) {
        for (const [file, u] of k.users) {
            read(file);
            em.rel('uses', file, k.id, { names: [...u.names].sort().slice(0, 50), package: k.p.name }, file, u.line);
        }
    }
    runtimes(root, em, graphs);
    return em.output('systems');
}

function emitPackage(em: Emitter, k: Pkg, read: (rel: string) => string | null): void {
    read(k.lockfile);
    const direct = k.roots.length > 0;
    const declared = k.roots.map((r) => `${r.manifest}:${r.line} ${r.kind} ${r.range}`);
    const devOnly = k.locked ? k.p.dev : k.roots.every((r) => r.kind === 'dev');
    const users = [...k.users.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const prodUser = users.find(([f]) => !isDevPath(f));
    const ref = (file: string, line: number): string => {
        read(file);
        const w = em.witness(file, line);
        return `${w.file}:${w.line}:${w.hash}`;
    };
    const attrs: Record<string, string | number | boolean | string[] | null> = {
        ecosystem: k.eco,
        name: k.p.name,
        version: k.p.version,
        locked: k.locked,
        lockfiles: [...k.lockfiles].sort(),
        dev: devOnly,
        optional: k.p.optional,
        direct,
        declared,
        workspaces: [...new Set(k.roots.map((r) => r.workspace))].sort(),
        framework: FRAMEWORKS.has(k.p.name),
        bins: k.p.bins,
        namespaces: k.p.namespaces,
        private: k.p.private,
        used_by: users.length,
        nonimport: [...new Set(k.nonimport)].sort(),
        ...(k.binding ? { binding: k.binding } : {}),
        ...(k.importers?.length ? { importers: k.importers } : {}),
    };
    if (k.verdict) attrs['verdict'] = k.verdict;
    // SY-1 reads `unused`: only an unused candidate a product manifest declares.
    if (direct && k.verdict === 'unused-candidate' && k.roots.some((r) => scopeOf(r.manifest) === 'product')) {
        attrs['unused'] = true;
        attrs['unused_ref'] = ref(k.roots[0]!.manifest, k.roots[0]!.line);
    }
    if (!direct && k.locked && prodUser) {
        attrs['undeclared_use'] = true;
        attrs['undeclared_ref'] = ref(prodUser[0], prodUser[1].line);
    }
    if (devOnly && prodUser) {
        attrs['dev_in_prod'] = true;
        attrs['dev_in_prod_ref'] = ref(prodUser[0], prodUser[1].line);
    }
    em.fact('package', factKey(k.eco, k.p.key), `${k.p.name}@${k.p.version}`, attrs, k.lockfile, Math.max(1, k.p.line));
}

/** The `extra.unused` list of a composer manifest (the composer-unused convention), read once per manifest. */
function ignoredBy(manifest: string, read: (rel: string) => string | null, memo: Map<string, Set<string>>): Set<string> {
    let set = memo.get(manifest);
    if (!set) {
        set = new Set();
        try {
            const doc = JSON.parse(read(manifest) ?? '{}') as { extra?: { unused?: unknown[] } };
            for (const n of doc.extra?.unused ?? []) if (typeof n === 'string') set.add(n.toLowerCase());
        } catch {
            /* an unreadable manifest ignores nothing */
        }
        memo.set(manifest, set);
    }
    return set;
}

/** One verdict per package, from its uses, its dependents' uses, the lockfile and the manifest (6.2). */
function assignVerdicts(graphs: readonly LockGraph[], pkgs: Map<string, Pkg>, read: (rel: string) => string | null): void {
    const dependents = new Map<string, Set<string>>();
    for (const g of graphs) {
        for (const p of g.packages.values()) {
            for (const r of p.requires) {
                if (!r.to) continue;
                const to = pkgId(g.ecosystem, r.to);
                const set = dependents.get(to) ?? new Set<string>();
                set.add(pkgId(g.ecosystem, p.key));
                dependents.set(to, set);
            }
        }
    }
    const used = (k: Pkg): boolean => k.users.size > 0 || k.nonimport.length > 0;
    const dirOf = (f: string): string => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');
    for (const k of pkgs.values()) {
        const rows: Array<Record<string, string>> = [];
        for (const r of k.roots) {
            const lock = [...k.lockfiles].find((l) => dirOf(l) === dirOf(r.manifest)) ?? (k.locked ? k.lockfile : '');
            rows.push({ lockfile: lock, workspace: dirOf(r.manifest), specifier: r.range, relation: r.kind, scope: scopeOf(r.manifest) });
        }
        for (const g of graphs) {
            if (!k.lockfiles.has(g.file) || k.roots.some((r) => dirOf(r.manifest) === dirOf(g.file))) continue;
            for (const p of g.packages.values()) {
                const req = p.requires.find((q) => q.to === k.p.key);
                if (req) rows.push({ lockfile: g.file, workspace: dirOf(g.file), specifier: req.range, relation: `transitive via ${p.name}`, scope: scopeOf(g.file) });
            }
        }
        rows.sort((a, b) => (`${a.lockfile} ${a.relation}` < `${b.lockfile} ${b.relation}` ? -1 : 1));
        k.importers = rows.map((r) => JSON.stringify({ lockfile: r.lockfile, workspace: r.workspace, specifier: r.specifier, relation: r.relation, scope: r.scope }));
    }
    const memo = new Map<string, Set<string>>();
    for (const k of pkgs.values()) {
        const ignored = k.eco === 'composer' && k.roots.find((r) => ignoredBy(r.manifest, read, memo).has(k.p.name.toLowerCase()));
        const through = [...(dependents.get(k.id) ?? [])].map((id) => pkgs.get(id)).filter((d): d is Pkg => !!d && used(d)).map((d) => d.p.name).sort()[0];
        k.verdict = used(k)
            ? 'used'
            : k.notInstalled
              ? 'not-installed'
              : ignored
                ? `ignored (${ignored.manifest} extra.unused)`
                : k.p.meta || k.p.name.startsWith('@types/')
                  ? 'virtual/meta'
                  : through
                    ? `used-through ${through}`
                    : 'unused-candidate';
    }
}

/**
 * PHP classes bound to composer packages from the autoload maps read as data
 * (6.1, H10): a classmap-only package, a root-namespace `use Dompdf;` and an
 * aliased import all bind. Without `vendor/` only the lockfile's PSR maps can,
 * and every composer package says its binding is partial.
 */
function phpUses(
    root: string,
    em: Emitter,
    walk: (match: (name: string, rel: string) => boolean) => string[],
    read: (rel: string) => string | null,
    pkgs: Map<string, Pkg>,
    preferred: (eco: Ecosystem, name: string) => Pkg | undefined,
): void {
    const composer = [...pkgs.values()].filter((k) => k.eco === 'composer');
    if (composer.length === 0) return;
    const vendor = readComposerAutoload(root);
    const autoload = vendor ?? {
        classOwner: new Map<string, string>(),
        namespaces: composer.flatMap((k) => k.p.namespaces.map((ns) => [ns, k.p.name] as [string, string])).sort((a, b) => b[0].length - a[0].length),
    };
    const state = vendor ? 'complete' : 'partial';
    for (const k of composer) k.binding = state;
    if (!vendor) em.skip('vendor/composer', 'binding partial: no vendor/composer/installed.json — classmap-only packages cannot bind; PSR maps from composer.lock only');
    for (const file of walk((n) => n.endsWith('.php'))) {
        if (file.startsWith('vendor/')) continue;
        const text = read(file);
        if (text === null) continue;
        for (const ref of phpClassRefs(text)) {
            const owner = phpOwner(ref.name, autoload);
            const k = owner ? preferred('composer', owner) : undefined;
            if (!k) continue;
            const u = k.users.get(file) ?? { names: new Set<string>(), line: ref.line };
            u.names.add(ref.name.slice(ref.name.lastIndexOf('\\') + 1));
            u.line = Math.min(u.line, ref.line);
            k.users.set(file, u);
        }
    }
}

/** Imports the code graph already bound to `external:<specifier>`. */
function usesFromGraph(
    root: string,
    graph: Pick<CodeGraph, 'nodes' | 'edges'> | undefined,
    pkgs: Map<string, Pkg>,
    preferred: (eco: Ecosystem, name: string) => Pkg | undefined,
    read: (rel: string) => string | null,
): void {
    if (!graph) return;
    const nodeFile = new Map<string, { file: string; line: number }>();
    for (const n of graph.nodes) nodeFile.set(n.id, { file: n.source_file, line: (n.source_location?.[0] as number | undefined) ?? 1 });
    const composer = [...pkgs.values()].filter((k) => k.eco === 'composer' && k.p.namespaces.length > 0);
    const nsOwner = (fq: string): Pkg | undefined => {
        let best: Pkg | undefined;
        let len = 0;
        for (const k of composer) {
            for (const ns of k.p.namespaces) {
                if (`${fq}\\`.startsWith(ns) && ns.length > len) {
                    best = k;
                    len = ns.length;
                }
            }
        }
        return best;
    };
    for (const e of graph.edges) {
        if (!e.target.startsWith('external:')) continue;
        const at = nodeFile.get(e.source);
        if (!at || !at.file) continue;
        const spec = e.target.slice('external:'.length);
        const head = spec.split('::')[0] as string;
        const [mod, member] = head.split('#') as [string, string | undefined];
        let k: Pkg | undefined;
        let used: string | undefined = member;
        if (mod.includes('\\')) {
            k = nsOwner(mod);
            used = mod.slice(mod.lastIndexOf('\\') + 1);
        } else {
            const name = packageOfSpecifier(mod);
            if (name) k = preferred('npm', name);
        }
        if (!k) continue;
        const u = k.users.get(at.file) ?? { names: new Set<string>(), line: at.line };
        if (used) u.names.add(used);
        u.line = Math.min(u.line, at.line);
        k.users.set(at.file, u);
    }
    // Only files the reader can witness.
    for (const k of pkgs.values()) for (const f of [...k.users.keys()]) if (!fs.existsSync(path.join(root, f)) || read(f) === null) k.users.delete(f);
}

/** Which tool a config file belongs to: the typed input it is read as. */
function configKind(file: string): 'tsconfig' | 'eslint' | 'vite' | 'config' {
    const base = file.slice(file.lastIndexOf('/') + 1);
    if (/^tsconfig[\w.-]*\.json$/.test(base)) return 'tsconfig';
    if (/eslint/.test(base)) return 'eslint';
    if (/^(vite|vitest)\.config\./.test(base)) return 'vite';
    return 'config';
}

/**
 * The packages a tool config reaches by a name that is not the package name:
 * tsconfig `types: ["node"]` → `@types/node` and `extends` of a package, a
 * vitest coverage `provider: 'v8'` → `@vitest/coverage-v8`.
 */
function typedConfigInputs(kind: string, body: string): Array<{ pkg: string; line: number; what: string }> {
    const out: Array<{ pkg: string; line: number; what: string }> = [];
    const lineAt = (i: number): number => body.slice(0, i).split('\n').length;
    if (kind === 'tsconfig') {
        const types = /"types"\s*:\s*\[([^\]]*)\]/.exec(body);
        if (types) for (const m of (types[1] as string).matchAll(/"([^"]+)"/g)) out.push({ pkg: `@types/${(m[1] as string).replace(/^@([^/]+)\//, '$1__')}`, line: lineAt(types.index), what: `types ${m[1]}` });
        const ext = /"extends"\s*:\s*"((?:@[^/"]+\/)?[^./"][^/"]*)/.exec(body);
        if (ext) out.push({ pkg: ext[1] as string, line: lineAt(ext.index), what: `extends ${ext[1]}` });
    }
    if (kind === 'vite') {
        const prov = /provider\s*:\s*['"](v8|istanbul)['"]/.exec(body);
        if (prov) out.push({ pkg: `@vitest/coverage-${prov[1]}`, line: lineAt(prov.index), what: `coverage provider ${prov[1]}` });
    }
    return out;
}

function nonImportUses(
    walk: (match: (name: string, rel: string) => boolean) => string[],
    read: (rel: string) => string | null,
    pkgs: Map<string, Pkg>,
    byName: Map<string, Pkg[]>,
    preferred: (eco: Ecosystem, name: string) => Pkg | undefined,
): void {
    const binOwner = new Map<string, Pkg>();
    for (const k of pkgs.values()) for (const b of k.p.bins) if (!binOwner.has(`${k.eco}:${b}`)) binOwner.set(`${k.eco}:${b}`, k);
    const note = (k: Pkg | undefined, entry: string): void => {
        if (k) k.nonimport.push(entry);
    };
    const tokens = (cmd: string): string[] => cmd.split(/[\s;&|()'"`=]+/).filter(Boolean);
    const byToken = (eco: Ecosystem, tok: string): Pkg | undefined => {
        const t = tok.replace(/^(\.\/)?(node_modules\/\.bin|vendor\/bin)\//, '');
        return binOwner.get(`${eco}:${t}`) ?? (eco === 'npm' && /^(@[\w.-]+\/)?[\w.-]+$/.test(t) ? preferred(eco, t) : undefined);
    };
    const lineOf = (body: string, needle: string): number => {
        const i = body.indexOf(needle);
        return i < 0 ? 1 : body.slice(0, i).split('\n').length;
    };

    // Manifest scripts.
    for (const m of walk((n) => n === 'package.json' || n === 'composer.json')) {
        const body = read(m);
        if (body === null) continue;
        let doc: { scripts?: Record<string, unknown>; extra?: { laravel?: { 'dont-discover'?: unknown[] } } };
        try {
            doc = JSON.parse(body);
        } catch {
            continue;
        }
        const eco: Ecosystem = m.endsWith('composer.json') ? 'composer' : 'npm';
        for (const [script, cmd] of Object.entries(doc.scripts ?? {})) {
            const cmds = Array.isArray(cmd) ? cmd : [cmd];
            for (const c of cmds) {
                if (typeof c !== 'string') continue;
                for (const tok of tokens(c)) note(byToken(eco, tok), `script ${m}:${lineOf(body, `"${script}"`)} ${script}`);
            }
        }
        if (eco === 'composer' && preferred('composer', 'laravel/framework')) {
            const skip = new Set((doc.extra?.laravel?.['dont-discover'] ?? []).filter((x): x is string => typeof x === 'string'));
            for (const k of pkgs.values()) {
                if (k.eco === 'composer' && k.p.providers.length > 0 && !skip.has(k.p.name) && !skip.has('*')) note(k, `auto-discovery ${k.lockfile}:${k.p.line} ${k.p.providers.length} provider(s)`);
            }
        }
    }

    // CI steps that run a package's binary.
    for (const wf of walk((n, rel) => /^\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$/.test(rel) || n === '.gitlab-ci.yml' || n === '.gitlab-ci.yaml')) {
        const body = read(wf);
        if (body === null) continue;
        body.split('\n').forEach((l, i) => {
            if (!/\b(run|script)\b|^\s*-\s/.test(l)) return;
            for (const tok of tokens(l)) {
                for (const eco of ['npm', 'composer'] as const) {
                    const k = binOwner.get(`${eco}:${tok.replace(/^(\.\/)?(node_modules\/\.bin|vendor\/bin)\//, '')}`);
                    if (k) note(k, `ci ${wf}:${i + 1} ${tok}`);
                }
            }
        });
    }

    // Tool configs that name a package or its short plugin form, typed by the tool (6.3).
    const configs = walk((_n, rel) => CONFIG_FILE.test(posix(rel)));
    const npmPkgs = [...pkgs.values()].filter((k) => k.eco === 'npm');
    for (const cfg of configs) {
        const body = read(cfg);
        if (body === null) continue;
        const kind = configKind(cfg);
        for (const k of npmPkgs) {
            for (const form of shortForms(k.p.name)) {
                const re = new RegExp(`["'\`]${form.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?:["'\`/:]|$)`);
                const m = re.exec(body);
                if (m) {
                    note(k, `${kind} ${cfg}:${body.slice(0, m.index).split('\n').length} ${form}`);
                    break;
                }
            }
        }
        for (const t of typedConfigInputs(kind, body)) note(preferred('npm', t.pkg), `${kind} ${cfg}:${t.line} ${t.what}`);
        if (cfg.endsWith('.php') || cfg.endsWith('.neon') || cfg.endsWith('.neon.dist') || /\.xml(\.dist)?$/.test(cfg)) {
            for (const k of pkgs.values()) {
                if (k.eco !== 'composer') continue;
                const hit = k.p.namespaces.find((ns) => body.includes(ns.replace(/\\$/, '')));
                if (hit) note(k, `config ${cfg}:${lineOf(body, hit.replace(/\\$/, ''))} ${hit}`);
            }
        }
    }

    // Symfony bundles register by class name, not by `use`.
    for (const bundles of walk((n, rel) => n === 'bundles.php' && /(^|[\\/])config[\\/]bundles\.php$/.test(rel))) {
        const body = read(bundles);
        if (body === null) continue;
        for (const k of pkgs.values()) {
            if (k.eco !== 'composer') continue;
            const hit = k.p.namespaces.find((ns) => body.includes(ns.replace(/\\$/, '')));
            if (hit) note(k, `bundle ${bundles}:${lineOf(body, hit.replace(/\\$/, ''))}`);
        }
    }

    // Global helpers and classmaps load without a `use` the reader can see.
    for (const k of pkgs.values()) {
        if (k.eco === 'composer' && k.p.autoloadFiles) note(k, `autoload-files ${k.lockfile}:${k.p.line}`);
    }

    // A type package serves its runtime package; a peer serves the package that asks for it.
    for (const k of pkgs.values()) {
        if (k.eco !== 'npm') continue;
        const typed = /^@types\/(.+)$/.exec(k.p.name)?.[1];
        if (typed) {
            const target = typed.includes('__') ? `@${typed.replace('__', '/')}` : typed;
            const t = byName.get(`npm:${target.toLowerCase()}`)?.[0];
            if (t && (t.users.size > 0 || t.nonimport.length > 0)) note(k, `types for ${target}`);
            else if (typed === 'node' && npmPkgs.some((x) => x.users.size > 0)) note(k, 'types for node');
        }
        for (const peer of k.p.peers) {
            const t = preferred('npm', peer);
            if (t && t !== k && (k.users.size > 0 || k.roots.length > 0)) note(t, `peer of ${k.p.name}`);
        }
    }
}

/** The spellings a tool config uses for a package: full name and plugin short forms. */
export function shortForms(name: string): string[] {
    const out = [name];
    const scoped = /^(@[^/]+)\/(.+)$/.exec(name);
    for (const kind of ['eslint-plugin', 'eslint-config', 'prettier-plugin', 'stylelint-config', 'stylelint-plugin', 'babel-plugin', 'babel-preset', 'postcss']) {
        if (scoped) {
            if (scoped[2] === kind) out.push(scoped[1] as string);
            else if ((scoped[2] as string).startsWith(`${kind}-`)) out.push(`${scoped[1]}/${(scoped[2] as string).slice(kind.length + 1)}`);
        } else if (name.startsWith(`${kind}-`)) out.push(name.slice(kind.length + 1));
    }
    return [...new Set(out)].filter((f) => f.length >= 3);
}

/**
 * One `runtime` fact per runtime, every witness kept apart: a declared range,
 * a version file, an image tag and a CI matrix value are different claims, and
 * merging them into one number is the confusion this lane exists to avoid.
 */
function runtimes(root: string, em: Emitter, graphs: readonly LockGraph[]): void {
    type W = { file: string; line: number; kind: string; value: string; exact: boolean };
    const by = new Map<string, W[]>();
    const add = (name: string, w: W): void => {
        by.set(name, [...(by.get(name) ?? []), w]);
    };
    let inv;
    try {
        inv = readInventory(root);
    } catch {
        inv = { entries: [] };
    }
    for (const e of inv.entries) {
        if (e.ecosystem !== 'runtime') continue;
        add(e.name, { file: posix(e.file), line: e.line, kind: e.provenance, value: e.version ?? e.range ?? '', exact: e.version !== null });
    }
    for (const g of graphs) {
        for (const p of g.platform) if (p.name === 'php') add('php', { file: g.file, line: p.line, kind: 'lockfile-platform', value: p.value, exact: false });
    }
    for (const [name, ws] of [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const sorted = ws.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
        for (const w of sorted) em.read(w.file);
        let conflict: [W, W] | null = null;
        for (const a of sorted.filter((w) => w.exact)) {
            for (const b of sorted.filter((w) => !w.exact)) {
                if (satisfies(a.value, b.value) === false) {
                    conflict = [a, b];
                    break;
                }
            }
            if (conflict) break;
        }
        if (!conflict) {
            const exacts = sorted.filter((w) => w.exact);
            const two = exacts.find((w) => majorMinor(w.value) !== majorMinor(exacts[0]!.value));
            if (two) conflict = [exacts[0]!, two];
        }
        const first = sorted[0]!;
        const attrs: Record<string, string | number | boolean | string[] | null> = {
            name,
            witnesses: sorted.map((w) => `${w.file}:${w.line} ${w.kind} ${w.value}`),
            values: [...new Set(sorted.map((w) => w.value))],
        };
        if (conflict) {
            attrs['disagrees'] = true;
            const ref = (w: W): string => {
                const x = em.witness(w.file, w.line);
                return `${x.file}:${x.line}:${x.hash}`;
            };
            attrs['conflict'] = [ref(conflict[0]), ref(conflict[1])];
        }
        em.fact('runtime', name, name, attrs, first.file, first.line);
    }
}

const majorMinor = (v: string): string => v.split('.').slice(0, 2).join('.');

/** Direct packages of one name in two majors across the project's own manifests. */
export function multiMajor(facts: LaneOutput['facts']): Map<string, string[]> {
    const groups = new Map<string, Array<{ id: string; major: string; ref: string }>>();
    for (const f of facts) {
        if (f.kind !== 'package' || f.attrs['direct'] !== true || f.attrs['locked'] !== true) continue;
        const key = `${f.attrs['ecosystem']}:${f.attrs['name']}`;
        groups.set(key, [...(groups.get(key) ?? []), { id: f.id, major: majorOf(String(f.attrs['version'])), ref: `${f.witness.file}:${f.witness.line}:${f.witness.hash}` }]);
    }
    const out = new Map<string, string[]>();
    for (const g of groups.values()) {
        if (new Set(g.map((x) => x.major)).size < 2) continue;
        for (const x of g) {
            const other = g.find((y) => y.major !== x.major)!;
            out.set(x.id, [`${x.ref}`, other.ref]);
        }
    }
    return out;
}

/** The lane with its cross-fact flags applied. */
export function readSystemsLane(root: string, opts: SystemsOptions = {}): LaneOutput {
    const out = readSystems(root, opts);
    const mm = multiMajor(out.facts);
    for (const f of out.facts) {
        const pair = mm.get(f.id);
        if (pair) {
            f.attrs['multi_major'] = true;
            f.attrs['multi_major_refs'] = pair;
        }
    }
    return out;
}
