#!/usr/bin/env tsx
/**
 * Archived-review disposition check (contract §2.7 + §2.2).
 *
 * Gate R2 selects only artefacts relevant to the CURRENT review scope (§2.6),
 * and superseded rounds are renamed out of the `*.findings.md` glob on purpose.
 * The consequence nobody noticed until it bit: **no validator reads archived
 * round records at all**, so a finding left `open` after it was fixed is caught
 * by nothing. That is exactly how two fixed findings sat recorded as `open` for
 * a day in this repo's own corpus.
 *
 * This closes that gap with the smallest mechanism that covers the observed
 * failure: archiving a round asserts the round is CLOSED, so every row in an
 * archived record must carry a terminal status and a non-empty Reason/Ref.
 *
 * Deliberately NOT the disposition index with stable ids that was originally
 * proposed. That design assumed dispositions live OUTSIDE the round records;
 * measured across the corpus, they do not — records are terminal in place. An
 * index would be a second artefact to keep in sync, and therefore a new drift
 * source, guarding a failure mode that has not occurred. Trigger to revisit: a
 * disposition that genuinely cannot be recorded in the round record itself.
 *
 * Scope: `*-review.md` under the reviews root, excluding `*.findings.md` (those
 * are live artefacts and belong to `check_completion_review`).
 *
 * Reference SHAPE is deliberately NOT checked, and that was a measurement, not
 * a preference. The first draft resolved a `fixed` ref via `rev-parse` and a
 * `deferred` ref via a path probe. Run against the real corpus it produced 8
 * blocks — every one of them a pre-existing archived record whose reference is
 * prose describing the change, or a carrier named by bare slug. None of the 8
 * was the failure this gate exists to catch. Archived records are frozen
 * (§2.7), so a shape rule cannot be satisfied retroactively without editing
 * them; a gate whose only output is unfixable blocks is the gate that gets
 * switched off. Trigger to revisit: a review round where an unresolvable
 * reference actually hid a disposition, on a record written AFTER this gate
 * shipped and therefore fixable at source.
 *
 * Exit codes (contract §6): 0 = pass, 1 = policy violation (including a DEAD
 * SCAN SCOPE — a gate that read nothing has not passed), 2 = internal error
 * (the CALLER applies degraded advisory mode). `scanned:` is emitted on EVERY
 * exit path, exit 2 included.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import { parseArtifact } from './check_completion_review.js';

const REVIEWS_ROOT = 'agents/evidence/reviews';
const TERMINAL = new Set(['fixed', 'accepted-risk', 'deferred']);

export interface Violation {
    kind: string;
    file: string;
    detail: string;
}

/** An archived record: a `*-review.md` that is not a live `*.findings.md`. */
export function isArchivedRecord(rel: string): boolean {
    const base = rel.replace(/\\/g, '/').split('/').pop() ?? '';
    return base.endsWith('-review.md') && !base.endsWith('.findings.md');
}

export interface CheckOptions {
    repo: string;
}

/** Contract §2.7: every row of an archived record is terminal, with its reference. */
export function checkRecord(rel: string, text: string, _opts: CheckOptions): Violation[] {
    const violations: Violation[] = [];
    const parsed = parseArtifact(text);
    for (const row of parsed.rows) {
        const where = `row ${row.index} (line ${String(row.line)})`;
        if (row.status === 'open') {
            violations.push({
                kind: 'open-in-archived-record',
                file: rel,
                detail:
                    `${where}: status \`open\` in an ARCHIVED record. Renaming a round out of the ` +
                    '`*.findings.md` glob asserts it is closed, so every row must already be terminal ' +
                    '(`fixed` / `accepted-risk` / `deferred`) — contract §2.7.',
            });
            continue;
        }
        if (!TERMINAL.has(row.status)) {
            violations.push({
                kind: 'bad-status',
                file: rel,
                detail: `${where}: unknown status \`${row.status}\` — expected fixed / accepted-risk / deferred.`,
            });
            continue;
        }
        if (row.reasonRef.trim() === '') {
            violations.push({
                kind: 'missing-reference',
                file: rel,
                detail: `${where}: status \`${row.status}\` requires a Reason/Ref, which is empty.`,
            });
        }
    }
    return violations;
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let repo = process.cwd();
    let root = REVIEWS_ROOT;
    let quiet = false;
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        if (a === '--repo') repo = args[++i] as string;
        else if (a === '--reviews-root') root = args[++i] as string;
        else if (a === '--quiet') quiet = true;
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: check_review_dispositions [--repo PATH] [--reviews-root PATH] [--quiet]\n');
            process.stdout.write('scanned: 0\n');
            return 0;
        }
    }

    const abs = path.resolve(repo, root);
    let files: string[] = [];
    try {
        files = fs
            .readdirSync(abs, { withFileTypes: true })
            .filter((e) => e.isFile() && isArchivedRecord(e.name))
            .map((e) => path.join(root, e.name))
            .sort();
    } catch {
        // Absent root: report it as a DEAD SCOPE below rather than a clean pass.
        files = [];
    }

    try {
        assertScanned({
            gate: 'check_review_dispositions',
            scanned: files.length,
            units: 'archived review record(s)',
            roots: [root],
        });
    } catch (exc) {
        // A dead scan scope is a POLICY violation (exit 1), never an internal
        // error: exit 2 is warn-and-allow at every call site, so a moved reviews
        // root would silently degrade this gate to advisory.
        process.stdout.write('scanned: 0\n');
        process.stderr.write(`❌  ${exc instanceof DeadScopeError ? exc.message : String(exc)}\n`);
        return 1;
    }

    const violations: Violation[] = [];
    let scanned = 0;
    try {
        for (const rel of files) {
            const text = fs.readFileSync(path.resolve(repo, rel), 'utf-8');
            scanned += 1;
            violations.push(...checkRecord(rel, text, { repo }));
        }
    } catch (exc) {
        process.stdout.write(`scanned: ${String(scanned)}\n`);
        process.stderr.write(
            `❌  check_review_dispositions: internal error after ${String(scanned)} record(s): ` +
                `${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    if (violations.length > 0) {
        process.stdout.write(`❌  ${String(violations.length)} disposition violation(s):\n\n`);
        for (const v of violations) {
            process.stdout.write(`  ${v.kind} — ${v.file}\n    │ ${v.detail}\n`);
        }
    } else if (!quiet) {
        process.stdout.write(`✅  Archived review records all terminal (${String(scanned)} record(s) scanned).\n`);
    }
    process.stdout.write(`scanned: ${String(scanned)}\n`);
    return violations.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}
