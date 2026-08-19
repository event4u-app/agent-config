// Tests for the per-turn injection aggregate — road-to-standing-context-40k 4.1.
//
// Three halves. The second is the step's own `verify:` clause; the third pins
// the four preconditions, two of which were live defects the R2 review caught
// and which the first version of this suite could not see:
//
//   - `applyTurnCap` is pure, so the drop policy is asserted directly: order,
//     the blocking/fail_closed exemption (roadmap Risk 5), and the
//     undroppable-overflow case.
//   - `applyTurnInjectionCap` is the dispatcher seam: a fixture that
//     exceeds the cap must drop the RIGHT message and RECORD the drop in
//     dispatch-issues.jsonl.
//   - the preconditions: no turn boundary → no accounting; an emission that
//     carries nothing → no accounting; an unstable session id → no accounting;
//     and an empty message list still MOVES the boundary.
//
// The empty-list case earned its own regression test the hard way: the first
// version asserted the early return as intended behaviour, which is exactly why
// the suite stayed green over a reset that never happened on the common path.
//
// Assertions derive their expected values from the inputs (message sizes, the
// cap read from the shipped config) rather than hardcoding a byte count a prose
// edit would falsify.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    applyTurnCap,
    isStableSessionId,
    messageBytes,
    readTurnBudget,
    readTurnState,
    writeTurnState,
    slotCounts,
    statePath,
    applyTurnInjectionCap,
    isDroppableConcern,
    _clearTurnBudgetCache,
    type CandidateMessage,
} from '../../../src/scripts/hooks/turn_injection_budget.js';
import { emissionCarriesReasons } from '../../../src/scripts/hooks/host_semantics.js';
import { read_dispatch_issues } from '../../../src/scripts/hooks/dispatch_issues.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'src', 'config', 'hook-token-budget.json');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'turn-injection-'));
    delete process.env['AGENT_CONFIG_REPLAY'];
    _clearTurnBudgetCache();
});
afterEach(() => {
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(tmp, { recursive: true, force: true });
    _clearTurnBudgetCache();
});

function droppable(concern: string, bytes: number): CandidateMessage {
    return { concern, text: 'x'.repeat(bytes), droppable: true };
}
function undroppable(concern: string, bytes: number): CandidateMessage {
    return { concern, text: 'y'.repeat(bytes), droppable: false };
}

describe('applyTurnCap — the drop policy', () => {
    it('drops nothing while the aggregate fits', () => {
        const msgs = [droppable('a', 100), droppable('b', 100)];
        const cap = messageBytes(msgs[0]!.text) + messageBytes(msgs[1]!.text) + 1;
        const v = applyTurnCap(msgs, 0, cap);
        expect(v.dropped).toEqual([]);
        expect(v.kept).toHaveLength(2);
        expect(v.keptIndices).toEqual([0, 1]);
        expect(v.overCapAfterDrops).toBe(false);
    });

    it('counts bytes already spent earlier in the same turn', () => {
        const msgs = [droppable('a', 100)];
        const size = messageBytes(msgs[0]!.text);
        expect(applyTurnCap(msgs, 0, size).dropped).toEqual([]);
        expect(applyTurnCap(msgs, size, size).dropped).toHaveLength(1);
    });

    it('drops the LARGEST first, and only as many as needed', () => {
        const small = droppable('small', 50);
        const big = droppable('big', 400);
        const mid = droppable('mid', 100);
        const cap = messageBytes(small.text) + messageBytes(mid.text);
        const v = applyTurnCap([small, big, mid], 0, cap);
        expect(v.dropped.map((d) => d.concern)).toEqual(['big']);
        expect(v.kept.map((k) => k.concern)).toEqual(['small', 'mid']);
        expect(v.keptIndices).toEqual([0, 2]);
        expect(v.keptBytes).toBe(cap);
    });

    it('keeps surviving messages in their original order', () => {
        const msgs = [droppable('first', 30), droppable('huge', 500), droppable('third', 30)];
        expect(applyTurnCap(msgs, 0, 100).kept.map((k) => k.concern)).toEqual(['first', 'third']);
    });

    it('NEVER drops an undroppable message, even when that leaves the turn over cap', () => {
        const msgs = [undroppable('block-no-verify', 400), droppable('nudge', 400)];
        const v = applyTurnCap(msgs, 0, 100);
        expect(v.dropped.map((d) => d.concern)).toEqual(['nudge']);
        expect(v.kept.map((k) => k.concern)).toEqual(['block-no-verify']);
        expect(v.overCapAfterDrops).toBe(true);
    });

    it('reports the dropped byte count per drop', () => {
        const big = droppable('big', 400);
        expect(applyTurnCap([big], 0, 10).dropped).toEqual([
            { concern: 'big', bytes: messageBytes(big.text) },
        ]);
    });

    it('measures UTF-8 bytes, not characters', () => {
        const multibyte: CandidateMessage = {
            concern: 'de',
            text: 'Änderungen über Grenzen',
            droppable: true,
        };
        expect(messageBytes(multibyte.text)).toBeGreaterThan(multibyte.text.length);
        expect(applyTurnCap([multibyte], 0, multibyte.text.length).dropped).toHaveLength(1);
    });

    it('is a no-op on an empty candidate list', () => {
        const v = applyTurnCap([], 0, 10);
        expect(v.kept).toEqual([]);
        expect(v.dropped).toEqual([]);
        expect(v.keptBytes).toBe(0);
    });
});

