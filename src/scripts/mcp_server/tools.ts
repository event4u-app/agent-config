// MCP Server — Phase 4 tools layer + Phase 1 discovery stubs.
//
// A0 contract amendment: real handlers run only for the tools listed in
// `ALLOWLIST` (`lint_skills` + `chat_history_append`). All other names
// in `scripts/mcp_server/consumer_tool_catalog.json` are surfaced via
// `tools/list` as discovery stubs; `tools/call` against them returns
// the `not_implemented` envelope defined in
// `docs/contracts/mcp-tool-stub-envelope.md` (a successful result with
// `code: not_implemented`, an `install_hint` and an `alternative`).
// Names that are neither implemented nor catalog-listed raise an
// Error (rendered by the SDK as JSON-RPC error).
//
// Path-scoping is mandatory for any tool that writes: the resolved target
// path must stay under `<consumer_root>` and within the allowlist of
// filenames (`agents/runtime/.agent-chat-history` — current default;
// `agents/.agent-chat-history` and `.agent-chat-history` — kept for
// back-compat with older consumer installs that have not migrated yet).
// Escape attempts surface as an Error before the underlying writer runs.
//
// This module deliberately does NOT spawn shells or HTTP clients. The
// chat-history writer is a minimal faithful inline port of the five
// functions `tools.py` lazily imports from `scripts/chat_history.py`
// (SCHEMA_VERSION, init, append, read_header, read_entries); the wire
// surface exposes no shell execution.
//
// Tools return an object from their handlers — the SDK wraps that in a
// TextContent block with the JSON-serialized payload, so MCP clients
// can render structured output.
//
// TS twin of tools.py (py2ts Phase 8). Mirrors the full public surface:
//   STDIO_TRANSPORT, BuiltinTool, ToolHandler, ALLOWLIST, to_mcp_tool_meta,
//   CATALOG_STUBS, STUB_NAMES, REGISTRY, ToolCache, boot_log_line.
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    SCHEMA_VERSION as _CH_SCHEMA_VERSION,
    append as _chAppendImpl,
    init as _chInitImpl,
    read_entries as _chReadEntriesImpl,
    read_header as _chReadHeaderImpl,
} from '../chat_history.js';
import {
    type CatalogEntry,
    install_hint as _catalog_install_hint,
    load_catalog,
    not_implemented_envelope,
} from './catalog.js';
import { type Outcome, record_call } from './telemetry.js';

// Stable transport tag for the stub envelope. Mirrored verbatim by
// `internal/workers/mcp/src/stubs.ts` with `"worker"`.
export const STDIO_TRANSPORT = 'stdio';

// Allowlisted directories (relative to consumer_root) where tool writes
// are permitted. `chat_history_append` resolves its path through this
// guard before the underlying writer touches the filesystem.
const _ALLOWED_WRITE_REL_PATHS: ReadonlySet<string> = new Set([
    // Current default (Volatile Runtime policy — agents/runtime/ is
    // local-only and ignored by git).
    'agents/runtime/.agent-chat-history',
    // Back-compat: older consumer installs still write to the flat
    // location. Additive — both paths stay accepted until the next
    // major tool version bump.
    'agents/.agent-chat-history',
    '.agent-chat-history',
]);

export type ToolHandler = (
    args: Record<string, unknown>,
    consumerRoot: string,
) => Promise<Record<string, unknown>>;

/**
 * Static registration record for an allowlisted MCP tool.
 *
 * `input_schema` is a JSON-Schema object the SDK validates against on
 * each `tools/call`. `handler` is an async function that receives the
 * validated arguments + the resolved `consumer_root` path.
 *
 * Mirrors the Python frozen dataclass `BuiltinTool` (field order
 * preserved).
 */
export interface BuiltinTool {
    readonly name: string;
    readonly description: string;
    readonly input_schema: Record<string, unknown>;
    readonly handler: ToolHandler;
}

/** Mirror Python `str.strip()` (also strips the same Unicode whitespace set we care about here). */
function _strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Mirror Python `Path(...).resolve()` — absolutize + realpath, tolerating a missing tail. */
function _resolvePath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

