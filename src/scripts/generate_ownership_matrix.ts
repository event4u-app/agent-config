#!/usr/bin/env node
/**
 * Generate the file-ownership matrix.
 *
 * TypeScript twin of `src/scripts/generate_ownership_matrix.py` (ADR-094,
 * Phase 8 Wave 8a). Mirrors the Python CLI contract EXACTLY — flag
 * (`--check`), exit codes (0 / 1 / 2 / 3), stdout/stderr split, and the
 * byte-identical generated outputs (`json.dumps(payload, indent=2,
 * sort_keys=False)` + trailing newline, and the markdown render).
 *
 * Produces:
 *   * docs/contracts/file-ownership-matrix.json (machine, internal-locked)
 *   * agents/settings/contexts/structural/file-ownership-matrix.md (human)
 *
 * Walks `.agent-src.uncondensed/{rules,skills,commands,contexts,personas}/`,
 * parses frontmatter for `load_context:` / `load_context_eager:`, scans
 * markdown bodies for inline links to `.md` files inside the scanned roots,
 * and emits READ_ONLY edges plus depth-2 transitive closure of load_context
 * chains. Depth-3 chains abort the build.
 *
 * Modes:
 *   --check      Regenerate to memory and diff against committed JSON.
 *   (default)    Regenerate JSON + MD in place; exit 0 on success.
 *
 * Exit codes: 0 = ok, 1 = drift (--check), 2 = depth-3 chain, 3 = internal.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { artefact_roots, strip_source_prefix } from './_lib/agent_src.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(_HERE, '..', '..');

export const CANONICAL_SRC_PREFIX = '.agent-src.uncondensed';
export const SCAN_DIRS: readonly string[] = ['rules', 'skills', 'commands', 'contexts', 'personas'];

export const JSON_OUT = path.join(ROOT, 'docs', 'contracts', 'file-ownership-matrix.json');
export const MD_OUT = path.join(
    ROOT,
    'agents',
    'settings',
    'contexts',
    'structural',
    'file-ownership-matrix.md',
);

// re.compile(r"\]\(([^)]+\.md)(?:#[^)]*)?\)")
const LINK_RE = /\]\(([^)]+\.md)(?:#[^)]*)?\)/g;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export interface FileEntry {
    path: string;
    kind: string;
    rule_type: string | null;
    load_context: string[];
    load_context_eager: string[];
}

export interface Edge {
    source: string;
    target: string;
    type: string;
    via: string;
    depth: number;
}

// --- filesystem helpers ------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
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

/** Mirror `sorted(d.rglob("*.md"))` returning SORTED POSIX-keyed paths. */
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
    out.sort();
    return out;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _posixRel(child: string, base: string): string {
    return path.relative(base, child).split(path.sep).join('/');
}

function _relToRoot(p: string): string {
    return _posixRel(p, ROOT);
}

function _kind_for(rel: string): string {
    const parts = rel.split('/');
    if (parts.length >= 3 && parts[0] === '.agent-src.uncondensed') {
        return parts[1] === 'personas' ? 'persona' : (parts[1] as string).replace(/s$/, '');
    }
    return 'unknown';
}

function _parse_frontmatter(p: string): Record<string, Json> {
    const text = fs.readFileSync(p, 'utf-8');
    if (!text.startsWith('---\n')) {
        return {};
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return {};
    }
    let data: Json;
    try {
        data = parseYaml(text.slice(4, end), { version: '1.1' });
    } catch {
        return {};
    }
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, Json>)
        : {};
}

/** Mirror Python str.strip('"').strip("'"). */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start++;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end--;
    }
    return s.slice(start, end);
}

/**
 * Walk every artefact root and yield `[physical_path, canonical_rel]`.
 * `canonical_rel` is always anchored at `.agent-src.uncondensed/`.
 * When `root` is given, only that single directory is scanned.
 */
