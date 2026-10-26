/**
 * Lockfiles as a resolved package graph: which version of each package is
 * installed, and which package requires which.
 *
 * The advisory inventory reads the same lockfiles for versions only; a map has
 * to say *why* a package is there, and that needs the edges a lockfile records
 * between its entries. Every reader is offline and runs no package manager:
 * `npm explain` and `composer why` answer from these same files, so reading
 * them gives the same answer without executing anything (K25).
 *
 * Formats: npm `package-lock.json` v2/v3, `composer.lock`, `pnpm-lock.yaml`
 * (v6 and v9), `yarn.lock` (v1 and berry) and the text `bun.lock`. The binary
 * `bun.lockb` and an npm v1 lock are reported as unread, never guessed.
 */
import { parse as parseYaml } from 'yaml';

export type Ecosystem = 'npm' | 'composer';
export type DepKind = 'prod' | 'dev' | 'optional' | 'peer';

export interface LockRequire {
    name: string;
    range: string;
    kind: DepKind;
    /** the locked entry this resolves to, or null when the lock holds none */
    to: string | null;
}

export interface LockPackage {
    /** `<name>@<version>`, unique within one lockfile */
    key: string;
    name: string;
    version: string;
    /** 1-based line of the entry in the lockfile */
    line: number;
    /** only reachable from dev roots, when the lockfile says so */
    dev: boolean;
    optional: boolean;
    requires: LockRequire[];
    /** executables the package installs (npm `bin`, composer `bin`) */
    bins: string[];
    /** composer: PSR-4 / PSR-0 namespace prefixes, with a trailing `\` */
    namespaces: string[];
    /** composer: the package autoloads `files` (global functions) or a classmap */
    autoloadFiles: boolean;
    classmap: boolean;
    /** composer: service providers the framework discovers on its own */
    providers: string[];
    /** peers it asks the project to install */
    peers: string[];
    private: boolean;
}

export interface LockRoot {
    name: string;
    range: string;
    kind: DepKind;
    /** the manifest that declares it, repo-relative */
    manifest: string;
    line: number;
    /** workspace directory, '' for the root project */
    workspace: string;
    to: string | null;
}

export interface LockGraph {
    file: string;
    ecosystem: Ecosystem;
    format: string;
    packages: Map<string, LockPackage>;
    roots: LockRoot[];
    /** runtime constraints the lockfile records (`composer.lock` `platform`) */
    platform: Array<{ name: string; value: string; line: number }>;
}

export interface Manifest {
    /** repo-relative path */
    file: string;
    text: string;
}

function lineOf(text: string, needle: string, from = 0): number {
    const i = text.indexOf(needle, from);
    return i < 0 ? 1 : text.slice(0, i).split('\n').length;
}

const dirOf = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const join = (dir: string, rel: string): string => (dir ? `${dir}/${rel}` : rel);

function blank(name: string, version: string, line: number): LockPackage {
    return { key: `${name}@${version}`, name, version, line, dev: false, optional: false, requires: [], bins: [], namespaces: [], autoloadFiles: false, classmap: false, providers: [], peers: [], private: false };
}

