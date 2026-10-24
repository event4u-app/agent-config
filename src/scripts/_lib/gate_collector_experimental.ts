/**
 * EXPERIMENTAL per-aspect gate collector. Not a normative schema, not a gate,
 * wired into no CI job. Its result version is `experimental-1` precisely
 * so that nothing mistakes it for a supported producer contract.
 *
 * Three dimensions are kept apart, plus preflight:
 *
 * - **preflight** — configuration state decided before a producer starts
 *   (an expired compatibility row, a dirty tree). A refused producer is
 *   `not-attempted`; it is never a protocol outcome.
 * - **collection outcome** — how reading fd 3 ended, decided by
 *   {@link collectorReduce}.
 * - **protocol outcome** — what the accepted bytes say, decided by
 *   {@link parseStream}.
 * - **validator health** — whether the validator itself handled every
 *   producer, decided by {@link assessRun} and {@link writeSummary}.
 *
 * The accepted-byte boundary. fd 3 is a pipe the validator owns. Bytes are
 * accepted while the collector is `collecting`. At the first terminal event
 * (producer exit, deadline) the collector moves to `draining`: the driver reads
 * the pipe synchronously until it would block, which accepts exactly the bytes
 * already in the kernel buffer at that moment, then moves to `stopped`. No read
 * is started after that, and later bytes are counted as ignored, never parsed.
 * A byte or line limit stops collection at once, with the exact prefix kept.
 *
 * What the boundary does NOT give: fd 3 is a bearer capability. A descendant
 * that inherited it and wrote before the stop is indistinguishable from the
 * producer. The claim is framing and bounded collection, not provenance.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

export const RESULT_VERSION = 'experimental-1';

export interface Limits {
    readonly wallMs: number;
    readonly maxBytes: number;
    readonly maxLines: number;
    readonly killGraceMs: number;
}

export interface CompatRow {
    /** ISO date; the row stops applying after this day. */
    readonly expires: string;
    readonly exitAllPass: number;
    readonly exitOtherwise: number;
}

export interface ProducerRow {
    readonly id: string;
    readonly argv: readonly string[];
    readonly aspects: readonly string[];
    readonly compat?: CompatRow;
}

export type CollectionOutcome =
    | { kind: 'exited'; code: number }
    | { kind: 'signalled'; signal: string }
    | { kind: 'timed-out' }
    | { kind: 'output-limited'; limit: 'bytes' | 'lines' }
    | { kind: 'not-started'; reason: string };

export type CollectorEvent =
    | { type: 'spawned' }
    | { type: 'spawn-error'; code: string }
    | { type: 'data'; bytes: Buffer }
    | { type: 'exit'; code: number | null; signal: string | null }
    | { type: 'deadline' }
    | { type: 'drain-complete' };

export interface CollectorModel {
    readonly phase: 'starting' | 'collecting' | 'draining' | 'stopped';
    readonly limits: Limits;
    readonly accepted: readonly Buffer[];
    readonly bytes: number;
    readonly lines: number;
    readonly outcome: CollectionOutcome | null;
    readonly ignoredAfterStop: number;
    readonly events: readonly string[];
}

export function initialCollector(limits: Limits): CollectorModel {
    return { phase: 'starting', limits, accepted: [], bytes: 0, lines: 0, outcome: null, ignoredAfterStop: 0, events: [] };
}

function acceptChunk(m: CollectorModel, chunk: Buffer): CollectorModel {
    const byteRoom = m.limits.maxBytes - m.bytes;
    let take = Math.min(chunk.length, byteRoom);
    let limit: 'bytes' | 'lines' | null = chunk.length > byteRoom ? 'bytes' : null;
    let lines = m.lines;
    for (let i = 0; i < take; i++) {
        if (chunk[i] !== 0x0a) continue;
        lines++;
        if (lines === m.limits.maxLines && i + 1 < chunk.length) {
            take = i + 1;
            limit = 'lines';
            break;
        }
    }
    const next: CollectorModel = {
        ...m,
        accepted: take > 0 ? [...m.accepted, chunk.subarray(0, take)] : m.accepted,
        bytes: m.bytes + take,
        lines,
        ignoredAfterStop: m.ignoredAfterStop + (chunk.length - take),
    };
    if (limit === null) return next;
    return { ...next, phase: 'stopped', outcome: m.outcome ?? { kind: 'output-limited', limit } };
}

