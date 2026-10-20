/**
 * mcp_bridge — `.mcp.json` registration and the skill-tier projection lever.
 *
 * Extracted from `install.ts` by Phase 2.2 of `road-to-skill-delivery-over-mcp`,
 * for a mechanical reason worth stating: `check_source_size_budget` is a ratchet
 * over every line in a file above 1,500, `install.ts` is 5,466 of them, and the
 * gate's own message says a new violation is fixed and never baselined away. So
 * the feature lives here and `install.ts` keeps one-line call sites.
 *
 * Everything here is a pure function of its arguments or of the file system.
 * `ensureMcpBridge` is the one exception and takes its writer by injection —
 * `merge_json_file` lives in `install.ts` (eight other bridges use it) and
 * importing it back would make the cycle.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { probeHostCapabilities } from './host_capability.js';

/** `install.ts`'s deploy tuple: [written, skipped, status, paths]. */
export type DeployTuple = [number, number, string, string[]];

/** The `merge_json_file` signature this module is handed. */
export type MergeJsonFile = (
    p: string,
    new_data: Record<string, unknown>,
    force: boolean,
    label: string,
) => Record<string, unknown>[];

/**
 * The project-scope MCP server entry Claude Code reads from `.mcp.json`.
 *
 * Shape is fixed by `docs/getting-started-local-stdio.md` — the documented
 * end-user path — so a consumer who followed the docs and a consumer who ran the
 * installer end up with the same entry rather than two that drift.
 */
export const MCP_SERVER_KEY = 'agent-config';
export const MCP_PACKAGE_NAME = '@event4u/agent-config';

/**
 * The entry, pinned to the version the installer is running from.
 *
 * Unpinned, `npx -y @event4u/agent-config` resolves the `latest` dist-tag on
 * every server start, so the server a consumer runs is whatever the registry
 * served most recently — not the one their installer approved, and not the one
 * their lockfile records. The pin makes those the same artefact.
 *
 * A version that cannot be read is left unpinned rather than guessed: an
 * invented specifier would fail to resolve at server start, which is a worse
 * failure than the drift it was meant to close.
 *
 * A pinned spec also carries `--prefer-offline`: the cache can hold only that
 * exact version, so a warm cache answers the server start without a registry
 * request, and a cold one still resolves. An unpinned spec does not, because
 * a cached `latest` would be served stale.
 */
export function mcpBridgeEntry(packageRoot: string): Record<string, unknown> {
    const version = readPackageVersion(packageRoot);
    const args =
        version === null
            ? ['-y', MCP_PACKAGE_NAME, 'mcp-server']
            : ['--prefer-offline', '-y', `${MCP_PACKAGE_NAME}@${version}`, 'mcp-server'];
    return {
        mcpServers: {
            [MCP_SERVER_KEY]: {
                command: 'npx',
                args,
            },
        },
    };
}

/** The manifest `version`, or `null` when it is absent or unreadable. */
export function readPackageVersion(packageRoot: string): string | null {
    try {
        const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8');
        const v = (JSON.parse(raw) as { version?: unknown }).version;
        return typeof v === 'string' && v.trim() !== '' ? v : null;
    } catch {
        return null;
    }
}

/**
 * `.mcp.json` — the project-scope MCP config Claude Code reads.
 *
 * WHY THE INSTALLER OWNS THIS FILE AND `mcp_render` DOES NOT. `mcp_render`
 * projects the consumer's OWN root `mcp.json` onto per-tool configs by
 * overwriting them (`write_target`), which is correct for a file the renderer
 * generates in full and wrong for one the consumer also edits: a render would
 * delete both this entry and any server they added by hand. `merge_json_file`
 * writes only our key, records it as an RFC-6901 pointer in
 * `agents/installed-tools.lock`, and lets uninstall subtract exactly that key.
 * `mcp:check` validates the file without ever writing it.
 *
 * Default ON for `claude-code`, because `rules/missing-skill-recovery.md` makes
 * `suggest_skill_for_task` an Iron Law for every consumer and a rule that is
 * unfulfillable by default is a defect, not a feature. Opting out is the same
 * lever as every other bridge — deselect the tool (`--tools`), which is the gate
 * the caller applies; `.agent-tools.yml` is deliberately NOT that lever, it is a
 * maintainer-side projection-generator allowlist the installer cannot see and
 * whose tool ids differ from `_VALID_TOOLS`.
 */
