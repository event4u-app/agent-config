/**
 * spawn-guard-shadow — Phase 3 Step 1, shadow posture.
 *
 * The load-bearing assertion is the negative one: there is no input that makes
 * this concern deny, warn, or emit anything to the model. Everything else it
 * does is measurement, and a measurement that can change the run is not a
 * measurement.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CANDIDATES,
    STOP_SCAN_BYTES,
    classifySend,
    evaluateCandidates,
    processEnvelope,
} from '../../src/scripts/hooks/spawn_guard_shadow_hook.js';
import { LEDGER_DIR, OPEN_SUBDIR, refFor } from '../../src/scripts/hooks/subagent_ledger_hook.js';
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

/** A finished leg as the ledger records it: a subagent_stop line for its ref. */
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

function sendMessageCall(to: unknown, sessionId: string | null = SESSION): Record<string, unknown> {
    return {
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        payload: {
            tool_name: 'SendMessage',
            ...(sessionId === null ? {} : { session_id: sessionId }),
            tool_input: { to, message: 'SECRET-MESSAGE-BODY' },
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

    it('production default on claude: no worker_resume in the row, so every spawn records host_resume_unobserved', () => {
        processEnvelope(agentCall('ac-worker'), root);
        expect(ledgerLines()[0]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] });
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
        expect(classifySend(root, id, SESSION, now)).toBe('resume');
        // Two months back is outside the window and stays unplaced.
        const old = 'abcdef0123456789a';
        plantStopped(refFor(old), SESSION, new Date('2026-09-15T00:00:00.000Z'));
        expect(classifySend(root, old, SESSION, now)).toBe('message_or_resume');
    });

    it('an open record wins over a matching stop', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        plantOpen(refFor(id), 1);
        expect(classifySend(root, id, SESSION)).toBe('message_running');
    });

    it('reads only a bounded tail of each ledger file', () => {
        const id = 'a7dda5d30ffee4bb4';
        plantStopped(refFor(id));
        // Bury the stop under more than the scan window of unrelated lines.
        const dir = path.join(root, LEDGER_DIR);
        const file = path.join(dir, `${new Date().toISOString().slice(0, 7)}.jsonl`);
        const filler = `${JSON.stringify({ event: 'subagent_start', ref: 'x'.repeat(12), pad: 'p'.repeat(200) })}\n`;
        fs.appendFileSync(file, filler.repeat(Math.ceil((STOP_SCAN_BYTES + 1024) / filler.length)), 'utf8');
        expect(classifySend(root, id, SESSION)).toBe('message_or_resume');
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
