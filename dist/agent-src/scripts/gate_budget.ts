/**
 * gate_budget — the class-1 spend bound and its append-only receipt ledger
 * (`road-to-gate-autonomy` Phase 2, blocker `b-gate-budget-preauth`).
 *
 * WHY THIS EXISTS. Class 1 of the gate taxonomy is "billable or long-running
 * but reversible; the human ingredient is *spend consent*, not judgment".
 * `gate_execute.ts` shipped without it on purpose — "no invented ledger",
 * because the budget SHAPE was an open maintainer decision. That decision is
 * now taken (option (a): a per-run cap AND a rolling-window cap, with an
 * append-only receipt ledger as the audit surface), so this module supplies
 * exactly the shape that was decided and nothing more.
 *
 * WHAT THIS IS NOT. It is **not** a consent bypass. `gates --execute` still
 * requires `--confirm` on every class-1 run, so the this-turn,
 * names-the-exact-object confirmation `non-destructive-by-default` asks for is
 * unchanged. The caps bound the SIZE of an authorised spend; they never
 * manufacture the authorisation. A ledger under `agents/runtime/state/` is
 * agent-writable, so a mechanism that read an "authorisation" out of it would
 * be an agent consenting on the user's behalf — which is precisely the threat
 * model the live-trigger-eval terminal abort exists for. That is why the
 * receipt records CONSUMPTION only, and why step 2.3's bypass flag is not
 * built on top of this file.
 *
 * A per-run cap alone is not a spend bound — it bounds one mistake, not a week
 * of them — which is the whole reason the decision carries two numbers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Ledger location, relative to the workspace root.
 *
 * The name is the one already present in `gate_execute.ts` as the
 * absent-ledger placeholder, kept verbatim so the path a class-1 entry has
 * been REPORTING since Phase 2 is the path it now reads. `agents/runtime/state/`
 * is this tree's state convention (`run_checkpoint`, `unattended_guard`,
 * `recycle_envelope_paths` all live there); a bare `agents/state/` is not.
 */
export const GATE_BUDGET_LEDGER_REL = path.join(
    'agents',
    'runtime',
    'state',
    'gate-budget-ledger.jsonl',
);

/**
 * Build the absolute ledger path.
 *
 * Callers import THIS rather than joining {@link GATE_BUDGET_LEDGER_REL}
 * themselves: a bare relative constant is the shape that goes silently dead
 * when the location moves, because nothing joins it any more and nothing
 * complains.
 */
export function gateBudgetLedgerPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, GATE_BUDGET_LEDGER_REL);
}

/** The two caps decided by option (a). Both are USD. */
export interface GateBudgetCaps {
    maxCostPerRunUsd: number;
    maxCostPerRolling7dUsd: number;
}

/**
 * One append-only ledger line.
 *
 * The five fields the decision names — blocker, authorization, estimated and
 * actual cost, timestamp — plus the single-use marker. `authorization` records
 * HOW the spend was consented to; today the only value a run can honestly
 * write is `confirm-flag`, because `--confirm` is the consent. A future
 * human-only authorisation surface would add its own value here rather than
 * reinterpreting this one.
 */
export interface GateBudgetReceipt {
    kind: 'consumption';
    blocker: string;
    authorization: 'confirm-flag';
    estimated_usd: number;
    actual_usd: number | null;
    at: string;
    single_use: true;
}

/** Rolling window, in days, that `maxCostPerRolling7dUsd` bounds. */
export const ROLLING_WINDOW_DAYS = 7;

function _num(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return null;
}

function _dig(settings: unknown, keys: readonly string[]): unknown {
    let cursor: unknown = settings;
    for (const k of keys) {
        if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
            return undefined;
        }
        cursor = (cursor as Record<string, unknown>)[k];
    }
    return cursor;
}

/**
 * Read the caps out of an already-merged settings dict.
 *
 * Returns `null` when either cap is absent or non-numeric — deliberately NOT a
 * fallback to the template numbers. An install whose settings do not carry the
 * caps has not authorised a standing budget, and inventing one from the
 * template default would authorise spend nobody configured. The caller renders
 * the consent line instead.
 */
export function readGateBudgetCaps(settings: unknown): GateBudgetCaps | null {
    const perRun = _num(_dig(settings, ['roadmap', 'gate_budget', 'max_cost_per_run_usd']));
    const rolling = _num(
        _dig(settings, ['roadmap', 'gate_budget', 'max_cost_per_rolling_7d_usd']),
    );
    if (perRun === null || rolling === null) {
        return null;
    }
    return { maxCostPerRunUsd: perRun, maxCostPerRolling7dUsd: rolling };
}

/**
 * Parse a USD figure out of a blocker's `Budget:` field.
 *
 * An explicit currency marker (`$` or `USD`) is REQUIRED. Without it a field
 * like "~50 queries per run" would be read as fifty dollars, and a spend bound
 * derived from a misread is worse than no bound: it would let a large run
 * through under a small number. Returns `null` when no USD figure is stated.
 */