function _collect_files(root: string | null = null): Array<[string, string]> {
    const roots = root !== null ? [root] : artefact_roots();
    const out: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const r of roots) {
        for (const sub of SCAN_DIRS) {
            const d = path.join(r, sub);
            if (!_exists(d)) {
                continue;
            }
            for (const f of _rglobMdSorted(d)) {
                const logical = _posixRel(f, r);
                const canonical = `${CANONICAL_SRC_PREFIX}/${logical}`;
                if (seen.has(canonical)) {
                    continue;
                }
                seen.add(canonical);
                out.push([f, canonical]);
            }
        }
    }
    out.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return out;
}

export function build_matrix(
    root: string | null = null,
): [Record<string, FileEntry>, Edge[], string[]] {
    const files: Record<string, FileEntry> = {};
    const physical_by_canonical: Record<string, string> = {};
    for (const [f, rel] of _collect_files(root)) {
        physical_by_canonical[rel] = f;
        const fm = _parse_frontmatter(f);
        let rtype: string | null;
        const rawType = fm['type'];
        if (typeof rawType === 'string') {
            rtype = _stripChars(_stripChars(rawType, '"'), "'");
        } else {
            rtype = null;
        }
        let lazy = fm['load_context'] ?? [];
        let eager = fm['load_context_eager'] ?? [];
        if (!Array.isArray(lazy)) {
            lazy = [];
        }
        if (!Array.isArray(eager)) {
            eager = [];
        }
        files[rel] = {
            path: rel,
            kind: _kind_for(rel),
            rule_type: rtype,
            load_context: (lazy as Json[]).filter((x) => typeof x === 'string') as string[],
            load_context_eager: (eager as Json[]).filter((x) => typeof x === 'string') as string[],
        };
    }

    const edges: Edge[] = [];
    // Iterate in insertion order (Python dict preserves it).
    for (const rel of Object.keys(files)) {
        const entry = files[rel] as FileEntry;
        for (const tgt of entry.load_context) {
            edges.push({ source: rel, target: tgt, type: 'READ_ONLY', via: 'load_context', depth: 1 });
        }
        for (const tgt of entry.load_context_eager) {
            edges.push({
                source: rel,
                target: tgt,
                type: 'READ_ONLY',
                via: 'load_context_eager',
                depth: 1,
            });
        }
    }

    // Body markdown links — only count edges to files we know about.
    for (const rel of Object.keys(files)) {
        const phys = physical_by_canonical[rel] as string;
        let body = fs.readFileSync(phys, 'utf-8');
        body = body.startsWith('---\n') ? _splitOnceFrontmatter(body) : body;
        const seen_targets = new Set<string>();
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(body)) !== null) {
            const href = (m[1] as string).trim();
            if (href.startsWith('http')) {
                continue;
            }
            const resolved = _resolve_link(rel, phys, href);
            if (resolved === null || resolved === rel || seen_targets.has(resolved)) {
                continue;
            }
            if (resolved in files) {
                seen_targets.add(resolved);
                edges.push({ source: rel, target: resolved, type: 'READ_ONLY', via: 'body_link', depth: 1 });
            }
        }
    }

    // Transitive closure on load_context* edges, depth 2; depth 3 aborts.
    const lc_edges_by_src: Record<string, string[]> = {};
    for (const e of edges) {
        if (e.via === 'load_context' || e.via === 'load_context_eager') {
            (lc_edges_by_src[e.source] ??= []).push(e.target);
        }
    }

    const transitive: Edge[] = [];
    const depth3: string[] = [];
    for (const src of Object.keys(lc_edges_by_src)) {
        const lvl1_targets = lc_edges_by_src[src] as string[];
        for (const t1 of lvl1_targets) {
            for (const t2 of lc_edges_by_src[t1] ?? []) {
                if (t2 === src || t2 === t1) {
                    continue;
                }
                transitive.push({
                    source: src,
                    target: t2,
                    type: 'READ_ONLY',
                    via: 'load_context_transitive',
                    depth: 2,
                });
                for (const t3 of lc_edges_by_src[t2] ?? []) {
                    if (t3 === src || t3 === t1 || t3 === t2) {
                        continue;
                    }
                    depth3.push(`${src} → ${t1} → ${t2} → ${t3}`);
                }
            }
        }
    }

    edges.push(...transitive);
    for (const rel of Object.keys(files)) {
        edges.push({ source: rel, target: rel, type: 'WRITE', via: 'self', depth: 0 });
    }

    edges.sort((a, b) => {
        // key=(source, target, via, depth) — tuple sort.
        if (a.source !== b.source) {
            return a.source < b.source ? -1 : 1;
        }
        if (a.target !== b.target) {
            return a.target < b.target ? -1 : 1;
        }
        if (a.via !== b.via) {
            return a.via < b.via ? -1 : 1;
        }
        return a.depth - b.depth;
    });
    return [files, edges, depth3];
}