export function makeEnsureMcpBridge(
    mergeJsonFile: MergeJsonFile,
): (projectRoot: string, force: boolean, packageRoot?: string) => Record<string, unknown>[] {
    return (projectRoot, force, packageRoot = projectRoot) =>
        mergeJsonFile(
            path.join(projectRoot, '.mcp.json'),
            mcpBridgeEntry(packageRoot),
            force,
            '.mcp.json',
        );
}

/**
 * Where each host reads a PROJECT-scope MCP config, and which capability-manifest
 * row gates writing to it (roadmap step 3.3).
 *
 * Keyed by the installer's `--tools` id; `hostId` is the SEPARATE
 * platform identifier the capability manifest is keyed by (`claude`, not
 * `claude-code`). Conflating the two namespaces is the mistake
 * `host_capability.ts` warns about in its own registry doc, so the mapping is
 * written out rather than derived.
 *
 * Presence in this table is NOT permission to write. It records where the file
 * would go IF the axis said the host reads one; the axis decides, and it says
 * `true` only once someone observed it.
 */
export const MCP_PROJECT_CONFIG: Readonly<Record<string, { hostId: string; relPath: string }>> = {
    'claude-code': { hostId: 'claude', relPath: '.mcp.json' },
    cursor: { hostId: 'cursor', relPath: '.cursor/mcp.json' },
    'gemini-cli': { hostId: 'gemini', relPath: '.gemini/settings.json' },
};

/** One host to register, resolved from the `--tools` set and the capability axis. */
export interface McpRegistrationTarget {
    toolId: string;
    hostId: string;
    relPath: string;
}

/** Injectable capability reader — the installer passes the real probe. */
export type ReadsProjectMcpConfig = (hostId: string) => boolean;

/**
 * The hosts an install may register the server on, beyond `claude-code`.
 *
 * TWO gates, both required. `--tools` is the consumer's selection; the
 * capability axis is the evidence. A host is registered only where BOTH say so,
 * so a config file this package already writes for hooks does not silently
 * acquire an MCP entry on the strength of the file existing.
 *
 * `claude-code` is excluded here on purpose: its `.mcp.json` registration
 * predates the axis and is written unconditionally by `makeEnsureMcpBridge`.
 * Routing it through the axis would DELETE a working registration, because the
 * axis reports `false` for every host today — "nobody answered", not "checked
 * and absent". This function adds reach; it never removes any.
 *
 * MEASURED STATE, 2026-09-07: the capability registry carries one row
 * (`claude`) and it does not set `reads_project_mcp_config`, so this returns an
 * EMPTY list for every `--tools` set. That is the honest reading of the axis,
 * not a defect in this function — and it is a recorded absence, never a finding
 * that these hosts do not read such a file.
 */
export function mcpRegistrationTargets(
    tools: ReadonlySet<string>,
    readsConfig: ReadsProjectMcpConfig,
): McpRegistrationTarget[] {
    const out: McpRegistrationTarget[] = [];
    for (const [toolId, spec] of Object.entries(MCP_PROJECT_CONFIG)) {
        if (toolId === 'claude-code') continue;
        if (!tools.has(toolId)) continue;
        if (!readsConfig(spec.hostId)) continue;
        out.push({ toolId, hostId: spec.hostId, relPath: spec.relPath });
    }
    return out;
}

/**
 * Merge the server entry into every target's config file.
 *
 * Returns the merged keys per tool id, in the shape the installer's
 * `merged_keys_by_tool` lockfile record expects. An empty map is the normal
 * result today and is not an error.
 */
