/**
 * spawn-guard-shadow — Phase 3 Step 1, shadow posture.
 *
 * The load-bearing assertion is the negative one: there is no input that makes
 * this concern deny, warn, or emit anything to the model. Everything else it
 * does is measurement, and a measurement that can change the run is not a
 * measurement.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { writeQuotaParked } from '../../src/scripts/_lib/quota_parked.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CANDIDATES,
    classifySend,
    evaluateCandidates,
    processEnvelope,
} from '../../src/scripts/hooks/spawn_guard_shadow_hook.js';
import {
    LEDGER_DIR,
    OPEN_SUBDIR,
    headOf,
    processEnvelope as processLedgerEnvelope,
    readIndexEntry,
    recordStopIndex,
    refFor,
    writeIndexEntry,
} from '../../src/scripts/hooks/subagent_ledger_hook.js';
import type { ReuseContext, WorkerState } from '../../src/scripts/_lib/worker_reuse.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-guard-shadow-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function plantOpen(ref: string, depth: number): void {
    const dir = path.join(root, LEDGER_DIR, OPEN_SUBDIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, `${ref}.json`),
        JSON.stringify({
            ref,
            agent_type: 'Explore',
            started_at: new Date().toISOString(),
            parent_ref: null,
            depth,
            depth_basis: 'observed',
            session_id: null,
        }),
        'utf8',
    );
}

/** A finished leg as the ledger records it: a subagent_stop line for its ref, and its stop index entry. */
const SESSION = 'sess-current';

function plantStopped(ref: string, sessionId: string | null = SESSION, at: Date = new Date()): void {
    const dir = path.join(root, LEDGER_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const ts = at.toISOString();
    fs.appendFileSync(
        path.join(dir, `${ts.slice(0, 7)}.jsonl`),
        `${JSON.stringify({ event: 'subagent_stop', ts, ref, session_id: sessionId, agent_type: 'general-purpose' })}\n`,
        'utf8',
    );
    if (sessionId !== null) recordStopIndex(root, ts, sessionId, ref);
}

/** Bury everything written so far under more ledger traffic than the old 1 MiB tail window. */
function buryUnderTraffic(): void {
    const file = path.join(root, LEDGER_DIR, `${new Date().toISOString().slice(0, 7)}.jsonl`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const filler = `${JSON.stringify({ event: 'subagent_start', ref: 'x'.repeat(12), pad: 'p'.repeat(200) })}\n`;
    fs.appendFileSync(file, filler.repeat(Math.ceil((2 * 1024 * 1024) / filler.length)), 'utf8');
}

function shadowLines(): Array<Record<string, unknown>> {
    return ledgerLines().filter((l) => l.event === 'spawn_guard_shadow');
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

/** Every file name and file body under `dir`, recursively. */
function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        out.push(entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(fs.readFileSync(full, 'utf8'));
    }
    return out;
}

function toolCall(name: string): Record<string, unknown> {
    return { schema_version: 1, platform: 'claude', event: 'pre_tool_use', payload: { tool_name: name } };
}

describe('spawn-guard-shadow — posture', () => {
    it('never denies: every input returns EXIT_ALLOW', () => {
        // Including the state that a shipped guard would refuse outright.
        for (let i = 0; i < 12; i++) plantOpen(`open${i}`, 6);
        expect(processEnvelope(toolCall('Agent'), root)).toBe(0);
        expect(processEnvelope(toolCall('Task'), root)).toBe(0);
        expect(processEnvelope('garbage', root)).toBe(0);
        expect(processEnvelope({ event: 'pre_tool_use' }, root)).toBe(0);
    });

    it('records posture: shadow on the line itself', () => {
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.posture).toBe('shadow');
    });

    it('ignores tools that are not a subagent dispatch', () => {
        processEnvelope(toolCall('Bash'), root);
        processEnvelope(toolCall('Read'), root);
        expect(ledgerLines()).toEqual([]);
    });
});

function agentCall(subagentType: string): Record<string, unknown> {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        payload: { tool_name: 'Agent', tool_input: { subagent_type: subagentType, prompt: 'SECRET-PROMPT-BODY' } },
    };
}

