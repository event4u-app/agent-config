/**
 * What is left of the release's side of the findings ledger: where a ledger
 * lives, and the `Known limitations` line a cut on an override owes.
 *
 * A release no longer reads the ledger. Every commit on main is already
 * reviewed and merged, so the cut waits for no review (owner, 2026-10-22);
 * the 17.0.0 cut stopped for a day on a ledger whose self-review never
 * finished. The self-review and `check_finding_dispositions` stay available
 * as advisory tools.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';


/** Where a release's ledger lives, relative to the repository root. */
export function ledgerRelPath(version: string): string {
    return `agents/evidence/release-findings/${version}.json`;
}

/**
 * The `Known limitations` line a cut taken on an override owes its readers.
 *
 * An override is the one way a release ships without having reviewed itself,
 * and it is recorded where only a releaser looks — inside the ledger JSON. A
 * consumer reading the published notes would see a release indistinguishable
 * from one that passed its self-review, which is the same silence-reads-as-
 * acceptance defect `assurance` was added to end one layer down.
 *
 * Returns null for every ordinary release: no ledger, a reviewed one, or one
 * carrying no override. The caller appends; it never replaces a derived line.
 */
export function assuranceOverrideLimitation(version: string, repoRoot: string): string | null {
    const abs = path.join(repoRoot, ledgerRelPath(version));
    if (!fs.existsSync(abs)) {
        return null;
    }
    let ledger: { assurance?: unknown; assurance_override?: unknown };
    try {
        ledger = JSON.parse(fs.readFileSync(abs, 'utf-8')) as typeof ledger;
    } catch {
        // A malformed ledger is the disposition gate's finding, not this line's.
        return null;
    }
    // Printed into public release notes: one line, no markdown, bounded. Whether
    // it names a committed directive is check_finding_dispositions' to refuse.
    const override = typeof ledger.assurance_override === 'string'
        ? ledger.assurance_override.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[`*[\]<>|#!]/g, '').trim().slice(0, 200)
        : '';
    if (override === '' || String(ledger.assurance ?? '').trim() !== 'unreviewed') {
        return null;
    }
    return (
        `This release was cut without a self-review: nothing reviewed ${version}, and the cut `
        + `was taken on an owner directive recorded at ${override}.`
    );
}
