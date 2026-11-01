// Option-level stance tally (road-to-opt-council-deliberation Phase 1).
//
// `consensus.ts` scores *findings*; nothing here produces an *option-level*
// verdict for "A or B?" questions. This module engineers Source G's prose
// tally deterministically: parse each member's mandatory final-round stance
// line, weight by confidence, and decide consensus vs. an honest split against
// a ⅔ threshold. Everything countable lands in TS with tests — never inferred
// from prose (an unparseable line is a repair-marker, not a guess).
//
// Default-off behind `ai_council.stance_tally.enabled`; additive — with the key
// false the council path is byte-identical to today.

/** Confidence tier from a stance line. */
export type Confidence = 'high' | 'med' | 'low';

/** Contribution weight per confidence tier (Source G's factors). */
export const CONFIDENCE_FACTOR: Record<Confidence, number> = {
    high: 1.0,
    med: 0.75,
    low: 0.5,
};

/** Consensus requires an option to clear two-thirds of the base-weight total. */
export const CONSENSUS_FRACTION = 2 / 3;

/** The canonical label for an explicit abstention. */
export const ABSTAIN_LABEL = 'abstain';

/** A parsed stance line bound to its member. */
export interface StanceLine {
    member: string; // e.g. "openai:gpt-4o"
    label: string; // canonical (casefolded) key; `abstain` is special
    display: string; // first-seen original label text (rendering)
    confidence: Confidence;
    dealbreaker: boolean;
}

/** Per-option accumulation across members. */
export interface OptionTally {
    label: string; // display label (first-seen casing)
    weight: number; // sum of confidence factors of backers
    backers: Array<{ member: string; confidence: Confidence }>;
    dealbreakers: number;
}

/** The full tally verdict. `consensus` is null on a split — never a forced winner. */
export interface StanceTallyResult {
    options: OptionTally[]; // non-abstain options, weight desc
    w_total: number; // base-weight denominator (every voting member, abstain included)
    threshold: number; // CONSENSUS_FRACTION * w_total
    consensus: OptionTally | null; // the option clearing the threshold, or null
    split: boolean; // true when no option clears the threshold
    abstain_count: number;
    /**
     * Members whose stance line was missing or unparseable. They COUNT toward
     * `w_total` (they responded) and back no option — see the
     * refusal-preservation invariant in `tally_stances`. Surfaced by
     * `render_vote_tally` so a shrunken-signal quorum is visible rather than
     * merely computed.
     */
    needs_repair: string[];
}

// Tolerant of whitespace and case; requires the three explicit fields in order.
// `medium` is accepted as an alias for `med`.
const _STANCE_RE =
    /STANCE:\s*(.+?)\s*\|\s*CONFIDENCE:\s*(high|med(?:ium)?|low)\s*\|\s*DEALBREAKER:\s*(yes|no)/gi;


/** Run the strict stance grammar; return the LAST match or null. */
function _last_stance_match(text: string): RegExpExecArray | null {
    _STANCE_RE.lastIndex = 0;
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = _STANCE_RE.exec(text)) !== null) {
        last = m;
    }
    return last;
}

/**
 * Normalize the two cosmetic defect classes the lenient pass forgives, on
 * lines that mention STANCE only: markdown emphasis characters and comma /
 * semicolon field separators. Everything else is left byte-identical.
 */