type DepMap = Record<string, unknown> | undefined;
const entries = (m: DepMap): Array<[string, string]> => Object.entries(m ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string');

/** Roots a `package.json` declares, unresolved. */
export function manifestRoots(m: Manifest): LockRoot[] {
    let doc: { dependencies?: DepMap; devDependencies?: DepMap; optionalDependencies?: DepMap; peerDependencies?: DepMap };
    try {
        doc = JSON.parse(m.text);
    } catch {
        return [];
    }
    const out: LockRoot[] = [];
    const add = (map: DepMap, kind: DepKind, section: string): void => {
        const at = m.text.indexOf(`"${section}"`);
        for (const [name, range] of entries(map)) {
            out.push({ name, range, kind, manifest: m.file, line: lineOf(m.text, `"${name}"`, Math.max(0, at)), workspace: dirOf(m.file), to: null });
        }
    };
    add(doc.dependencies, 'prod', 'dependencies');
    add(doc.devDependencies, 'dev', 'devDependencies');
    add(doc.optionalDependencies, 'optional', 'optionalDependencies');
    add(doc.peerDependencies, 'peer', 'peerDependencies');
    return out;
}

/** Roots a `composer.json` declares; platform packages (`php`, `ext-*`, `lib-*`) are runtimes, not packages. */
export function composerRoots(m: Manifest): LockRoot[] {
    let doc: { require?: DepMap; 'require-dev'?: DepMap };
    try {
        doc = JSON.parse(m.text);
    } catch {
        return [];
    }
    const out: LockRoot[] = [];
    for (const [map, kind, section] of [
        [doc.require, 'prod', 'require'],
        [doc['require-dev'], 'dev', 'require-dev'],
    ] as const) {
        const at = m.text.indexOf(`"${section}"`);
        for (const [name, range] of entries(map)) {
            if (isPlatform(name)) continue;
            out.push({ name, range, kind, manifest: m.file, line: lineOf(m.text, `"${name}"`, Math.max(0, at)), workspace: dirOf(m.file), to: null });
        }
    }
    return out;
}

export const isPlatform = (name: string): boolean => name === 'php' || name === 'hhvm' || /^(ext|lib)-/.test(name) || name === 'composer-plugin-api' || name === 'composer-runtime-api' || name === 'composer';


interface NpmEntry {
    name?: string;
    version?: string;
    dependencies?: DepMap;
    optionalDependencies?: DepMap;
    peerDependencies?: DepMap;
    devDependencies?: DepMap;
    dev?: boolean;
    optional?: boolean;
    devOptional?: boolean;
    link?: boolean;
    resolved?: string;
    bin?: Record<string, string> | string;
}

const nameFromKey = (key: string): string => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);

/** Node's resolution: the nearest `node_modules/<name>` walking up from the requiring entry. */
function npmResolve(pkgs: Record<string, NpmEntry>, fromKey: string, name: string): string | null {
    let prefix = fromKey;
    for (;;) {
        const cand = prefix ? `${prefix}/node_modules/${name}` : `node_modules/${name}`;
        if (pkgs[cand]) return cand;
        if (!prefix) return null;
        const i = prefix.lastIndexOf('/node_modules/');
        prefix = i >= 0 ? prefix.slice(0, i) : '';
    }
}

