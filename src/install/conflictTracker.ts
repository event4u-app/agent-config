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
    isLedgerMigration,
    migrationPreservedMessage,
    preservedFileMessage,
    sidecarPathFor,
    type DeployWriteDecision,
} from './preserve.js';
import { ledgerListedPaths, recordedHashesWithLedger, type RecordedHashes } from './recordedOwnership.js';

/**
 * The bytes a run would write to one target, named rather than computed.
 *
 * A copy carries the package file plus its install-time tag; a generated
 * marker carries its own content. The tracker turns either into a digest, and
 * only when the migration branch needs one.
 */
export type WouldWrite =
    | { readonly from: string; readonly packageRoot: string | null }
    | { readonly content: string };

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
    /**
     * Paths the ownership ledger lists, read lazily and cached for the run.
     *
     * Same discipline as `recorded`, for the same reason: the ledger is
     * rewritten at the end of the install, so re-reading it mid-run would
     * compare a file against a listing this very run had just produced.
     */
    ledgerFiles: ReadonlySet<string> | null;
    preserved: string[];
    /**
     * Targets this run preserved on the migration branch.
     *
     * The report line differs there — the run cannot say the file was edited,
     * only that it cannot tell — and the writer learns which is which from
     * `resolve`, not from re-deriving the classification at report time.
     */
    migrated: Set<string>;
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
    /**
     * Decide what the writer does with one deploy target.
     *
     * `would` is required rather than optional: a call site that cannot say
     * what it would write cannot be classified on the migration branch, and an
     * optional argument would let a new one skip that branch silently instead
     * of having to decide.
     */
    resolve(target: string, force: boolean, would: WouldWrite): DeployWriteDecision;
    /** The digest recorded before this run for `target` — what decided a preservation. */
    recordedDigest(target: string): string | null | undefined;
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
        ledgerFiles: null,
        preserved: [],
        migrated: new Set(),
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
        conflictState.recorded ??= recordedHashesWithLedger(conflictState.root);
        const plain = path.resolve(target);
        if (conflictState.recorded.has(plain)) return conflictState.recorded.get(plain);
        const real = resolvePath(target);
        return real === plain ? undefined : conflictState.recorded.get(real);
    }

    /**
     * Does the ownership ledger list this path, under either spelling?
     *
     * Both keys are tried for the reason `recordedHashFor` documents: on macOS
     * the temp and home trees sit behind a realpath symlink that rewrites a
     * `/var` prefix onto its private twin, so a single spelling misses every
     * entry on the platform this is developed on.
     */
    function ledgerLists(target: string): boolean {
        conflictState.ledgerFiles ??= ledgerListedPaths();
        const files = conflictState.ledgerFiles;
        return files.has(path.resolve(target)) || files.has(resolvePath(target));
    }

    /**
     * The digest of the bytes this run would write to `target`.
     *
     * Built into a temp file rather than hashed off the package source,
     * because a deployed file is the package bytes PLUS the install-time tag
     * and the two differ — comparing against the untagged source would call
     * every up-to-date file divergent. The temp name carries the TARGET's
     * extension because `tagDeployed` keys on it, the same constraint
     * `stageInto` works around.
     *
     * `null` on any failure, which preserves: this is consulted only where
     * nothing can be proven, and failing toward the recoverable direction is
     * the whole point of the branch that calls it.
     */
    function wouldWriteDigest(target: string, would: WouldWrite): string | null {
        const tmp = path.join(
            path.dirname(target),
            `.${path.basename(target)}.would.${process.pid}.${crypto.randomBytes(6).toString('hex')}${path.extname(target)}`,
        );
        try {
            if ('content' in would) {
                fs.writeFileSync(tmp, would.content, 'utf-8');
            } else {
                fs.copyFileSync(would.from, tmp);
                host.tagDeployed(tmp, would.from, would.packageRoot);
            }
            return sha256OfFile(tmp);
        } catch {
            return null;
        } finally {
            try {
                fs.unlinkSync(tmp);
            } catch {
                /* swallow — best-effort cleanup of our own temp file */
            }
        }
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
        host.warn(
            conflictState.migrated.has(path.resolve(target))
                ? migrationPreservedMessage(target, sidecar)
                : preservedFileMessage(target, sidecar),
        );
    }

    return {
        conflictState,

        recordedDigest: recordedHashFor,

        begin(root: string | null): void {
            conflictState.root = root;
            conflictState.recorded = null;
            conflictState.ledgerFiles = null;
            conflictState.preserved = [];
            conflictState.migrated = new Set();
            conflictState.staged = new Map();
        },

        /**
         * The on-disk digest is computed HERE rather than carried from the
         * plan: this runs immediately before the caller copies over `target`,
         * so a file edited between planning and writing is still classified
         * from the bytes that are actually about to be destroyed.
         */
        resolve(target: string, force: boolean, would: WouldWrite): DeployWriteDecision {
            const exists = pathExists(target);
            const base = {
                exists,
                recordedSha256: exists ? recordedHashFor(target) : undefined,
                onDiskSha256: exists ? sha256OfFile(target) : null,
                force,
                ledgerListed: exists && ledgerLists(target),
            };
            // The packaged digest costs a temp write and a tag, so it is
            // computed only for the targets that can consume it. On a tree
            // where every ledger-listed path carries a digest — which is every
            // tree the ledger itself has written — this is false throughout
            // and the run pays nothing.
            const migrating = isLedgerMigration(base);
            const decision = decideDeployWrite(
                migrating ? { ...base, packagedSha256: wouldWriteDigest(target, would) } : base,
            );
            if (decision === 'preserve' && migrating) {
                conflictState.migrated.add(path.resolve(target));
            }
            return decision;
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