/**
 * Pick the consumer-project root.
 *
 * Default: the current working directory. Tests pass an explicit
 * override; the stdio entrypoint relies on the CWD set by the
 * `./agent-config mcp:run` wrapper.
 */
function _resolveConsumerRoot(override?: string | null): string {
    if (override !== undefined && override !== null) {
        return _resolvePath(override);
    }
    return _resolvePath(process.cwd());
}

/**
 * Compute the POSIX relative path of `target` under `root`, or null
 * when `target` is not under `root`. Mirrors `Path.relative_to`, which
 * is purely lexical (no symlink chasing) on already-resolved paths.
 */
function _relativeUnder(target: string, root: string): string | null {
    const rel = path.relative(root, target);
    if (rel === '') {
        return '';
    }
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

/** Mirror Python `repr(sorted(...))` for the write-allowlist error text. */
function _reprStrList(values: string[]): string {
    return `[${values.map((v) => `'${v}'`).join(', ')}]`;
}

/**
 * Resolve `raw` under `consumer_root` and assert it stays in tree.
 *
 * Returns the resolved target path. Raises when the path escapes the
 * root or is not in the write allowlist. null / undefined / empty
 * falls back to the default chat-history location.
 */
function _validateInTreePath(raw: string | null | undefined, consumerRoot: string): string {
    const root = _resolvePath(consumerRoot);
    let target: string;
    if (raw === null || raw === undefined || raw === '') {
        target = path.join(root, 'agents', 'runtime', '.agent-chat-history');
    } else if (path.isAbsolute(raw)) {
        target = _resolvePath(raw);
    } else {
        target = _resolvePath(path.join(root, raw));
    }
    const rel = _relativeUnder(target, root);
    if (rel === null) {
        throw new Error(`path escapes consumer_root: ${target} not under ${root}`);
    }
    if (!_ALLOWED_WRITE_REL_PATHS.has(rel)) {
        throw new Error(
            `path not in write allowlist: '${rel}' ` +
                `(allowed: ${_reprStrList([..._ALLOWED_WRITE_REL_PATHS].sort())})`,
        );
    }
    return target;
}

// ---------------------------------------------------------------------
// Minimal chat-history surface — the five functions tools.py lazily
// imports from scripts/chat_history.py (SCHEMA_VERSION, init, append,
// read_header, read_entries) now come from the chat_history.ts twin
// (the canonical single source of truth, byte-for-byte with the Python
// writer: ensure_ascii=False default separators, trailing newline,
// ISO-8601 second-precision `ts`). These thin shims keep the handler
// call sites unchanged while delegating to the twin.
// ---------------------------------------------------------------------

function _chReadHeader(target: string): Record<string, unknown> | null {
    return _chReadHeaderImpl(target);
}

function _chInit(target: string, freq = 'per_phase'): Record<string, unknown> {
    return _chInitImpl(freq, { path: target });
}

function _chAppend(
    entry: Record<string, unknown>,
    target: string,
    session: string | null | undefined,
): void {
    _chAppendImpl(entry, { path: target, session });
}

/** Mirror `read_entries(last, path, session)` (the subset the read handler uses). */
function _chReadEntries(
    target: string,
    last: number | null | undefined,
    session: string | null | undefined,
): Record<string, unknown>[] {
    return _chReadEntriesImpl({ path: target, last, session });
}

// ---------------------------------------------------------------------
// Implemented handlers
// ---------------------------------------------------------------------

/**
 * D2 — read-only wrapper around `skill_linter.lint_file`.
 *
 * Arguments:
 *   paths: optional list of repo-relative paths to lint. Empty /
 *       missing → lint the full `.agent-src.uncondensed/` tree
 *       via `gather_all_candidate_files`.
 *
 * Never spawns `git` (no `--changed` mode); never writes; mirrors
 * the JSON output format of `scripts/skill_linter.py --format json`.
 */
async function _lintSkillsHandler(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    // Import lazily so the loader-layer import-surface test stays clean.
    const { format_json, gather_all_candidate_files, lint_file } = await import(
        '../skill_linter.js'
    );

    const root = _resolvePath(consumerRoot);
    const requested = args.paths ?? [];
    if (!Array.isArray(requested)) {
        throw new Error("'paths' must be a list of strings");
    }

    let paths: string[] = [];
    if (requested.length > 0) {
        for (const raw of requested) {
            if (typeof raw !== 'string') {
                throw new Error("'paths' entries must be strings");
            }
            const resolved = path.isAbsolute(raw)
                ? _resolvePath(raw)
                : _resolvePath(path.join(root, raw));
            if (_relativeUnder(resolved, root) === null) {
                throw new Error(`path escapes consumer_root: ${resolved}`);
            }
            if (fs.existsSync(resolved)) {
                paths.push(resolved);
            }
        }
    } else {
        paths = gather_all_candidate_files(root);
    }

    const sortedUnique = [...new Set(paths)].sort(_pathlibCompare);
    const results = sortedUnique.map((p) => lint_file(p, root));
    const payload = JSON.parse(format_json(results)) as Record<string, unknown>;
    return payload;
}

/**
 * D3 — append one entry to the consumer's chat-history JSONL.
 *
 * Arguments mirror tools.py: text, entry_type, path, session, dry_run,
 * min_schema_version.
 */
async function _chatHistoryAppendHandler(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const text = args.text;
    if (typeof text !== 'string' || !_strip(text)) {
        throw new Error("'text' must be a non-empty string");
    }
    const entryTypeRaw = args.entry_type ?? 'note';
    if (typeof entryTypeRaw !== 'string' || !_strip(entryTypeRaw)) {
        throw new Error("'entry_type' must be a non-empty string");
    }
    const entryType = entryTypeRaw || 'note';
    if (entryType === 'header') {
        throw new Error("'entry_type' must not be 'header'");
    }

    const session = args.session;
    if (session !== undefined && session !== null && typeof session !== 'string') {
        throw new Error("'session' must be a string when provided");
    }

    const dryRun = _pyTruthy(args.dry_run ?? false);

    const rawPath = (args.path ?? null) as string | null;
    const target = _validateInTreePath(rawPath, consumerRoot);

    const minSchema = args.min_schema_version;
    if (minSchema !== undefined && minSchema !== null) {
        if (typeof minSchema !== 'number' || !Number.isInteger(minSchema) || typeof minSchema === 'boolean') {
            throw new Error("'min_schema_version' must be an integer");
        }
        const existingHeader = fs.existsSync(target) ? _chReadHeader(target) : null;
        const observed =
            existingHeader !== null && typeof existingHeader === 'object'
                ? _pyInt(existingHeader.v ?? 0)
                : _CH_SCHEMA_VERSION;
        if (observed < minSchema) {
            throw new Error(`chat-history schema ${observed} below required ${minSchema}`);
        }
    }

    const entry: Record<string, unknown> = { t: entryType, text };

    if (dryRun) {
        return {
            dry_run: true,
            target_path: target,
            entry,
            session: session === undefined ? null : session,
        };
    }

    // `append` requires the parent directory and a header line. Lazy-init
    // the JSONL when the consumer hasn't run `agent-config chat:init` yet.
    if (!fs.existsSync(target) || _chReadHeader(target) === null) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        _chInit(target);
    }
    _chAppend(entry, target, (session ?? null) as string | null);
    return {
        dry_run: false,
        target_path: target,
        entry,
        session: session === undefined ? null : session,
    };
}

