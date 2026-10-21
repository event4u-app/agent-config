/**
 * `doctor` reads the user-scoped ownership ledger.
 *
 * `cmd_doctor` classified only PROJECT-scope manifest entries and skipped every
 * global-scope tool, so a globally installed file the installer had just
 * preserved — exit 3, "the active installation is not current" — was invisible
 * to it, and the two surfaces reporting on one install disagreed by
 * construction. The ledger is the record of what every global deploy wrote,
 * wherever it ran from, so it is what doctor reads for global scope.
 *
 * A file is reported `modified` exactly when the installer would preserve it
 * ON THE EVIDENCE DOCTOR HAS: the shared classifier says `recorded-modified`
 * and the package still ships it. A retired file the user edited is kept by
 * the installer without failing the run, so doctor does not fail on it either
 * — reporting it here would make the two surfaces disagree in the other
 * direction.
 *
 * THE ONE CASE THIS CANNOT COVER, named rather than left to be discovered.
 * The installer also preserves a path the ledger LISTS but holds no digest
 * for — an install predating the ledger — when the bytes on disk differ from
 * what it would write. Doctor cannot reach that verdict, and the reason is
 * structural rather than an omission: the test is "does this differ from what
 * we WOULD write", and doctor is not installing, so it has no packaged digest
 * to compare against. `recorded_digests` returns only paths carrying a digest,
 * so such a path is not even enumerated here.
 *
 * It is left uncovered rather than guessed at. Reporting every digest-less
 * ledger path as `modified` would assert an edit nobody proved, which is the
 * claim the installer's own migration branch exists because it cannot make.
 * The divergence is asserted in `tests/install/ownership_parity.test.ts` so it
 * stays a known gap instead of becoming a surprise.
 *
 * Its own module because `cmd_doctor.ts` sits far above the 1,500-line source
 * ceiling `check_source_size_budget` ratchets.
 */
import * as os from 'node:os';
import * as path from 'node:path';

import { classifyFileState, ownershipOfState } from '../../install/recordedOwnership.js';
import * as global_deploy_inventory from '../_lib/global_deploy_inventory.js';

/** Re-exported so `cmd_doctor`'s manifest classifier is the installer's own. */
export { classifyOwnership } from '../../install/recordedOwnership.js';

type Dict = Record<string, unknown>;

/** Expand a leading `~` against `home`. */
function expandAt(p: string, home: string): string {
    if (p === '~') return home;
    if (p.startsWith('~/')) return path.join(home, p.slice(2));
    return p;
}

/**
 * `modified` records for every ledger-recorded global file the installer would
 * preserve. `inventoryPath` / `home` default to the running process's own.
 */
export function ledgerModifiedRecords(inventoryPath?: string | null, home?: string | null): Dict[] {
    const inventory = global_deploy_inventory.load_inventory(inventoryPath ?? null);
    const tools = (inventory['tools'] as Record<string, unknown> | undefined) ?? {};
    const out: Dict[] = [];
    for (const tool_id of Object.keys(tools).sort()) {
        const entry = tools[tool_id];
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
        const anchor = (entry as Dict)['anchor'];
        if (typeof anchor !== 'string') continue;
        const expanded = expandAt(anchor, home ?? os.homedir());
        const digests = global_deploy_inventory.recorded_digests(tool_id, expanded, inventory);
        for (const rel of [...digests.keys()].sort()) {
            const rec = digests.get(rel) as global_deploy_inventory.LedgerDigest;
            if (rec.kind === 'sidecar' || rec.packaged_sha256 === null) continue;
            const target = path.join(expanded, rel);
            const state = classifyFileState(
                rec.installed_sha256,
                rec.packaged_sha256,
                global_deploy_inventory.file_sha256(target),
            );
            if (ownershipOfState(state) !== 'recorded-modified') continue;
            out.push({
                tool: tool_id,
                path: target,
                kind: 'deployed',
                state,
                fix: 'merge the staged *.agent-config.new into it, or re-install with --force',
            });
        }
    }
    return out;
}

/** Tools the global deploy ledger records at least one file for. */
export function globalInstalledTools(inventoryPath?: string | null): string[] {
    const inventory = global_deploy_inventory.load_inventory(inventoryPath ?? null);
    const tools = (inventory['tools'] as Record<string, unknown> | undefined) ?? {};
    return Object.keys(tools)
        .filter((id) => {
            const e = tools[id];
            const files = typeof e === 'object' && e !== null ? (e as Dict)['files'] : null;
            return Array.isArray(files) && files.length > 0;
        })
        .sort();
}

/**
 * What `doctor` says about a project that has no project-scope install.
 *
 * It used to say one thing — "no project lockfile and no consumer install
 * marker", as a warning — whether or not the machine had a working GLOBAL
 * install. A global-only consumer is the shape ADR-020 makes the default, and
 * every fresh worktree of any project has no project-scope install by
 * construction, so the warning fired on exactly the healthy case. It now says
 * which scopes it checked and what it found in each.
 */
export function noProjectInstallLines(projectRoot: string, inventoryPath?: string | null): Array<['out' | 'err', string]> {
    const global = globalInstalledTools(inventoryPath);
    if (global.length > 0) {
        return [
            ['out', `  ℹ️   global install present (${global.join(', ')}); no project-scope install at ${projectRoot}`],
            ['out', '      expected for a global-only consumer — checked: global deploy ledger, project lockfile, project install marker'],
        ];
    }
    return [
        ['err', `  ⚠️   no agent-config install found — not globally (deploy ledger empty) and not at ${projectRoot}`],
        ['err', '      run `agent-config init` (global install) or `agent-config refresh --project` (global-only consumer)'],
    ];
}
