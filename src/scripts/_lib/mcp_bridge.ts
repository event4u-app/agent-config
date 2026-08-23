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
export const MCP_BRIDGE_ENTRY = {
    mcpServers: {
        [MCP_SERVER_KEY]: {
            command: 'npx',
            args: ['-y', '@event4u/agent-config', 'mcp-server'],
        },
    },
};

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
): (projectRoot: string, force: boolean) => Record<string, unknown>[] {
    return (projectRoot, force) =>
        mergeJsonFile(path.join(projectRoot, '.mcp.json'), MCP_BRIDGE_ENTRY, force, '.mcp.json');
}

/**
 * The three projection modes.
 *
 * `legacy-all` ships everything and stays the default. `scoped` narrows to the
 * active packs. `tiered` narrows to the skills predicted to reach the model WITH
 * their description, on the theory that a skill the host lists bare is better
 * served by the MCP recovery tool than by a catalogue entry nobody can read.
 *
 * `tiered` is OPT-IN and stays opt-in until the roadmap's Phase 4.4 decides on
 * evidence — which it did, at `measured-null`. The reason is stated rather than
 * implied: the split usually comes from an ALPHABETICAL fallback order
 * (`agents/runtime/metrics/skill-usage.jsonl` is absent on most machines), and
 * the one real host observation this repo has disagrees with that fallback on
 * four of eight sampled entries. Defaulting to `tiered` would hide skills on a
 * prediction the tree itself can show to be wrong — strictly worse than the
 * bare-but-listed defect it fixes (roadmap risk 4).
 */
export type ProjectionMode = 'scoped' | 'legacy-all' | 'tiered';

/** Resolve a raw `projection.mode` value. Anything unrecognised is `legacy-all`. */
export function projectionModeOf(raw: unknown): ProjectionMode {
    return raw === 'scoped' ? 'scoped' : raw === 'tiered' ? 'tiered' : 'legacy-all';
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

/** Predicate for `_prune_modules_by`: is this SKILL.md a Tier B skill? */
export function tierBPrunePredicate(
    tierB: ReadonlySet<string>,
): (mdPath: string) => boolean {
    return (mdPath) => tierB.has(path.basename(path.dirname(mdPath)));
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
 * taking that decision in their name.
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
        '   • or set `projection.mode: tiered` to withhold them from the catalogue ' +
        'and reach them via the MCP server instead (opt-in, still unproven — see ' +
        'docs/mcp-server.md)'
    );
}

export interface TieredPruneOutcome {
    deployResults: Record<string, DeployTuple>;
    /** One line for the caller to print, or `null` when QUIET. */
    message: string | null;
    /** `warn` when no split exists, `info` when a prune happened. */
    level: 'warn' | 'info';
}

/**
 * Apply the Tier-B prune to a completed deploy.
 *
 * Takes `pruneBy` rather than importing it, so the prune mechanics stay in one
 * place and this module does not become a second implementation of them.
 */
export function applyTieredPrune(
    deployResults: Record<string, DeployTuple>,
    packageRoot: string,
    pruneBy: (
        dr: Record<string, DeployTuple>,
        isPruned: (mdPath: string) => boolean,
    ) => [number, Record<string, DeployTuple>],
): TieredPruneOutcome {
    const tierB = resolveTierB(packageRoot);
    if (tierB === null || tierB.size === 0) {
        return {
            deployResults,
            level: 'warn',
            message:
                'projection.mode: tiered but no skill-tier split exists ' +
                '(agents/runtime/state/skill-tiers.json) — shipping the full surface. ' +
                'Compute one with `./scripts-run src/scripts/compute_skill_tiers` first.',
        };
    }
    const [pruned, adjusted] = pruneBy(deployResults, tierBPrunePredicate(tierB));
    return {
        deployResults: adjusted,
        level: 'info',
        message:
            `🧹 Tiered install: pruned ${pruned} Tier-B skill artefact(s) — still ` +
            "reachable via the MCP server's suggest_skill_for_task / read_skill. " +
            'Set projection.mode: legacy-all to restore the full surface.',
    };
}
