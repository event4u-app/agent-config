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
import {
    EXIT_COMPLETED_WITH_CONFLICTS,
    conflictSummaryMessage,
    decideDeployWrite,
    foreignSidecarMessage,
    preservedFileMessage,
    sidecarPathFor,
    type DeployWriteDecision,
} from './preserve.js';
import { recordedHashesForRoot, type RecordedHashes } from './recordedOwnership.js';

/** The installer-owned reporting surface the tracker borrows. */
export interface ConflictTrackerHost {
    /** `install.ts::warn` — stderr, deliberately NOT gated on QUIET. */
    warn(msg: string): void;
    /** `install.ts::fail` — prints the doctor hint, then throws `SystemExitError(1)`. */
    fail(msg: string): never;
    /** `install.ts::_log_tx_entry('write', target)`. */
    logWrite(target: string): void;
    /** `install.ts::_emit_progress` — a no-op unless `--progress-ndjson` is set. */
    emitProgress(frame: Record<string, unknown>): void;
    /**
     * `install.ts::_inject_package_tag` — stamps `package:` / `source_path:`
     * into a deployed `.md`.
     *
     * The tracker needs it because the sidecar must be what the installer WOULD
     * have written, and a deployed file is the package bytes PLUS this tag. A
     * raw copy is not that file: merging it by hand leaves content that matches
     * no recorded digest and carries none of the ownership evidence the reaper
     * reads, so the obvious way to resolve a conflict produced a file the tool
     * no longer recognised as its own.
     */
    tagDeployed(target: string, source: string, packageRoot: string | null): void;
}

/**
 * Mutable per-run state.
 *
 * `recorded` is read lazily and cached for the whole run, so the digests
 * compared against are the ones recorded BEFORE this run started — the manifest
 * is rewritten at the end of the install, and re-reading it mid-run would
 * compare a file against a digest this very run had just recorded for it.
 */
export interface ConflictState {
    root: string | null;
    recorded: RecordedHashes | null;
    preserved: string[];
    /**
     * Sidecar path → the digest of the package content staged there this run.
     *
     * Recorded into the manifest beside the preserved target, and it is the
     * only durable proof that this installer wrote that sidecar. Without it,
     * a sidecar staged against package v2 and still unmerged when v3 installs
     * is indistinguishable from a stranger's file at the same path — which is
     * why the run used to abort there.
     */
    staged: Map<string, string | null>;
}

export interface ConflictTracker {
    /** Live state, exposed so the installer can re-export it for its tests. */
    readonly conflictState: ConflictState;
    /** Reset the tracker and point it at the tree whose manifest records ownership. */
    begin(root: string | null): void;
    /** Decide what the writer does with one deploy target. */
    resolve(target: string, force: boolean): DeployWriteDecision;
    /** Stage package content beside a preserved target, then record and report it. */
    preserve(target: string, source: string, packageRoot: string | null): void;
    /** The same, for a managed file the installer generates rather than copies. */
    preserveContent(target: string, content: string): void;
    /** Fold preserved-file conflicts into the run's exit code and report them. */
    finalizeRc(rc: number): number;
}

/**
 * Build a tracker bound to one installer's reporting surface.
 *
 * A factory rather than module-level state so the reporting surface is injected
 * rather than imported. It is NOT what keeps two installs in one process apart:
 * `src/scripts/install.ts` calls this once at module scope, so both runs share
 * the instance and therefore the `preserved` list. `begin()` is what scopes the
 * state to a run, and it is the only thing that does.
 */
