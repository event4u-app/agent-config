#!/usr/bin/env node
/**
 * Shadow mode for free hands (free-hands 6.2): a free route answers the same
 * typed slice beside the paid route, the paid answer is the one used, the head
 * verifies both, and one row per call goes to a gitignored ledger. The ledger
 * is the data both pre-registered claims are read from (`free-hands-limit-relief`,
 * `free-hands-quality-held`) and the only input a per-kind flip may act on.
 *
 * Bounds, each failing toward not calling the free side:
 *   - the free side must be unpaid (`free-quota` or `self-hosted`); a metered
 *     "free" route would spend, so it is never shadowed;
 *   - the paid side must not be a `base_url` route, which counts as paid without being one;
 *   - the payload must be `public-artifact`, the ceiling every free route sits at;
 *   - at most `SHADOW_CALL_CAP` rows (decision A5); past it the paid side still
 *     answers and nothing else is called.
 *
 * Nothing here calls anything on its own: a caller hands in both members and
 * the head's verify. A row holds routes, verdicts and token counts, never the
 * prompt or either answer.
 *
 * Usage: ./scripts-run src/scripts/ai_council/free_hand_shadow --report [--json]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ExternalAIClient } from './clients.js';
import { admitsContent, type ContentClass } from './content_ceiling.js';
import { councilEgress, type CouncilEgress } from './council_egress.js';
import type { Exposure, ExposureLedger } from './exposure_ledger.js';
import { FreeRouteClient } from './free_route_client.js';
import { buildHandPayload, type HandPayload, type HandSlice } from './hand_payload.js';
import { parseHandReturn } from './hand_schemas.js';
import { routeCandidateFromMember } from './route_chooser.js';
import { classifyRouteOutcome, recordRouteOutcome, type RouteOutcome } from './route_liveness.js';
import { isUnpaid, type HandKind, type RouteBilling, type VerifyVerdict } from '../_lib/hand_kinds.js';

/** Decision A5: enough for per-kind rates at the 5 pp margin; spend stays USD 0.00. */
export const SHADOW_CALL_CAP = 2000;

export const SHADOW_LEDGER_RELPATH = path.join('agents', 'runtime', 'state', 'free-hand-shadow.jsonl');

export interface ShadowSide {
    readonly route: string;
    readonly billing: RouteBilling;
    readonly outcome: RouteOutcome;
    readonly schema_valid: boolean;
    readonly verified: VerifyVerdict;
    /** Billable tokens the side's call reported. */
    readonly tokens: number;
    /** Tokens the head spent verifying this side's return. */
    readonly verify_tokens: number;
}

export interface ShadowRow {
    readonly ts: string;
    readonly kind: HandKind;
    readonly paid: ShadowSide;
    readonly free: ShadowSide;
}

/** The head's check of one parsed return. `side` is for accounting only. */
export type HeadVerify = (
    kind: HandKind,
    parsed: unknown,
    side: 'paid' | 'free',
) => { verdict: VerifyVerdict; tokens: number } | Promise<{ verdict: VerifyVerdict; tokens: number }>;

export interface ShadowAskOptions {
    readonly contentClass: ContentClass;
    readonly paid: ExternalAIClient;
    readonly free: ExternalAIClient;
    readonly verify: HeadVerify;
    /** Root of the gitignored state the ledger and route liveness live in. */
    readonly stateRoot: string;
    readonly now?: () => Date;
    /** The run's placeholder scope; default: the council egress state. */
    readonly egress?: CouncilEgress;
    /** Recorded against the free route when, and only when, it is asked. */
    readonly exposure?: { readonly ledger: ExposureLedger; readonly exposes: Exposure };
}

export type ShadowSkip = 'free-side-metered' | 'paid-side-unpaid' | 'paid-side-route' | 'content-ceiling' | 'cap-reached';

export interface ShadowAnswer {
    readonly answer: string;
    readonly parsed: unknown;
}