describe('isDroppableConcern — stated negatively on purpose', () => {
    it('drops advisory, keeps blocking, keeps fail_closed', () => {
        expect(isDroppableConcern({ severity: 'advisory' })).toBe(true);
        expect(isDroppableConcern({ severity: 'blocking' })).toBe(false);
        expect(isDroppableConcern({ severity: 'advisory', fail_closed: true })).toBe(false);
    });

    it('keeps a FUTURE severity tier droppable rather than exempt', () => {
        // The finding this guards: an `advisory`-positive test would make a
        // `warn` rung silently undroppable, i.e. grant it a budget exemption
        // nobody decided to give it.
        expect(isDroppableConcern({ severity: 'warn' })).toBe(true);
        expect(isDroppableConcern({})).toBe(true);
    });
});

describe('readTurnBudget — the shipped row', () => {
    it('reads a positive cap and the exempt slots from the real config', () => {
        const budget = readTurnBudget(BUDGET_PATH);
        expect(budget).not.toBeNull();
        expect(budget!.capBytes).toBeGreaterThan(0);
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

    it('caches per path, and the test seam clears it', () => {
        const p = path.join(tmp, 'row.json');
        fs.writeFileSync(p, JSON.stringify({ per_turn_aggregate_cap_bytes: { cap_bytes: 111 } }));
        expect(readTurnBudget(p)!.capBytes).toBe(111);
        fs.writeFileSync(p, JSON.stringify({ per_turn_aggregate_cap_bytes: { cap_bytes: 222 } }));
        expect(readTurnBudget(p)!.capBytes).toBe(111); // cached
        _clearTurnBudgetCache();
        expect(readTurnBudget(p)!.capBytes).toBe(222);
    });
});

describe('turn state — counts only, per session', () => {
    it('round-trips through a per-session file', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 3, spent_bytes: 900, dropped: 2 });
        const back = readTurnState(tmp, 's1');
        expect(back.turn).toBe(3);
        expect(back.spent_bytes).toBe(900);
        expect(back.dropped).toBe(2);
        expect(fs.existsSync(statePath(tmp, 's1'))).toBe(true);
    });

    it('isolates concurrent sessions instead of letting them zero each other', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 3, spent_bytes: 900, dropped: 0 });
        writeTurnState(tmp, { schema_version: 1, session_id: 's2', turn: 1, spent_bytes: 10, dropped: 0 });
        expect(readTurnState(tmp, 's1').spent_bytes).toBe(900);
        expect(readTurnState(tmp, 's2').spent_bytes).toBe(10);
        expect(statePath(tmp, 's1')).not.toBe(statePath(tmp, 's2'));
    });

    it('zeroes on a corrupt or absent record rather than throwing', () => {
        expect(readTurnState(tmp, 's1').spent_bytes).toBe(0);
        const target = statePath(tmp, 's1');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'not json');
        expect(readTurnState(tmp, 's1').spent_bytes).toBe(0);
    });

    it('carries no field capable of holding content', () => {
        writeTurnState(tmp, { schema_version: 1, session_id: 's1', turn: 1, spent_bytes: 10, dropped: 0 });
        const doc = JSON.parse(fs.readFileSync(statePath(tmp, 's1'), 'utf-8')) as Record<string, unknown>;
        expect(Object.keys(doc).sort()).toEqual(['dropped', 'schema_version', 'session_id', 'spent_bytes', 'turn']);
    });

    it('sanitises a session id into a single path segment', () => {
        const nasty = '../../etc/passwd';
        expect(path.dirname(statePath(tmp, nasty))).toBe(path.join(tmp, 'agents', 'runtime', 'state', 'turn-injection'));
    });

    it('rejects the dispatcher own per-invocation session id', () => {
        expect(isStableSessionId('dispatch-2026-08-19T00:00:00Z-1234')).toBe(false);
        expect(isStableSessionId('')).toBe(false);
        expect(isStableSessionId('real-host-session-id')).toBe(true);
    });
});

