#!/usr/bin/env tsx
/**
 * Freshness check for the committed originality report.
 *
 * `agents/reports/originality.{json,md}` is a committed artefact that nothing
 * regenerates on a schedule, and the report itself "blocks NOTHING on its own" —
 * so it can drift silently. It did: on 2026-07-31 the committed copy read 507
 * artifacts while the identical corpus produced 508, meaning it predated an
 * artefact and nobody noticed.
 *
 * This check regenerates the report, compares it against the committed bytes,
 * restores the committed bytes either way, and **always exits 0**. Warning, not
 * a gate — the report's non-blocking character is deliberate, and turning a
 * stale doc into a red build would be a worse trade than a visible warning.
 *
 * Restoring is what keeps it safe to run inside a pipeline: the working tree is
 * byte-identical afterwards, so no later step sees a spurious diff.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { main as runOriginality } from './lint_originality.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REPORTS = [
    path.join(REPO_ROOT, 'agents', 'reports', 'originality.json'),
    path.join(REPO_ROOT, 'agents', 'reports', 'originality.md'),
];

/** `null` for a report that is not committed yet — absence is not drift. */
function snapshot(files: readonly string[]): Map<string, Buffer | null> {
    const out = new Map<string, Buffer | null>();
    for (const f of files) {
        try {
            out.set(f, fs.readFileSync(f));
        } catch {
            out.set(f, null);
        }
    }
    return out;
}

/**
 * Put the committed bytes back. Best-effort per file and never throwing: this
 * check runs inside pipelines, so a restore failure (read-only mount, a
 * concurrent writer) must not become the exception that fails the build for an
 * advisory. A file it could not restore is named loudly instead — that is the
 * one case where the tree is left dirty, and the reader has to know.
 */
function restore(before: Map<string, Buffer | null>): void {
    for (const [f, buf] of before) {
        try {
            if (buf === null) {
                fs.rmSync(f, { force: true });
            } else {
                fs.writeFileSync(f, buf);
            }
        } catch (err) {
            const why = err instanceof Error ? err.message : String(err);
            process.stdout.write(
                `⚠️  could not restore ${f} after the freshness sweep: ${why}\n` +
                    '    The working tree now holds a REGENERATED report. Restore it with\n' +
                    `    \`git checkout -- ${f}\` if that was not intended.\n`,
            );
        }
    }
}

export function checkFreshness(files: readonly string[] = REPORTS): {
    drifted: string[];
    missing: string[];
} {
    const before = snapshot(files);
    try {
        runOriginality(['--quiet']);
    } catch {
        // A sweep that cannot run is not a drift signal; leave the tree as found.
        restore(before);
        return { drifted: [], missing: [] };
    }
    const drifted: string[] = [];
    const missing: string[] = [];
    for (const [f, buf] of before) {
        let now: Buffer | null;
        try {
            now = fs.readFileSync(f);
        } catch {
            now = null;
        }
        if (buf === null) {
            if (now !== null) missing.push(f);
            continue;
        }
        if (now === null || !now.equals(buf)) drifted.push(f);
    }
    restore(before);
    return { drifted, missing };
}

export function main(): number {
    const { drifted, missing } = checkFreshness();
    const rel = (f: string): string => path.relative(REPO_ROOT, f);

    if (missing.length > 0) {
        process.stdout.write(
            `⚠️  originality report is not committed yet: ${missing.map(rel).join(', ')}\n` +
                '    Run `./scripts-run src/scripts/lint_originality` and commit the result.\n',
        );
    }
    if (drifted.length === 0 && missing.length === 0) {
        process.stdout.write('✅  originality report is fresh.\n');
        return 0;
    }
    if (drifted.length > 0) {
        process.stdout.write(
            `⚠️  originality report is STALE: ${drifted.map(rel).join(', ')}\n` +
                '    Regenerating from the current corpus produces different bytes, so the\n' +
                '    committed numbers describe an older corpus. Not a build failure — this\n' +
                '    report blocks nothing on its own — but the counts should not be quoted\n' +
                '    until refreshed: `./scripts-run src/scripts/lint_originality`.\n',
        );
    }
    // Always 0: this is a warning surface by design.
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
