/**
 * Recorded-ownership classification — road-to-a-conformance-check-that-can-fail
 * Phase 5.
 *
 * The install conflict matrix decided ownership by **path-set membership**:
 * `policy.knownPaths.has(targetPath)`. That answers "did we ever write here",
 * which collapses two materially different trees into one row — a managed file
 * still carrying the bytes we wrote, and a managed file the user has since
 * edited. The second is a data-loss surface and the first is not, and the
 * matrix could not tell them apart because a path set carries no content.
 *
 * This module is the plumbing half: read the per-file SHA-256 the install
 * manifest already records, and compare it against a digest the caller
 * computed. It changes no install behaviour on its own — the matrix wiring
 * lands separately (Phase 5.2), so the behaviour change is reviewable as a
 * diff that contains no hash computation.
 *
 * Why a local YAML read rather than `installed_tools.read_manifest()`: that
 * reader is a hand-rolled parser with no YAML dependency, and it drops nested
 * `files[]` entries by design (a degraded read that ADR-200 documents as
 * intentional). It therefore cannot supply a recorded hash at all. Reading
 * the same file with the `yaml` package — already a runtime dependency — is
 * additive and leaves that reader's byte-exact golden tests untouched.
 *
 * `src/scripts/_lib/install_drift.ts` reads the same field of the same file
 * for the same reason, and this module is a second reader rather than a
 * caller of it because `collect_drift` computes the digests itself and
 * returns only the entries that drifted. The conflict matrix needs the
 * opposite: every recorded digest, and no hashing, because the digest it
 * compares against is one the caller already has. What this module does NOT
 * duplicate is that module's stated invariant — `manifest_path()` stays the
 * one place that decides where the manifest is, so the
 * `AGENT_CONFIG_INSTALLED_TOOLS` override and `~` expansion behave
 * identically in both.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import * as YAML from 'yaml';

import * as global_deploy_inventory from '../scripts/_lib/global_deploy_inventory.js';
import { manifest_path, type EnvMap } from '../scripts/_lib/installed_tools.js';

/**
 * How the install matrix owns a target on disk.
 *
 * - `recorded-unchanged` — the manifest records this path and the bytes on
 *   disk still match the digest it recorded. Ours, untouched.
 * - `recorded-modified`  — the manifest records this path and the bytes have
 *   changed since. Ours, edited by someone. Overwriting loses their work.
 * - `unknown`            — the manifest does not record this path, or records
 *   it without a digest (bridges carry `sha256: null`), or the bytes could not
 *   be read. Not an assertion that the file is foreign — an assertion that
 *   this tree cannot say.
 */
export type RecordedOwnership = 'recorded-unchanged' | 'recorded-modified' | 'unknown';

/** Absolute target path → the SHA-256 the manifest recorded (`null` for bridges). */
export type RecordedHashes = ReadonlyMap<string, string | null>;

/** The empty answer — "nothing is recorded", used whenever no manifest resolves. */
export const NO_RECORDED_HASHES: RecordedHashes = new Map<string, string | null>();

/**
 * The state of one managed file, read from TWO recorded digests and the bytes
 * on disk.
 *
 * One digest answers "did the bytes change since we wrote them". It cannot
 * answer "did WE change what we would write", and every later decision needs
 * both: an untouched file the package has since updated is `outdated`, not
 * `clean`, and an edited file the package has since updated is the case where
 * the user's work and a new version collide.
 *
 * - `clean`                    — on disk is what we wrote, and still what we ship.
 * - `outdated`                 — on disk is what we wrote; we now ship something else.
 * - `customized`               — edited since we wrote it; we still ship what we wrote.
 * - `customized-and-outdated`  — edited, AND we now ship something else.
 * - `retired-unmodified`       — we no longer ship it, and it is untouched.
 * - `retired-modified`         — we no longer ship it, and it was edited.
 * - `unknown`                  — no installed digest, or the bytes are unreadable.
 */
export type FileState =
    | 'clean'
    | 'outdated'
    | 'customized'
    | 'customized-and-outdated'
    | 'retired-unmodified'
    | 'retired-modified'
    | 'unknown';

/**
 * Classify one file from the digest we INSTALLED, the digest we would install
 * NOW, and the digest on disk.
 *
 * `packagedSha256`: a string is the current package content; `null` means the
 * package no longer ships the file (retired); `undefined` means the caller does
 * not know — the comparison then degrades to the installed digest alone, which
 * is exactly the old three-state answer and never yields an `-outdated` or
 * `retired-` state. Bytes on disk equal to what we would ship are `clean`
 * whatever was recorded: there is nothing to preserve and nothing to update.
 */
export function classifyFileState(
    installedSha256: string | null | undefined,
    packagedSha256: string | null | undefined,
    onDiskSha256: string | null,
): FileState {
    if (installedSha256 === undefined || installedSha256 === null) return 'unknown';
    if (onDiskSha256 === null) return 'unknown';
    const untouched = onDiskSha256 === installedSha256;
    if (packagedSha256 === null) return untouched ? 'retired-unmodified' : 'retired-modified';
    if (packagedSha256 !== undefined && onDiskSha256 === packagedSha256) return 'clean';
    const shipsWhatWeWrote = packagedSha256 === undefined || packagedSha256 === installedSha256;
    if (untouched) return shipsWhatWeWrote ? 'clean' : 'outdated';
    return shipsWhatWeWrote ? 'customized' : 'customized-and-outdated';
}

