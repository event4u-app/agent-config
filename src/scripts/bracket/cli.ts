/**
 * `/judge bracket` driver — one state file, one named next action.
 *
 *   plan    --n N | --tier S1 [--agent-tier S3] [--security-surface X] [--owner-reserved ROW]
 *           [--content public-artifact|project-content] [--local-proven]
 *   init    --run ID --task FILE (--n N | --tier S1) [--seed S] [--angles FILE]
 *           without --angles every line is dealt a distinct angle from the built-in deck (deck.ts)
 *   scan    --run ID            mark lines whose output file exists; 2nd miss → NO OUTPUT
 *   dedupe  --run ID            merge near-duplicate lines of the last wave; report the saturation stop
 *   next    --run ID            the one action that is due
 *   advance --run ID            pair the next round
 *   briefs  --run ID --match M --seat-id X --seat-family F --seat-billing B
 *           write the match's attack / defend / judge briefs under matches/<M>/briefs/
 *           copies both lines to matches/<M>/original-{a,b}.md (revised-* starts as the same text),
 *           records the judge seat in seat.json; refuses a closed match and a free-quota seat
 *   collect --run ID --match M [--verdict FILE]   default FILE: matches/<M>/verdict.json in the run;
 *           refuses a seat that differs from seat.json; the winner's revision becomes lines/<id>.md
 *   correct --run ID --match M --reason misread-check|unsupported-fatal
 *   card    --run ID --line L --seat-id X --seat-family F --seat-billing B [--new-evidence] [--jury FILE]
 *   decline --run ID --line L [--jury FILE]
 *           card/decline without --jury: pass --no-jury "<reason>" (e.g. "one paid family"); it is logged
 *   jury    --run ID --line L --jury FILE [--new-evidence] [--jury-mode binding]
 *           FILE: JSON array of juror votes `{ seat: {id,family,billing}, ab, ba }`,
 *           ab/ba ∈ readmit|deny (the eliminated line shown first / second).
 *           `card`/`decline` record it as the shadow jury; `jury` lets it decide
 *           and is refused until `binding` is unlocked (appeal_jury.ts).
 *   status  --run ID [--json]
 *   name    --run ID (--text "<name>" | --decision "<one line>") [--force]
 *           writes name.json beside bracket.json as `by: "agent"` (name.ts); an empty value clears the
 *           field; a field the user set is kept unless --force; --decision records the current champion.
 *           Without --text/--decision prints name.json.
 *
 * State lives under `agents/runtime/bracket/<run>/` (gitignored): `bracket.json`,
 * `task.md`, `angles.json`, `briefs/<line>.md`, `lines/<line>.md` (written by the line
 * agents), `matches/<M>/` (attacks, defences, revisions, verdict).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { classifyContentClass } from '../ai_council/content_ceiling.js';
import { is_near_duplicate } from '../ai_council/debate_gates.js';
import {
    appealByJury,
    BILLINGS,
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
    type NextAction,
} from './engine.js';
import { resolveJuryMode, tallyAppealJury, type JurorVote, type JuryRecord } from './appeal_jury.js';
import { dealAngles, type Angle } from './deck.js';
import { applyAgentWrite, readRunName, writeRunName, type RunName } from './name.js';
import { matchBriefs } from './roles.js';
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

function shadowJury(args: string[]): JuryRecord | null {
    const file = flag(args, 'jury');
    if (file === undefined) return null;
    if (resolveJuryMode(flag(args, 'jury-mode')) === 'off') return null;
    return tallyAppealJury(JSON.parse(readFileSync(file, 'utf8')) as JurorVote[]);
}

/**
 * A shadow decision without a jury is logged with its reason, so the claim's
 * corpus can tell an intentional opt-out from a missing paid family from a
 * skipped jury.
 */
