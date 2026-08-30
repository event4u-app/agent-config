// Phase 1B — inline findings, the whole concern in one module.
//
// The consensus round's pass 1 asks every member a SECOND time, in a separate
// paid call, to restate its own analysis as a JSON findings array. Phase 1B of
// `road-to-inbox-harvest-2026-08-e-council-topology-evidence` asks for that
// array in the FIRST reply instead, and keeps the extraction call as the
// repair path.
//
// It lives here rather than spread across `orchestrator.ts`, `consensus.ts` and
// `council_cli.ts` for a reason the source-size budget made concrete: all three
// are far past the 1500-line ceiling, so a new concern added to them is new
// budget excess with nowhere to go. Concentrating it also puts the four pieces
// that have to agree — the contract text's promise, the locator, the harvest
// and the config predicate — where a reader meets them together.
import type { ExternalAIClient, CouncilResponse } from './clients.js';
import type { Finding, FindingsExtraction } from './consensus.js';
import { _BARE_ARRAY_SRC, _JSON_BLOCK_SRC, parse_findings_outcome } from './consensus.js';
import { INLINE_FINDINGS_CONTRACT, STANCE_LINE_CONTRACT } from './prompts.js';

/** Python `str.strip()` parity, as everywhere else in this package. */
const _strip = (s: string): string => s.replace(/^\s+|\s+$/g, '');

/**
 * Phase 1B — the deliberation reply split into argument and findings block.
 *
 * `deliberation_text` is what every downstream consumer should see: peer
 * review, chairman synthesis, and the rendered artefact evaluate the member's
 * REASONING, and a schema block restating selected conclusions is scaffolding,
 * not argument. Leaving it in amplifies a concise finding simply because it
 * appears twice — the AI council's stated reason (2026-08-30, 2 of 2 seats) for
 * choosing to strip.
 *
 * `block` is the exact consumed span. One locator produces both halves, so the
 * text that is parsed and the text that is removed cannot disagree — the
 * council's other requirement, and the reason there is no separate
 * "find and remove a JSON fence" function anywhere in this change.
 */
export interface InlineFindingsSplit {
    /** The reply with the consumed block removed. Equals the input when `found` is false. */
    readonly deliberation_text: string;
    /** The consumed span, ready for `parse_findings_outcome`. `''` when `found` is false. */
    readonly block: string;
    readonly found: boolean;
}

/**
 * Split a full analysis reply at its TRAILING findings block.
 *
 * A locator, deliberately not a second parser: `parse_findings_outcome` stays
 * the only thing that decides whether a candidate IS a findings block, and this
 * narrows where it looks.
 *
 * The narrowing is not cosmetic. `_extract_json_array` returns the FIRST match,
 * which is correct for an extraction reply (the reply IS the array) and wrong
 * for an analysis reply, where the prose above may legitimately quote a JSON
 * array — the analysis lens exists to critique analyser OUTPUT, so a quoted
 * array is an ordinary thing to find there. First-match would read the quoted
 * array as the member's findings and never reach the real block.
 *
 * `INLINE_FINDINGS_CONTRACT` asks for the block LAST, so LAST is what this
 * reads. `found: false` when nothing array-shaped is present, which the caller
 * treats as "no inline block" and repairs with the extraction call — the same
 * outcome as today, never worse.
 */
export function split_inline_findings(text: string): InlineFindingsSplit {
    const none: InlineFindingsSplit = { deliberation_text: text, block: '', found: false };
    if (!text) {
        return none;
    }
    // Deliberately the same two patterns `_extract_json_array` uses, in the same
    // precedence order — fenced beats bare — so a block this locator returns is
    // one that function can also read. Only the match SELECTION differs: last,
    // not first.
    for (const src of [_JSON_BLOCK_SRC, _BARE_ARRAY_SRC]) {
        const re = new RegExp(src, 'gs');
        let last: RegExpExecArray | null = null;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            last = m;
            // A zero-length match would spin forever; the patterns cannot produce
            // one (both require at least `[]`), but the guard costs nothing and a
            // future pattern edit is exactly when it would matter.
            if (m.index === re.lastIndex) {
                re.lastIndex += 1;
            }
        }
        if (last) {
            const start = last.index;
            const end = start + last[0].length;
            return {
                deliberation_text: `${text.slice(0, start)}${text.slice(end)}`,
                block: text.slice(start, end),
                found: true,
            };
        }
    }
    return none;
}

/**
 * How a member's findings were obtained — the RECORDED provenance, wider than
 * `FindingsParseOutcome`, which describes one parse of one piece of text.
 *
 * Typed rather than a bare string because Phase 1B's promotion gate is computed
 * off exactly these values: an untyped `Map<string, string>` makes the number
 * that decides the experiment vulnerable to a misspelling no compiler would
 * catch. The AI council (2026-08-30, 2 of 2 seats) called the pre-existing bare
 * `'parsed-after-reask'` technical debt rather than a precedent to extend.
 *
 * `'parsed'` keeps its shipped meaning — read from the separate extraction
 * call — and is unambiguous now that `'parsed-inline'` names the other source.
 * One seat asked for a rename to `'parsed-extraction'`; renaming a value that
 * is already recorded and compared against is a separate change with its own
 * migration, and is recorded here as declined-with-a-reason, not overlooked.
 */
export type RecordedExtractionOutcome =
    | 'parsed'
    | 'empty'
    | 'parse_failed'
    | 'parsed-after-reask'
    | 'parsed-inline';

