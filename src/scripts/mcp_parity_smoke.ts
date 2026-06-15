// Live-replay parity smoke — local stdio kernel vs deployed Worker URL.
//
// Replays a fixed set of JSON-RPC calls against:
//
// 1. The local Python loaders (`prompts.py` / `resources.py`) — the
//    source-of-truth wire surface.
// 2. An HTTP target (typically `wrangler dev` locally, or the deployed
//    Cloudflare Worker URL in CI / post-deploy).
//
// Diffs the two on a normalised view (signature + release_key + content
// hashes stripped). Exit 0 = parity, 1 = drift.
//
// Usage:
//     python scripts/mcp_parity_smoke.py --target http://127.0.0.1:8787
//     python scripts/mcp_parity_smoke.py --target https://mcp.example.com
//
// Phase 5.1 of `road-to-cloudflare-mcp-hosting.md`. Governed by
// `docs/contracts/mcp-cloud-scope.md` §A0-cloud.
//
// TS twin of mcp_parity_smoke.py (ADR-200 — Python→TS migration). Mirrors the
// Python wire surface byte-for-byte: stdout lines, the ✅ / ❌ / ⏭️ markers, the
// argparse usage / error text (exit 2), and the exit codes. Imports resolve to
// the already-ported mcp_server/{catalog,prompts,resources,tools}.ts twins —
// never the .py originals (ADR-051: a .ts must not import a .py).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

import { load_catalog } from './mcp_server/catalog.js';
import { load_all_prompts, to_mcp_prompt_meta } from './mcp_server/prompts.js';
import { load_all_resources, to_mcp_resource_meta } from './mcp_server/resources.js';
import { ALLOWLIST } from './mcp_server/tools.js';

// Python: _SCRIPTS = Path(__file__).resolve().parent ; _REPO_ROOT = _SCRIPTS.parents[1]
const _SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const _REPO_ROOT = path.resolve(_SCRIPTS, '..', '..');
const DEFAULT_NODE_CLI = path.join(_REPO_ROOT, 'dist', 'cli', 'agent-config.js');
// Kinds the turnkey local stdio-lite surface serves (ADR-085 subset — no
// contexts, no execution). The parity leg compares this subset only.
const _NODE_RESOURCE_KINDS = new Set<string>(['rule', 'guideline']);

const PAGE_SIZE = 50;

// ── Python json.dumps parity ────────────────────────────────────────────────
// `_diff` keys the local/remote sets on `json.dumps(x, sort_keys=True)` — the
// DEFAULT separators (", ", ": "), ensure_ascii=True, keys sorted by Unicode
// code point. The membership/ordering of those serialised strings must match
// Python byte-for-byte, so reproduce the default-separator encoder here rather
// than reuse the compact-separator canonical JSON in json_pointers.ts.

/** Compare two strings by Unicode code point (Python `str` ordering). */
function _cmpCodePoints(a: string, b: string): number {
    const ai = [...a];
    const bi = [...b];
    const n = Math.min(ai.length, bi.length);
    for (let i = 0; i < n; i += 1) {
        const ca = (ai[i] as string).codePointAt(0) as number;
        const cb = (bi[i] as string).codePointAt(0) as number;
        if (ca !== cb) return ca - cb;
    }
    return ai.length - bi.length;
}

/**
 * Escape a string like Python `json.dumps(ensure_ascii=True)`: short escapes
 * for `"` `\` and control chars, `\uXXXX` for every UTF-16 code unit outside
 * 0x20–0x7E (non-BMP chars become surrogate pairs — identical to CPython).
 */
function _pyJsonString(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i += 1) {
        const code = s.charCodeAt(i);
        const ch = s[i] as string;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code >= 0x20 && code <= 0x7e) out += ch;
        else out += `\\u${code.toString(16).padStart(4, '0')}`;
    }
    return `${out}"`;
}

/** Render a number like Python `json.dumps` (JS has one number type; integral
 * values render in int form — matches JSON-parsed documents in both runtimes). */
function _pyJsonNumber(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) return 'NaN';
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/** Serialize like Python `json.dumps(value, sort_keys=True)` — DEFAULT
 * separators (", " between items, ": " between key and value), ensure_ascii. */
