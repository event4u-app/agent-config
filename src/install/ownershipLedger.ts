/**
 * The user-scoped ownership ledger.
 *
 * WHY IT EXISTS. A globally installed file's record of what this package wrote
 * lived only in a PROJECT manifest, and that manifest is written only when the
 * install runs from a directory carrying project settings. Run the install from
 * anywhere else and nothing was recorded; run it from a second project and that
 * project's manifest recorded nothing about the first. With no recorded digest
 * the writer could not tell a user's edit from our bytes and overwrote it, and
 * the reaper deleted an edited file the package retired without ever reading it.
 * Whether an edit survived depended on the working directory of a later install.
 *
 * WHERE IT LIVES. In the global deploy inventory every global deploy already
 * writes (`global_deploy_inventory.ts`, schema 2, additive `digests`), so the
 * record belongs to the user, not to whichever project an install ran from. The
 * AI council's reading of ADR-020 (2026-10-16) bounds it: ownership metadata only, no project key, no artefact selection.
 *
 * WHAT IT RECORDS per file: the digest of the bytes we INSTALLED and the digest
 * of the bytes we would install NOW — two, because one cannot distinguish "the
 * user changed it" from "we shipped a new version of it".
 *
 * - A file this run wrote or found identical: both are the on-disk digest.
 * - A file this run PRESERVED: both are the digest of the content STAGED beside
 *   it — the package content this installer last produced for the path, the
 *   meaning the project manifest gives the same field (`manifestFiles.ts`,
 *   `reconcileToolFiles`). That is what makes the documented resolution work:
 *   merge the sidecar and the file matches, so the next install is clean.
 *   Keeping the older digest would leave a correctly merged file looking
 *   edited forever. What it must never be is a re-hash of the target: that
 *   records the user's edit as ours, and the next run overwrites it.
 * - The staged sidecar: its own digest, `kind: "sidecar"` — the only proof that
 *   this installer wrote that file, so a later version may refresh it.
 * - A retired file the user edited: kept on disk, kept in the record with
 *   `packaged_sha256: null`, so the next run reads it as retired-modified again
 *   instead of as an untracked tagged orphan it would delete.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as global_deploy_inventory from '../scripts/_lib/global_deploy_inventory.js';
import type { LedgerDigest } from '../scripts/_lib/global_deploy_inventory.js';
import { sidecarPathFor } from './preserve.js';

/** Inputs for one tool's ledger update after its global deploy. */
export interface GlobalDeployRecord {
    readonly toolId: string;
    /** The anchor as configured (`~/.cursor/`) — stored verbatim. */
    readonly anchorRaw: string;
    /** The anchor expanded to an absolute path. */
    readonly anchor: string;
    /** Anchor-relative files the current package maintains here. */
    readonly currentFiles: ReadonlySet<string>;
    /** The plan's `dest_sub` list, for the tagged-orphan sweep. */
    readonly destSubs: readonly string[];
    readonly packageTag: string;
    /** Absolute targets this run preserved instead of writing. */
    readonly preserved: readonly string[];
    /** Absolute sidecar path → digest of the content staged there this run. */
    readonly staged: ReadonlyMap<string, string | null>;
    /** The digest recorded BEFORE this run for an absolute target. */
    readonly recordedFor: (target: string) => string | null | undefined;
    /** Inventory location override (tests); default `inventory_path()`. */
    readonly inventoryPath?: string | null;
}

/** What the update did on disk. */
export interface GlobalDeployOutcome {
    /** Absolute paths the reapers deleted. */
    readonly reaped: readonly string[];
    /** Absolute paths of retired files kept because the user edited them. */
    readonly retained: readonly string[];
}

/**
 * Anchor-relative POSIX path of `abs`, or `null` when it is not under `anchor`.
 *
 * Tried against the anchor as given AND its realpath: the reapers report paths
 * under the RESOLVED anchor, the copy loop under the lexical one, and on macOS
 * a temp or home tree differs between the two by a symlinked prefix.
 */
