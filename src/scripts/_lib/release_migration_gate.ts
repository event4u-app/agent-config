/**
 * The two MIGRATION.md refusals a major cut has to clear.
 *
 * FORWARD — {@link assert_scheduled_deprecations_clear}: a commitment in the
 * scheduled-deprecations table due at or before the major being cut.
 * BACKWARD — {@link assert_major_migration_section}: a major that SHIPS a
 * breaking change and tells a consumer nothing about it.
 *
 * They live together because they are the two halves of one obligation and
 * were written eleven months apart, the second only after the first half's
 * absence let 15.0.0 and 16.0.0 ship with no section at all. Extracted out of
 * `release.ts` in the same change that added the backward half: that file sits
 * 375 lines over the 1,500-line source ceiling `check_source_size_budget`
 * ratchets, and the gate's own contract names a split as the way a total comes
 * down rather than a baseline going up.
 *
 * Both keep the preview semantics `release.ts` asserts: under `--dry-run` they
 * PRINT what the real run will refuse and return, because `--dry-run exits 0`
 * is a contract that file's tests pin.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { REPO_ROOT } from '../release_env.js';
import { die, run, type RunResult } from '../release_publication.js';
import {
    MIGRATION_PATH as MAJOR_MIGRATION_PATH,
    pendingMajorFinding,
} from '../lint_major_migration_sections.js';

/**
 * Minor/patch components of a bare `X.Y.Z`.
 *
 * A local two-line parse rather than an import: `release.ts`'s `parse_version`
 * is module-private there, and exporting it to serve one caller would widen
 * that file's surface in the change whose point is to narrow it.
 */
function _minor_patch(v: string): [number, number] {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    if (m === null) {
        throw new Error(`not a bare version: ${v}`);
    }
    return [Number(m[2]), Number(m[3])];
}

/**
 * Refuse a MAJOR cut that carries a scheduled deprecation due at or before it.
 *
 * **The trigger is the shape of the TARGET, not a comparison with the current
 * version.** A major target is `X.0.0` — and that one predicate covers every
 * path to a major: the `--as major` flag, an explicit `--version 13.0.0`,
 * auto-detection from a `feat!:` commit, AND `--resume`, where
 * `_detect_in_flight_target()` returns the already-bumped `package.json`
 * version so `target === current` and any current-vs-target comparison
 * silently returns. Resume was the fourth path an earlier version of this
 * guard missed while its own comment claimed three paths converged.
 *
 * Refusing a resumed release can strand a partially-completed one, and that is
 * the deliberate trade: a stranded release is recoverable by fixing the table
 * and resuming again, whereas a major shipped over a missed commitment is the
 * failure this whole surface exists to prevent.
 *
 * The target version is PASSED to the gate. Without it the gate falls back to
 * `package.json`, which at the cut to N still reads N-1 — so a row committed
 * to N reads as one major early and passes, and only rows already a major late
 * could ever be refused. That is the lateness being prevented, so measuring
 * against the shipped version would have made the refusal fire exactly one
 * major too late, forever.
 *
 * Runs under `--dry-run` too, unlike the rest of preflight: this check is one
 * subprocess reading two files, so the "keep a preview fast" rationale that
 * excludes the ~15s test-trend collection does not apply — and a preview that
 * reports green for the single condition that will refuse the real run is the
 * case an operator runs a preview to discover. It REPORTS there rather than
 * dying: `--dry-run` exiting 0 before `execute()` and before `preflight()` is a
 * contract this file's own tests assert, and an earlier revision of this guard
 * broke it by sitting above the dry-run branch with no preview mode.
 *
 * @param runner Seam for the gate invocation. Production passes nothing and
 * gets the real `run`; tests inject a stub, because the alternative — reaching
 * this branch only by mutating `docs/MIGRATION.md` — would make the refusal
 * path testable exclusively through a tracked-file edit.
 */
