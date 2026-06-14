// Decision-replay artefact for council sessions (Phase 9) — TypeScript twin
// (py2ts Phase 1).
//
// Produces a per-session `decision-replay.md` that surfaces the audit
// trail GPT review of PR #148 called out as missing: for each top
// finding, the consensus_strength, agreeing-members with their key
// argument, dissenting-members with their counter-argument, the
// evidence-quality verdict, and a final synthesis verdict line.
//
// The artefact is a pure projection of the consensus data plus the
// per-member deliberation texts — no extra model calls. Schema is
// documented in `docs/contracts/ai-council-config.md` under
// "Decision-replay schema".
//
// Parity notes (ADR-096):
// - `" ".join(text.split())` collapses any run of Unicode whitespace to a
//   single space and drops leading/trailing whitespace — `_pyJoinSplit`
//   mirrors Python `str.split()` (no-arg) + `" ".join(...)`.
// - Truncation `flat[:N].rstrip() + "…"` slices by CODE POINT then strips
//   trailing whitespace — `_pyTruncate` reproduces both.
// - `f"{x:.2f}"` / `f"{x:.1f}"` → `_pyFixed` (round-half-to-even), matching
//   CPython float formatting.
// - `sorted(..., reverse=True)` is a STABLE sort in CPython; JS
//   `Array.prototype.sort` is stable in modern engines, and the comparator
//   is written to keep equal keys in input order.
// - The trailing `"\n".join(lines).rstrip() + "\n"` is reproduced verbatim.

import type { CouncilResponse } from './clients.js';
import { ConsensusMetadata, type Finding, type FindingScore } from './consensus.js';

/**
 * Bundle accepted by {@link render_decision_replay}.
 *
 * `include_member_arguments` toggles the redacted-vs-full output. When
 * `false` the artefact emits consensus + dissent COUNT only — no per-member
 * arguments — for sharing without leaking which model framed which point.
 */
export class DecisionReplayInputs {
    readonly findings: readonly Finding[];
    readonly scores: readonly FindingScore[];
    readonly metadata: Map<string, ConsensusMetadata> | Record<string, ConsensusMetadata>;
    readonly deliberation: readonly CouncilResponse[]; // last-round per-member texts
    readonly original_ask: string;
    readonly include_member_arguments: boolean;

    constructor(args: {
        findings: readonly Finding[];
        scores: readonly FindingScore[];
        metadata: Map<string, ConsensusMetadata> | Record<string, ConsensusMetadata>;
        deliberation: readonly CouncilResponse[];
        original_ask?: string;
        include_member_arguments?: boolean;
    }) {
        this.findings = args.findings;
        this.scores = args.scores;
        this.metadata = args.metadata;
        this.deliberation = args.deliberation;
        this.original_ask = args.original_ask ?? '';
        this.include_member_arguments = args.include_member_arguments ?? true;
    }
}

/** Mirror Python `len(str)` — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/**
 * Mirror Python `" ".join(text.split())` — split on runs of (Unicode)
 * whitespace, drop empties, re-join with a single space.
 */
function _pyJoinSplit(text: string): string {
    // Python str.split() with no args splits on any whitespace run and
    // discards leading/trailing/empty tokens.
    const parts = text.split(/\s+/u).filter((tok) => tok.length > 0);
    return parts.join(' ');
}

/**
 * Mirror Python `flat[:limit].rstrip() + "…"` — slice by CODE POINT (not
 * UTF-16 unit), then strip trailing whitespace, then append the ellipsis.
 */
function _pyTruncate(flat: string, limit: number): string {
    const sliced = [...flat].slice(0, limit).join('');
    return _pyRStrip(sliced) + '…';
}

/** Mirror Python `str.rstrip()` — strip trailing whitespace. */
function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Mirror Python `str.strip()` — strip whitespace both ends. */
function _pyStrip(s: string): string {
    return s.trim();
}

/**
 * Format `x` to `ndigits` decimals using round-half-to-even, matching
 * CPython float formatting (`f"{x:.2f}"` / `f"{x:.1f}"`).
 */
function _pyFixed(x: number, ndigits: number): string {
    if (!Number.isFinite(x)) {
        return String(x);
    }
    const neg = x < 0 || Object.is(x, -0);
    const abs = Math.abs(x);
    const factor = Math.pow(10, ndigits);
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    let intStr = String(rounded);
    let result: string;
    if (ndigits === 0) {
        result = intStr;
    } else {
        if (intStr.length <= ndigits) {
            intStr = '0'.repeat(ndigits - intStr.length + 1) + intStr;
        }
        const whole = intStr.slice(0, intStr.length - ndigits);
        const dec = intStr.slice(intStr.length - ndigits);
        result = `${whole}.${dec}`;
    }
    return neg ? `-${result}` : result;
}

function _metaGet(
    metadata: Map<string, ConsensusMetadata> | Record<string, ConsensusMetadata>,
    id: string,
): ConsensusMetadata | undefined {
    if (metadata instanceof Map) {
        return metadata.get(id);
    }
    return Object.prototype.hasOwnProperty.call(metadata, id) ? metadata[id] : undefined;
}

/** Single-word verdict band for a consensus_strength. */
function _verdict(strength: number): string {
    if (strength > 0.7) {
        return 'Strong';
    }
    if (strength > 0.4) {
        return 'Moderate';
    }
    return 'Weak';
}