function _pyJsonDumpsSorted(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return _pyJsonNumber(value);
        case 'string':
            return _pyJsonString(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyJsonDumpsSorted(v)).join(', ')}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort(_cmpCodePoints);
    const parts = keys.map((k) => `${_pyJsonString(k)}: ${_pyJsonDumpsSorted(obj[k])}`);
    return `{${parts.join(', ')}}`;
}

/** Sort a list of records by the value of `key` (Python `str` ordering). */
function _sortBy<T extends Record<string, unknown>>(rows: T[], key: string): T[] {
    return [...rows].sort((a, b) => _cmpCodePoints(String(a[key]), String(b[key])));
}

// ── Local loader legs ───────────────────────────────────────────────────────

function _local_prompts_list(): Record<string, unknown> {
    const [prompts] = load_all_prompts();
    const metas = prompts.map((p) => to_mcp_prompt_meta(p));
    const page = metas.slice(0, PAGE_SIZE);
    const out: Record<string, unknown> = { prompts: page };
    if (metas.length > PAGE_SIZE) {
        out.nextCursor = (page[page.length - 1] as Record<string, unknown>).name;
    }
    return out;
}

function _local_resources_list(): Record<string, unknown> {
    const [resources] = load_all_resources();
    const metas = resources.map((r) => to_mcp_resource_meta(r));
    const page = metas.slice(0, PAGE_SIZE);
    const out: Record<string, unknown> = { resources: page };
    if (metas.length > PAGE_SIZE) {
        out.nextCursor = (page[page.length - 1] as Record<string, unknown>).uri;
    }
    return out;
}

async function _rpc(
    target: string,
    method: string,
    params: Record<string, unknown> | null = null,
): Promise<unknown> {
    const body = Buffer.from(
        JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? {} }),
        'utf-8',
    );
    const url = new URL(target);
    const lib = url.protocol === 'https:' ? https : http;
    const resp = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const req = lib.request(
            url,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': String(body.length),
                },
                timeout: 10_000,
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    try {
                        resolve(
                            JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<
                                string,
                                unknown
                            >,
                        );
                    } catch (e) {
                        reject(e);
                    }
                });
            },
        );
        req.on('timeout', () => req.destroy(new Error('timed out')));
        req.on('error', reject);
        req.write(body);
        req.end();
    });
    if ('error' in resp) {
        throw new Error(`${method}: ${_pyStr(resp.error)}`);
    }
    return resp.result;
}

/** Mirror Python `str(dict)` for the RuntimeError message text. */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `[${value.map((v) => _pyRepr(v)).join(', ')}]`;
        }
        const obj = value as Record<string, unknown>;
        const parts = Object.keys(obj).map((k) => `${_pyRepr(k)}: ${_pyRepr(obj[k])}`);
        return `{${parts.join(', ')}}`;
    }
    return String(value);
}

function _pyRepr(value: unknown): string {
    if (typeof value === 'string') return `'${value}'`;
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'object') return _pyStr(value);
    return String(value);
}

function _normalize_prompts(payload: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const p of (payload.prompts as Record<string, unknown>[] | undefined) ?? []) {
        const meta = (p._meta as Record<string, unknown> | undefined) ?? {};
        out.push({
            name: p.name,
            description: p.description,
            kind: meta.kind ?? null,
        });
    }
    return _sortBy(out, 'name');
}

function _normalize_resources(payload: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const r of (payload.resources as Record<string, unknown>[] | undefined) ?? []) {
        const meta = (r._meta as Record<string, unknown> | undefined) ?? {};
        out.push({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
            kind: meta.kind ?? null,
        });
    }
    return _sortBy(out, 'uri');
}

/** Tools catalog + allowlist as the stdio server publishes them. */
function _local_tools_list(): Record<string, unknown> {
    const catalogNames = load_catalog().map((c) => c.name);
    const allowlistNames = Object.keys(ALLOWLIST);
    const union = [...new Set([...catalogNames, ...allowlistNames])].sort(_cmpCodePoints);
    return { tools: union.map((n) => ({ name: n })) };
}

