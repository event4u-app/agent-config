/**
 * The installed-tools manifest's per-tool `files[]` inventory — building it,
 * reading back what a previous install recorded, and reconciling the two.
 *
 * THE GAP THIS CLOSES.
 *
 * `files[].sha256` is the only record of what this installer wrote where. The
 * conflict tracker added in Phase 5.1 reads exactly that field to tell a
 * managed file still carrying our bytes from one the user has edited
 * (`recordedOwnership.classifyOwnership`). A path with no recorded digest
 * classifies `unknown`, and `unknown` writes.
 *
 * So a run that DROPS a recorded digest does not merely lose bookkeeping — it
 * re-arms the overwrite that preservation exists to prevent, one run later.
 * Three drops were live, and all three end in the same silent data loss:
 *
 * 1. **A preserved file was never recorded.** The writer pushes a path into
 *    `written_paths` only when it actually copies; the preserve branch returns
 *    early. The manifest is rebuilt from `written_paths`, so the very run that
 *    protected an edit erased the digest proving it was an edit. The next run
 *    saw `unknown` and overwrote — preservation survived exactly one install.
 * 2. **A failed deploy wiped its tool's whole inventory.** `deploy_failed`
 *    produced an empty list, and an empty list is authoritative replacement,
 *    not "nothing to say".
 * 3. **Every tool outside the current selection lost its inventory too.**
 *    `installed_tools.read_manifest` is a hand-rolled parser that drops nested
 *    `files[]` by design (ADR-200), so the entries carried into the rewrite
 *    came back empty and were written back empty. `upsert_tool`'s "keep what
 *    was there" fallback could never fire, because nothing was ever there by
 *    the time it looked.
 *
 * (3) is why this module hydrates rather than patching the preserve branch:
 * the same digest loss reaches the same file through three doors, and repairing
 * one leaves the other two open.
 *
 * WHY A FOURTH READER OF THIS FILE.
 *
 * `installed_tools.read_manifest` (degraded by design), `install_drift`
 * (digests it re-hashes itself) and `recordedOwnership.readRecordedHashes` (a
 * flat path→digest map, no tool attribution, no `kind`) already read it. None
 * answers the question here — *which tool recorded which entries, verbatim,
 * so they can be written back unchanged* — and widening either of the latter
 * two would change a shape their own tests pin. What this module does not
 * duplicate is `manifest_path()`: that stays the single place deciding where
 * the manifest is, so the `AGENT_CONFIG_INSTALLED_TOOLS` override behaves
 * identically in all four.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import * as YAML from 'yaml';

import { sha256OfFile } from './fsPrimitives.js';
import { sidecarPathFor } from './preserve.js';

/** One `tools[].files[]` record, in the shape the manifest writer emits. */
export type ManifestFileEntry = Record<string, unknown>;

/** A recorded entry plus the absolute path it resolves to on this machine. */
export interface RecordedFile {
    /** The entry exactly as recorded — written back byte-identical. */
    readonly entry: ManifestFileEntry;
    /** `entry.path` with `~` expanded and resolved against the project root. */
    readonly resolved: string;
}

/** What a previous install recorded for one tool. */
export interface RecordedToolInventory {
    readonly files: readonly RecordedFile[];
    readonly mergedKeys: readonly ManifestFileEntry[];
}

/** Tool id → what the manifest records for it. */
export type RecordedByTool = ReadonlyMap<string, RecordedToolInventory>;

/** Build one `files[]` record for `p`. */
export function fileEntry(p: string, kind: string, hashContent: boolean): ManifestFileEntry {
    return { path: p, kind, sha256: hashContent ? sha256OfFile(p) : null };
}

/** A deploy tuple: `[written, skipped, status, paths]`. */
export type DeployTuple = readonly [number, number, string, string[]];

/**
 * Turn deploy results into the per-tool inventory this run is authoritative for.
 *
 * `null` — not an empty list — for a tool whose deploy did not complete. The
 * distinction is the whole point: an empty list says "this tool owns no files
 * now", which replaces and therefore erases; `null` says "this run learned
 * nothing about this tool", which is what a failed deploy actually knows, and
 * the caller carries the previous inventory forward instead.
 */