/** The collector as a pure transition function; the driver only feeds it events. */
export function collectorReduce(m: CollectorModel, e: CollectorEvent): CollectorModel {
    const note = (s: string): CollectorModel => ({ ...m, events: [...m.events, s] });
    switch (e.type) {
        case 'spawned':
            return m.phase === 'starting' ? { ...m, phase: 'collecting' } : note('spawned-out-of-order');
        case 'spawn-error':
            if (m.phase !== 'starting') return note(`spawn-error-after-start:${e.code}`);
            return { ...m, phase: 'stopped', outcome: { kind: 'not-started', reason: e.code } };
        case 'data':
            if (m.phase === 'collecting' || m.phase === 'draining') return acceptChunk(m, e.bytes);
            return { ...m, ignoredAfterStop: m.ignoredAfterStop + e.bytes.length };
        case 'exit': {
            if (m.phase !== 'collecting') return note('exit-after-terminal');
            const outcome: CollectionOutcome =
                e.signal !== null ? { kind: 'signalled', signal: e.signal } : { kind: 'exited', code: e.code ?? -1 };
            return { ...m, phase: 'draining', outcome };
        }
        case 'deadline':
            if (m.phase !== 'collecting') return note('deadline-after-terminal');
            return { ...m, phase: 'draining', outcome: { kind: 'timed-out' } };
        case 'drain-complete':
            return m.phase === 'draining' ? { ...m, phase: 'stopped' } : note('drain-complete-out-of-order');
    }
}

export interface Collection {
    readonly outcome: CollectionOutcome;
    readonly bytes: Buffer;
    /** The process's own exit, which may arrive after a timeout or a limit stopped collection. */
    readonly observedExit: { code: number | null; signal: string | null } | null;
    readonly ignoredAfterStop: number;
    readonly cleanup: { readonly groupSignalled: boolean; readonly groupAliveAfterKill: boolean };
    readonly events: readonly string[];
}

export interface CollectOptions {
    readonly limits: Limits;
    readonly env?: Record<string, string>;
    readonly cwd?: string;
}

/** The environment a producer sees: recorded pass-throughs plus the caller's explicit additions. */
function producerEnv(extra: Record<string, string> = {}): Record<string, string> {
    const env: Record<string, string> = { TZ: 'UTC', LANG: 'C.UTF-8' };
    for (const k of ['PATH', 'HOME', 'TMPDIR', 'CI']) {
        const v = process.env[k];
        if (v !== undefined) env[k] = v;
    }
    return { ...env, ...extra };
}

