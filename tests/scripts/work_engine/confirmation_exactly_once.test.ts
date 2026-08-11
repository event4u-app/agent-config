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
        // Two DISTINCT holds — staging the same hold twice now returns the same
        // token by design (R2 finding 5), so varying `object` is what makes this
        // an ordering assertion rather than an idempotency one.
        stageAction(root, { ...input, object: 'later' }, { token: 'b', now: '2026-08-11T02:00:00.000Z' });
        stageAction(root, { ...input, object: 'earlier' }, { token: 'a', now: '2026-08-11T01:00:00.000Z' });
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

    // R2 finding 1. The version above passed while the guard checked four of
    // six fields, so a record that is valid JSON but structurally partial slipped
    // through and crashed the localeCompare sort. Unparseable JSON was the case
    // the guard already handled — the assertion read as robustness the code did
    // not have, which is why the partial-record shape gets its own spec.
    it('a structurally-partial record is skipped too, with two records present', () => {
        stageAction(root, input, { token: 'good1', now: '2026-08-11T01:00:00.000Z' });
        stageAction(root, { ...input, object: 'other' }, { token: 'good2', now: '2026-08-11T02:00:00.000Z' });
        fs.writeFileSync(
            path.join(pendingDir(root), 'partial.json'),
            JSON.stringify({ token: 'partial', gate_id: 'g', action: 'a', object: 'o' }),
            'utf-8',
        );
        expect(() => listPending(root)).not.toThrow();
        expect(listPending(root).map((r) => r.token)).toEqual(['good1', 'good2']);
    });
});

// R2 findings 2, 3, 4, 7 — the failure modes the first version shipped.
describe('confirmation store — hostile and damaged input', () => {
    it('refuses to stage under a traversing token', () => {
        // The record used to land at agents/runtime/escaped.json, outside the store.
        expect(() => stageAction(root, input, { token: '../../escaped' })).toThrow(/unsafe token/);
        expect(fs.existsSync(path.join(root, 'agents', 'runtime', 'escaped.json'))).toBe(false);
    });

    it('a traversing token confirms as unknown rather than renaming an arbitrary file', () => {
        // confirmAction is the only destructive verb and its input is a string a
        // human retyped from a prompt.
        expect(confirmAction(root, '../../escaped')).toEqual({ status: 'unknown', record: null });
    });

    it('re-staging the same hold returns the same token instead of a second one', () => {
        const first = stageAction(root, input);
        const second = stageAction(root, input);
        expect(second.token).toBe(first.token);
        expect(listPending(root)).toHaveLength(1);
    });

    it('re-using a token for a DIFFERENT hold refuses rather than overwriting', () => {
        stageAction(root, input, { token: 'dup' });
        expect(() => stageAction(root, { ...input, object: 'something-else' }, { token: 'dup' })).toThrow(
            /already staged/,
        );
    });

    it('an unreadable pending record is refused, not consumed as executed', () => {
        // Returning `executed` here would instruct execution of an action whose
        // object cannot be named — what non-destructive-by-default forbids.
        fs.mkdirSync(pendingDir(root), { recursive: true });
        fs.writeFileSync(path.join(pendingDir(root), 'broken.json'), '{ not json', 'utf-8');
        expect(confirmAction(root, 'broken')).toEqual({ status: 'unreadable', record: null });
        expect(fs.existsSync(path.join(pendingDir(root), 'broken.json'))).toBe(true);
    });

    it('a broken store throws instead of reporting a correct token as unknown', () => {
        stageAction(root, input, { token: 'blocked' });
        const target = path.join(consumedDir(root), 'blocked.json');
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, 'occupant'), 'x', 'utf-8');
        expect(() => confirmAction(root, 'blocked')).toThrow();
        // The action stays held rather than being silently declared a typo.
        expect(fs.existsSync(path.join(pendingDir(root), 'blocked.json'))).toBe(true);
    });
});