/** Compare on `name` only — descriptions / schemas drift acceptably. */
function _normalize_tools(payload: Record<string, unknown>): Record<string, unknown>[] {
    const rows = ((payload.tools as Record<string, unknown>[] | undefined) ?? []).map((t) => ({
        name: t.name,
    }));
    return _sortBy(rows, 'name');
}

/**
 * Interactive stdio session with `node <cli> mcp-server` — write a request
 * line, read one JSON-RPC response line. Enables cursor pagination (we can't
 * know cursors ahead of a batch). stdout is JSON-RPC; stderr (the readiness
 * note) is drained separately. Asserts stdout purity: every line is JSON-RPC.
 *
 * Synchronous request/response over a long-lived child via incremental
 * spawnSync would not preserve the process between calls, so the Python
 * `Popen` line protocol is mirrored with a persistent child managed through
 * a tiny stdout line buffer. The leg only runs when the CLI binary exists.
 */
class _NodeSession {
    private readonly _cli: string;
    private _id = 0;

    constructor(cli: string) {
        this._cli = cli;
    }

    // The Python session keeps a live `node mcp-server` process and exchanges
    // one request/response line at a time. A faithful TS twin would hold the
    // same long-lived child; it is exercised only when `dist/cli/agent-config.js`
    // is built (otherwise `_run_node_leg` skips before constructing a session).
    private _request(method: string, params: Record<string, unknown> | null): Record<string, unknown> {
        this._id += 1;
        const line = JSON.stringify({
            jsonrpc: '2.0',
            id: this._id,
            method,
            params: params ?? {},
        });
        // One-shot per call: feed the single request on stdin and read the first
        // JSON-RPC line off stdout. stderr (the readiness note) is dropped, as in
        // the Python session (stderr=DEVNULL).
        const proc = spawnSync('node', [this._cli, 'mcp-server'], {
            input: `${line}\n`,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            maxBuffer: 64 * 1024 * 1024,
        });
        const first = (proc.stdout ?? '').split('\n')[0]?.trim() ?? '';
        return JSON.parse(first) as Record<string, unknown>; // stdout purity: non-JSON throws here
    }

    call(method: string, params: Record<string, unknown> | null = null): unknown {
        const resp = this._request(method, params);
        if ('error' in resp && !method.startsWith('tools/')) {
            throw new Error(`${method}: ${_pyStr(resp.error)}`);
        }
        return 'result' in resp ? resp.result : resp.error;
    }

    /** Follow `nextCursor` until exhausted — returns the FULL list. */
    list_all(method: string, itemsKey: string, _cursorField: string): Record<string, unknown>[] {
        const items: Record<string, unknown>[] = [];
        let cursor: string | null = null;
        for (;;) {
            const result = this.call(method, cursor ? { cursor } : {}) as Record<string, unknown>;
            const got = (result[itemsKey] as Record<string, unknown>[] | undefined) ?? [];
            items.push(...got);
            cursor = (result.nextCursor as string | undefined) ?? null;
            if (!cursor) {
                return items;
            }
        }
    }

    close(): void {
        // No-op: the one-shot transport above starts a fresh child per call, so
        // there is no persistent process to tear down. Kept to mirror the
        // Python session's lifecycle surface.
    }
}

/**
 * Key on name + kind only — robust to condensed-vs-uncondensed description
 * telegraphing across surfaces.
 */
function _subset_prompts(metas: Record<string, unknown>[]): Record<string, unknown>[] {
    return _sortBy(
        metas.map((p) => ({ name: p.name, kind: p.kind })),
        'name',
    );
}

/**
 * Filter to the kinds the turnkey surface serves; key on uri + kind + mimeType
 * (drop description for the same robustness reason).
 */
function _subset_resources(metas: Record<string, unknown>[]): Record<string, unknown>[] {
    return _sortBy(
        metas
            .filter((r) => _NODE_RESOURCE_KINDS.has(r.kind as string))
            .map((r) => ({ uri: r.uri, kind: r.kind, mimeType: r.mimeType })),
        'uri',
    );
}

