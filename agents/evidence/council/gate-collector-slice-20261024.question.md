<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (sixth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the code and
     would continue from the result. -->

# Step 7.1: does this experimental collector discharge the item the last design round owed, and what is owed next toward classifying the pinned checks?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where a fact is missing,
say so and say what would settle it. The agent asking you wrote this code and
would continue from your answer, so treat its framing with suspicion and say
where it overreaches.

## Background

Step 7.1 must classify each CI check that was red on the trunk (16 checks) as
invariant, snapshot, tolerance or observation, from a per-check contract rather
than from observed failures. Earlier rounds today ordered the work: a producer
protocol, an invocation envelope, an outcome table. The last design round
permitted an experimental slice (schema, collector, reference producer,
fixtures, not a normative v0) and named one owed item: "an executable collector
state machine with corrected applicability and precedence rules". It found the
earlier draft's boundary self-contradictory (it closed the read end, then
drained it) and its table not total (framing unspecified, a version rule
unreachable, expiry and dirty tree misplaced as protocol outcomes, an exit rule
with no domain, the summary a shared failure domain). A separate round then
decided that a degraded report-only run exits non-zero (2, distinct from failed
= 1), is never `complete`, and that the mode contract is executable.

Owner-reserved and out of scope: there is no second principal to approve
changes to the governance surface, so the registry of producers cannot yet be
an independently governed trust root.

## The code, verbatim excerpts

File `src/scripts/_lib/gate_collector_experimental.ts` (24.8 KB). Not wired into
any CI job.

### The collector state machine and the accepted-byte boundary

```ts
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
```

The driver: on `exit` or the deadline it feeds the event, then drains synchronously and stops.

```ts
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
        // …
        child.once('exit', (code, signal) => {
            observedExit = { code, signal };
            m = collectorReduce(m, { type: 'exit', code, signal });
            stopNow();
        });
    });
```

### Framing and precedence

```ts
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
```

Inside `parseStream`, the exit rule applies only when the collection outcome is
`exited`, no `invalid` finding exists, and a terminator was read: with a
compatibility row, expected exit = row.exitAllPass when every record is `pass`,
else row.exitOtherwise, and a mismatch is `exit-contradiction`; without a row a
non-zero exit is only the diagnostic `process-nonzero`. Records accept only the
fields `v, aspect, evaluation, reason, detail`; `reason` is required exactly
when `evaluation` is `not-evaluated` and must be one of four codes; `detail` is
at most 512 bytes. A producer that is not `complete` contributes no pass:
every aspect reads `not-evaluated` with the primary reason.

### Preflight, health, run status, mode

```ts
export function preflight(row: ProducerRow, ctx: PreflightContext): { ok: true } | { ok: false; reason: string } {
    if (row.compat !== undefined && row.compat.expires < ctx.today) return { ok: false, reason: 'expired-compat-row' };
    if (!ctx.treeClean) return { ok: false, reason: 'dirty-tree' };
    return { ok: true };
}
function runStatus(health: Health, producers: readonly ProducerReport[]): RunStatus {
    if (health === 'failed') return 'failed';
    if (producers.some((p) => p.status === 'invalid')) return 'invalid';
    if (health === 'degraded') return 'degraded';
    if (producers.some((p) => p.status !== 'complete')) return 'incomplete';
    return 'complete';
}

const OPERATIONAL_EXIT: Record<Health, 0 | 1 | 2> = { healthy: 0, degraded: 2, failed: 1 };

export function assessRun(producers: readonly ProducerReport[], health: Health = 'healthy', mode: unknown = 'report-only'): RunReport {
    const m = requireMode(mode);
    for (const p of producers) {
        if (!PRODUCER_STATUSES.includes(p.status)) throw new Error(`unknown producer status ${JSON.stringify(p.status)} for ${p.id}`);
    }
    const h: Health = health === 'failed' ? 'failed' : producers.some((p) => p.status === 'unassessed') ? 'degraded' : health;
    return {
        version: RESULT_VERSION,
        mode: m,
        contract: MODE_CONTRACT,
        health: h,
        status: runStatus(h, producers),
        producers,
        evaluationExit: 0,
        operationalExit: OPERATIONAL_EXIT[h],
    };
}
```

## Evidence

43 tests, 43 green, in `tests/scripts/gate_collector_experimental.test.ts`,
against a reference producer with 24 scenarios. They cover:

- the reducer: data after the stop is ignored, bytes drained after `exit` are
  accepted, the first terminal event wins, the byte-limit prefix is exact, the
  line limit is applied, a spawn error ends collection;
- end to end: a conforming producer; an escaped `setsid` descendant forging a
  `pass` after exit, rejected; the same descendant trying to complete a stream
  left open, rejected; each reason code; CRLF; a flood; a hang with a group
  kill; a duplicate inside a hang; the exit rule with and without a row; a
  producer that cannot be spawned;
- preflight, health, a validator fault on one producer, the summary write and
  read-back, and all 108 combinations of two producer statuses and three
  health values.

Sensitivity: each mechanism was neutralised and its test went red, then
restored:

- accepting data after the stop (3 reducer tests red);
- both boundary layers together (both escape fixtures red);
- passes from an incomplete producer (1 red);
- invalid ranked below incomplete (1 red);
- ignoring an expired row (1 red);
- degraded exiting 0 (2 red).

A separate probe found that Node delivered every pipe byte before the `exit`
event in 50 of 50 runs, so the synchronous drain had nothing to read in any of
them. It is kept as the defined boundary, but it is untested against a real
late-buffered byte. Darwin and one Node version only.

## Questions

**Q1 — The owed item.** Does this discharge "an executable collector state
machine with corrected applicability and precedence rules"? Name anything it
leaves open.

**Q2 — Overreach.** Does any comment, test name or claim above say more than the
mechanism does?

**Q3 — Toward classification.** Step 7.1 closes only when each of the 16 checks
carries a class in a recorded verdict. Given this slice, what is the next item
toward that? For example: wrap the three checks named earlier
(`check_gate_completeness`, `check_composite_arming`, `check_trigger_evals`) as
producers emitting per-aspect records, register all 16 aspects, or something
else. Name the single next item, and say whether anything in it needs the
owner-reserved second principal.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