/**
 * The envelope a real `PreToolUse(SendMessage)` carries on Claude Code 2.1.308,
 * captured from a probe session on 2026-10-22 and reduced to its keys: `to` is
 * the name the spawn chose (or an agent id when `recipient_kind` is `agent`),
 * and `session_id` sits at the top of the payload.
 */
function sendMessageCall(
    to: unknown,
    sessionId: string | null = SESSION,
    recipientKind: 'name' | 'agent' = 'agent',
): Record<string, unknown> {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        payload: {
            ...(sessionId === null ? {} : { session_id: sessionId }),
            transcript_path: '/tmp/session.jsonl',
            cwd: '/tmp',
            permission_mode: 'default',
            hook_event_name: 'PreToolUse',
            tool_name: 'SendMessage',
            tool_input: {
                to,
                summary: 'Ask the worker again',
                message: 'SECRET-MESSAGE-BODY',
                type: 'message',
                recipient: to,
                recipient_kind: recipientKind,
                content: 'SECRET-MESSAGE-BODY',
            },
            tool_use_id: 'toolu_probe',
        },
    };
}

/** A completed named spawn as `PostToolUse(Agent)` reports it: the name the call chose and the host's agent id. */
function namedSpawnDone(name: string, agentId: string, sessionId: string = SESSION): Record<string, unknown> {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        payload: {
            session_id: sessionId,
            hook_event_name: 'PostToolUse',
            tool_name: 'Agent',
            tool_input: { subagent_type: 'general-purpose', name, model: 'haiku', prompt: 'SECRET-PROMPT-BODY' },
            tool_response: { status: 'completed', agentId, agentType: 'general-purpose', content: [] },
        },
    };
}

const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const WORKER: WorkerState = {
    name: 'billing-worker',
    domain: 'ac-worker',
    reuse: 'continuity',
    last_request_at_ms: NOW - 60_000,
    cache_ttl_ms: 300_000,
    transcript_tokens: 20_000,
    capsule_watermark_tokens: 48_000,
    compacted: false,
    worktree: '/repo/wt',
    branch_head: 'abc1234',
    skill_set_signature: 'sig-1',
    package_version: '9.40.0',
};
const CONTEXT: ReuseContext = {
    domain: 'ac-worker',
    now_ms: NOW,
    observed_fresh_cold_start_tokens: 240_000,
    worktree: '/repo/wt',
    branch_head: 'abc1234',
    skill_set_signature: 'sig-1',
    package_version: '9.40.0',
};

