/**
 * How much of a release the self-review actually read, stated where the record
 * is read.
 *
 * `self_review_gate` writes a `coverage` block — `{chunks, filesReviewed,
 * filesTotal, unreviewed[]}` — into the findings artifact, `--ingest` carries it
 * into the per-release ledger named by {@link LEDGER_DIR}, and from there NOBODY
 * reads `filesReviewed` back. The 16.2.0 ledger records `filesReviewed: 65,
 * filesTotal: 678`: the review saw under a tenth of the change. Every consumer
 * of that record — the disposition gate's success line, the release-highlights
 * gate, a human opening the file — saw output that said nothing about it.
 *
 * A finding count over 9.6 % of a diff and the same count over all of it are
 * different claims, and the record spelled them identically.
 *
 * A LABEL, NEVER A FLOOR, and the distinction is the decision.
 *
 * Nothing here refuses. `coverageLabel` returns a string or `null`; no caller
 * turns it into an exit code, and none may. Raising what a review reads costs
 * one more paid model request per chunk per cut, which is a spend decision
 * belonging to the owner. A gate that failed a cut on partial coverage would
 * force that decision through the back door — the operator would either pay or
 * be unable to release — which is exactly the move the roadmap's decision D1
 * records as rejected.
 *
 * The honest cost of that choice, stated rather than left to be discovered: a
 * release can ship with 9.6 % coverage and this module will only have said so.
 * Saying so is the whole claim.
 *
 * It lives in its own module because two consumers read it — `check_finding_dispositions` on the ledger and
 * `check_release_highlights` beside the Known-limitations field — and a label
 * the two spell differently is a label a reader cannot compare across the two
 * places they meet it. One definition is also the seam the unit tests use, so
 * the arithmetic is checked without either CLI in the loop.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Where the per-release ledgers live, relative to the repository root. */
export const LEDGER_DIR = path.join('agents', 'evidence', 'release-findings');

/**
 * The coverage block as the gate writes it. Every field optional: this type
 * describes an artifact read back off disk, which may be from an older writer
 * or hand-edited, so the reader's job is to decide whether it can answer rather
 * than to assume it can.
 */
export interface ReviewCoverage {
    readonly chunks?: unknown;
    readonly filesReviewed?: unknown;
    readonly filesTotal?: unknown;
    readonly unreviewed?: unknown;
}

function _finite(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * The one sentence both gates print, or `null` when there is nothing to say.
 *
 * `null` covers three cases deliberately collapsed into one, because they lead
 * to the same output: full coverage (nothing to warn about), an absent block (an
 * older ledger, written before the gate recorded coverage), and a malformed one
 * (a string where a number belongs, a zero total). A reader who sees no label
 * learns "this record makes no partial-coverage claim" — which is true of all
 * three — and never a fabricated percentage derived from a field that was not
 * a number.
 *
 * `filesTotal === 0` is `null` rather than `0 of 0 (partial)`: a change set with
 * no files was fully read by any definition, and dividing by it says nothing.
 */
export function coverageLabel(coverage: unknown): string | null {
    if (coverage === null || typeof coverage !== 'object') {
        return null;
    }
    const c = coverage as ReviewCoverage;
    const reviewed = _finite(c.filesReviewed);
    const total = _finite(c.filesTotal);
    if (reviewed === null || total === null || total <= 0 || reviewed >= total) {
        return null;
    }
    return `self-review read ${String(reviewed)} of ${String(total)} changed files (partial)`;
}

/**
 * The `coverage` block of a committed ledger, or `undefined`.
 *
 * Never throws. A missing ledger is the normal state of an in-flight release and
 * a corrupt one is already the business of the gate that parses it properly —
 * a label is not the place to discover either, and a reader that threw here
 * would turn an informational line into a crash on a release branch.
 */
export function readLedgerCoverage(root: string, release: string): unknown {
    const file = path.join(root, LEDGER_DIR, `${release}.json`);
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (parsed === null || typeof parsed !== 'object') {
            return undefined;
        }
        return (parsed as Record<string, unknown>)['coverage'];
    } catch {
        return undefined;
    }
}

/** `coverageLabel` over the committed ledger for `release`. */
export function ledgerCoverageLabel(root: string, release: string): string | null {
    return coverageLabel(readLedgerCoverage(root, release));
}

/**
 * The same label as a Known-limitations line, for the release-highlights gate.
 *
 * It carries the label plus the sentence that keeps a reader from mistaking it
 * for a refusal, because the field it prints beside is one the gate CAN refuse
 * on. Without that sentence the next person to read the output reasonably
 * concludes the gate is about to start failing cuts on coverage, and the cheapest
 * way to make the message go away becomes raising the ceiling — which is the
 * owner's spend decision, taken by whoever happened to read the line.
 *
 * Returns `null` when there is nothing to say, so the caller prints nothing
 * rather than a reassuring sentence about a number it does not have.
 */
export function coverageLimitationNote(label: string | null): string | null {
    if (label === null) {
        return null;
    }
    return (
        `ℹ️  ${label} — a limitation of the RECORD, not a verdict on the release. ` +
        'Stated, never enforced:\n    what the review reads is a spend decision and this ' +
        'gate does not take it.'
    );
}
