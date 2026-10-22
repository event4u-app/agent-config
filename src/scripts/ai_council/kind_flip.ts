#!/usr/bin/env node
/**
 * Per-kind flip of typed hands to the free route (free-hands 6.3).
 *
 * A kind is served by a free route only after the shadow ledger clears both
 * pre-registered bars for it: `free-hands-quality-held` (free failure rate at
 * most the paid rate + 5 pp, and below the 0.3 escalation kill) and
 * `free-hands-limit-relief` (paid tokens avoided minus the head's verify tokens
 * above zero in every shadow week). Missing or underpowered data is "not
 * ready" — never a flip.
 *
 * A flipped kind whose free-routed asks reach the kill reverts on its own and
 * stays reverted: the same shadow data that was outvoted by live data does not
 * flip it back, so a re-flip needs the record cleared by a person. Every flip
 * and every reversion is an event in gitignored runtime state, with one line a
 * claim row can cite. This module never edits `docs/CLAIMS.md`.
 *
 * Usage: ./scripts-run src/scripts/ai_council/kind_flip [--apply] [--audit-dir <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readShadowLedger, shadowReport, SHADOW_CALL_CAP, type KindShadowStats } from './free_hand_shadow.js';
import { HAND_KINDS, isHandKind, isUnpaid, ROUTE_BILLINGS, type HandKind, type RouteBilling, type VerifyVerdict } from '../_lib/hand_kinds.js';

/** The escalation kill registered on `ask_economy`; the quality claim's second half. */
export const ESCALATION_KILL = 0.3;
export const QUALITY_MARGIN = 0.05;
/** The A5 cap shared evenly across the kinds; below it a kind's rates settle nothing. */
export const MIN_SHADOW_PER_KIND = Math.floor(SHADOW_CALL_CAP / HAND_KINDS.length);
/** Free-routed asks a flipped kind needs before its live rate may revert it. */
export const REVERT_MIN_SAMPLE = 30;

import { KIND_FLIPS_RELPATH } from './kind_flip_state.js';
export { isKindFlipped, KIND_FLIPS_RELPATH } from './kind_flip_state.js';

export interface FlipVerdict {
    readonly ready: boolean;
    readonly reasons: string[];
}

export function flipVerdict(s: KindShadowStats | undefined): FlipVerdict {
    if (s === undefined) return { ready: false, reasons: ['no shadow data'] };
    const reasons: string[] = [];
    if (s.n < MIN_SHADOW_PER_KIND) reasons.push(`underpowered: ${String(s.n)} of ${String(MIN_SHADOW_PER_KIND)} shadow calls`);
    if (s.free_rate > s.paid_rate + QUALITY_MARGIN) {
        reasons.push(`quality margin: free ${s.free_rate.toFixed(3)} > paid ${s.paid_rate.toFixed(3)} + ${String(QUALITY_MARGIN)}`);
    }
    if (s.free_rate >= ESCALATION_KILL) reasons.push(`kill: free ${s.free_rate.toFixed(3)} >= ${String(ESCALATION_KILL)}`);
    if (s.weeks.length === 0 || s.weeks.some((w) => w.net <= 0)) reasons.push('relief: a shadow week without net relief after verify tokens');
    return { ready: reasons.length === 0, reasons };
}

/** One free-routed typed ask after a flip, as the head recorded its verify. */
export interface FreeObservation {
    readonly kind: HandKind;
    readonly verified: VerifyVerdict;
    readonly ts: string;
}

const _BILLINGS: ReadonlySet<string> = new Set<string>(ROUTE_BILLINGS);

/** The free-routed asks among orchestration audit lines. */
export function observationsFromAuditLines(lines: readonly Record<string, unknown>[]): FreeObservation[] {
    const out: FreeObservation[] = [];
    for (const l of lines) {
        const o = (l['orchestration'] ?? {}) as Record<string, unknown>;
        const billing = o['route_billing'];
        const verified = o['verified'];
        if (o['route_taken'] !== 'ask' || !isHandKind(o['hand_kind']) || typeof l['ts'] !== 'string') continue;
        if (typeof billing !== 'string' || !_BILLINGS.has(billing) || !isUnpaid(billing as RouteBilling)) continue;
        if (verified !== 'pass' && verified !== 'fail' && verified !== 'skipped') continue;
        out.push({ kind: o['hand_kind'] as HandKind, verified, ts: l['ts'] });
    }
    return out;
}

export interface FlipEvent {
    readonly ts: string;
    readonly kind: HandKind;
    readonly to: 'free' | 'paid';
    readonly n: number;
    readonly free_rate: number;
    readonly line: string;
}

interface KindState {
    readonly route: 'free' | 'paid';
    readonly since: string;
    readonly reverted?: true;
}