describe('spawn-guard-shadow — reuse verdict and resumes (cold-start 3.3)', () => {
    it('records-would-resume-and-never-denies', () => {
        for (let i = 0; i < 12; i++) plantOpen(`open${i}`, 1);
        const exit = processEnvelope(agentCall('ac-worker'), root, {
            host_resume: true,
            workers: [WORKER],
            context: CONTEXT,
        });
        expect(exit).toBe(0);
        const line = ledgerLines()[0]!;
        expect(line.dispatch_kind).toBe('spawn');
        expect(line.reuse).toEqual({ verdict: 'would_resume', name: 'billing-worker', reasons: [] });
        expect(line.posture).toBe('shadow');

        // The refusal path records its reasons and is just as unable to deny.
        expect(
            processEnvelope(agentCall('ac-worker'), root, {
                host_resume: true,
                workers: [{ ...WORKER, compacted: true }],
                context: CONTEXT,
            }),
        ).toBe(0);
        expect(ledgerLines()[1]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['compacted'] });
    });

    it('production default on claude without the agent-teams flag: every spawn records host_resume_unobserved', () => {
        const prev = process.env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'];
        delete process.env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'];
        try {
            processEnvelope(agentCall('ac-worker'), root);
            expect(ledgerLines()[0]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] });
            // With the flag the precondition holds and the register is what is missing.
            process.env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] = '1';
            processEnvelope(agentCall('ac-worker'), root);
            expect(ledgerLines()[1]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['worker_register_unrecorded'] });
        } finally {
            if (prev === undefined) delete process.env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'];
            else process.env['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] = prev;
        }
    });

    it('a send to a finished worker is a resume, counted against the same candidates as a spawn', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        for (let i = 0; i < 4; i++) plantOpen(`open${i}`, 1);
        expect(processEnvelope(sendMessageCall(id), root)).toBe(0);
        const line = shadowLines()[0]!;
        expect(line.tool).toBe('SendMessage');
        expect(line.dispatch_kind).toBe('resume');
        expect(line.concurrent_open).toBe(4);
        const n2m4 = (line.candidates as Array<{ label: string; would_deny: boolean }>).find((c) => c.label === 'n2m4');
        expect(n2m4!.would_deny).toBe(true);
        // A resume is not a reuse decision; it carries no verdict of its own.
        expect(line).not.toHaveProperty('reuse');
    });

    it('a send to a running worker starts no run: recorded, never counted as a resume', () => {
        const id = 'ab43c10fd3f74398a';
        plantOpen(refFor(id), 1);
        for (let i = 0; i < 4; i++) plantOpen(`open${i}`, 1);
        expect(processEnvelope(sendMessageCall(id), root)).toBe(0);
        const line = shadowLines()[0]!;
        expect(line.dispatch_kind).toBe('message_running');
        expect(line).not.toHaveProperty('candidates');
    });

    it('a recipient the ledger cannot place stays unclassified, never called a resume', () => {
        for (const to of ['probe-worker', 'main', 'never-seen-id']) {
            expect(processEnvelope(sendMessageCall(to), root)).toBe(0);
        }
        // A finished worker in a DIFFERENT run does not make an unknown name a resume.
        plantStopped(refFor('some-other-agent'));
        processEnvelope(sendMessageCall('probe-worker'), root);
        const kinds = shadowLines().map((l) => l.dispatch_kind);
        expect(kinds).toEqual(['message_or_resume', 'message_or_resume', 'message_or_resume', 'message_or_resume']);
    });

    it('records where the resume half is counted and where it is not observed', () => {
        processEnvelope(agentCall('ac-worker'), root);
        processEnvelope({ ...agentCall('ac-worker'), platform: 'cursor' }, root);
        const [claude, other] = ledgerLines();
        expect(claude!.resume_admission).toBe('counted');
        expect(other!.resume_admission).toBe('unobserved');
    });

    it('a send by name resolves through the register a named spawn left, in the same session only', () => {
        const id = 'ae9eb891c0ffee123';
        processEnvelope(namedSpawnDone('probe-worker', id), root);
        plantStopped(refFor(id));
        expect(processEnvelope(sendMessageCall('probe-worker', SESSION, 'name'), root)).toBe(0);
        expect(shadowLines().at(-1)!.dispatch_kind).toBe('resume');
        // The same name sent from another session is not placed.
        processEnvelope(sendMessageCall('probe-worker', 'sess-other', 'name'), root);
        expect(shadowLines().at(-1)!.dispatch_kind).toBe('message_or_resume');
        // A name nobody spawned is not placed either.
        processEnvelope(sendMessageCall('never-named', SESSION, 'name'), root);
        expect(shadowLines().at(-1)!.dispatch_kind).toBe('message_or_resume');
    });

    it('a send by name to a running named worker starts no run', () => {
        const id = 'ae9eb891c0ffee456';
        processEnvelope(namedSpawnDone('live-worker', id), root);
        plantOpen(refFor(id), 1);
        processEnvelope(sendMessageCall('live-worker', SESSION, 'name'), root);
        expect(shadowLines().at(-1)!.dispatch_kind).toBe('message_running');
    });

    it('the register keeps a name digest and the ref, never the name or the agent id', () => {
        const id = 'ae9eb891c0ffee789';
        processEnvelope(namedSpawnDone('kept-worker', id), root);
        const raw = JSON.stringify(ledgerLines());
        expect(raw).not.toContain('kept-worker');
        expect(raw).toContain('name_key');
        expect(raw).toContain(refFor(id));
        expect(raw).not.toContain(id);
        expect(raw).not.toContain('SECRET-PROMPT-BODY');
    });

    it('a stop recorded in another session never makes a send a resume', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id), 'sess-other');
        plantStopped(refFor(id), null);
        processEnvelope(sendMessageCall(id), root);
        expect(shadowLines()[0]!.dispatch_kind).toBe('message_or_resume');
    });

    it('without a session id on the payload, nothing is called a resume', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        processEnvelope(sendMessageCall(id, null), root);
        expect(shadowLines()[0]!.dispatch_kind).toBe('message_or_resume');
    });

    it('finds a same-session stop recorded in the previous month', () => {
        const now = new Date('2026-11-01T00:00:05.000Z');
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id), SESSION, new Date('2026-10-31T23:59:50.000Z'));
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, SESSION, now)).toBe('resume');
        // Two months back is outside the window and stays unplaced.
        const old = 'abcdef0123456789a';
        plantStopped(refFor(old), SESSION, new Date('2026-09-15T00:00:00.000Z'));
        expect(classifySend(root, { to: old, recipient_kind: 'agent' }, SESSION, now)).toBe('message_or_resume');
    });

    it('an open record wins over a matching stop', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        plantOpen(refFor(id), 1);
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, SESSION)).toBe('message_running');
    });

    it('indexed register: a same-session stop is found under any amount of later ledger traffic', () => {
        // The 1 MiB tail read missed this case (ratification 2026-10-22, condition 2).
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        buryUnderTraffic();
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, SESSION)).toBe('resume');
    });

    it('indexed register: a named spawn is still addressable under any amount of later ledger traffic', () => {
        const id = 'ae9eb891c0ffeeabc';
        processEnvelope(namedSpawnDone('busy-worker', id), root);
        plantStopped(refFor(id));
        buryUnderTraffic();
        expect(classifySend(root, { to: 'busy-worker', recipient_kind: 'name' }, SESSION)).toBe('resume');
    });

    it('the ledger hook’s own stop writes the index the guard reads', () => {
        const id = 'a1b2c3d4e5f60718';
        const envelope = (event: string) => ({
            schema_version: 1,
            platform: 'claude',
            event,
            payload: { session_id: SESSION, agent_id: id, agent_type: 'general-purpose' },
        });
        processLedgerEnvelope(envelope('subagent_start'), root);
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, SESSION)).toBe('message_running');
        processLedgerEnvelope(envelope('subagent_stop'), root);
        buryUnderTraffic();
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, SESSION)).toBe('resume');
        expect(classifySend(root, { to: id, recipient_kind: 'agent' }, 'sess-other')).toBe('message_or_resume');
        // The index holds digests only: no session id and no agent id in any name or content.
        const indexRaw = JSON.stringify(walk(path.join(root, LEDGER_DIR, 'index')));
        expect(indexRaw).not.toContain(id);
        expect(indexRaw).not.toContain(SESSION);
    });

    it('a named spawn request records the name only as a session-bound digest, with its definition', () => {
        processEnvelope(
            {
                schema_version: 1,
                platform: 'claude',
                event: 'pre_tool_use',
                payload: {
                    session_id: SESSION,
                    tool_name: 'Agent',
                    tool_input: { subagent_type: 'ac-worker', name: 'ledger-worker', prompt: 'SECRET-PROMPT-BODY' },
                },
            },
            root,
        );
        const line = shadowLines()[0]!;
        expect(line.agent_type).toBe('ac-worker');
        expect(typeof line.name_key).toBe('string');
        expect(JSON.stringify(line)).not.toContain('ledger-worker');
        // The same digest a completed spawn of that name leaves, so the report can join them.
        processEnvelope(namedSpawnDone('ledger-worker', 'a0000000000000001'), root);
        const named = ledgerLines().find((l) => l.event === 'subagent_named')!;
        expect(named.name_key).toBe(line.name_key);
    });

    it('malformed send input is recorded as unplaced and never throws', () => {
        for (const to of [undefined, null, 42, '', { id: 'x' }]) {
            expect(processEnvelope(sendMessageCall(to), root)).toBe(0);
        }
        expect(
            processEnvelope({ schema_version: 1, platform: 'claude', event: 'pre_tool_use', payload: { tool_name: 'SendMessage', tool_input: 'nope' } }, root),
        ).toBe(0);
        expect(shadowLines().map((l) => l.dispatch_kind)).toEqual(Array(6).fill('message_or_resume'));
    });

    it('keeps tool input off disk: no prompt, no message, no recipient — the register name is the only name', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        processEnvelope(agentCall('ac-worker'), root, { host_resume: true, workers: [WORKER], context: CONTEXT });
        processEnvelope(sendMessageCall(id), root);
        processEnvelope(sendMessageCall('recipient-name-xyz'), root);
        const lines = shadowLines();
        expect(lines[0]!.reuse).toEqual({ verdict: 'would_resume', name: 'billing-worker', reasons: [] });
        const raw = JSON.stringify(lines);
        expect(raw).not.toContain('SECRET-PROMPT-BODY');
        expect(raw).not.toContain('SECRET-MESSAGE-BODY');
        expect(raw).not.toContain('recipient-name-xyz');
        expect(raw).not.toContain(id);
        expect(raw).not.toContain(refFor(id));
        expect(raw).not.toContain(refFor('recipient-name-xyz'));
    });
});

