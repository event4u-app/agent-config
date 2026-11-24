/**
 * The live council table: seats, a live log, and a human inbox.
 *
 * Three additive capabilities, all outside the orchestrator so its control flow
 * stays byte-identical:
 *
 *   1. SEATS — an optional `seats:` list in the council config seats several
 *      roles at the table, more than one per provider. A seat is a copy of an
 *      already-built provider client (same class, so every `instanceof` and
 *      cache path keeps working) with its own `name` (`anthropic#architect`),
 *      an optional `model`, and a role preamble on its system prompt. Absent
 *      `seats:` ⇒ the roster is exactly the one `build_members` returned.
 *
 *   2. LIVE LOG — `agents/runtime/council/live/<stem>/live.jsonl`, append-only,
 *      one JSON event per line: `run.started`, `seat.started`, `seat.finished`,
 *      `human.said`, `run.paused`, `run.resumed`, `run.finished`. A reader (an
 *      IDE, Agent Switch) can draw the table while it runs; until now a council
 *      wrote nothing before its end. `<stem>` is the `--output` file's stem (a
 *      run) or folder name (a debate).
 *
 *   3. INBOX — `.../live/<stem>/inbox.jsonl`, append-only, written by the human
 *      side: `{"type":"say","text":…}` joins every later seat's prompt as the
 *      human's remark; `pause` holds the table before the next seat until
 *      `resume`; `stop` ends it — every remaining seat answers with an error and
 *      nothing is sent. Read before each seat call; the orchestrator calls seats
 *      sequentially, so a seat boundary is the natural point to listen.
 *
 * Wiring cost in the oversized `council_cli.ts` is two lines per subcommand:
 * `openLiveTable(...)` after the question is built, `finish(...)` after the
 * result is written. A run that dies in between still gets `run.finished`
 * (`failed`, or `stopped` when the human stopped it) from an exit hook.
 *
 * Kill switch: `AGENT_CONFIG_COUNCIL_LIVE=0` writes no log and reads no inbox;
 * declared seats still apply.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { ExternalAIClient } from './clients.js';
import { CouncilResponse } from './council_response.js';
import { councilEgress } from './council_egress.js';

/** The table never seats more than this; the cost of a seat is a full call per turn. */
export const MAX_SEATS = 15;
/** One remark is bounded so one paste cannot swamp every later prompt. */
export const SAY_MAX_CHARS = 2000;
/** A paused table resumes or stops; it never waits forever on an absent human. */
export const PAUSE_MAX_MS = 30 * 60 * 1000;
const POLL_MS = 500;
const ROLE_MAX = 80;
const BRIEF_MAX = 600;

export interface SeatSpec {
    /** The provider member that answers for this seat (`anthropic`, `openai`, …). */
    readonly member: string;
    readonly role?: string;
    readonly model?: string;
    /** One paragraph on what this seat argues for. */
    readonly brief?: string;
}

/** `seats:` from a raw council config. Fails closed on a malformed list. Pure. */
export function readSeats(raw: unknown, label = 'seats'): SeatSpec[] {
    if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const list = (raw as Record<string, unknown>)[label];
    if (list === null || list === undefined) return [];
    if (!Array.isArray(list)) throw new TypeError(`${label} must be a list (got ${typeof list}).`);
    if (list.length > MAX_SEATS) throw new TypeError(`${label} holds ${list.length} seats; at most ${MAX_SEATS}.`);
    return list.map((s, i) => {
        if (typeof s !== 'object' || s === null || Array.isArray(s)) throw new TypeError(`${label}[${i}] must be a mapping.`);
        const o = s as Record<string, unknown>;
        if (typeof o['member'] !== 'string' || !o['member']) throw new TypeError(`${label}[${i}].member must name a council member.`);
        const str = (k: string, max: number): string | undefined => {
            const v = o[k];
            if (v === undefined || v === null) return undefined;
            if (typeof v !== 'string') throw new TypeError(`${label}[${i}].${k} must be a string.`);
            return v.trim().slice(0, max) || undefined;
        };
        const role = str('role', ROLE_MAX);
        const model = str('model', 200);
        const brief = str('brief', BRIEF_MAX);
        return { member: o['member'], ...(role ? { role } : {}), ...(model ? { model } : {}), ...(brief ? { brief } : {}) };
    });
}