/** body.split("\n---\n", 1)[-1] when body startswith "---\n". */
function _splitOnceFrontmatter(body: string): string {
    const idx = body.indexOf('\n---\n');
    return idx === -1 ? body : body.slice(idx + '\n---\n'.length);
}

function _resolve_link(source_rel: string, _source_phys: string, href: string): string | null {
    let logical: string;
    if (
        href.startsWith('.agent-src.uncondensed/') ||
        href.startsWith('agents/') ||
        href.startsWith('packages/')
    ) {
        const cand = path.resolve(ROOT, href);
        if (!_exists(cand)) {
            return null;
        }
        // try: rel = cand.relative_to(ROOT) except ValueError: return None
        if (cand !== ROOT && !_isUnder(cand, ROOT)) {
            return null;
        }
        const rel = _posixRel(cand, ROOT);
        const stripped = strip_source_prefix(rel);
        if (stripped === null) {
            return null;
        }
        logical = stripped;
    } else {
        const source_logical = strip_source_prefix(source_rel);
        if (source_logical === null) {
            return null;
        }
        const base_parts = source_logical.split('/').slice(0, -1); // drop file name
        const href_parts = href.split('/');
        for (const part of href_parts) {
            if (part === '' || part === '.') {
                continue;
            }
            if (part === '..') {
                if (base_parts.length === 0) {
                    return null;
                }
                base_parts.pop();
            } else {
                base_parts.push(part);
            }
        }
        logical = base_parts.join('/');
    }
    const parts = logical.split('/');
    if (parts.length >= 2 && SCAN_DIRS.includes(parts[0] as string)) {
        return `${CANONICAL_SRC_PREFIX}/${logical}`;
    }
    return null;
}

function _isUnder(child: string, base: string): boolean {
    const rel = path.relative(base, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function _to_json(files: Record<string, FileEntry>, edges: Edge[]): Json {
    // sorted(files.items()) — sort by canonical key.
    const sortedKeys = Object.keys(files).sort();
    const filesObj: Record<string, Json> = {};
    for (const rel of sortedKeys) {
        const e = files[rel] as FileEntry;
        filesObj[rel] = {
            kind: e.kind,
            rule_type: e.rule_type,
            load_context: e.load_context,
            load_context_eager: e.load_context_eager,
        };
    }
    return {
        version: 1,
        generated_by: 'src/scripts/generate_ownership_matrix.py',
        source_of_truth: '.agent-src.uncondensed/',
        files: filesObj,
        edges: edges.map((e) => ({
            source: e.source,
            target: e.target,
            type: e.type,
            via: e.via,
            depth: e.depth,
        })),
    };
}

function _to_markdown(payload: Json): string {
    const files = payload['files'] as Record<string, Json>;
    const edgesArr = payload['edges'] as Json[];
    const lines: string[] = [
        '# File-ownership matrix (regenerated)',
        '',
        '> **Do not edit.** Regenerated by `scripts/generate_ownership_matrix.py`.',
        '> Schema: [`docs/contracts/file-ownership-matrix.md`](../../../docs/contracts/file-ownership-matrix.md).',
        '',
        `- Schema version: \`${payload['version']}\``,
        `- Source of truth: \`${payload['source_of_truth']}\``,
        `- Files indexed: **${Object.keys(files).length}**`,
        `- Edges (incl. self-WRITE): **${edgesArr.length}**`,
        '',
        '## READ_ONLY edges',
        '',
        '| Source | Target | Via | Depth |',
        '|---|---|---|---:|',
    ];
    const ro = edgesArr.filter((e) => e['type'] === 'READ_ONLY');
    for (const e of ro) {
        lines.push(`| \`${e['source']}\` | \`${e['target']}\` | \`${e['via']}\` | ${e['depth']} |`);
    }
    if (ro.length === 0) {
        lines.push('| _(none)_ |  |  |  |');
    }
    lines.push('', '## Files by kind', '', '| Kind | Count |', '|---|---:|');
    const counts: Record<string, number> = {};
    for (const f of Object.values(files)) {
        const k = (f as Json)['kind'] as string;
        counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const k of Object.keys(counts).sort()) {
        lines.push(`| \`${k}\` | ${counts[k]} |`);
    }
    lines.push('');
    return lines.join('\n');
}

// --- json.dumps(indent=2, sort_keys=False) emulation, ensure_ascii=True ------

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>); // sort_keys=False
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k], level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

