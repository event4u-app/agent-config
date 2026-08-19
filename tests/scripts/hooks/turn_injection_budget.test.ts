// Tests for the per-turn injection aggregate — road-to-standing-context-40k 4.1.
//
// Two halves, and the second is the step's own `verify:` clause:
//   - `applyTurnCap` is pure, so the drop policy is asserted directly: order,
//     the blocking/fail_closed exemption (roadmap Risk 5), and the
//     undroppable-overflow case.
//   - `_apply_turn_injection_cap` is the dispatcher seam: a fixture that
//     exceeds the cap must drop the RIGHT advisory and RECORD the drop in
//     dispatch-issues.jsonl.
//
// Assertions derive their expected values from the inputs (message sizes, the
// cap read from the shipped config) rather than hardcoding a byte count a
// prose edit would falsify.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    applyTurnCap,
    messageBytes,
    readTurnBudget,
    readTurnState,
    writeTurnState,
    slotCounts,
    STATE_REL,
    type CandidateMessage,
} from '../../../src/scripts/hooks/turn_injection_budget.js';
import { _apply_turn_injection_cap } from '../../../src/scripts/hooks/dispatch_hook.js';
import { read_dispatch_issues } from '../../../src/scripts/hooks/dispatch_issues.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'hook-token-budget.json');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'turn-injection-'));
    delete process.env['AGENT_CONFIG_REPLAY'];
});
afterEach(() => {
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(tmp, { recursive: true, force: true });
});

function advisory(concern: string, bytes: number): CandidateMessage {
    return { concern, text: 'x'.repeat(bytes), advisory: true, failClosed: false };
}
function blocking(concern: string, bytes: number): CandidateMessage {
    return { concern, text: 'y'.repeat(bytes), advisory: false, failClosed: false };
}
function failClosed(concern: string, bytes: number): CandidateMessage {
    return { concern, text: 'z'.repeat(bytes), advisory: true, failClosed: true };
}

describe('applyTurnCap — the drop policy', () => {
    it('drops nothing while the aggregate fits', () => {
        const msgs = [advisory('a', 100), advisory('b', 100)];
        const cap = messageBytes(msgs[0]!.text) + messageBytes(msgs[1]!.text) + 1;
        const v = applyTurnCap(msgs, 0, cap);
        expect(v.dropped).toEqual([]);
        expect(v.kept).toHaveLength(2);
        expect(v.keptIndices).toEqual([0, 1]);
        expect(v.overCapAfterDrops).toBe(false);
    });

    it('counts bytes already spent earlier in the same turn', () => {
        const msgs = [advisory('a', 100)];
        const size = messageBytes(msgs[0]!.text);
        // Fits on its own, does not fit on top of what the turn already spent.
        expect(applyTurnCap(msgs, 0, size).dropped).toEqual([]);
        expect(applyTurnCap(msgs, size, size).dropped).toHaveLength(1);
    });

    it('drops the LARGEST advisory first, and only as many as needed', () => {
        const small = advisory('small', 50);
        const big = advisory('big', 400);
        const mid = advisory('mid', 100);
        const msgs = [small, big, mid];
        // Room for everything except `big`.
        const cap = messageBytes(small.text) + messageBytes(mid.text);
        const v = applyTurnCap(msgs, 0, cap);
        expect(v.dropped.map((d) => d.concern)).toEqual(['big']);
        expect(v.kept.map((k) => k.concern)).toEqual(['small', 'mid']);
        expect(v.keptIndices).toEqual([0, 2]);
        expect(v.keptBytes).toBe(cap);
    });

    it('keeps surviving messages in their original order', () => {
        const msgs = [advisory('first', 30), advisory('huge', 500), advisory('third', 30)];
        const v = applyTurnCap(msgs, 0, 100);
        expect(v.kept.map((k) => k.concern)).toEqual(['first', 'third']);
    });

    it('NEVER drops a blocking concern, even when that leaves the turn over cap', () => {
        const msgs = [blocking('block-no-verify', 400), advisory('nudge', 400)];
        const v = applyTurnCap(msgs, 0, 100);
        expect(v.dropped.map((d) => d.concern)).toEqual(['nudge']);
        expect(v.kept.map((k) => k.concern)).toEqual(['block-no-verify']);
        expect(v.overCapAfterDrops).toBe(true);
    });

    it('NEVER drops a fail_closed concern', () => {
        const msgs = [failClosed('guard', 400), advisory('nudge', 50)];
        const v = applyTurnCap(msgs, 0, 60);
        expect(v.dropped.map((d) => d.concern)).toEqual(['nudge']);
        expect(v.kept.map((k) => k.concern)).toEqual(['guard']);
        expect(v.overCapAfterDrops).toBe(true);
    });

    it('reports the dropped byte count per drop', () => {
        const big = advisory('big', 400);
        const v = applyTurnCap([big], 0, 10);
        expect(v.dropped).toEqual([{ concern: 'big', bytes: messageBytes(big.text) }]);
    });

    it('measures UTF-8 bytes, not characters', () => {
        const multibyte: CandidateMessage = {
            concern: 'de',
            text: 'Änderungen über Grenzen',
            advisory: true,
            failClosed: false,
        };
        expect(messageBytes(multibyte.text)).toBeGreaterThan(multibyte.text.length);
        const v = applyTurnCap([multibyte], 0, multibyte.text.length);
        expect(v.dropped).toHaveLength(1);
    });
});

