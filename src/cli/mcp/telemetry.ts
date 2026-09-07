/**
 * Call telemetry for the stdio-lite MCP server (roadmap step 4.1).
 *
 * WHY THIS EXISTS. Before it, `grep -rn 'telemetry|collector|record'
 * src/cli/mcp/*.ts` was empty: the two lite tools were invisible, so every
 * statement about whether the lite surface is used at all was an assumption.
 * One row per `tools/call` turns that into a reading — including a zero, which
 * is a result.
 *
 * THREE CONSTRAINTS THE ROADMAP SET, AND HOW EACH IS MET.
 *
 * - **No second sink.** Rows go to the sink that already collects MCP
 *   `tools/call` records, `agents/runtime/mcp-telemetry/calls.jsonl`, through
 *   the same `record_call` the kernel server uses. Nothing new is created.
 * - **No new consent gate.** The switch is the EXISTING
 *   `telemetry.artifact_engagement.enabled` key, default `false`. No key is
 *   introduced, so a consumer who has not opted into telemetry does not
 *   acquire a new thing to opt out of.
 * - **One row per call, none when off.** `recordLiteCall` is the only writer
 *   and returns `null` without touching the filesystem when the gate is off.
 *
 * PRIVACY BY CONSTRUCTION. Two fields are caller-influenced and both are
 * clamped at the boundary. `host` is resolved against a CLOSED vocabulary; an
 * unrecognised client name becomes `other`, never the string the client sent.
 * `tool_name` is caller-supplied on the wire — a client may call
 * `tools/call` with ANY name — so a name outside a conservative identifier
 * shape is recorded as `other_tool` rather than stored verbatim. Without that
 * clamp the sink would accept a path or a secret as a tool name and this
 * report would print it. The record therefore has no field capable of carrying
 * free-form text, and there is no scrubbing pass that could fail because there
 * is nothing to scrub. The client-install hash comes from the kernel collector
 * unchanged.
 *
 * NEVER THROWS. Telemetry must not break the wire surface; every path here
 * either records or returns `null`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { record_call, type Outcome } from '../../scripts/mcp_server/telemetry.js';

/** Transport label for this surface — distinguishes it from the kernel server. */
export const LITE_TRANSPORT = 'stdio-lite';

/** The settings key that gates every row. Deliberately an EXISTING key. */
export const LITE_TELEMETRY_SETTING = 'telemetry.artifact_engagement.enabled';

/**
 * The closed host vocabulary.
 *
 * Membership is what makes the field non-identifying: a value is either one of
 * these literals, `other`, or `unknown`. It is matched against the MCP
 * `clientInfo.name` a client sends at `initialize`, lower-cased, with `_` and
 * spaces folded to `-`; a name that merely CONTAINS one of these is resolved to
 * it, because clients ship names like `claude-code-cli` and `Cursor (0.42)`.
 */
export const KNOWN_HOSTS: readonly string[] = [
    'claude-code',
    'claude-desktop',
    'cursor',
    'windsurf',
    'cline',
    'gemini-cli',
    'copilot',
    'augment',
    'aider',
    'codex',
    'roocode',
    'continue',
    'kilocode',
    'zed',
    'jetbrains',
    'kiro',
    'opencode',
    'trae',
    'warp',
];

/** No `initialize` seen yet, or it carried no client name. */
export const HOST_UNKNOWN = 'unknown';
/** A client name that is not in the closed vocabulary. Never the raw string. */
export const HOST_OTHER = 'other';

/**
 * Resolve a client-supplied name onto the closed vocabulary.
 *
 * Longest match first, so `claude-desktop` is not swallowed by a shorter
 * sibling and `claude-code` wins over a bare `claude` substring.
 */
export function normalizeHost(clientName: unknown): string {
    if (typeof clientName !== 'string') return HOST_UNKNOWN;
    const folded = clientName.trim().toLowerCase().replace(/[_\s]+/g, '-');
    if (folded === '') return HOST_UNKNOWN;
    const byLength = [...KNOWN_HOSTS].sort((a, b) => b.length - a.length);
    for (const known of byLength) {
        if (folded === known || folded.includes(known)) return known;
    }
    return HOST_OTHER;
}

/**
 * The shape a tool name must have to be stored verbatim.
 *
 * Conservative on purpose: MCP tool names are identifiers, so anything with a
 * separator, whitespace, or unusual length is not a tool name that this surface
 * could ever serve — it is caller-supplied text, and text is what must not
 * reach the store.
 */