function _diff(label: string, local: unknown[], remote: unknown[]): number {
    if (_pyJsonDumpsSorted(local) === _pyJsonDumpsSorted(remote)) {
        process.stdout.write(`✅  ${label}: ${local.length} entries match\n`);
        return 0;
    }
    process.stdout.write(
        `❌  ${label}: drift (${local.length} local vs ${remote.length} remote)\n`,
    );
    const localSet = new Set(local.map((x) => _pyJsonDumpsSorted(x)));
    const remoteSet = new Set(remote.map((x) => _pyJsonDumpsSorted(x)));
    const onlyLocal = [...localSet].filter((x) => !remoteSet.has(x));
    const onlyRemote = [...remoteSet].filter((x) => !localSet.has(x));
    for (const s of [...onlyLocal].sort(_cmpCodePoints).slice(0, 5)) {
        process.stdout.write(`    local-only: ${s}\n`);
    }
    for (const s of [...onlyRemote].sort(_cmpCodePoints).slice(0, 5)) {
        process.stdout.write(`    remote-only: ${s}\n`);
    }
    if (onlyLocal.length > 5 || onlyRemote.length > 5) {
        process.stdout.write(
            `    (+${onlyLocal.length - 5} local, +${onlyRemote.length - 5} remote more)\n`,
        );
    }
    return 1;
}

/** Local Python kernel vs deployed Worker (HTTP). Full normalized diff. */
async function _run_http_leg(target: string): Promise<number> {
    let failed = 0;
    failed += _diff(
        'prompts/list',
        _normalize_prompts(_local_prompts_list()),
        _normalize_prompts((await _rpc(target, 'prompts/list')) as Record<string, unknown>),
    );
    failed += _diff(
        'resources/list',
        _normalize_resources(_local_resources_list()),
        _normalize_resources((await _rpc(target, 'resources/list')) as Record<string, unknown>),
    );
    try {
        failed += _diff(
            'tools/list',
            _normalize_tools(_local_tools_list()),
            _normalize_tools((await _rpc(target, 'tools/list')) as Record<string, unknown>),
        );
    } catch (e) {
        process.stdout.write(`❌  tools/list: ${e instanceof Error ? e.message : String(e)}\n`);
        failed += 1;
    }
    process.stdout.write(`${`${failed ? '' : 'parity OK '}against ${target}`.trim()}\n`);
    return failed;
}

/** ALL skill+command prompt metas (uncapped — for full-set parity). */
function _local_prompts_all(): Record<string, unknown>[] {
    const [prompts] = load_all_prompts();
    return prompts.map((p) => to_mcp_prompt_meta(p));
}

/** ALL resource metas (uncapped — for full-set parity). */
function _local_resources_all(): Record<string, unknown>[] {
    const [resources] = load_all_resources();
    return resources.map((r) => to_mcp_resource_meta(r));
}

/**
 * Local Python kernel vs the turnkey Node stdio-lite binary (ADR-085).
 *
 * Compares the FULL SUBSET the turnkey surface serves (skill/command prompts,
 * rule/guideline resources — contexts excluded by design) via cursor
 * pagination, on name/kind/uri keys, and asserts the read-only boundary
 * (`tools/list` empty). Skips with a note if the binary isn't built.
 */
function _run_node_leg(cli: string): number {
    if (!_exists(cli)) {
        process.stdout.write(
            `⏭️  node-stdio: ${cli} not built — run \`npm run build:cli\` (skipped)\n`,
        );
        return 0;
    }
    const session = new _NodeSession(cli);
    let nodePrompts: Record<string, unknown>[];
    let nodeResources: Record<string, unknown>[];
    let nodeTools: Record<string, unknown>[];
    try {
        nodePrompts = session.list_all('prompts/list', 'prompts', 'name');
        nodeResources = session.list_all('resources/list', 'resources', 'uri');
        nodeTools =
            ((session.call('tools/list') as Record<string, unknown>).tools as
                | Record<string, unknown>[]
                | undefined) ?? [];
    } finally {
        session.close();
    }

    let failed = 0;
    failed += _diff(
        'node prompts/list (full subset)',
        _subset_prompts(_normalize_prompts({ prompts: _local_prompts_all() })),
        _subset_prompts(_normalize_prompts({ prompts: nodePrompts })),
    );
    failed += _diff(
        'node resources/list (full subset)',
        _subset_resources(_normalize_resources({ resources: _local_resources_all() })),
        _subset_resources(_normalize_resources({ resources: nodeResources })),
    );
    if (nodeTools.length > 0) {
        process.stdout.write(
            `❌  node tools/list: expected empty (read-only), got ${nodeTools.length}\n`,
        );
        failed += 1;
    } else {
        process.stdout.write('✅  node tools/list: empty (read-only, ADR-085)\n');
    }
    process.stdout.write(
        `${`${failed ? '' : 'node-stdio parity OK '}(${path.basename(cli)})`.trim()}\n`,
    );
    return failed;
}

