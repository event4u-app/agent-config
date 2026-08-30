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
 *   a reviewer has to read. A deny entry names a source; a shape match guesses
 *   at one.
 * - **The deny entries are REGEXES, not literals, and that is deliberate.** A
 *   cross-model review recommended escaping their metacharacters to make them
 *   exact-match. Measured before acting: 13 of the 65 shipped entries use `\b`
 *   word boundaries, so escaping would turn a working boundary assertion into a
 *   literal backslash-b and those 13 would stop matching entirely. More
 *   importantly the GATE compiles them as regexes too, so escaping here would
 *   make the redactor MISS tokens the gate still catches — a file that fails
 *   the gate and that this module declined to clean. Matching the gate exactly
 *   is the invariant; an earlier version of this docstring called the set
 *   "exact-match", which was simply wrong.
 * - It does not preserve length or reversibility. The marker is deliberately
 *   fixed-width and opaque: a length-preserving redaction leaks the length.
 *
 * ## The evidence chain stays intact
 *
 * Redaction is **token-local**: it replaces matched spans and leaves every other
 * byte alone, so a reviewer reading `diff.patch` sees the same hunks, the same
 * paths and the same context. It is NOT *line*-local — an earlier docstring
 * claimed that, and it was false: the matcher runs over the whole string, and a
 * deny pattern permitting `\s` could span a newline. Nothing in the shipped set
 * does today, but the guarantee is written to match the code rather than the
 * intention. The count of redactions is returned so a caller can record it
 * rather than silently changing what it wrote.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isNonHarvestTmpDir, isOpaqueRoundId, sourceHeaderHits } from './source_shape.js';

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
    // Longest source first. Applying patterns SEQUENTIALLY lets a shorter one
    // consume the head of a longer token and leave its tail in the clear: a
    // `\b`-bounded entry can fire INSIDE a longer hyphenated entry, because a
    // hyphen is a word boundary, so the naive order emits
    // `[REDACTED:src-conf]-<tail>` — a partial disclosure that still names the
    // source. **Two such pairs exist in the shipped set today** (verified by
    // scanning the config; the pairs are deliberately not quoted here, because
    // naming them is the disclosure this module exists to prevent). This is a
    // live defect, not a hypothetical. Ordering feeds the alternation below,
    // where
    // JS picks the first alternative that matches at a position, so
    // longest-first approximates longest-match.
    //
    // `g` so every occurrence is replaced, `i` to match the gate.
    return [...data.deny]
        .sort((a, b) => b.length - a.length)
        .map((p) => new RegExp(p, 'gi'));
}

/**
 * Combine the patterns into ONE alternation, preserving their order.
 *
 * Sequential application is what produces the partial-exposure defect above:
 * each pass rewrites the output of the last, so an earlier pattern can destroy
 * a later one's match. A single alternation makes every position decided once,
 * against all patterns at the same time.
 *
 * Safe here because no shipped entry is anchored (`^`/`$`) — checked, 0 of 65 —
 * and none carries a capturing group, so joining cannot change what any
 * individual pattern means or shift a group index.
 */
function combine(patterns: RegExp[]): RegExp {
    return new RegExp(patterns.map((rx) => `(?:${rx.source})`).join('|'), 'gi');
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
    if (patterns.length === 0) {
        return { text, count: 0 };
    }
    const rx = combine(patterns);
    // A `g` RegExp carries lastIndex across calls; reset before use so the same
    // compiled set can be reused across many files.
    rx.lastIndex = 0;
    let count = 0;
    const out = text.replace(rx, () => {
        count += 1;
        return REDACTION_MARKER;
    });
    return { text: out, count };
}

/**
 * Neutralise attribution SHAPE in a derived snapshot — the half a deny set
 * cannot reach.
 *
 * MEASURED, not anticipated. Committing the first review snapshot taken AFTER
 * road-to-source-silence Phase 2.1 raised the shrink-only shape ratchet by 19,
 * and the cause is structural rather than a bug in either mechanism: a change
 * that REMOVES speaking references produces a diff whose PREIMAGE lines still
 * carry them. Those lines have no counterpart in the current tree, so the
 * provenance-aware dedup in `source_snapshot_dedup.ts` correctly refuses to
 * exclude them — "deleted-only findings stay at block" is exactly what the AI
 * council required of that rule, and it did its job.
 *
 * The fix therefore belongs HERE, at write time, not there. A snapshot is a
 * DERIVED artefact: the evidence it must preserve is the shape of the change,
 * never the identifier. Replacing a speaking round name inside it with the
 * marker keeps the diff readable as a diff and removes the republication —
 * which is the same trade Phase 2.1 makes for tracked content.
 *
 * Two classes, both narrowed to the value rather than the line:
 *
 * - a non-opaque `agents/tmp(.old)/<name>/` quote — the directory name only, so
 *   the path stays recognisable as an inbox path;
 * - a speaking `> **Source:**` header value that is neither `ENC1:` nor an
 *   opaque round id.
 *
 * A name that is already opaque, an `ENC1:` token, and a named working set are
 * all left alone — the predicates come from `_lib/source_shape.ts`, so this
 * redactor and the gate cannot disagree about what counts as speaking.
 */
export function redactSourceShape(text: string): RedactionResult {
    let count = 0;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        let line = lines[i] as string;

        // tmp-quote: rewrite the DIRECTORY NAME, keep the path shape.
        line = line.replace(/(agents\/tmp(?:\.old)?\/)([A-Za-z0-9._-]+)(\/)/g, (whole, pre: string, name: string, post: string) => {
            if (isOpaqueRoundId(name) || isNonHarvestTmpDir(name)) {
                return whole as string;
            }
            count += 1;
            return pre + REDACTION_MARKER + post;
        });

        // source-header: rewrite the VALUE, keep the header. The decision is
        // DELEGATED to `sourceHeaderHits` — the gate's own predicate — rather
        // than re-implemented here. Two reasons, and the second was a real bug
        // this test suite caught: agreement with the gate is then structural
        // rather than maintained by hand, and re-deriving the "is this value
        // acceptable" list independently made the redactor NON-IDEMPOTENT. It
        // re-redacted its own marker, because the gate's value normaliser
        // strips `[` and `]` and a hand-written `value.includes(MARKER)` check
        // therefore never matched. A redactor that does not converge rewrites
        // the artefact on every dispatch.
        const hdr = /^(\s*(?:>\s*)?\*\*Source\*?\*?:?\*{0,2}\s*:?\s*)(\S.*)$/.exec(line);
        if (hdr && sourceHeaderHits(line).length > 0) {
            count += 1;
            line = (hdr[1] as string) + REDACTION_MARKER;
        }

        lines[i] = line;
    }
    return { text: lines.join('\n'), count };
}

/**
 * Write `text` to `dest`, redacted. Returns the number of substitutions so the
 * caller can surface it; a silent redaction is a changed artefact nobody was
 * told about.
 *
 * Both passes run: the deny set (names somebody listed) and the shape classes
 * (form, independent of any list). Neither subsumes the other, which is the
 * whole reason the gate carries both.
 */
export function writeRedacted(dest: string, text: string, patterns: RegExp[]): number {
    const tokens = redactSourceTokens(text, patterns);
    const shaped = redactSourceShape(tokens.text);
    fs.writeFileSync(dest, shaped.text, 'utf-8');
    return tokens.count + shaped.count;
}
