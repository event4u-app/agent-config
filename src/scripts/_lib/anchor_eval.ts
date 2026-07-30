/**
 * Constrained anchor evaluation with frozen verdicts (ADR-202, amended).
 *
 * ADR-202 originally called this "deterministic anchor-scoring against
 * must_include / must_not" and claimed the scorer is "a pure function of
 * (answer, anchors)". Measured against the corpus that claim is FALSE: 0 of 255
 * `must_include` anchors carry a literal token or code span, and 17% are
 * behavioural predicates ("mentions that UI redesign is outside scope"). A
 * substring match over those measures nothing.
 *
 * What is deterministic is everything BELOW the verdict: aggregation, the
 * per-rule floor, the non-inferiority arithmetic, κ, and the conservative
 * disagreement resolution — all pure functions over frozen verdicts, all unit
 * tested here without an API. The verdict itself is a constrained binary
 * classification per (answer, anchor) by two independent evaluator models. That
 * is far narrower than the pairwise preference judging which closed by
 * diagnosis, and — the point — it restores a MEASURABLE κ, whose absence is the
 * exact reason a single human judge was ruled inadmissible.
 *
 * Reproducibility comes from freezing, not from pinning: generate once, freeze
 * the transcripts AND the verdicts as artefacts, and re-score over the frozen
 * corpus. A re-generation is a new experiment, never a re-run of this one.
 */

export type AnchorKind = 'must_include' | 'must_not';
export type Arm = 'thin' | 'eager';

/** One evaluator's call on one anchor. `true` = satisfied (include) / violated (not). */
export interface AnchorVerdict {
    task_id: string;
    arm: Arm;
    kind: AnchorKind;
    /** Index into the task's anchor list for that kind — stable across evaluators. */
    index: number;
    anchor: string;
    hit: boolean;
}

/** Build the evaluator prompt for one (task, arm): every anchor in one call. */
export function eval_prompt(
    prompt: string,
    answer: string,
    must_include: readonly string[],
    must_not: readonly string[],
): string {
    const lines: string[] = [
        'You are grading ONE answer against a fixed checklist. For each checklist',
        'item, decide only whether the answer satisfies it. Judge the answer on its',
        'own — do not compare it to anything, do not reward or penalise length, and',
        'do not grade style.',
        '',
        '## The request the answer responds to',
        '',
        prompt,
        '',
        '## The answer',
        '',
        answer,
        '',
        '## Checklist',
        '',
    ];
    must_include.forEach((a, i) => lines.push(`I${i}. MUST BE PRESENT: ${a}`));
    must_not.forEach((a, i) => lines.push(`N${i}. MUST BE ABSENT: ${a}`));
    lines.push(
        '',
        '## Output',
        '',
        'Reply with ONE line per item and nothing else, in this exact form:',
        '  I0=yes   (the answer satisfies it)  |  I0=no   (it does not)',
        '  N0=yes   (the answer DOES the forbidden thing)  |  N0=no  (it does not)',
        'No prose, no explanation, no blank lines.',
    );
    return lines.join('\n');
}

/**
 * Parse an evaluator reply into verdicts. Unparseable or missing items are
 * returned as `null` so the caller resolves them conservatively rather than
 * silently scoring them as passes.
 */
export function parse_eval(
    reply: string,
    must_include_len: number,
    must_not_len: number,
): { include: Array<boolean | null>; not: Array<boolean | null> } {
    const include: Array<boolean | null> = new Array(must_include_len).fill(null);
    const not: Array<boolean | null> = new Array(must_not_len).fill(null);
    const re = /\b([IN])(\d+)\s*=\s*(yes|no)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(reply)) !== null) {
        const idx = Number(m[2]);
        const val = m[3]!.toLowerCase() === 'yes';
        if (m[1]!.toUpperCase() === 'I') {
            if (idx < include.length) include[idx] = val;
        } else if (idx < not.length) not[idx] = val;
    }
    return { include, not };
}

/**
 * Resolve two evaluators conservatively (ADR-202 (c)): a `must_include` counts
 * only when BOTH say satisfied; a `must_not` counts as violated when EITHER says
 * violated. `null` (unparsed) is treated as the unfavourable reading, so a
 * malformed reply can never become a pass.
 */
export function resolve(kind: AnchorKind, a: boolean | null, b: boolean | null): boolean {
    if (kind === 'must_include') return a === true && b === true;
    return a === true || b === true || a === null || b === null;
}

export interface TaskAnchors {
    id: string;
    rules: readonly string[];
    must_include: readonly string[];
    must_not: readonly string[];
}

export interface ScoreInput {
    tasks: readonly TaskAnchors[];
    /** Resolved verdicts, keyed `${task_id}|${arm}|${kind}|${index}` → hit. */
    resolved: ReadonlyMap<string, boolean>;
}

export interface ArmScore {
    include_pass: number;
    include_total: number;
    /** include_pass / include_total */
    rate: number;
    must_not_violations: Array<{ task_id: string; anchor: string }>;
}