/**
 * Phase 3 L2 — read entries from the consumer's chat-history JSONL.
 *
 * Arguments mirror tools.py: last, session, entry_type, path.
 */
async function _chatHistoryReadHandler(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const rawPath = (args.path ?? null) as string | null;
    const target = _validateInTreePath(rawPath, consumerRoot);

    const last = args.last;
    if (
        last !== undefined &&
        last !== null &&
        (typeof last !== 'number' || !Number.isInteger(last) || typeof last === 'boolean' || last < 1)
    ) {
        throw new Error("'last' must be a positive integer when provided");
    }
    const session = args.session;
    if (session !== undefined && session !== null && typeof session !== 'string') {
        throw new Error("'session' must be a string when provided");
    }
    const entryType = args.entry_type;
    if (entryType !== undefined && entryType !== null && typeof entryType !== 'string') {
        throw new Error("'entry_type' must be a string when provided");
    }

    if (!fs.existsSync(target)) {
        return { path: target, entries: [], count: 0 };
    }

    let entries = _chReadEntries(
        target,
        (last ?? null) as number | null,
        (session ?? null) as string | null,
    );
    if (entryType) {
        entries = entries.filter((e) => e.t === entryType);
    }
    return { path: target, entries, count: entries.length };
}

/**
 * Phase 3 L2 — file-backed memory retrieval over `agents/memory/`.
 *
 * Wraps `scripts/memory_lookup.retrieve_v1` to keep the v1 envelope on
 * the wire. Retrieval is entirely file-backed (no external backend).
 */