export function readNpmLock(file: string, text: string): LockGraph | { unread: string } {
    let doc: { lockfileVersion?: number; packages?: Record<string, NpmEntry> };
    try {
        doc = JSON.parse(text);
    } catch {
        return { unread: 'not valid JSON' };
    }
    if (!doc.packages || (doc.lockfileVersion ?? 1) < 2) return { unread: 'npm lockfile v1 has no packages map' };
    const pkgs = doc.packages;
    const keyOf = new Map<string, string>(); // lock path → package key
    const g: LockGraph = { file, ecosystem: 'npm', format: `npm-v${doc.lockfileVersion}`, packages: new Map(), roots: [], platform: [] };
    const resolveLink = (k: string): string => {
        const e = pkgs[k];
        return e?.link && typeof e.resolved === 'string' ? e.resolved : k;
    };
    for (const [k, e] of Object.entries(pkgs)) {
        if (!k.includes('node_modules/') || e.link || typeof e.version !== 'string') continue;
        const name = e.name ?? nameFromKey(k);
        const p = blank(name, e.version, lineOf(text, `"${k}": {`));
        p.dev = e.dev === true;
        p.optional = e.optional === true;
        p.bins = typeof e.bin === 'string' ? [name.replace(/^@[^/]+\//, '')] : Object.keys(e.bin ?? {});
        p.peers = Object.keys(e.peerDependencies ?? {});
        p.private = typeof e.resolved === 'string' && !/^https:\/\/registry\.npmjs\.org\//.test(e.resolved);
        if (!g.packages.has(p.key)) g.packages.set(p.key, p);
        keyOf.set(k, p.key);
    }
    for (const [k, e] of Object.entries(pkgs)) {
        const owner = keyOf.get(k);
        if (!owner) continue;
        const p = g.packages.get(owner)!;
        for (const [map, kind] of [
            [e.dependencies, 'prod'],
            [e.optionalDependencies, 'optional'],
            [e.peerDependencies, 'peer'],
        ] as const) {
            for (const [name, range] of entries(map)) {
                if (p.requires.some((r) => r.name === name)) continue;
                const hit = npmResolve(pkgs, k, name);
                p.requires.push({ name, range, kind, to: hit ? (keyOf.get(resolveLink(hit)) ?? null) : null });
            }
        }
    }
    // Roots: the root project and every workspace entry (a key without node_modules/).
    for (const [k, e] of Object.entries(pkgs)) {
        if (k.includes('node_modules/')) continue;
        const manifest = join(join(dirOf(file), k), 'package.json');
        for (const [map, kind] of [
            [e.dependencies, 'prod'],
            [e.devDependencies, 'dev'],
            [e.optionalDependencies, 'optional'],
            [e.peerDependencies, 'peer'],
        ] as const) {
            for (const [name, range] of entries(map)) {
                const hit = npmResolve(pkgs, k, name);
                g.roots.push({ name, range, kind, manifest, line: 0, workspace: join(dirOf(file), k), to: hit ? (keyOf.get(resolveLink(hit)) ?? null) : null });
            }
        }
    }
    return g;
}


interface ComposerPkg {
    name?: string;
    version?: string;
    require?: DepMap;
    'require-dev'?: DepMap;
    bin?: string[];
    autoload?: { 'psr-4'?: Record<string, unknown>; 'psr-0'?: Record<string, unknown>; files?: unknown[]; classmap?: unknown[] };
    extra?: { laravel?: { providers?: unknown[] } };
    'notification-url'?: string;
}

export function readComposerLock(file: string, text: string, manifest: Manifest | null): LockGraph | { unread: string } {
    let doc: { packages?: ComposerPkg[]; 'packages-dev'?: ComposerPkg[]; platform?: DepMap; 'platform-dev'?: DepMap };
    try {
        doc = JSON.parse(text);
    } catch {
        return { unread: 'not valid JSON' };
    }
    const g: LockGraph = { file, ecosystem: 'composer', format: 'composer', packages: new Map(), roots: [], platform: [] };
    const byName = new Map<string, string>();
    const all: Array<[ComposerPkg, boolean]> = [...(doc.packages ?? []).map((p) => [p, false] as [ComposerPkg, boolean]), ...(doc['packages-dev'] ?? []).map((p) => [p, true] as [ComposerPkg, boolean])];
    for (const [c, dev] of all) {
        if (typeof c.name !== 'string' || typeof c.version !== 'string') continue;
        const p = blank(c.name, c.version.replace(/^v(?=\d)/, ''), lineOf(text, `"name": "${c.name}"`));
        p.dev = dev;
        p.bins = (c.bin ?? []).filter((b): b is string => typeof b === 'string').map((b) => b.slice(b.lastIndexOf('/') + 1));
        p.namespaces = [...Object.keys(c.autoload?.['psr-4'] ?? {}), ...Object.keys(c.autoload?.['psr-0'] ?? {})].filter(Boolean).map((n) => (n.endsWith('\\') ? n : `${n}\\`));
        p.autoloadFiles = (c.autoload?.files ?? []).length > 0;
        p.classmap = (c.autoload?.classmap ?? []).length > 0;
        p.providers = (c.extra?.laravel?.providers ?? []).filter((x): x is string => typeof x === 'string');
        p.private = c['notification-url'] !== 'https://packagist.org/downloads/';
        g.packages.set(p.key, p);
        byName.set(c.name.toLowerCase(), p.key);
    }
    for (const [c] of all) {
        const p = typeof c.name === 'string' ? g.packages.get(byName.get(c.name.toLowerCase()) ?? '') : undefined;
        if (!p) continue;
        for (const [name, range] of entries(c.require)) {
            if (isPlatform(name)) continue;
            p.requires.push({ name, range, kind: 'prod', to: byName.get(name.toLowerCase()) ?? null });
        }
    }
    for (const [name, value] of [...entries(doc.platform), ...entries(doc['platform-dev'])]) {
        g.platform.push({ name, value, line: lineOf(text, `"${name}": "${value}"`) });
    }
    if (manifest) {
        for (const r of composerRoots(manifest)) g.roots.push({ ...r, to: byName.get(r.name.toLowerCase()) ?? null });
    }
    return g;
}


/** `/a@1.0.0`, `a@1.0.0(peer@2.0.0)`, `@s/a@1.0.0` → name and version. */
function splitPnpmKey(key: string): { name: string; version: string } | null {
    const k = key.replace(/^\//, '').replace(/\(.*$/, '');
    const at = k.lastIndexOf('@');
    if (at <= 0) return null;
    return { name: k.slice(0, at), version: k.slice(at + 1) };
}

const pnpmVersion = (v: string): string => v.replace(/\(.*$/, '');

export function readPnpmLock(file: string, text: string): LockGraph | { unread: string } {
    type Dep = string | { specifier?: string; version?: string };
    type Pkg = { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; dev?: boolean; optional?: boolean };
    let doc: {
        lockfileVersion?: string | number;
        importers?: Record<string, { dependencies?: Record<string, Dep>; devDependencies?: Record<string, Dep>; optionalDependencies?: Record<string, Dep> }>;
        dependencies?: Record<string, Dep>;
        devDependencies?: Record<string, Dep>;
        packages?: Record<string, Pkg>;
        snapshots?: Record<string, Pkg>;
    };
    try {
        doc = parseYaml(text) as typeof doc;
    } catch {
        return { unread: 'not valid YAML' };
    }
    if (!doc || typeof doc !== 'object') return { unread: 'empty' };
    const g: LockGraph = { file, ecosystem: 'npm', format: `pnpm-v${doc.lockfileVersion ?? '?'}`, packages: new Map(), roots: [], platform: [] };
    const body = { ...(doc.packages ?? {}) };
    for (const [k, v] of Object.entries(doc.snapshots ?? {})) {
        const base = k.replace(/\(.*$/, '');
        body[base] = { ...(body[base] ?? {}), ...v };
    }
    const keyFor = (name: string, version: string): string | null => {
        const v = pnpmVersion(version);
        if (v.startsWith('link:') || v.startsWith('file:')) return null;
        const key = `${name}@${v}`;
        return g.packages.has(key) ? key : null;
    };
    for (const [k, e] of Object.entries(body)) {
        const nv = splitPnpmKey(k);
        if (!nv) continue;
        const p = blank(nv.name, nv.version, lineOf(text, k.startsWith('/') ? `${k}:` : `${k}:`));
        p.dev = e.dev === true;
        p.optional = e.optional === true;
        p.peers = Object.keys(e.peerDependencies ?? {});
        if (!g.packages.has(p.key)) g.packages.set(p.key, p);
    }
    for (const [k, e] of Object.entries(body)) {
        const nv = splitPnpmKey(k);
        const p = nv ? g.packages.get(`${nv.name}@${nv.version}`) : undefined;
        if (!p || p.requires.length) continue;
        for (const [map, kind] of [
            [e.dependencies, 'prod'],
            [e.optionalDependencies, 'optional'],
        ] as const) {
            for (const [name, version] of Object.entries(map ?? {})) p.requires.push({ name, range: String(version), kind, to: keyFor(name, String(version)) });
        }
    }
    const importers = doc.importers ?? { '.': { dependencies: doc.dependencies, devDependencies: doc.devDependencies } };
    for (const [dir, imp] of Object.entries(importers)) {
        const ws = dir === '.' ? dirOf(file) : join(dirOf(file), dir);
        for (const [map, kind] of [
            [imp.dependencies, 'prod'],
            [imp.devDependencies, 'dev'],
            [imp.optionalDependencies, 'optional'],
        ] as const) {
            for (const [name, dep] of Object.entries((map ?? {}) as Record<string, Dep>)) {
                const version = typeof dep === 'string' ? dep : (dep.version ?? '');
                const range = typeof dep === 'string' ? dep : (dep.specifier ?? version);
                g.roots.push({ name, range, kind, manifest: join(ws, 'package.json'), line: 0, workspace: ws, to: keyFor(name, version) });
            }
        }
    }
    return g;
}


/** `"a@^1", a@~1.2` → the descriptors of one yarn v1 block header. */
function yarnDescriptors(header: string): string[] {
    return header
        .replace(/:$/, '')
        .split(/,\s*/)
        .map((d) => d.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
}

const descriptorName = (d: string): string => {
    const at = d.indexOf('@', 1);
    return at < 0 ? d : d.slice(0, at);
};

export function readYarnLock(file: string, text: string, manifests: readonly Manifest[]): LockGraph | { unread: string } {
    const g: LockGraph = { file, ecosystem: 'npm', format: 'yarn', packages: new Map(), roots: [], platform: [] };
    const byDescriptor = new Map<string, string>();
    const pending: Array<{ key: string; deps: Array<[string, string, DepKind]> }> = [];
    if (/^__metadata:/m.test(text)) {
        // berry: valid YAML
        g.format = 'yarn-berry';
        let doc: Record<string, { version?: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string>; bin?: Record<string, string>; resolution?: string }>;
        try {
            doc = parseYaml(text) as typeof doc;
        } catch {
            return { unread: 'not valid YAML' };
        }
        for (const [header, e] of Object.entries(doc)) {
            if (header === '__metadata' || typeof e?.version !== 'string') continue;
            const descs = header.split(/,\s*/).map((d) => d.trim());
            const name = descriptorName(descs[0] ?? '');
            if (/@workspace:/.test(header)) continue;
            const p = blank(name, e.version, lineOf(text, header));
            p.bins = Object.keys(e.bin ?? {});
            p.peers = Object.keys(e.peerDependencies ?? {});
            const key = p.key;
            if (!g.packages.has(key)) g.packages.set(key, p);
            for (const d of descs) byDescriptor.set(d, key);
            pending.push({ key, deps: Object.entries(e.dependencies ?? {}).map(([n, r]) => [n, String(r), 'prod'] as [string, string, DepKind]) });
        }
    } else {
        const lines = text.split('\n');
        let cur: { key: string; deps: Array<[string, string, DepKind]> } | null = null;
        let section: DepKind | null = null;
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i] as string;
            if (!l.trim() || l.startsWith('#')) continue;
            if (!l.startsWith(' ')) {
                const descs = yarnDescriptors(l);
                const name = descriptorName(descs[0] ?? '');
                const vm = /^ {2}version "?([^"\s]+)"?/.exec(lines[i + 1] ?? '');
                if (!vm) {
                    cur = null;
                    continue;
                }
                const p = blank(name, vm[1] as string, i + 1);
                if (!g.packages.has(p.key)) g.packages.set(p.key, p);
                for (const d of descs) byDescriptor.set(d, p.key);
                cur = { key: p.key, deps: [] };
                pending.push(cur);
                section = null;
                continue;
            }
            if (!cur) continue;
            const sec = /^ {2}(dependencies|optionalDependencies):$/.exec(l);
            if (sec) {
                section = sec[1] === 'dependencies' ? 'prod' : 'optional';
                continue;
            }
            if (/^ {2}\S/.test(l)) {
                section = null;
                continue;
            }
            const dep = section ? /^ {4}"?([^"\s]+)"?\s+"?([^"]+?)"?\s*$/.exec(l) : null;
            if (dep) cur.deps.push([dep[1] as string, dep[2] as string, section as DepKind]);
        }
    }
    const resolve = (name: string, range: string): string | null =>
        byDescriptor.get(`${name}@${range}`) ?? byDescriptor.get(`${name}@npm:${range}`) ?? byDescriptor.get(`${name}@${range.replace(/^npm:/, '')}`) ?? null;
    for (const { key, deps } of pending) {
        const p = g.packages.get(key)!;
        if (p.requires.length) continue;
        for (const [name, range, kind] of deps) p.requires.push({ name, range, kind, to: resolve(name, range) });
    }
    for (const m of manifests) for (const r of manifestRoots(m)) g.roots.push({ ...r, to: resolve(r.name, r.range) });
    return g;
}


/** JSON with trailing commas (bun.lock's text form), parsed without touching strings. */
export function parseJsonc(text: string): unknown {
    let out = '';
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i] as string;
        if (inStr) {
            out += c;
            if (c === '\\') {
                out += text[++i] ?? '';
                continue;
            }
            if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') {
            inStr = true;
            out += c;
            continue;
        }
        if (c === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }
        if (c === ',') {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j] as string)) j++;
            if (text[j] === '}' || text[j] === ']') continue;
        }
        out += c;
    }
    return JSON.parse(out);
}