/** The seats declared in the council config file; none when the file or the key is absent. */
export function seatsFromConfigFile(file: string | undefined): SeatSpec[] {
    if (!file || !fs.existsSync(file)) return [];
    return readSeats(parseYaml(fs.readFileSync(file, 'utf-8'), { version: '1.1' }));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);

/** The table's id for a seat: unique, stable within a run, `provider#role`. Pure. */
export function seatIds(seats: readonly SeatSpec[]): string[] {
    const used = new Set<string>();
    return seats.map((s, i) => {
        const base = `${s.member}#${slug(s.role ?? '') || String(i + 1)}`;
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        used.add(id);
        return id;
    });
}

/** The preamble a role puts on a seat's system prompt. Pure. */
export function rolePreamble(seat: SeatSpec): string {
    if (!seat.role && !seat.brief) return '';
    const who = seat.role ? `You hold the seat "${seat.role}" at this council.` : 'You hold one seat at this council.';
    return `${who}${seat.brief ? ` ${seat.brief}` : ''} Argue from that seat; other seats cover other angles.\n\n`;
}

/** A copy of a provider client that answers as one seat. */
function copyClient(inner: ExternalAIClient): ExternalAIClient {
    return Object.assign(Object.create(Object.getPrototypeOf(inner) as object) as ExternalAIClient, inner);
}

/** Seats in config order, each a copy of the member that answers for it; seats whose member is not at the table are returned as absent. */
export function seatMembers(members: readonly ExternalAIClient[], seats: readonly SeatSpec[]): { seated: { client: ExternalAIClient; spec: SeatSpec; id: string }[]; absent: { spec: SeatSpec; id: string; reason: string }[] } {
    const ids = seatIds(seats);
    const seated: { client: ExternalAIClient; spec: SeatSpec; id: string }[] = [];
    const absent: { spec: SeatSpec; id: string; reason: string }[] = [];
    seats.forEach((spec, i) => {
        const inner = members.find((m) => m.name === spec.member);
        if (!inner) return void absent.push({ spec, id: ids[i] as string, reason: `member "${spec.member}" is not at the table (disabled, unavailable or not configured)` });
        const client = copyClient(inner);
        client.name = ids[i] as string;
        if (spec.model) client.model = spec.model;
        seated.push({ client, spec, id: ids[i] as string });
    });
    return { seated, absent };
}

/** Block the thread for `ms`. The orchestrator is synchronous; so is listening to the human between seats. */
function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** This process and its ancestors, nearest first: how a reader ties the run to the session that started it. */
function ancestry(depth = 5): number[] {
    const out = [process.pid];
    let pid = process.ppid;
    for (let i = 0; i < depth && pid > 1; i++) {
        out.push(pid);
        try {
            pid = Number(execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf-8', timeout: 1000 }).trim());
        } catch {
            break;
        }
    }
    return out;
}

export type InboxMessage = { type: 'say'; text: string } | { type: 'pause' } | { type: 'resume' } | { type: 'stop' };

/** Inbox lines → messages; a torn, foreign or oversized line is skipped. Pure. */
export function parseInbox(text: string): InboxMessage[] {
    const out: InboxMessage[] = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let o: unknown;
        try {
            o = JSON.parse(line);
        } catch {
            continue;
        }
        const t = (o as { type?: unknown })?.type;
        if (t === 'say') {
            const text = (o as { text?: unknown }).text;
            if (typeof text === 'string' && text.trim()) out.push({ type: 'say', text: text.trim().slice(0, SAY_MAX_CHARS) });
        } else if (t === 'pause' || t === 'resume' || t === 'stop') out.push({ type: t });
    }
    return out;
}

/** The block the human's remarks add to a seat's user prompt. Pure. */
export function humanBlock(said: readonly string[]): string {
    if (!said.length) return '';
    return `\n\n---\nThe human at the table said, between turns (take it into account, and say where it changes your view):\n${said.map((s) => `> ${s.replace(/\n/g, '\n> ')}`).join('\n')}\n`;
}

