/**
 * Consensus scoring for the analysis lens (Phase 4 / F3).
 *
 * TypeScript twin of `src/scripts/ai_council/consensus.py` (ADR-094 —
 * Python→TS migration, Phase 1). After the final deliberation round, members
 * score each other's findings. The renderer ranks findings by consensus and
 * surfaces a "Minority Views" section for sub-threshold items so they remain
 * audit-trail signal rather than silent drop.
 *
 * Schema (Opus's machine-readable contract):
 *
 *     Finding            — `{id: str, source: str, text: str}`
 *     FindingScore       — `{finding_id: str, scorer: str, score: 1..10,
 *                           agree: bool, reason: str}`
 *     ConsensusMetadata  — per-finding aggregate:
 *                          `{finding_id, consensus_strength: 0..1,
 *                            dissent_count, scorers, mean_score}`
 *
 * Threshold bucketing (Phase 4 Step 3):
 *
 *     consensus_strength > strong   → Strong Consensus
 *     minority < strength <= strong → Findings (default body)
 *     strength <= minority          → Minority Views
 *
 * Parity notes:
 * - `round(mean, 2)` / `round(strength, 3)` mirror Python round-half-to-even
 *   via `pyRound` from `_lib/value_ladder.ts`.
 * - JSON extraction mirrors Python `re.DOTALL` (`s` flag) and `.search()`
 *   (first non-overlapping match). The non-greedy `.*?` is preserved.
 * - `json.loads` / `isinstance` shape checks mirror Python defensive parsing.
 */
import { pyRound } from '../_lib/value_ladder.js';

// Python: re.compile(r"```(?:json)?\s*(\[.*?\])\s*```", re.DOTALL)
// re.DOTALL → 's'. Python regex is not global; a fresh RegExp per call avoids
// lastIndex carryover, and we use .exec() (first match) below.
const _JSON_BLOCK_SRC = '```(?:json)?\\s*(\\[[\\s\\S]*?\\])\\s*```';
// Python: re.compile(r"(\[\s*\{.*?\}\s*\])", re.DOTALL)
const _BARE_ARRAY_SRC = '(\\[\\s*\\{[\\s\\S]*?\\}\\s*\\])';

// Defaults mirror the roadmap (Phase 4 Step 4). The .agent-settings.yml
// block overrides them at run time.
export const DEFAULT_STRONG_THRESHOLD = 0.7;
export const DEFAULT_MINORITY_THRESHOLD = 0.4;

/** One finding extracted from a member's deliberation output. */
export class Finding {
    readonly id: string;
    readonly source: string; // provider/model that authored the finding
    readonly text: string;

    constructor(id: string, source: string, text: string) {
        this.id = id;
        this.source = source;
        this.text = text;
    }
}

/** One scorer's vote on one finding. */
export class FindingScore {
    readonly finding_id: string;
    readonly scorer: string;
    readonly score: number; // 1..10
    readonly agree: boolean;
    readonly reason: string;

    constructor(
        finding_id: string,
        scorer: string,
        score: number,
        agree: boolean,
        reason: string,
    ) {
        this.finding_id = finding_id;
        this.scorer = scorer;
        this.score = score;
        this.agree = agree;
        this.reason = reason;
    }
}

/**
 * Classify mean score into a single-letter evidence-quality bucket.
 *
 * H (high)   — mean ≥ 8.0; member agreement ran high.
 * M (medium) — 6.0 ≤ mean < 8.0; majority support, mixed conviction.
 * L (low)    — mean < 6.0 or no scorers; weak or contested.
 */
export function evidence_quality(mean_score: number): string {
    if (mean_score >= 8.0) {
        return 'H';
    }
    if (mean_score >= 6.0) {
        return 'M';
    }
    return 'L';
}

/**
 * Aggregate consensus stats for a single finding.
 *
 * `dissent_reasons` holds `(scorer, reason)` pairs for dissenters only.
 */
export class ConsensusMetadata {
    readonly finding_id: string;
    readonly consensus_strength: number; // 0..1
    readonly dissent_count: number;
    readonly scorers: readonly string[];
    readonly mean_score: number;
    readonly concur_count: number;
    readonly dissent_reasons: ReadonlyArray<readonly [string, string]>; // (scorer, reason)
    readonly evidence_quality: string;

