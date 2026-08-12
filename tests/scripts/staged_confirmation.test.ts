/**
 * Tests for the staged-confirmation primitive (dispatch-safety Phase 2).
 *
 * Three properties, and the negative cases are the load-bearing half:
 *
 *   1. **Exactly-once.** A second confirmation of the same stage must NOT
 *      authorize the action. A happy-path test cannot see this — it needs the
 *      second call, and it needs a concurrent claim over the real filesystem,
 *      because the guarantee lives in a rename and not in a field.
 *   2. **Expiry.** An abandoned stage must stop authorizing anything, without
 *      depending on a sweep having run first.
 *   3. **The declaration validates.** `requires_confirmation` is optional and
 *      additive on both schemas, and a non-boolean is rejected — a flag that
 *      accepted `"yes"` would read as set while being unreadable.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    confirmOnce,
    confirmationSurface,
    declineStage,
    deriveToken,
    isExpired,
    nonInteractiveDecision,
    stageAction,
    stageStatus,
    STAGE_TTL_MS,
} from '../../src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation.js';
import {
    claimConfirmation,
    declineConfirmation,
    isSafeToken,
    listPending,
    pruneExpired,
    putPending,
    readPending,
    readResolved,
} from '../../src/agent-src/templates/scripts/work_engine/hooks/builtin/staged_confirmation_store.js';
import {
    apply_schema_defaults,
    load_schema,
    validate,
    type YamlValue,
} from '../../src/scripts/validate_frontmatter.js';

const T0 = Date.parse('2026-08-11T12:00:00Z');

function stage(overrides: { object?: string; nonce?: string; now?: number; ttlMs?: number } = {}) {
    return stageAction({
        action: 'agent-config release:publish',
        object: overrides.object ?? 'npm publish @event4u/agent-config@9.9.9',
        source: 'test',
        nonce: overrides.nonce ?? 'n1',
        now: overrides.now ?? T0,
        ...(overrides.ttlMs === undefined ? {} : { ttlMs: overrides.ttlMs }),
    });
}

describe('deriveToken — identity is derived, never carried over', () => {
    it('is stable for the same action, object and nonce', () => {
        expect(deriveToken('a', 'b', 'n')).toBe(deriveToken('a', 'b', 'n'));
    });

    it('separates two stages of the SAME object under different nonces', () => {
        // The failure this prevents: approving a delete of `x` once yields a
        // token that would otherwise match every future delete of `x`.
        expect(deriveToken('rm', 'x', 'n1')).not.toBe(deriveToken('rm', 'x', 'n2'));
    });

    it('separates two objects under the same nonce', () => {
        expect(deriveToken('rm', 'x', 'n')).not.toBe(deriveToken('rm', 'y', 'n'));
    });

    it('separates two actions on the same object', () => {
        expect(deriveToken('rm', 'x', 'n')).not.toBe(deriveToken('mv', 'x', 'n'));
    });
});

describe('confirmOnce — the pure decision', () => {
    it('authorizes the first matching confirmation', () => {
        const s = stage();
        const r = confirmOnce(s, s.token, T0 + 1000);
        expect(r.outcome).toBe('execute');
        expect(r.stage.state).toBe('confirmed');
        expect(r.stage.resolved_at).toBe('2026-08-11T12:00:01Z');
    });

    it('refuses the SECOND confirmation of the same stage', () => {
        const s = stage();
        const first = confirmOnce(s, s.token, T0 + 1000);
        const second = confirmOnce(first.stage, s.token, T0 + 2000);
        expect(second.outcome).toBe('already-confirmed');
        // The record is not re-stamped: the resolution time is when it was
        // actually resolved, not when someone last tried.
        expect(second.stage.resolved_at).toBe('2026-08-11T12:00:01Z');
    });

    it('reports a wrong token as a mismatch rather than a silent no-op', () => {
        const s = stage();
        expect(confirmOnce(s, 'deadbeefdeadbeef', T0 + 1).outcome).toBe('token-mismatch');
    });

    it('refuses a confirmation after the stage expired', () => {
        const s = stage();
        expect(confirmOnce(s, s.token, T0 + STAGE_TTL_MS + 1).outcome).toBe('expired');
    });

    it('refuses a confirmation on a declined stage', () => {
        const s = stage();
        const d = declineStage(s, s.token, T0 + 10);
        expect(d.declined).toBe(true);
        expect(confirmOnce(d.stage, s.token, T0 + 20).outcome).toBe('declined');
    });

    it('does not decline twice', () => {
        const s = stage();
        const first = declineStage(s, s.token, T0 + 10);
        expect(declineStage(first.stage, s.token, T0 + 20).declined).toBe(false);
    });
});

describe('stageStatus — expiry is derived, not swept', () => {
    it('reads a fresh stage as pending', () => {
        expect(stageStatus(stage(), T0 + 1)).toBe('pending');
    });

    it('reads an abandoned stage as expired with no sweep having run', () => {
        const s = stage();
        expect(isExpired(s, T0 + STAGE_TTL_MS + 1)).toBe(true);
        expect(stageStatus(s, T0 + STAGE_TTL_MS + 1)).toBe('expired');
    });

    it('treats the expiry instant itself as expired', () => {
        // Boundary: `<=` not `<`, so a stage never authorizes at the exact
        // moment it is supposed to stop counting.
        expect(isExpired(stage(), T0 + STAGE_TTL_MS)).toBe(true);
    });

    it('honours a caller-supplied shorter window', () => {
        const s = stage({ ttlMs: 1000 });
        expect(isExpired(s, T0 + 1001)).toBe(true);
    });

    it('leaves a confirmed stage confirmed after its window passes', () => {
        const s = confirmOnce(stage(), stage().token, T0 + 1).stage;
        expect(stageStatus(s, T0 + STAGE_TTL_MS + 5000)).toBe('confirmed');
    });
});

describe('nonInteractiveDecision — neither fallback approves', () => {
    it('refuses under stop', () => {
        expect(nonInteractiveDecision('stop')).toEqual({ execute: false, surface: 'halt' });
    });

    it('refuses under warn too — only the loudness differs', () => {
        expect(nonInteractiveDecision('warn')).toEqual({ execute: false, surface: 'warn' });
    });
});

describe('confirmationSurface', () => {
    it('names the exact object and the token', () => {
        const s = stage();
        const out = confirmationSurface(s).join('\n');
        expect(out).toContain('npm publish @event4u/agent-config@9.9.9');
        expect(out).toContain(s.token);
    });

    it('does NOT invent a confirming command when no channel is wired', () => {
        // The regression this pins: printing `agent-config gates --confirm <t>`
        // while no such flag exists would ship a false instruction. Which
        // channel confirms is what blocker confirmation-degraded-host-semantics
        // has not decided.
        const out = confirmationSurface(stage()).join('\n');
        expect(out).not.toContain('--confirm');
        expect(out).not.toContain('--decline');
        expect(out).toContain('gates --pending');
    });

    it('uses the caller channel when one is supplied', () => {
        const out = confirmationSurface(stage(), {
            confirmWith: 'reply "ship it"',
            declineWith: 'reply "no"',
        }).join('\n');
        expect(out).toContain('reply "ship it"');
        expect(out).toContain('reply "no"');
    });
});

describe('the store — where exactly-once actually holds', () => {
    let root: string;

    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'stagedconf-')));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('lists a staged action as pending', () => {
        const s = stage();
        putPending(root, s);
        const rows = listPending(root, T0 + 1);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('pending');
        expect(rows[0]?.stage.token).toBe(s.token);
    });

    it('claims once and refuses the second claim of the same token', () => {
        const s = stage();
        putPending(root, s);
        expect(claimConfirmation(root, s.token, T0 + 1).outcome).toBe('execute');
        // Second call — the rename already moved the pending file, so this
        // caller learns the stage is taken instead of authorizing again.
        expect(claimConfirmation(root, s.token, T0 + 2).outcome).toBe('already-confirmed');
    });

    it('persists the confirmed record where a reader can find it', () => {
        const s = stage();
        putPending(root, s);
        claimConfirmation(root, s.token, T0 + 1);
        expect(readResolved(root, s.token)?.state).toBe('confirmed');
        expect(listPending(root, T0 + 2)).toEqual([]);
    });

    it('reports an unknown token as a mismatch', () => {
        expect(claimConfirmation(root, 'nope', T0).outcome).toBe('token-mismatch');
    });

    it('does NOT consume a stage on a wrong-token attempt', () => {
        const s = stage();
        putPending(root, s);
        claimConfirmation(root, deriveToken('other', 'thing', 'z'), T0 + 1);
        // The real token still works: a stale surface must not burn a stage a
        // human may still legitimately confirm.
        expect(claimConfirmation(root, s.token, T0 + 2).outcome).toBe('execute');
    });

    it('refuses an expired stage and leaves it unclaimed', () => {
        const s = stage();
        putPending(root, s);
        expect(claimConfirmation(root, s.token, T0 + STAGE_TTL_MS + 1).outcome).toBe('expired');
        expect(readResolved(root, s.token)).toBeNull();
    });

    it('still reports expired AFTER a prune moved the record aside', () => {
        // The bug this pins: `pruneExpired` moves the file without rewriting
        // `state`, so a status read off the field would answer
        // "already-confirmed" for a stage that never fired.
        const s = stage();
        putPending(root, s);
        expect(pruneExpired(root, T0 + STAGE_TTL_MS + 1)).toBe(1);
        expect(claimConfirmation(root, s.token, T0 + STAGE_TTL_MS + 2).outcome).toBe('expired');
    });

    it('declines a pending stage, and a later confirmation does not fire it', () => {
        const s = stage();
        putPending(root, s);
        expect(declineConfirmation(root, s.token, T0 + 1).declined).toBe(true);
        expect(claimConfirmation(root, s.token, T0 + 2).outcome).toBe('declined');
    });

    it('keeps two stages of the same object independent', () => {
        const a = stage({ nonce: 'n1' });
        const b = stage({ nonce: 'n2' });
        putPending(root, a);
        putPending(root, b);
        expect(claimConfirmation(root, a.token, T0 + 1).outcome).toBe('execute');
        // Approving one did not approve the other.
        expect(listPending(root, T0 + 2).map((r) => r.stage.token)).toEqual([b.token]);
    });

    it('survives a malformed file in the store', () => {
        putPending(root, stage());
        fs.writeFileSync(
            path.join(root, 'agents', 'runtime', 'staged-confirmations', 'pending', 'junk.json'),
            '{ not json',
            'utf-8',
        );
        expect(listPending(root, T0 + 1)).toHaveLength(1);
    });

    it('returns an empty list when nothing was ever staged', () => {
        expect(listPending(root, T0)).toEqual([]);
        expect(pruneExpired(root, T0)).toBe(0);
    });
});

describe('requires_confirmation — the declaration validates', () => {
    function errorsFor(kind: 'skill' | 'command', data: Record<string, YamlValue>): string[] {
        const schema = load_schema(kind);
        apply_schema_defaults(data, schema);
        return validate(data, schema).map((e) => `${e.path}: ${e.message}`);
    }

    function skillDoc(execution: Record<string, YamlValue>): Record<string, YamlValue> {
        return {
            name: 'demo-skill',
            description: 'A demo skill used to validate the confirmation flag.',
            domain: 'engineering',
            execution,
        } as Record<string, YamlValue>;
    }

    function commandDoc(extra: Record<string, YamlValue>): Record<string, YamlValue> {
        return {
            name: 'demo-command',
            description: 'A demo command used to validate the confirmation flag.',
            'disable-model-invocation': true,
            ...extra,
        } as Record<string, YamlValue>;
    }

    it('accepts the flag on a skill execution block', () => {
        expect(errorsFor('skill', skillDoc({ type: 'manual', requires_confirmation: true }))).toEqual(
            [],
        );
    });

    it('accepts false explicitly — declaring a non-staging action is legal', () => {
        expect(
            errorsFor('skill', skillDoc({ type: 'manual', requires_confirmation: false })),
        ).toEqual([]);
    });

    it('stays optional — omitting it is still valid', () => {
        expect(errorsFor('skill', skillDoc({ type: 'manual' }))).toEqual([]);
    });

    it('rejects a non-boolean on a skill', () => {
        const errs = errorsFor('skill', skillDoc({ type: 'manual', requires_confirmation: 'yes' }));
        expect(errs.join(' ')).toContain('requires_confirmation');
    });

    it('accepts the flag top-level on a command', () => {
        expect(errorsFor('command', commandDoc({ requires_confirmation: true }))).toEqual([]);
    });

    it('rejects a non-boolean on a command', () => {
        const errs = errorsFor('command', commandDoc({ requires_confirmation: 1 }));
        expect(errs.join(' ')).toContain('requires_confirmation');
    });
});

/**
 * Two findings from an R2 completion review of the parallel implementation that
 * PR #1280 withdrew — both reproduced against THIS store. Kept as specs rather
 * than prose because neither shape is reachable from the happy path: one needs a
 * file the writer never writes, the other a token the minter never mints.
 */
