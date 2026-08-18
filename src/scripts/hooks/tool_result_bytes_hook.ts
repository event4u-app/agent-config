#!/usr/bin/env tsx
/**
 * Tool-result byte counter — capture only, no behaviour change
 * (road-to-inbox-harvest-2026-08-d-context-ledger Phase 1, Step 1.1).
 *
 * Why this exists. `hook-token-budget.json` registers the gap in its own
 * words: *"bytes-into-context from tool RESULTS is not instrumented
 * anywhere (the census covers hook payloads only)"*. The injection census
 * measures what HOOKS put into context — a few kilobytes per turn under a
 * per-slot cap. It does not measure what TOOLS put into context, which is
 * the larger number by any plausible margin and the one nobody can cite.
 * Every claim about context cost in this tree is therefore made against a
 * denominator that excludes its own dominant term.
 *
 * This concern is the instrument and ONLY the instrument. It appends; it
 * never decides, never advises, and emits nothing to the model. The
 * threshold question — when is a tool result too large — is deliberately
 * NOT answered here: the distribution has never been observed, and a
 * threshold set before the distribution is a number invented rather than
 * measured. That ordering is the house rule this repository has paid to
 * learn more than once.
 *
 * ── What is recorded, and what is refused ──────────────────────────────
 *
 * PRIVACY BY CONSTRUCTION — never widen this file to record content.
 *
 * The record type has exactly three fields and NONE of them can hold free
 * text: a timestamp, a tool NAME (an id-shaped enum — `Read`, `Bash`,
 * `Grep` — the same single host string `orchestration_record_hook` already
 * records), and a BYTE COUNT. A tool result routinely carries file
 * contents, command output, secrets in an env dump, and customer data from
 * an API response. None of it reaches this file's output, because the
 * output has no field able to carry it. A record shape that cannot hold a
 * secret has no scrubber that can fail — the same construction
 * `domain-safety-pii` § Surface 2 prescribes for logs and the reason the
 * sibling `subagent-ledger` refuses `last_assistant_message` in any form.
 *
 * The result is measured, never read: `_resultBytes` computes a length and
 * discards the value in the same expression.
 *
 * payload-bodies-waiver: result — measured, never read. This concern
 * deliberately declares NO `needs_payload_bodies` in `hook_manifest.yaml`: the
 * dispatcher omits the body and passes its exact UTF-8 byte length in the stub,
 * which is the only thing this file ever wanted. Declaring `result` here would
 * silently restore the 2 MB payload for the one concern the omission was built
 * for (`road-to-per-turn-hook-economy` step 2.2), and the census would look
 * identical while the cost came back. The `RESULT_KEYS` literals below are the
 * key NAMES this concern looks under, not a read of the body.
 *
 * ── Always exit 0 ─────────────────────────────────────────────────────
 *
 * A `warn` (exit 2) is read as a hard BLOCK on this host, and this concern
 * has nothing to say to the model. Every path returns EXIT_ALLOW —
 * malformed envelope, unparseable payload, unwritable disk. An instrument
 * that can fail a turn is a mechanism, and this is not one yet.
 *
 * ── Absence is recorded, not inferred ─────────────────────────────────
 *
 * A payload carrying no readable result writes a line with `bytes: null`
 * and `measurable: false` rather than writing nothing. The two cases are
 * otherwise byte-identical in the output — "this host does not carry tool
 * results in its PostToolUse payload" and "no tools ran" would produce the
 * same empty file, and the first is a finding about the instrument's own
 * coverage that the baseline has to be able to see. This is the
 * instrument-goes-quiet failure the sibling ledger's round-1 review fixed
 * one layer down, applied here before it can be shipped.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { stubbedBytes } from './payload_stub.js';

const EXIT_ALLOW = 0;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Census file, relative to the consumer repo root. Sibling of
 * `injection-census.jsonl` in the same directory and the same
 * `{ts, …, bytes}` line shape — one family, two units: that file counts
 * bytes this suite injects, this one counts bytes the host's tools do.
 * Gitignored via `/agents/runtime/`.
 */
export const CENSUS_FILE = path.join('agents', 'runtime', 'state', 'tool-result-census.jsonl');