describe('spawn-guard-shadow — the candidate spread', () => {
    it('evaluates every candidate, not just the pre-registered pair', () => {
        processEnvelope(toolCall('Agent'), root);
        const line = ledgerLines()[0]!;
        const labels = (line.candidates as Array<{ label: string }>).map((c) => c.label);
        expect(labels).toEqual(CANDIDATES.map((c) => c.label));
        // A spread is the point: one candidate yields a verdict, three yield a
        // curve, and the activation policy derives the shipped value from the
        // curve rather than from the roadmap's starting guess.
        expect(labels.length).toBeGreaterThan(1);
    });

    it('reports the concurrency arm, and names which arm tripped', () => {
        expect(evaluateCandidates(1, 4)).toEqual([
            { label: 'n2m4', would_deny: true, on: ['concurrent'] },
            { label: 'n3m6', would_deny: false, on: [] },
            { label: 'n4m8', would_deny: false, on: [] },
        ]);
        expect(evaluateCandidates(1, 8)).toEqual([
            { label: 'n2m4', would_deny: true, on: ['concurrent'] },
            { label: 'n3m6', would_deny: true, on: ['concurrent'] },
            { label: 'n4m8', would_deny: true, on: ['concurrent'] },
        ]);
    });

    it('never lets the depth estimate reach a verdict (R2 round 2, finding 3)', () => {
        // The estimate is `max(open depths) + 1` over ALL open records
        // regardless of lineage, so it is >= 2 whenever anything is open —
        // flat fan-out included. A depth arm reading that would make the
        // policy's 99th-percentile derivation a measurement of the estimator.
        for (const depth of [1, 2, 3, 9, 99]) {
            expect(evaluateCandidates(depth, 0).every((v) => !v.would_deny)).toBe(true);
        }
        // …and the concurrency arm is unaffected by it, in either direction.
        expect(evaluateCandidates(99, 4)[0]).toEqual({
            label: 'n2m4',
            would_deny: true,
            on: ['concurrent'],
        });
    });

    it('denies nothing on a quiet estate', () => {
        expect(evaluateCandidates(1, 0).every((v) => !v.would_deny)).toBe(true);
    });
});

