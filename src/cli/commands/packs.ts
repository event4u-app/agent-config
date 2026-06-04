/**
 * `agent-config packs ls` — native TS implementation.
 *
 * Reads `dist/discovery/discovery-manifest.json` and prints a stable
 * table to stdout (`id`, `label`, `workspaces`, `artefact_count`) or,
 * with `--json`, dumps the relevant manifest slice verbatim.
 *
 * Exits 0 on success, 1 when the manifest is missing or malformed.
 */

import { loadManifest, ManifestNotFoundError, ManifestParseError } from '../discovery/loadManifest.js';
import type { DiscoveryPack } from '../discovery/loadManifest.js';
import { logger } from '../log/logger.js';

export interface PacksLsOptions {
    json?: boolean;
}

function renderTable(packs: readonly DiscoveryPack[]): string {
    const header = ['id', 'label', 'workspaces', 'artefact_count'];
    const rows: string[][] = packs.map((p) => [
        p.id,
        p.label,
        p.workspaces.join(','),
        String(p.artefact_count),
    ]);
    const widths = header.map((h, i) => {
        const colMax = rows.reduce((acc, r) => Math.max(acc, (r[i] ?? '').length), 0);
        return Math.max(h.length, colMax);
    });
    const fmt = (cells: string[]): string =>
        cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
    const lines: string[] = [];
    lines.push(fmt(header));
    lines.push(fmt(widths.map((w) => '-'.repeat(w))));
    for (const row of rows) lines.push(fmt(row));
    return lines.join('\n');
}

export function runPacksLs(opts: PacksLsOptions = {}): number {
    let manifest;
    try {
        manifest = loadManifest();
    } catch (err) {
        if (err instanceof ManifestNotFoundError) {
            logger.error(
                `discovery manifest not found at ${err.path} — run ` +
                    "'python3 src/scripts/build_discovery_manifest.py --write' " +
                    'or install a published release.',
            );
            return 1;
        }
        if (err instanceof ManifestParseError) {
            logger.error(err.message);
            return 1;
        }
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message);
        return 1;
    }

    if (opts.json) {
        process.stdout.write(`${JSON.stringify({ packs: manifest.packs }, null, 2)}\n`);
        return 0;
    }

    logger.info(renderTable(manifest.packs));
    return 0;
}