/** The payload keys a host may use for a tool's result, widest first. */
const RESULT_KEYS = ['tool_response', 'toolResponse', 'tool_result', 'toolUseResult'] as const;

/**
 * UTF-8 byte length of a tool result, or `null` when the payload carries
 * none under any known key.
 *
 * A result is an object on most tools and a bare string on some (`Bash`
 * returns its stdout directly — see the sibling hook's own test corpus), so
 * both shapes are measured. The sibling's `extractToolResult` returns
 * `JsonObject | null` and would report a bare-string result as absent,
 * which is correct for its purpose (it reads named usage fields) and wrong
 * for this one: a 400 KB command output is exactly the case this counter
 * exists to see, and it is precisely the shape that extractor drops.
 *
 * Bytes, not characters: a multibyte result costs what it costs on the
 * wire, and `String.length` would under-report it.
 *
 * ## The dispatcher may omit the body, and then it passes the length instead
 *
 * `road-to-per-turn-hook-economy` step 2.2. This concern declares no
 * `needs_payload_bodies` in `hook_manifest.yaml` — its own header says the
 * result is "measured, never read", and that is exactly the concern the
 * payload opt-in exists for. So the dispatcher replaces the body with a stub
 * carrying its UTF-8 byte length, computed the same way this function
 * computes it, and this function reads it back.
 *
 * Without the stub branch the census would keep filling — with the ~120-byte
 * length of the STUB, silently, forever. An instrument that reports a wrong
 * number is worse than one that reports none, which is why the branch is
 * first and why `stubbedBytes` distinguishes "omitted, this many bytes" from
 * "present, measure it".
 */
export function _resultBytes(payload: JsonObject): number | null {
    for (const key of RESULT_KEYS) {
        const v = payload[key];
        if (v === undefined || v === null) continue;
        const omitted = stubbedBytes(v);
        if (omitted !== undefined) return omitted;
        if (typeof v === 'string') return Buffer.byteLength(v, 'utf8');
        try {
            return Buffer.byteLength(JSON.stringify(v), 'utf8');
        } catch {
            // Circular or otherwise unserialisable — unmeasurable, not zero.
            return null;
        }
    }
    return null;
}

/** The tool's name, read from the same positions the sibling hook reads. */
export function _toolName(payload: JsonObject, envelope: JsonObject): string | null {
    const candidates = [
        payload['tool_name'],
        payload['toolName'],
        payload['tool'],
        envelope['tool_name'],
        envelope['tool'],
    ];
    for (const v of candidates) {
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/** `${ts.slice(0,7)}` is NOT used here — the census is one flat file, as its sibling is. */
function censusFile(consumerRoot: string): string {
    return path.join(consumerRoot, CENSUS_FILE);
}

export interface CensusLine {
    ts: string;
    tool: string | null;
    bytes: number | null;
    /** `false` ⇒ the payload carried no readable result. See the header. */
    measurable: boolean;
}

export function _appendCensusLine(consumerRoot: string, line: CensusLine): void {
    if (is_replay_mode()) return;
    const file = censusFile(consumerRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
}

/** Process an ALREADY-PARSED dispatcher envelope. Always returns EXIT_ALLOW. */
export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        if (envelope['event'] !== 'post_tool_use') return EXIT_ALLOW;

        const payload = unwrapPayload(envelope);
        const bytes = _resultBytes(payload);

        _appendCensusLine(consumerRoot, {
            ts: new Date().toISOString(),
            tool: _toolName(payload, envelope),
            bytes,
            measurable: bytes !== null,
        });
    } catch {
        // Malformed payload, unwritable disk, anything — never disturb the run.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

/** Resolve the consumer repo root, same precedence as the sibling ledger. */
export function resolveConsumerRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        for (const key of ['workspace_root', 'project_root']) {
            const v = envelope[key];
            if (typeof v === 'string' && v) return v;
        }
        const cwd = unwrapPayload(envelope)['cwd'];
        if (typeof cwd === 'string' && cwd) return cwd;
    }
    return process.cwd();
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonValue = {};
    try {
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, resolveConsumerRoot(envelope));
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
