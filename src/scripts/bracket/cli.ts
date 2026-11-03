/**
 * `/judge bracket` driver — one state file, one named next action.
 *
 *   plan    --n N | --tier S1 [--agent-tier S3] [--security-surface X] [--owner-reserved ROW]
 *           [--content public-artifact|project-content] [--local-proven]
 *   init    --run ID --task FILE (--n N | --tier S1) [--seed S] [--angles FILE]
 *   scan    --run ID            mark lines whose output file exists; 2nd miss → NO OUTPUT
 *   dedupe  --run ID            merge near-duplicate lines of the last wave; report the saturation stop
 *   next    --run ID            the one action that is due
 *   advance --run ID            pair the next round
 *   collect --run ID --match M --verdict FILE
 *   correct --run ID --match M --reason misread-check|unsupported-fatal
 *   card    --run ID --line L --seat-id X --seat-family F --seat-billing B [--new-evidence] [--jury FILE]
 *   decline --run ID --line L
 *   status  --run ID [--json]
 *
 * State lives under `agents/runtime/bracket/<run>/` (gitignored): `bracket.json`,
 * `task.md`, `briefs/<line>.md`, `lines/<line>.md` (written by the line agents).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { classifyContentClass } from '../ai_council/content_ceiling.js';
import { is_near_duplicate } from '../ai_council/debate_gates.js';
import {
    BracketError,
    collect,
    correct,
    declineAppeal,
    dedupeWave,
    initState,
    markOutputs,
    next,
    pairRound,
    playCard,
    renderBrief,
    sha256,
    type BracketState,
    type Billing,
    type JuryInput,
    type NextAction,
} from './engine.js';
import { freeSeatAllowance } from './seats.js';
import { callsFor, resolveTier, saturationStop, tier, TIER_IDS, type TierId } from './tiers.js';

const ROOT = process.env.BRACKET_ROOT ?? path.join(process.cwd(), 'agents', 'runtime', 'bracket');

function flag(args: string[], name: string): string | undefined {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
}

function need(args: string[], name: string): string {
    const v = flag(args, name);
    if (v === undefined || v === '') throw new BracketError('missing-flag', `--${name} is required`);
    return v;
}

function asTier(v: string | undefined): TierId | undefined {
    if (v === undefined) return undefined;
    if (!(TIER_IDS as readonly string[]).includes(v)) throw new BracketError('bad-tier', `unknown tier ${v}`);
    return v as TierId;
}

function runDir(run: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(run) || run.includes('..')) throw new BracketError('bad-run', `run id ${run} is not a single folder name`);
    return path.join(ROOT, run);
}

function load(run: string): BracketState {
    return JSON.parse(readFileSync(path.join(runDir(run), 'bracket.json'), 'utf8')) as BracketState;
}

function save(s: BracketState): void {
    const file = path.join(runDir(s.runId), 'bracket.json');
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(s, null, 2)}\n`);
    renameSync(tmp, file);
}

export function describe(a: NextAction, run: string): string {
    switch (a.kind) {
        case 'generate':
            return `generate: dispatch ${a.lines.length} line agent(s), each writing lines/<id>.md from briefs/<id>.md, then: scan --run ${run}  [${a.lines.join(' ')}]`;
        case 'judge':
            return `judge: ${a.matches.length} match(es) — collect --run ${run} --match <id> --verdict <file>  [${a.matches.join(' ')}]`;
        case 'appeal':
            return `appeal: a paid seat reviews each — card --run ${run} --line <id> … | decline --run ${run} --line <id>  [${a.lines.join(' ')}]`;
        case 'advance':
            return `advance: advance --run ${run}`;
        case 'done':
            return a.winner === null ? 'done: no line produced output' : `done: winner ${a.winner} — run the blind final comparison; never auto-apply`;
    }
}

export function main(argv: string[]): number {
    const [cmd, ...args] = argv;
    const out = (s: string): void => {
        process.stdout.write(`${s}\n`);
    };
    switch (cmd) {
        case 'plan': {
            const explicit = flag(args, 'n');
            const decision = resolveTier({
                userRequested: asTier(flag(args, 'tier')),
                agentProposed: asTier(flag(args, 'agent-tier')),
                securitySurfaceHit: flag(args, 'security-surface') ?? null,
                ownerReservedRow: flag(args, 'owner-reserved') ?? null,
            });
            const n = explicit !== undefined ? Number(explicit) : decision.n;
            const seats = freeSeatAllowance(n, classifyContentClass(flag(args, 'content')), args.includes('--local-proven'));
            out(`tier ${decision.tier} (${decision.reason}) · ceiling ${n} lines · ≤ ${callsFor(n)} calls before appeals`);
            if (decision.refused) out(`refused: ${decision.refused}`);
            out(seats.planLine);
            if (tier(decision.tier).askAlways) out('ask once: S3/S4 run only after the user confirms this plan');
            return 0;
        }
        case 'init': {
            const run = need(args, 'run');
            const dir = runDir(run);
            if (existsSync(path.join(dir, 'bracket.json'))) throw new BracketError('exists', `run ${run} already exists`);
            const task = readFileSync(need(args, 'task'), 'utf8');
            const t = asTier(flag(args, 'tier')) ?? 'S1';
            const n = flag(args, 'n') !== undefined ? Number(flag(args, 'n')) : tier(t).n;
            const anglesFile = flag(args, 'angles');
            const angles = anglesFile ? readFileSync(anglesFile, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean) : [];
            const s = initState({ runId: run, task, n, seed: Number(flag(args, 'seed') ?? 1), tier: t });
            mkdirSync(path.join(dir, 'briefs'), { recursive: true });
            mkdirSync(path.join(dir, 'lines'), { recursive: true });
            writeFileSync(path.join(dir, 'task.md'), task);
            s.lines.forEach((l, i) => {
                writeFileSync(path.join(dir, 'briefs', `${l.id}.md`), renderBrief(task, l.id, angles.length > 0 ? (angles[i % angles.length] ?? null) : null));
            });
            save(s);
            out(`initialised ${run}: ${n} lines, task ${s.taskHash.slice(0, 12)}`);
            out(describe(next(s), run));
            return 0;
        }
        case 'scan': {
            const s = load(need(args, 'run'));
            const dir = runDir(s.runId);
            if (sha256(readFileSync(path.join(dir, 'task.md'), 'utf8')) !== s.taskHash) {
                throw new BracketError('task-drift', 'task.md no longer matches the hash recorded at init');
            }
            const present = new Set(
                s.lines
                    .filter((l) => {
                        const f = path.join(dir, 'lines', `${l.id}.md`);
                        return existsSync(f) && statSync(f).size > 0;
                    })
                    .map((l) => l.id),
            );
            markOutputs(s, present);
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'dedupe': {
            const s = load(need(args, 'run'));
            const dir = runDir(s.runId);
            const seen = new Set(s.deduped ?? []);
            const wave = s.lines.filter((l) => l.status === 'alive' && !seen.has(l.id)).map((l) => l.id);
            const texts = new Map(
                s.lines
                    .filter((l) => l.status === 'alive')
                    .map((l) => [l.id, readFileSync(path.join(dir, 'lines', `${l.id}.md`), 'utf8')] as const),
            );
            const r = dedupeWave(s, texts, (a, b) => is_near_duplicate(a, b), wave);
            save(s);
            out(`wave ${s.waves?.length ?? 0}: ${wave.length} spawned, ${r.novel} novel${r.duplicates.length ? `, duplicates ${r.duplicates.join(' ')}` : ''}`);
            if (saturationStop(s.waves ?? [])) out('saturation stop: two waves under 20 % new lines — spawn no more of the same; add another model family where allowed');
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'next': {
            const s = load(need(args, 'run'));
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'advance': {
            const s = load(need(args, 'run'));
            const made = pairRound(s);
            save(s);
            out(`round ${s.round}: ${made.map((m) => `${m.id} ${m.a} vs ${m.b ?? 'bye'}`).join(' · ')}`);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'collect': {
            const s = load(need(args, 'run'));
            const m = collect(s, need(args, 'match'), JSON.parse(readFileSync(need(args, 'verdict'), 'utf8')));
            save(s);
            out(`${m.id}: ${m.winner} beats ${m.loser}${m.notes.length ? ` (${m.notes.join('; ')})` : ''}`);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'correct': {
            const s = load(need(args, 'run'));
            const reason = need(args, 'reason');
            if (reason !== 'misread-check' && reason !== 'unsupported-fatal') throw new BracketError('bad-reason', `unknown reason ${reason}`);
            correct(s, need(args, 'match'), reason);
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'card': {
            const s = load(need(args, 'run'));
            const juryFile = flag(args, 'jury');
            playCard(s, need(args, 'line'), {
                seat: { id: need(args, 'seat-id'), family: need(args, 'seat-family'), billing: need(args, 'seat-billing') as Billing },
                newEvidence: args.includes('--new-evidence'),
                jury: juryFile ? (JSON.parse(readFileSync(juryFile, 'utf8')) as JuryInput) : null,
            });
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'decline': {
            const s = load(need(args, 'run'));
            declineAppeal(s, need(args, 'line'));
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'status': {
            const s = load(need(args, 'run'));
            if (args.includes('--json')) {
                out(JSON.stringify(s, null, 2));
                return 0;
            }
            const count = (st: string): number => s.lines.filter((l) => l.status === st).length;
            out(`${s.runId} · tier ${s.tier} · round ${s.round} · alive ${count('alive')} · eliminated ${count('eliminated')} · no-output ${count('no-output')} · duplicates ${count('duplicate')}`);
            for (const m of s.matches.filter((x) => x.appeal === 'card' || x.appeal === 'corrected')) out(`  ${m.id}: ${m.notes.join('; ')}`);
            out(describe(next(s), s.runId));
            return 0;
        }
        default:
            out('usage: cli <plan|init|scan|next|advance|collect|correct|card|decline|status> …');
            return 2;
    }
}

if (process.argv[1]?.endsWith(`bracket${path.sep}cli.ts`) || process.argv[1]?.endsWith('bracket/cli')) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof BracketError) {
            process.stderr.write(`bracket: ${e.code}: ${e.message}\n`);
            process.exitCode = 1;
        } else throw e;
    }
}
