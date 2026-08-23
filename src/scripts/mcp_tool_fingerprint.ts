/**
 * Fingerprint store for third-party MCP tool definitions.
 *
 * Step 1.1 of `road-to-mcp-runtime-integrity`. The threat is a **rug-pull**: a
 * third-party MCP server whose tool definition is benign at connection time and
 * mutated afterwards, so the description the model reasons about is no longer the
 * description that was reviewed. Nothing in this tree detected that:
 * `lint_mcp_config_security.ts` reads shipped CONFIG for supply-chain smells and
 * never sees a definition change after connection, and `audit_mcp_tools.ts` is an
 * inventory generator for THIS package's own consumer catalog.
 *
 * WHAT THIS FILE IS NOT, and the distinction is load-bearing. It is a store and a
 * comparison, bound to **no hook slot**. The roadmap's `## The no-silent-downgrade
 * rule` forbids shipping a `post_tool_use` or session-start variant — a check that
 * fires after first use is a post-mortem, not a control, for a tool with
 * irreversible side effects — and the pre-use slot is gated on a per-turn
 * composite ceiling that is not armed (`hook-latency-budget.json`,
 * `observe_only: true`, `p50_ci: null`). So the placement decision is deliberately
 * absent here rather than quietly resolved: **rug-pull protection remains absent
 * and the protection level is zero** until an owner records which side of that
 * trade-off they chose. Wiring this module into a slot without that record is the
 * silent downgrade the roadmap binds itself against.
 *
 * THIRD-PARTY ONLY. This package's own consumer catalog is already covered by
 * `audit_mcp_tools.ts`; fingerprinting it here would produce two sources of truth
 * for the same tools.
 *
 * KEYED BY SERVER PLUS TOOL NAME, so a renamed tool reads as a NEW tool rather
 * than as a mutation of the old one. That is the difference between "this server
 * shipped a new tool" and "this server changed a tool you already approved", and
 * collapsing them is how a mismatch surface becomes noise.
 *
 * A FIRST SIGHTING IS RECORDED, NOT REPORTED. Third-party servers legitimately
 * add tools; reporting every first sighting with the same weight as a mutation
 * trains the reader to ignore the surface, and noise on a security surface is
 * worse than silence because it reads as coverage (Risk 4 in the roadmap).
 *
 * PII-exclusion-by-construction: a record holds a server id, a tool name, a hex
 * digest and an ISO date. There is NO field capable of holding the description
 * text, the schema, or any free-form content — the digest is one-way and the
 * inputs are not retained. Never widen it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { update_json_under_lock } from './hooks/state_io.js';

/** Where the store lives, relative to the workspace root. */
export const FINGERPRINT_STORE = path.join(
    'agents',
    'runtime',
    'state',
    'mcp-tool-fingerprints.json',
);

export const SCHEMA_VERSION = 1;

/**
 * The three fields a rug-pull can mutate to change what the model reasons about.
 *
 * `name` is included even though it is also half the key: a tool whose key is
 * `server/x` and whose declared `name` later reads `y` is a mismatch, not a
 * rename, and leaving `name` out of the digest would let that pass.
 */
export interface McpToolDefinition {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema?: unknown;
}

export interface FingerprintRecord {
    /** Hex sha256 of the canonical definition. */
    readonly digest: string;
    /** ISO date (day resolution — a timestamp would be a behavioural fingerprint). */
    readonly first_seen: string;
}

export type FingerprintOutcome =
    /** No record existed. Written silently; nothing to report. */
    | { readonly kind: 'first-sighting'; readonly key: string; readonly digest: string }
    /** A record existed and matches. Nothing to report. */
    | { readonly kind: 'unchanged'; readonly key: string; readonly digest: string }
    /** A record existed and does NOT match. This is the surface. */
    | {
          readonly kind: 'mismatch';
          readonly key: string;
          readonly digest: string;
          readonly recorded: string;
          readonly first_seen: string;
      };

/**
 * The store key. Server id and tool name, separated by a character neither may
 * contain unescaped, so two distinct pairs cannot collide onto one key — the
 * same failure `session_state_file` exists to prevent for session ids.
 */
export function fingerprintKey(server: string, toolName: string): string {
    const esc = (s: string): string => s.replace(/%/g, '%25').replace(/\//g, '%2F');
    return `${esc(server)}/${esc(toolName)}`;
}

/**
 * Canonical JSON with object keys sorted at every depth.
 *
 * Without this the digest is a fingerprint of the SERIALISER's key order rather
 * than of the definition, and a server that reorders its schema keys between two
 * connections would read as a rug-pull. Arrays keep their order — order is
 * meaningful in a schema's `required` list and reordering it IS a change.
 */
export function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            out[k] = canonicalize((value as Record<string, unknown>)[k]);
        }
        return out;
    }
    return value;
}

