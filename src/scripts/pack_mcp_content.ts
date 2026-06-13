// Pack agent-config content into a Worker-bundle JSON blob.
//
// Walks `dist/agent-src/skills/`, `dist/agent-src/commands/`, `dist/agent-src/rules/`,
// `docs/guidelines/`, `dist/agent-src/contexts/` via the same loaders
// that drive the local stdio kernel, emits one JSON blob and a sidecar
// manifest for `internal/workers/mcp/`.
//
// Outputs (relative to repo root):
// - `internal/workers/mcp/content.json`      — uncondensed, bundled by `wrangler deploy`.
// - `internal/workers/mcp/content.json.gz`   — gzipped archival copy for R2.
// - `internal/workers/mcp/manifest.json`     — manifest only (RCA / R2 sidecar).
//
// Hard-fail thresholds (Phase 2-5 council verdict D2):
// - Uncondensed JSON > 2 MB         → process.exitCode = 1.
// - Empty content (zero URIs)        → process.exitCode = 2. Catches a broken
//                                      `dist/agent-src/` tree before deploy.
//
// Cloud signature divergence vs local kernel (`metadata.compute_skill_set_signature`):
// - Local kernel:  SHA-256 over `(uri, mtime)` pairs — reproducible only
//                  within one filesystem.
// - This packer:   SHA-256 over `(uri, body)` pairs — reproducible across
//                  CI runs, machines, and re-clones. Same 12-char prefix.
//
// Governed by `docs/contracts/mcp-cloud-scope.md` §A0-cloud invariant 5.
//
// TS twin of pack_mcp_content.py (py2ts migration, ADR-094). Byte-identical
// twin: same five scanners, same wire shape, same compact-JSON / indent=2
// manifest serialization, same gzip archival copy (mtime=0, level 9, with
// Python's OS=0xFF header byte). The .py stays the deploy entrypoint until
// the Phase 12 sweep.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { load_raw as load_tool_catalog_raw } from './mcp_server/catalog.js';
import { scan_commands, scan_skills } from './mcp_server/prompts.js';
import { scan_contexts, scan_guidelines, scan_rules } from './mcp_server/resources.js';

const SCHEMA_VERSION = 1;
const PACKER_VERSION = '1.0.0';
// Worker bundle is the compact JSON; gzipped copy lives in R2. Cloudflare's
// condensed-bundle limit is 3 MB (free) / 10 MB (paid); 778 KB gz today
// (438 entries) leaves ample headroom. Hard-fail at 5 MB uncondensed so
// the build dies before the Worker upload does.
const MAX_UNCONDENSED_BYTES = 5 * 1024 * 1024;

/** Sentinel for the early-exit paths (`raise SystemExit(n)` in Python). */
class SystemExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`SystemExit(${code})`);
        this.code = code;
    }
}

function _repo_root(): string {
    // This file lives at src/scripts/pack_mcp_content.ts — two parents up is
    // src/, three is the repo root (broken parent count survived the
    // scripts/ → src/scripts/ move and made pack() scan an empty tree).
    return path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
}

function _git_sha(root: string): string {
    // Resolve HEAD SHA. Falls back to env var, then to all-zeros.
    for (const env_var of ['GITHUB_SHA', 'CI_COMMIT_SHA', 'GIT_COMMIT']) {
        const sha = process.env[env_var];
        if (sha && sha.length >= 7) {
            return sha;
        }
    }
    const out = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5000,
    });
    if (out.status === 0 && out.error === undefined) {
        return (out.stdout ?? '').trim();
    }
    return '0'.repeat(40);
}

function _package_version(root: string): string {
    const data = JSON.parse(
        fs.readFileSync(path.join(root, 'package.json'), 'utf-8'),
    ) as Record<string, unknown>;
    return String(data.version ?? '0.0.0');
}

interface UriEntry {
    uri: string;
    name: string;
    description: string;
    body: string;
    source: string;
    kind: string;
    mime_type?: string;
}