const TOOL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

/** A caller-supplied name that is not identifier-shaped. Never the raw string. */
export const TOOL_OTHER = 'other_tool';

/**
 * Clamp a wire tool name onto a storable one.
 *
 * A name this surface actually serves always passes; an unknown but
 * identifier-shaped name passes too, because that is the latent-demand signal
 * the store exists to carry. Everything else becomes `other_tool`.
 */
export function normalizeToolName(name: unknown, isLiteTool: boolean): string {
    if (typeof name !== 'string' || name === '') return '';
    if (isLiteTool) return name;
    return TOOL_NAME_RE.test(name) ? name : TOOL_OTHER;
}

/** `str.strip()` on both ends, matching the sibling settings peeks in `src/cli`. */
function _strip(s: string): string {
    return s.replace(/^[ \t\r\f\v]+/, '').replace(/[ \t\r\f\v]+$/, '');
}

/**
 * Read `telemetry.artifact_engagement.enabled` from a project settings file.
 *
 * A deliberately small nested-key peek over the YAML subset this package's own
 * settings files are written in — the same shape `workspace_crypto.isEnabled`
 * and `workspace_analytics` already use in `src/cli`, and for the same reason:
 * the lite server must stay pure-Node with no YAML dependency.
 *
 * Every failure resolves to `false`. Missing file, unreadable file, missing
 * section, missing key and an unparseable value are all indistinguishable and
 * all mean OFF — the default-off doctrine the engagement collector states for
 * itself.
 */
export function liteTelemetryEnabled(settingsPath?: string): boolean {
    const p = settingsPath ?? path.join(process.cwd(), '.agent-settings.yml');
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return false;
    }
    // Track the two nesting levels the key needs: `telemetry:` at column 0,
    // then `artifact_engagement:` beneath it, then `enabled:` beneath that.
    let inTelemetry = false;
    let inSection = false;
    let sectionIndent = -1;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/[ \t\r\f\v]+$/, '');
        if (line === '' || _strip(line).startsWith('#')) continue;
        const indent = line.length - line.replace(/^ +/, '').length;
        const body = _strip(line);
        if (indent === 0) {
            inTelemetry = body === 'telemetry:';
            inSection = false;
            sectionIndent = -1;
            continue;
        }
        if (!inTelemetry) continue;
        if (!inSection) {
            if (body === 'artifact_engagement:') {
                inSection = true;
                sectionIndent = indent;
            }
            continue;
        }
        // Left the section — a sibling key at or above its indent closes it.
        if (indent <= sectionIndent) {
            inSection = body === 'artifact_engagement:';
            if (inSection) sectionIndent = indent;
            continue;
        }
        if (body.startsWith('enabled:')) {
            const value = _strip(body.slice('enabled:'.length)).toLowerCase();
            return value === 'true' || value === 'yes' || value === 'on';
        }
    }
    return false;
}

/**
 * Classify one lite `tools/call`.
 *
 * `implemented` — a lite tool ran. `stub` — the name is not on this surface, so
 * the `not_implemented` envelope was returned, which is exactly the condition
 * the kernel collector defines that outcome for. The lite server cannot
 * distinguish "in the kernel catalogue but absent here" from "in no catalogue
 * at all", so it never claims `latent_demand`: the kernel server owns that
 * distinction, and guessing it here would put an unearned claim in the store.
 */
export function classifyLiteOutcome(isLiteTool: boolean): Outcome {
    return isLiteTool ? 'implemented' : 'stub';
}

/**
 * Append exactly one row for one `tools/call`, or nothing.
 *
 * Returns the record written, or `null` when the gate is off or the write
 * failed. Never throws.
 */
export function recordLiteCall(options: {
    toolName: string;
    isLiteTool: boolean;
    host: string;
    consumerRoot?: string | undefined;
    settingsPath?: string | undefined;
}): Record<string, unknown> | null {
    const { toolName, isLiteTool, host, consumerRoot, settingsPath } = options;
    const stored = normalizeToolName(toolName, isLiteTool);
    if (stored === '') return null;
    try {
        if (!liteTelemetryEnabled(settingsPath)) return null;
        return record_call({
            tool_name: stored,
            outcome: classifyLiteOutcome(isLiteTool),
            transport: LITE_TRANSPORT,
            consumer_root: consumerRoot,
            host,
        });
    } catch {
        return null;
    }
}
