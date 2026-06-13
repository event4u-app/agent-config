// Resource loader — exposes rules, guidelines, contexts as MCP resources.
//
// Phase 3 (C1–C4) extends the read-only MCP surface from prompts (skills
// + commands) to read-only **resources** for the governance layer:
//
// - `rule://<basename>`             — `dist/agent-src/rules/*.md`
// - `guideline://<relpath-no-ext>`  — `docs/guidelines/**/*.md`
// - `context://<relpath-no-ext>`    — `dist/agent-src/contexts/**/*.md`
//
// All three are served with `mimeType=text/markdown`. The merge-at-sync
// contract is the same as for prompts: `dist/agent-src/` is already the
// package + project merged view; this loader does not re-merge.
//
// Description resolution: frontmatter `description:` wins, else the
// first H1 line (`# Title`) is used as a title-style fallback, else the
// filename-derived stem.
//
// TS twin of resources.py (py2ts Phase 8). Mirrors the full public surface:
//   ResourceKind, MIME_MARKDOWN, Resource, scan_rules, scan_guidelines,
//   scan_contexts, load_all_resources, to_mcp_resource_meta, ResourceCache.
//   Imports `_project_root` + `_strip_frontmatter` from prompts.ts
//   (mirrors `from .prompts import _project_root, _strip_frontmatter`).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { _project_root, _strip_frontmatter } from './prompts.js';

export type ResourceKind = 'rule' | 'guideline' | 'context';
export const MIME_MARKDOWN = 'text/markdown';

/**
 * Resolved Markdown asset ready for MCP exposure.
 *
 * Mirrors the Python frozen dataclass field order and defaults
 * (source="package", mime_type=MIME_MARKDOWN, kind="rule").
 */
export interface Resource {
    readonly uri: string;
    readonly name: string;
    readonly description: string;
    readonly body: string;
    readonly source: string;
    readonly mime_type: string;
    readonly kind: ResourceKind;
}

// Python: re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
const _H1_RE = /^#\s+(.+?)\s*$/m;

function _derive_description(
    meta: Record<string, string>,
    body: string,
    fallback: string,
): string {
    const desc = (meta.description ?? '').trim();
    if (desc) {
        return desc;
    }
    const match = _H1_RE.exec(body);
    if (match) {
        return (match[1] as string).trim();
    }
    return fallback;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Mirror Python `str.rstrip()`. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
}

function _excText(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

/**
 * pathlib `Path` ordering: compare path COMPONENTS lexicographically
 * (CPython `PurePath.__lt__`). See prompts.ts for the rationale.
 */
function _pathlibCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** Sorted single-level `*.md` paths (mirrors `sorted(root.glob("*.md"))`). */
function _globMdSorted(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(root, n));
    out.sort(_pathlibCompare);
    return out;
}

/** Sorted recursive `*.md` paths (mirrors `sorted(root.rglob("*.md"))`). */
function _rglobMdSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathlibCompare);
    return out;
}

function _load(
    p: string,
    options: { uri: string; fallback_name: string; kind: ResourceKind },
): Resource {
    const { uri, fallback_name, kind } = options;
    const text = fs.readFileSync(p, 'utf-8');
    const [meta, body] = _strip_frontmatter(text);
    const name = (meta.name ?? fallback_name).trim() || fallback_name;
    const description = _derive_description(meta, body, fallback_name);
    return {
        uri,
        name,
        description,
        body: _rstrip(text) + '\n',
        source: meta.source ?? 'package',
        mime_type: MIME_MARKDOWN,
        kind,
    };
}

export function scan_rules(root?: string | null): [Resource[], string[]] {
    const base = root ?? _project_root();
    const rules_root = path.join(base, 'dist/agent-src', 'rules');
    const out: Resource[] = [];
    const errors: string[] = [];
    if (!_isDir(rules_root)) {
        return [out, errors];
    }
    for (const p of _globMdSorted(rules_root)) {
        if (!_isFile(p)) {
            continue;
        }
        const stem = path.basename(p, '.md');
        try {
            out.push(_load(p, { uri: `rule://${stem}`, fallback_name: stem, kind: 'rule' }));
        } catch (exc) {
            errors.push(`${p}: read failed (${_excText(exc)})`);
        }
    }
    return [out, errors];
}

