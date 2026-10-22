import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { WorkerCapsule } from '../../src/scripts/_lib/subagent_capsule.js';
import { watermarkForTier } from '../../src/scripts/_lib/worker_budget.js';
import {
    briefSuccessor,
    decideWorkerReuse,
    eligibleWorkers,
    REFUSAL_REASONS,
    RETIRING_REASONS,
    type RefusalReason,
    type ReuseContext,
    type WorkerState,
} from '../../src/scripts/_lib/worker_reuse.js';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const TTL_MS = 5 * 60 * 1000;
const COLD_START = 240_000;

function worker(over: Partial<WorkerState> = {}): WorkerState {
    return {
        name: 'ac-worker-billing',
        domain: 'billing',
        reuse: 'continuity',
        last_request_at_ms: NOW - 60_000,
        cache_ttl_ms: TTL_MS,
        transcript_tokens: 20_000,
        capsule_watermark_tokens: watermarkForTier('medium'),
        compacted: false,
        worktree: '/repo/wt-a',
        branch_head: 'abc1234',
        skill_set_signature: 'sig-1',
        package_version: '9.40.0',
        ...over,
    };
}

function context(over: Partial<ReuseContext> = {}): ReuseContext {
    return {
        domain: 'billing',
        now_ms: NOW,
        observed_fresh_cold_start_tokens: COLD_START,
        worktree: '/repo/wt-a',
        branch_head: 'abc1234',
        skill_set_signature: 'sig-1',
        package_version: '9.40.0',
        ...over,
    };
}

/** One input change per reason — each must refuse with exactly that reason. */
const ONE_FAILURE: Record<RefusalReason, { w?: Partial<WorkerState>; c?: Partial<ReuseContext> }> = {
    domain_mismatch: { c: { domain: 'search' } },
    cache_ttl_expired: { w: { last_request_at_ms: NOW - TTL_MS } },
    transcript_over_cold_start: { w: { transcript_tokens: COLD_START } },
    no_observed_cold_start: { c: { observed_fresh_cold_start_tokens: null } },
    over_capsule_watermark: { w: { transcript_tokens: watermarkForTier('medium') } },
    compacted: { w: { compacted: true } },
    workspace_changed: { c: { branch_head: 'def5678' } },
    not_continuity: { w: { reuse: 'never' } },
    policy_epoch_changed: { c: { package_version: '9.41.0' } },
};

describe('decideWorkerReuse', () => {
    it('one-fixture-per-refusal-reason', () => {
        expect(Object.keys(ONE_FAILURE).sort()).toEqual([...REFUSAL_REASONS].sort());
        const ok = decideWorkerReuse(worker(), context());
        expect(ok.verdict).toBe('resume');
        expect(ok.name).toBe('ac-worker-billing');
        expect(ok.reasons).toEqual([]);

        for (const [reason, change] of Object.entries(ONE_FAILURE)) {
            // The watermark fixture also exceeds nothing else; the cold-start
            // fixture is above the watermark too, so assert containment for it
            // and exact equality everywhere the input isolates one condition.
            const d = decideWorkerReuse(worker(change.w), context(change.c));
            expect(d.verdict, reason).toBe('fresh');
            expect(d.name, reason).toBeNull();
            expect(d.reasons, reason).toContain(reason);
            if (reason !== 'transcript_over_cold_start') expect(d.reasons, reason).toEqual([reason]);
        }
    });

    it('a judge is never re-tasked, whatever its reuse field says', () => {
        // Judge Iron Law read off the declared role, not off a name keyword.
        const d = decideWorkerReuse(worker({ name: 'quiet-checker', role: 'judge' }), context());
        expect(d.verdict).toBe('fresh');
        expect(d.reasons).toEqual(['not_continuity']);
        expect(decideWorkerReuse(worker({ role: 'worker' }), context()).verdict).toBe('resume');
    });

    it('each workspace axis refuses on its own', () => {
        for (const c of [{ worktree: '/repo/wt-b' }, { skill_set_signature: 'sig-2' }, { branch_head: 'x' }]) {
            expect(decideWorkerReuse(worker(), context(c)).reasons).toEqual(['workspace_changed']);
        }
    });

    it('the decision carries every input it read', () => {
        const w = worker();
        const c = context();
        const d = decideWorkerReuse(w, c);
        expect(d.inputs.worker).toEqual(w);
        expect(d.inputs.context).toEqual(c);
    });
});

describe('the register is a view', () => {
    it('no-agent-id-reaches-disk', () => {
        const states = [worker(), worker({ name: 'ac-researcher-billing', reuse: 'never' })];
        expect(eligibleWorkers(states, context())).toEqual(['ac-worker-billing']);
        const decision = decideWorkerReuse(worker(), context());
        // The name is the address: no key in the decision can hold a host agent id.
        expect(JSON.stringify(decision)).not.toMatch(/agent_?id/i);
        const HERE = path.dirname(fileURLToPath(import.meta.url));
        const source = fs.readFileSync(path.resolve(HERE, '../../src/scripts/_lib/worker_reuse.ts'), 'utf-8');
        // Pure: nothing in the module can write a store.
        expect(source).not.toMatch(/from 'node:(fs|child_process)'/);
        expect(source).not.toMatch(/agent_?id/i);
    });
});

function capsule(over: Partial<WorkerCapsule> = {}): WorkerCapsule {
    return {
        summary: 'Billing slice half done.',
        generation: 2,
        done: ['src/billing/invoice.ts:40'],
        remaining: ['wire the refund path'],
        decisions: ['keep the existing ledger shape'],
        open_risks: [],
        touched_files: ['src/billing/invoice.ts'],
        assumptions: [{ statement: 'refunds are idempotent', basis: 'src/billing/refund.ts:12', epistemic_state: 'assumed' }],
        ...over,
    };
}

describe('briefSuccessor', () => {
    it('retired-worker-briefs-successor-from-capsule', () => {
        for (const reason of RETIRING_REASONS) {
            const change = ONE_FAILURE[reason];
            const d = decideWorkerReuse(worker(change.w), context(change.c));
            const brief = briefSuccessor(d, capsule());
            expect(brief.kind, reason).toBe('successor');
            if (brief.kind !== 'successor') continue;
            expect(brief.predecessor).toBe('ac-worker-billing');
            expect(brief.generation).toBe(3);
            expect(brief.capsule.assumptions).toEqual(capsule().assumptions);
        }
        // A resumable worker is re-tasked, not retired.
        expect(briefSuccessor(decideWorkerReuse(worker(), context()), capsule()).kind).toBe('resume');
        // A different domain or a never-reusable definition is a plain fresh spawn.
        for (const reason of ['domain_mismatch', 'not_continuity'] as const) {
            const change = ONE_FAILURE[reason];
            const d = decideWorkerReuse(worker(change.w), context(change.c));
            expect(briefSuccessor(d, capsule()).kind, reason).toBe('fresh');
        }
        // An invalid capsule never briefs a successor — it falls back loudly.
        const d = decideWorkerReuse(worker({ compacted: true }), context());
        const bad = briefSuccessor(d, capsule({ summary: '' }));
        expect(bad.kind).toBe('stop-loss');
        if (bad.kind === 'stop-loss') expect(bad.errors.length).toBeGreaterThan(0);
        // No capsule at all is the same loud fallback.
        expect(briefSuccessor(d, null).kind).toBe('stop-loss');
    });
});
