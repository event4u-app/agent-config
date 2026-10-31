/**
 * A resumable bracket whose losses can be appealed
 * (road-to-a-loss-that-can-be-appealed Phases 1, 3, 5).
 *
 * Every transition is a pure function over one serialisable `BracketState`, so
 * the run survives compaction: `next` reads the state and names the one action
 * that is due. The script computes every result — a judge supplies rubric
 * scores and a pick, never the winner.
 *
 * The appeal jury is an optional, recorded INPUT and never imported from
 * `jury_aggregate`: that module is pinned shadow-only until its ledger
 * accumulates (AC-9 of its roadmap). The card itself is played by a paid seat.
 */
import { createHash } from 'node:crypto';

import { judgeBothOrders, type PairwiseJudge } from '../ai_council/judge_position_bias.js';

export const BILLINGS = ['subscription', 'per-token', 'free-quota', 'self-hosted'] as const;
export type Billing = (typeof BILLINGS)[number];

/** Mirrors `MAX_JURY_JUDGES`; restated so this module does not consume the shadow jury. */
export const MAX_JURY_SEATS = 5;
export const MAX_CARDS = 2;
export const CLOSE_GAP = 5;
export const DEFAULT_AUDIT_RATE = 0.1;

/** Each criterion is scored 0–10; weights sum to 100. */
export const RUBRIC = { correctness: 35, requirements: 25, robustness: 20, clarity: 10, efficiency: 10 } as const;
export type Criterion = keyof typeof RUBRIC;
export type Scores = Record<Criterion, number>;

export interface Seat {
    readonly id: string;
    readonly family: string;
    readonly billing: Billing;
}

export type FatalState = 'none' | 'upheld' | 'rebutted';

export interface Verdict {
    readonly a: Scores;
    readonly b: Scores;
    readonly fatal: { readonly a: FatalState; readonly b: FatalState };
    readonly pick: 'a' | 'b';
    readonly seat: Seat;
}

export type LineStatus = 'pending' | 'alive' | 'eliminated' | 'no-output' | 'duplicate';

export interface Line {
    id: string;
    lineage: string;
    status: LineStatus;
    attempts: number;
    eliminations: number;
    cards: number;
    lostTo: string[];
    lastLoss: { match: string; upheldFatal: boolean } | null;
}

export type AppealState = 'open' | 'card' | 'declined' | 'corrected';

export interface Match {
    id: string;
    round: number;
    a: string;
    b: string | null;
    verdict: Verdict | null;
    winner: string | null;
    loser: string | null;
    notes: string[];
    signals: string[];
    appeal: AppealState | null;
}

export interface BracketState {
    version: 1;
    runId: string;
    taskHash: string;
    tier: string;
    seed: number;
    round: number;
    auditRate: number;
    lines: Line[];
    matches: Match[];
    /** Generation waves after dedupe, read by the saturation stop. */
    waves?: { spawned: number; novel: number }[];
    /** Lines already passed through a dedupe wave. */
    deduped?: string[];
    log: string[];
}

export class BracketError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

export function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function unit(seed: number, salt: string): number {
    return parseInt(sha256(`${seed}:${salt}`).slice(0, 8), 16) / 0x100000000;
}

export function lineId(i: number): string {
    return `L${String(i + 1).padStart(3, '0')}`;
}

export interface InitOptions {
    readonly runId: string;
    readonly task: string;
    readonly n: number;
    readonly seed: number;
    readonly tier: string;
    readonly auditRate?: number;
}

export function initState(o: InitOptions): BracketState {
    if (!Number.isInteger(o.n) || o.n < 1) throw new BracketError('bad-n', `n must be a positive integer, got ${o.n}`);
    const lines: Line[] = Array.from({ length: o.n }, (_, i) => ({
        id: lineId(i),
        lineage: lineId(i),
        status: 'pending',
        attempts: 0,
        eliminations: 0,
        cards: 0,
        lostTo: [],
        lastLoss: null,
    }));
    return {
        version: 1,
        runId: o.runId,
        taskHash: sha256(o.task),
        tier: o.tier,
        seed: o.seed,
        round: 0,
        auditRate: o.auditRate ?? DEFAULT_AUDIT_RATE,
        lines,
        matches: [],
        log: [`init n=${o.n} tier=${o.tier} seed=${o.seed}`],
    };
}

/** The task travels byte-identical; only the header differs per line. */
export function renderBrief(task: string, id: string, angle: string | null): string {
    const head = angle === null ? `# Line ${id}\n\n` : `# Line ${id}\n\nApproach: ${angle}\n\n`;
    return `${head}## Task (verbatim)\n\n${task}`;
}