interface Store {
    kinds: Partial<Record<HandKind, KindState>>;
    events: FlipEvent[];
}

function _path(stateRoot: string): string {
    return path.join(stateRoot, KIND_FLIPS_RELPATH);
}

function _read(stateRoot: string): Store {
    try {
        const raw = JSON.parse(fs.readFileSync(_path(stateRoot), 'utf8')) as Partial<Store>;
        return { kinds: raw.kinds ?? {}, events: Array.isArray(raw.events) ? raw.events : [] };
    } catch {
        return { kinds: {}, events: [] };
    }
}

function _write(stateRoot: string, store: Store): void {
    const target = _path(stateRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, target);
}


function _flipLine(kind: HandKind, day: string, s: KindShadowStats): string {
    return (
        `free-hands-quality-held: ${kind} flipped to the free route on ${day} — shadow n=${String(s.n)}, ` +
        `free ${s.free_rate.toFixed(3)} vs paid ${s.paid_rate.toFixed(3)}, net relief ${String(s.net)} tokens`
    );
}

function _revertLine(kind: HandKind, day: string, n: number, rate: number): string {
    return (
        `free-hands-quality-held: ${kind} reverted to the paid route on ${day} — free failure rate ` +
        `${rate.toFixed(3)} over ${String(n)} free-routed asks >= kill ${String(ESCALATION_KILL)}`
    );
}

/** The live breach that reverts a flipped kind: free-routed asks since the flip, at or above the kill. */
function _revertOf(kind: HandKind, state: KindState, live: readonly FreeObservation[]): { n: number; rate: number } | null {
    const since = live.filter((o) => o.kind === kind && o.ts >= state.since);
    if (since.length < REVERT_MIN_SAMPLE) return null;
    // A `skipped` verify on a free return counts as an escalation, as in the claim.
    const rate = since.filter((o) => o.verified !== 'pass').length / since.length;
    return rate >= ESCALATION_KILL ? { n: since.length, rate } : null;
}

export interface ApplyInput {
    readonly shadow: readonly KindShadowStats[];
    readonly live: readonly FreeObservation[];
    readonly now?: Date;
}

/** Flip the ready kinds, revert the breaching ones; returns this pass's events. */
export function applyFlips(stateRoot: string, input: ApplyInput): FlipEvent[] {
    const store = _read(stateRoot);
    const now = input.now ?? new Date();
    const ts = now.toISOString();
    const day = ts.slice(0, 10);
    const events: FlipEvent[] = [];
    for (const kind of HAND_KINDS) {
        const state = store.kinds[kind];
        if (state?.route === 'free') {
            const breach = _revertOf(kind, state, input.live);
            if (breach === null) continue;
            store.kinds[kind] = { route: 'paid', since: ts, reverted: true };
            events.push({ ts, kind, to: 'paid', n: breach.n, free_rate: breach.rate, line: _revertLine(kind, day, breach.n, breach.rate) });
            continue;
        }
        if (state?.reverted === true) continue;
        const s = input.shadow.find((x) => x.kind === kind);
        if (s === undefined || !flipVerdict(s).ready) continue;
        store.kinds[kind] = { route: 'free', since: ts };
        events.push({ ts, kind, to: 'free', n: s.n, free_rate: s.free_rate, line: _flipLine(kind, day, s) });
    }
    if (events.length > 0) {
        store.events.push(...events);
        _write(stateRoot, store);
    }
    return events;
}

function _auditLines(dir: string): Record<string, unknown>[] {
    let files: string[];
    try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return [];
    }
    const out: Record<string, unknown>[] = [];
    for (const f of files) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
            if (line.trim() === '') continue;
            try {
                out.push(JSON.parse(line) as Record<string, unknown>);
            } catch {
                /* a torn line is skipped */
            }
        }
    }
    return out;
}

export async function main(argv: readonly string[], cwd: string = process.cwd()): Promise<number> {
    const i = argv.indexOf('--audit-dir');
    const { DEFAULT_DIR } = await import('../orchestration_record.js');
    const auditDir = i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : path.join(cwd, DEFAULT_DIR);
    const shadow = shadowReport(readShadowLedger(cwd));
    if (argv.includes('--apply')) {
        for (const e of applyFlips(cwd, { shadow, live: observationsFromAuditLines(_auditLines(auditDir)) })) {
            process.stdout.write(`${e.line}\n`);
        }
    }
    for (const kind of HAND_KINDS) {
        const v = flipVerdict(shadow.find((s) => s.kind === kind));
        const route = isKindFlipped(cwd, kind) ? 'free' : 'paid';
        process.stdout.write(`  ${kind}: ${route}${v.ready ? '' : ` · not ready: ${v.reasons.join('; ')}`}\n`);
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    void main(process.argv.slice(2)).then((code) => process.exit(code));
}