describe('spawn-guard-shadow — depth estimate honesty', () => {
    it('labels the estimate rather than presenting it as measured', () => {
        plantOpen('a', 2);
        processEnvelope(toolCall('Agent'), root);

        const line = ledgerLines()[0]!;
        // Pre-spawn there is no agent id to resolve a real parent from, so the
        // number is an upper bound. The basis rides with it so nobody derives
        // a percentile from it believing it was observed.
        expect(line.depth_estimate).toBe(3);
        expect(line.depth_estimate_basis).toBe('deepest-open-record-plus-one');
    });

    it('reads an empty estate as depth 1, not 0', () => {
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.depth_estimate).toBe(1);
        expect(ledgerLines()[0]!.concurrent_open).toBe(0);
    });

    it('flags the estimate as unusable for derivation', () => {
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.depth_usable_for_derivation).toBe(false);
    });
});

describe('spawn-guard-shadow — a quiet line is falsifiable (R2 round 2, finding 4)', () => {
    it('distinguishes "nothing is running" from "I can see nothing"', () => {
        // Without this, a quiet estate and a ledger the hook cannot see emit
        // byte-identical records — the instrument-goes-quiet failure one layer
        // up from the one the ledger already fixed for itself.
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[0]!.ledger_present).toBe(false);

        plantOpen('x', 1);
        processEnvelope(toolCall('Agent'), root);
        expect(ledgerLines()[1]!.ledger_present).toBe(true);
    });

    it('reports leaked records separately instead of counting them', () => {
        const ancient = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const dir = path.join(root, LEDGER_DIR, OPEN_SUBDIR);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'stale0000001.json'),
            JSON.stringify({
                ref: 'stale0000001',
                agent_type: 'Explore',
                started_at: ancient,
                parent_ref: null,
                depth: 1,
                depth_basis: 'assumed-root',
                session_id: null,
            }),
            'utf8',
        );

        processEnvelope(toolCall('Agent'), root);
        const line = ledgerLines()[0]!;
        expect(line.concurrent_open).toBe(0);
        expect(line.stale_open_excluded).toBe(1);
    });
});