function noteMissingJury(s: BracketState, args: string[]): void {
    if (flag(args, 'jury') !== undefined) return;
    const mode = resolveJuryMode(flag(args, 'jury-mode'));
    const why = mode === 'off' ? 'jury-mode off' : (flag(args, 'no-jury') ?? 'no reason given');
    s.log.push(`${need(args, 'line')} appeal decided without a shadow jury (${why})`);
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

/**
 * The line that leads now: the winner once the run is done, otherwise the
 * still-alive winner of the most recent decided match. `null` before any match.
 */
export function currentChampion(s: BracketState): string | null {
    const n = next(s);
    if (n.kind === 'done') return n.winner;
    for (let i = s.matches.length - 1; i >= 0; i--) {
        const w = s.matches[i]?.winner ?? null;
        if (w !== null && s.lines.find((l) => l.id === w)?.status === 'alive') return w;
    }
    return null;
}

export function describe(a: NextAction, run: string): string {
    switch (a.kind) {
        case 'generate':
            return `generate: dispatch ${a.lines.length} line agent(s), each writing lines/<id>.md from briefs/<id>.md, then: scan --run ${run}  [${a.lines.join(' ')}]`;
        case 'judge':
            return `judge: ${a.matches.length} match(es) — per match: briefs --run ${run} --match <id> --seat-… → attack → defend → judge → collect --run ${run} --match <id> [--verdict FILE]  [${a.matches.join(' ')}]`;
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
            if (anglesFile && new Set(angles).size < n) {
                throw new BracketError('angles-short', `${anglesFile} has ${new Set(angles).size} distinct angle(s) for ${n} lines — every line needs its own; add angles or drop --angles to use the deck`);
            }
            const s = initState({ runId: run, task, n, seed: Number(flag(args, 'seed') ?? 1), tier: t });
            const dealt: (Angle | string)[] = angles.length > 0 ? s.lines.map((_, i) => angles[i % angles.length] as string) : dealAngles(n, s.seed);
            mkdirSync(path.join(dir, 'briefs'), { recursive: true });
            mkdirSync(path.join(dir, 'lines'), { recursive: true });
            writeFileSync(path.join(dir, 'task.md'), task);
            writeFileSync(path.join(dir, 'angles.json'), `${JSON.stringify(Object.fromEntries(s.lines.map((l, i) => [l.id, dealt[i]])), null, 2)}\n`);
            s.lines.forEach((l, i) => {
                writeFileSync(path.join(dir, 'briefs', `${l.id}.md`), renderBrief(task, l.id, dealt[i] ?? null));
            });
            save(s);
            out(`initialised ${run}: ${n} lines, ${angles.length > 0 ? 'angles from file' : 'one distinct angle each'}, task ${s.taskHash.slice(0, 12)}`);
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
        case 'briefs': {
            const s = load(need(args, 'run'));
            const dir = runDir(s.runId);
            const m = s.matches.find((x) => x.id === need(args, 'match'));
            if (m === undefined) throw new BracketError('unknown-match', `no match ${need(args, 'match')}`);
            if (m.b === null) throw new BracketError('bye', `${m.id} is a bye`);
            if (m.winner !== null) throw new BracketError('match-closed', `${m.id} already has a winner`);
            const billing = need(args, 'seat-billing');
            if (!(BILLINGS as readonly string[]).includes(billing)) throw new BracketError('bad-billing', `unknown billing ${billing}`);
            const seat = { id: need(args, 'seat-id'), family: need(args, 'seat-family'), billing: billing as Billing };
            if (billing === 'free-quota') throw new BracketError('free-seat-verdict', `a free-quota seat cannot carry a match verdict — collect would refuse it (ADR-257)`);
            const anglesFile = path.join(dir, 'angles.json');
            const dealtByLine = existsSync(anglesFile) ? (JSON.parse(readFileSync(anglesFile, 'utf8')) as Record<string, Angle | string>) : {};
            const mdir = path.join(dir, 'matches', m.id);
            mkdirSync(path.join(mdir, 'briefs'), { recursive: true });
            for (const [side, id] of [['a', m.a], ['b', m.b]] as const) {
                const body = readFileSync(path.join(dir, 'lines', `${id}.md`), 'utf8');
                writeFileSync(path.join(mdir, `original-${side}.md`), body);
                if (!existsSync(path.join(mdir, `revised-${side}.md`))) writeFileSync(path.join(mdir, `revised-${side}.md`), body);
            }
            writeFileSync(path.join(mdir, 'seat.json'), `${JSON.stringify(seat)}\n`);
            const briefs = matchBriefs({
                task: readFileSync(path.join(dir, 'task.md'), 'utf8'),
                match: m.id,
                round: m.round,
                a: { angle: dealtByLine[m.a] ?? null },
                b: { angle: dealtByLine[m.b] ?? null },
                dir: path.resolve(mdir),
                seat,
            });
            for (const [role, text] of Object.entries(briefs)) writeFileSync(path.join(mdir, 'briefs', `${role}.md`), text);
            out(`${m.id}: briefs written — attack-a + attack-b, then defend-a + defend-b, then judge (a paid seat)  [${path.join(mdir, 'briefs')}]`);
            return 0;
        }
        case 'collect': {
            const s = load(need(args, 'run'));
            const dir = runDir(s.runId);
            const matchId = need(args, 'match');
            if (!/^R\d+M\d+$/.test(matchId)) throw new BracketError('unknown-match', `no match ${matchId}`);
            const mdir = path.join(dir, 'matches', matchId);
            const verdictFile = flag(args, 'verdict') ?? path.join(mdir, 'verdict.json');
            const raw = JSON.parse(readFileSync(verdictFile, 'utf8')) as { seat?: Partial<Record<'id' | 'family' | 'billing', unknown>> };
            const seatFile = path.join(mdir, 'seat.json');
            const named = existsSync(seatFile) ? (JSON.parse(readFileSync(seatFile, 'utf8')) as Record<'id' | 'family' | 'billing', string>) : null;
            if (named !== null && (['id', 'family', 'billing'] as const).some((k) => raw.seat?.[k] !== named[k])) {
                throw new BracketError('seat-mismatch', `${matchId}: the verdict's seat differs from the seat named at briefs — request the verdict again`);
            }
            const m = collect(s, matchId, raw);
            // The winner carries its revision into the next round; the pre-match text is kept beside it.
            const winSide = m.winner === m.a ? 'a' : 'b';
            const revised = path.join(mdir, `revised-${winSide}.md`);
            if (m.winner !== null && existsSync(revised) && statSync(revised).size > 0) {
                const current = path.join(dir, 'lines', `${m.winner}.md`);
                renameSync(current, path.join(dir, 'lines', `${m.winner}.before-${m.id}.md`));
                writeFileSync(current, readFileSync(revised, 'utf8'));
            }
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
            playCard(s, need(args, 'line'), {
                seat: { id: need(args, 'seat-id'), family: need(args, 'seat-family'), billing: need(args, 'seat-billing') as Billing },
                newEvidence: args.includes('--new-evidence'),
                jury: shadowJury(args),
            });
            noteMissingJury(s, args);
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'decline': {
            const s = load(need(args, 'run'));
            declineAppeal(s, need(args, 'line'), shadowJury(args));
            noteMissingJury(s, args);
            save(s);
            out(describe(next(s), s.runId));
            return 0;
        }
        case 'jury': {
            if (resolveJuryMode(flag(args, 'jury-mode') ?? 'binding') !== 'binding') {
                throw new BracketError('jury-not-binding', '`jury` decides an appeal; use card/decline --jury to record a shadow vote');
            }
            const s = load(need(args, 'run'));
            const votes = JSON.parse(readFileSync(need(args, 'jury'), 'utf8')) as JurorVote[];
            const l = appealByJury(s, need(args, 'line'), { votes, newEvidence: args.includes('--new-evidence') });
            save(s);
            out(l === null ? 'jury: elimination stands' : `jury: ${l.id} readmitted`);
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
        case 'name': {
            const run = need(args, 'run');
            const dir = runDir(run);
            if (!existsSync(path.join(dir, 'bracket.json'))) throw new BracketError('no-run', `run ${run} has no bracket.json`);
            const text = flag(args, 'text');
            const decision = flag(args, 'decision');
            if (text !== undefined && decision !== undefined) throw new BracketError('name-both', 'pass --text or --decision, not both');
            const force = args.includes('--force');
            let current: RunName;
            try {
                current = readRunName(dir);
            } catch (e) {
                if (!(force && e instanceof BracketError && e.code === 'name-unreadable')) throw e;
                current = { v: 1 };
            }
            if (text === undefined && decision === undefined) {
                out(JSON.stringify(current, null, 2));
                return 0;
            }
            const champion = decision !== undefined ? currentChampion(load(run)) : null;
            const r = applyAgentWrite(current, {
                field: text !== undefined ? 'name' : 'decision',
                text: (text ?? decision) as string,
                force,
                now: new Date(),
                champion,
            });
            if (r.change !== 'unchanged') writeRunName(dir, r.state);
            const field = text !== undefined ? 'name' : 'decision';
            const shown = r.state[field];
            out(
                r.change === 'cleared' || r.change === 'unchanged'
                    ? `${run}: ${field} cleared`
                    : `${run}: ${field} "${shown?.text ?? ''}"${field === 'decision' ? (champion ? ` · champion ${champion}` : ' · no champion yet') : ''}`,
            );
            return 0;
        }
        default:
            out('usage: cli <plan|init|scan|dedupe|next|advance|briefs|collect|correct|card|decline|jury|status|name> …');
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
