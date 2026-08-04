#!/usr/bin/env tsx
/**
 * Assert `ci-strict` is a superset of `ci` BY CONSTRUCTION.
 *
 * WHY THIS EXISTS (road-to-renewal-foundation Phase 1, council 2026-08-02
 * decision A1, 2/2):
 *
 * `Taskfile.yml` used to carry `ci` (202 gate entries) and `ci-strict` (197)
 * as two independently maintained literal lists. They drifted, and nothing
 * detected it — `check_ci_local_parity.ts` deliberately scopes itself to
 * `LOCAL_ROOTS = ['ci', 'consistency']`, so `ci-strict` was outside every
 * assertion in the repo. Six gates ran in `ci` with no counterpart in
 * `ci-strict` at all:
 *
 *   preflight (fans out to 11 scripts, incl. check_no_new_legacy_path and
 *   check_kernel_rule_bundle), check-ci-local-parity,
 *   check-gitignore-freshness, check-generator-output-coverage,
 *   check-tracked-but-ignored, check-generated-artefact-headers
 *
 * — so the "release-tag gate" was strictly WEAKER than the everyday gate on
 * ~16 concrete script runs. A stricter tier that checks less is the worst
 * possible shape for a release gate: it is trusted more and proves less.
 *
 * The fix was structural, not a bigger checker: `ci-strict` now delegates to
 * `ci` and adds only strict-only entries on top, so the superset property is
 * tautological. This gate guards the ONE invariant that keeps it tautological
 * — the first gate entry of `ci-strict` is `- task: ci`.
 *
 * It deliberately does NOT re-parse and diff both lists. That would recreate
 * the very "maintain a second model of the same thing" problem the delegation
 * removed, and it would pass happily on a re-forked pair of lists that merely
 * happened to match on the day it ran.
 *
 * Exit codes: 0 ok · 1 invariant violated · 2 usage / environment error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const TASKFILE = path.join(REPO_ROOT, 'Taskfile.yml');

/** The delegation entry that makes the superset property tautological. */
const DELEGATION = '- task: ci';

/**
 * Extract the `cmds:` entries of a top-level task, in order.
 *
 * Minimal line scan rather than a YAML dependency: the shape is fixed
 * (`  <name>:` at two-space indent, `    cmds:` at four, `      - ...` at
 * six) and the repo has no YAML anchors anywhere, so a parser buys nothing
 * here and adds an import to a gate that must stay cheap.
 */
function taskCmds(source: string, taskName: string): string[] | null {
    const lines = source.split('\n');
    const header = `  ${taskName}:`;
    let i = lines.findIndex((l) => l === header);
    if (i === -1) {
        return null;
    }
    const out: string[] = [];
    let inCmds = false;
    for (i += 1; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.trim() === '') {
            continue;
        }
        // Any line at two-space indent that is not deeper ends this task.
        if (/^ {2}\S/.test(line)) {
            break;
        }
        if (/^ {4}cmds:\s*$/.test(line)) {
            inCmds = true;
            continue;
        }
        if (!inCmds) {
            continue;
        }
        const m = /^ {6}(- .*)$/.exec(line);
        if (m) {
            out.push(m[1]!.trim());
        }
    }
    return out;
}

export function main(): number {
    let source: string;
    try {
        source = fs.readFileSync(TASKFILE, 'utf-8');
    } catch (err) {
        process.stderr.write(`❌  check_ci_strict_superset: cannot read ${TASKFILE}: ${String(err)}\n`);
        return 2;
    }

    const strict = taskCmds(source, 'ci-strict');
    if (strict === null) {
        process.stderr.write(
            '❌  check_ci_strict_superset: no `ci-strict:` task found in Taskfile.yml.\n' +
                '    The gate cannot verify an invariant on a task that does not exist.\n',
        );
        return 2;
    }
    if (taskCmds(source, 'ci') === null) {
        process.stderr.write(
            '❌  check_ci_strict_superset: no `ci:` task found in Taskfile.yml.\n',
        );
        return 2;
    }

    // Skip the internal timing wrappers; they carry no gate semantics and
    // `ci-strict` intentionally does not repeat them (`ci` already brackets
    // the run, so the duration line prints once).
    const gateEntries = strict.filter(
        (e) => !e.startsWith('- defer:') && e !== '- task: _ci-start' && e !== '- task: _ci-end',
    );

    // Replaces the ad-hoc `gateEntries.length === 0` guard. Exit 2, not the 1 it
    // returned: a task list with nothing in it means the gate could not verify
    // the invariant — the documented meaning of 2, and what the two
    // missing-task branches above already return — not that the invariant is
    // violated. Counted after the wrapper filter on purpose: a `ci-strict` made
    // of nothing but `_ci-start`/`_ci-end` is just as dead a scope.
    try {
        assertScanned({
            gate: 'check_ci_strict_superset',
            scanned: gateEntries.length,
            units: 'ci-strict gate entr(y|ies)',
            roots: ['Taskfile.yml (ci-strict.cmds)'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (gateEntries[0] !== DELEGATION) {
        process.stderr.write(
            '❌  check_ci_strict_superset: `ci-strict` no longer delegates to `ci`.\n' +
                `    expected first gate entry: \`${DELEGATION}\`\n` +
                `    found:                    \`${gateEntries[0]}\`\n\n` +
                '    `ci-strict` must run every `ci` gate plus strict-only extras. It used\n' +
                '    to be an independently maintained copy of the list and silently drifted\n' +
                '    to SIX fewer gates than `ci` — a release gate that proved less than the\n' +
                '    everyday gate. Delegation is what makes the superset property structural\n' +
                '    instead of asserted. If you need a strict variant of a gate, add the\n' +
                '    `-strict` task AFTER the delegation entry; never re-inline the list.\n',
        );
        return 1;
    }

    const extras = gateEntries.slice(1);
    process.stdout.write(
        `✅  ci-strict ⊇ ci by construction (delegates to \`ci\`, plus ${extras.length} strict-only ` +
            `entr${extras.length === 1 ? 'y' : 'ies'}).\n`,
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