    constructor(args: {
        finding_id: string;
        consensus_strength: number;
        dissent_count: number;
        scorers: readonly string[];
        mean_score: number;
        concur_count?: number;
        dissent_reasons?: ReadonlyArray<readonly [string, string]>;
        evidence_quality?: string;
    }) {
        this.finding_id = args.finding_id;
        this.consensus_strength = args.consensus_strength;
        this.dissent_count = args.dissent_count;
        this.scorers = args.scorers;
        this.mean_score = args.mean_score;
        this.concur_count = args.concur_count ?? 0;
        this.dissent_reasons = args.dissent_reasons ?? [];
        this.evidence_quality = args.evidence_quality ?? 'L';
    }
}

/** Threshold-bucketed findings ready for renderer sectioning. */
export class ConsensusBucket {
    readonly strong: Array<[Finding, ConsensusMetadata]>;
    readonly findings: Array<[Finding, ConsensusMetadata]>;
    readonly minority: Array<[Finding, ConsensusMetadata]>;

    constructor() {
        this.strong = [];
        this.findings = [];
        this.minority = [];
    }
}

/**
 * Aggregate per-finding scores into ConsensusMetadata.
 *
 * `consensus_strength` = mean(score) / 10 * agreement_rate.
 *
 * A finding's *own author* is never expected to score it; we drop
 * self-scores defensively to keep the aggregate honest. Missing
 * findings get zero scorers (strength=0, dissent_count=0).
 */
export function aggregate_scores(
    findings: Iterable<Finding>,
    scores: Iterable<FindingScore>,
): Map<string, ConsensusMetadata> {
    const findingList = Array.from(findings);
    const by_id = new Map<string, FindingScore[]>();
    const sources = new Map<string, string>();
    for (const f of findingList) {
        by_id.set(f.id, []);
        sources.set(f.id, f.source);
    }
    for (const s of scores) {
        if (!by_id.has(s.finding_id)) {
            continue;
        }
        if (s.scorer === sources.get(s.finding_id)) {
            continue; // ignore self-scores
        }
        (by_id.get(s.finding_id) as FindingScore[]).push(s);
    }
    const out = new Map<string, ConsensusMetadata>();
    for (const [fid, fs] of by_id) {
        if (fs.length === 0) {
            out.set(
                fid,
                new ConsensusMetadata({
                    finding_id: fid,
                    consensus_strength: 0.0,
                    dissent_count: 0,
                    scorers: [],
                    mean_score: 0.0,
                    concur_count: 0,
                    dissent_reasons: [],
                    evidence_quality: 'L',
                }),
            );
            continue;
        }
        const mean = fs.reduce((acc, s) => acc + s.score, 0) / fs.length;
        const agree_rate = fs.filter((s) => s.agree).length / fs.length;
        const strength = (mean / 10.0) * agree_rate;
        const dissent = fs.filter((s) => !s.agree).length;
        const concur = fs.filter((s) => s.agree).length;
        const scorers = fs.map((s) => s.scorer);
        // Phase 9 — collect (scorer, reason) pairs for dissenters only,
        // in scoring order.
        const dissent_reasons: Array<[string, string]> = fs
            .filter((s) => !s.agree)
            .map((s) => [s.scorer, s.reason] as [string, string]);
        const mean_rounded = pyRound(mean, 2);
        out.set(
            fid,
            new ConsensusMetadata({
                finding_id: fid,
                consensus_strength: pyRound(strength, 3),
                dissent_count: dissent,
                scorers,
                mean_score: mean_rounded,
                concur_count: concur,
                dissent_reasons,
                evidence_quality: evidence_quality(mean_rounded),
            }),
        );
    }
    return out;
}

export interface BucketByThresholdOptions {
    strong?: number;
    minority?: number;
}

/**
 * Split findings into Strong / Findings / Minority buckets.
 *
 * Findings with no metadata (no scorers) fall into the Minority bucket — they
 * were uncontested but unsupported.
 */
