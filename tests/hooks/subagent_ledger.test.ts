/**
 * subagent-ledger — capture behaviour and the privacy floor
 * (road-to-subagent-lifecycle-integrity Phase 1, Steps 2+3).
 *
 * Two things are asserted here and they are not the same kind of claim.
 *
 * The behaviour tests pin what the ledger records: correlation across the two
 * separate hook invocations that bracket one dispatch, depth resolved from the
 * open-record set rather than asserted, and the four-way envelope verdict
 * whose boundaries are the whole reason the measurement exists — a baseline
 * that cannot separate "no message arrived", "prose arrived", and "a malformed
 * envelope arrived" cannot tell three different defects apart. The
 * `no_message` / `no_envelope` boundary is the newest of the three and the one
 * a disk fallback keys on.
 *
 * The privacy test pins something the file's prose alone cannot: that no
 * host `agent_id` and no line of the subagent's final message reaches disk.
 * It plants the hostile values in the FIELDS under test and then greps every
 * byte the hook wrote — a negative test that passes because the value is
 * absent from the output, not because the assertion was never reachable.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    classifyEnvelope,
    LEDGER_DIR,
    OPEN_RECORD_TTL_MS,
    OPEN_SUBDIR,
    processEnvelope,
    readOpenRecords,
    reapStaleOpenRecords,
    refFor,
    resolveDepth,
    RETIRED_ENVELOPE_PARSE,
    type OpenRecord,
} from '../../src/scripts/hooks/subagent_ledger_hook.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-ledger-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** Every byte the hook wrote under the ledger root, concatenated. */
function allWrittenBytes(): string {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return '';
    const parts: string[] = [];
    const walk = (d: string): void => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) walk(p);
            else parts.push(fs.readFileSync(p, 'utf8'));
        }
    };
    walk(dir);
    return parts.join('\n');
}

function ledgerLines(): Array<Record<string, unknown>> {
    const dir = path.join(root, LEDGER_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: Array<Record<string, unknown>> = [];
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.jsonl')) continue;
        for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
            if (line.trim()) out.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return out;
}

function envelope(event: string, payload: Record<string, unknown>): Record<string, unknown> {
    return { schema_version: 1, platform: 'claude', event, payload };
}

describe('subagent-ledger — event filtering', () => {
    it('writes nothing for an event outside the subagent pair', () => {
        processEnvelope(envelope('post_tool_use', { tool_name: 'Agent' }), root);
        expect(fs.existsSync(path.join(root, LEDGER_DIR))).toBe(false);
    });

    it('records an unidentified line — never silence — when the payload carries no agent id', () => {
        // R2 finding 1: returning silently made an unrecognised host payload
        // shape indistinguishable from "no dispatches happened", which is the
        // one reading the Phase-1 baseline must never be unable to rule out.
        processEnvelope(envelope('subagent_start', { agent_type: 'Explore' }), root);

        const line = ledgerLines()[0]!;
        expect(line.event).toBe('subagent_start');
        expect(line.unidentified).toBe(true);
        expect(line.ref).toBeNull();
        // The agent TYPE is an id-shaped enum and is still salvageable.
        expect(line.agent_type).toBe('Explore');
        // No open record can exist without something to key it on.
        expect(readOpenRecords(root).size).toBe(0);
    });

    it('never returns a non-zero exit, even on a malformed envelope', () => {
        expect(processEnvelope('not an object', root)).toBe(0);
        expect(processEnvelope(envelope('subagent_stop', {}), root)).toBe(0);
    });
});

describe('subagent-ledger — start/stop correlation', () => {
    it('opens a record on start and closes it on stop', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'agent-abc', agent_type: 'Explore' }), root);

        const open = readOpenRecords(root);
        expect(open.size).toBe(1);
        expect([...open.values()][0]?.agent_type).toBe('Explore');

        processEnvelope(
            envelope('subagent_stop', {
                agent_id: 'agent-abc',
                last_assistant_message: '{"summary":"s","handoff":"h","confidence":"high","findings":[],"risks":[]}',
            }),
            root,
        );

        expect(readOpenRecords(root).size).toBe(0);
        expect(fs.existsSync(path.join(root, LEDGER_DIR, OPEN_SUBDIR, `${refFor('agent-abc')}.json`))).toBe(false);

        const lines = ledgerLines();
        expect(lines.map((l) => l.event)).toEqual(['subagent_start', 'subagent_stop']);
        const stop = lines[1]!;
        expect(stop.start_seen).toBe(true);
        expect(typeof stop.duration_ms).toBe('number');
        expect(stop.envelope_parse).toBe('ok');
    });

    it('records a stop whose start was never seen as start_seen:false, not duration 0', () => {
        processEnvelope(envelope('subagent_stop', { agent_id: 'orphan', agent_type: 'Explore' }), root);

        const stop = ledgerLines()[0]!;
        expect(stop.start_seen).toBe(false);
        // `null`, never 0 — a fabricated zero would read as an instant dispatch
        // and silently pollute the duration distribution the baseline reports.
        expect(stop.duration_ms).toBeNull();
        expect(stop.agent_type).toBe('Explore');
    });

    it('uses ONE definition of concurrent_open on both lines: open AFTER this event', () => {
        // R2 finding 8: start counts after its own record is written, stop
        // after its own is removed — so an aggregate over the .jsonl mixes no
        // scales. The stop side was previously pinned by no test at all.
        processEnvelope(envelope('subagent_start', { agent_id: 'a' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'b' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'c' }), root);
        processEnvelope(envelope('subagent_stop', { agent_id: 'b' }), root);
        processEnvelope(envelope('subagent_stop', { agent_id: 'a' }), root);

        expect(ledgerLines().map((l) => l.concurrent_open)).toEqual([1, 2, 3, 2, 1]);
    });
});