function _collect_entries(root: string): [Record<string, UriEntry>, string[]] {
    // Run all 5 scanners and project entries into the wire shape.
    const uris: Record<string, UriEntry> = {};
    const errors: string[] = [];

    {
        const [skills, e] = scan_skills(root);
        errors.push(...e);
        for (const s of skills) {
            const key = `skill://${s.name}`;
            uris[key] = {
                uri: key,
                name: s.name,
                description: s.description,
                body: s.body,
                source: s.source,
                kind: 'skill',
            };
        }
    }

    {
        const [commands, e] = scan_commands(root);
        errors.push(...e);
        for (const c of commands) {
            // Command names are plain hyphen slugs since the 2026-06 Zed fix;
            // the `: → .` rewrite stays only as a tolerance shim for stale trees.
            const key = `command://${c.name.replace(/:/g, '.')}`;
            uris[key] = {
                uri: key,
                name: c.name,
                description: c.description,
                body: c.body,
                source: c.source,
                kind: 'command',
            };
        }
    }

    for (const scan of [scan_rules, scan_guidelines, scan_contexts]) {
        const [items, e] = scan(root);
        errors.push(...e);
        for (const r of items) {
            uris[r.uri] = {
                uri: r.uri,
                name: r.name,
                description: r.description,
                body: r.body,
                source: r.source,
                kind: r.kind,
                mime_type: r.mime_type,
            };
        }
    }

    return [uris, errors];
}

function _content_signature(
    uris: Record<string, UriEntry>,
    tool_catalog: Record<string, unknown>,
): [string, string] {
    // SHA-256 over sorted (uri, body) pairs plus the tool catalog JSON.
    //
    // Returns (full_hex, 12-char prefix). The prefix is the wire-surface
    // `skillSetSignature`; the full hex is the diagnostic `content_hash_sha256`.
    // Including the catalog ensures a stub edit produces a new release_key.
    const hasher = createHash('sha256');
    for (const uri of Object.keys(uris).sort(_strCmp)) {
        hasher.update(Buffer.from(uri, 'utf-8'));
        hasher.update(Buffer.from([0x00]));
        hasher.update(Buffer.from(uris[uri]!.body, 'utf-8'));
        hasher.update(Buffer.from([0x1e]));
    }
    hasher.update(Buffer.from([0x1d]));
    hasher.update(
        Buffer.from(
            json_dumps(tool_catalog, { ensure_ascii: false, sort_keys: true }),
            'utf-8',
        ),
    );
    const digest = hasher.digest('hex');
    return [digest, digest.slice(0, 12)];
}

function _count_kinds(uris: Record<string, UriEntry>): Record<string, number> {
    const counts: Record<string, number> = {
        skill: 0,
        command: 0,
        rule: 0,
        guideline: 0,
        context: 0,
    };
    for (const entry of Object.values(uris)) {
        const kind = entry.kind;
        if (kind in counts) {
            counts[kind] += 1;
        }
    }
    return counts;
}

function _build_manifest(args: {
    signature: string;
    content_hash: string;
    package_version: string;
    git_sha: string;
    built_at: string;
    counts: Record<string, number>;
    tool_count: number;
}): Record<string, unknown> {
    const { signature, content_hash, package_version, git_sha, built_at, counts, tool_count } =
        args;
    const short = git_sha && git_sha !== '0'.repeat(40) ? git_sha.slice(0, 7) : 'unknown';
    return {
        schema_version: SCHEMA_VERSION,
        signature,
        content_hash_sha256: content_hash,
        package_version,
        release_key: `v${package_version}-${short}`,
        git_sha,
        built_at,
        packer_version: PACKER_VERSION,
        content_uri_count: counts,
        tool_count,
    };
}