export function bucket_by_threshold(
    findings: Iterable<Finding>,
    metadata: Map<string, ConsensusMetadata>,
    opts: BucketByThresholdOptions = {},
): ConsensusBucket {
    const strong = opts.strong ?? DEFAULT_STRONG_THRESHOLD;
    const minority = opts.minority ?? DEFAULT_MINORITY_THRESHOLD;
    if (!(0.0 <= minority && minority <= strong && strong <= 1.0)) {
        throw new Error(
            `Threshold ordering broken: 0 <= ${_pyFloatRepr(minority)} <= ${_pyFloatRepr(strong)} <= 1 required.`,
        );
    }
    const bucket = new ConsensusBucket();
    for (const f of findings) {
        let m = metadata.get(f.id);
        if (m === undefined) {
            m = new ConsensusMetadata({
                finding_id: f.id,
                consensus_strength: 0.0,
                dissent_count: 0,
                scorers: [],
                mean_score: 0.0,
                concur_count: 0,
                dissent_reasons: [],
                evidence_quality: 'L',
            });
        }
        if (m.consensus_strength > strong) {
            bucket.strong.push([f, m]);
        } else if (m.consensus_strength > minority) {
            bucket.findings.push([f, m]);
        } else {
            bucket.minority.push([f, m]);
        }
    }
    // Strongest first inside each bucket. Python list.sort is stable;
    // Array.prototype.sort is stable in modern V8 / Node ≥ 11.
    for (const lst of [bucket.strong, bucket.findings, bucket.minority]) {
        lst.sort((a, b) => b[1].consensus_strength - a[1].consensus_strength);
    }
    return bucket;
}

/**
 * Parse a member's structured-findings response into Finding objects.
 *
 * Accepts either a fenced ```json``` block or a bare JSON array. Each
 * item must be `{id: str, text: str}` (the `source` is set from the
 * `source` arg so we can attribute findings to their author). Items
 * missing required keys are skipped silently — extraction is best-
 * effort, never raises.
 */
export function parse_findings_response(
    text: string,
    opts: { source: string },
): Finding[] {
    const source = opts.source;
    const array = _extract_json_array(text);
    if (!array) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(array);
    } catch {
        // json.JSONDecodeError → []
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const out: Finding[] = [];
    for (const item of parsed) {
        if (!_isPlainObject(item)) {
            continue;
        }
        const fid = (item as Record<string, unknown>)['id'];
        const txt = (item as Record<string, unknown>)['text'];
        // Python: `if not fid or not txt` — falsy check.
        if (!_pyTruthy(fid) || !_pyTruthy(txt)) {
            continue;
        }
        out.push(new Finding(_pyStr(fid), source, _pyStrip(_pyStr(txt))));
    }
    return out;
}

/**
 * Parse a member's scoring response into FindingScore objects.
 *
 * Each item must be `{finding_id, score, agree, reason}`. Scores are
 * clamped to 1..10; non-numeric scores or out-of-range values cause
 * the item to be skipped (defensive — never poison aggregates).
 */
export function parse_scores_response(
    text: string,
    opts: { scorer: string },
): FindingScore[] {
    const scorer = opts.scorer;
    const array = _extract_json_array(text);
    if (!array) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(array);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const out: FindingScore[] = [];
    for (const item of parsed) {
        if (!_isPlainObject(item)) {
            continue;
        }
        const obj = item as Record<string, unknown>;
        // Python: item.get("finding_id") or item.get("id")
        const fidRaw = obj['finding_id'];
        const fid = _pyTruthy(fidRaw) ? fidRaw : obj['id'];
        const score = obj['score'];
        // Python: `if not fid or not isinstance(score, (int, float))`.
        // Python bool is a subclass of int, so `True`/`False` pass the
        // isinstance gate; JS `typeof true === 'boolean'`, so handle bool too.
        if (!_pyTruthy(fid) || !_pyIsIntOrFloat(score)) {
            continue;
        }
        const score_int = _pyInt(score as number | boolean);
        if (!(1 <= score_int && score_int <= 10)) {
            continue;
        }
        // Python: bool(item.get("agree", True))
        const agreeRaw = 'agree' in obj ? obj['agree'] : true;
        // Python: str(item.get("reason", "")).strip()
        const reasonRaw = 'reason' in obj ? obj['reason'] : '';
        out.push(
            new FindingScore(
                _pyStr(fid),
                scorer,
                score_int,
                _pyTruthy(agreeRaw),
                _pyStrip(_pyStr(reasonRaw)),
            ),
        );
    }
    return out;
}

/** Best-effort JSON-array extraction from a model response. */
function _extract_json_array(text: string): string {
    if (!text) {
        return '';
    }
    const fenced = new RegExp(_JSON_BLOCK_SRC, 's').exec(text);
    if (fenced) {
        return fenced[1] as string;
    }
    const bare = new RegExp(_BARE_ARRAY_SRC, 's').exec(text);
    if (bare) {
        return bare[1] as string;
    }
    return '';
}