export function _normalize_stance_cosmetics(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            if (!/stance/i.test(line)) {
                return line;
            }
            let out = line.replace(/[*_`]/g, '');
            out = out.replace(/\s*[;,]\s*(?=(?:CONFIDENCE|DEALBREAKER)\b)/gi, ' | ');
            return out;
        })
        .join('\n');
}

/**
 * Parse the member's stance line from their reply text. Returns the LAST stance
 * line if several appear (the final, most-authoritative one), or `null` when no
 * well-formed line exists — the caller treats null as a repair-marker and never
 * infers a stance from the surrounding prose.
 */
export function parse_stance_line(text: string): Omit<StanceLine, 'member'> | null {
    let last = _last_stance_match(text);
    if (last === null) {
        // Lenient fallback (A3 repair-tightening): a stance whose only defect
        // is cosmetic — markdown emphasis around the field names (`**STANCE:**`),
        // or `,`/`;` used where the contract says `|` — is NOT "genuinely
        // unparseable" and must not burn a repair call. Normalize those two
        // defect classes on stance-bearing lines only, then re-run the SAME
        // strict grammar. Anything the strict grammar still rejects (missing
        // fields, invalid enum values, no STANCE line at all) stays a repair
        // marker — leniency never invents a stance from prose.
        last = _last_stance_match(_normalize_stance_cosmetics(text));
    }
    if (last === null) {
        return null;
    }
    const rawLabel = (last[1] ?? '').trim();
    if (rawLabel.length === 0) {
        return null;
    }
    let conf = (last[2] ?? '').toLowerCase();
    if (conf === 'medium') {
        conf = 'med';
    }
    return {
        label: rawLabel.toLowerCase(),
        display: rawLabel,
        confidence: conf as Confidence,
        dealbreaker: (last[3] ?? '').toLowerCase() === 'yes',
    };
}

/**
 * Tally option-level stances across members. Base weight is 1.0 per member;
 * `W_total` sums those base weights over every member with a parseable stance
 * (abstentions included — they raise the bar without backing any option). An
 * option's weight is the sum of its backers' confidence factors. Consensus iff
 * the leading option's weight ≥ ⅔ × W_total; otherwise a structured split is
 * returned — never a forced winner, never an auto-added round.
 */
export function tally_stances(
    members: ReadonlyArray<{ member: string; text: string }>,
): StanceTallyResult {
    const parsed: StanceLine[] = [];
    const needs_repair: string[] = [];
    for (const { member, text } of members) {
        const p = parse_stance_line(text);
        if (p === null) {
            needs_repair.push(member);
            continue;
        }
        parsed.push({ member, ...p });
    }

    // ── Refusal-preservation invariant (road-to-governance-invariants P2) ──
    //
    // Selection may never rank an option higher *because* a member refused
    // less. A safety refusal is not a scored-down property, and — measured by
    // spike S0.1 — the way this engine could be steered was not a weight but a
    // DENOMINATOR: `w_total` once counted only members whose stance line
    // parsed, so a refusal phrased as prose ("I will not answer this") vanished
    // from the quorum and made consensus EASIER. Same two backers, margin
    // −0.25 and no consensus when the refusal parsed as an abstention;
    // +0.4167 and consensus when it did not parse. Δ 0.6667, outcome flipped.
    //
    // The fix is structural rather than a new gate: a member who RESPONDED
    // counts toward the quorum whether or not its stance line parsed. It backs
    // no option either way, so an unparseable response now behaves exactly like
    // an abstention — the fail-safe direction. Members who never responded are
    // dropped upstream (`!r.error`) and are correctly absent from `members`.
    const w_total = parsed.length + needs_repair.length; // responded, abstain + unparseable included
    const threshold = CONSENSUS_FRACTION * w_total;
    let abstain_count = 0;

    const byLabel = new Map<string, OptionTally>();
    for (const p of parsed) {
        if (p.label === ABSTAIN_LABEL) {
            abstain_count += 1;
            continue;
        }
        let o = byLabel.get(p.label);
        if (o === undefined) {
            o = { label: p.display, weight: 0, backers: [], dealbreakers: 0 };
            byLabel.set(p.label, o);
        }
        o.weight += CONFIDENCE_FACTOR[p.confidence];
        o.backers.push({ member: p.member, confidence: p.confidence });
        if (p.dealbreaker) {
            o.dealbreakers += 1;
        }
    }

    const options = [...byLabel.values()].sort(
        (a, b) => b.weight - a.weight || a.label.localeCompare(b.label),
    );
    const top = options[0] ?? null;
    // Strict-≥ against the threshold; a floating-point epsilon guards the
    // exact-boundary case (e.g. 2.0 ≥ ⅔×3) from representation drift.
    const consensus = top !== null && top.weight + 1e-9 >= threshold ? top : null;

    return {
        options,
        w_total,
        threshold,
        consensus,
        split: consensus === null,
        abstain_count,
        needs_repair,
    };
}

/**
 * Render the **Vote Tally** verdict section: one line per option, the threshold,
 * and a cleared-or-escalated line. Deterministic — pure projection of the tally.
 */
/**
 * Tally the stance lines of a finished round, or `null` when tallying is off.
 *
 * Wraps the member-shape mapping so a caller does not re-derive it: an errored
 * response has no stance line to read, and the member key is
 * `provider:model` because that is what `parse_stance_line` records. Exists so
 * ONE tally is computed per pass and reused — two tallies over the same
 * responses are two chances to disagree, and the attendance event and the
 * handoff envelope both consume this one.
 */
export function tallyFromResponses(
    responses: ReadonlyArray<{ provider: string; model: string; text: string; error?: string | null }>,
    enabled: boolean,
): StanceTallyResult | null {
    if (!enabled) {
        return null;
    }
    return tally_stances(
        responses.filter((r) => !r.error).map((r) => ({ member: `${r.provider}:${r.model}`, text: r.text })),
    );
}

export function render_vote_tally(result: StanceTallyResult): string {
    const lines: string[] = ['### Vote Tally'];
    if (result.options.length === 0) {
        lines.push('- (no option-level stances parsed)');
    }
    for (const o of result.options) {
        const backers = o.backers.map((b) => `${b.member} (${b.confidence})`).join(', ');
        const db = o.dealbreakers > 0 ? ` · ${o.dealbreakers} dealbreaker(s)` : '';
        lines.push(`- ${o.label} — ${o.weight.toFixed(2)} (${backers})${db}`);
    }
    if (result.abstain_count > 0) {
        lines.push(`- abstain — ${result.abstain_count} member(s) (raises the bar)`);
    }
    // Refusal divergence, as an OBSERVATION and never a selection input
    // (road-to-governance-invariants P2). A member whose stance did not parse
    // still counts toward the quorum; saying so here is what makes a shrunken
    // signal visible to a reader instead of merely present in a struct field
    // no caller reads. Nothing in the tally consumes this string.
    if (result.needs_repair.length > 0) {
        lines.push(
            `- unparsed — ${result.needs_repair.length} member(s) responded without a ` +
                `readable stance (${result.needs_repair.join(', ')}); counted in the ` +
                'quorum, backing nothing',
        );
    }
    lines.push(`Threshold: ⅔ × ${result.w_total} = ${result.threshold.toFixed(2)}`);
    lines.push(
        result.consensus !== null
            ? `Cleared: ${result.consensus.label} (${result.consensus.weight.toFixed(2)})`
            : 'Escalated: no option cleared the threshold — the split is returned to the user, not forced.',
    );
    if (result.needs_repair.length > 0) {
        lines.push(`Unparsed stance (repair needed): ${result.needs_repair.join(', ')}`);
    }
    return lines.join('\n');
}