describe('the store — malformed records and hostile tokens', () => {
    let root: string;

    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'stagedconf-hard-')));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('a record without staged_at is skipped, never sorted on', () => {
        // The guard checked four of five fields while asserting the full type, so
        // this record passed and `listPending` sorted on an undefined — a
        // TypeError thrown through `roadmap_gates.renderPending`, i.e. one bad
        // file on disk taking out a shipped gate. TWO records are required: with
        // one row the comparator never runs.
        putPending(root, stage());
        const partial = path.join(
            root,
            'agents',
            'runtime',
            'staged-confirmations',
            'pending',
            'partial.json',
        );
        fs.writeFileSync(
            partial,
            JSON.stringify({
                token: 'deadbeefdeadbeef',
                action: 'agent-config release:publish',
                object: 'npm publish',
                expires_at: new Date(T0 + STAGE_TTL_MS).toISOString(),
            }),
            'utf-8',
        );
        expect(() => listPending(root, T0 + 1)).not.toThrow();
        expect(listPending(root, T0 + 1)).toHaveLength(1);
    });

    it('a traversing token reads nothing, claims nothing, declines nothing', () => {
        // `path.join(pendingDir, '../x.json')` resolves into the store root, so a
        // caller-supplied token escaped `pending/`. `deriveToken` returns a
        // 16-char sha256 prefix, so no staged token can carry this shape.
        //
        // The planted record must carry `token: '../outside'` — its FIELD, not
        // just the argument. An earlier version planted a record with the real
        // derived token, and then `confirmOnce`'s own token comparison returned
        // `token-mismatch` whether or not the guard existed: the spec passed for
        // a reason it was not testing. The existence assertion was worse than
        // weak, it was unfalsifiable — `pending/` and `resolved/` are siblings,
        // so both `../outside.json` joins resolve to the same path and the
        // rename could never move the file anywhere.
        const outside = path.join(root, 'agents', 'runtime', 'staged-confirmations', 'outside.json');
        fs.mkdirSync(path.dirname(outside), { recursive: true });
        const planted = { ...stage(), token: '../outside' };
        fs.writeFileSync(outside, JSON.stringify(planted), 'utf-8');
        const before = fs.readFileSync(outside, 'utf-8');

        expect(readPending(root, '../outside')).toBeNull();
        // Without the guard this reads the planted record, matches its own token
        // and returns `execute` — the outcome, not the file's presence, is what
        // discriminates.
        expect(claimConfirmation(root, '../outside', T0 + 1).outcome).toBe('token-mismatch');
        expect(declineConfirmation(root, '../outside', T0 + 1).declined).toBe(false);
        // `writeStageFile` would have rewritten it in place on a successful claim.
        expect(fs.readFileSync(outside, 'utf-8')).toBe(before);
    });

    it('putPending refuses a hand-built record whose token would escape the store', () => {
        // Verified before the guard: this wrote a JSON file outside the store
        // root, creating directories on the way.
        const evil = { ...stage(), token: '../../../../tmp/escaped' };
        expect(() => putPending(root, evil)).toThrow(/unsafe token/);
    });

    it('pruneExpired moves the file it enumerated, not a path rebuilt from the token', () => {
        // A filename and its token disagree for any record something other than
        // putPending wrote. The rebuilt path then hit ENOENT, the bare catch
        // swallowed it, and the expired stage stayed in pending/ forever while
        // the returned count under-reported it.
        const expired = { ...stage({ ttlMs: 1 }), token: 'aaaaaaaaaaaaaaaa' };
        const pending = path.join(root, 'agents', 'runtime', 'staged-confirmations', 'pending');
        fs.mkdirSync(pending, { recursive: true });
        fs.writeFileSync(path.join(pending, 'filename-differs.json'), JSON.stringify(expired), 'utf-8');

        expect(pruneExpired(root, T0 + STAGE_TTL_MS + 1)).toBe(1);
        expect(fs.existsSync(path.join(pending, 'filename-differs.json'))).toBe(false);
    });

    it('a real token still round-trips through every verb', () => {
        // The guard must not be tighter than what `deriveToken` mints.
        const s = stage();
        expect(isSafeToken(s.token)).toBe(true);
        putPending(root, s);
        expect(readPending(root, s.token)?.token).toBe(s.token);
        expect(claimConfirmation(root, s.token, T0 + 1).outcome).toBe('execute');
    });
});