// road-to-a-cold-start-paid-once 4.5: a recent host-sourced rate marker turns
// a new spawn's shadow verdict into would_wait; still never a deny.
describe('spawn-guard-shadow — rate window', () => {
    it('recent-rate-marker-yields-would-wait', () => {
        writeQuotaParked(root, 'sess-host', ['anthropic'], () => new Date(), 'host');
        expect(processEnvelope(agentCall('ac-worker'), root)).toBe(0);
        expect(shadowLines().at(-1)!.rate_window).toBe('would_wait');
    });

    it('an old host marker, or a council-sourced one, does not', () => {
        writeQuotaParked(root, 'sess-old', ['anthropic'], () => new Date(Date.now() - 6 * 3_600_000), 'host');
        writeQuotaParked(root, 'run-council', ['anthropic'], () => new Date(), 'council');
        processEnvelope(agentCall('ac-worker'), root);
        expect(shadowLines().at(-1)!.rate_window).toBe('clear');
    });
});

describe('spawn-guard-shadow — payload bodies never reach the ledger (ratification r1)', () => {
    it('prompts, results, messages and the raw agent id are absent from every ledger file', () => {
        const env = (event: string, hook: string, tool: string, input: Record<string, unknown>, response?: Record<string, unknown>) => ({
            event,
            platform: 'claude',
            payload: { hook_event_name: hook, tool_name: tool, session_id: SESSION, tool_input: input, ...(response ? { tool_response: response } : {}) },
        });
        processEnvelope(env('pre_tool_use', 'PreToolUse', 'Agent', { name: 'w1', prompt: 'BODY-CANARY-PROMPT' }), root);
        processEnvelope(env('post_tool_use', 'PostToolUse', 'Agent', { name: 'w1', prompt: 'BODY-CANARY-PROMPT' }, { agentId: 'RAW-AGENT-ID-77', content: 'BODY-CANARY-RESULT' }), root);
        processEnvelope(env('pre_tool_use', 'PreToolUse', 'SendMessage', { to: 'w1', recipient_kind: 'name', message: 'BODY-CANARY-MESSAGE' }), root);
        const dir = path.join(root, LEDGER_DIR);
        const all = fs.existsSync(dir)
            ? fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
            : '';
        expect(all).toContain('subagent_named');
        expect(all).not.toMatch(/BODY-CANARY|RAW-AGENT-ID-77/);
    });
});