describe('subagent-ledger — per-session scoping (Phase 1 Step 4, correction b)', () => {
    it('writes session_id onto BOTH dispatch lines, not just the open record', () => {
        // Without it the denominator is the FILE, not the session: three
        // sessions share one ledger and the measured window read 7 starts
        // against 25 stops. A rate off that aggregates strangers.
        processEnvelope(envelope('subagent_start', { agent_id: 'a', session_id: 's-1' }), root);
        processEnvelope(envelope('subagent_stop', { agent_id: 'a', session_id: 's-1' }), root);

        expect(ledgerLines().map((l) => l.session_id)).toEqual(['s-1', 's-1']);
    });

    it('reads session_id from the envelope when the payload omits it', () => {
        // Same two positions the handler already sources every other field
        // from — payload first, envelope second.
        const env = { ...envelope('subagent_start', { agent_id: 'a' }), session_id: 's-2' };
        processEnvelope(env, root);

        expect(ledgerLines()[0]!.session_id).toBe('s-2');
    });

    it('records absence as null rather than inventing a session', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'a' }), root);

        expect(ledgerLines()[0]!.session_id).toBeNull();
    });

    it('labels a stop with the session it was OBSERVED in, never the start record one', () => {
        // The cross-session stop is the exact artefact that made the window
        // unreadable — one stop belonged to an agent the counting session
        // never dispatched. Back-filling from `rec` would relabel it and hide
        // the mismatch this field exists to expose.
        processEnvelope(envelope('subagent_start', { agent_id: 'a', session_id: 's-1' }), root);
        processEnvelope(envelope('subagent_stop', { agent_id: 'a', session_id: 's-2' }), root);

        expect(ledgerLines().map((l) => l.session_id)).toEqual(['s-1', 's-2']);
    });
});

describe('subagent-ledger — depth (Step 3)', () => {
    it('records a start with no parent field as depth 1, basis assumed-root', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'root-agent' }), root);

        const start = ledgerLines()[0]!;
        expect(start.depth).toBe(1);
        // The distinction that matters: the payload said nothing, so the
        // record says "assumed", never "measured root".
        expect(start.depth_basis).toBe('assumed-root');
        expect(start.parent_ref).toBeNull();
    });

    it('resolves a nested spawn against the open parent record', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'parent' }), root);
        processEnvelope(envelope('subagent_start', { agent_id: 'child', parent_agent_id: 'parent' }), root);

        const child = ledgerLines()[1]!;
        expect(child.depth).toBe(2);
        expect(child.depth_basis).toBe('observed');
        expect(child.parent_ref).toBe(refFor('parent'));
    });

    it('treats a session-level agent id distinct from the starter as the parent', () => {
        processEnvelope(envelope('subagent_start', { agent_id: 'p2' }), root);
        processEnvelope(
            envelope('subagent_start', { agent_id: 'c2', session: { agent_id: 'p2' } }),
            root,
        );

        expect(ledgerLines()[1]!.parent_ref).toBe(refFor('p2'));
    });

    it('labels a closed-parent depth asserted-parent, not observed', () => {
        // R2 finding 5: the payload asserted a parent, so the FACT of nesting
        // is known — but 2 is a floor, since a grandchild whose parent already
        // closed is deeper. Calling that `observed` would feed a guess into
        // exactly the filter a consumer uses to get measured depths.
        const open = new Map<string, OpenRecord>();
        expect(resolveDepth('missing-ref', open)).toEqual({ depth: 2, depth_basis: 'asserted-parent' });
    });
});

