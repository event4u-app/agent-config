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

import { parseCompose } from './infra_files/compose.js';
import { parseDockerfile } from './infra_files/dockerfile.js';
import { parsePipeline } from './infra_files/pipeline.js';
import { isComposeName, isDockerfileName, isGithubWorkflowPath, walkFiles } from './infra_files/walk.js';

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

const walk = (root: string, match: (name: string, rel: string) => boolean): string[] => walkFiles(root, match);

function lineOf(text: string, needle: string): number {
    const i = text.indexOf(needle);
    return i < 0 ? 1 : text.slice(0, i).split('\n').length;
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
    let doc: {
        engines?: Record<string, string>;
        packageManager?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    try {
        doc = JSON.parse(text);
    } catch {
        return [];
    }
    const out: InventoryEntry[] = [];
    // Direct dependencies, as declared ranges: what decides whether a fix is a
    // range bump of a direct dependency or an override of a transitive one.
    // A range is never queried as if it were a version.
    for (const [deps, scope] of [
        [doc.dependencies ?? {}, 'runtime'],
        [doc.devDependencies ?? {}, 'dev'],
    ] as const) {
        for (const [name, spec] of Object.entries(deps)) {
            if (typeof spec !== 'string') continue;
            out.push({
                ecosystem: 'npm',
                name,
                version: null,
                range: spec,
                provenance: 'declared',
                file: rel,
                line: lineOf(text, `"${name}"`),
                private: /^(file:|link:|git|github:|workspace:|\.|\/)/.test(spec),
                scope,
            });
        }
    }
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
    // Anchored: the image NAME must be exactly php or node (phpmyadmin, nodered/node-red are not).
    const m = /^(?:docker\.io\/)?(?:library\/)?(php|node)(?::([^@\s]+))?(?:@\S+)?$/.exec(ref);
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
    return parseDockerfile(text)
        .stages.filter((st) => !st.image.startsWith('$') && st.image !== 'scratch')
        .map((st) => imageEntry(st.image, 'image', rel, st.line));
}

function readCompose(rel: string, text: string): InventoryEntry[] {
    return parseCompose(text)
        .services.filter((s) => s.image !== null && !s.image.includes('${'))
        .map((s) => imageEntry(s.image!, 'image', rel, s.imageLine));
}

/** Workflow images, runtime setup keys and action pins, from the shared pipeline model. */
function readWorkflow(rel: string, text: string): InventoryEntry[] {
    const out: InventoryEntry[] = [];
    const action = (ref: string, line: number): void => {
        const m = /^([\w.-]+\/[\w./-]+)@(\S+)$/.exec(ref);
        if (!m) return;
        out.push({ ecosystem: 'GitHub Actions', name: m[1]!, version: m[2]!, range: null, provenance: 'ci', file: rel, line, private: false, scope: 'runtime' });
    };
    for (const job of parsePipeline(text, 'github').jobs) {
        for (const img of job.images) if (!img.ref.includes('${')) out.push(imageEntry(img.ref, 'ci', rel, img.line));
        if (job.uses) action(job.uses.ref, job.uses.line);
        for (const st of job.steps) {
            if (st.uses) action(st.uses.ref, st.uses.line);
            for (const key of ['node-version', 'php-version'] as const) {
                const v = st.with[key];
                if (v && !v.value.includes('${') && !/[[\]\s]/.test(v.value)) {
                    out.push(runtime(key === 'node-version' ? 'node' : 'php', v.value, 'ci', rel, v.line));
                }
            }
        }
    }
    return out.sort((x, y) => x.line - y.line);
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
    add(walk(root, isDockerfileName), readDockerfile);
    add(walk(root, isComposeName), readCompose);
    add(walk(root, (_n, rel) => isGithubWorkflowPath(rel)), readWorkflow);
    return list;
}

/** Read the whole inventory. Unreadable files are skipped, never guessed. */
/**
 * Lockfiles this inventory cannot read: yarn, pnpm and bun locks, and an npm
 * lock in the v1 format. Their packages are not in the inventory, so a refresh
 * must say "not checked" for them — an empty list from a lock nobody read would
 * otherwise read as a clean project.
 */
export function unsupportedLockfiles(root: string): string[] {
    const out = walk(root, (n) => n === 'yarn.lock' || n === 'pnpm-lock.yaml' || n === 'bun.lock' || n === 'bun.lockb');
    for (const rel of walk(root, (n) => n === 'package-lock.json')) {
        try {
            const v = (JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8')) as { lockfileVersion?: unknown }).lockfileVersion;
            if (v === 1 || v === undefined) out.push(rel);
        } catch {
            out.push(rel);
        }
    }
    return out.sort();
}

export function readInventory(root: string): Inventory {
    const hash = createHash('sha256');
    const finger = createHash('sha256');
    const entries: InventoryEntry[] = [];
    const files: string[] = [];
    for (const { rel, parse } of sources(root)) {
        let text: string;
        let st: fs.Stats;
        try {
            st = fs.statSync(path.join(root, rel));
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        files.push(rel);
        hash.update(`${rel}\0${text}\0`);
        finger.update(`${rel}\0${st.size}\0${st.mtimeMs}\0`);
        entries.push(...parse(rel, text));
    }
    // The same fingerprint `inventoryFingerprint` computes, from the same walk.
    return { entries, hash: hash.digest('hex'), fingerprint: finger.digest('hex'), files };
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
