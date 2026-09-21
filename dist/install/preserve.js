/**
 * Preserve a user-modified managed file — road-to-a-conformance-check-that-can-fail
 * Phase 5.1, owner ruling 2026-09-21 (option (a), after a 1/1 council split).
 *
 * THE GAP THIS CLOSES. Until this module existed, `agent-config init` overwrote
 * every deployed file unconditionally: `_resolve_file_conflict` in
 * `src/scripts/install.ts` returned `write` for every target, and the module
 * header recorded `--force` as an accepted no-op "because installs always
 * overwrite". The planner produced a `ConflictEntry` list naming the files the
 * user had edited, and the writer read none of it — so the report named the
 * file and the next install replaced it.
 *
 * WHAT THE RULING CHANGES. A managed file whose bytes diverge from the digest
 * the install manifest recorded is preserved; the package content it would
 * have been replaced with is staged beside it as a sidecar, and the run ends
 * with a distinct exit code so the resulting staleness is loud rather than
 * silent.
 *
 * NO SEMANTIC CLASSIFICATION, DELIBERATELY. Any divergence from the recorded
 * digest gets identical treatment. There is no comment-only detection, no
 * format-aware diff, no three-way merge — each would drag a per-format parser
 * into the installer's trusted computing base, and a syntactically trivial
 * edit can still be an intentional one. One byte of divergence is the whole
 * test.
 *
 * NO FALLBACK TO OVERWRITING. There is no conflict threshold above which
 * preservation stops, no resource-pressure escape, and no bulk accept flag.
 * `--force` is the single escape hatch and it is explicit, per-run and
 * documented. Failing closed here means leaving a file alone, which is the
 * recoverable direction.
 *
 * NO OWNERSHIP CLAIM OVER AN EXISTING SIDECAR. A file already sitting at the
 * sidecar path is only ever left alone: identical bytes are a no-op, anything
 * else refuses. A pathname matching the convention is not provenance, and
 * destroying an unrecognised file while claiming to protect files would be the
 * defect this module exists to remove, wearing the fix's clothes.
 */
import { classifyOwnership } from './recordedOwnership.js';
/**
 * Suffix appended to a preserved file's path to name its staged package copy.
 *
 * Tool-owned on purpose. A bare `.new` is a namespace editors, patch tools and
 * humans already write into, so an install that claimed it would collide with
 * files it has no relationship to; `.agent-config.new` says who wrote it.
 */
export const SIDECAR_SUFFIX = '.agent-config.new';
/**
 * Exit code for a run that installed everything it could but preserved at
 * least one user-modified file.
 *
 * Distinct from `0` (fully current) and from `1` (the run failed). It is the
 * load-bearing half of the ruling: preserving an edit leaves the active
 * installation stale, and a stale install that exits `0` is silently stale.
 * `2` is already argparse's usage-error code, so this is `3`.
 */
export const EXIT_COMPLETED_WITH_CONFLICTS = 3;
/**
 * Decide whether the writer may replace one managed file.
 *
 * A target that does not exist is written. A forced run writes. Otherwise the
 * recorded-ownership verdict decides: `recorded-modified` preserves, and both
 * `recorded-unchanged` and `unknown` write.
 *
 * The `unknown` arm is the one worth stating out loud, because it is what
 * keeps this change from being a regression. No recorded digest means no
 * divergence to measure — a tree with no manifest, a global anchor that holds
 * none, or a bridge entry recorded without a hash. Preserving there would
 * stage a sidecar beside every pre-existing file on a first install, which is
 * not protection, it is noise. The ruling covers a file this tree can show it
 * wrote and can show has changed since; everything else keeps the behavior it
 * had, and `recordedOwnership` already documents that floor.
 */
export function decideDeployWrite(inputs) {
    if (!inputs.exists)
        return 'write';
    if (inputs.force)
        return 'write';
    const ownership = classifyOwnership(inputs.recordedSha256, inputs.onDiskSha256);
    return ownership === 'recorded-modified' ? 'preserve' : 'write';
}
/** Path of the sidecar staged beside `target`. */
export function sidecarPathFor(target) {
    return `${target}${SIDECAR_SUFFIX}`;
}
/**
 * Per-file report line for a preserved target.
 *
 * Says three things in one breath, and all three are load-bearing: the edit
 * survived, the package content is somewhere findable, and the active
 * installation is not current — that last clause is what turns a silently
 * stale tree into a stated one.
 */
export function preservedFileMessage(target, sidecar) {
    return (`Preserved user-modified ${target}. Package content was written to ${sidecar}; ` +
        'the active installation is not current. Review and merge it, or rerun with ' +
        '--force to replace the managed file.');
}
/** End-of-run summary naming the conflict count and what it means. */
export function conflictSummaryMessage(count) {
    const noun = count === 1 ? 'file' : 'files';
    return (`Completed with conflicts: ${count} user-modified ${noun} preserved. ` +
        `Package content is staged alongside as *${SIDECAR_SUFFIX}; the active installation ` +
        `is not current until you merge it, or rerun with --force to replace the managed ${noun}.`);
}
/**
 * Refusal message for a sidecar path already holding bytes this run cannot
 * attribute to itself.
 *
 * The run fails rather than continuing: the package content was never written
 * anywhere, so the target is neither refreshed nor staged, and calling that
 * "completed with conflicts" would report a staging that did not happen.
 */
export function foreignSidecarMessage(target, sidecar) {
    return (`Refusing to replace ${sidecar}: it already exists with different content and this ` +
        `install cannot show it wrote it. Package content for ${target} was NOT staged. ` +
        'Move or delete that file and re-run, or rerun with --force to replace the managed file instead.');
}
//# sourceMappingURL=preserve.js.map