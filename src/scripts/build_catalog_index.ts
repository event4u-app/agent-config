#!/usr/bin/env tsx
/**
 * Build the lazy-catalog index — `dist/catalog-index-v1.json`.
 *
 * A queryable metadata index over every skill, persona, and domain command:
 * `{ id, cls, name, description, tags, path }` — **metadata only, no bodies**.
 * Bodies load lazily from disk at `catalog_load` time (the stdio server has the
 * repo underneath it, unlike the upstream Hermes plugin which embeds bodies).
 *
 * Feeds the `catalog_search / _inspect / _load` MCP tools (built as discovery
 * stubs; activation deferred behind a quality A/B — see
 * road-to-persona-library-harvest.md Phase 2). Deterministic output (entries
 * sorted by (cls, id), stable keys) so the artifact diffs cleanly. `--check`
 * fails on drift instead of writing (CI mode), mirroring the
 * build_mcp_registry_manifest convention.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// The `-v1` namespace tracks `schema_version` below (per lint_versioned_cache):
// bump both together on a shape change so any stale cached copy self-invalidates
// by name rather than being read as the new shape.
export const OUT = path.join(ROOT, 'dist', 'catalog-index-v1.json');

export type CatalogClass = 'skill' | 'persona' | 'command';

export interface CatalogIndexEntry {
    /** Globally unique handle: `<cls>:<slug>`. */
    id: string;
    cls: CatalogClass;
    name: string;
    description: string;
    /** Domain / packs / tier — for filtering and search-text weighting. */
    tags: string[];
    /** Repo-relative path to the body (resolved by catalog_load). */
    path: string;
}

const SKILLS_DIR = path.join(ROOT, 'src', 'skills');
const PERSONAS_DIR = path.join(ROOT, 'src', 'agent-src', 'personas');
const DOMAINS_DIR = path.join(ROOT, 'src', 'domains');

function _isDir(p: string): boolean {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function _isFile(p: string): boolean {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}
function _rel(abs: string): string {
    return path.relative(ROOT, abs).split(path.sep).join('/');
}

function _frontmatter(abs: string): Record<string, unknown> {
    const text = fs.readFileSync(abs, 'utf-8');
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!m || m.index !== 0) return {};
    try {
        const fm = parseYaml(m[1] as string, { version: '1.1' });
        return fm !== null && typeof fm === 'object' && !Array.isArray(fm) ? (fm as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function _str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
}
function _list(v: unknown): string[] {
    if (Array.isArray(v)) return v.map((x) => _str(x)).filter((s) => s.length > 0);
    const s = _str(v);
    return s ? [s] : [];
}

function _walkLeaf(dir: string, leaf: string, out: string[]): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) _walkLeaf(full, leaf, out);
        else if (ent.name === leaf) out.push(full);
    }
}

export function buildEntries(): CatalogIndexEntry[] {
    const out: CatalogIndexEntry[] = [];

    // Skills
    if (_isDir(SKILLS_DIR)) {
        for (const slug of fs.readdirSync(SKILLS_DIR).sort()) {
            const abs = path.join(SKILLS_DIR, slug, 'SKILL.md');
            if (!_isFile(abs)) continue;
            const fm = _frontmatter(abs);
            out.push({
                id: `skill:${slug}`,
                cls: 'skill',
                name: _str(fm['name']) || slug,
                description: _str(fm['description']),
                tags: [_str(fm['domain']), ..._list(fm['packs'])].filter((s) => s.length > 0),
                path: _rel(abs),
            });
        }
    }

    // Personas (top-level *.md, skip _template/advisors and underscore-prefixed)
    if (_isDir(PERSONAS_DIR)) {
        for (const name of fs.readdirSync(PERSONAS_DIR).sort()) {
            if (!name.endsWith('.md') || name.startsWith('_')) continue;
            const abs = path.join(PERSONAS_DIR, name);
            if (!_isFile(abs)) continue;
            const fm = _frontmatter(abs);
            const id = _str(fm['id']) || name.replace(/\.md$/, '');
            out.push({
                id: `persona:${id}`,
                cls: 'persona',
                name: _str(fm['role']) || id,
                description: _str(fm['description']),
                tags: [_str(fm['tier']), _str(fm['mode'])].filter((s) => s.length > 0),
                path: _rel(abs),
            });
        }
    }

    // Domain commands
    const cmds: string[] = [];
    _walkLeaf(DOMAINS_DIR, 'command.md', cmds);
    for (const abs of cmds.sort()) {
        const fm = _frontmatter(abs);
        // logical id = <pack>/<subpath> under src/domains, without /command.md
        const relFromDomains = path.relative(DOMAINS_DIR, path.dirname(abs)).split(path.sep).join('/');
        const name = _str(fm['name']) || relFromDomains.split('/').pop() || relFromDomains;
        out.push({
            id: `command:${relFromDomains}`,
            cls: 'command',
            name,
            description: _str(fm['description']) || _str(fm['intent']),
            tags: [_str(fm['pack']), _str(fm['tier']), _str(fm['visibility'])].filter((s) => s.length > 0),
            path: _rel(abs),
        });
    }

    // Deterministic order: (cls, id).
    out.sort((a, b) => (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}

export function serialize(entries: CatalogIndexEntry[]): string {
    return JSON.stringify({ schema_version: 1, count: entries.length, entries }, null, 2) + '\n';
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    const check = args.includes('--check');
    const quiet = args.includes('--quiet');
    const entries = buildEntries();
    const rendered = serialize(entries);

    if (check) {
        const current = _isFile(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
        if (current !== rendered) {
            process.stderr.write(`build_catalog_index: DRIFT — ${_rel(OUT)} is stale; run build_catalog_index to regenerate.\n`);
            return 1;
        }
        if (!quiet) process.stdout.write(`build_catalog_index: OK — ${entries.length} entries, index up to date.\n`);
        return 0;
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, rendered, 'utf-8');
    if (!quiet) process.stdout.write(`build_catalog_index: wrote ${entries.length} entries → ${_rel(OUT)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch { return false; }
}

if (_isCliEntry()) {
    process.exit(main());
}