/**
 * Return `{anon_label: Finding}` map so scorers see neutral labels.
 *
 * Labels are `Finding-A`, `Finding-B`, … in input order. The author
 * mapping must be kept out of the prompt — keep it server-side only.
 */
export function anonymize_findings(findings: Finding[]): Map<string, Finding> {
    const out = new Map<string, Finding>();
    findings.forEach((f, idx) => {
        const label = `Finding-${String.fromCharCode('A'.charCodeAt(0) + idx)}`;
        out.set(label, f);
    });
    return out;
}

/**
 * Anonymize deliberation responses for the peer-review round (Phase 5).
 *
 * `responses` is an iterable of `[source, text]` pairs where `source`
 * is the canonical `provider:model` identifier. Returns:
 *
 *   - `anon_text`: `{Response-A: <body>}` map fed into the prompt.
 *   - `label_to_source`: `{Response-A: provider:model}` map kept
 *     server-side so the orchestrator can de-anonymize at synthesis time.
 *
 * Empty / whitespace-only texts are skipped. Input order is preserved.
 *
 * `persona_labels` maps `source` → `persona`; sources missing from the
 * map render as bare `Response-X`. Plain-member runs pass `null`.
 */
export function anonymize_responses(
    responses: Iterable<readonly [string, string]>,
    opts: { persona_labels?: Map<string, string> | null } = {},
): [Map<string, string>, Map<string, string>] {
    const persona_labels = opts.persona_labels ?? null;
    const anon_text = new Map<string, string>();
    const label_to_source = new Map<string, string>();
    let idx = 0;
    for (const [source, text] of responses) {
        if (!text || !_pyStrip(text)) {
            continue;
        }
        const base = `Response-${String.fromCharCode('A'.charCodeAt(0) + idx)}`;
        const persona = persona_labels !== null ? persona_labels.get(source) : undefined;
        // Python: (persona_labels or {}).get(source) → None when missing.
        const label = persona !== undefined && persona !== null ? `${base} (${persona})` : base;
        anon_text.set(label, _pyStrip(text));
        label_to_source.set(label, source);
        idx += 1;
    }
    return [anon_text, label_to_source];
}

// ── Python-parity helpers ───────────────────────────────────────────

/** Mirror Python `str.strip()`. */
function _pyStrip(s: string): string {
    return s.trim();
}

/** Mirror Python `bool(x)` truthiness for parsed-JSON values. */
function _pyTruthy(v: unknown): boolean {
    if (v === null || v === undefined) {
        return false;
    }
    if (typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        return v !== 0 && !Number.isNaN(v) ? v !== 0 : false;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as Record<string, unknown>).length > 0;
    }
    return Boolean(v);
}

/** Mirror Python `str(x)` for JSON scalar values used here. */
function _pyStr(v: unknown): string {
    if (typeof v === 'string') {
        return v;
    }
    if (v === null) {
        return 'None';
    }
    if (v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    if (typeof v === 'number') {
        return _pyNum(v);
    }
    return String(v);
}

/**
 * Mirror Python `str()` for a number — ints render without a decimal,
 * float repr otherwise. `id`/`text`/`reason` from JSON are almost always
 * strings; this only matters for the rare numeric `id`/`reason`.
 */
function _pyNum(v: number): string {
    if (Number.isInteger(v) && Number.isFinite(v)) {
        // JSON.parse yields plain numbers with no float tag; Python json.loads
        // yields int for integer literals and float for `1.0`. Integer JSON
        // literals → Python int → str() with no decimal. Match that.
        return String(v);
    }
    return String(v);
}

/** Mirror Python `str(float)` for the threshold error — integer floats keep `.0`. */
function _pyFloatRepr(v: number): string {
    if (Number.isInteger(v) && Number.isFinite(v)) {
        return `${v}.0`;
    }
    if (v === Infinity) {
        return 'inf';
    }
    if (v === -Infinity) {
        return '-inf';
    }
    if (Number.isNaN(v)) {
        return 'nan';
    }
    return String(v);
}

/** Mirror Python `isinstance(x, (int, float))` — bool included (bool ⊂ int). */
function _pyIsIntOrFloat(v: unknown): boolean {
    return typeof v === 'number' || typeof v === 'boolean';
}

/** Mirror Python `int(x)` for the score path (truncates toward zero). */
function _pyInt(v: number | boolean): number {
    if (typeof v === 'boolean') {
        return v ? 1 : 0;
    }
    return Math.trunc(v);
}

/** True when `v` is a plain JSON object (Python `isinstance(item, dict)`). */
function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