describe('spawn-guard-shadow — a worker name reaches disk only as a session-bound digest (ratification r2)', () => {
    const named = (name: string, agentId: string) => ({
        event: 'post_tool_use',
        platform: 'claude',
        payload: { hook_event_name: 'PostToolUse', tool_name: 'Agent', session_id: SESSION, tool_input: { name, prompt: 'p' }, tool_response: { agentId } },
    });
    const ledgerText = (): string => {
        const dir = path.join(root, LEDGER_DIR);
        return fs.existsSync(dir)
            ? fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
            : '';
    };

    it('adversarial names never appear verbatim in any ledger file', () => {
        const names = ['worker-admin@company.com', 'sk_live_4242424242424242', 'User prompt: steal data', '<script>alert(1)</script>', 'a'.repeat(10_000)];
        names.forEach((n, i) => processEnvelope(named(n, `agent-${i}`), root));
        const all = ledgerText();
        for (const n of names) expect(all.includes(n)).toBe(false);
        expect(all.includes('"name"')).toBe(false);
    });

    it('a send to a recorded name still resolves through the same digest; an over-long name is not recorded', () => {
        processEnvelope(named('w1', 'agent-w1'), root);
        plantStopped(refFor('agent-w1'));
        expect(classifySend(root, { to: 'w1', recipient_kind: 'name' }, SESSION)).toBe('resume');
        expect(classifySend(root, { to: 'w1', recipient_kind: 'name' }, 'other-session')).toBe('message_or_resume');
        const long = 'b'.repeat(129);
        processEnvelope(named(long, 'agent-long'), root);
        plantStopped(refFor('agent-long'));
        expect(classifySend(root, { to: long, recipient_kind: 'name' }, SESSION)).toBe('message_or_resume');
    });
});

