/**
 * `agent-config commands` — native CLI discovery surface (6.0.0-C Phase 2 Step 5b).
 *
 *   agent-config commands [ls] [--pack <id>] [--visible] [--json]
 *       List the command surface from the discovery manifest. `--visible`
 *       restricts to tier 0/1; `--pack` restricts to one owning pack.
 *
 *   agent-config commands explain <name> [--json]
 *       Print one command's intent, routes_to, owning pack, and tier.
 *
 * Reads `dist/discovery/discovery-manifest.json` — the single source of
 * truth, NOT a parallel catalog. Exits 0 on success, 1 on a missing/malformed
 * manifest or an unknown command name.
 */

import { loadManifest, ManifestNotFoundError, ManifestParseError } from '../discovery/loadManifest.js';
import type { DiscoveryArtefact, DiscoveryManifest } from '../discovery/loadManifest.js';
import { logger } from '../log/logger.js';
import { loadProfile, resolveProfileView } from './profiles.js';

export interface CommandsLsOptions {
    pack?: string;
    visible?: boolean;
    json?: boolean;
    profile?: string;
    expanded?: boolean;
}

export interface CommandsExplainOptions {
    json?: boolean;
}

function loadOrReport(): DiscoveryManifest | null {
    try {
        return loadManifest();
    } catch (err) {
        if (err instanceof ManifestNotFoundError) {
            logger.error(
                `discovery manifest not found at ${err.path} — run ` +
                    "'./scripts-run src/scripts/build_discovery_manifest --write' " +
                    'or install a published release.',
            );
            return null;
        }
        if (err instanceof ManifestParseError) {
            logger.error(err.message);
            return null;
        }
        logger.error(err instanceof Error ? err.message : String(err));
        return null;
    }
}

function commandArtefacts(manifest: DiscoveryManifest): DiscoveryArtefact[] {
    return manifest.artefacts.filter((a) => a.category === 'command' && a.name);
}

function tierOf(a: DiscoveryArtefact): number {
    return typeof a.tier === 'number' ? a.tier : 2;
}

function visibilityLabel(tier: number): string {
    return tier === 0 ? 'visible' : tier === 1 ? 'advanced' : 'internal';
}

// ADR-092: prefer the named `visibility` field; fall back to the integer
// `tier` alias when the manifest entry predates the backfill.
function visibilityOf(a: DiscoveryArtefact): string {
    return a.visibility ?? visibilityLabel(tierOf(a));
}

function renderTable(cmds: readonly DiscoveryArtefact[]): string {
    const header = ['command', 'pack', 'tier', 'visibility', 'intent'];
    const rows: string[][] = cmds.map((c) => [
        // Canonical invocation slug (ADR-044) when present, else the name.
        c.slug ?? c.name ?? '',
        c.pack ?? (c.packs[0] ?? '—'),
        String(tierOf(c)),
        visibilityOf(c),
        c.intent ?? '—',
    ]);
    const widths = header.map((h, i) =>
        Math.max(h.length, rows.reduce((acc, r) => Math.max(acc, (r[i] ?? '').length), 0)),
    );
    const fmt = (cells: string[]): string =>
        cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
    const lines = [fmt(header), fmt(widths.map((w) => '-'.repeat(w)))];
    for (const row of rows) lines.push(fmt(row));
    return lines.join('\n');
}

export function runCommandsLs(opts: CommandsLsOptions = {}): number {
    const manifest = loadOrReport();
    if (manifest === null) return 1;

    let cmds = commandArtefacts(manifest);

    // --profile <id>: render the profile's curated command view (Step 14/15).
    // Default = the focused `view`; --expanded adds the active packs' full set.
    // The view ordering is meaningful, so a profile branch does NOT name-sort.
    if (opts.profile) {
        const profile = loadProfile(opts.profile);
        if (profile === null) {
            logger.error(
                `unknown profile '${opts.profile}'. Built-in profiles: developer, ` +
                    'founder, content_creator, agency, finance, ops.',
            );
            return 1;
        }
        cmds = resolveProfileView(profile, cmds, { expanded: Boolean(opts.expanded) });
        if (opts.visible) cmds = cmds.filter((c) => visibilityOf(c) !== 'internal');
        if (opts.json) {
            process.stdout.write(`${JSON.stringify({ profile: profile.id, expanded: Boolean(opts.expanded), commands: cmds }, null, 2)}\n`);
            return 0;
        }
        if (cmds.length === 0) {
            logger.info(`Profile '${profile.id}' surfaces no commands in the current manifest.`);
            return 0;
        }
        logger.info(renderTable(cmds));
        return 0;
    }

    if (opts.visible) cmds = cmds.filter((c) => visibilityOf(c) !== 'internal');
    // Filter on the canonical OWNER pack (`pack`), the budget/surfacing unit —
    // not the additive `packs` discovery tags.
    if (opts.pack) cmds = cmds.filter((c) => (c.pack ?? '') === opts.pack);
    cmds.sort((a, b) => (a.slug ?? a.name ?? '').localeCompare(b.slug ?? b.name ?? ''));

    if (opts.json) {
        process.stdout.write(`${JSON.stringify({ commands: cmds }, null, 2)}\n`);
        return 0;
    }
    if (cmds.length === 0) {
        logger.info('No commands match the given filters.');
        return 0;
    }
    logger.info(renderTable(cmds));
    return 0;
}

export function runCommandsExplain(name: string, opts: CommandsExplainOptions = {}): number {
    const manifest = loadOrReport();
    if (manifest === null) return 1;

    const cmds = commandArtefacts(manifest);
    const match = cmds.find((c) => c.name === name);
    if (!match) {
        logger.error(
            `unknown command '${name}'. Run 'agent-config commands ls' to list the surface.`,
        );
        return 1;
    }

    if (opts.json) {
        process.stdout.write(`${JSON.stringify(match, null, 2)}\n`);
        return 0;
    }

    const tier = tierOf(match);
    const lines = [
        `/${match.name}`,
        `  pack:        ${match.pack ?? (match.packs[0] ?? '—')}`,
        `  visibility:  ${visibilityOf(match)}`,
        `  tier:        ${tier} (alias)`,
        `  intent:      ${match.intent ?? '—'}`,
        `  routes_to:   ${(match.routes_to ?? []).join(', ') || '—'}`,
    ];
    if ((match.replaces ?? []).length > 0) {
        lines.push(`  replaces:    ${(match.replaces ?? []).join(', ')}`);
    }
    lines.push(`  path:        ${match.path}`);
    logger.info(lines.join('\n'));
    return 0;
}

/**
 * Heuristic: does `arg` look like a command target for `explain` (a bare
 * command name or a `cluster:sub` form), as opposed to the decision-trace
 * `explain config|rule|route` keywords handled by the legacy dispatcher?
 */
export function looksLikeCommandTarget(arg: string | undefined): boolean {
    if (!arg) return false;
    if (['config', 'rule', 'route'].includes(arg)) return false;
    return /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/.test(arg);
}