describe('applyTurnInjectionCap — the dispatcher seam', () => {
    const cap = (): number => readTurnBudget(BUDGET_PATH)!.capBytes;
    const ON = { hasTurnBoundary: true, emissionCarriesReasons: true };

    function msg(concern: string, bytes: number, isDroppable = true) {
        return { concern, text: 'x'.repeat(bytes), droppable: isDroppable };
    }

    it('passes everything through under the cap and opens a turn', () => {
        const env = { workspace_root: tmp };
        const msgs = [msg('nudge', 100)];
        expect(applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', msgs, ON)).toHaveLength(1);
        const state = readTurnState(tmp, 'sess');
        expect(state.turn).toBe(1);
        expect(state.spent_bytes).toBe(messageBytes(msgs[0]!.text));
    });

    it('a fixture over the cap drops the right message AND records it', () => {
        const env = { workspace_root: tmp };
        const msgs = [
            msg('block-no-verify', 200, false),
            msg('big-nudge', cap() + 1),
            msg('small-nudge', 50),
        ];
        const out = applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', msgs, ON);
        expect(out.map((m) => m.concern)).toEqual(['block-no-verify', 'small-nudge']);
        const budgetIssues = read_dispatch_issues(tmp).filter((e) => e['issue'] === 'budget_exceeded');
        // One ring entry per fire, naming the dropped concern — see the comment
        // at the log site for why it is not one entry per drop.
        expect(budgetIssues).toHaveLength(1);
        expect(String(budgetIssues[0]!['detail'])).toContain('big-nudge');
        expect(readTurnState(tmp, 'sess').dropped).toBe(1);
    });

    it('records the undroppable-overflow case instead of swallowing a block', () => {
        const env = { workspace_root: tmp };
        const out = applyTurnInjectionCap(
            env,
            'sess',
            'user_prompt_submit',
            [msg('block-no-verify', cap() + 1, false)],
            ON,
        );
        expect(out).toHaveLength(1); // the block survives, over cap
        const issues = read_dispatch_issues(tmp).filter((e) => e['issue'] === 'budget_exceeded');
        expect(issues.map((e) => e['hook'])).toContain('dispatch');
    });

    it('accumulates across slots within one turn, and resets on the next prompt', () => {
        const env = { workspace_root: tmp };
        const half = Math.floor(cap() / 2) + 10;
        applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', [msg('a', half)], ON);
        expect(applyTurnInjectionCap(env, 'sess', 'post_tool_use', [msg('b', half)], ON)).toHaveLength(0);
        expect(applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', [msg('c', half)], ON)).toHaveLength(1);
        expect(readTurnState(tmp, 'sess').turn).toBe(2);
    });

    it('leaves an exempt slot untouched and unaccounted', () => {
        const env = { workspace_root: tmp };
        const out = applyTurnInjectionCap(env, 'sess', 'session_start', [msg('restore', cap() + 1)], ON);
        expect(out).toHaveLength(1);
        expect(readTurnState(tmp, 'sess').spent_bytes).toBe(0);
    });

    it('writes no state in replay mode', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        const env = { workspace_root: tmp };
        applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', [msg('a', 100)], ON);
        expect(fs.existsSync(statePath(tmp, 'sess'))).toBe(false);
    });
});

describe('applyTurnInjectionCap — the four preconditions', () => {
    const cap = (): number => readTurnBudget(BUDGET_PATH)!.capBytes;
    function msg(concern: string, bytes: number, isDroppable = true) {
        return { concern, text: 'x'.repeat(bytes), droppable: isDroppable };
    }

    // REGRESSION (R2 finding 2). The first version returned early on an empty
    // message list, so a prompt turn that produced no deciding message never
    // zeroed the accumulator — and by this branch own corpus that is 463 of 510
    // prompts, i.e. the common case. Bytes then leaked across turns.
    it('an EMPTY message list on a prompt still moves the boundary', () => {
        const env = { workspace_root: tmp };
        const ON = { hasTurnBoundary: true, emissionCarriesReasons: true };
        const nearlyFull = cap() - 10;
        applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', [msg('a', nearlyFull)], ON);
        expect(readTurnState(tmp, 'sess').spent_bytes).toBe(nearlyFull);

        // Next turn produced nothing to inject — the reset must still happen.
        applyTurnInjectionCap(env, 'sess', 'user_prompt_submit', [], ON);
        const state = readTurnState(tmp, 'sess');
        expect(state.spent_bytes).toBe(0);
        expect(state.turn).toBe(2);

        // …so a later slot in that turn has the full budget, not 10 bytes of it.
        expect(
            applyTurnInjectionCap(env, 'sess', 'post_tool_use', [msg('b', nearlyFull)], ON),
        ).toHaveLength(1);
    });

    // REGRESSION (R2 finding 1). augment binds stop / pre_tool_use /
    // post_tool_use and NO user_prompt_submit, so with a slot-only exemption
    // nothing ever reset and the per-turn cap became a per-session one that
    // dropped every advisory for the rest of the session.
    it('NO turn boundary → no accounting at all', () => {
        const env = { workspace_root: tmp };
        const OFF = { hasTurnBoundary: false, emissionCarriesReasons: true };
        for (let i = 0; i < 4; i++) {
            const out = applyTurnInjectionCap(env, 'sess', 'post_tool_use', [msg('a', cap())], OFF);
            expect(out).toHaveLength(1); // never dropped, however often it fires
        }
        expect(readTurnState(tmp, 'sess').spent_bytes).toBe(0);
        expect(read_dispatch_issues(tmp)).toEqual([]);
    });

    // REGRESSION (R2 finding 3). emitFor emits nothing for severity allow and
    // for unverified platforms; a crashed concern fail-opens to rc 0 and its
    // stderr becomes the largest "deciding" message. Charging it wedged the cap
    // on text nobody received.
    it('an emission that carries nothing → no bytes charged', () => {
        const env = { workspace_root: tmp };
        const SILENT = { hasTurnBoundary: true, emissionCarriesReasons: false };
        const out = applyTurnInjectionCap(
            env,
            'sess',
            'post_tool_use',
            [msg('crashed-concern', cap() * 2)],
            SILENT,
        );
        expect(out).toHaveLength(1);
        expect(readTurnState(tmp, 'sess').spent_bytes).toBe(0);
    });

    it('the predicate behind that precondition matches host_semantics', () => {
        expect(emissionCarriesReasons('claude', 'allow')).toBe(false);
        expect(emissionCarriesReasons('claude', 'warn')).toBe(true);
        expect(emissionCarriesReasons('claude', 'block')).toBe(true);
        // Unverified platform: emitFor returns empty stdout AND stderr.
        expect(emissionCarriesReasons('augment', 'warn')).toBe(false);
    });

    // REGRESSION (R2 finding 5). _resolve_session_id synthesises
    // dispatch-<ts>-<pid> when the envelope carries no id and calls the
    // instability deliberate; keyed on that, every read is zero.
    it('an unstable session id → declined, not silently unenforced', () => {
        const env = { workspace_root: tmp };
        const ON = { hasTurnBoundary: true, emissionCarriesReasons: true };
        const out = applyTurnInjectionCap(
            env,
            'dispatch-2026-08-19T00:00:00Z-999',
            'user_prompt_submit',
            [msg('a', cap() * 2)],
            ON,
        );
        expect(out).toHaveLength(1);
        // Declined means no accumulator at all — not a zeroed one that reads as
        // "nothing spent" on every fire.
        expect(fs.existsSync(path.join(tmp, 'agents', 'runtime', 'state', 'turn-injection'))).toBe(false);
    });
});
