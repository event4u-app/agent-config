/**
 * Measurement-integrity primitives for the bench:ab v2 paired sweep.
 *
 * Implements deltas #1–#4 of the S0.3 harness-feasibility spike
 * (`agents/evidence/investigations/solution-minimalism-phase0-spikes.md`
 * § "Deltas required before a paid run") — the four cheap ones the roadmap's
 * Phase-3 halt note says "land before any spend".
 *
 * Why this exists at all: the sweep has ALREADY produced a full set of invalid
 * nulls once. Clones lived inside the repo, so the `vanilla` arm inherited the
 * package through project scope and every prior null was void
 * (`bench_ab_v2_run.ts` § arm-isolation note). The fix at the time was a `/tmp`
 * path constant with no runtime assertion behind it, and the only activation
 * field on a trial record — `injected_chars` — is the `String.length` of a file
 * the harness itself wrote. It proves nothing about the model, and it is `0` by
 * construction for the `package` arm, which arrives through global settings.
 * If the plugin were disabled or version-drifted mid-sweep, every treatment run
 * would silently degrade to `vanilla` and the report would look identical.
 *
 * Everything here is pure and host-free so it can be unit-tested without a
 * model call. The sweep wires it in `bench_ab_v2_run.ts`.
 */

/** Four-bucket usage split as reported by the Claude CLI JSON envelope. */
export interface TokensBreakdown {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
}

/** Per-1M-token rates for one pricing tier (mirrors `_lib/bench_cost.TierRates`). */
export interface TierRates {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
}

/**
 * How an arm is supposed to reach the model.
 *
 * - `plugin` — the package rides global settings (`setting_sources: null`).
 *   Invisible to `injected_chars`; only the prompt footprint can see it.
 * - `text`   — an `--append-system-prompt-file` injection the harness wrote.
 * - `none`   — the baseline: settings scoped away AND no text injection.
 */
export type ExpectedInjection = 'plugin' | 'text' | 'none';

/**
 * `unknown` is deliberately not a violation: an errored or budget-capped run
 * carries a zeroed usage block, so its footprint says nothing. Attrition is
 * reported separately (delta #5) rather than laundered into an integrity fail.
 */
export type ActivationVerdict = 'ok' | 'violation' | 'unknown';

export interface Activation {
    expected: ExpectedInjection;
    prompt_tokens: number;
    injected_chars: number;
    verdict: ActivationVerdict;
    reason: string;
}

export interface ActivationViolation {
    task_id: string;
    seed: number;
    arm: string;
    kind: 'text-injection-missing' | 'text-injection-unexpected' | 'collapsed-to-baseline' | 'model-mismatch';
    detail: string;
}

export interface ActivationAudit {
    checked: number;
    skipped: number;
    violations: ActivationViolation[];
}

/**
 * Minimum prompt-footprint ratio a plugin-bearing arm must hold over the paired
 * baseline run before the pair is believed.
 *
 * Calibrated DOWNWARD from the three stored sweeps in S0.3's cost sheet, whose
 * observed treatment/vanilla total-token ratios were 4.68× (sonnet, `package`),
 * 1.71× (haiku, `rules-kernel-dc`) and 6.79× (haiku, `package`). 1.2 sits below
 * the smallest of those by a wide margin on purpose: this flags a COLLAPSE to
 * baseline — a disabled or drifted plugin — never ordinary run-to-run variance.
 * Raising it toward the observed values would start failing legitimate runs;
 * lowering it toward 1.0 would stop catching the failure it exists for.
 */
export const ACTIVATION_MIN_LIFT_RATIO = 1.2;

/**
 * The footprint an injection actually moves: everything the model was fed.
 *
 * Output tokens are excluded — they measure how much the model wrote, which a
 * bigger system prompt does not reliably change, so including them would blur
 * the very signal this audit reads.
 */
export function prompt_tokens(b: TokensBreakdown | Record<string, never> | null | undefined): number {
    if (!b) {
        return 0;
    }
    const t = b as Partial<TokensBreakdown>;
    return _int(t.input_tokens) + _int(t.cache_read_input_tokens) + _int(t.cache_creation_input_tokens);
}

/** Classify an arm spec into the injection channel it is supposed to use. */
export function expected_injection(spec: { setting_sources: string | null; inject: string | null }): ExpectedInjection {
    if (spec.inject) {
        return 'text';
    }
    return spec.setting_sources === null ? 'plugin' : 'none';
}