async function _memoryLookupHandler(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const memoryLookup = await import('../memory_lookup.js');

    const types = args.types;
    if (
        !Array.isArray(types) ||
        types.length === 0 ||
        !types.every((t) => typeof t === 'string')
    ) {
        throw new Error("'types' must be a non-empty list of strings");
    }
    const keys = args.keys ?? [];
    if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string')) {
        throw new Error("'keys' must be a list of strings");
    }
    const limitRaw = args.limit ?? 5;
    if (
        typeof limitRaw !== 'number' ||
        !Number.isInteger(limitRaw) ||
        typeof limitRaw === 'boolean' ||
        limitRaw < 1
    ) {
        throw new Error("'limit' must be a positive integer");
    }

    // Mirror the Python `os.chdir(consumer_root)` scoping: memory_lookup
    // resolves `agents/memory` relative to CWD, so the consumer root is
    // applied via a chdir window that is always restored.
    const prevCwd = process.cwd();
    let envelope: Record<string, unknown>;
    try {
        process.chdir(consumerRoot);
        envelope = memoryLookup.retrieve_v1(
            [...(types as string[])],
            [...(keys as string[])],
            limitRaw,
        );
    } finally {
        process.chdir(prevCwd);
    }
    return envelope;
}

/** Phase 3 L2 — surface `scripts/memory_status.status()` as JSON. */
async function _memoryStatusHandler(
    _args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const memoryStatus = await import('../memory_status.js');

    const prevCwd = process.cwd();
    let result: ReturnType<typeof memoryStatus.status>;
    try {
        process.chdir(consumerRoot);
        result = memoryStatus.status();
    } finally {
        process.chdir(prevCwd);
    }
    // Python `asdict(result)` over the constant file-backend dataclass →
    // {status, backend, reason, elapsed_ms}. memory_status.ts.status()
    // already returns that plain object, so it IS the dict.
    return result as unknown as Record<string, unknown>;
}

// Module-level prompt / resource caches reused across handler calls so
// repeated `list_*` / `read_resource_body` calls share mtime tracking.
const _PROMPT_CACHES = new Map<string, unknown>();
const _RESOURCE_CACHES = new Map<string, unknown>();

async function _getPromptCache(consumerRoot: string): Promise<import('./prompts.js').PromptCache> {
    const { PromptCache } = await import('./prompts.js');
    const key = _resolvePath(consumerRoot);
    let cache = _PROMPT_CACHES.get(key) as import('./prompts.js').PromptCache | undefined;
    if (cache === undefined) {
        cache = new PromptCache(consumerRoot);
        _PROMPT_CACHES.set(key, cache);
    }
    return cache;
}

async function _getResourceCache(
    consumerRoot: string,
): Promise<import('./resources.js').ResourceCache> {
    const { ResourceCache } = await import('./resources.js');
    const key = _resolvePath(consumerRoot);
    let cache = _RESOURCE_CACHES.get(key) as import('./resources.js').ResourceCache | undefined;
    if (cache === undefined) {
        cache = new ResourceCache(consumerRoot);
        _RESOURCE_CACHES.set(key, cache);
    }
    return cache;
}