/**
 * Return the one-line key argument for `scorer` on a finding.
 *
 * Prefers the scorer's `reason` field (rich, contextual) and falls back to
 * the truncated deliberation snippet so the audit trail never surfaces an
 * empty argument.
 */
function _scorer_argument(
    scorer: string,
    member_texts: Map<string, string>,
    score: FindingScore | null,
): string {
    if (score && score.reason) {
        let flat = _pyJoinSplit(score.reason);
        if (_pyLen(flat) > 200) {
            flat = _pyTruncate(flat, 199);
        }
        return flat;
    }
    const snippet = member_texts.get(scorer) ?? '';
    let flat = _pyJoinSplit(snippet);
    if (!flat) {
        return 'no argument captured';
    }
    if (_pyLen(flat) > 200) {
        flat = _pyTruncate(flat, 199);
    }
    return flat;
}

function _scores_for_finding(
    fid: string,
    scores: Iterable<FindingScore>,
): Map<string, FindingScore> {
    const out = new Map<string, FindingScore>();
    for (const s of scores) {
        if (s.finding_id === fid) {
            out.set(s.scorer, s);
        }
    }
    return out;
}

/**
 * Render the `decision-replay.md` body.
 *
 * Sections (in order): a leading H1 plus the original ask blockquote, one
 * `## <finding-id> — <truncated text>` block per finding (ranked by
 * consensus_strength desc), and a trailing footer with the toggle state so
 * consumers can tell at a glance whether arguments were redacted.
 */
export function render_decision_replay(inputs: DecisionReplayInputs): string {
    const member_texts = new Map<string, string>();
    for (const r of inputs.deliberation) {
        member_texts.set(`${r.provider}:${r.model}`, r.text || '');
    }

    // sorted(findings, key=consensus_strength, reverse=True). CPython sort
    // is stable; preserve input order among equal keys by indexing.
    const ranked = inputs.findings
        .map((f, i) => ({ f, i }))
        .sort((a, b) => {
            const sa = (
                _metaGet(inputs.metadata, a.f.id) ??
                new ConsensusMetadata({
                    finding_id: a.f.id,
                    consensus_strength: 0.0,
                    dissent_count: 0,
                    scorers: [],
                    mean_score: 0.0,
                })
            ).consensus_strength;
            const sb = (
                _metaGet(inputs.metadata, b.f.id) ??
                new ConsensusMetadata({
                    finding_id: b.f.id,
                    consensus_strength: 0.0,
                    dissent_count: 0,
                    scorers: [],
                    mean_score: 0.0,
                })
            ).consensus_strength;
            if (sb !== sa) {
                return sb - sa; // reverse=True (descending)
            }
            return a.i - b.i; // stable tie-break on input order
        })
        .map((e) => e.f);

    const lines: string[] = ['# Decision Replay\n'];
    if (_pyStrip(inputs.original_ask)) {
        let ask = _pyJoinSplit(inputs.original_ask);
        if (_pyLen(ask) > 400) {
            ask = _pyTruncate(ask, 399);
        }
        lines.push(`> ${ask}\n`);
    }
    if (ranked.length === 0) {
        lines.push('*No findings were extracted for this session.*\n');
        return _pyRStrip(lines.join('\n')) + '\n';
    }
    for (const f of ranked) {
        let m = _metaGet(inputs.metadata, f.id) ?? null;
        if (m === null) {
            m = new ConsensusMetadata({
                finding_id: f.id,
                consensus_strength: 0.0,
                dissent_count: 0,
                scorers: [],
                mean_score: 0.0,
            });
        }
        let title = _pyJoinSplit(f.text);
        if (_pyLen(title) > 120) {
            title = _pyTruncate(title, 119);
        }
        const verdict = _verdict(m.consensus_strength);
        lines.push(`## ${f.id} — ${title}\n`);
        lines.push(
            `- **Consensus**: ${verdict} (${_pyFixed(m.consensus_strength, 2)})\n` +
                `- **Evidence quality**: ${m.evidence_quality} ` +
                `(mean ${_pyFixed(m.mean_score, 1)}/10)\n` +
                `- **Agreement**: ${m.concur_count}/` +
                `${m.concur_count + m.dissent_count} members concur, ` +
                `${m.dissent_count} dissent\n`,
        );
        if (inputs.include_member_arguments) {
            const score_map = _scores_for_finding(f.id, inputs.scores);
            const agreeing = m.scorers.filter((s) => {
                const sc = score_map.get(s);
                return sc !== undefined && sc.agree;
            });
            const dissent = m.dissent_reasons.map((pair) => pair);
            if (agreeing.length > 0) {
                lines.push('**Agreeing members**:');
                for (const scorer of agreeing) {
                    const arg = _scorer_argument(scorer, member_texts, score_map.get(scorer) ?? null);
                    lines.push(`- _${scorer}_ — ${arg}`);
                }
                lines.push('');
            }
            if (dissent.length > 0) {
                lines.push('**Dissenting members**:');
                for (const [scorer] of dissent) {
                    const arg = _scorer_argument(scorer, member_texts, score_map.get(scorer) ?? null);
                    lines.push(`- _${scorer}_ — ${arg}`);
                }
                lines.push('');
            }
        }
        lines.push(`**Synthesis verdict**: ${verdict} consensus — ${f.source} sourced.\n`);
    }
    const mode_label = inputs.include_member_arguments ? 'full' : 'redacted (counts only)';
    lines.push(`---\n\n_artefact mode: ${mode_label}_\n`);
    return _pyRStrip(lines.join('\n')) + '\n';
}