/**
 * Per-trial verdict — the direction that IS decidable from one run.
 *
 * A text injection is checked both ways: an arm that declares one must carry
 * it, and an arm that declares none must not. The plugin direction needs the
 * paired baseline and is handled by `audit_activation`.
 */
export function activation_verdict(args: {
    expected: ExpectedInjection;
    tokens_breakdown: TokensBreakdown | Record<string, never> | null | undefined;
    injected_chars: number;
    errored: boolean;
}): Activation {
    const pt = prompt_tokens(args.tokens_breakdown);
    const base = { expected: args.expected, prompt_tokens: pt, injected_chars: args.injected_chars };
    if (args.errored || pt === 0) {
        return { ...base, verdict: 'unknown', reason: 'errored or zero usage — footprint unreadable' };
    }
    if (args.expected === 'text' && args.injected_chars <= 0) {
        return { ...base, verdict: 'violation', reason: 'text arm carried no injection' };
    }
    if (args.expected !== 'text' && args.injected_chars > 0) {
        return {
            ...base,
            verdict: 'violation',
            reason: `${args.expected} arm carried a ${args.injected_chars}-char injection`,
        };
    }
    return { ...base, verdict: 'ok', reason: 'expected channel present' };
}

/**
 * Cross-arm audit over a finished (or partial) record set — the plugin
 * direction plus every per-trial verdict already stamped on the records.
 *
 * A pair is only judged when BOTH sides are readable; unreadable pairs are
 * counted as `skipped`, never silently passed.
 */
export function audit_activation(
    records: readonly Record<string, unknown>[],
    opts: { baseline_arm: string; lift_arms: readonly string[]; min_ratio?: number },
): ActivationAudit {
    const minRatio = opts.min_ratio ?? ACTIVATION_MIN_LIFT_RATIO;
    const violations: ActivationViolation[] = [];
    let checked = 0;
    let skipped = 0;

    for (const rec of records) {
        const taskId = String(rec['id'] ?? '');
        const arms = _dict(rec['arms']);

        for (const [arm, runsRaw] of Object.entries(arms)) {
            for (const run of _list(runsRaw)) {
                const act = _dict(run['activation']);
                if (act['verdict'] === 'violation') {
                    const reason = String(act['reason'] ?? '');
                    violations.push({
                        task_id: taskId,
                        seed: _int(run['seed']),
                        arm,
                        kind: reason.includes('no injection') ? 'text-injection-missing' : 'text-injection-unexpected',
                        detail: reason,
                    });
                }
                const mc = _dict(run['model_check']);
                if ('ok' in mc && !_truthy(mc['ok'])) {
                    violations.push({
                        task_id: taskId,
                        seed: _int(run['seed']),
                        arm,
                        kind: 'model-mismatch',
                        detail: String(mc['reason'] ?? ''),
                    });
                }
            }
        }

        const baseBySeed = new Map<number, number>();
        for (const run of _list(arms[opts.baseline_arm])) {
            const pt = _runPromptTokens(run);
            if (!_truthy(run['errored']) && pt > 0) {
                baseBySeed.set(_int(run['seed']), pt);
            }
        }

        for (const arm of opts.lift_arms) {
            for (const run of _list(arms[arm])) {
                const seed = _int(run['seed']);
                const basePt = baseBySeed.get(seed);
                const armPt = _runPromptTokens(run);
                if (_truthy(run['errored']) || basePt === undefined || armPt === 0) {
                    skipped += 1;
                    continue;
                }
                checked += 1;
                if (armPt < basePt * minRatio) {
                    violations.push({
                        task_id: taskId,
                        seed,
                        arm,
                        kind: 'collapsed-to-baseline',
                        detail:
                            `prompt footprint ${armPt} vs baseline ${basePt} ` +
                            `(ratio ${(armPt / basePt).toFixed(2)} < ${minRatio}) — ` +
                            'the treatment surface may not have reached the model',
                    });
                }
            }
        }
    }

    return { checked, skipped, violations };
}

// ── delta #3 — model-id verification ────────────────────────────────────────

/**
 * Aliases the Claude CLI resolves server-side to whatever is current.
 *
 * A stored report already contains the bare alias `"sonnet"`, which makes that
 * report unreproducible: nothing in it records which model actually answered.
 */
export const BARE_MODEL_ALIASES: readonly string[] = ['default', 'haiku', 'opus', 'sonnet', 'sonnet[1m]'];