export interface ShadowResult {
    /** The paid answer — the one the caller uses. Null when the paid side failed. */
    readonly answer: ShadowAnswer | null;
    readonly row: ShadowRow | null;
    readonly skipped?: ShadowSkip;
}

interface Called {
    readonly outcome: RouteOutcome;
    readonly parsed: { ok: true; value: unknown } | { ok: false };
    readonly text: string;
    readonly tokens: number;
}

async function _call(member: ExternalAIClient, kind: HandKind, payload: HandPayload): Promise<Called> {
    try {
        const raw = member.ask(payload.system, payload.user);
        const r = raw instanceof Promise ? await raw : raw;
        const outcome = classifyRouteOutcome(r?.error ?? null);
        const text = (r?.text ?? '').trim();
        const tokens = (r?.input_tokens ?? 0) + (r?.output_tokens ?? 0);
        if (outcome !== 'ok' || text === '') return { outcome, parsed: { ok: false }, text: '', tokens };
        const p = parseHandReturn(kind, text);
        return { outcome, parsed: p.ok ? { ok: true, value: p.value } : { ok: false }, text, tokens };
    } catch {
        return { outcome: 'other', parsed: { ok: false }, text: '', tokens: 0 };
    }
}

async function _side(member: ExternalAIClient, c: Called, kind: HandKind, which: 'paid' | 'free', verify: HeadVerify): Promise<ShadowSide> {
    const route = routeCandidateFromMember(member);
    // An answer that never parsed has already failed; the head is not asked about it.
    const v = c.parsed.ok ? await verify(kind, c.parsed.value, which) : { verdict: 'fail' as const, tokens: 0 };
    return {
        route: route.name,
        billing: route.billing,
        outcome: c.outcome,
        schema_valid: c.parsed.ok,
        verified: v.verdict,
        tokens: c.tokens,
        verify_tokens: v.tokens,
    };
}

function _ledgerPath(stateRoot: string): string {
    return path.join(stateRoot, SHADOW_LEDGER_RELPATH);
}

function _rowCount(stateRoot: string): number {
    try {
        return fs.readFileSync(_ledgerPath(stateRoot), 'utf8').split('\n').filter((l) => l.trim() !== '').length;
    } catch {
        return 0;
    }
}