export function makeEnsureMcpRegistrations(
    mergeJsonFile: MergeJsonFile,
): (
    projectRoot: string,
    force: boolean,
    packageRoot: string,
    targets: readonly McpRegistrationTarget[],
) => Record<string, Record<string, unknown>[]> {
    return (projectRoot, force, packageRoot, targets) => {
        const merged: Record<string, Record<string, unknown>[]> = {};
        for (const t of targets) {
            merged[t.toolId] = mergeJsonFile(
                path.join(projectRoot, ...t.relPath.split('/')),
                mcpBridgeEntry(packageRoot),
                force,
                t.relPath,
            );
        }
        return merged;
    };
}

/** The axis reader the installer uses. Injected in tests, never overridden there. */
function readsProjectMcpConfig(hostId: string): boolean {
    return probeHostCapabilities(hostId).reads_project_mcp_config;
}

/**
 * Write every MCP registration one install owes, and record the merged keys.
 *
 * ONE call site rather than three, because `install.ts` is 3,900 lines over the
 * source-size ratchet's ceiling and every line added there is a line the ratchet
 * charges for. The composition is the same either way; where it lives is the
 * only thing that differs, and it belongs beside the entry it writes.
 *
 * `claude-code` is registered whenever it is selected — that write predates the
 * axis and routing it through would DELETE it, the axis being `false` for every
 * host today. Every OTHER host needs both gates: the `--tools` selection and an
 * OBSERVED `reads_project_mcp_config`.
 */
export function registerMcpHosts(
    mergeJsonFile: MergeJsonFile,
    projectRoot: string,
    force: boolean,
    packageRoot: string,
    tools: ReadonlySet<string>,
    into: Record<string, Record<string, unknown>[]>,
    readsConfig: ReadsProjectMcpConfig = readsProjectMcpConfig,
): void {
    const ensure = makeEnsureMcpRegistrations(mergeJsonFile);
    const claude = MCP_PROJECT_CONFIG['claude-code'];
    if (tools.has('claude-code') && claude !== undefined) {
        const merged = ensure(projectRoot, force, packageRoot, [
            { toolId: 'claude-code', hostId: claude.hostId, relPath: claude.relPath },
        ]);
        (into['claude-code'] ??= []).push(...(merged['claude-code'] ?? []));
    }
    for (const [toolId, keys] of Object.entries(
        ensure(projectRoot, force, packageRoot, mcpRegistrationTargets(tools, readsConfig)),
    )) {
        (into[toolId] ??= []).push(...keys);
    }
}

/**
 * Rewrite a stale `.mcp.json` entry in place, touching only the key we own.
 *
 * Install writes the entry once; nothing re-read it afterwards, so a pin
 * written by one install stayed frozen at that version for the life of the
 * file — which is exactly the drift the pin was added to close, one release
 * later. This is the update path.
 *
 * Scope discipline: the ONLY key rewritten is `mcpServers[MCP_SERVER_KEY]`.
 * A server a consumer added by hand sits beside it and is not read, compared,
 * reordered or rewritten — the same contract `merge_json_file` honours on the
 * install path, and the reason uninstall can subtract exactly one key.
 *
 * Returns `'absent'` (no file, or no entry of ours to repair — install owns
 * that case, not this one), `'current'`, or `'rewritten'`.
 */
export function migrateMcpBridge(
    projectRoot: string,
    packageRoot: string,
): 'absent' | 'current' | 'rewritten' {
    const file = path.join(projectRoot, '.mcp.json');
    let doc: Record<string, unknown>;
    try {
        doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    } catch {
        return 'absent';
    }
    const servers = doc['mcpServers'];
    if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return 'absent';
    const table = servers as Record<string, unknown>;
    if (table[MCP_SERVER_KEY] === undefined) return 'absent';

    const wanted = (mcpBridgeEntry(packageRoot)['mcpServers'] as Record<string, unknown>)[
        MCP_SERVER_KEY
    ];
    if (JSON.stringify(table[MCP_SERVER_KEY]) === JSON.stringify(wanted)) return 'current';

    table[MCP_SERVER_KEY] = wanted;
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
    return 'rewritten';
}