function _scan_tree(
    root: string,
    options: { scheme: string; kind: ResourceKind },
): [Resource[], string[]] {
    const { scheme, kind } = options;
    const out: Resource[] = [];
    const errors: string[] = [];
    if (!_isDir(root)) {
        return [out, errors];
    }
    for (const p of _rglobMdSorted(root)) {
        if (!_isFile(p)) {
            continue;
        }
        // rel = path.relative_to(root).with_suffix(""); slug = str(rel).replace("\\","/")
        const rel = path.relative(root, p).replace(/\.md$/, '');
        const slug = rel.split(path.sep).join('/');
        try {
            out.push(_load(p, { uri: `${scheme}://${slug}`, fallback_name: slug, kind }));
        } catch (exc) {
            errors.push(`${p}: read failed (${_excText(exc)})`);
        }
    }
    return [out, errors];
}

export function scan_guidelines(root?: string | null): [Resource[], string[]] {
    const base = root ?? _project_root();
    return _scan_tree(path.join(base, 'docs', 'guidelines'), {
        scheme: 'guideline',
        kind: 'guideline',
    });
}

export function scan_contexts(root?: string | null): [Resource[], string[]] {
    const base = root ?? _project_root();
    return _scan_tree(path.join(base, 'dist/agent-src', 'contexts'), {
        scheme: 'context',
        kind: 'context',
    });
}

/** Phase 3 entrypoint — every rule, guideline, context. */
export function load_all_resources(root?: string | null): [Resource[], string[]] {
    const [rules, e1] = scan_rules(root);
    const [guidelines, e2] = scan_guidelines(root);
    const [contexts, e3] = scan_contexts(root);
    const errors = [...e1, ...e2, ...e3];
    const seen = new Map<string, Resource>();
    for (const r of [...rules, ...guidelines, ...contexts]) {
        if (seen.has(r.uri)) {
            errors.push(`duplicate URI '${r.uri}': keeping first`);
            continue;
        }
        seen.set(r.uri, r);
    }
    const merged = [...seen.values()].sort((a, b) => _strCmp(a.uri, b.uri));
    return [merged, errors];
}

/** Stable lexicographic comparator (mirrors Python `sorted` on strings). */
function _strCmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/** Project a Resource into MCP `Resource` constructor kwargs. */
export function to_mcp_resource_meta(resource: Resource): Record<string, unknown> {
    return {
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mime_type,
        _meta: { source: resource.source, kind: resource.kind },
    };
}

/**
 * In-memory cache with mtime-based invalidation (mirrors `PromptCache`).
 *
 * Re-scans rules / guidelines / contexts on each `get()` when the set
 * of tracked files or any mtime has changed. No watcher dependency.
 */
export class ResourceCache {
    private _root: string;
    private _resources: Resource[] = [];
    private _errors: string[] = [];
    private _signature: Array<[string, number]> = [];
    private _index: Map<string, Resource> = new Map();

    constructor(root?: string | null) {
        this._root = root ?? _project_root();
    }

    private _current_signature(): Array<[string, number]> {
        const entries: Array<[string, number]> = [];
        for (const sub of [
            path.join(this._root, 'dist/agent-src', 'rules'),
            path.join(this._root, 'docs', 'guidelines'),
            path.join(this._root, 'dist/agent-src', 'contexts'),
        ]) {
            if (!_isDir(sub)) {
                continue;
            }
            for (const p of _rglobMdSorted(sub)) {
                if (_isFile(p)) {
                    entries.push([p, fs.statSync(p).mtimeMs / 1000]);
                }
            }
        }
        return entries;
    }

    private _refresh(): void {
        const [resources, errors] = load_all_resources(this._root);
        this._resources = resources;
        this._errors = errors;
        this._index = new Map(resources.map((r) => [r.uri, r]));
    }

    get(): [Resource[], string[]] {
        const signature = this._current_signature();
        if (!_sigEqual(signature, this._signature)) {
            this._signature = signature;
            this._refresh();
        }
        return [this._resources, this._errors];
    }

    /** Cached `(path, mtime)` tuples (Phase-6 F1 input). Call `get()` first. */
    get signature(): ReadonlyArray<readonly [string, number]> {
        return this._signature;
    }

    lookup(uri: string): Resource | null {
        this.get();
        return this._index.get(uri) ?? null;
    }
}

function _sigEqual(a: Array<[string, number]>, b: Array<[string, number]>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i]![0] !== b[i]![0] || a[i]![1] !== b[i]![1]) {
            return false;
        }
    }
    return true;
}