function groupAlive(pid: number): boolean {
    try {
        process.kill(-pid, 0);
        return true;
    } catch {
        return false;
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read the pipe until it would block; returns the chunks in arrival order. */
function drainSync(stream: NodeJS.ReadableStream & { _handle?: { fd?: number } }): Buffer[] {
    const out: Buffer[] = [];
    stream.pause();
    for (let c = stream.read() as Buffer | null; c !== null; c = stream.read() as Buffer | null) out.push(c);
    const fd = stream._handle?.fd;
    if (typeof fd !== 'number' || fd < 0) return out;
    const buf = Buffer.alloc(64 * 1024);
    for (;;) {
        let n: number;
        try {
            n = fs.readSync(fd, buf, 0, buf.length, null);
        } catch {
            break;
        }
        if (n === 0) break;
        out.push(Buffer.from(buf.subarray(0, n)));
    }
    return out;
}

/** Run one producer and collect fd 3 under the state machine. */
export async function collect(row: ProducerRow, opts: CollectOptions): Promise<Collection> {
    const [cmd, ...args] = row.argv;
    let m = initialCollector(opts.limits);
    let observedExit: Collection['observedExit'] = null;
    if (cmd === undefined) {
        m = collectorReduce(m, { type: 'spawn-error', code: 'EMPTY_ARGV' });
        return finish(m, null, { groupSignalled: false, groupAliveAfterKill: false });
    }

    const child = spawn(cmd, args, {
        detached: true,
        cwd: opts.cwd,
        env: producerEnv(opts.env),
        stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
    });
    const pipe = child.stdio[3] as (NodeJS.ReadableStream & { _handle?: { fd?: number }; destroy(): void }) | null;

    const stopped = new Promise<void>((resolve) => {
        let deadline: NodeJS.Timeout | undefined;
        const settle = () => {
            if (m.phase !== 'stopped') return;
            if (deadline) clearTimeout(deadline);
            pipe?.destroy();
            resolve();
        };
        const stopNow = () => {
            if (m.phase !== 'draining') return settle();
            if (pipe) for (const c of drainSync(pipe)) m = collectorReduce(m, { type: 'data', bytes: c });
            m = collectorReduce(m, { type: 'drain-complete' });
            settle();
        };
        child.once('error', (err: NodeJS.ErrnoException) => {
            m = collectorReduce(m, { type: 'spawn-error', code: err.code ?? 'SPAWN_ERROR' });
            settle();
        });
        child.once('spawn', () => {
            m = collectorReduce(m, { type: 'spawned' });
            deadline = setTimeout(() => {
                m = collectorReduce(m, { type: 'deadline' });
                stopNow();
            }, opts.limits.wallMs);
        });
        pipe?.on('data', (b: Buffer) => {
            m = collectorReduce(m, { type: 'data', bytes: b });
            settle();
        });
        pipe?.on('error', () => {});
        child.once('exit', (code, signal) => {
            observedExit = { code, signal };
            m = collectorReduce(m, { type: 'exit', code, signal });
            stopNow();
        });
    });
    await stopped;

    let cleanup = { groupSignalled: false, groupAliveAfterKill: false };
    if (child.pid !== undefined && m.outcome?.kind !== 'not-started') {
        cleanup = await killGroup(child.pid, opts.limits.killGraceMs);
    }
    return finish(m, observedExit, cleanup);
}

async function killGroup(pid: number, graceMs: number): Promise<Collection['cleanup']> {
    if (!groupAlive(pid)) return { groupSignalled: false, groupAliveAfterKill: false };
    try {
        process.kill(-pid, 'SIGTERM');
    } catch {
        return { groupSignalled: false, groupAliveAfterKill: groupAlive(pid) };
    }
    await sleep(graceMs);
    if (groupAlive(pid)) {
        try {
            process.kill(-pid, 'SIGKILL');
        } catch {
            /* the group exited between the check and the signal */
        }
        await sleep(20);
    }
    return { groupSignalled: true, groupAliveAfterKill: groupAlive(pid) };
}

function finish(m: CollectorModel, observedExit: Collection['observedExit'], cleanup: Collection['cleanup']): Collection {
    return {
        outcome: m.outcome ?? { kind: 'not-started', reason: 'NO_TERMINAL_EVENT' },
        bytes: Buffer.concat(m.accepted),
        observedExit,
        ignoredAfterStop: m.ignoredAfterStop,
        cleanup,
        events: m.events,
    };
}

export type Evaluation = 'pass' | 'fail' | 'expired' | 'not-evaluated';
const EVALUATIONS: readonly string[] = ['pass', 'fail', 'expired', 'not-evaluated'];
const NOT_EVALUATED_REASONS: readonly string[] = ['evidence-missing', 'prerequisite-unavailable', 'invalid-input', 'unsupported-version'];
const RECORD_FIELDS = new Set(['v', 'aspect', 'evaluation', 'reason', 'detail']);
const TERMINATOR_FIELDS = new Set(['v', 'end', 'aspects']);
const DETAIL_MAX = 512;

export interface AspectRecord {
    readonly aspect: string;
    readonly evaluation: Evaluation;
    readonly reason?: string;
    readonly detail?: string;
}

export type ProtocolOutcome = 'complete' | 'incomplete' | 'invalid' | 'absent';

export interface ProtocolAssessment {
    readonly outcome: ProtocolOutcome;
    /** The primary reason; `null` only for `complete`. */
    readonly reason: string | null;
    /** Every finding, primary or not, so combinations stay visible. */
    readonly diagnostics: readonly string[];
    readonly records: readonly AspectRecord[];
}

/**
 * Primary-outcome precedence. Earlier entries win. Every `invalid` reason
 * outranks every `incomplete` reason: a malformed or contradictory stream is
 * reported as such even when it was also cut short. Within each outcome a
 * collection cause comes first, because it explains the content findings that
 * follow from it: a stream stopped at its byte limit was not read to the end,
 * and a timed-out producer never wrote its terminator.
 */
const PRECEDENCE: readonly (readonly [string, ProtocolOutcome])[] = [
    ['not-started', 'absent'],
    ['output-limit', 'invalid'],
    ['malformed', 'invalid'],
    ['mixed-version', 'invalid'],
    ['unsupported-version', 'invalid'],
    ['schema', 'invalid'],
    ['duplicate-aspect', 'invalid'],
    ['foreign-aspect', 'invalid'],
    ['framing', 'invalid'],
    ['exit-contradiction', 'invalid'],
    ['timed-out', 'incomplete'],
    ['signalled', 'incomplete'],
    ['unterminated-line', 'incomplete'],
    ['no-terminator', 'incomplete'],
    ['count-mismatch', 'incomplete'],
    ['missing-aspect', 'incomplete'],
];

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Framing: LF is the only delimiter. One CR immediately before the LF is part
 * of the delimiter. An empty line is malformed. Bytes after the last LF are an
 * unterminated line, which is never parsed. Text must be valid UTF-8.
 */
function splitLines(bytes: Buffer, diag: Set<string>): string[] {
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        diag.add('malformed');
        return [];
    }
    const parts = text.split('\n');
    const tail = parts.pop() ?? '';
    if (tail.length > 0) diag.add('unterminated-line');
    return parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

export function parseStream(collection: Collection, row: ProducerRow): ProtocolAssessment {
    const diag = new Set<string>();
    if (collection.outcome.kind === 'not-started') diag.add('not-started');
    if (collection.outcome.kind === 'output-limited') diag.add('output-limit');
    if (collection.outcome.kind === 'timed-out') diag.add('timed-out');
    if (collection.outcome.kind === 'signalled') diag.add('signalled');

    const lines = splitLines(collection.bytes, diag);
    const values: unknown[] = [];
    for (const l of lines) {
        if (l.trim() === '') {
            diag.add('malformed');
            continue;
        }
        try {
            values.push(JSON.parse(l));
        } catch {
            diag.add('malformed');
        }
    }

    const versions = new Set(values.filter(isPlainObject).map((v) => v.v));
    if (versions.size > 1) diag.add('mixed-version');
    else if (versions.size === 1 && !versions.has(RESULT_VERSION)) diag.add('unsupported-version');

    const records: AspectRecord[] = [];
    const seen = new Set<string>();
    let terminator: { aspects: number } | null = null;
    for (const v of values) {
        if (!isPlainObject(v)) {
            diag.add('schema');
            continue;
        }
        if (v.end === true) {
            const okShape = [...Object.keys(v)].every((k) => TERMINATOR_FIELDS.has(k)) && Number.isInteger(v.aspects);
            if (!okShape) diag.add('schema');
            if (terminator !== null) diag.add('framing');
            terminator = { aspects: Number(v.aspects) };
            continue;
        }
        if (terminator !== null) diag.add('framing');
        const fieldsOk = [...Object.keys(v)].every((k) => RECORD_FIELDS.has(k));
        const aspectOk = typeof v.aspect === 'string' && v.aspect.length > 0;
        const evalOk = typeof v.evaluation === 'string' && EVALUATIONS.includes(v.evaluation);
        const reasonOk =
            v.evaluation === 'not-evaluated'
                ? typeof v.reason === 'string' && NOT_EVALUATED_REASONS.includes(v.reason)
                : v.reason === undefined;
        const detailOk = v.detail === undefined || (typeof v.detail === 'string' && Buffer.byteLength(v.detail) <= DETAIL_MAX);
        if (!fieldsOk || !aspectOk || !evalOk || !reasonOk || !detailOk) {
            diag.add('schema');
            continue;
        }
        const aspect = v.aspect as string;
        if (seen.has(aspect)) diag.add('duplicate-aspect');
        seen.add(aspect);
        if (!row.aspects.includes(aspect)) diag.add('foreign-aspect');
        records.push({
            aspect,
            evaluation: v.evaluation as Evaluation,
            ...(v.reason === undefined ? {} : { reason: v.reason as string }),
            ...(v.detail === undefined ? {} : { detail: v.detail as string }),
        });
    }

    if (terminator === null) diag.add('no-terminator');
    else if (terminator.aspects !== records.length) diag.add('count-mismatch');
    if (row.aspects.some((a) => !seen.has(a))) diag.add('missing-aspect');

    const structurallyValid = ![...diag].some((d) => PRECEDENCE.find(([r]) => r === d)?.[1] === 'invalid');
    if (collection.outcome.kind === 'exited' && structurallyValid && terminator !== null) {
        const code = collection.outcome.code;
        if (row.compat !== undefined) {
            const expected = records.every((r) => r.evaluation === 'pass') ? row.compat.exitAllPass : row.compat.exitOtherwise;
            if (expected !== code) diag.add('exit-contradiction');
        } else if (code !== 0) {
            diag.add('process-nonzero');
        }
    }

    const primary = PRECEDENCE.find(([r]) => diag.has(r));
    return {
        outcome: primary ? primary[1] : 'complete',
        reason: primary ? primary[0] : null,
        diagnostics: [...diag].sort(),
        records,
    };
}

export type AspectResult =
    | { aspect: string; evaluation: Exclude<Evaluation, 'not-evaluated'> }
    | { aspect: string; evaluation: 'not-evaluated'; reason: string };

/** Per registered aspect. A producer that is not `complete` contributes no pass at all. */
export function aspectResults(p: ProtocolAssessment, row: ProducerRow): AspectResult[] {
    return row.aspects.map((aspect) => {
        if (p.outcome !== 'complete') return { aspect, evaluation: 'not-evaluated', reason: p.reason ?? p.outcome };
        const r = p.records.find((x) => x.aspect === aspect);
        if (r === undefined) return { aspect, evaluation: 'not-evaluated', reason: 'missing-aspect' };
        if (r.evaluation === 'not-evaluated') return { aspect, evaluation: 'not-evaluated', reason: r.reason ?? 'unspecified' };
        return { aspect, evaluation: r.evaluation };
    });
}

export interface PreflightContext {
    readonly today: string;
    readonly treeClean: boolean;
}

export function preflight(row: ProducerRow, ctx: PreflightContext): { ok: true } | { ok: false; reason: string } {
    if (row.compat !== undefined && row.compat.expires < ctx.today) return { ok: false, reason: 'expired-compat-row' };
    if (!ctx.treeClean) return { ok: false, reason: 'dirty-tree' };
    return { ok: true };
}

export type ProducerStatus = ProtocolOutcome | 'not-attempted' | 'unassessed';

export interface ProducerReport {
    readonly id: string;
    readonly status: ProducerStatus;
    readonly reason: string | null;
    readonly collection?: Collection;
    readonly protocol?: ProtocolAssessment;
    readonly aspects?: readonly AspectResult[];
}

export interface AssessOptions extends CollectOptions {
    readonly preflight: PreflightContext;
    /** Injection point for fault tests; defaults to {@link parseStream}. */
    readonly parse?: (c: Collection, r: ProducerRow) => ProtocolAssessment;
}

export async function assessProducer(row: ProducerRow, opts: AssessOptions): Promise<ProducerReport> {
    const pf = preflight(row, opts.preflight);
    if (!pf.ok) return { id: row.id, status: 'not-attempted', reason: pf.reason };
    let collection: Collection;
    try {
        collection = await collect(row, opts);
    } catch (err) {
        return { id: row.id, status: 'unassessed', reason: `validator-fault:${(err as Error).message}` };
    }
    try {
        const protocol = (opts.parse ?? parseStream)(collection, row);
        return { id: row.id, status: protocol.outcome, reason: protocol.reason, collection, protocol, aspects: aspectResults(protocol, row) };
    } catch (err) {
        return { id: row.id, status: 'unassessed', reason: `validator-fault:${(err as Error).message}`, collection };
    }
}

export type Health = 'healthy' | 'degraded' | 'failed';
export type RunStatus = 'complete' | 'incomplete' | 'invalid' | 'degraded' | 'failed';

export interface RunReport {
    readonly version: typeof RESULT_VERSION;
    readonly mode: 'report-only';
    readonly health: Health;
    readonly status: RunStatus;
    readonly producers: readonly ProducerReport[];
    /** Always 0: this slice enforces nothing. */
    readonly evaluationExit: 0;
    readonly operationalExit: 0 | 1;
}

function runStatus(health: Health, producers: readonly ProducerReport[]): RunStatus {
    if (health === 'failed') return 'failed';
    if (producers.some((p) => p.status === 'invalid')) return 'invalid';
    if (health === 'degraded') return 'degraded';
    if (producers.some((p) => p.status !== 'complete')) return 'incomplete';
    return 'complete';
}

export function assessRun(producers: readonly ProducerReport[], health: Health = 'healthy'): RunReport {
    const h: Health = health === 'failed' ? 'failed' : producers.some((p) => p.status === 'unassessed') ? 'degraded' : health;
    return {
        version: RESULT_VERSION,
        mode: 'report-only',
        health: h,
        status: runStatus(h, producers),
        producers,
        evaluationExit: 0,
        operationalExit: h === 'failed' ? 1 : 0,
    };
}

function summaryLines(run: RunReport): string[] {
    const producerLines = run.producers.map((p) =>
        JSON.stringify({
            kind: 'producer',
            id: p.id,
            status: p.status,
            reason: p.reason,
            collection: p.collection ? { outcome: p.collection.outcome, ignoredAfterStop: p.collection.ignoredAfterStop, cleanup: p.collection.cleanup } : null,
            diagnostics: p.protocol?.diagnostics ?? [],
            aspects: p.aspects ?? [],
        }),
    );
    const runLine = JSON.stringify({ kind: 'run', version: run.version, mode: run.mode, health: run.health, status: run.status });
    return [...producerLines, runLine];
}

/**
 * Write the summary as JSON lines, then read it back. Any failure on that path
 * is validator health `failed`, which is the one case the operational exit
 * reports, and the run returned says so.
 */
export function writeSummary(file: string, run: RunReport): { ok: boolean; run: RunReport } {
    const body = summaryLines(run).join('\n') + '\n';
    try {
        fs.writeFileSync(file, body);
        if (fs.readFileSync(file, 'utf8') !== body) throw new Error('read-back mismatch');
        return { ok: true, run };
    } catch {
        return { ok: false, run: assessRun(run.producers, 'failed') };
    }
}