function line(s: BracketState, id: string): Line {
    const l = s.lines.find((x) => x.id === id);
    if (l === undefined) throw new BracketError('unknown-line', `no line ${id}`);
    return l;
}

function match(s: BracketState, id: string): Match {
    const m = s.matches.find((x) => x.id === id);
    if (m === undefined) throw new BracketError('unknown-match', `no match ${id}`);
    return m;
}

/**
 * Completion is the output's presence. A line missing after its second request
 * is `no-output` — never waited on.
 */
export function markOutputs(s: BracketState, present: ReadonlySet<string>): void {
    for (const l of s.lines) {
        if (l.status !== 'pending') continue;
        if (present.has(l.id)) {
            l.status = 'alive';
        } else {
            l.attempts += 1;
            if (l.attempts >= 2) {
                l.status = 'no-output';
                s.log.push(`${l.id} NO OUTPUT after ${l.attempts} requests`);
            }
        }
    }
}

/**
 * Dedupe one wave: each alive line whose text is a near-duplicate of an earlier
 * alive line joins that line's lineage. Records the wave for the saturation stop.
 */
export function dedupeWave(
    s: BracketState,
    texts: ReadonlyMap<string, string>,
    near: (a: string, b: string) => boolean,
    spawnedIds: readonly string[],
): { novel: number; duplicates: string[] } {
    const done = new Set(s.deduped ?? []);
    const kept: string[] = s.lines.filter((l) => l.status === 'alive' && done.has(l.id)).map((l) => l.id);
    const duplicates: string[] = [];
    let novel = 0;
    for (const id of spawnedIds) {
        if (line(s, id).status !== 'alive') continue;
        const body = texts.get(id) ?? '';
        const of = kept.find((k) => near(texts.get(k) ?? '', body));
        if (of === undefined) {
            kept.push(id);
            novel += 1;
        } else {
            markDuplicate(s, id, of);
            duplicates.push(id);
        }
    }
    (s.waves ??= []).push({ spawned: spawnedIds.length, novel });
    (s.deduped ??= []).push(...spawnedIds);
    return { novel, duplicates };
}

/** A near-duplicate joins the lineage it copies; its card count is that lineage's. */
export function markDuplicate(s: BracketState, id: string, of: string): void {
    const l = line(s, id);
    const o = line(s, of);
    l.status = 'duplicate';
    l.lineage = o.lineage;
    s.log.push(`${id} duplicate-of ${of}`);
}

export function total(sc: Scores): number {
    let t = 0;
    for (const k of Object.keys(RUBRIC) as Criterion[]) t += (RUBRIC[k] * sc[k]) / 10;
    return Math.round(t * 100) / 100;
}

export function decide(v: Verdict): { winner: 'a' | 'b'; notes: string[] } {
    const notes: string[] = [];
    const fa = v.fatal.a === 'upheld';
    const fb = v.fatal.b === 'upheld';
    if (fa !== fb) {
        notes.push('upheld FATAL decides');
        return { winner: fa ? 'b' : 'a', notes };
    }
    const ta = total(v.a);
    const tb = total(v.b);
    const byPoints: 'a' | 'b' | null = ta === tb ? null : ta > tb ? 'a' : 'b';
    if (byPoints === null) return { winner: v.pick, notes: ['tie on points; pick decides'] };
    if (byPoints !== v.pick) notes.push(`pick ${v.pick} overruled by points (${ta} vs ${tb})`);
    return { winner: byPoints, notes };
}

function validScores(sc: unknown): sc is Scores {
    if (typeof sc !== 'object' || sc === null) return false;
    return (Object.keys(RUBRIC) as Criterion[]).every((k) => {
        const v = (sc as Record<string, unknown>)[k];
        return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10;
    });
}

export function validateVerdict(raw: unknown): Verdict {
    const v = raw as Partial<Verdict> | null;
    const fatalOk = (f: unknown): boolean => f === 'none' || f === 'upheld' || f === 'rebutted';
    if (
        v === null ||
        typeof v !== 'object' ||
        !validScores(v.a) ||
        !validScores(v.b) ||
        (v.pick !== 'a' && v.pick !== 'b') ||
        typeof v.fatal !== 'object' ||
        v.fatal === null ||
        !fatalOk(v.fatal.a) ||
        !fatalOk(v.fatal.b) ||
        typeof v.seat !== 'object' ||
        v.seat === null ||
        typeof v.seat.id !== 'string' ||
        typeof v.seat.family !== 'string' ||
        !(BILLINGS as readonly string[]).includes(v.seat.billing as string)
    ) {
        throw new BracketError('unreadable-verdict', 'verdict is unreadable — request it again; the orchestrator never picks');
    }
    return v as Verdict;
}