/** Collapse a {@link FileState} to the three-state ownership the write decision reads. */
export function ownershipOfState(state: FileState): RecordedOwnership {
    switch (state) {
        case 'clean':
        case 'outdated':
        case 'retired-unmodified':
            return 'recorded-unchanged';
        case 'customized':
        case 'customized-and-outdated':
        case 'retired-modified':
            return 'recorded-modified';
        case 'unknown':
            return 'unknown';
    }
}

/**
 * Classify one target from the recorded digest and the on-disk digest.
 *
 * Pure — the caller supplies both digests. `undefined` for `recordedSha256`
 * means the path is not recorded at all; `null` means recorded without a
 * digest. Both answer `unknown`, because neither supports a comparison.
 *
 * The three-state view of {@link classifyFileState} with the packaged digest
 * unknown — one classifier, so the two answers cannot drift apart.
 */
export function classifyOwnership(
    recordedSha256: string | null | undefined,
    onDiskSha256: string | null,
): RecordedOwnership {
    return ownershipOfState(classifyFileState(recordedSha256, undefined, onDiskSha256));
}

/**
 * Read `tools[].files[]` out of an installed-tools manifest into a
 * path → digest map.
 *
 * Relative paths resolve against `projectRoot` and a leading `~` expands
 * first — the manifest stores user-scope entries absolute or `~`-rooted and
 * project-scope entries relative, and both existing readers
 * (`install_drift.resolve_entry_path`, `cmd_doctor._resolve_path`) resolve
 * them that way. A missing, unreadable or malformed manifest yields the
 * empty map rather than throwing — an install plan must never fail because a
 * lockfile is corrupt.
 */
export function readRecordedHashes(manifestPath: string, projectRoot: string): RecordedHashes {
    if (!existsSync(manifestPath)) return NO_RECORDED_HASHES;
    let doc: unknown;
    try {
        doc = YAML.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
        return NO_RECORDED_HASHES;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return NO_RECORDED_HASHES;
    const tools = (doc as Record<string, unknown>)['tools'];
    if (!Array.isArray(tools)) return NO_RECORDED_HASHES;

    const out = new Map<string, string | null>();
    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) continue;
        const files = (tool as Record<string, unknown>)['files'];
        if (!Array.isArray(files)) continue;
        for (const entry of files) {
            if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const rec = entry as Record<string, unknown>;
            const raw = rec['path'];
            if (typeof raw !== 'string' || raw.length === 0) continue;
            const sha = rec['sha256'];
            const expanded = expanduser(raw);
            const target = isAbsolute(expanded)
                ? resolve(expanded)
                : resolve(projectRoot, expanded);
            out.set(target, typeof sha === 'string' && sha.length > 0 ? sha : null);
        }
    }
    return out;
}

/** Expand a leading `~`, matching `installed_tools.expanduser`. */
function expanduser(p: string): string {
    if (p === '~') return homedir();
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return join(homedir(), p.slice(2));
    }
    return p;
}

/**
 * {@link readRecordedHashes} for a PROJECT root, via `installed_tools`.
 *
 * `manifest_path` carries the `AGENT_CONFIG_INSTALLED_TOOLS` override, so an
 * install running against a relocated manifest classifies ownership instead
 * of degrading every file to `unknown`.
 *
 * The argument must be a project root. An {@link InstallPlan.root} for a
 * `global` target is the install anchor (`~/.event4u/agent-config/`), which
 * holds no manifest — such a plan gets the empty map and therefore the
 * pre-hash answer, which is correct but is a floor rather than a feature.
 */
export function recordedHashesForRoot(root: string, env?: EnvMap | null): RecordedHashes {
    return readRecordedHashes(manifest_path(root, env), root);
}

/**
 * {@link recordedHashesForRoot} with the USER-scoped ownership ledger laid over
 * it.
 *
 * The project manifest is written only from a project that carries settings,
 * so on its own it decided a globally installed file's fate by the working
 * directory of the install. The ledger (the `digests` of the global deploy
 * inventory) is written on every global deploy, wherever it ran from, and it
 * WINS where both record a path: it is rewritten by every global install, while
 * a project's manifest is rewritten only by installs run from that project and
 * so goes stale the moment a second project installs. A path the ledger does
 * not record keeps the manifest's answer, so a project-scope target reads
 * exactly as before.
 *
 * The one table the preview (`computeConflicts`) and the writer
 * (`conflictTracker`) both read, so the two cannot answer differently.
 */
export function recordedHashesWithLedger(root: string, env?: EnvMap | null): RecordedHashes {
    const out = new Map<string, string | null>(recordedHashesForRoot(root, env));
    const ledger = global_deploy_inventory.load_inventory(global_deploy_inventory.inventory_path(env));
    for (const [target, sha] of global_deploy_inventory.recorded_absolute_digests(ledger, env?.['HOME'])) {
        out.set(target, sha);
    }
    return out;
}
