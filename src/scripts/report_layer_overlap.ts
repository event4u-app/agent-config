/**
 * report_layer_overlap — print what writing the project layer costs, if anything.
 *
 * Runs as its own step of `task generate-tools` rather than as a call inside
 * `condense.ts`, and the reason is a gate rather than taste: `condense.ts` is
 * already over `check_source_size_budget`'s 1500-line ceiling, and that ratchet is
 * shrink-only — an import plus a call there is +2 lines it refuses, and re-pinning
 * the baseline is named a defect in the gate's own message. So the notice lives
 * beside the task it belongs to.
 *
 * WHY THE NOTICE EXISTS. `generate-tools` writes ONE of the two layers Claude Code
 * loads and was silent about the other existing, while the installer's overlap gate
 * runs at install time and cannot see a layer written afterwards. The overlap is
 * therefore created by whichever producer runs LAST, and neither said so.
 *
 * ADVISORY BY CONSTRUCTION: always exits 0. The build must not fail on a topology
 * the operator may not be able to change today — that would make the build unusable
 * rather than the duplication visible. The check that can refuse is
 * `check_single_delivery --enforce`. Invariant: ADR-236.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveHostLayerVerdict, setPartitionAnnounce } from '../install/partitionEligibility.js';
import { warnLayerOverlap } from './_lib/layer_overlap_notice.js';

// ledger-exempt: this is a REPORTER, not a gate — it always exits 0 by construction
// (see the docstring above), so there is no verdict for a per-target ledger to
// account for. `_lib/gate_ledger` records why a gate passed over a target; a script
// that cannot fail passes over nothing. The advisory-only property is asserted by the
// task step that calls it, not by this marker.

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let projectRoot = REPO_ROOT;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--project') {
            const v = args[i + 1];
            if (v === undefined || v.startsWith('-')) {
                process.stderr.write('report_layer_overlap: --project needs a directory\n');
                return 1;
            }
            projectRoot = path.resolve(v);
            i += 1;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write('usage: report_layer_overlap [--project DIR]\n');
            return 0;
        } else if (a !== undefined) {
            // Unrecognised arguments are an error even here, where the exit code is
            // otherwise always 0: a silently ignored typo in a build step is how a
            // notice stops firing without anyone noticing.
            process.stderr.write(`report_layer_overlap: unexpected argument ${a}\n`);
            return 1;
        }
    }
    // The projection line, and where it lives is a correction. **Both council seats
    // (2026-08-20, 2/2) required that generation PRINT the mode it selected** rather
    // than partition silently. The 2026-09-07 change moved the withhold off
    // `installed.lock` and, in doing so, removed `condense.ts`'s only call into the
    // resolver — so the emitter it installed became dead and generation withheld
    // ~299 skills and 29 personas while printing nothing about the layer it
    // withheld against. A neutral review found it the same day.
    //
    // It prints from HERE rather than from `condense.ts` because that file is ~1,200
    // lines past the source-size ceiling, where the ratchet counts every added line
    // and its test blocks on `baseline == live`. This step already runs in the same
    // `generate-tools` chain, one line below the generator, so the operator sees the
    // two lines together.
    // Silence the resolver's OWN one-liner first: it writes to stdout by default,
    // and leaving it on printed the verdict twice — once bare, once with the
    // remediation text below. One line, the useful one.
    setPartitionAnnounce(() => undefined);
    const verdict = resolveHostLayerVerdict(projectRoot);
    // Three states, not two. Corrected after a second neutral review: the
    // unverified branch printed "a stale global layer is fixed by
    // `agent-config install`" on a machine with NO global layer at all — a fresh
    // checkout, where nothing is withheld, nothing is stale, and the remediation
    // named does not apply. It fired on every `task generate-tools` there.
    //
    // What this line reports is the VERIFICATION state of the layer withheld
    // against. The per-artefact withhold COUNTS are the generator's own summary
    // one line above (`skills=N`, `command_skills=N (M withheld …)`), which is
    // where a reader sees what was actually held back.
    const noLayer = verdict.reason.includes('no host-global layer');
    process.stdout.write(
        verdict.verified
            ? `  ℹ️  project layer carries only what ~/.claude lacks — ${verdict.reason}\n`
            : noLayer
              ? '  ℹ️  no host-global layer on this machine — nothing is withheld, so the\n' +
                '      project layer carries the full projection by construction.\n'
              : `  ⚠️  host layer UNVERIFIED — ${verdict.reason}\n` +
                '      The project layer still carries only what ~/.claude lacks (per-artefact,\n' +
                '      ADR-236 amendment 2026-09-07). A stale global layer is fixed by\n' +
                '      `agent-config install`, not by re-running generate-tools.\n',
    );
    warnLayerOverlap(projectRoot, (m) => process.stdout.write(`${m}\n`));
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