export function createConflictTracker(host: ConflictTrackerHost): ConflictTracker {
    const conflictState: ConflictState = {
        root: null,
        recorded: null,
        preserved: [],
        staged: new Map(),
    };

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
    function recordedHashFor(target: string): string | null | undefined {
        if (conflictState.root === null) return undefined;
        conflictState.recorded ??= recordedHashesForRoot(conflictState.root);
        const plain = path.resolve(target);
        if (conflictState.recorded.has(plain)) return conflictState.recorded.get(plain);
        const real = resolvePath(target);
        return real === plain ? undefined : conflictState.recorded.get(real);
    }

    /**
     * Produce the bytes this run would have written, then reconcile them with
     * whatever already sits at the sidecar path.
     *
     * The candidate is built into a temp file FIRST so the comparison is against
     * the bytes that would actually be staged rather than against the raw
     * package source — those differ, because a deployed file is the package
     * bytes plus the install-time `package:` tag, and comparing the untagged
     * source would call every already-staged sidecar stale and rewrite it on
     * every run.
     *
     * The temp name ends in the TARGET's extension because `_inject_package_tag`
     * keys on it: a sidecar is `<name>.md.agent-config.new`, whose extension is
     * `.new`, so tagging it in place would silently do nothing.
     */
    function stageInto(target: string, sidecar: string, produce: (tmp: string) => void): void {
        mkdirp(path.dirname(sidecar));
        const tmp = path.join(
            path.dirname(sidecar),
            `.${path.basename(sidecar)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}${path.extname(target)}`,
        );
        const discard = (): void => {
            try {
                fs.unlinkSync(tmp);
            } catch {
                /* swallow — best-effort cleanup of our own temp file */
            }
        };
        let candidate: string | null;
        try {
            produce(tmp);
            candidate = sha256OfFile(tmp);
        } catch (exc) {
            discard();
            host.fail(
                `Could not stage package content for ${target} at ${sidecar}: ${String(exc)}. ` +
                    'Nothing was written; the managed file is unchanged.',
            );
        }
        if (pathExists(sidecar)) {
            const onDisk = sha256OfFile(sidecar);
            // Three outcomes, and only the third is a refusal. Identical bytes:
            // already staged, so the file is left alone. Bytes this tree
            // RECORDED staging: an earlier run staged them against an older
            // package version and the user has not merged them yet — the
            // staging workflow behaving as designed, so the stale copy is
            // refreshed. Anything else is unattributable and the run stops.
            //
            // Ownership is decided by the recorded digest, never by whether the
            // bytes match the CURRENT package: that test called every unmerged
            // sidecar foreign the moment a new version shipped, and aborted the
            // whole install saying it could not show it wrote a file it had
            // written one version earlier.
            if (onDisk !== null && onDisk === candidate) {
                discard();
                conflictState.staged.set(sidecar, onDisk);
                return;
            }
            if (onDisk === null || onDisk !== recordedHashFor(sidecar)) {
                discard();
                host.fail(foreignSidecarMessage(target, sidecar));
            }
        }
        try {
            fs.renameSync(tmp, sidecar);
        } catch (exc) {
            discard();
            host.fail(
                `Could not stage package content for ${target} at ${sidecar}: ${String(exc)}. ` +
                    'Nothing was written; the managed file is unchanged.',
            );
        }
        conflictState.staged.set(sidecar, candidate);
        host.logWrite(sidecar);
    }

    /** Record and report one preserved target, once per destination. */
    function record(target: string, sidecar: string): void {
        // Deduped: two plan entries can resolve to one destination, and a count
        // is a promise about FILES. Double-counting inflates the summary, the
        // NDJSON frame and anything downstream reading either.
        if (conflictState.preserved.includes(target)) return;
        conflictState.preserved.push(target);
        host.warn(preservedFileMessage(target, sidecar));
    }

    return {
        conflictState,

        begin(root: string | null): void {
            conflictState.root = root;
            conflictState.recorded = null;
            conflictState.preserved = [];
            conflictState.staged = new Map();
        },

        /**
         * The on-disk digest is computed HERE rather than carried from the
         * plan: this runs immediately before the caller copies over `target`,
         * so a file edited between planning and writing is still classified
         * from the bytes that are actually about to be destroyed.
         */
        resolve(target: string, force: boolean): DeployWriteDecision {
            const exists = pathExists(target);
            return decideDeployWrite({
                exists,
                recordedSha256: exists ? recordedHashFor(target) : undefined,
                onDiskSha256: exists ? sha256OfFile(target) : null,
                force,
            });
        },

        /**
         * Stage the package content beside a preserved target.
         *
         * The staged bytes are what the installer WOULD have written — the
         * package file plus its install-time tag — so merging the sidecar by
         * hand yields a file that matches the digest this run records and still
         * carries the ownership evidence the reaper reads.
         */
        preserve(target: string, source: string, packageRoot: string | null): void {
            const sidecar = sidecarPathFor(target);
            stageInto(target, sidecar, (tmp) => {
                fs.copyFileSync(source, tmp);
                host.tagDeployed(tmp, source, packageRoot);
            });
            record(target, sidecar);
        },

        /**
         * The same, for a managed file the installer GENERATES rather than
         * copies (the Claude Desktop marker).
         *
         * Those writers are recorded in the manifest with a digest, so they are
         * in the class the ruling covers, and one of them wrote unconditionally
         * — ignoring even `--force` — because the tracker was wired only into
         * the copy loop.
         */
        preserveContent(target: string, content: string): void {
            const sidecar = sidecarPathFor(target);
            stageInto(target, sidecar, (tmp) => fs.writeFileSync(tmp, content, 'utf-8'));
            record(target, sidecar);
        },

        /**
         * Runs before the installer's terminal NDJSON frame so that frame can
         * carry the count. A failing run keeps its own code — a conflict never
         * masks a failure.
         */
        finalizeRc(rc: number): number {
            const count = conflictState.preserved.length;
            if (count === 0) return rc;
            host.emitProgress({ type: 'conflicts', count, paths: [...conflictState.preserved] });
            // `warn` writes to stderr and is deliberately NOT gated on QUIET:
            // the wizard runs the installer with QUIET set, and a preserved
            // edit is the one thing a silent run must still say.
            host.warn(conflictSummaryMessage(count));
            return rc === 0 ? EXIT_COMPLETED_WITH_CONFLICTS : rc;
        },
    };
}
