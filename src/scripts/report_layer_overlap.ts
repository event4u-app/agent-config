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

import { warnLayerOverlap } from './_lib/layer_overlap_notice.js';

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
