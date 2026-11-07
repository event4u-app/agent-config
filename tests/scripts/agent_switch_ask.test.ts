/**
 * road-to-a-link-with-agent-switch Phase 4 — raise, decide in-session, relay,
 * hand the work over.
 *
 * A real `agent-switch` executable sits on an injected PATH; the request it
 * answers lives in a file the test rewrites between prompts, the way
 * agent-switch's own store changes between two of a session's prompts.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendQuotaSnapshot, hashSessionId } from '../../src/scripts/_lib/quota_ledger.js';
import { checkpointBeforeMove, readSwitchRecord, relayLine, showSwitch } from '../../src/scripts/_lib/switch_relay.js';
import { noticeReply, type QuotaNoticeDeps } from '../../src/scripts/quota_notice_hook.js';

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake_agent_switch.mjs');
const NOW = Date.now();
const RESET = Math.trunc(NOW / 1000) + 3 * 3600;
const ID = '0123456789abcdef';

let home: string;
let stateEnv: Record<string, string>;
let switchFile: string;
let logFile: string;
let binEnv: Record<string, string>;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-ask-'));
    stateEnv = { EVENT4U_CONFIG_HOME: home };
    switchFile = path.join(home, 'request.json');
    logFile = path.join(home, 'calls.jsonl');
    const bin = path.join(home, 'bin');
    fs.mkdirSync(bin);
    const exe = path.join(bin, 'agent-switch');
    fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`, 'utf-8');
    fs.chmodSync(exe, 0o755);
    binEnv = {
        PATH: `${bin}${path.delimiter}${path.dirname(process.execPath)}`,
        FAKE_AS_SWITCH_FILE: switchFile,
        FAKE_AS_LOG: logFile,
    };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

function request(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        v: 1,
        id: ID,
        rev: 1,
        account: 'claude/a',
        session: 'claude/a/sess-a',
        reason: { window: 'five_hour', fill: 85, resetsAt: '2026-11-07T15:00:00Z' },
        raisedBy: 'ac',
        candidates: [
            { target: 'claude/b', provider: 'claude', fill: 12, resetsAt: null, how: ['after-turn', 'handoff'] },
            { target: 'codex/c', provider: 'codex', fill: 30, resetsAt: null, how: ['handoff'] },
        ],
        raisedAt: '2026-11-07T12:00:00Z',
        expiresAt: '2026-11-07T15:00:00Z',
        state: 'open',
        ...over,
    };
}

function setRequest(over: Record<string, unknown> = {}): void {
    fs.writeFileSync(switchFile, JSON.stringify(request(over)));
}

function calls(verb: string): string[][] {
    if (!fs.existsSync(logFile)) return [];
    return fs
        .readFileSync(logFile, 'utf-8')
        .split('\n')
        .filter((l) => l !== '')
        .map((l) => JSON.parse(l) as string[])
        .filter((a) => a[0] === 'switch' && a[1] === verb);
}

function hot(account = 'claude/a', session = 'sess-a'): void {
    [76, 80, 85].forEach((pct, i) =>
        appendQuotaSnapshot({ ts: NOW - (2 - i) * 5 * 60_000, session: hashSessionId(session), five_hour: { pct, resets_at: RESET }, account }, stateEnv),
    );
}

function deps(over: Partial<QuotaNoticeDeps> = {}): QuotaNoticeDeps {
    return {
        sessionId: 'sess-a',
        viaHost: true,
        env: {},
        stateEnv,
        billing: { billing_class: 'plan', source: null },
        now: NOW,
        link: { env: binEnv },
        ...over,
    };
}

describe('4.1 raise', () => {
    it('hot + link → one request for this session, named in one notice', () => {
        hot();
        setRequest();
        const r = noticeReply(deps());
        expect(calls('request')).toEqual([['switch', 'request', '--session', 'claude/a/sess-a', '--by', 'ac', '--json']]);
        const asks = r.lines.filter((l) => l.includes(ID));
        expect(asks).toHaveLength(1);
        expect(asks[0]).toMatch(/to claude\/b \(12 %\), codex\/c \(30 %\)\. Answer here or in agent-switch/);
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)?.id).toBe(ID);
    });

    it('raises once per cycle: a second prompt relays, it does not raise again', () => {
        hot();
        setRequest();
        noticeReply(deps());
        const again = noticeReply(deps());
        expect(calls('request')).toHaveLength(1);
        expect(again.lines.filter((l) => l.includes(ID))).toEqual([]);
    });

    it('no link → today’s notice, nothing raised', () => {
        hot();
        setRequest();
        const r = noticeReply(deps({ link: { env: { ...binEnv, FAKE_AS_LINK: 'off' } } }));
        expect(r.lines.some((l) => /^AC: 5h window 85 %/.test(l))).toBe(true);
        expect(r.lines.some((l) => l.includes('agent-switch'))).toBe(false);
        expect(r.context).toEqual([]);
        expect(calls('request')).toEqual([]);
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)).toBeNull();
    });

    it('no candidate (agent-switch refuses) → today’s notice, nothing recorded', () => {
        hot();
        const r = noticeReply(deps());
        expect(calls('request')).toHaveLength(1);
        expect(r.context).toEqual([]);
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)).toBeNull();
    });

    it('a session outside any profile, or a warm window, raises nothing', () => {
        hot('');
        setRequest();
        noticeReply(deps());
        [10, 30, 55].forEach((pct, i) =>
            appendQuotaSnapshot({ ts: NOW - (2 - i) * 60_000, session: hashSessionId('sess-b'), five_hour: { pct, resets_at: RESET + 60 }, account: 'claude/b' }, stateEnv),
        );
        noticeReply(deps({ sessionId: 'sess-b' }));
        expect(calls('request')).toEqual([]);
    });
});

describe('4.2 decide in-session', () => {
    it('the model is given the id and told to call switch_decide only on the user’s answer', () => {
        hot();
        setRequest();
        const [ctx] = noticeReply(deps()).context;
        expect(ctx).toContain(`switch request ${ID} is open`);
        expect(ctx).toContain('`switch_decide` tool of the `agent-switch` MCP server');
        expect(ctx).toMatch(/Only after the user answers here/);
        expect(ctx).toMatch(/host asks the user to confirm/);
        expect(ctx).toMatch(/Never decide for the user/);
    });
});

describe('4.3 relay a decision from agent-switch', () => {
    function raised(): void {
        hot();
        setRequest();
        noticeReply(deps());
    }

    it('an approval made in agent-switch is reported once', () => {
        raised();
        setRequest({ state: 'approved', decision: { kind: 'approve', target: 'claude/b', how: 'after-turn', by: 'as-gui', at: 'x' } });
        const first = noticeReply(deps());
        expect(first.lines).toContain('AC: approved in agent-switch — moving after this turn to claude/b.');
        expect(first.context.join('')).toContain('moving after this turn to claude/b');
        expect(noticeReply(deps()).lines.filter((l) => l.includes('agent-switch'))).toEqual([]);
    });

    it('the outcome is reported once when done, with the resume command verbatim, and then the request is forgotten', () => {
        raised();
        setRequest({
            state: 'done',
            decision: { kind: 'approve', target: 'claude/b', how: 'handoff', by: 'ac:claude-code', at: 'x' },
            outcome: { at: 'x', ok: true, detail: null, resume: 'claude --resume abc' },
        });
        expect(noticeReply(deps()).lines).toContain('AC: agent-switch moved this work to claude/b. Resume it with: claude --resume abc');
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)).toBeNull();
        const shows = calls('show').length;
        noticeReply(deps());
        expect(calls('show')).toHaveLength(shows);
    });

    it('a failed move is reported once with its detail', () => {
        raised();
        setRequest({ state: 'failed', decision: { kind: 'approve', target: 'claude/b', how: 'now', by: 'as-gui', at: 'x' }, outcome: { at: 'x', ok: false, detail: 'target is full' } });
        expect(noticeReply(deps()).lines).toContain('AC: agent-switch could not move this work to claude/b: target is full');
    });

    it('a decision made here is not echoed back; a decline in agent-switch is', () => {
        raised();
        setRequest({ state: 'approved', decision: { kind: 'approve', target: 'claude/b', how: 'after-turn', by: 'ac:claude-code', at: 'x' } });
        expect(noticeReply(deps()).lines.filter((l) => l.includes('agent-switch'))).toEqual([]);
        setRequest({ state: 'declined', decision: { kind: 'decline', target: null, how: null, by: 'as-cli', at: 'x' } });
        expect(noticeReply(deps()).lines).toContain('AC: the move was declined in agent-switch.');
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)).toBeNull();
    });

    it('a still-open request says nothing and stays tracked', () => {
        raised();
        expect(noticeReply(deps()).lines.filter((l) => l.includes('agent-switch'))).toEqual([]);
        expect(readSwitchRecord(hashSessionId('sess-a'), stateEnv)?.id).toBe(ID);
    });
});

describe('4.4 hand the work over', () => {
    it('an approved request triggers exactly one checkpoint write', () => {
        hot();
        setRequest();
        noticeReply(deps());
        let writes = 0;
        const write = (): void => {
            writes++;
        };
        const sess = hashSessionId('sess-a');
        expect(checkpointBeforeMove(sess, write, stateEnv, { env: binEnv })).toBe(false);
        setRequest({ state: 'approved', decision: { kind: 'approve', target: 'claude/b', how: 'after-turn', by: 'ac:claude-code', at: 'x' } });
        expect(checkpointBeforeMove(sess, write, stateEnv, { env: binEnv })).toBe(true);
        expect(checkpointBeforeMove(sess, write, stateEnv, { env: binEnv })).toBe(false);
        expect(writes).toBe(1);
    });

    it('a session without a raised request never asks agent-switch', () => {
        expect(checkpointBeforeMove(hashSessionId('nobody'), () => undefined, stateEnv, { env: binEnv })).toBe(false);
        expect(calls('show')).toEqual([]);
    });
});

describe('reading a request', () => {
    const show = (): ReturnType<typeof showSwitch> => showSwitch(ID, { env: binEnv });

    it('reads the contract shape and refuses anything else', () => {
        setRequest();
        expect(show()?.candidates.map((c) => c.target)).toEqual(['claude/b', 'codex/c']);
        setRequest({ v: 2 });
        expect(show()).toBeNull();
        setRequest({ id: 'r1' });
        expect(show()).toBeNull();
        fs.rmSync(switchFile);
        expect(show()).toBeNull();
        expect(showSwitch('--executed', { env: binEnv })).toBeNull();
        expect(calls('show').some((a) => a.includes('--executed'))).toBe(false);
    });

    it('drops a candidate it cannot read, and a move it does not know', () => {
        setRequest({ candidates: [{ target: '../x', how: ['now'] }, { target: 'claude/ok', how: ['rm -rf', 'now'] }] });
        expect(show()?.candidates).toEqual([{ target: 'claude/ok', fill: null, how: ['now'] }]);
    });

    it('relayLine says nothing new for an open request', () => {
        setRequest();
        const req = show();
        expect(req).not.toBeNull();
        if (req !== null) expect(relayLine(req, { id: ID, decision_told: false, checkpointed: false })).toBeNull();
    });
});