/**
 * Phase 1B — harvest the inline findings block out of each deliberation reply.
 *
 * Runs BETWEEN the deliberation and every consumer of its text. That placement
 * is the load-bearing part and it was a defect the AI council caught
 * (2026-08-30, 2 of 2 seats): peer review and chairman synthesis read the
 * responses BEFORE the consensus round does, so parsing inside
 * `run_consensus_scoring` would have left the schema block in the text those
 * two evaluate — which is precisely the amplification the strip exists to
 * prevent.
 *
 * MUTATES `text` on each response whose block parsed, replacing the consumed
 * span with a one-line marker. Mutation rather than a parallel clean copy
 * because two representations of one response means every downstream consumer
 * has to know which one it holds, and the one that forgets is a silent bug.
 * `CouncilResponse.text` is already mutated on the stance-repair path, so this
 * is the established seam rather than a new one.
 *
 * The marker is deliberately visible. Stripping without an observable trace is
 * a silent mutation of the artefact a reader takes for a transcript, and one
 * seat made an observable marker a condition of its verdict; the other reached
 * the same concern from the auditability side. ~90 characters replaces ~300 of
 * JSON, so the scaffolding is gone and the fact of its removal is not.
 *
 * Returns the per-member extraction keyed by `provider:model` — the same key
 * `run_consensus_scoring` records outcomes under. A member whose block did not
 * parse gets NO entry and its `text` is left exactly as the model wrote it, so
 * the repair extraction call downstream still sees the raw reply.
 */
export function harvest_inline_findings(
    members: readonly ExternalAIClient[],
    responses: readonly CouncilResponse[],
): Map<string, FindingsExtraction> {
    const out = new Map<string, FindingsExtraction>();
    const model_by_name = new Map<string, string>();
    for (const m of members) {
        model_by_name.set(m.name, m.model);
    }
    for (const resp of responses) {
        const model = model_by_name.get(resp.provider);
        if (model === undefined || resp.error || !_strip(resp.text)) {
            continue;
        }
        const split = split_inline_findings(resp.text);
        if (!split.found) {
            continue;
        }
        const source = `${resp.provider}:${model}`;
        const ex = parse_findings_outcome(split.block, { source });
        if (ex.outcome !== 'parsed') {
            // Not a findings block after all — most likely a JSON array the member
            // quoted from the artefact. Leave the reply untouched: stripping text
            // we could not read would remove evidence and buy nothing.
            continue;
        }
        out.set(source, ex);
        const marker = `_[inline findings block extracted: ${String(ex.findings.length)} item(s); the raw reply is retained in the session record.]_`;
        resp.text = `${_strip(split.deliberation_text)}\n\n${marker}`;
    }
    return out;
}


/**
 * The FINAL deliberation round's volatile suffix.
 *
 * Two opt-in contracts ride it and their ORDER is load-bearing:
 * `STANCE_LINE_CONTRACT` requires the stance to be the last line of the reply,
 * so it is appended last and the findings block sits above it. A findings block
 * appended after the stance line would contradict the instruction the member is
 * reading, which is the one composition bug this function exists to make
 * impossible to reintroduce.
 *
 * Both off → the caller's suffix is returned unchanged, so the composed default
 * is byte-identical to a run without either feature.
 */
export function composeFinalRoundSuffix(
    suffix: string,
    opts: { is_final: boolean; inline_findings: boolean; stance_tally: boolean },
): string {
    if (!opts.is_final) {
        return suffix;
    }
    let out = suffix;
    if (opts.inline_findings) {
        out = `${out}\n\n---\n\n${INLINE_FINDINGS_CONTRACT}`;
    }
    if (opts.stance_tally) {
        out = `${out}\n\n---\n\n${STANCE_LINE_CONTRACT}`;
    }
    return out;
}

/**
 * Consume a member's harvested findings, or report that it has none.
 *
 * Returns `true` when the caller should SKIP its extraction call. An entry in
 * the map is always a short-circuit and never a partial one, because
 * `harvest_inline_findings` records only a member whose block PARSED — a member
 * with no entry had its reply left raw and takes the shipped extraction path
 * over the full text.
 */
export function takeInlineFindings(
    inline_extractions: ReadonlyMap<string, FindingsExtraction> | null,
    source: string,
    parse_outcomes: Map<string, RecordedExtractionOutcome>,
    all_findings: Finding[],
): boolean {
    const inline = inline_extractions?.get(source);
    if (inline === undefined) {
        return false;
    }
    parse_outcomes.set(source, 'parsed-inline');
    all_findings.push(...inline.findings);
    return true;
}

/**
 * Is the inline-findings contract active for this run?
 *
 * Read BEFORE the deliberation, because the contract is a prompt change and the
 * prompt is built first; the harvest reads the same predicate so the two cannot
 * disagree about whether a member was asked for the block. Three conjuncts, all
 * required: consensus scoring on, this lens in its lens list, and
 * `inline_findings` explicitly on. Any missing → `false`, and `false` is a
 * byte-identical prompt.
 *
 * Reads the SYNTHESISED settings dict, not the typed config. That distinction
 * is not academic: `_lib/council_settings_block.ts` projects the typed config
 * into this dict, and when it did not carry the key a `true` in the YAML
 * resolved to `undefined` and the feature was silently off with every unit test
 * green — found by a live analysis run on 2026-08-30, not by review.
 */
export function inlineFindingsActive(
    ai_cfg: Record<string, unknown>,
    mode: string,
): boolean {
    const cs = (ai_cfg['consensus_scoring'] as Record<string, unknown> | undefined) ?? {};
    if (cs['enabled'] !== true || cs['inline_findings'] !== true) {
        return false;
    }
    const lenses = (cs['lenses'] as string[] | undefined) ?? ['analysis'];
    return lenses.includes(mode);
}
