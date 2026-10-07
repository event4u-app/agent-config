/**
 * The foreign-MCP-tool-name store: one writer on the post-tool hook path, one
 * reader in the neighbour census.
 *
 * WHY A MODULE OF ITS OWN, AND NOT A CONSTANT IN EITHER SIDE. The writer lives
 * in `hooks/mcp_usage_observation_hook.ts`, which is inlined into the shared hook
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
 *
 * GROWTH, DECLARED (scale-discipline R-A7). The store is a map keyed by tool
 * NAME, not an append log: one entry per distinct `mcp__…` name the consumer
 * has ever called, each rewritten in place at most once per day. The bound is
 * therefore the size of the neighbour's tool surface — tens of entries, not a
 * series — so it needs no TTL job. The reader applies the window; entries older
 * than it stay on disk and stop counting, which is why a stale entry is inert
 * rather than wrong.
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

/** The filename the writer's root is the directory of. */
const SETTINGS_FILENAME = '.agent-settings.yml';

/** `YYYY-MM-DD` in UTC — the granularity the store keys on. */
export function usageDay(now: Date): string {
    return now.toISOString().slice(0, 10);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Is this store value a day the window comparison can be trusted on?
 *
 * The comparison is lexicographic, which is exactly right for `YYYY-MM-DD` and
 * quietly wrong for anything else: `'TODO'`, `'unknown'` and `'hand edited'`
 * all sort ABOVE a real cutoff, so without this check a hand-edited or
 * half-written store inflates the count instead of being ignored. The reader's
 * promise is that a malformed store yields nothing, and a malformed VALUE is
 * the likelier half of that.
 */
export function isUsageDay(value: unknown): value is string {
    return typeof value === 'string' && DAY_RE.test(value);
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
 * Does `tool` belong to the server whose sanitised key is `segment`?
 *
 * Driven by the KNOWN segment rather than by parsing the tool name, and that
 * direction is the whole correctness argument. Parsing — split at the first
 * `__` after the prefix — is ambiguous exactly where {@link serverSegment} is
 * lossy: `Acme Inc. Tools` sanitises to `Acme_Inc__Tools`, whose own name
 * contains the separator, so a parser reads the server as `Acme_Inc` and the
 * census reports `0` for a server in daily use. That is the same never-matched
 * zero `serverSegment` exists to prevent, reintroduced one layer down. Matching
 * against the keys `.mcp.json` actually lists cannot be ambiguous, because the
 * candidate set is finite and known.
 */
export function toolBelongsTo(tool: string, segment: string): boolean {
    if (!tool.startsWith(MCP_TOOL_PREFIX)) return false;
    const rest = tool.slice(MCP_TOOL_PREFIX.length);
    return rest === segment || rest.startsWith(`${segment}__`);
}

/**
 * The directory the store lives under, from any directory inside the project.
 *
 * Both the writer and the reader call this one function, so the store is
 * rooted at the directory holding `.agent-settings.yml` on both sides: a
 * session started in a subdirectory would otherwise scatter one store per
 * directory, and a monorepo with settings at the repo root and `.mcp.json`
 * under `packages/web` would read `0` for a server in daily use. A fixture
 * still pins the two sides equal end to end.
 *
 * No settings file on any ancestor → `start`.
 */
export function resolveStoreRoot(start: string): string {
    let dir = path.resolve(start);
    for (;;) {
        try {
            if (fs.statSync(path.join(dir, SETTINGS_FILENAME)).isFile()) return dir;
        } catch {
            // Not here — keep walking.
        }
        const parent = path.dirname(dir);
        if (parent === dir) return path.resolve(start);
        dir = parent;
    }
}

/**
 * Distinct tools seen per server inside the window, keyed by server segment.
 *
 * `segments` is the closed candidate set — the sanitised `.mcp.json` keys. Every
 * one of them appears in the result, so a server with no sightings reads `0`
 * rather than being absent. Longest segment wins where one is a prefix of
 * another, so a tool is counted once.
 *
 * A missing, unreadable or malformed store yields all-zero — true of what was
 * observed. It does not mean the server was unused, and the census says so next
 * to the number.
 */
export function toolsUsedByServer(
    projectRoot: string,
    now: Date,
    segments: Iterable<string>,
): Map<string, number> {
    const known = [...new Set(segments)].sort((a, b) => b.length - a.length);
    const counts = new Map<string, number>(known.map((s) => [s, 0]));
    if (known.length === 0) return counts;

    let decoded: unknown;
    try {
        const root = resolveStoreRoot(projectRoot);
        decoded = JSON.parse(fs.readFileSync(path.join(root, FOREIGN_TOOL_USE_REL), 'utf-8'));
    } catch {
        return counts;
    }
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return counts;

    const today = usageDay(now);
    // Inclusive of both ends, so the span is WINDOW days and not WINDOW+1: a
    // floor computed at `now - 30d` would count 31 distinct days under a field
    // named `tools_used_30d`.
    const floor = usageDay(new Date(now.getTime() - (TOOL_USE_WINDOW_DAYS - 1) * 86_400_000));

    for (const [tool, seen] of Object.entries(decoded as Record<string, unknown>)) {
        // A future date is as much a sign of a bad write as a malformed one,
        // and without the upper bound a single `9999-01-01` counts forever.
        if (!isUsageDay(seen) || seen < floor || seen > today) continue;
        for (const segment of known) {
            if (toolBelongsTo(tool, segment)) {
                counts.set(segment, (counts.get(segment) ?? 0) + 1);
                break;
            }
        }
    }
    return counts;
}