export function alive(s: BracketState): Line[] {
    return s.lines.filter((l) => l.status === 'alive');
}

function currentOpen(s: BracketState): Match[] {
    return s.matches.filter((m) => m.round === s.round && m.winner === null);
}

export function openAppeals(s: BracketState): Match[] {
    return s.matches.filter((m) => m.appeal === 'open');
}

/** Pair the alive lines; a returnee meets a NEW opponent unless nobody else is left. */
export function pairRound(s: BracketState): Match[] {
    if (currentOpen(s).length > 0 || openAppeals(s).length > 0) {
        throw new BracketError('round-open', 'the current round still has open matches or appeals');
    }
    const pool = alive(s)
        .map((l) => l.id)
        .sort((x, y) => unit(s.seed, `${s.round + 1}:${x}`) - unit(s.seed, `${s.round + 1}:${y}`));
    if (pool.length < 2) return [];
    s.round += 1;
    const made: Match[] = [];
    const met = (x: string, y: string): boolean => line(s, x).lostTo.includes(y) || line(s, y).lostTo.includes(x);
    let k = 0;
    while (pool.length > 0) {
        const a = pool.shift() as string;
        let idx = pool.findIndex((y) => !met(a, y));
        if (idx < 0 && pool.length > 0) idx = 0;
        const b = idx < 0 ? null : (pool.splice(idx, 1)[0] as string);
        const m: Match = {
            id: `R${s.round}M${++k}`,
            round: s.round,
            a,
            b,
            verdict: null,
            winner: b === null ? a : null,
            loser: null,
            notes: b === null ? ['bye'] : [],
            signals: [],
            appeal: null,
        };
        if (b !== null && met(a, b)) m.notes.push('rematch: no other opponent left');
        made.push(m);
    }
    s.matches.push(...made);
    return made;
}

/** ADR-257 made mechanical for this surface: a free-quota seat never carries a verdict. */
export function collect(s: BracketState, matchId: string, raw: unknown): Match {
    const m = match(s, matchId);
    if (m.winner !== null) throw new BracketError('match-closed', `${matchId} already has a winner`);
    if (m.b === null) throw new BracketError('bye', `${matchId} is a bye`);
    const v = validateVerdict(raw);
    if (v.seat.billing === 'free-quota') {
        throw new BracketError(
            'free-seat-verdict',
            `${matchId}: seat ${v.seat.id} is free-quota — an unpaid route may score, never decide (ADR-257)`,
        );
    }
    const d = decide(v);
    const winner = d.winner === 'a' ? m.a : m.b;
    const loser = d.winner === 'a' ? m.b : m.a;
    const loserSide: 'a' | 'b' = d.winner === 'a' ? 'b' : 'a';
    const winSide: 'a' | 'b' = d.winner;
    m.verdict = v;
    m.winner = winner;
    m.loser = loser;
    m.notes.push(...d.notes);
    const l = line(s, loser);
    l.status = 'eliminated';
    l.eliminations += 1;
    l.lostTo.push(winner);
    const upheld = v.fatal[loserSide] === 'upheld';
    l.lastLoss = { match: m.id, upheldFatal: upheld };
    const gap = Math.abs(total(v.a) - total(v.b));
    if (gap <= CLOSE_GAP) m.signals.push(`close gap ${gap}`);
    if (d.notes.some((n) => n.startsWith('pick '))) m.signals.push('pick ≠ points');
    if (v[loserSide].correctness > v[winSide].correctness) m.signals.push('loser more correct');
    if (v.fatal[loserSide] === 'rebutted') m.signals.push('FATAL rebutted');
    if (unit(s.seed, `audit:${m.id}`) < s.auditRate) m.signals.push('audit sample');
    m.appeal = m.signals.length > 0 && l.cards < MAX_CARDS && !upheld ? 'open' : null;
    s.log.push(`${m.id} ${winner} beats ${loser}${m.appeal === 'open' ? ` — appealable (${m.signals.join(', ')})` : ''}`);
    return m;
}

/**
 * A judging error — a misread check, an unsupported FATAL — reverses the match
 * and spends no card. Only while the round is still open.
 */
export function correct(s: BracketState, matchId: string, reason: 'misread-check' | 'unsupported-fatal'): Match {
    const m = match(s, matchId);
    if (m.winner === null || m.loser === null) throw new BracketError('match-open', `${matchId} has no result to correct`);
    if (m.round !== s.round) throw new BracketError('round-closed', `${matchId} is from a closed round`);
    if (m.appeal === 'corrected' || m.appeal === 'card') {
        throw new BracketError('already-settled', `${matchId} was already ${m.appeal}`);
    }
    const was = line(s, m.loser);
    const now = line(s, m.winner);
    was.status = 'alive';
    was.eliminations -= 1;
    was.lostTo.pop();
    was.lastLoss = null;
    now.status = 'eliminated';
    now.eliminations += 1;
    now.lostTo.push(was.id);
    now.lastLoss = { match: m.id, upheldFatal: false };
    [m.winner, m.loser] = [was.id, now.id];
    m.appeal = 'corrected';
    m.notes.push(`corrected: ${reason} — no card spent`);
    s.log.push(`${m.id} corrected (${reason}): ${was.id} beats ${now.id}`);
    return m;
}