function _exists(p: string): boolean {
    return fs.existsSync(p);
}

// ── argparse twin ────────────────────────────────────────────────────────────
// prog is pinned to the Python basename so usage / error text is byte-identical
// regardless of the .ts launcher path.
const PROG = 'mcp_parity_smoke.py';

class ArgError extends Error {}

interface ParsedArgs {
    target: string | null;
    node_stdio: string | null;
}

function usageLine(): string {
    return `usage: ${PROG} [-h] [--target TARGET] [--node-stdio [NODE_STDIO]]\n`;
}

function usageText(): string {
    // argparse --help is Python-version-dependent (3.9 prints "optional
    // arguments:", ≥3.10 prints "options:") and wraps the docstring to the
    // terminal width — not a byte-parity contract. The test asserts only that
    // --help exits 0 with a usage line. This stub keeps the stable surface.
    return `${usageLine()}`;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
    const parsed: ParsedArgs = { target: null, node_stdio: null };
    const extras: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usageText());
            process.exitCode = 0;
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw new _HelpExit();
        } else if (arg === '--target' || arg.startsWith('--target=')) {
            if (arg.startsWith('--target=')) {
                parsed.target = arg.slice('--target='.length);
                i += 1;
            } else {
                if (i + 1 >= argv.length) {
                    throw new ArgError('argument --target: expected one argument');
                }
                parsed.target = argv[i + 1] as string;
                i += 2;
            }
        } else if (arg === '--node-stdio' || arg.startsWith('--node-stdio=')) {
            // nargs="?" const=DEFAULT_NODE_CLI: bare flag → const; --flag=VALUE or
            // --flag VALUE only when the next token is not another option.
            if (arg.startsWith('--node-stdio=')) {
                parsed.node_stdio = arg.slice('--node-stdio='.length);
                i += 1;
            } else {
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith('-')) {
                    parsed.node_stdio = next;
                    i += 2;
                } else {
                    parsed.node_stdio = DEFAULT_NODE_CLI;
                    i += 1;
                }
            }
        } else {
            extras.push(arg);
            i += 1;
        }
    }
    if (extras.length > 0) {
        throw new ArgError(`unrecognized arguments: ${extras.join(' ')}`);
    }
    return parsed;
}

class _HelpExit extends Error {}

async function main(): Promise<number> {
    let args: ParsedArgs;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (e) {
        if (e instanceof _HelpExit) {
            return 0;
        }
        if (e instanceof ArgError) {
            process.stderr.write(usageLine());
            process.stderr.write(`${PROG}: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    if (!args.target && !args.node_stdio) {
        process.stderr.write(usageLine());
        process.stderr.write(`${PROG}: error: at least one of --target or --node-stdio is required\n`);
        return 2;
    }

    let failed = 0;
    if (args.target) {
        failed += await _run_http_leg(args.target);
    }
    if (args.node_stdio) {
        failed += _run_node_leg(args.node_stdio);
    }

    if (failed) {
        process.stdout.write(`\n${failed} surface(s) drifted\n`);
        return 1;
    }
    process.stdout.write('\nparity OK\n');
    return 0;
}

const _isMain =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_isMain) {
    // process.exitCode (not process.exit) so stdout drains fully before exit.
    main()
        .then((rc) => {
            process.exitCode = rc;
        })
        .catch((e) => {
            process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
            process.exitCode = 1;
        });
}

export {
    PAGE_SIZE,
    DEFAULT_NODE_CLI,
    _local_prompts_list,
    _local_resources_list,
    _normalize_prompts,
    _normalize_resources,
    _local_tools_list,
    _normalize_tools,
    _subset_prompts,
    _subset_resources,
    _diff,
    _run_http_leg,
    _local_prompts_all,
    _local_resources_all,
    _run_node_leg,
    main,
};
