/**
 * What a project actually runs — the input to every advisory question
 * (road-to-advisories-heard-the-same-day Phase 1).
 *
 * Deterministic and offline: it reads files, never a network and never a
 * package manager. Each entry carries the `file:line` it was read from and a
 * provenance, because a declared range and a deployed version are different
 * claims: `composer.json` saying `"php": "^8.3"` is not the PHP a Dockerfile
 * pins, and reporting one as the other is the confusion the roadmap names.
 *
 * Private names (path / link / VCS dependencies, packages from a registry other
 * than the public one) are marked here, once, so no later stage has to decide
 * it again — every outbound query filters on this flag (D4).
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Ecosystem = 'npm' | 'Packagist' | 'GitHub Actions' | 'runtime' | 'manager' | 'image';
export type Provenance = 'lockfile' | 'declared' | 'image' | 'ci';

export interface InventoryEntry {
    ecosystem: Ecosystem;
    /** Package name, runtime (`php`, `node`), manager (`npm`, `composer`), or image. */
    name: string;
    /** Exact version when the source pins one, else `null`. */
    version: string | null;
    /** The declared range when the source only constrains, else `null`. */
    range: string | null;
    provenance: Provenance;
    /** Repo-relative path of the file read. */
    file: string;
    line: number;
    /** Never sent to a public service. */
    private: boolean;
    /** `dev` for development-only lockfile packages; `null` where unknown. */
    scope: 'runtime' | 'dev' | null;
}