export interface JuryInput {
    readonly resolution: 'a' | 'b' | 'tie' | 'inconsistent';
    readonly seats: readonly Seat[];
}

export interface CardOptions {
    readonly seat: Seat;
    readonly newEvidence: boolean;
    /** Advisory input; recorded, never decisive. */
    readonly jury?: JuryInput | null;
}

/** The "you go through" card: ≤ 2 per lineage, a paid seat, never an overturn. */
export function playCard(s: BracketState, lineIdArg: string, o: CardOptions): Line {
    const l = line(s, lineIdArg);
    const m = l.lastLoss === null ? null : match(s, l.lastLoss.match);
    if (l.status !== 'eliminated' || m === null || m.appeal !== 'open') {
        throw new BracketError('no-open-appeal', `${l.id} has no open appeal`);
    }
    const spent = s.lines.filter((x) => x.lineage === l.lineage).reduce((n, x) => n + x.cards, 0);
    if (spent >= MAX_CARDS) throw new BracketError('cards-exhausted', `lineage ${l.lineage} spent ${spent} cards`);
    if (spent === 1 && !o.newEvidence) throw new BracketError('second-card-needs-evidence', 'the second card needs new evidence');
    if (!(BILLINGS as readonly string[]).includes(o.seat.billing)) throw new BracketError('bad-billing', `unknown billing ${o.seat.billing}`);
    if (o.seat.billing === 'free-quota') throw new BracketError('free-seat-card', 'a free-quota seat never plays the card (ADR-257)');
    if (l.lastLoss?.upheldFatal) throw new BracketError('fatal-stands', `${l.id} lost on an upheld FATAL`);
    if (o.jury) {
        const fams = new Set(o.jury.seats.map((x) => x.family));
        if (o.jury.seats.length > MAX_JURY_SEATS || fams.size < 2 || !o.jury.seats.some((x) => x.billing !== 'free-quota')) {
            throw new BracketError('jury-shape', 'appeal jury needs ≤ 5 seats, ≥ 2 families and ≥ 1 paid seat');
        }
    }
    l.cards += 1;
    l.status = 'alive';
    m.appeal = 'card';
    m.notes.push(`card ${spent + 1} for ${l.id} by ${o.seat.id}${o.jury ? ` (jury: ${o.jury.resolution})` : ''}`);
    s.log.push(`card ${spent + 1}/${MAX_CARDS} → ${l.id} returns against a new opponent`);
    return l;
}

export function declineAppeal(s: BracketState, lineIdArg: string): void {
    const l = line(s, lineIdArg);
    const m = l.lastLoss === null ? null : match(s, l.lastLoss.match);
    if (m === null || m.appeal !== 'open') throw new BracketError('no-open-appeal', `${l.id} has no open appeal`);
    m.appeal = 'declined';
    s.log.push(`${l.id} appeal declined`);
}

export type NextAction =
    | { kind: 'generate'; lines: string[] }
    | { kind: 'judge'; matches: string[] }
    | { kind: 'appeal'; lines: string[] }
    | { kind: 'advance' }
    | { kind: 'done'; winner: string | null };

export function next(s: BracketState): NextAction {
    const pending = s.lines.filter((l) => l.status === 'pending').map((l) => l.id);
    if (pending.length > 0) return { kind: 'generate', lines: pending };
    const open = currentOpen(s).map((m) => m.id);
    if (open.length > 0) return { kind: 'judge', matches: open };
    const appeals = openAppeals(s).map((m) => m.loser as string);
    if (appeals.length > 0) return { kind: 'appeal', lines: appeals };
    const live = alive(s);
    if (live.length <= 1) return { kind: 'done', winner: live[0]?.id ?? null };
    return { kind: 'advance' };
}

/** Blind close: winner vs. the rejected baseline in both orders; never applied automatically. */
export function finalCompare(
    winner: string,
    baseline: string,
    judge: PairwiseJudge,
): 'winner' | 'baseline' | 'tie' | 'no clear winner' {
    const r = judgeBothOrders('final', winner, baseline, judge).resolution;
    return r === 'a' ? 'winner' : r === 'b' ? 'baseline' : r === 'tie' ? 'tie' : 'no clear winner';
}