function relUnder(anchor: string, abs: string): string | null {
    let real = anchor;
    try {
        real = fs.realpathSync(anchor);
    } catch {
        /* the anchor does not exist yet — the lexical form is all there is */
    }
    for (const base of [anchor, real]) {
        const rel = path.relative(path.resolve(base), path.resolve(abs));
        if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
            return rel.split(path.sep).join('/');
        }
    }
    return null;
}

/**
 * Reap what the package no longer ships — sparing edited files — then record
 * the ledger for one tool and save it.
 *
 * Replaces the load → reap → record → save sequence the installer ran inline,
 * so the two reapers and the record are fed one consistent view: the sidecars
 * staged this run are part of what "should exist", or the reaper would delete
 * the package content it was just told to stage.
 */
export function recordGlobalDeploy(r: GlobalDeployRecord): GlobalDeployOutcome {
    const inventory = global_deploy_inventory.load_inventory(r.inventoryPath ?? null);
    const previous = global_deploy_inventory.recorded_digests(r.toolId, r.anchor, inventory);

    const sidecars = new Map<string, string>();
    for (const [abs, digest] of r.staged) {
        const rel = relUnder(r.anchor, abs);
        if (rel !== null && digest !== null) sidecars.set(rel, digest);
    }
    const keep = new Set<string>([...r.currentFiles, ...sidecars.keys()]);

    const retainedAbs: string[] = [];
    let reaped: string[] = [];
    const tools = (inventory['tools'] as Record<string, unknown> | undefined) ?? {};
    if (r.toolId in tools) {
        reaped = reaped.concat(
            global_deploy_inventory.reap_stale(r.toolId, r.anchor, keep, inventory, false, retainedAbs),
        );
    }
    reaped = reaped.concat(
        global_deploy_inventory.reap_tagged_orphans(
            r.anchor,
            [...r.destSubs],
            keep,
            r.packageTag,
            false,
            previous,
            retainedAbs,
        ),
    );

    const preservedRel = new Set<string>();
    for (const abs of r.preserved) {
        const rel = relUnder(r.anchor, abs);
        if (rel !== null) preservedRel.add(rel);
    }

    const digests = new Map<string, LedgerDigest>();
    for (const rel of r.currentFiles) {
        const abs = path.join(r.anchor, rel);
        if (preservedRel.has(rel)) {
            const staged = r.staged.get(sidecarPathFor(abs)) ?? null;
            const installed = staged ?? previous.get(rel)?.installed_sha256 ?? r.recordedFor(abs);
            if (typeof installed !== 'string' || installed === '') continue;
            digests.set(rel, { installed_sha256: installed, packaged_sha256: staged ?? installed });
            continue;
        }
        const onDisk = global_deploy_inventory.file_sha256(abs);
        if (onDisk === null) continue;
        digests.set(rel, { installed_sha256: onDisk, packaged_sha256: onDisk });
    }
    for (const [rel, digest] of sidecars) {
        digests.set(rel, { installed_sha256: digest, packaged_sha256: digest, kind: 'sidecar' });
    }
    const retained = [...new Set(retainedAbs)].sort();
    for (const abs of retained) {
        const rel = relUnder(r.anchor, abs);
        const prior = rel === null ? undefined : previous.get(rel);
        if (rel === null || prior === undefined) continue;
        digests.set(rel, { installed_sha256: prior.installed_sha256, packaged_sha256: null });
    }

    global_deploy_inventory.record_deploy(r.toolId, r.anchorRaw, new Set(r.currentFiles), inventory, digests);
    global_deploy_inventory.save_inventory(inventory, r.inventoryPath ?? null);
    return { reaped: [...new Set(reaped)].sort(), retained };
}

/** The per-file line for a retired file kept because the user edited it. */
export function retainedFileMessage(target: string): string {
    return (
        `Kept ${target}: the package no longer ships this file, but it was edited after it was ` +
        'installed, so it was not deleted. It is no longer updated by agent-config; delete it ' +
        'yourself when you no longer need it.'
    );
}