/** Phase 3 L2 — enumerate skill prompts (kind=='skill'). */
async function _listSkillsHandler(
    _args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const { to_mcp_prompt_meta } = await import('./prompts.js');
    const cache = await _getPromptCache(consumerRoot);
    const [prompts, errors] = cache.get();
    const items = prompts
        .filter((p) => p.kind === 'skill')
        .map((p) => ({
            name: p.name,
            description: p.description,
            source: p.source,
            wire_name: to_mcp_prompt_meta(p).name as string,
        }));
    items.sort((a, b) => _strCmp(a.name, b.name));
    return { count: items.length, skills: items, errors: [...errors] };
}

/** Phase 3 L2 — enumerate command prompts (kind=='command'). */
async function _listCommandsHandler(
    _args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const { to_mcp_prompt_meta } = await import('./prompts.js');
    const cache = await _getPromptCache(consumerRoot);
    const [prompts, errors] = cache.get();
    const items = prompts
        .filter((p) => p.kind === 'command')
        .map((p) => ({
            name: p.name,
            description: p.description,
            source: p.source,
            wire_name: to_mcp_prompt_meta(p).name as string,
        }));
    items.sort((a, b) => _strCmp(a.name, b.name));
    return { count: items.length, commands: items, errors: [...errors] };
}

/** Phase 3 L2 — enumerate rule resources (kind=='rule'). */
async function _listRulesHandler(
    _args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const cache = await _getResourceCache(consumerRoot);
    const [resources, errors] = cache.get();
    const items = resources
        .filter((r) => r.kind === 'rule')
        .map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            source: r.source,
        }));
    items.sort((a, b) => _strCmp(a.uri, b.uri));
    return { count: items.length, rules: items, errors: [...errors] };
}

/** Phase 3 L2 — fetch the rendered body of a resource URI. */
async function _readResourceBodyHandler(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const uri = args.uri;
    if (typeof uri !== 'string' || !uri) {
        throw new Error("'uri' must be a non-empty string");
    }
    const cache = await _getResourceCache(consumerRoot);
    const resource = cache.lookup(uri);
    if (resource === null) {
        throw new Error(`resource not found: ${uri}`);
    }
    return {
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mime_type: resource.mime_type,
        kind: resource.kind,
        source: resource.source,
        body: resource.body,
    };
}

// ---------------------------------------------------------------------
// Allowlist — hardcoded per AI Council Q1-a verdict (2026-05-10),
// extended Phase 3 L2 (2026-05-12) under the council-waiver verdict.
// Adding a tool here is a code-review event; settings cannot enable an
// unlisted tool. Boot-time stderr log enumerates the registered set.
// ---------------------------------------------------------------------