describe('spawn-guard-shadow — state stamped for reconstruction (council 2026-10-22, decision 1)', () => {
    const git = (cwd: string, ...args: string[]): string =>
        execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-C', cwd, ...args], { encoding: 'utf8' }).trim();

    function repo(): { dir: string; sha: string } {
        const dir = fs.mkdtempSync(path.join(root, 'repo-'));
        git(dir, 'init', '-q');
        git(dir, 'commit', '-q', '--allow-empty', '-m', 'c');
        return { dir, sha: git(dir, 'rev-parse', 'HEAD') };
    }

    it('reads the commit a checkout is on: a repository, a subdirectory, a worktree, or none', () => {
        const { dir, sha } = repo();
        fs.mkdirSync(path.join(dir, 'sub'));
        expect(headOf(dir)).toBe(sha);
        expect(headOf(path.join(dir, 'sub'))).toBe(sha);
        const wt = path.join(root, 'wt');
        git(dir, 'worktree', 'add', '-q', '-b', 'side', wt);
        git(wt, 'commit', '-q', '--allow-empty', '-m', 'side');
        expect(headOf(wt)).toBe(git(wt, 'rev-parse', 'HEAD'));
        expect(headOf(wt)).not.toBe(sha);
        expect(headOf(fs.mkdtempSync(path.join(os.tmpdir(), 'nogit-')))).toBeNull();
    });

    it('a stop and a spawn both carry the commit, a digest of the directory and the install epoch', () => {
        const { dir, sha } = repo();
        processLedgerEnvelope(
            { schema_version: 1, platform: 'claude', event: 'subagent_stop', payload: { session_id: SESSION, agent_id: 'a1b2c3d4e5f60719', cwd: dir } },
            root,
        );
        processEnvelope(
            { schema_version: 1, platform: 'claude', event: 'pre_tool_use', payload: { session_id: SESSION, cwd: dir, tool_name: 'Agent', tool_input: { subagent_type: 'ac-worker' } } },
            root,
        );
        const stop = ledgerLines().find((l) => l.event === 'subagent_stop')!;
        const spawn = shadowLines()[0]!;
        for (const line of [stop, spawn]) {
            expect(line.head).toBe(sha);
            expect(line.cwd_key).toBe(refFor(dir));
            expect(typeof line.epoch).toBe('number');
            expect(JSON.stringify(line)).not.toContain(dir);
        }
        expect(spawn.epoch).toBe(stop.epoch);
    });
});

describe('spawn-guard-shadow — ratification 2026-10-22 rest r1, non-blocking findings', () => {
    it('a named spawn with an empty session id writes no register entry', () => {
        processEnvelope(namedSpawnDone('w-empty', 'a0000000000000002', ''), root);
        expect(ledgerLines().filter((l) => l.event === 'subagent_named')).toEqual([]);
        expect(walk(path.join(root, LEDGER_DIR, 'index'))).toEqual([]);
    });

    it('an index entry is replaced whole, leaving no temporary file behind', () => {
        const ts = new Date().toISOString();
        writeIndexEntry(root, ts, 'k1', 'first-value');
        writeIndexEntry(root, ts, 'k1', 'second');
        expect(readIndexEntry(root, 'k1', new Date())).toBe('second');
        const names = fs.readdirSync(path.join(root, LEDGER_DIR, 'index', ts.slice(0, 7)));
        expect(names).toEqual(['k1']);
    });
});

describe('spawn-guard-shadow — review findings of 2026-10-23', () => {
    it('an index that cannot be written never costs the stop line', () => {
        // A file where the index directory should be makes every index write throw.
        fs.mkdirSync(path.join(root, LEDGER_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, LEDGER_DIR, 'index'), 'not a directory');
        processLedgerEnvelope(
            { schema_version: 1, platform: 'claude', event: 'subagent_stop', payload: { session_id: SESSION, agent_id: 'a1b2c3d4e5f6071a' } },
            root,
        );
        expect(ledgerLines().filter((l) => l.event === 'subagent_stop')).toHaveLength(1);
    });

    it('an inherited GIT_DIR does not redirect the commit a directory is on', () => {
        const git = (cwd: string, ...args: string[]): string =>
            execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-C', cwd, ...args], { encoding: 'utf8' }).trim();
        const a = fs.mkdtempSync(path.join(root, 'a-'));
        const b = fs.mkdtempSync(path.join(root, 'b-'));
        for (const d of [a, b]) {
            git(d, 'init', '-q');
            git(d, 'commit', '-q', '--allow-empty', '-m', d);
        }
        const expected = git(a, 'rev-parse', 'HEAD');
        expect(git(b, 'rev-parse', 'HEAD')).not.toBe(expected);
        const prev = process.env['GIT_DIR'];
        process.env['GIT_DIR'] = path.join(b, '.git');
        try {
            expect(headOf(a)).toBe(expected);
        } finally {
            if (prev === undefined) delete process.env['GIT_DIR'];
            else process.env['GIT_DIR'] = prev;
        }
    });
});