export interface Inventory {
    entries: InventoryEntry[];
    /** sha256 over every file read, in order. */
    hash: string;
    /** `inventoryFingerprint` at read time — the cheap reuse check (1.2). */
    fingerprint: string;
    files: string[];
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', '.claude', '.worktrees', 'coverage', '.next']);
const MAX_DEPTH = 4;

function lineOf(text: string, needle: string): number {
    const i = text.indexOf(needle);
    return i < 0 ? 1 : text.slice(0, i).split('\n').length;
}

/** Repo-relative files whose basename matches, walked to a bounded depth. */
function walk(root: string, match: (name: string, rel: string) => boolean): string[] {
    const out: string[] = [];
    const visit = (dir: string, depth: number): void => {
        let names: fs.Dirent[];
        try {
            names = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const d of names) {
            const abs = path.join(dir, d.name);
            const rel = path.relative(root, abs);
            if (d.isDirectory()) {
                if (depth < MAX_DEPTH && !SKIP_DIRS.has(d.name)) visit(abs, depth + 1);
            } else if (d.isFile() && match(d.name, rel)) {
                out.push(rel);
            }
        }
    };
    visit(root, 0);
    return out.sort();
}

const PUBLIC_NPM = /^https:\/\/registry\.npmjs\.org\//;

/** package-lock.json v2/v3 — the `packages` map is the resolved tree. */
function readNpmLock(rel: string, text: string): InventoryEntry[] {
    let doc: { packages?: Record<string, { version?: string; resolved?: string; dev?: boolean; link?: boolean }> };
    try {
        doc = JSON.parse(text);
    } catch {
        return [];
    }
    const out: InventoryEntry[] = [];
    for (const [key, pkg] of Object.entries(doc.packages ?? {})) {
        if (key === '' || typeof pkg?.version !== 'string') continue;
        const name = key.replace(/^.*node_modules\//, '');
        const resolved = typeof pkg.resolved === 'string' ? pkg.resolved : '';
        out.push({
            ecosystem: 'npm',
            name,
            version: pkg.version,
            range: null,
            provenance: 'lockfile',
            file: rel,
            line: lineOf(text, `"${key}": {`),
            private: pkg.link === true || !PUBLIC_NPM.test(resolved),
            scope: pkg.dev === true ? 'dev' : 'runtime',
        });
    }
    return out;
}

/** composer.lock — a package without the public Packagist notification URL is private. */
function readComposerLock(rel: string, text: string): InventoryEntry[] {
    type Pkg = { name?: string; version?: string; 'notification-url'?: string };
    let doc: { packages?: Pkg[]; 'packages-dev'?: Pkg[] };
    try {
        doc = JSON.parse(text);
    } catch {
        return [];
    }
    const out: InventoryEntry[] = [];
    for (const [list, scope] of [
        [doc.packages ?? [], 'runtime'],
        [doc['packages-dev'] ?? [], 'dev'],
    ] as const) {
        for (const p of list) {
            if (typeof p.name !== 'string' || typeof p.version !== 'string') continue;
            out.push({
                ecosystem: 'Packagist',
                name: p.name,
                version: p.version.replace(/^v(?=\d)/, ''),
                range: null,
                provenance: 'lockfile',
                file: rel,
                line: lineOf(text, `"name": "${p.name}"`),
                private: p['notification-url'] !== 'https://packagist.org/downloads/',
                scope,
            });
        }
    }
    return out;
}

function runtime(
    name: string,
    value: string,
    provenance: Provenance,
    file: string,
    line: number,
): InventoryEntry {
    const v = value.trim();
    const exact = /^v?\d+(\.\d+){0,2}([-+.][0-9A-Za-z.]+)*$/.test(v);
    return {
        ecosystem: 'runtime',
        name,
        version: exact ? v.replace(/^v/, '') : null,
        range: exact ? null : v,
        provenance,
        file,
        line,
        private: false,
        scope: 'runtime',
    };
}

function readComposerJson(rel: string, text: string): InventoryEntry[] {
    let doc: { require?: Record<string, string>; config?: { platform?: Record<string, string> } };
    try {
        doc = JSON.parse(text);
    } catch {
        return [];
    }
    const out: InventoryEntry[] = [];
    const req = doc.require?.['php'];
    if (typeof req === 'string') out.push(runtime('php', req, 'declared', rel, lineOf(text, '"php"')));
    const platform = doc.config?.platform?.['php'];
    if (typeof platform === 'string') {
        out.push(runtime('php', platform, 'declared', rel, lineOf(text, '"platform"')));
    }
    return out;
}

function readPackageJson(rel: string, text: string): InventoryEntry[] {
    let doc: { engines?: Record<string, string>; packageManager?: string };
    try {
        doc = JSON.parse(text);
    } catch {
        return [];
    }
    const out: InventoryEntry[] = [];
    const node = doc.engines?.['node'];
    if (typeof node === 'string') out.push(runtime('node', node, 'declared', rel, lineOf(text, '"engines"')));
    const pm = /^(npm|pnpm|yarn|bun)@(\d[^+\s]*)/.exec(doc.packageManager ?? '');
    if (pm) {
        out.push({
            ecosystem: 'manager',
            name: pm[1]!,
            version: pm[2]!,
            range: null,
            provenance: 'declared',
            file: rel,
            line: lineOf(text, '"packageManager"'),
            private: false,
            scope: 'runtime',
        });
    }
    return out;
}

/** `.nvmrc`, `.node-version`, `.php-version` — one version, first non-comment line. */
function readVersionFile(rel: string, text: string, name: 'node' | 'php'): InventoryEntry[] {
    const lines = text.split('\n');
    const i = lines.findIndex((l) => l.trim() !== '' && !l.trim().startsWith('#'));
    return i < 0 ? [] : [runtime(name, lines[i]!.trim(), 'declared', rel, i + 1)];
}

/** `.tool-versions` (asdf) and `mise.toml` [tools]. */
function readToolVersions(rel: string, text: string): InventoryEntry[] {
    const out: InventoryEntry[] = [];
    text.split('\n').forEach((raw, i) => {
        const l = raw.replace(/#.*/, '').trim();
        const asdf = /^(nodejs|node|php)\s+(\S+)/.exec(l);
        const mise = /^(node|php)\s*=\s*["']?([^"'\s]+)["']?/.exec(l);
        const m = asdf ?? mise;
        if (m) out.push(runtime(m[1] === 'nodejs' ? 'node' : m[1]!, m[2]!, 'declared', rel, i + 1));
    });
    return out;
}

/**
 * An official `php` or `node` image tag names the runtime it ships
 * (`php:8.3.12-fpm` → php 8.3.12). Any other image is recorded as an image,
 * never guessed into a runtime.
 */
function imageEntry(ref: string, provenance: Provenance, file: string, line: number): InventoryEntry {
    const m = /^(?:docker\.io\/)?(?:library\/)?(php|node)(?::([^@\s]+))?/.exec(ref);
    if (m) {
        const tag = m[2] ?? 'latest';
        const num = /^(\d+(?:\.\d+){0,2})/.exec(tag);
        return runtime(m[1]!, num ? num[1]! : tag, provenance, file, line);
    }
    const [name, tag] = ref.split(/[:@]/, 2) as [string, string | undefined];
    return {
        ecosystem: 'image',
        name,
        version: tag ?? null,
        range: null,
        provenance,
        file,
        line,
        private: false,
        scope: 'runtime',
    };
}

function readDockerfile(rel: string, text: string): InventoryEntry[] {
    const out: InventoryEntry[] = [];
    text.split('\n').forEach((raw, i) => {
        const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/i.exec(raw);
        if (m && !m[1]!.startsWith('$') && m[1] !== 'scratch') out.push(imageEntry(m[1]!, 'image', rel, i + 1));
    });
    return out;
}

/** Compose files and CI workflows: `image:` lines, runtime setup keys, action pins. */
function readYaml(rel: string, text: string, ci: boolean): InventoryEntry[] {
    const out: InventoryEntry[] = [];
    const prov: Provenance = ci ? 'ci' : 'image';
    text.split('\n').forEach((raw, i) => {
        const l = raw.replace(/\s#.*$/, '');
        const img = /^\s*image:\s*["']?([^"'\s]+)["']?\s*$/.exec(l);
        if (img && !img[1]!.includes('${')) out.push(imageEntry(img[1]!, prov, rel, i + 1));
        if (!ci) return;
        const setup = /^\s*(node-version|php-version):\s*["']?([^"'\s[\]]+)["']?\s*$/.exec(l);
        if (setup && !setup[2]!.includes('${')) {
            out.push(runtime(setup[1] === 'node-version' ? 'node' : 'php', setup[2]!, 'ci', rel, i + 1));
        }
        const uses = /^\s*-?\s*uses:\s*["']?([\w.-]+\/[\w./-]+)@([^"'\s]+)["']?/.exec(l);
        if (uses) {
            out.push({
                ecosystem: 'GitHub Actions',
                name: uses[1]!,
                version: uses[2]!,
                range: null,
                provenance: 'ci',
                file: rel,
                line: i + 1,
                private: false,
                scope: 'runtime',
            });
        }
    });
    return out;
}

/** Every file this reader consults, with the parser for it. */
function sources(root: string): Array<{ rel: string; parse: (rel: string, text: string) => InventoryEntry[] }> {
    const list: Array<{ rel: string; parse: (rel: string, text: string) => InventoryEntry[] }> = [];
    const add = (rels: string[], parse: (rel: string, text: string) => InventoryEntry[]): void => {
        for (const rel of rels) list.push({ rel, parse });
    };
    add(walk(root, (n) => n === 'package-lock.json'), readNpmLock);
    add(walk(root, (n) => n === 'composer.lock'), readComposerLock);
    add(walk(root, (n) => n === 'composer.json'), readComposerJson);
    add(walk(root, (n) => n === 'package.json'), readPackageJson);
    add(walk(root, (n) => n === '.nvmrc' || n === '.node-version'), (r, t) => readVersionFile(r, t, 'node'));
    add(walk(root, (n) => n === '.php-version'), (r, t) => readVersionFile(r, t, 'php'));
    add(walk(root, (n) => n === '.tool-versions' || n === 'mise.toml' || n === '.mise.toml'), readToolVersions);
    add(walk(root, (n) => /^Dockerfile(\..+)?$/.test(n) || n.endsWith('.Dockerfile')), readDockerfile);
    add(walk(root, (n) => /^(docker-)?compose(\.[\w-]+)?\.ya?ml$/.test(n)), (r, t) => readYaml(r, t, false));
    add(
        walk(root, (_n, rel) => /^\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$/.test(rel)),
        (r, t) => readYaml(r, t, true),
    );
    return list;
}

/** Read the whole inventory. Unreadable files are skipped, never guessed. */
export function readInventory(root: string): Inventory {
    const hash = createHash('sha256');
    const entries: InventoryEntry[] = [];
    const files: string[] = [];
    for (const { rel, parse } of sources(root)) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        files.push(rel);
        hash.update(`${rel}\0${text}\0`);
        entries.push(...parse(rel, text));
    }
    return { entries, hash: hash.digest('hex'), fingerprint: inventoryFingerprint(root), files };
}

/**
 * A fingerprint over every source file's path, size and mtime — never its
 * body. Equal to the stored one means the stored inventory is still current,
 * and no lockfile is read at all (1.2).
 */
export function inventoryFingerprint(root: string): string {
    const hash = createHash('sha256');
    for (const { rel } of sources(root)) {
        try {
            const st = fs.statSync(path.join(root, rel));
            hash.update(`${rel}\0${st.size}\0${st.mtimeMs}\0`);
        } catch {
            /* an unreadable file is absent from both the fingerprint and the inventory */
        }
    }
    return hash.digest('hex');
}