export function readBunLock(file: string, text: string): LockGraph | { unread: string } {
    type Meta = { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; bin?: Record<string, string> };
    let doc: { workspaces?: Record<string, { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }>; packages?: Record<string, unknown[]> };
    try {
        doc = parseJsonc(text) as typeof doc;
    } catch {
        return { unread: 'not valid JSON' };
    }
    const g: LockGraph = { file, ecosystem: 'npm', format: 'bun', packages: new Map(), roots: [], platform: [] };
    const keyOf = new Map<string, string>(); // bun path ("a", "b/a") → package key
    for (const [path, tuple] of Object.entries(doc.packages ?? {})) {
        const ident = typeof tuple?.[0] === 'string' ? (tuple[0] as string) : '';
        const at = ident.lastIndexOf('@');
        if (at <= 0 || ident.includes('@workspace:')) continue;
        const p = blank(ident.slice(0, at), ident.slice(at + 1).replace(/^npm:/, ''), lineOf(text, `"${path}": [`));
        const meta = (tuple.find((x) => x && typeof x === 'object' && !Array.isArray(x)) ?? {}) as Meta;
        p.bins = Object.keys(meta.bin ?? {});
        p.peers = Object.keys(meta.peerDependencies ?? {});
        if (!g.packages.has(p.key)) g.packages.set(p.key, p);
        keyOf.set(path, p.key);
    }
    const resolve = (from: string, name: string): string | null => {
        const parts = from ? from.split('/') : [];
        for (let i = parts.length; i >= 0; i--) {
            const k = [...parts.slice(0, i), name].join('/');
            if (keyOf.has(k)) return keyOf.get(k)!;
        }
        return null;
    };
    for (const [path, tuple] of Object.entries(doc.packages ?? {})) {
        const p = g.packages.get(keyOf.get(path) ?? '');
        if (!p || p.requires.length) continue;
        const meta = (tuple.find((x) => x && typeof x === 'object' && !Array.isArray(x)) ?? {}) as Meta;
        for (const [map, kind] of [
            [meta.dependencies, 'prod'],
            [meta.optionalDependencies, 'optional'],
        ] as const) {
            for (const [name, range] of Object.entries(map ?? {})) p.requires.push({ name, range, kind, to: resolve(path, name) });
        }
    }
    for (const [dir, ws] of Object.entries(doc.workspaces ?? {})) {
        const wsDir = join(dirOf(file), dir);
        for (const [map, kind] of [
            [ws.dependencies, 'prod'],
            [ws.devDependencies, 'dev'],
            [ws.optionalDependencies, 'optional'],
        ] as const) {
            for (const [name, range] of Object.entries(map ?? {})) g.roots.push({ name, range, kind, manifest: join(wsDir, 'package.json'), line: 0, workspace: wsDir, to: resolve('', name) });
        }
    }
    return g;
}

/** Dev flags where a lockfile records none: a package reachable only from dev roots. */
export function markDevOnly(g: LockGraph): void {
    if (g.format.startsWith('npm') || g.ecosystem === 'composer') return; // these record it
    const reach = (kinds: ReadonlySet<DepKind>): Set<string> => {
        const seen = new Set<string>();
        const stack = g.roots.filter((r) => kinds.has(r.kind) && r.to).map((r) => r.to as string);
        while (stack.length) {
            const k = stack.pop() as string;
            if (seen.has(k)) continue;
            seen.add(k);
            for (const r of g.packages.get(k)?.requires ?? []) if (r.to && r.kind !== 'peer') stack.push(r.to);
        }
        return seen;
    };
    const prod = reach(new Set<DepKind>(['prod', 'optional', 'peer']));
    for (const p of g.packages.values()) p.dev = !prod.has(p.key);
}

/** Fill in manifest line numbers for roots a lockfile names without them. */
export function attachManifestLines(g: LockGraph, manifests: ReadonlyMap<string, string>): void {
    for (const r of g.roots) {
        if (r.line > 0) continue;
        const text = manifests.get(r.manifest);
        r.line = text ? lineOf(text, `"${r.name}"`) : 1;
    }
}
