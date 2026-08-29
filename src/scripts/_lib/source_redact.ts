/**
 * source_redact — write-time deny-set redaction for generated evidence
 * snapshots (`road-to-source-silence` Phase 3.4).
 *
 * ## Why a redactor and not a skip_path
 *
 * The R2 reviewer input package (`<slug>.review-input/`) is a VERBATIM snapshot
 * of a branch diff. A diff that happens to touch a line naming a harvest source
 * carries that name into a tracked evidence file, which is why
 * `agents/evidence/reviews/*.review-input/diff.patch` sat in the gate's
 * `skip_paths` — a blanket exemption over a whole generated class.
 *
 * A blanket exemption is the wrong shape: it does not stop the leak, it stops
 * the gate from seeing it. The generator is the one place that can fix the
 * content instead, because it is the only writer. So the redaction happens at
 * WRITE time and the snapshot stays readable and diffable.
 *
 * ## The exemption is still there, and this docstring will not pretend otherwise
 *
 * Step 3.4's second half — deleting the `skip_paths` entry — is NOT done, and
 * the reason is a measurement that falsified the step's premise. Removing the
 * entry exposed two populations, not one:
 *
 * - **120 exact deny hits**, all in a single snapshot. A backfill run of this
 *   module cleared every one of them (118 substitutions); those names are gone
 *   from the tracked tree permanently. This half worked exactly as designed.
 * - **+26 attribution-SHAPE findings** at the block tier, taking the shrink-only
 *   ratchet from 275 to 301 and reddening CI. Write-time redaction of exact
 *   names cannot clear these, because they are heuristic matches, not names.
 *
 * The AI council (anthropic + openai, 2026-08-29) was asked what to do and
 * **rejected the tempting answer**: tiering `*.review-input/` down to `warn`
 * was refused by both seats as a gate weakening performed by the party that
 * benefits from it, and — the sharper objection — because the claim that all 26
 * findings are mere mirrors of already-counted tracked content was never
 * verified. A diff can carry deleted lines, renamed paths and other preimage
 * content that exists nowhere in the current tree.
 *
 * So the exemption stays, the roadmap step stays honestly open, and the path to
 * closing it is recorded rather than improvised: provenance-aware deduplication
 * that excludes a snapshot finding from the ratchet only when an identical
 * class/value occurrence is independently block-counted in the corresponding
 * current tracked file, with unique, deleted-only, malformed and unverifiable
 * findings all remaining `block`.
 *
 * ## What it does NOT do
 *
 * - It does not touch the live tree. It only rewrites strings a generator is
 *   about to write into an evidence artefact.
 * - It does not redact SHAPE findings (a speaking `**Source:**` header, a
 *   quoted `agents/tmp/<name>/` path). Those are heuristics with a measured
 *   false-positive tail, and redacting on a heuristic silently corrupts a diff
 *   a reviewer has to read. The deny set is an exact-match list; a hit on it is
 *   a name, not a guess.
 * - It does not preserve length or reversibility. The marker is deliberately
 *   fixed-width and opaque: a length-preserving redaction leaks the length.
 *
 * ## The evidence chain stays intact
 *
 * Redaction is line-local and leaves every surrounding byte alone, so a
 * reviewer reading `diff.patch` sees the same hunks, the same paths and the
 * same context; only the token is gone. The count of redactions performed is
 * returned so a caller can record it in the snapshot header rather than
 * silently changing what it wrote.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const CONFIG = path.join(ROOT, 'src', 'scripts', 'external_sources_denylist.json');

/** The marker written in place of a denied token. Fixed width, no length leak. */
export const REDACTION_MARKER = '[REDACTED:src-conf]';

interface DenyConfig {
    deny: string[];
    [k: string]: unknown;
}

/**
 * Compile the deny patterns once. Same source of truth as the gate — a second
 * hand-written copy of the list is exactly the drift this programme exists to
 * remove.
 */
export function loadDenyPatterns(configPath: string = CONFIG): RegExp[] {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as DenyConfig;
    if (!data.deny || data.deny.length === 0) {
        throw new Error('source_redact: empty deny list');
    }
    // `g` so every occurrence on a line is replaced, `i` to match the gate.
    return data.deny.map((p) => new RegExp(p, 'gi'));
}

export interface RedactionResult {
    /** The redacted text. Identical to the input when nothing matched. */
    text: string;
    /** How many substitutions were made, across all patterns. */
    count: number;
}

/**
 * Replace every deny-set hit in `text` with {@link REDACTION_MARKER}.
 *
 * Pure: takes text, returns text. The caller decides what to do with the count.
 */
export function redactSourceTokens(text: string, patterns: RegExp[]): RedactionResult {
    let out = text;
    let count = 0;
    for (const rx of patterns) {
        // A `g` RegExp carries lastIndex across calls; reset before each use so
        // the same compiled pattern can be reused for many files.
        rx.lastIndex = 0;
        out = out.replace(rx, () => {
            count += 1;
            return REDACTION_MARKER;
        });
    }
    return { text: out, count };
}

/**
 * Write `text` to `dest`, redacted. Returns the number of substitutions so the
 * caller can surface it; a silent redaction is a changed artefact nobody was
 * told about.
 */
export function writeRedacted(dest: string, text: string, patterns: RegExp[]): number {
    const { text: redacted, count } = redactSourceTokens(text, patterns);
    fs.writeFileSync(dest, redacted, 'utf-8');
    return count;
}
