/**
 * C2a — does the appeal card rescue the true best line under a noisy judge?
 * (road-to-a-loss-that-can-be-appealed 3.5)
 *
 * Drives the real engine with stub verdicts: a known true ranking, a judge that
 * reads each side's quality with Gaussian noise and swaps its reading with
 * probability `flip`, and a paid card seat that takes an independent second
 * look with the same flip rate. No model is called; nothing is spent.
 *
 * Usage: ./scripts-run src/scripts/bracket/simulate [--runs 10000] [--n 10] [--flip 0.15] [--json]
 */
import {
    collect,
    declineAppeal,
    initState,
    markOutputs,
    next,
    pairRound,
    playCard,
    type BracketState,
    type Scores,
    type Seat,
    BracketError,
} from './engine.js';

const PAID: Seat = { id: 'sim-paid', family: 'sim', billing: 'per-token' };

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gauss(r: () => number): number {
    return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
}

function flat(t: number): Scores {
    const v = Math.min(10, Math.max(0, t / 10));
    return { correctness: v, requirements: v, robustness: v, clarity: v, efficiency: v };
}

export interface SimOptions {
    readonly n: number;
    readonly flip: number;
    readonly sigma: number;
    readonly cards: boolean;
    readonly seed: number;
    /** Probability the line has new evidence when its second card is due. */
    readonly evidence: number;
}

export interface RunResult {
    readonly winner: string | null;
    readonly matches: number;
    readonly reviews: number;
    readonly cards: number;
}

/** Line i (0-based) has true quality falling from 90 to 50; L001 is the true best. */
export function quality(n: number, i: number): number {
    return n === 1 ? 90 : 90 - (40 * i) / (n - 1);
}

export function simulateOnce(o: SimOptions): RunResult {
    const r = mulberry32(o.seed);
    const s: BracketState = initState({ runId: `sim-${o.seed}`, task: 'sim', n: o.n, seed: o.seed, tier: 'sim' });
    const q = new Map(s.lines.map((l, i) => [l.id, quality(o.n, i)]));
    markOutputs(s, new Set(s.lines.map((l) => l.id)));
    let matches = 0;
    let reviews = 0;
    let cards = 0;
    for (let guard = 0; guard < 10_000; guard++) {
        const a = next(s);
        if (a.kind === 'done') return { winner: a.winner, matches, reviews, cards };
        if (a.kind === 'advance') pairRound(s);
        else if (a.kind === 'judge') {
            for (const id of a.matches) {
                const m = s.matches.find((x) => x.id === id);
                if (m === undefined || m.b === null) continue;
                let ta = (q.get(m.a) ?? 0) + o.sigma * gauss(r);
                let tb = (q.get(m.b) ?? 0) + o.sigma * gauss(r);
                if (r() < o.flip) [ta, tb] = [tb, ta];
                collect(s, id, {
                    a: flat(ta),
                    b: flat(tb),
                    fatal: { a: 'none', b: 'none' },
                    pick: ta >= tb ? 'a' : 'b',
                    seat: PAID,
                });
                matches += 1;
            }
        } else if (a.kind === 'appeal') {
            for (const id of a.lines) {
                const l = s.lines.find((x) => x.id === id);
                const lost = l?.lastLoss ? s.matches.find((m) => m.id === l.lastLoss?.match) : undefined;
                if (!o.cards || l === undefined || lost === undefined || lost.winner === null) {
                    declineAppeal(s, id);
                    continue;
                }
                reviews += 1;
                const better = (q.get(id) ?? 0) > (q.get(lost.winner) ?? 0);
                const says = r() < o.flip ? !better : better;
                if (!says) {
                    declineAppeal(s, id);
                    continue;
                }
                try {
                    playCard(s, id, { seat: PAID, newEvidence: r() < o.evidence });
                    cards += 1;
                } catch (e) {
                    if (!(e instanceof BracketError)) throw e;
                    declineAppeal(s, id);
                }
            }
        } else {
            throw new Error('simulation never generates');
        }
    }
    throw new Error(`bracket did not terminate (n=${o.n}, seed=${o.seed})`);
}

export interface ArmReport {
    readonly arm: 'no cards' | 'cards';
    readonly runs: number;
    readonly bestWins: number;
    readonly bestWinRate: number;
    readonly meanCalls: number;
    readonly meanCards: number;
}

export function runArm(n: number, runs: number, flip: number, cards: boolean, seed0 = 1): ArmReport {
    let best = 0;
    let calls = 0;
    let used = 0;
    for (let k = 0; k < runs; k++) {
        const res = simulateOnce({ n, flip, sigma: 3, cards, seed: seed0 + k, evidence: 0.5 });
        if (res.winner === 'L001') best += 1;
        // generation + 5 calls per judged match + 1 paid second look per reviewed appeal
        calls += n + 5 * res.matches + res.reviews;
        used += res.cards;
    }
    return {
        arm: cards ? 'cards' : 'no cards',
        runs,
        bestWins: best,
        bestWinRate: best / runs,
        meanCalls: calls / runs,
        meanCards: used / runs,
    };
}

function arg(name: string, fallback: number): number {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

if (process.argv[1]?.endsWith('simulate.ts') || process.argv[1]?.endsWith('simulate')) {
    const runs = arg('runs', 10_000);
    const flip = arg('flip', 0.15);
    const ns = process.argv.includes('--n') ? [arg('n', 10)] : [10, 20, 100];
    const rows = ns.flatMap((n) => [runArm(n, runs, flip, false), runArm(n, runs, flip, true)].map((r) => ({ n, ...r })));
    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    } else {
        for (const r of rows) {
            process.stdout.write(
                `n=${r.n} ${r.arm.padEnd(8)} best-wins ${(100 * r.bestWinRate).toFixed(2)}% (${r.bestWins}/${r.runs}) · mean calls ${r.meanCalls.toFixed(1)} · mean cards ${r.meanCards.toFixed(2)}\n`,
            );
        }
    }
}