export function key(task_id: string, arm: Arm, kind: AnchorKind, index: number): string {
    return `${task_id}|${arm}|${kind}|${index}`;
}

export function score_arm(input: ScoreInput, arm: Arm): ArmScore {
    let pass = 0;
    let total = 0;
    const violations: Array<{ task_id: string; anchor: string }> = [];
    for (const t of input.tasks) {
        t.must_include.forEach((_, i) => {
            total += 1;
            if (input.resolved.get(key(t.id, arm, 'must_include', i)) === true) pass += 1;
        });
        t.must_not.forEach((anchor, i) => {
            if (input.resolved.get(key(t.id, arm, 'must_not', i)) === true) {
                violations.push({ task_id: t.id, anchor });
            }
        });
    }
    return {
        include_pass: pass,
        include_total: total,
        rate: total === 0 ? 0 : pass / total,
        must_not_violations: violations,
    };
}

/** Per-rule include-pass counts, for the registered floor. */
export function per_rule_passes(input: ScoreInput, arm: Arm): Map<string, number> {
    const out = new Map<string, number>();
    for (const t of input.tasks) {
        let n = 0;
        t.must_include.forEach((_, i) => {
            if (input.resolved.get(key(t.id, arm, 'must_include', i)) === true) n += 1;
        });
        for (const r of t.rules) out.set(r, (out.get(r) ?? 0) + n);
    }
    return out;
}

/**
 * δ proposal from the observed spread: the standard deviation of the per-task
 * `must_include` pass-rate difference (thin − eager), in percentage points.
 * Derived from the FROZEN corpus and recorded before scoring — a property of the
 * corpus, never of the verdict.
 */
export function delta_from_spread(input: ScoreInput): number {
    const diffs: number[] = [];
    for (const t of input.tasks) {
        if (t.must_include.length === 0) continue;
        let thin = 0;
        let eager = 0;
        t.must_include.forEach((_, i) => {
            if (input.resolved.get(key(t.id, 'thin', 'must_include', i)) === true) thin += 1;
            if (input.resolved.get(key(t.id, 'eager', 'must_include', i)) === true) eager += 1;
        });
        diffs.push((thin - eager) / t.must_include.length);
    }
    if (diffs.length === 0) return 0;
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const varr = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length;
    return Math.sqrt(varr) * 100;
}

export interface Verdict {
    kappa: number;
    kappa_floor: number;
    instrument_ok: boolean;
    delta_pp: number;
    delta_ceiling_pp: number;
    delta_registered: boolean;
    thin: ArmScore;
    eager: ArmScore;
    /** rate_thin − rate_eager, percentage points. */
    rate_gap_pp: number;
    must_not_ok: boolean;
    non_inferiority_ok: boolean;
    per_rule_floor_ok: boolean;
    per_rule_floor_breaches: string[];
    pass: boolean;
}

export interface VerdictOptions {
    kappa: number;
    kappa_floor?: number;
    delta_ceiling_pp?: number;
}

/** Apply every registered threshold. Pure — the whole decision, no I/O. */
export function verdict(input: ScoreInput, opts: VerdictOptions): Verdict {
    const kappa_floor = opts.kappa_floor ?? 0.8;
    const delta_ceiling_pp = opts.delta_ceiling_pp ?? 3;
    const thin = score_arm(input, 'thin');
    const eager = score_arm(input, 'eager');
    const delta_pp = delta_from_spread(input);
    const delta_registered = delta_pp <= delta_ceiling_pp;
    const rate_gap_pp = (thin.rate - eager.rate) * 100;

    // Registered: thin introduces NO must_not violation that eager avoids.
    const eagerViolated = new Set(eager.must_not_violations.map((v) => `${v.task_id}|${v.anchor}`));
    const introduced = thin.must_not_violations.filter((v) => !eagerViolated.has(`${v.task_id}|${v.anchor}`));
    const must_not_ok = introduced.length === 0;

    const effective_delta = Math.min(delta_pp, delta_ceiling_pp);
    const non_inferiority_ok = rate_gap_pp >= -effective_delta;

    const thinRule = per_rule_passes(input, 'thin');
    const eagerRule = per_rule_passes(input, 'eager');
    const breaches: string[] = [];
    for (const [rule, e] of eagerRule) {
        if (e >= 1 && (thinRule.get(rule) ?? 0) === 0) breaches.push(rule);
    }

    const instrument_ok = opts.kappa >= kappa_floor;
    return {
        kappa: opts.kappa,
        kappa_floor,
        instrument_ok,
        delta_pp,
        delta_ceiling_pp,
        delta_registered,
        thin,
        eager,
        rate_gap_pp,
        must_not_ok,
        non_inferiority_ok,
        per_rule_floor_ok: breaches.length === 0,
        per_rule_floor_breaches: breaches.sort(),
        pass:
            instrument_ok &&
            delta_registered &&
            must_not_ok &&
            non_inferiority_ok &&
            breaches.length === 0,
    };
}