describe('readTurnBudget — the shipped row', () => {
    it('reads a positive cap and the exempt slots from the real config', () => {
        const budget = readTurnBudget(BUDGET_PATH);
        expect(budget).not.toBeNull();
        expect(budget!.capBytes).toBeGreaterThan(0);
        // session_start carries the one-shot restore payloads the step exempts.
        expect(budget!.exemptSlots.has('session_start')).toBe(true);
        expect(slotCounts('user_prompt_submit', budget!)).toBe(true);
        expect(slotCounts('session_start', budget!)).toBe(false);
    });

    it('returns null — i.e. no cap applied — for an absent or unusable row', () => {
        const noRow = path.join(tmp, 'no-row.json');
        fs.writeFileSync(noRow, JSON.stringify({ default_cap_bytes: 1024 }));
        expect(readTurnBudget(noRow)).toBeNull();

        const zeroCap = path.join(tmp, 'zero.json');
        fs.writeFileSync(zeroCap, JSON.stringify({ per_turn_aggregate_cap_bytes: { cap_bytes: 0 } }));
        expect(readTurnBudget(zeroCap)).toBeNull();

        expect(readTurnBudget(path.join(tmp, 'missing.json'))).toBeNull();
    });
});

describe('turn state — counts only, per session', () => {
    it('round-trips through the state file', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 3, spent_bytes: 900, dropped: 2 });
        const back = readTurnState(tmp, 's1');
        expect(back.turn).toBe(3);
        expect(back.spent_bytes).toBe(900);
        expect(back.dropped).toBe(2);
    });

    it('ignores a record belonging to a different session', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 3, spent_bytes: 900, dropped: 2 });
        expect(readTurnState(tmp, 's2').spent_bytes).toBe(0);
    });

    it('zeroes on a corrupt or absent record rather than throwing', () => {
        expect(readTurnState(tmp, 's1').spent_bytes).toBe(0);
        const target = path.join(tmp, STATE_REL);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'not json');
        expect(readTurnState(tmp, 's1').spent_bytes).toBe(0);
    });

    it('carries no field capable of holding content', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 1, spent_bytes: 10, dropped: 0 });
        const doc = JSON.parse(fs.readFileSync(path.join(tmp, STATE_REL), 'utf-8')) as Record<string, unknown>;
        expect(Object.keys(doc).sort()).toEqual(['dropped', 'schema_version', 'session_id', 'spent_bytes', 'turn']);
    });
});

describe('_apply_turn_injection_cap — the dispatcher seam', () => {
    const envelope = { workspace_root: '' } as Record<string, unknown>;
    const cap = (): number => readTurnBudget(BUDGET_PATH)!.capBytes;

    function msg(concern: string, bytes: number, opts: { advisory?: boolean; fail_closed?: boolean } = {}) {
        return {
            concern,
            text: 'x'.repeat(bytes),
            advisory: opts.advisory ?? true,
            fail_closed: opts.fail_closed ?? false,
        };
    }

    it('passes everything through under the cap and opens a turn', () => {
        const env = { ...envelope, workspace_root: tmp };
        const msgs = [msg('nudge', 100)];
        const out = _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', msgs);
        expect(out).toHaveLength(1);
        const state = readTurnState(tmp, 'sess');
        expect(state.turn).toBe(1);
        expect(state.spent_bytes).toBe(messageBytes(msgs[0]!.text));
    });

    it('a fixture over the cap drops the right advisory AND records it', () => {
        const env = { ...envelope, workspace_root: tmp };
        const msgs = [
            msg('block-no-verify', 200, { advisory: false }),
            msg('big-nudge', cap() + 1),
            msg('small-nudge', 50),
        ];
        const out = _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', msgs);

        expect(out.map((m) => m.concern)).toEqual(['block-no-verify', 'small-nudge']);

        const issues = read_dispatch_issues(tmp);
        const budgetIssues = issues.filter((e) => e['issue'] === 'budget_exceeded');
        expect(budgetIssues.map((e) => e['hook'])).toContain('big-nudge');
        expect(readTurnState(tmp, 'sess').dropped).toBe(1);
    });

    it('records the undroppable-overflow case instead of swallowing a block', () => {
        const env = { ...envelope, workspace_root: tmp };
        const msgs = [msg('block-no-verify', cap() + 1, { advisory: false })];
        const out = _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', msgs);
        expect(out).toHaveLength(1); // the block survives, over cap
        const issues = read_dispatch_issues(tmp).filter((e) => e['issue'] === 'budget_exceeded');
        expect(issues.map((e) => e['hook'])).toContain('dispatch');
    });

    it('accumulates across slots within one turn, and resets on the next prompt', () => {
        const env = { ...envelope, workspace_root: tmp };
        const half = Math.floor(cap() / 2) + 10;
        _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', [msg('a', half)]);
        // Same turn, a later slot: the two together exceed the cap, so this drops.
        const out = _apply_turn_injection_cap(env, 'sess', 'post_tool_use', [msg('b', half)]);
        expect(out).toHaveLength(0);
        // A new prompt opens a fresh turn — the same message now fits.
        const fresh = _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', [msg('c', half)]);
        expect(fresh).toHaveLength(1);
        expect(readTurnState(tmp, 'sess').turn).toBe(2);
    });

    it('leaves an exempt slot untouched and unaccounted', () => {
        const env = { ...envelope, workspace_root: tmp };
        const msgs = [msg('restore', cap() + 1)];
        const out = _apply_turn_injection_cap(env, 'sess', 'session_start', msgs);
        expect(out).toHaveLength(1);
        expect(readTurnState(tmp, 'sess').spent_bytes).toBe(0);
    });

    it('writes no state in replay mode', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        const env = { ...envelope, workspace_root: tmp };
        _apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', [msg('a', 100)]);
        expect(fs.existsSync(path.join(tmp, STATE_REL))).toBe(false);
    });

    it('is a no-op on an empty message list', () => {
        const env = { ...envelope, workspace_root: tmp };
        expect(_apply_turn_injection_cap(env, 'sess', 'user_prompt_submit', [])).toEqual([]);
    });
});