export interface LiveTable {
    readonly members: ExternalAIClient[];
    /** The live folder, or null when the log is off. */
    readonly dir: string | null;
    finish(status: 'completed' | 'stopped' | 'failed', response?: string): void;
}

export interface OpenLiveTableOptions {
    readonly subcommand: 'run' | 'debate';
    readonly members: ExternalAIClient[];
    /** The `--output` path: a response file (run) or folder (debate). */
    readonly output?: string | undefined;
    /** The project root the council writes under. */
    readonly root: string;
    readonly ask?: string | null | undefined;
    /** The council config file, for `seats:`. */
    readonly configPath?: string | undefined;
    readonly env?: NodeJS.ProcessEnv;
    /** Seconds since the epoch, injectable for tests. */
    readonly now?: () => Date;
    readonly sleep?: (ms: number) => void;
}

/** The live folder for an `--output` path. Pure. */
export function liveDirFor(root: string, output: string): string {
    const stem = path.basename(output).replace(/\.json$/, '');
    return path.join(root, 'agents', 'runtime', 'council', 'live', stem);
}

/**
 * Seat the table and, unless switched off, open its live log and inbox.
 * Writes nothing until the first seat is called, so a run that stops at its
 * cost preview leaves no trace.
 */
export function openLiveTable(opts: OpenLiveTableOptions): LiveTable {
    const env = opts.env ?? process.env;
    const now = opts.now ?? (() => new Date());
    const sleep = opts.sleep ?? sleepSync;
    const seats = seatsFromConfigFile(opts.configPath);
    const { seated, absent } = seats.length ? seatMembers(opts.members, seats) : { seated: opts.members.map((client) => ({ client, spec: { member: client.name } as SeatSpec, id: client.name })), absent: [] };
    const liveOn = env['AGENT_CONFIG_COUNCIL_LIVE'] !== '0' && typeof opts.output === 'string' && opts.output !== '';
    const dir = liveOn ? liveDirFor(opts.root, opts.output as string) : null;
    const logFile = dir ? path.join(dir, 'live.jsonl') : null;
    const inboxFile = dir ? path.join(dir, 'inbox.jsonl') : null;
    let started = false;
    let finished = false;
    let stopped = false;
    let inboxOffset = 0;
    const said: string[] = [];
    const turns = new Map<string, number>();

    const emit = (event: Record<string, unknown>): void => {
        if (!logFile) return;
        if (!started) {
            started = true;
            fs.mkdirSync(path.dirname(logFile), { recursive: true });
            fs.closeSync(fs.openSync(inboxFile as string, 'a'));
            const head = {
                v: 1,
                type: 'run.started',
                at: now().toISOString(),
                subcommand: opts.subcommand,
                ask: (opts.ask ?? '').slice(0, 800),
                response: path.relative(opts.root, path.resolve(opts.root, opts.output as string)),
                seats: [
                    ...seated.map(({ client, spec, id }) => ({ id, member: spec.member, model: client.model, role: spec.role ?? null, brief: spec.brief ?? null, transport: client.transport, billable: client.billable })),
                    ...absent.map(({ spec, id, reason }) => ({ id, member: spec.member, model: spec.model ?? null, role: spec.role ?? null, brief: spec.brief ?? null, absent: reason })),
                ],
                pids: ancestry(),
                cwd: process.cwd(),
            };
            fs.appendFileSync(logFile, JSON.stringify(head) + '\n');
        }
        fs.appendFileSync(logFile, JSON.stringify({ v: 1, at: now().toISOString(), ...event }) + '\n');
    };

    /** Read what the human wrote since the last look; pause blocks here until resume, stop, or the pause limit. */
    const listen = (seat: string): void => {
        if (!inboxFile || stopped) return;
        const read = (): InboxMessage[] => {
            let text = '';
            try {
                const fd = fs.openSync(inboxFile, 'r');
                try {
                    const size = fs.fstatSync(fd).size;
                    if (size > inboxOffset) {
                        const buf = Buffer.alloc(size - inboxOffset);
                        fs.readSync(fd, buf, 0, buf.length, inboxOffset);
                        const s = buf.toString('utf-8');
                        const cut = s.lastIndexOf('\n') + 1; // a line still being written waits for the next look
                        text = s.slice(0, cut);
                        inboxOffset += Buffer.byteLength(text);
                    }
                } finally {
                    fs.closeSync(fd);
                }
            } catch {
                return [];
            }
            return parseInbox(text);
        };
        let paused = false;
        let pausedAt = 0;
        for (;;) {
            for (const m of read()) {
                if (m.type === 'say') {
                    const refusal = councilEgress().check(m.text);
                    if (refusal !== null) emit({ type: 'human.refused', reason: `${refusal.reason} (${refusal.what})`, before: seat });
                    else {
                        said.push(m.text);
                        emit({ type: 'human.said', text: m.text, before: seat });
                    }
                } else if (m.type === 'pause' && !paused) {
                    paused = true;
                    pausedAt = Date.now();
                    emit({ type: 'run.paused', before: seat });
                } else if (m.type === 'resume' && paused) {
                    paused = false;
                    emit({ type: 'run.resumed', before: seat });
                } else if (m.type === 'stop') {
                    stopped = true;
                    emit({ type: 'run.stopping', before: seat, by: 'human' });
                    return;
                }
            }
            if (!paused) return;
            if (Date.now() - pausedAt > PAUSE_MAX_MS) {
                stopped = true;
                emit({ type: 'run.stopping', before: seat, by: 'pause-limit' });
                return;
            }
            sleep(POLL_MS);
        }
    };

    const wrap = (client: ExternalAIClient, spec: SeatSpec, id: string): ExternalAIClient => {
        const proto = Object.getPrototypeOf(client) as ExternalAIClient;
        const preamble = rolePreamble(spec);
        let depth = 0; // a native ask_split that calls ask() is one seat call, not two
        const around = (call: (system: string, extra: string) => CouncilResponse): CouncilResponse => {
            if (depth > 0) return call('', '');
            depth++;
            try {
                listen(id);
                const turn = (turns.get(id) ?? 0) + 1;
                turns.set(id, turn);
                if (stopped) {
                    emit({ type: 'seat.skipped', seat: id, turn, reason: 'stopped at the table' });
                    return new CouncilResponse({ provider: spec.member, model: client.model, text: '', error: 'stopped at the table; nothing was sent', metadata: { seat: { id, role: spec.role ?? null } } });
                }
                emit({ type: 'seat.started', seat: id, turn });
                const t0 = Date.now();
                const r = call(preamble, humanBlock(said));
                r.metadata = { ...(r.metadata ?? {}), seat: { id, role: spec.role ?? null } };
                const head = r.text.split('\n').map((l) => l.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim()).filter(Boolean);
                const headline = head.slice(0, 20).find((l) => /^(verdict|recommendation|stance)\b/i.test(l)) ?? head[0];
                emit({ type: 'seat.finished', seat: id, turn, ok: !r.error, error: r.error ?? null, headline: headline ? headline.slice(0, 160) : null, input_tokens: r.input_tokens, output_tokens: r.output_tokens, latency_ms: r.latency_ms || Date.now() - t0 });
                return r;
            } finally {
                depth--;
            }
        };
        if (!seats.length && !logFile) return client;
        const seat = seats.length ? client : copyClient(client);
        seat.ask = (system: string, user: string, max?: number) => around((pre, extra) => proto.ask.call(seat, pre + system, user + extra, max));
        seat.ask_split = (system: string, stable: string, suffix: string, max?: number) => around((pre, extra) => proto.ask_split.call(seat, pre + system, stable, suffix + extra, max));
        return seat;
    };

    const members = seated.map(({ client, spec, id }) => wrap(client, spec, id));
    const onExit = (): void => finish(stopped ? 'stopped' : 'failed');
    const finish = (status: 'completed' | 'stopped' | 'failed', response?: string): void => {
        if (logFile) process.removeListener('exit', onExit);
        if (finished || !started) return void (finished = true);
        finished = true;
        emit({ type: 'run.finished', status: stopped && status === 'completed' ? 'stopped' : status, response: response ? path.relative(opts.root, path.resolve(opts.root, response)) : null });
    };
    if (logFile) process.once('exit', onExit);
    return { members, dir, finish };
}
