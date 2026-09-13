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
import { manifest_path } from '../scripts/_lib/installed_tools.js';
/** The empty answer — "nothing is recorded", used whenever no manifest resolves. */
export const NO_RECORDED_HASHES = new Map();
/**
 * Classify one target from the recorded digest and the on-disk digest.
 *
 * Pure — the caller supplies both digests. `undefined` for `recordedSha256`
 * means the path is not recorded at all; `null` means recorded without a
 * digest. Both answer `unknown`, because neither supports a comparison.
 */
export function classifyOwnership(recordedSha256, onDiskSha256) {
    if (recordedSha256 === undefined || recordedSha256 === null)
        return 'unknown';
    if (onDiskSha256 === null)
        return 'unknown';
    return recordedSha256 === onDiskSha256 ? 'recorded-unchanged' : 'recorded-modified';
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
export function readRecordedHashes(manifestPath, projectRoot) {
    if (!existsSync(manifestPath))
        return NO_RECORDED_HASHES;
    let doc;
    try {
        doc = YAML.parse(readFileSync(manifestPath, 'utf8'));
    }
    catch {
        return NO_RECORDED_HASHES;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc))
        return NO_RECORDED_HASHES;
    const tools = doc['tools'];
    if (!Array.isArray(tools))
        return NO_RECORDED_HASHES;
    const out = new Map();
    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool))
            continue;
        const files = tool['files'];
        if (!Array.isArray(files))
            continue;
        for (const entry of files) {
            if (entry === null || typeof entry !== 'object' || Array.isArray(entry))
                continue;
            const rec = entry;
            const raw = rec['path'];
            if (typeof raw !== 'string' || raw.length === 0)
                continue;
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
function expanduser(p) {
    if (p === '~')
        return homedir();
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
export function recordedHashesForRoot(root, env) {
    return readRecordedHashes(manifest_path(root, env), root);
}
//# sourceMappingURL=recordedOwnership.js.map