export const ALLOWLIST: Record<string, BuiltinTool> = {
    lint_skills: {
        name: 'lint_skills',
        description:
            'Lint skill, rule, command, guideline, and persona markdown ' +
            'files for frontmatter and structural errors. Use before ' +
            'committing or opening a PR that adds or edits any of those ' +
            'artifacts, to catch schema violations early. Read-only — ' +
            'never writes files or spawns git. Returns the ' +
            '`scripts/skill_linter.py --format json` payload: a `summary` ' +
            'object (pass / pass_with_warnings / fail / total counts) and ' +
            'a per-file `results` array with severity-tagged findings. ' +
            'Pass `paths` to lint a subset; omit for a full tree scan.',
        input_schema: {
            type: 'object',
            properties: {
                paths: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Repo-relative paths to lint (files or ' +
                        'directories). Empty or missing → full tree scan ' +
                        'via gather_all_candidate_files.',
                },
            },
            additionalProperties: false,
        },
        handler: _lintSkillsHandler,
    },
    chat_history_append: {
        name: 'chat_history_append',
        description:
            "Append one structured entry to the consumer project's " +
            'chat-history log (a JSONL file). Use to record a decision, ' +
            'note, or phase marker that should persist into a later ' +
            'session or be distilled by `mine_session`. Writes to the ' +
            'filesystem (`agents/runtime/.agent-chat-history` by default; ' +
            '`agents/.agent-chat-history` and `.agent-chat-history` ' +
            'accepted for back-compat) and returns the written entry plus ' +
            'its resolved target path. Path-scoped: a `path` outside the ' +
            'allowlist, or any traversal escaping the project root, raises ' +
            'an error before writing. Set `dry_run: true` to preview the ' +
            'entry and target path without touching disk.',
        input_schema: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'The entry body to record.',
                },
                entry_type: {
                    type: 'string',
                    description:
                        'Short ``t`` tag categorising the entry (e.g. ' +
                        'note, decision, phase). Defaults to ``note``.',
                },
                path: {
                    type: 'string',
                    description:
                        'Optional path override. Must resolve to ' +
                        '`agents/runtime/.agent-chat-history` ' +
                        '(current default), ' +
                        '`agents/.agent-chat-history`, or ' +
                        '`.agent-chat-history` under consumer_root.',
                },
                session: {
                    type: 'string',
                    description:
                        'Optional 16-char session id to group the entry ' +
                        'under. Defaults to the current session.',
                },
                dry_run: {
                    type: 'boolean',
                    default: false,
                    description:
                        'When true, return the entry and resolved target ' +
                        'path without writing to disk.',
                },
                min_schema_version: {
                    type: 'integer',
                    description:
                        'Refuse to write if the on-disk history schema is ' +
                        'older than this version.',
                },
            },
            required: ['text'],
            additionalProperties: false,
        },
        handler: _chatHistoryAppendHandler,
    },
    chat_history_read: {
        name: 'chat_history_read',
        description:
            "Read recent entries back from the consumer project's " +
            'chat-history JSONL ' +
            '(`agents/runtime/.agent-chat-history`; ' +
            '`agents/.agent-chat-history` accepted for back-compat). Use ' +
            'to recover context from an earlier session — decisions, ' +
            'notes, phase markers — at the start of a new task. ' +
            'Read-only. Returns the resolved file path plus a list of ' +
            'matching entries (newest last). Combine `session`, `last`, ' +
            'and `entry_type` to narrow the result.',
        input_schema: {
            type: 'object',
            properties: {
                last: {
                    type: 'integer',
                    minimum: 1,
                    description:
                        'Return only the most recent N entries, after ' +
                        'other filters apply.',
                },
                session: {
                    type: 'string',
                    description: 'Filter to a single 16-char session id.',
                },
                entry_type: {
                    type: 'string',
                    description: 'Filter by the `t` tag (e.g. note, decision, ' + 'phase).',
                },
                path: {
                    type: 'string',
                    description:
                        'Optional history-file path override; defaults to ' +
                        'the standard chat-history location under the ' +
                        'project root.',
                },
            },
            additionalProperties: false,
        },
        handler: _chatHistoryReadHandler,
    },
    memory_lookup: {
        name: 'memory_lookup',
        description:
            'Retrieve engineering-memory entries for one or more memory ' +
            'types, optionally narrowed to specific anchor paths. Use ' +
            'before editing a security-sensitive or historically buggy ' +
            'file to surface prior incidents, ownership, and patterns ' +
            'tied to it. Reads `agents/memory/<type>/*.yml` plus the ' +
            '`agents/memory/intake/*.jsonl` signal log. Read-only. ' +
            'Returns the v1 retrieval envelope: a `status` field plus ' +
            'per-type `slices` carrying the matched entries.',
        input_schema: {
            type: 'object',
            properties: {
                types: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    description:
                        'Memory types to scan, e.g. `historical-patterns`, ' +
                        '`incident-learnings`, `ownership`. At least one ' +
                        'required.',
                },
                keys: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Optional anchor paths or globs to match entries ' +
                        'against (e.g. a file you are about to edit).',
                },
                limit: {
                    type: 'integer',
                    minimum: 1,
                    default: 5,
                    description: 'Maximum entries to return per type. Defaults to 5.',
                },
            },
            required: ['types'],
            additionalProperties: false,
        },
        handler: _memoryLookupHandler,
    },
    memory_status: {
        name: 'memory_status',
        description:
            'Report the memory backend status. Memory is entirely ' +
            'file-backed (`agents/memory/`); there is no external backend. ' +
            'Read-only, takes no arguments. Returns a `status` (`file`), ' +
            'the active `backend` (`file`), and a short `reason`.',
        input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: _memoryStatusHandler,
    },
    list_skills: {
        name: 'list_skills',
        description:
            'Enumerate every skill the server currently exposes as a ' +
            'prompt, each with its name, description, and source. Use to ' +
            'discover which skills are available before suggesting or ' +
            'invoking one. Read-only manifest view, takes no arguments. ' +
            'Returns a `count` plus a `skills` array.',
        input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: _listSkillsHandler,
    },
    list_commands: {
        name: 'list_commands',
        description:
            'Enumerate every slash command the server currently exposes ' +
            'as a prompt, each with its name and description. Use to ' +
            'discover available commands before routing a user request to ' +
            'one. Read-only manifest view, takes no arguments. Returns a ' +
            '`count` plus a `commands` array.',
        input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: _listCommandsHandler,
    },
    list_rules: {
        name: 'list_rules',
        description:
            'Enumerate every behavioral rule the server exposes as a ' +
            'resource, each with its URI, name, and description. Use to ' +
            'discover which rules are in effect, then fetch a body with ' +
            '`read_resource_body` or `resources/read`. Read-only manifest ' +
            'view, takes no arguments. Returns a `count` plus a `rules` ' +
            'array.',
        input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: _listRulesHandler,
    },
    read_resource_body: {
        name: 'read_resource_body',
        description:
            'Fetch the rendered body of a single resource URI (rule, ' +
            'guideline, or context document) in one call, without the ' +
            'two-step `resources/list` + `resources/read` handshake. Use ' +
            'when you already know the URI and want to inline its content ' +
            'into a tool-call result. Read-only. Returns the resource ' +
            '`uri`, `name`, `description`, and full text `body`.',
        input_schema: {
            type: 'object',
            properties: {
                uri: {
                    type: 'string',
                    description:
                        'Resource URI to fetch, e.g. `rule://commit-policy`, ' +
                        '`guideline://php/patterns/events`, or ' +
                        '`context://authority/scope-mechanics`.',
                },
            },
            required: ['uri'],
            additionalProperties: false,
        },
        handler: _readResourceBodyHandler,
    },
};