/** True when `model` is an alias rather than a pinned, reproducible id. */
export function is_bare_alias(model: string): boolean {
    return BARE_MODEL_ALIASES.includes(model.trim().toLowerCase());
}

/** Drop a trailing `-YYYYMMDD` build stamp so `claude-x-1` == `claude-x-1-20250101`. */
export function normalize_model_id(model: string): string {
    return model.trim().toLowerCase().replace(/-\d{8}$/, '');
}

/**
 * Compare the requested model against the ids the CLI actually billed.
 *
 * `models_seen` comes from the envelope's `modelUsage` keys — the only place
 * the run states which model answered. An empty list is `ok`: some envelopes
 * omit the block, and refusing there would fail runs for a reporting gap
 * rather than a real mismatch.
 */
export function verify_model_id(requested: string, models_seen: readonly string[]): { ok: boolean; reason: string } {
    if (is_bare_alias(requested)) {
        return { ok: false, reason: `requested model "${requested}" is a bare alias — pin a full model id` };
    }
    if (models_seen.length === 0) {
        return { ok: true, reason: 'envelope reported no model usage — nothing to contradict' };
    }
    const want = normalize_model_id(requested);
    const seen = models_seen.map(normalize_model_id);
    if (seen.every((s) => s === want)) {
        return { ok: true, reason: `billed model matches ${requested}` };
    }
    return {
        ok: false,
        reason: `requested ${requested} but envelope billed ${[...new Set(models_seen)].sort().join(', ')}`,
    };
}

// ── delta #4 — sweep-level cost ─────────────────────────────────────────────

/** Map a full model id onto a `pricing.yaml` tier, or null when unrecognised. */
export function tier_for_model(model: string): string | null {
    const m = model.toLowerCase();
    for (const tier of ['haiku', 'sonnet', 'opus']) {
        if (m.includes(tier)) {
            return tier;
        }
    }
    return null;
}

/**
 * Price one run's four buckets separately.
 *
 * The buckets differ in price by up to 125×, so a single blended rate over the
 * summed total is not an approximation — it is a different number.
 */
export function cost_usd(b: TokensBreakdown | Record<string, never> | null | undefined, rates: TierRates): number {
    if (!b) {
        return 0;
    }
    const t = b as Partial<TokensBreakdown>;
    return (
        (_int(t.input_tokens) * rates.input +
            _int(t.output_tokens) * rates.output +
            _int(t.cache_creation_input_tokens) * rates.cache_write +
            _int(t.cache_read_input_tokens) * rates.cache_read) /
        1_000_000
    );
}

/**
 * Cumulative sweep spend with a hard cap.
 *
 * `--max-budget-usd` is per RUN (default 1.0), so a 30×4×3 sweep at `--budget
 * 3.5` has a $1,260 ceiling with nothing to stop it. This is the sweep-level
 * counterpart: the first run that pushes cumulative spend over the cap aborts
 * the sweep instead of discovering the overrun on the invoice.
 */
export class SweepBudget {
    private _spent = 0;

    constructor(
        readonly cap_usd: number | null,
        private readonly rates: TierRates | null,
    ) {}

    get spent_usd(): number {
        return this._spent;
    }

    /** Add one run's cost; return an abort reason when the cap is crossed. */
    add(b: TokensBreakdown | Record<string, never> | null | undefined): string | null {
        if (!this.rates) {
            return null;
        }
        this._spent += cost_usd(b, this.rates);
        if (this.cap_usd !== null && this._spent > this.cap_usd) {
            return `sweep budget abort: cumulative $${this._spent.toFixed(2)} > cap $${this.cap_usd.toFixed(2)}`;
        }
        return null;
    }
}

// ── internals ───────────────────────────────────────────────────────────────

function _int(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
}

function _dict(v: unknown): Record<string, unknown> {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function _list(v: unknown): Record<string, unknown>[] {
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function _truthy(v: unknown): boolean {
    return Boolean(v);
}

/**
 * Prompt footprint of one trial record — the stamped `activation` block when
 * the sweep wrote one, else recomputed from the preserved breakdown (delta #2),
 * so the audit also reads reports written before the stamp existed.
 */
function _runPromptTokens(run: Record<string, unknown>): number {
    const stamped = _int(_dict(run['activation'])['prompt_tokens']);
    return stamped > 0 ? stamped : prompt_tokens(run['tokens_breakdown'] as TokensBreakdown | undefined);
}