/**
 * Hex sha256 over the canonical form of the three mutable fields.
 *
 * `description` and `inputSchema` are normalised to `null` when absent so that
 * "absent" and "explicitly null" hash alike — a server toggling between the two
 * has changed nothing the model can read, and reporting it would be noise.
 */
export function fingerprintDefinition(def: McpToolDefinition): string {
    const canonical = canonicalize({
        name: def.name,
        description: def.description ?? null,
        inputSchema: def.inputSchema ?? null,
    });
    return crypto.createHash('sha256').update(JSON.stringify(canonical), 'utf-8').digest('hex');
}

interface StoreDoc {
    schema_version: number;
    tools: Record<string, FingerprintRecord>;
}

function emptyDoc(): StoreDoc {
    return { schema_version: SCHEMA_VERSION, tools: {} };
}

/** Read the store. A missing, unreadable or malformed store reads as empty. */
export function readStore(workspaceRoot: string): StoreDoc {
    try {
        const decoded: unknown = JSON.parse(
            fs.readFileSync(path.join(workspaceRoot, FINGERPRINT_STORE), 'utf-8'),
        );
        if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
            const tools = (decoded as Record<string, unknown>)['tools'];
            return {
                schema_version: SCHEMA_VERSION,
                tools:
                    typeof tools === 'object' && tools !== null && !Array.isArray(tools)
                        ? (tools as Record<string, FingerprintRecord>)
                        : {},
            };
        }
    } catch {
        // Absent or malformed both mean "nothing recorded", and the outcome that
        // follows is `first-sighting` — which reports nothing. A corrupt store
        // must never be read as a mismatch: that would turn one bad write into a
        // rug-pull alert on every tool at once.
    }
    return emptyDoc();
}

/**
 * Record `def` for `server`, and say what the record implies.
 *
 * Read-modify-write under ONE lock, not three steps: two hosts connected to the
 * same workspace fingerprint concurrently, and `atomic_write_json` makes the
 * publish atomic while leaving load -> merge -> publish racy — which loses a
 * whole tool's record rather than merely an increment, because this mutator
 * republishes the `tools` map. Same primitive and same reason as
 * `rule-trips.json`.
 *
 * `today` is injected rather than read from the clock so a caller (and a test)
 * can pin it; nothing in this module reads wall time on its own.
 */
export function recordFingerprint(
    workspaceRoot: string,
    server: string,
    def: McpToolDefinition,
    today: string,
): FingerprintOutcome {
    const key = fingerprintKey(server, def.name);
    const digest = fingerprintDefinition(def);
    let outcome: FingerprintOutcome = { kind: 'first-sighting', key, digest };

    update_json_under_lock<StoreDoc>(path.join(workspaceRoot, FINGERPRINT_STORE), (loaded) => {
        const doc: StoreDoc = { ...emptyDoc(), ...((loaded ?? {}) as Partial<StoreDoc>) };
        const tools: Record<string, FingerprintRecord> =
            typeof doc.tools === 'object' && doc.tools !== null && !Array.isArray(doc.tools)
                ? { ...doc.tools }
                : {};
        const prior = tools[key];
        if (prior === undefined) {
            tools[key] = { digest, first_seen: today };
            outcome = { kind: 'first-sighting', key, digest };
        } else if (prior.digest === digest) {
            outcome = { kind: 'unchanged', key, digest };
        } else {
            // The recorded digest is NOT overwritten. A mismatch is a surface for
            // a human decision, not a verdict, and silently re-baselining would
            // make the second read of a mutated tool report `unchanged` — which
            // is the one outcome a rug-pull must never produce.
            outcome = {
                kind: 'mismatch',
                key,
                digest,
                recorded: prior.digest,
                first_seen: prior.first_seen,
            };
        }
        return { schema_version: SCHEMA_VERSION, tools };
    });

    return outcome;
}

/**
 * Human-readable line for a mismatch, and nothing for the other two outcomes.
 *
 * Returning `null` rather than an empty string is deliberate: a caller that
 * prints whatever it gets back cannot accidentally emit a blank line for a
 * first sighting, which is the shape of "reported silently".
 */
export function describeOutcome(outcome: FingerprintOutcome): string | null {
    if (outcome.kind !== 'mismatch') return null;
    return (
        `mcp tool definition changed since it was first recorded: ${outcome.key} ` +
        `(recorded ${outcome.recorded.slice(0, 12)} on ${outcome.first_seen}, ` +
        `now ${outcome.digest.slice(0, 12)}) — review the change before using this tool`
    );
}