function _write_outputs(payload: Json, json_out: string, md_out: string): void {
    fs.mkdirSync(path.dirname(json_out), { recursive: true });
    fs.mkdirSync(path.dirname(md_out), { recursive: true });
    fs.writeFileSync(json_out, pyJsonDumpsIndent2(payload) + '\n', 'utf-8');
    fs.writeFileSync(md_out, _to_markdown(payload) + '\n', 'utf-8');
}

/** Deep equality mirroring Python `committed != payload` (order-insensitive for objects). */
function _jsonEqual(a: Json, b: Json): boolean {
    if (a === b) {
        return true;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!_jsonEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (a !== null && b !== null && typeof a === 'object') {
        const ka = Object.keys(a as object).sort();
        const kb = Object.keys(b as object).sort();
        if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) {
            return false;
        }
        for (const k of ka) {
            if (!_jsonEqual((a as Json)[k], (b as Json)[k])) {
                return false;
            }
        }
        return true;
    }
    return false;
}

interface Args {
    check: boolean;
}

export function parse_args(argv: string[]): Args {
    const args: Args = { check: false };
    for (const a of argv) {
        if (a === '--check') {
            args.check = true;
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (artefact_roots().length === 0) {
        process.stderr.write(
            '❌  no artefact roots found (legacy or packages/*/.agent-src.uncondensed/)\n',
        );
        return 3;
    }

    const [files, edges, depth3] = build_matrix();
    if (depth3.length > 0) {
        process.stderr.write('❌  load_context depth-3 chain detected (limit is 2):\n');
        for (const chain of depth3) {
            process.stderr.write(`  🔴 ${chain}\n`);
        }
        return 2;
    }

    const payload = _to_json(files, edges);

    if (args.check) {
        if (!_exists(JSON_OUT)) {
            process.stderr.write(
                `❌  ${_relToRoot(JSON_OUT)} not committed; run \`task generate-ownership-matrix\`\n`,
            );
            return 1;
        }
        const committed = JSON.parse(fs.readFileSync(JSON_OUT, 'utf-8'));
        if (!_jsonEqual(committed, payload)) {
            process.stderr.write(
                '❌  ownership matrix is stale — run `task generate-ownership-matrix` and commit\n',
            );
            return 1;
        }
        process.stdout.write(
            `✅  ownership matrix in sync (${Object.keys(files).length} files, ${edges.length} edges)\n`,
        );
        return 0;
    }

    _write_outputs(payload, JSON_OUT, MD_OUT);
    process.stdout.write(
        `✅  wrote ${_relToRoot(JSON_OUT)} (${Object.keys(files).length} files, ${edges.length} edges)\n`,
    );
    process.stdout.write(`✅  wrote ${_relToRoot(MD_OUT)}\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    // Set exitCode rather than process.exit() so any large stdout/stderr write
    // fully drains to the pipe before the process exits.
    process.exitCode = main();
}
