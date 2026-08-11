/**
 * Exactly-once confirmation store (dispatch-safety Phase 2.2).
 *
 * The property under test is the one the policy in
 * `src/rules/non-destructive-by-default.md` needs and the tree had no mechanism
 * for: a staged action executes on the first approval and NOT on the second.
 * A happy-path stage-then-confirm assertion cannot see that, so the
 * double-approve case is the test that carries the phase.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONFIRMATIONS_REL,
    confirmAction,
    consumedDir,
    listPending,
    pendingDir,
    stageAction,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/confirmation.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const input = {
    gate_id: 'require_memory_hits',
    phase: 'refine',
    action: 'advance',
    object: 'refine',
} as const;

describe('confirmation store — exactly-once', () => {
    it('stages under agents/runtime/, which the repo gitignore already covers', () => {
        const rec = stageAction(root, input, { token: 't1', now: '2026-08-11T00:00:00.000Z' });
        expect(CONFIRMATIONS_REL).toBe(path.join('agents', 'runtime', 'confirmations'));
        expect(fs.existsSync(path.join(pendingDir(root), 't1.json'))).toBe(true);
        expect(rec.staged_at).toBe('2026-08-11T00:00:00.000Z');
    });

    it('a double approve executes once — second call reports already_executed', () => {
        stageAction(root, input, { token: 't2' });

        const first = confirmAction(root, 't2');
        expect(first.status).toBe('executed');
        expect(first.record?.object).toBe('refine');

        const second = confirmAction(root, 't2');
        expect(second.status).toBe('already_executed');
        // The consumed record survives, so "already executed" is provable rather
        // than inferred from an absence.
        expect(second.record?.token).toBe('t2');

        expect(fs.existsSync(path.join(pendingDir(root), 't2.json'))).toBe(false);
        expect(fs.existsSync(path.join(consumedDir(root), 't2.json'))).toBe(true);
    });

    it('a token that was never staged is unknown, not already_executed', () => {
        // The two must stay distinguishable: `unknown` is a typo or a wrong
        // project root, `already_executed` is a real second approval. Collapsing
        // them would make an operator read a mistyped token as a completed action.
        const out = confirmAction(root, 'never-staged');
        expect(out.status).toBe('unknown');
        expect(out.record).toBeNull();
    });

    it('listPending shows staged actions oldest first and drops consumed ones', () => {
        stageAction(root, input, { token: 'b', now: '2026-08-11T02:00:00.000Z' });
        stageAction(root, input, { token: 'a', now: '2026-08-11T01:00:00.000Z' });
        expect(listPending(root).map((r) => r.token)).toEqual(['a', 'b']);

        confirmAction(root, 'a');
        expect(listPending(root).map((r) => r.token)).toEqual(['b']);
    });

    it('listPending on a root with no store is empty, not an error', () => {
        expect(listPending(path.join(root, 'nope'))).toEqual([]);
    });

    it('a malformed record is skipped rather than crashing the enumeration', () => {
        stageAction(root, input, { token: 'good' });
        fs.writeFileSync(path.join(pendingDir(root), 'bad.json'), '{ not json', 'utf-8');
        expect(listPending(root).map((r) => r.token)).toEqual(['good']);
    });
});
