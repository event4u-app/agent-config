/**
 * Per-run conflict tracking for `agent-config init` — the stateful half of the
 * owner ruling of 2026-09-21 (road-to-a-conformance-check-that-can-fail
 * Phase 5.1). The decision itself is pure and lives in `./preserve.ts`; this
 * module holds the per-run state that decision needs, stages the sidecar, and
 * folds the result into the run's exit code.
 *
 * It sits beside the decision rather than inside `src/scripts/install.ts`
 * because that file is the largest source this package ships and
 * `check_source_size_budget` ratchets exactly that number. A feature's state
 * machine is paid for here, where it is also the coherent unit: everything in
 * this file is about one question — may the writer replace this managed file,
 * and what does it owe the operator when it may not.
 *
 * The installer's reporting surface (`warn`, `fail`, the transaction log, the
 * NDJSON progress stream) is injected rather than imported: importing it would
 * be a cycle, and re-implementing it would give one install run two voices.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp, pathExists, resolvePath, sha256OfFile } from './fsPrimitives.js';
import { EXIT_COMPLETED_WITH_CONFLICTS, conflictSummaryMessage, decideDeployWrite, foreignSidecarMessage, preservedFileMessage, sidecarPathFor, } from './preserve.js';
import { recordedHashesForRoot } from './recordedOwnership.js';
/**
 * Build a tracker bound to one installer's reporting surface.
 *
 * A factory rather than module-level state: the state is per-run, and a module
 * singleton would make two installs in one process — which the test suite does
 * — share a `preserved` list.
 */
export function createConflictTracker(host) {
    const conflictState = { root: null, recorded: null, preserved: [] };
    /**
     * Recorded digest for `target`, or `undefined` when this tree cannot say.
     *
     * Two keys are tried, and the plain `path.resolve` one comes FIRST because
     * it is the form that actually matches: `_file_entry` records the path
     * verbatim as the copy loop built it, and `readRecordedHashes` re-resolves
     * with `path.resolve` and no realpath. Looking up only the realpath would
     * miss every entry on macOS, where the temp and home trees sit behind the
     * realpath symlink that rewrites a `/var` prefix onto its private twin —
     * the feature would have been inert on the platform it was developed on.
     * (Spelled out rather than quoted: `check_bundle_path_leakage` scans the
     * tracked bundles this file is compiled into, and the literal form is a
     * build-machine path leak there.) The realpath is kept as a second key so
     * a manifest written through a symlinked deploy root still resolves.
     */
    function recordedHashFor(target) {
        if (conflictState.root === null)
            return undefined;
        conflictState.recorded ??= recordedHashesForRoot(conflictState.root);
        const plain = path.resolve(target);
        if (conflictState.recorded.has(plain))
            return conflictState.recorded.get(plain);
        const real = resolvePath(target);
        return real === plain ? undefined : conflictState.recorded.get(real);
    }
    return {
        conflictState,
        begin(root) {
            conflictState.root = root;
            conflictState.recorded = null;
            conflictState.preserved = [];
        },
        /**
         * The on-disk digest is computed HERE rather than carried from the
         * plan: this runs immediately before the caller copies over `target`,
         * so a file edited between planning and writing is still classified
         * from the bytes that are actually about to be destroyed.
         */
        resolve(target, force) {
            const exists = pathExists(target);
            return decideDeployWrite({
                exists,
                recordedSha256: exists ? recordedHashFor(target) : undefined,
                onDiskSha256: exists ? sha256OfFile(target) : null,
                force,
            });
        },
        /**
         * An existing sidecar is never replaced. Byte-identical content is a
         * no-op (a re-run of an install that already staged this file);
         * anything else fails the run, because the package content was then
         * written nowhere and reporting "completed with conflicts" would claim
         * a staging that did not happen.
         */
        preserve(target, source, packageRoot) {
            const sidecar = sidecarPathFor(target);
            const sourceSha = sha256OfFile(source);
            if (pathExists(sidecar)) {
                if (sourceSha === null || sha256OfFile(sidecar) !== sourceSha) {
                    host.fail(foreignSidecarMessage(target, sidecar));
                }
            }
            else {
                mkdirp(path.dirname(sidecar));
                const tmp = path.join(path.dirname(sidecar), `.${path.basename(sidecar)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
                try {
                    fs.copyFileSync(source, tmp);
                    fs.renameSync(tmp, sidecar);
                }
                catch (exc) {
                    try {
                        fs.unlinkSync(tmp);
                    }
                    catch {
                        /* swallow — best-effort cleanup of our own temp file */
                    }
                    host.fail(`Could not stage package content for ${target} at ${sidecar}: ${String(exc)}. ` +
                        'Nothing was written; the managed file is unchanged.');
                }
                host.logWrite(sidecar);
            }
            // `packageRoot` is accepted and unused: `_inject_package_tag` stamps
            // `package:` / `source_path:` into a DEPLOYED `.md`, and the sidecar
            // is not deployed — it is the package bytes the user merges by hand.
            // Tagging it would put an install-time annotation into content the
            // user diffs.
            void packageRoot;
            conflictState.preserved.push(target);
            host.warn(preservedFileMessage(target, sidecar));
        },
        /**
         * Runs before the installer's terminal NDJSON frame so that frame can
         * carry the count. A failing run keeps its own code — a conflict never
         * masks a failure.
         */
        finalizeRc(rc) {
            const count = conflictState.preserved.length;
            if (count === 0)
                return rc;
            host.emitProgress({ type: 'conflicts', count, paths: [...conflictState.preserved] });
            // `warn` writes to stderr and is deliberately NOT gated on QUIET:
            // the wizard runs the installer with QUIET set, and a preserved
            // edit is the one thing a silent run must still say.
            host.warn(conflictSummaryMessage(count));
            return rc === 0 ? EXIT_COMPLETED_WITH_CONFLICTS : rc;
        },
    };
}
//# sourceMappingURL=conflictTracker.js.map