/** Render a `BuiltinTool` as kwargs for `mcp.types.Tool`. */
export function to_mcp_tool_meta(tool: BuiltinTool): Record<string, unknown> {
    return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema,
    };
}

// ---------------------------------------------------------------------
// Phase 1 discovery stubs — catalog entries with no real handler.
// Loaded at module import time. The Worker reads the same catalog via
// `content.json` so `tools/list` returns identical metadata on both
// transports apart from `implemented_on`.
// ---------------------------------------------------------------------

/** Closure that returns the `not_implemented` envelope for a stub. */
function _makeStubHandler(entry: CatalogEntry, installHintValue: string): ToolHandler {
    return async (
        _args: Record<string, unknown>,
        _consumerRoot: string,
    ): Promise<Record<string, unknown>> =>
        not_implemented_envelope(entry.name, {
            transport: STDIO_TRANSPORT,
            install_hint_value: installHintValue,
        });
}

/**
 * Build the stub registry from the catalog. ALLOWLIST wins on overlap.
 *
 * Returns [registry, stub_names]. `registry` contains every catalog
 * entry not already in ALLOWLIST, each wired to a closure that emits the
 * envelope.
 */
function _buildCatalogRegistry(): [Record<string, BuiltinTool>, ReadonlySet<string>] {
    const installHintValue = _catalog_install_hint();
    const entries = load_catalog();
    const registry: Record<string, BuiltinTool> = {};
    const stubNames = new Set<string>();
    for (const entry of entries) {
        if (entry.name in ALLOWLIST) {
            continue;
        }
        registry[entry.name] = {
            name: entry.name,
            description: entry.description,
            input_schema: entry.input_schema,
            handler: _makeStubHandler(entry, installHintValue),
        };
        stubNames.add(entry.name);
    }
    return [registry, stubNames];
}