function _append(stateRoot: string, row: ShadowRow): void {
    const file = _ledgerPath(stateRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

function _routeModel(member: ExternalAIClient): string | null {
    const m = member as unknown as Record<string, unknown>;
    return typeof m['base_url'] === 'string' && typeof m['model'] === 'string' && m['model'] !== '' ? m['model'] : null;
}

export async function shadowAsk(slice: HandSlice, opts: ShadowAskOptions): Promise<ShadowResult> {
    const kind = slice.kind;
    const paidRoute = routeCandidateFromMember(opts.paid);
    const freeRoute = routeCandidateFromMember(opts.free);
    if (isUnpaid(paidRoute.billing)) return { answer: null, row: null, skipped: 'paid-side-unpaid' };
    if (opts.paid instanceof FreeRouteClient) return { answer: null, row: null, skipped: 'paid-side-route' };
    const payload = buildHandPayload(slice, opts.egress ?? councilEgress());
    const usePaid = async (skipped: ShadowSkip): Promise<ShadowResult> => {
        const c = await _call(opts.paid, kind, payload);
        return { answer: c.parsed.ok ? { answer: c.text, parsed: c.parsed.value } : null, row: null, skipped };
    };
    if (!isUnpaid(freeRoute.billing)) return usePaid('free-side-metered');
    if (!admitsContent(freeRoute.ceiling, opts.contentClass).admitted) return usePaid('content-ceiling');
    if (_rowCount(opts.stateRoot) >= SHADOW_CALL_CAP) return usePaid('cap-reached');

    opts.exposure?.ledger.record(freeRoute.name, opts.exposure.exposes);
    const [p, f] = await Promise.all([_call(opts.paid, kind, payload), _call(opts.free, kind, payload)]);
    const model = _routeModel(opts.free);
    if (model !== null) recordRouteOutcome(opts.stateRoot, freeRoute.name, model, f.outcome);
    const row: ShadowRow = {
        ts: (opts.now ?? (() => new Date()))().toISOString(),
        kind,
        paid: await _side(opts.paid, p, kind, 'paid', opts.verify),
        free: await _side(opts.free, f, kind, 'free', opts.verify),
    };
    _append(opts.stateRoot, row);
    return { answer: p.parsed.ok ? { answer: p.text, parsed: p.parsed.value } : null, row };
}

export function readShadowLedger(stateRoot: string): ShadowRow[] {
    let raw: string;
    try {
        raw = fs.readFileSync(_ledgerPath(stateRoot), 'utf8');
    } catch {
        return [];
    }
    const rows: ShadowRow[] = [];
    for (const line of raw.split('\n')) {
        if (line.trim() === '') continue;
        try {
            const r = JSON.parse(line) as ShadowRow;
            if (typeof r.kind === 'string' && r.paid !== undefined && r.free !== undefined) rows.push(r);
        } catch {
            /* a torn line is skipped, never guessed at */
        }
    }
    return rows;
}

/** An escalation or a failed verify: a `skipped` verify on a return counts as an escalation. */
export function sideFailed(s: ShadowSide): boolean {
    return s.verified !== 'pass';
}

/** ISO-8601 week, `YYYY-Www`. */
export function isoWeek(ts: string): string {
    const d = new Date(ts);
    const day = (d.getUTCDay() + 6) % 7;
    const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);
    return `${String(thursday.getUTCFullYear())}-W${String(week).padStart(2, '0')}`;
}

export interface KindShadowStats {
    readonly kind: HandKind;
    readonly n: number;
    readonly free_rate: number;
    readonly paid_rate: number;
    /** Paid tokens of the calls whose free return passed the head's verify. */
    readonly tokens_avoided: number;
    /** The head's tokens spent verifying free returns. */
    readonly verify_tokens: number;
    readonly net: number;
    readonly weeks: { week: string; net: number }[];
}

export function shadowReport(rows: readonly ShadowRow[]): KindShadowStats[] {
    const byKind = new Map<HandKind, ShadowRow[]>();
    for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
    const out: KindShadowStats[] = [];
    for (const [kind, rs] of [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const weeks = new Map<string, number>();
        let avoided = 0;
        let verify = 0;
        for (const r of rs) {
            const saved = r.free.verified === 'pass' ? r.paid.tokens : 0;
            avoided += saved;
            verify += r.free.verify_tokens;
            const w = isoWeek(r.ts);
            weeks.set(w, (weeks.get(w) ?? 0) + saved - r.free.verify_tokens);
        }
        const rate = (pick: (r: ShadowRow) => ShadowSide): number => rs.filter((r) => sideFailed(pick(r))).length / rs.length;
        out.push({
            kind,
            n: rs.length,
            free_rate: rate((r) => r.free),
            paid_rate: rate((r) => r.paid),
            tokens_avoided: avoided,
            verify_tokens: verify,
            net: avoided - verify,
            weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, net]) => ({ week, net })),
        });
    }
    return out;
}

export function main(argv: readonly string[], cwd: string = process.cwd()): number {
    if (!argv.includes('--report')) {
        process.stderr.write('usage: free_hand_shadow --report [--json]\n');
        return 2;
    }
    const rows = readShadowLedger(cwd);
    const report = shadowReport(rows);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ rows: rows.length, cap: SHADOW_CALL_CAP, kinds: report }, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(`free-hand shadow: ${String(rows.length)} / ${String(SHADOW_CALL_CAP)} calls\n`);
    for (const k of report) {
        process.stdout.write(
            `  ${k.kind}: n=${String(k.n)} free=${k.free_rate.toFixed(3)} paid=${k.paid_rate.toFixed(3)} ` +
                `avoided=${String(k.tokens_avoided)} verify=${String(k.verify_tokens)} net=${String(k.net)}\n`,
        );
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