export function filesByToolFromDeploy(
    deployResults: Record<string, DeployTuple>,
): Record<string, ManifestFileEntry[] | null> {
    const out: Record<string, ManifestFileEntry[] | null> = {};
    for (const toolId of Object.keys(deployResults)) {
        const [, , status, paths] = deployResults[toolId] as DeployTuple;
        if (status === 'deployed') {
            out[toolId] = paths.map((p) => fileEntry(p, 'deployed', true));
        } else if (status === 'marker') {
            out[toolId] = paths.map((p) => fileEntry(p, 'marker', true));
        } else {
            out[toolId] = null;
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

/** Resolve a manifest-recorded path the way every other reader of this file does. */
function resolveRecorded(raw: string, projectRoot: string): string {
    const expanded = expanduser(raw);
    return isAbsolute(expanded) ? resolve(expanded) : resolve(projectRoot, expanded);
}

/**
 * Read `tools[].files[]` and `tools[].merged_keys[]` per tool.
 *
 * A missing, unreadable or malformed manifest yields an empty map rather than
 * throwing — an install must never fail because a lockfile is corrupt, and an
 * empty answer degrades to exactly the behaviour this module replaced.
 */
export function readRecordedByTool(manifestPath: string, projectRoot: string): RecordedByTool {
    const out = new Map<string, RecordedToolInventory>();
    if (!existsSync(manifestPath)) return out;
    let doc: unknown;
    try {
        doc = YAML.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
        return out;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return out;
    const tools = (doc as Record<string, unknown>)['tools'];
    if (!Array.isArray(tools)) return out;

    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) continue;
        const rec = tool as Record<string, unknown>;
        const name = rec['name'];
        if (typeof name !== 'string' || name.length === 0) continue;
        const files: RecordedFile[] = [];
        const rawFiles = rec['files'];
        if (Array.isArray(rawFiles)) {
            for (const entry of rawFiles) {
                if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
                const raw = (entry as Record<string, unknown>)['path'];
                if (typeof raw !== 'string' || raw.length === 0) continue;
                files.push({
                    entry: entry as ManifestFileEntry,
                    resolved: resolveRecorded(raw, projectRoot),
                });
            }
        }
        const rawMerged = rec['merged_keys'];
        const mergedKeys = Array.isArray(rawMerged) ? (rawMerged as ManifestFileEntry[]) : [];
        out.set(name, { files, mergedKeys });
    }
    return out;
}

/**
 * Put the nested inventories back onto entries read by the degraded parser.
 *
 * `installed_tools.read_manifest` returns every tool with `files: []` and
 * `merged_keys: []` whatever the file held, and those entries are what the
 * rewrite carries forward for tools the current run does not touch. Without
 * this, installing tool A erases tool B's recorded digests — and B's managed
 * files then classify `unknown` and get overwritten the next time B installs.
 *
 * Mutates in place and returns the same array: the caller's `entries` list is
 * already its own copy, and rebuilding it would drop unknown-but-recorded
 * keys that this module has no business deciding about.
 */
export function hydrateRecordedInventories(
    entries: ManifestFileEntry[],
    prior: RecordedByTool,
): ManifestFileEntry[] {
    for (const entry of entries) {
        const name = entry['name'];
        if (typeof name !== 'string') continue;
        const recorded = prior.get(name);
        if (recorded === undefined) continue;
        if (Array.isArray(entry['files']) && (entry['files'] as unknown[]).length === 0) {
            entry['files'] = recorded.files.map((f) => f.entry);
        }
        if (Array.isArray(entry['merged_keys']) && (entry['merged_keys'] as unknown[]).length === 0) {
            entry['merged_keys'] = [...recorded.mergedKeys];
        }
    }
    return entries;
}

/**
 * The inventory to record for one tool this run.
 *
 * - `fresh === null | undefined` → the previous inventory, unchanged. A run
 *   that learned nothing about a tool records what was already known.
 * - otherwise → what this run wrote, plus a carried-forward entry for every
 *   PRESERVED path this tool recorded before.
 *
 * The carried entry keeps its previously recorded digest verbatim, and that is
 * the load-bearing choice. The digest means "the package content this
 * installer last produced for this path"; a preserved run produced that content
 * too — it staged it in the sidecar instead of writing it — so the meaning is
 * unchanged and the next run still measures the user's bytes against package
 * bytes. Re-hashing the target instead would record the USER's content as
 * ours, and the run after that would classify the edit `recorded-unchanged`
 * and overwrite it: the same data loss, one indirection further away.
 */
export function reconcileToolFiles(
    fresh: readonly ManifestFileEntry[] | null | undefined,
    prior: RecordedToolInventory | undefined,
    preserved: PreservedIndex,
): ManifestFileEntry[] | null {
    if (fresh === null || fresh === undefined) {
        return prior === undefined ? null : prior.files.map((f) => f.entry);
    }
    if (prior === undefined || preserved.size === 0) return [...fresh];
    const seen = new Set<string>();
    for (const entry of fresh) {
        const raw = entry['path'];
        if (typeof raw === 'string') seen.add(resolve(expanduser(raw)));
    }
    const out = [...fresh];
    for (const file of prior.files) {
        if (!preserved.has(file.resolved) || seen.has(file.resolved)) continue;
        out.push(file.entry);
        const sidecar = preserved.get(file.resolved);
        if (sidecar !== undefined && sidecar !== null) out.push(sidecar);
    }
    return out;
}

/**
 * Resolved target path → the manifest entry for the sidecar staged beside it.
 *
 * The attribution problem this solves: a preserved path is not in any tool's
 * written list, so nothing in the deploy results says which tool owns it. The
 * PREVIOUS manifest does — it recorded that path under a tool — so
 * {@link reconcileToolFiles} matches on the prior inventory and the sidecar
 * rides along with its target rather than being filed by guesswork.
 */
export type PreservedIndex = ReadonlyMap<string, ManifestFileEntry | null>;

/** Build the {@link PreservedIndex} from the tracker's per-run state. */
export function preservedIndex(
    preservedTargets: readonly string[],
    staged: ReadonlyMap<string, string | null>,
): PreservedIndex {
    const out = new Map<string, ManifestFileEntry | null>();
    for (const target of preservedTargets) {
        const sidecar = sidecarPathFor(target);
        const sha = staged.get(sidecar);
        out.set(
            resolve(target),
            sha === undefined ? null : { path: sidecar, kind: 'sidecar', sha256: sha },
        );
    }
    return out;
}