function pack(root: string, out_dir: string): Record<string, unknown> {
    // Run the full pack. Returns the manifest dict.
    const [uris, errors] = _collect_entries(root);
    if (Object.keys(uris).length === 0) {
        process.stderr.write('pack: empty content (zero URIs)\n');
        for (const line of errors) {
            process.stderr.write(`  - ${line}\n`);
        }
        throw new SystemExit(2);
    }

    const tool_catalog = load_tool_catalog_raw();
    const [content_hash, signature] = _content_signature(uris, tool_catalog);
    const counts = _count_kinds(uris);
    const built_at = _utc_now_iso();
    const tools = tool_catalog.tools;
    const manifest = _build_manifest({
        signature,
        content_hash,
        package_version: _package_version(root),
        git_sha: _git_sha(root),
        built_at,
        counts,
        tool_count: Array.isArray(tools) ? tools.length : 0,
    });

    const blob = {
        schema_version: SCHEMA_VERSION,
        uris,
        tool_catalog,
        manifest,
    };
    // Compact JSON for the bundle (saves ~20 KB vs indent=2). The R2
    // archival copy is gzipped, so legibility there is moot.
    const payload = json_dumps(blob, { ensure_ascii: false, sort_keys: true });
    const payload_bytes = Buffer.from(payload, 'utf-8');

    if (payload_bytes.length > MAX_UNCONDENSED_BYTES) {
        process.stderr.write(
            `pack: uncondensed content ${payload_bytes.length} bytes ` +
                `exceeds limit ${MAX_UNCONDENSED_BYTES}\n`,
        );
        throw new SystemExit(1);
    }

    fs.mkdirSync(out_dir, { recursive: true });
    fs.writeFileSync(path.join(out_dir, 'content.json'), payload_bytes);
    // mtime=0 keeps the gzip header byte-stable across CI runs so the
    // R2 archival copy hashes deterministically.
    const gz_path = path.join(out_dir, 'content.json.gz');
    fs.writeFileSync(gz_path, _gzip_python(payload_bytes, gz_path));
    fs.writeFileSync(
        path.join(out_dir, 'manifest.json'),
        json_dumps(manifest, { ensure_ascii: false, sort_keys: true, indent: 2 }) + '\n',
        'utf-8',
    );

    if (errors.length > 0) {
        process.stderr.write('pack: non-fatal frontmatter errors:\n');
        for (const line of errors) {
            process.stderr.write(`  - ${line}\n`);
        }
    }

    return manifest;
}

function main(argv?: string[]): number {
    const args = _parse_args(argv ?? process.argv.slice(2));

    const out_dir = args.out ?? path.join(args.root, 'internal', 'workers', 'mcp');
    let manifest: Record<string, unknown>;
    try {
        manifest = pack(args.root, out_dir);
    } catch (exc) {
        if (exc instanceof SystemExit) {
            return exc.code;
        }
        throw exc;
    }

    if (!args.quiet) {
        const c = manifest.content_uri_count as Record<string, number>;
        process.stderr.write(
            `pack: ok signature=${manifest.signature as string} ` +
                `release=${manifest.release_key as string} ` +
                `skills=${c.skill} commands=${c.command} ` +
                `rules=${c.rule} guidelines=${c.guideline} ` +
                `contexts=${c.context} tools=${manifest.tool_count as number}\n`,
        );
    }
    return 0;
}

// ── argparse parity ──────────────────────────────────────────────────────
// Mirrors the three Python argparse options: --root (Path, default repo root),
// --out (Path, default None → <root>/internal/workers/mcp), --quiet (flag).
interface Args {
    root: string;
    out: string | null;
    quiet: boolean;
}

function _parse_args(argv: string[]): Args {
    const args: Args = { root: _repo_root(), out: null, quiet: false };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i]!;
        if (tok === '--quiet') {
            args.quiet = true;
            i += 1;
        } else if (tok === '--root' || tok.startsWith('--root=')) {
            const [value, next] = _optValue(argv, i, '--root');
            args.root = path.resolve(value);
            i = next;
        } else if (tok === '--out' || tok.startsWith('--out=')) {
            const [value, next] = _optValue(argv, i, '--out');
            args.out = path.resolve(value);
            i = next;
        } else if (tok === '-h' || tok === '--help') {
            process.stdout.write('usage: pack_mcp_content [--root ROOT] [--out OUT] [--quiet]\n');
            throw new SystemExit(0);
        } else {
            process.stderr.write(`pack_mcp_content: error: unrecognized argument: ${tok}\n`);
            throw new SystemExit(2);
        }
    }
    return args;
}

function _optValue(argv: string[], i: number, name: string): [string, number] {
    const tok = argv[i]!;
    const eq = `${name}=`;
    if (tok.startsWith(eq)) {
        return [tok.slice(eq.length), i + 1];
    }
    if (i + 1 >= argv.length) {
        process.stderr.write(`pack_mcp_content: error: argument ${name}: expected one argument\n`);
        throw new SystemExit(2);
    }
    return [argv[i + 1]!, i + 2];
}

// ── Determinism / formatting helpers ──────────────────────────────────────