/**
 * The two projection modes.
 *
 * `legacy-all` ships everything and stays the default. `scoped` narrows to the
 * active packs.
 *
 * `tiered` was a third, and it was RETIRED on 2026-10-20 (ADR-292, step 4.5)
 * with the install branch that acted on it. It narrowed the catalogue to the
 * skills predicted to reach the model WITH their description, and its own
 * roadmap closed it at `measured-null`: the split usually came from an
 * ALPHABETICAL fallback order (`agents/runtime/metrics/skill-usage.jsonl` is
 * absent on most machines), and the one real host observation this repo has
 * disagreed with that fallback on four of eight sampled entries. A value that
 * hides skills on a prediction the tree can show to be wrong is strictly worse
 * than the bare-but-listed defect it was meant to fix. The measured null stays
 * in `docs/CLAIMS.md`; a leftover `tiered` now resolves to `legacy-all`, which
 * is the full surface and the safe direction.
 */
export type ProjectionMode = 'scoped' | 'legacy-all';

/** Resolve a raw `projection.mode` value. Anything unrecognised is `legacy-all`. */
export function projectionModeOf(raw: unknown): ProjectionMode {
    return raw === 'scoped' ? 'scoped' : 'legacy-all';
}

/**
 * Tier B skill names, or `null` when no split exists on this machine.
 *
 * `null` is load-bearing: it means "nobody computed a split here", and a
 * `tiered` install that finds it must ship the FULL surface rather than prune on
 * an empty set — pruning on absence would delete the entire catalogue. A
 * malformed file is `null` for the same reason.
 */
export function resolveTierB(packageRoot: string): ReadonlySet<string> | null {
    const p = path.join(packageRoot, 'agents', 'runtime', 'state', 'skill-tiers.json');
    if (!fs.existsSync(p)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { tier_b?: unknown };
        if (!Array.isArray(parsed.tier_b)) return null;
        return new Set(parsed.tier_b.filter((n): n is string => typeof n === 'string'));
    } catch {
        return null;
    }
}


/**
 * The consumer-side alternative to tiering, surfaced as a recommendation only.
 *
 * Claude Code's listing budget is settable: `skillListingBudgetFraction` raises
 * the fraction of the context window spent on skill DESCRIPTIONS, restoring them
 * at a measured token price instead of withholding skills from the catalogue.
 * That is the other lever, and for many consumers the better one — a description
 * they can read beats a tool call they have to make.
 *
 * Returns `null` unless a tier split exists AND Tier B is non-empty: with no
 * split there is nothing to recommend against, and an empty Tier B means the
 * host already describes everything. This NEVER writes the consumer's
 * `settings.json` — the setting is theirs, the token cost is theirs, and an
 * installer that edited a host's own config to buy itself context would be
 * taking that decision in their name. The one owner-decided exception is
 * `skillOverrides` for package-owned skills (`skill_listing_overrides.ts`): it
 * buys no context, only decides which descriptions the existing budget carries.
 */
export function tierBAdvisory(packageRoot: string): string | null {
    const tierB = resolveTierB(packageRoot);
    if (tierB === null || tierB.size === 0) return null;
    return (
        `ℹ️  ${tierB.size} skill(s) are predicted to reach the model WITHOUT their ` +
        'description on a default 200k window.\n' +
        '   Two levers, neither applied for you:\n' +
        '   • raise `skillListingBudgetFraction` in your Claude Code settings — ' +
        'restores descriptions at a token cost (100% delivery of this catalogue ' +
        'measures ~13,003 tok)\n' +
        '   • or reach them through the MCP server, which serves every skill by ' +
        'name regardless of what the host catalogue carries (docs/mcp-server.md)'
    );
}