export function assert_scheduled_deprecations_clear(
    target: string,
    runner: (args: readonly string[]) => RunResult = (args) => run(args, { check: false, capture: true }),
    opts: { previewOnly?: boolean } = {},
): void {
    const [minor, patch] = _minor_patch(target);
    if (minor !== 0 || patch !== 0) {
        return;
    }
    const res = runner([
        './scripts-run',
        'src/scripts/lint_scheduled_deprecations',
        '--cutting',
        target,
    ]);
    if (res.returncode === 0) {
        return;
    }
    process.stderr.write(res.stdout);
    process.stderr.write(res.stderr);
    if (res.returncode !== 1) {
        // The gate reserves 1 for a finding and 2 for a usage/environment
        // failure. Diagnosing the latter as "the table has an overdue row"
        // sends the releaser to edit a file that is not the problem.
        die(
            `refusing the ${target} cut: the scheduled-deprecations check could not run ` +
                `(exit ${String(res.returncode)}). That is an environment or usage failure, not a ` +
                'finding in docs/MIGRATION.md — fix the invocation or the checkout, then re-run.',
        );
    }
    if (opts.previewOnly === true) {
        // The preview's job is to SHOW what the real run will refuse. Dying
        // here would break the `--dry-run exits 0` contract asserted elsewhere
        // in this file's tests — trading a documented exit code for a message
        // that has already been printed above.
        process.stderr.write(
            `\n(dry-run) the ${target} cut WOULD BE REFUSED for the reason above. ` +
                'Previewing only; exit code unchanged.\n',
        );
        return;
    }
    die(
        `refusing the ${target} cut: the scheduled-deprecations table in docs/MIGRATION.md ` +
            'has a row due at or before this major, or one that cannot be resolved. Act on ' +
            "it — perform the removal in its own change, or revise the row's commitment and " +
            'record why the surface stays — then re-run.',
    );
}

/**
 * Refuse a MAJOR cut whose BREAKING section has no `docs/MIGRATION.md` entry.
 *
 * The BACKWARD half of the pre-flight MIGRATION.md obligation.
 * {@link assert_scheduled_deprecations_clear} above is the forward half —
 * commitments due at a future major — and it is the half that already had a
 * gate. Nothing checked that a major SHIPPING a breaking change told a consumer
 * what to do about it, and 15.0.0 and 16.0.0 both shipped without a section.
 *
 * It runs at the call site rather than inside `preflight()` because the
 * comparand does not exist yet at pre-flight time: the section is rendered
 * later and is not prepended to `CHANGELOG.md` until `execute()`. Reading the
 * file in pre-flight would compare against the PREVIOUS release.
 *
 * Preview semantics match the sibling exactly — `--dry-run` prints what the
 * real run will refuse and returns, because `--dry-run exits 0` is a contract
 * this file's own tests assert.
 *
 * @param migrationReader Seam for the file read, so a test can drive the
 * refusal without mutating a tracked file.
 */
export function assert_major_migration_section(
    target: string,
    changelog_entry: string,
    opts: { previewOnly?: boolean } = {},
    migrationReader: () => string = () =>
        fs.readFileSync(path.join(REPO_ROOT, MAJOR_MIGRATION_PATH), 'utf-8'),
): void {
    let migration: string;
    try {
        migration = migrationReader();
    } catch (exc) {
        die(
            `refusing the ${target} cut: cannot read ${MAJOR_MIGRATION_PATH} ` +
                `(${exc instanceof Error ? exc.message : String(exc)}). That is an environment ` +
                'failure, not a finding — fix the checkout, then re-run.',
        );
    }
    const finding = pendingMajorFinding(target, changelog_entry, migration);
    if (finding === null) {
        return;
    }
    process.stderr.write(`\n${finding}\n`);
    if (opts.previewOnly === true) {
        process.stderr.write(
            `\n(dry-run) the ${target} cut WOULD BE REFUSED for the reason above. ` +
                'Previewing only; exit code unchanged.\n',
        );
        return;
    }
    die(`refusing the ${target} cut: ${MAJOR_MIGRATION_PATH} has no section for ${target}.`);
}