/** Mirror Python `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _utc_now_iso(): string {
    const d = new Date();
    const p = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
        `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
    );
}

/**
 * Gzip `payload` byte-identically to Python's
 * `gzip.GzipFile(fileobj=open(gz_path, "wb"), mode="wb", compresslevel=9,
 * mtime=0)`.
 *
 * CPython's `GzipFile` derives the stored filename from the underlying
 * fileobj's name (basename, trailing `.gz` removed), sets the FNAME flag
 * (FLG=0x08), and embeds the NUL-terminated name (latin-1) after the
 * fixed 10-byte header. It also writes MTIME=0, XFL=0x02 (best compression),
 * OS=0xFF ("unknown"). Node's zlib writes none of that filename and uses
 * OS=0x13. So we keep only Node's DEFLATE body and prepend a byte-identical
 * CPython header (10 fixed bytes + FNAME + NUL).
 */
function _gzip_python(payload: Buffer, gz_path: string): Buffer {
    const gz = zlib.gzipSync(payload, { level: 9 });
    // Node's gzip header is always the fixed 10 bytes (no extra fields).
    const body = gz.subarray(10);
    // CPython: name = basename(fileobj.name); if name.endswith(".gz") drop it.
    let name = path.basename(gz_path);
    if (name.endsWith('.gz')) {
        name = name.slice(0, -3);
    }
    const nameBytes = Buffer.from(name, 'latin1');
    const header = Buffer.from([
        0x1f,
        0x8b, // magic
        0x08, // CM = deflate
        0x08, // FLG = FNAME
        0x00,
        0x00,
        0x00,
        0x00, // MTIME = 0
        0x02, // XFL = best compression
        0xff, // OS = unknown
    ]);
    return Buffer.concat([header, nameBytes, Buffer.from([0x00]), body]);
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

/**
 * Mirror Python `json.dumps(obj, ensure_ascii=False, sort_keys=True[, indent])`.
 *
 * - `sort_keys`: object keys emitted in code-point sort order.
 * - `ensure_ascii=false`: non-ASCII kept verbatim (no `\uXXXX` escaping).
 * - Compact mode (no indent): item separator `", "`, key separator `": "`.
 * - Indent mode: each level on its own line, item separator `","` (newline
 *   follows), key separator `": "` — exactly CPython's `indent=N` layout.
 */
function json_dumps(
    value: unknown,
    opts: { ensure_ascii: boolean; sort_keys: boolean; indent?: number },
): string {
    return _renderJson(value, opts, 0);
}

function _renderJson(
    value: unknown,
    opts: { ensure_ascii: boolean; sort_keys: boolean; indent?: number },
    depth: number,
): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _pyNumber(value);
    }
    if (typeof value === 'string') {
        return _jsonString(value, opts.ensure_ascii);
    }
    const indent = opts.indent;
    const hasIndent = indent !== undefined;
    const nl = hasIndent ? '\n' : '';
    const pad = hasIndent ? ' '.repeat(indent! * (depth + 1)) : '';
    const closePad = hasIndent ? ' '.repeat(indent! * depth) : '';
    const itemSep = hasIndent ? ',' : ', ';

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _renderJson(v, opts, depth + 1));
        return '[' + nl + items.join(itemSep + nl) + nl + closePad + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        let keys = Object.keys(obj);
        if (opts.sort_keys) {
            keys = keys.sort(_strCmp);
        }
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) =>
                pad +
                _jsonString(k, opts.ensure_ascii) +
                ': ' +
                _renderJson(obj[k], opts, depth + 1),
        );
        return '{' + nl + items.join(itemSep + nl) + nl + closePad + '}';
    }
    return 'null';
}

/** Mirror Python `repr` of a JSON number (ints bare, floats via repr). */
function _pyNumber(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/**
 * JSON-encode a string.
 *
 * `ensure_ascii=true`: escape every code unit > 0x7e to `\uXXXX` (CPython
 * default). `ensure_ascii=false`: keep non-ASCII verbatim; only the standard
 * control / quote / backslash escapes are applied (matches CPython, which
 * uses the same minimal escape set with `\uXXXX` for control chars < 0x20).
 */
function _jsonString(s: string, ensureAscii: boolean): string {
    const base = JSON.stringify(s);
    if (!ensureAscii) {
        return base;
    }
    let out = '';
    for (let i = 0; i < base.length; i += 1) {
        const code = base.charCodeAt(i);
        if (code > 0x7e) {
            out += '\\u' + code.toString(16).padStart(4, '0');
        } else {
            out += base[i];
        }
    }
    return out;
}

// Mirror `if __name__ == "__main__": raise SystemExit(main())`.
const _selfPath = fileURLToPath(import.meta.url);
const _invokedDirectly =
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath);

if (_invokedDirectly) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof SystemExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}

export { main, pack };