export function parseBudgetUsd(field: string): number | null {
    const text = field.trim();
    if (text === '') {
        return null;
    }
    const dollar = /\$\s*([0-9]+(?:[.,][0-9]+)?)/.exec(text);
    if (dollar) {
        return Number.parseFloat(dollar[1]!.replace(',', '.'));
    }
    const usd = /([0-9]+(?:[.,][0-9]+)?)\s*(?:usd|dollars?)\b/i.exec(text);
    if (usd) {
        return Number.parseFloat(usd[1]!.replace(',', '.'));
    }
    return null;
}

/** Read every well-formed receipt. A malformed line is skipped, never fatal. */
export function readGateBudgetLedger(workspaceRoot: string): GateBudgetReceipt[] {
    const file = gateBudgetLedgerPath(workspaceRoot);
    if (!fs.existsSync(file)) {
        return [];
    }
    const out: GateBudgetReceipt[] = [];
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '') {
            continue;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== 'object') {
            continue;
        }
        const rec = parsed as Record<string, unknown>;
        if (rec['kind'] !== 'consumption' || typeof rec['blocker'] !== 'string') {
            continue;
        }
        out.push({
            kind: 'consumption',
            blocker: rec['blocker'],
            authorization: 'confirm-flag',
            estimated_usd: _num(rec['estimated_usd']) ?? 0,
            actual_usd: _num(rec['actual_usd']),
            at: typeof rec['at'] === 'string' ? rec['at'] : '',
            single_use: true,
        });
    }
    return out;
}

/** Append one receipt. Append-only by construction — nothing here rewrites. */
export function appendGateBudgetReceipt(
    workspaceRoot: string,
    receipt: GateBudgetReceipt,
): void {
    const file = gateBudgetLedgerPath(workspaceRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(receipt)}\n`, 'utf-8');
}

/**
 * Spend inside the rolling window.
 *
 * `actual_usd` when the run reported one, the estimate otherwise — an
 * unreported actual must not read as zero spend. A receipt with an unparseable
 * timestamp counts as IN the window, because dropping it would understate the
 * total and the cap is meant to fail closed.
 */
export function rollingSpendUsd(records: readonly GateBudgetReceipt[], now: Date): number {
    const cutoff = now.getTime() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let total = 0;
    for (const r of records) {
        const stamp = Date.parse(r.at);
        if (Number.isFinite(stamp) && stamp < cutoff) {
            continue;
        }
        total += r.actual_usd ?? r.estimated_usd;
    }
    return total;
}

export type GateBudgetRefusal =
    | 'no_caps'
    | 'no_estimate'
    | 'over_per_run'
    | 'over_rolling_7d';

export type GateBudgetVerdict =
    | { ok: true; estimateUsd: number; rollingUsd: number }
    | { ok: false; reason: GateBudgetRefusal; detail: string };

/**
 * Decide whether a class-1 run fits inside the standing budget.
 *
 * Every refusal path renders rather than runs — the blocker's own prescription
 * for a missing ledger, generalised to every way the budget can say no.
 */
export function evaluateGateBudget(opts: {
    caps: GateBudgetCaps | null;
    records: readonly GateBudgetReceipt[];
    estimateUsd: number | null;
    now: Date;
}): GateBudgetVerdict {
    const { caps, records, estimateUsd, now } = opts;
    if (caps === null) {
        return {
            ok: false,
            reason: 'no_caps',
            detail:
                'no standing class-1 budget is configured ' +
                '(`roadmap.gate_budget.max_cost_per_run_usd` and ' +
                '`roadmap.gate_budget.max_cost_per_rolling_7d_usd`)',
        };
    }
    if (estimateUsd === null) {
        return {
            ok: false,
            reason: 'no_estimate',
            detail:
                'the entry states no USD estimate in its **Budget:** field, so no cap ' +
                'can be compared against it',
        };
    }
    if (estimateUsd > caps.maxCostPerRunUsd) {
        return {
            ok: false,
            reason: 'over_per_run',
            detail:
                `the estimate ($${estimateUsd.toFixed(2)}) exceeds the per-run cap ` +
                `($${caps.maxCostPerRunUsd.toFixed(2)})`,
        };
    }
    const spent = rollingSpendUsd(records, now);
    if (spent + estimateUsd > caps.maxCostPerRolling7dUsd) {
        return {
            ok: false,
            reason: 'over_rolling_7d',
            detail:
                `$${spent.toFixed(2)} is already receipted in the last ` +
                `${String(ROLLING_WINDOW_DAYS)} days and this run would add ` +
                `$${estimateUsd.toFixed(2)}, over the rolling cap ` +
                `($${caps.maxCostPerRolling7dUsd.toFixed(2)})`,
        };
    }
    return { ok: true, estimateUsd, rollingUsd: spent };
}
