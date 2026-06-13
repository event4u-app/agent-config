// MCP telemetry sink — Phase 1 J4 instrumentation.
//
// Per `agents/roadmaps/archive/road-to-mcp-full-coverage.md` §Phase 1 J4 +
// `docs/contracts/mcp-tool-stub-envelope.md`, both transports log every
// `tools/call` with `{tool_name, client_id_hash, ts, transport,
// outcome}`. Payload bodies are never logged; the client identifier is
// hashed at the server boundary so the queryable store never sees raw
// identity.
//
// Outcomes:
//
// - `implemented` — real handler ran (no envelope returned).
// - `stub` — catalog entry missing this transport; `not_implemented`
//   envelope returned.
// - `latent_demand` — caller asked for a tool not in the catalog.
//
// The sink writes JSONL to `agents/runtime/mcp-telemetry/calls.jsonl` under the
// consumer root. Failure to write must not break the wire surface: the
// `record_call` helper swallows OSError + ValueError and emits a single
// warning to stderr.
//
// TS twin of telemetry.py (py2ts Phase 8). Mirrors the full public surface:
//   - Outcome type, TELEMETRY_REL_DIR, TELEMETRY_FILENAME, hash_client_id,
//     build_record, record_call.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type Outcome = 'implemented' | 'stub' | 'latent_demand';

// Stable file location relative to consumer_root. Phase 2 K1 routes
// this into a queryable store; Phase 1 only needs the file to exist.
export const TELEMETRY_REL_DIR = 'agents/runtime/mcp-telemetry';
export const TELEMETRY_FILENAME = 'calls.jsonl';

// Truncation length for the client_id hash. 12 hex chars = 48 bits of
// entropy — enough to distinguish hundreds of consumers without
// becoming a re-identification vector.
const _HASH_LEN = 12;

/**
 * Identity components that together pin a consumer install.
 *
 * USER + machine hostname + repo path is a stable triple that survives
 * sessions without leaking PII into the log. The hash never reverses.
 */
function _client_id_seed(): string {
    const user = process.env.USER || process.env.USERNAME || 'unknown';
    let host = process.env.HOSTNAME;
    if (!host) {
        // Mirrors Python `os.uname().nodename` (POSIX) — Node exposes
        // `os.hostname()`. Guarded so an empty value falls through to "unknown".
        try {
            host = os.hostname();
        } catch {
            host = undefined;
        }
    }
    host = host || 'unknown';
    const cwd = _resolvePath(process.cwd());
    return `${user}|${host}|${cwd}`;
}

/** SHA-256(seed) truncated to 12 hex chars. Boundary-only call. */
export function hash_client_id(seed?: string): string {
    const raw = seed !== undefined ? seed : _client_id_seed();
    const digest = crypto.createHash('sha256').update(Buffer.from(raw, 'utf-8')).digest('hex');
    return digest.slice(0, _HASH_LEN);
}

/**
 * Resolve a path like Python `Path(...).resolve()` — absolutize + realpath
 * the existing prefix, tolerating a non-existent tail (Python resolve does
 * not require the path to exist; `fs.realpathSync` does, so fall back to a
 * plain absolute path on ENOENT).
 */
function _resolvePath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

/** Pick the JSONL location. Defaults to CWD when no override given. */
function _resolve_log_path(consumer_root?: string): string {
    const root = _resolvePath(consumer_root ?? process.cwd());
    return path.join(root, TELEMETRY_REL_DIR, TELEMETRY_FILENAME);
}

/** ISO-8601 UTC timestamp, seconds precision. */
function _now_iso(): string {
    // Mirrors Python `time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())`.
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Pure helper — assemble the record without touching the filesystem.
 *
 * Field insertion order matches the Python dict literal so the
 * compact-JSON serialization is byte-identical.
 */
export function build_record(options: {
    tool_name: string;
    outcome: Outcome;
    transport: string;
    client_id_hash_value?: string | null | undefined;
    ts?: string | null | undefined;
}): Record<string, unknown> {
    const { tool_name, outcome, transport, client_id_hash_value, ts } = options;
    return {
        tool_name,
        client_id_hash: client_id_hash_value || hash_client_id(),
        ts: ts || _now_iso(),
        transport,
        outcome,
    };
}

/**
 * Append one JSONL record. Returns the record or null on failure.
 *
 * Failures are swallowed: telemetry must never break the wire surface.
 * A single `mcp-server: warn: telemetry` line is emitted to stderr
 * so silent-failure windows show up in the boot log and the J6
 * healthcheck can detect them.
 */
export function record_call(options: {
    tool_name: string;
    outcome: Outcome;
    transport: string;
    consumer_root?: string | null | undefined;
    client_id_hash_value?: string | null | undefined;
}): Record<string, unknown> | null {
    const { tool_name, outcome, transport, consumer_root, client_id_hash_value } = options;
    const record = build_record({
        tool_name,
        outcome,
        transport,
        client_id_hash_value,
    });
    const target = _resolve_log_path(consumer_root ?? undefined);
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // json.dumps(record, separators=(",", ":")) — compact, no spaces.
        fs.appendFileSync(target, JSON.stringify(record) + '\n', { encoding: 'utf-8' });
    } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`mcp-server: warn: telemetry write failed: ${message}\n`);
        return null;
    }
    return record;
}
