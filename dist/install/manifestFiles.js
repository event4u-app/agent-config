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
/** Build one `files[]` record for `p`. */
export function fileEntry(p, kind, hashContent) {
    return { path: p, kind, sha256: hashContent ? sha256OfFile(p) : null };
}
/**
 * Turn deploy results into the per-tool inventory this run is authoritative for.
 *
 * `null` — not an empty list — for a tool whose deploy did not complete. The
 * distinction is the whole point: an empty list says "this tool owns no files
 * now", which replaces and therefore erases; `null` says "this run learned
 * nothing about this tool", which is what a failed deploy actually knows, and
 * the caller carries the previous inventory forward instead.
 */
export function filesByToolFromDeploy(deployResults) {
    const out = {};
    for (const toolId of Object.keys(deployResults)) {
        const [, , status, paths] = deployResults[toolId];
        if (status === 'deployed') {
            out[toolId] = paths.map((p) => fileEntry(p, 'deployed', true));
        }
        else if (status === 'marker') {
            out[toolId] = paths.map((p) => fileEntry(p, 'marker', true));
        }
        else {
            out[toolId] = null;
        }
    }
    return out;
}
/**
 * The bridge marker each selected tool claims, as a one-entry inventory.
 *
 * `bridgeMarker` is injected because the marker table lives with the installer's
 * tool registry; passing it keeps that registry in one place instead of giving
 * this module a second copy to drift from. Bridge entries are recorded WITHOUT
 * a digest — a bridge is a pointer the consumer owns and edits, so there is
 * nothing for this tree to claim ownership of, and `classifyOwnership` reads a
 * null digest as `unknown` and leaves the file alone.
 */
export function filesByToolFromBridges(tools, projectRoot, scope, bridgeMarker) {
    const out = {};
    for (const toolId of [...tools].sort()) {
        const marker = bridgeMarker(toolId, scope);
        if (!marker)
            continue;
        const markerPath = isAbsolute(marker) ? marker : join(projectRoot, marker);
        out[toolId] = [fileEntry(markerPath, 'bridge', false)];
    }
    return out;
}
/** Expand a leading `~`, matching `installed_tools.expanduser`. */
function expanduser(p) {
    if (p === '~')
        return homedir();
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return join(homedir(), p.slice(2));
    }
    return p;
}
/** Resolve a manifest-recorded path the way every other reader of this file does. */
function resolveRecorded(raw, projectRoot) {
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
export function readRecordedByTool(manifestPath, projectRoot) {
    const out = new Map();
    if (!existsSync(manifestPath))
        return out;
    let doc;
    try {
        doc = YAML.parse(readFileSync(manifestPath, 'utf8'));
    }
    catch {
        return out;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc))
        return out;
    const tools = doc['tools'];
    if (!Array.isArray(tools))
        return out;
    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool))
            continue;
        const rec = tool;
        const name = rec['name'];
        if (typeof name !== 'string' || name.length === 0)
            continue;
        const files = [];
        const rawFiles = rec['files'];
        if (Array.isArray(rawFiles)) {
            for (const entry of rawFiles) {
                if (entry === null || typeof entry !== 'object' || Array.isArray(entry))
                    continue;
                const raw = entry['path'];
                if (typeof raw !== 'string' || raw.length === 0)
                    continue;
                files.push({
                    entry: entry,
                    resolved: resolveRecorded(raw, projectRoot),
                });
            }
        }
        const rawMerged = rec['merged_keys'];
        const mergedKeys = Array.isArray(rawMerged) ? rawMerged : [];
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
export function hydrateRecordedInventories(entries, prior) {
    for (const entry of entries) {
        const name = entry['name'];
        if (typeof name !== 'string')
            continue;
        const recorded = prior.get(name);
        if (recorded === undefined)
            continue;
        if (Array.isArray(entry['files']) && entry['files'].length === 0) {
            entry['files'] = recorded.files.map((f) => f.entry);
        }
        if (Array.isArray(entry['merged_keys']) && entry['merged_keys'].length === 0) {
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
 * The carried entry keeps the path and kind it had, and takes the digest of
 * the content STAGED this run. Both halves are load-bearing.
 *
 * The digest means "the package content this installer last produced for this
 * path". A preserved run produced that content too — it staged it in the
 * sidecar instead of writing it — so recording it keeps the field's meaning
 * exact and makes the documented resolution work: merge the sidecar and the
 * file matches, so the conflict clears and the next install refreshes it
 * normally. Carrying the OLDER digest instead would leave a correctly merged
 * file looking modified forever, resolvable only with `--force`.
 *
 * What it must never be is a re-hash of the target. That records the USER's
 * content as ours, and the run after that classifies the edit
 * `recorded-unchanged` and overwrites it — the same data loss, one
 * indirection further away.
 */
export function reconcileToolFiles(fresh, prior, preserved) {
    if (fresh === null || fresh === undefined) {
        return prior === undefined ? null : prior.files.map((f) => f.entry);
    }
    if (prior === undefined || preserved.size === 0)
        return [...fresh];
    const seen = new Set();
    for (const entry of fresh) {
        const raw = entry['path'];
        if (typeof raw === 'string')
            seen.add(resolve(expanduser(raw)));
    }
    const out = [...fresh];
    for (const file of prior.files) {
        const staged = preserved.get(file.resolved);
        if (staged === undefined || seen.has(file.resolved))
            continue;
        out.push(staged.sha256 === null ? file.entry : { ...file.entry, sha256: staged.sha256 });
        if (staged.sidecar !== null)
            out.push(staged.sidecar);
    }
    return out;
}
/** Build the {@link PreservedIndex} from the tracker's per-run state. */
export function preservedIndex(preservedTargets, staged) {
    const out = new Map();
    for (const target of preservedTargets) {
        const sidecar = sidecarPathFor(target);
        const sha = staged.get(sidecar) ?? null;
        out.set(resolve(target), {
            sha256: sha,
            sidecar: sha === null ? null : { path: sidecar, kind: 'sidecar', sha256: sha },
        });
    }
    return out;
}
//# sourceMappingURL=manifestFiles.js.map