describe('subagent-ledger — open-record reaping (R2 finding 2)', () => {
    function plantOpenRecord(ref: string, startedAt: string): void {
        const dir = path.join(root, LEDGER_DIR, OPEN_SUBDIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, `${ref}.json`),
            JSON.stringify({
                ref,
                agent_type: 'Explore',
                started_at: startedAt,
                parent_ref: null,
                depth: 1,
                depth_basis: 'assumed-root',
                session_id: null,
            }),
            'utf8',
        );
    }

    it('reaps a record past the TTL and REPORTS it rather than sweeping it quietly', () => {
        const now = new Date('2026-08-13T12:00:00.000Z');
        const stale = new Date(now.getTime() - OPEN_RECORD_TTL_MS - 1).toISOString();
        plantOpenRecord('deadbeef0001', stale);

        expect(reapStaleOpenRecords(root, now.toISOString())).toBe(1);
        expect(readOpenRecords(root).size).toBe(0);

        const line = ledgerLines()[0]!;
        // The reap line is the point: it is the instrument's only direct
        // sighting of a dispatch that never returned.
        expect(line.event).toBe('subagent_reaped');
        expect(line.ref).toBe('deadbeef0001');
        expect(line.age_ms).toBeGreaterThan(OPEN_RECORD_TTL_MS);
    });

    it('leaves a record inside the TTL alone', () => {
        const now = new Date('2026-08-13T12:00:00.000Z');
        plantOpenRecord('deadbeef0002', new Date(now.getTime() - 60_000).toISOString());

        expect(reapStaleOpenRecords(root, now.toISOString())).toBe(0);
        expect(readOpenRecords(root).size).toBe(1);
        expect(ledgerLines()).toEqual([]);
    });
});

describe('subagent-ledger — open-record validation (R2 finding 7)', () => {
    function plantRaw(name: string, body: unknown): void {
        const dir = path.join(root, LEDGER_DIR, OPEN_SUBDIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), JSON.stringify(body), 'utf8');
    }

    it('refuses a record with no depth instead of computing NaN from it', () => {
        plantRaw('cafebabe0001.json', {
            ref: 'cafebabe0001',
            started_at: '2026-08-13T10:00:00.000Z',
            depth_basis: 'assumed-root',
        });
        expect(readOpenRecords(root).size).toBe(0);

        // The consequence the validation prevents: a null depth on a line
        // still labelled observed.
        processEnvelope(envelope('subagent_start', { agent_id: 'child', parent_agent_id: 'cafebabe' }), root);
        for (const line of ledgerLines()) {
            if (line.depth_basis === 'observed') expect(line.depth).toEqual(expect.any(Number));
        }
    });

    it('refuses a record whose internal ref disagrees with its filename', () => {
        // Otherwise it is loaded, counted, and never deleted — removal unlinks
        // by filename, so the mismatch compounds the leak.
        plantRaw('aaaaaaaaaaaa.json', {
            ref: 'bbbbbbbbbbbb',
            started_at: '2026-08-13T10:00:00.000Z',
            depth: 1,
            depth_basis: 'assumed-root',
        });
        expect(readOpenRecords(root).size).toBe(0);
    });
});

