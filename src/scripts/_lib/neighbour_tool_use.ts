/**
 * The foreign-MCP-tool-name store: one writer on the post-tool hook path, one
 * reader in the neighbour census.
 *
 * WHY A MODULE OF ITS OWN, AND NOT A CONSTANT IN EITHER SIDE. The writer lives
 * in `hooks/telemetry_usage_hook.ts`, which is inlined into the shared hook
 * bundle `check_hook_bundle_composition` caps; the reader lives in
 * `_lib/neighbour_census.ts`, which is not. Putting the pair here lets esbuild
 * tree-shake {@link toolsUsedByServer} out of the hook bundle while both sides
 * still name one path — a constant copied into two files is a store that
 * silently splits in two the first time one copy is edited.
 *
 * WHAT IS RECORDED, AND WHAT IS NOT. One map of `mcp__<server>__<tool>` to the
 * ISO date it was last seen. No arguments, no responses, no session id, no
 * project path beyond the file's own location. The names recorded are names the
 * consumer's own `.mcp.json` already lists, and the file is written under
 * `agents/runtime/`, which is gitignored and local-only — nothing here is sent
 * anywhere, and no transport reads it.
 *
 * NOT GATED ON THE TELEMETRY OPT-IN, DELIBERATELY. `telemetry_usage_hook`'s
 * Class-A capture is default-off because it feeds an outbound spool. This store
 * feeds `doctor neighbours`, a local report the consumer runs on their own tree.
 * Gating it on an org telemetry switch would make the census print `0` on every
 * install that never enabled one — a number that looks like a measurement and is
 * an instrumentation artifact, which is the exact failure the usage hook's own
 * header records from the collector it replaced.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Host-side prefix of every MCP tool name: `mcp__<server>__<tool>`. */
export const MCP_TOOL_PREFIX = 'mcp__';

/**
 * The store, relative to the project root. Gitignored; see the header.
 *
 * A literal with forward slashes rather than `path.join`, and the reason is
 * measured rather than stylistic: `path.join` here is a top-level call, so the
 * `node:path` namespace import survives into the hook bundle even though every
 * function in this module that needs it is tree-shaken out of that bundle.
 * `path.join(root, REL)` at each call site normalises the separator on Windows,
 * so the only thing lost is the authoring convention.
 */
export const FOREIGN_TOOL_USE_REL = 'agents/runtime/neighbour-tool-use.json';

/** The census window. 30 days, matching the step that asked for the number. */
export const TOOL_USE_WINDOW_DAYS = 30;

/** `YYYY-MM-DD` in UTC — the granularity the store keys on. */
export function usageDay(now: Date): string {
    return now.toISOString().slice(0, 10);
}

/**
 * The server segment of an MCP tool name, or `null` when the name is not one.
 *
 * `mcp__<server>__<tool>`; a name with no second `__` yields the whole
 * remainder, because a host that stops appending a tool segment should still be
 * attributed to its server rather than dropped.
 */
export function serverOf(tool: string): string | null {
    if (!tool.startsWith(MCP_TOOL_PREFIX)) return null;
    const rest = tool.slice(MCP_TOOL_PREFIX.length);
    if (!rest) return null;
    const sep = rest.indexOf('__');
    return sep < 0 ? rest : rest.slice(0, sep);
}

/**
 * The `.mcp.json` key as it appears inside a tool name.
 *
 * Hosts sanitise the key before embedding it — a server registered as
 * `claude.ai Claude Docs` arrives as `mcp__claude_ai_Claude_Docs__…`. Normalising
 * BOTH sides the same way is what keeps a matched count from quietly being a
 * zero: an exact-key match would report `0` for every server whose name carries
 * a dot or a space, which reads as "never used" rather than as "never matched".
 */
export function serverSegment(key: string): string {
    return key.replace(/[^A-Za-z0-9_-]/gu, '_');
}

/**
 * Distinct tools seen per server inside the window, keyed by server segment.
 *
 * A missing, unreadable or malformed store yields an empty map — the census
 * then prints `0`, which is true of what was observed. It does not mean the
 * server was unused, and the census says so next to the number.
 */
export function toolsUsedByServer(projectRoot: string, now: Date): Map<string, number> {
    const counts = new Map<string, number>();
    let decoded: unknown;
    try {
        decoded = JSON.parse(fs.readFileSync(path.join(projectRoot, FOREIGN_TOOL_USE_REL), 'utf-8'));
    } catch {
        return counts;
    }
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return counts;
    const cutoff = new Date(now.getTime() - TOOL_USE_WINDOW_DAYS * 86_400_000);
    const floor = usageDay(cutoff);
    for (const [tool, seen] of Object.entries(decoded as Record<string, unknown>)) {
        if (typeof seen !== 'string' || seen < floor) continue;
        const server = serverOf(tool);
        if (server === null) continue;
        counts.set(server, (counts.get(server) ?? 0) + 1);
    }
    return counts;
}
