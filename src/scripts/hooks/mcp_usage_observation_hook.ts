#!/usr/bin/env tsx
/**
 * Foreign MCP tool names, observed on `post_tool_use`
 * (road-to-neighbours-that-pull-their-weight step 3.3, decision D12).
 *
 * DEFAULT-ON LOCAL OBSERVATION, AND IT BYPASSES THE TELEMETRY OPT-IN. Stated
 * here first because it is the one property a reader must not have to infer.
 * This concern writes on every install, whether or not the org telemetry switch
 * was ever enabled, because the file it writes feeds `doctor neighbours` — a
 * report the consumer runs on their own tree — and gating it on an org switch
 * would publish `0` on every install that never enabled one. Nothing here is
 * telemetry: no transport reads the file, it is never spooled, and it lives
 * under gitignored `agents/runtime/` (decision D9).
 *
 * WHAT IS RECORDED: the tool NAME, `mcp__<server>__<tool>`, and the UTC day it
 * was last seen. Nothing else — no arguments, no response, no session id, no
 * host. The dispatcher serves this concern a REDUCED payload: its manifest
 * entry declares no `needs_payload_bodies`, so `tool_input` and `tool_response`
 * arrive as size-only stubs and cannot be recorded even by mistake.
 *
 * RETENTION. A map keyed by tool name, rewritten in place at most once per day
 * per name — bounded by the neighbour's tool surface, so it needs no TTL job.
 * The reader applies a 30-day window; older entries stop counting. Deleting
 * `agents/runtime/neighbour-tool-use.json` erases all of it.
 *
 * Why a concern of its own rather than a branch of `telemetry-usage`: that
 * concern's dispatcher filter is `tools: [Skill]` and matches exactly, so a
 * branch there was never called for an MCP tool; and a concern named for
 * opt-in telemetry should not also carry default-on local collection. Both
 * were the AI council's findings (2026-10-02); the owner chose this shape.
 *
 * No `tools:` filter on the manifest entry, deliberately: MCP tool names are
 * not enumerable and matching is exact. The prefix test below is the filter.
 *
 * Exit code is ALWAYS 0 and nothing is printed — it observes, never gates.
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';

import { FOREIGN_TOOL_USE_REL, MCP_TOOL_PREFIX, resolveStoreRoot, usageDay } from '../_lib/neighbour_tool_use.js';
import { update_json_under_lock } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

type JsonObject = { [k: string]: unknown };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The MCP tool name off the envelope, or null for anything else. */
export function mcpToolName(envelope: unknown): string | null {
    if (!isObject(envelope)) return null;
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const v = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'];
    return typeof v === 'string' && v.startsWith(MCP_TOOL_PREFIX) && v.length > MCP_TOOL_PREFIX.length ? v : null;
}

function record(envelope: unknown, consumer_root: string): number {
    try {
        const tool = mcpToolName(envelope);
        if (tool === null) return EXIT_ALLOW;
        const day = usageDay(new Date());
        update_json_under_lock<Record<string, string>>(
            path.join(resolveStoreRoot(consumer_root), FOREIGN_TOOL_USE_REL),
            (seen) => (seen[tool] === day ? null : ({ ...seen, [tool]: day } as Record<string, string>)),
            { blocking: false },
        );
    } catch {
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
    let envelope: unknown;
    try {
        const raw = stdin_text.trim();
        if (!raw) return EXIT_ALLOW;
        envelope = JSON.parse(raw);
    } catch {
        return EXIT_ALLOW;
    }
    return record(envelope, options.consumer_root);
}

function _root(envelope: unknown): string {
    if (isObject(envelope)) {
        const v = envelope['cwd'] ?? envelope['workspace_root'] ?? envelope['project_root'];
        if (typeof v === 'string' && v) return v;
    }
    return process.cwd();
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: unknown = {};
    try {
        envelope = raw.trim() ? JSON.parse(raw) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return record(envelope, _root(envelope));
}

// Bundle-safety: guarded at the call site so esbuild drops the whole entry
// check inside the shared hook bundle (see telemetry_usage_hook.ts, D11).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (typeof __AGENT_CONFIG_BUNDLE__ === 'undefined' || !__AGENT_CONFIG_BUNDLE__) {
    if (_isCliEntry()) process.exit(main());
}