describe('subagent-ledger — envelope classification', () => {
    const valid = { summary: 's', handoff: 'h', confidence: 'high', findings: [], risks: [] };

    it('reports ok for a valid bare envelope', () => {
        expect(classifyEnvelope(JSON.stringify(valid))).toEqual({ verdict: 'ok', error_count: 0 });
    });

    it('reports ok for a valid envelope inside a fenced json block', () => {
        expect(classifyEnvelope(`here you go:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\n`).verdict).toBe('ok');
    });

    it('reports fail — with an error COUNT, not the messages — for a malformed envelope', () => {
        const verdict = classifyEnvelope('{"summary":"s"}');
        expect(verdict.verdict).toBe('fail');
        expect(verdict.error_count).toBeGreaterThan(0);
    });

    it('separates a missing message from a message carrying no envelope', () => {
        // The F2 defect verbatim: both of these used to be `absent`, so 25 of
        // 25 records in the first window read the same verdict — including a
        // control arm that returned a complete report. The split IS the
        // instrument: only `no_message` may key a disk fallback, because
        // `no_envelope` is what nearly every prose answer produces.
        expect(classifyEnvelope(null).verdict).toBe('no_message');
        expect(classifyEnvelope('   ').verdict).toBe('no_message');
        expect(classifyEnvelope('I finished the task, no structured output.').verdict).toBe('no_envelope');
    });

    it('never emits the retired collapsed verdict', () => {
        // A regression fence, not a tautology: the collapse is cheap to
        // reintroduce by editing one return, nothing downstream reads the
        // field back, and no other test would notice.
        const inputs: (string | null)[] = [
            null,
            '   ',
            'prose only',
            '{"summary":"s"}',
            JSON.stringify(valid),
            'preamble {"summary":"s"} trailing }',
        ];
        for (const input of inputs) {
            expect(classifyEnvelope(input).verdict).not.toBe(RETIRED_ENVELOPE_PARSE);
        }
    });

    it('finds a valid envelope followed by later prose braces (R2 finding 4)', () => {
        // The reported failure verbatim: the old first-brace-to-last-brace span
        // swallowed the trailing `{done}`, failed to parse, and reported
        // `absent` — routing an extraction failure into the "never returned
        // anything" bucket the three-way verdict exists to keep separate.
        expect(classifyEnvelope(`... ${JSON.stringify(valid)} - done. See {done}.`).verdict).toBe('ok');
    });

    it('finds a valid envelope preceded by an unrelated object', () => {
        expect(classifyEnvelope(`{"note":"ignore me"} then: ${JSON.stringify(valid)}`).verdict).toBe('ok');
    });

    it('is not confused by a brace inside a string value', () => {
        const tricky = { ...valid, summary: 'a } brace and a \\" quote' };
        expect(classifyEnvelope(JSON.stringify(tricky)).verdict).toBe('ok');
    });

    it('ignores a preceding non-json fenced block (R2 finding 11)', () => {
        const msg = '```bash\nnpm test\n```\n\n```json\n' + JSON.stringify(valid) + '\n```\n';
        expect(classifyEnvelope(msg).verdict).toBe('ok');
    });

    it('still reports fail when the only object present is malformed', () => {
        expect(classifyEnvelope('preamble {"summary":"s"} trailing }').verdict).toBe('fail');
    });
});

describe('subagent-ledger — privacy by construction', () => {
    // High-entropy, unique, and planted in the exact fields the hook reads —
    // so a hit in the written bytes can only have come through the code path
    // under test.
    const HOST_ID = 'ag_7f3c9d2b41e85a6079bc4d1f2e3a5b8c';
    const SECRET_PROSE = 'ZZQX-do-not-persist-this-sentence-9182';

    it('writes no host agent id and no line of the final message to disk', () => {
        processEnvelope(envelope('subagent_start', { agent_id: HOST_ID, agent_type: 'general-purpose' }), root);
        processEnvelope(
            envelope('subagent_stop', {
                agent_id: HOST_ID,
                last_assistant_message: `${SECRET_PROSE} {"summary":"${SECRET_PROSE}","handoff":"h"}`,
            }),
            root,
        );

        const written = allWrittenBytes();
        // The test is only meaningful if the hook wrote something at all.
        expect(written.length).toBeGreaterThan(0);
        expect(written).not.toContain(HOST_ID);
        expect(written).not.toContain(SECRET_PROSE);
        // …and the correlation key that replaced the id IS there, so the
        // absence above is redaction rather than the hook silently doing nothing.
        expect(written).toContain(refFor(HOST_ID));
    });

    it('derives a stable ref across the two separate invocations', () => {
        // Start and stop run in different processes; an unstable (e.g. salted
        // per-run) key would break the only thing the ref exists for.
        expect(refFor(HOST_ID)).toBe(refFor(HOST_ID));
        expect(refFor(HOST_ID)).toHaveLength(12);
        expect(refFor(HOST_ID)).not.toBe(refFor(`${HOST_ID}x`));
    });
});