const _catalogBuild = _buildCatalogRegistry();
export const CATALOG_STUBS: Record<string, BuiltinTool> = _catalogBuild[0];
export const STUB_NAMES: ReadonlySet<string> = _catalogBuild[1];

// Full wire-surface registry — implemented + stubs. `tools/list` reads
// from this; `tools/call` dispatches against it.
export const REGISTRY: Record<string, BuiltinTool> = { ...ALLOWLIST, ...CATALOG_STUBS };

/**
 * Registry view backing the MCP `tools/*` handlers.
 *
 * Default registry is `REGISTRY` (implemented + catalog stubs). Tests
 * can pass a narrower object (e.g. `ALLOWLIST` alone) to isolate the
 * implemented surface.
 */
export class ToolCache {
    private _registry: Record<string, BuiltinTool>;

    constructor(registry?: Record<string, BuiltinTool> | null) {
        this._registry = { ...(registry !== undefined && registry !== null ? registry : REGISTRY) };
    }

    names(): string[] {
        return Object.keys(this._registry).sort(_strCmp);
    }

    list(): BuiltinTool[] {
        return this.names().map((name) => this._registry[name]!);
    }

    get(name: string): BuiltinTool | null {
        return this._registry[name] ?? null;
    }

    /** True when `name` is a catalog stub on this cache. */
    is_stub(name: string): boolean {
        return STUB_NAMES.has(name) && name in this._registry;
    }

    /** Subset of `names()` whose handlers run real logic. */
    implemented_names(): string[] {
        return Object.keys(this._registry)
            .filter((n) => n in ALLOWLIST)
            .sort(_strCmp);
    }

    async dispatch(
        name: string,
        args: Record<string, unknown>,
        consumerRoot?: string | null,
    ): Promise<Record<string, unknown>> {
        const root = _resolveConsumerRoot(consumerRoot);
        const tool = this.get(name);
        if (tool === null) {
            // Sonnet's latent-demand pattern: log the unknown name before
            // surfacing the JSON-RPC error so Phase 2 can rank the gap.
            ToolCache._record(name, 'latent_demand', root);
            throw new Error(`Unknown tool: ${name}`);
        }
        const outcome: Outcome = this.is_stub(name) ? 'stub' : 'implemented';
        ToolCache._record(name, outcome, root);
        return tool.handler(args ?? {}, root);
    }

    /** Best-effort JSONL write — failures never break the wire surface. */
    private static _record(toolName: string, outcome: Outcome, consumerRoot: string): void {
        record_call({
            tool_name: toolName,
            outcome,
            transport: STDIO_TRANSPORT,
            consumer_root: consumerRoot,
        });
    }
}

/** Single-line stderr enumeration of the registered tools. */
export function boot_log_line(cache: ToolCache): string {
    const total = cache.names().length;
    const implemented = cache.implemented_names().length;
    const stubs = total - implemented;
    return (
        `mcp-server: registered ${total} tools ` +
        `(${implemented} implemented, ${stubs} stubs): ${_pyReprList(cache.names())}`
    );
}

// ---------------------------------------------------------------------
// Parity primitives
// ---------------------------------------------------------------------

/** Mirror Python truthiness for the small set of values handlers test. */
function _pyTruthy(value: unknown): boolean {
    if (value === undefined || value === null || value === false) {
        return false;
    }
    if (value === 0 || value === '') {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
}

/** Mirror Python `int(x)` for the header `v` field (int-or-stringy-int). */
function _pyInt(value: unknown): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const n = Number.parseInt(value, 10);
        return Number.isNaN(n) ? 0 : n;
    }
    return 0;
}

/** Mirror Python `str.__lt__` (UTF-16 code-unit ordering matches CPython for BMP). */
function _strCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** pathlib `Path` ordering: compare path COMPONENTS lexicographically. */
function _pathlibCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const c = _strCmp(pa[i]!, pb[i]!);
        if (c !== 0) {
            return c;
        }
    }
    return pa.length - pb.length;
}

/** Mirror Python `repr(list_of_str)` for the boot-log enumeration. */
function _pyReprList(values: string[]): string {
    return `[${values.map((v) => `'${v}'`).join(', ')}]`;
}
