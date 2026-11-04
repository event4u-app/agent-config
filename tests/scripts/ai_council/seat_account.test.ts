// road-to-a-council-that-spreads-across-accounts — every phase's verify clause.
//
// The end-to-end cases run the REAL `CliClient._runSubprocess` against a stub
// `codex` that answers with the `CODEX_HOME` it was started under, so a seat's
// account is read off the child, not off our own bookkeeping.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _setRunner,
    accountSourceLine,
    beginSeatAccountRound,
    FolderRuleRefusal,
    resolveSeatHome,
    type RunResult,
    type Runner,
} from '../../../src/scripts/_lib/agent_switch_account.js';
import { appendEvent } from '../../../src/scripts/ai_council/events_log.js';
import { OpenAICliClient, seatAccountEvent } from '../../../src/scripts/ai_council/clients.js';
import { _build_config } from '../../../src/scripts/ai_council/config.js';
import { classifySeatLimit } from '../../../src/scripts/ai_council/seat_limit.js';

const ok = (o: unknown): RunResult => ({ status: 0, stdout: JSON.stringify(o), stderr: '' });

/** A fake agent-switch over a fixed account list; records every call's args. */
function fakeAgentSwitch(accounts: string[], calls: string[][]): Runner {
    return (args) => {
        calls.push([...args]);
        if (args[0] === 'list') {
            return ok(accounts.map((a) => ({ provider: a.split('/')[0], name: a.split('/')[1], disabled: false })));
        }
        const i = args.indexOf('--exclude');
        const excluded = i >= 0 ? (args[i + 1] ?? '').split(',') : [];
        const free = accounts.filter((a) => !excluded.includes(a.split('/')[1] ?? ''));
        const pick = free[0] ?? null;
        return ok({ profile: pick, configDir: pick === null ? null : `/as/${pick}/config`, why: [] });
    };
}

let tmp: string;
let stub: string;
const savedMode = process.env['AGENT_CONFIG_AGENT_SWITCH'];

class SeatClient extends OpenAICliClient {
    events: Record<string, unknown>[] = [];
    protected override _logSeatAccount(event: Record<string, unknown>): void {
        this.events.push(event);
    }
    runRaw(): string {
        return this._runSubprocess([this.binary], '').stdout;
    }
}

function seat(): SeatClient {
    return new SeatClient({ binary: stub, model: 'codex-default', cli_calls_path: path.join(tmp, 'calls.json') });
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-account-'));
    stub = path.join(tmp, 'codex');
    // Answers with the account it was started on; refuses with codex's own
    // limit wording when started on the account named in LIMIT_ON.
    fs.writeFileSync(
        stub,
        [
            '#!/bin/sh',
            'cat >/dev/null',
            'if [ -n "$LIMIT_ON" ] && [ "${CODEX_HOME:-}" = "$LIMIT_ON" ]; then',
            '  echo \'{"type":"turn.failed","error":{"message":"You\'"\'"\'ve hit your usage limit (usage_limit_reached)"}}\'',
            '  exit 0',
            'fi',
            'printf \'{"type":"item.completed","item":{"type":"agent_message","text":"HOME=%s"}}\\n\' "${CODEX_HOME:-}"',
        ].join('\n'),
        { mode: 0o755 },
    );
    process.env['AGENT_CONFIG_AGENT_SWITCH'] = 'rules';
    delete process.env['CODEX_HOME'];
    delete process.env['LIMIT_ON'];
    beginSeatAccountRound();
});

afterEach(() => {
    _setRunner(null);
    if (savedMode === undefined) delete process.env['AGENT_CONFIG_AGENT_SWITCH'];
    else process.env['AGENT_CONFIG_AGENT_SWITCH'] = savedMode;
    delete process.env['LIMIT_ON'];
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Phase 0 — the single account', () => {
    it('a seat spawned without a resolver answer starts on the default login', () => {
        _setRunner(() => ({ status: null, stdout: '', stderr: '', missing: true }));
        const r = seat().ask('', 'q');
        expect(r.error).toBeFalsy();
        expect(r.text).toBe('HOME=');
        expect(r.metadata['account']).toBeUndefined();
    });
});

describe('1.1 resolveSeatHome', () => {
    it('missing binary → null', () => {
        _setRunner(() => ({ status: null, stdout: '', stderr: '', missing: true }));
        expect(resolveSeatHome('openai', { mode: 'rules' })).toBeNull();
    });
    it('{configDir} → the vendor env var', () => {
        _setRunner(() => ok({ profile: 'codex/A', configDir: '/as/codex/A/config', why: [] }));
        expect(resolveSeatHome('openai', { mode: 'rules' })).toEqual({ envVar: 'CODEX_HOME', dir: '/as/codex/A/config', profile: 'codex/A' });
        expect(resolveSeatHome('anthropic', { mode: 'rules' })?.envVar).toBe('CLAUDE_CONFIG_DIR');
    });
    it('exit 86 → typed refusal naming the rule', () => {
        _setRunner(() => ({ status: 86, stdout: JSON.stringify({ profile: null, configDir: null, blocked: 'folder ~/work pins codex/Work' }), stderr: '' }));
        expect(() => resolveSeatHome('openai', { mode: 'rules' })).toThrow(FolderRuleRefusal);
        try {
            resolveSeatHome('openai', { mode: 'rules' });
        } catch (e) {
            expect((e as FolderRuleRefusal).rule).toContain('codex/Work');
        }
    });
    it('malformed JSON, null configDir, unserved vendor → null', () => {
        _setRunner(() => ({ status: 0, stdout: 'not json', stderr: '' }));
        expect(resolveSeatHome('openai', { mode: 'rules' })).toBeNull();
        _setRunner(() => ok({ profile: null, configDir: null }));
        expect(resolveSeatHome('openai', { mode: 'rules' })).toBeNull();
        _setRunner(() => ok({ profile: 'x/y', configDir: '/d' }));
        expect(resolveSeatHome('gemini', { mode: 'rules' })).toBeNull();
    });
});

describe('1.2 the seat spawn carries the resolved account', () => {
    it('the child reports the resolved dir', () => {
        _setRunner(fakeAgentSwitch(['codex/A'], []));
        const r = seat().ask('', 'q');
        expect(r.text).toBe('HOME=/as/codex/A/config');
    });
    it('with the resolver returning null it still reports the inherited value', () => {
        _setRunner(() => ok({ profile: null, configDir: null }));
        process.env['CODEX_HOME'] = '/inherited';
        try {
            expect(seat().runRaw()).toContain('HOME=/inherited');
            expect(seat().ask('', 'q').text).toBe('HOME=/inherited');
        } finally {
            delete process.env['CODEX_HOME'];
        }
    });
    it('a folder rule that cannot be served refuses the seat instead of using the default login', () => {
        _setRunner(() => ({ status: 86, stdout: JSON.stringify({ blocked: 'folder rule: codex/Work only' }), stderr: '' }));
        const r = seat().ask('', 'q');
        expect(r.error).toBe('folder_rule_refused');
        expect(r.text).toBe('');
    });
});

describe('1.3 which account served', () => {
    it('the response and the events-log row name the profile, never the config dir', () => {
        _setRunner(fakeAgentSwitch(['codex/A'], []));
        const c = seat();
        const r = c.ask('', 'q');
        expect(r.metadata['account']).toBe('codex/A');
        expect(c.events).toEqual([seatAccountEvent('openai', 'codex-default', 'codex/A', null)]);

        const log = path.join(tmp, 'events.log');
        appendEvent(seatAccountEvent('openai', 'codex-default', 'codex/A', null), { logPath: log });
        const written = fs.readFileSync(log, 'utf-8');
        expect(JSON.parse(written)).toMatchObject({ action: 'seat_account', account: 'codex/A', outcome: 'ok' });
        expect(written).not.toContain('/as/');
        expect(written).not.toContain('config');
        expect(JSON.stringify(r.metadata)).not.toContain('/as/');
    });
    it('absent when unresolved', () => {
        _setRunner(() => ok({ profile: null, configDir: null }));
        const c = seat();
        expect(c.ask('', 'q').metadata['account']).toBeUndefined();
        expect(c.events).toEqual([]);
    });
});

describe('1.4 folder rules and the mode key', () => {
    it('balance passes --plain, rules does not, off never calls', () => {
        const calls: string[][] = [];
        _setRunner(fakeAgentSwitch(['codex/A'], calls));
        resolveSeatHome('openai', { mode: 'balance' });
        resolveSeatHome('openai', { mode: 'rules' });
        resolveSeatHome('openai', { mode: 'off' });
        expect(calls).toHaveLength(2);
        expect(calls[0]).toContain('--plain');
        expect(calls[1]).not.toContain('--plain');
    });
    it('off via the env leaves the seat on the inherited login', () => {
        const calls: string[][] = [];
        _setRunner(fakeAgentSwitch(['codex/A'], calls));
        process.env['AGENT_CONFIG_AGENT_SWITCH'] = 'off';
        expect(seat().ask('', 'q').text).toBe('HOME=');
        expect(calls).toEqual([]);
    });
    it('config: absent → rules; an unknown value fails the load', () => {
        expect(_build_config({}, 'x').agent_switch).toBe('rules');
        expect(_build_config({ agent_switch: 'balance' }, 'x').agent_switch).toBe('balance');
        expect(() => _build_config({ agent_switch: 'sometimes' }, 'x')).toThrow(/agent_switch/);
    });
});

describe('2.1 classifying the limit', () => {
    it("both vendors' real limit lines classify; an ordinary failure does not", () => {
        expect(classifySeatLimit('{"type":"error","code":"usage_limit_reached"}', 'codex/A')?.profile).toBe('codex/A');
        expect(classifySeatLimit("You've hit your usage limit. Upgrade to Pro", 'codex/A')).not.toBeNull();
        expect(classifySeatLimit('Claude AI usage limit reached|1730000000', 'claude/A')).not.toBeNull();
        expect(classifySeatLimit('unexpected status 429 Too Many Requests', 'codex/A')).not.toBeNull();
        expect(classifySeatLimit('error: model not found', 'codex/A')).toBeNull();
        expect(classifySeatLimit('Not inside a trusted directory', 'codex/A')).toBeNull();
        expect(classifySeatLimit('usage_limit_reached', null)).toBeNull();
    });
});

describe('2.2 one retry on another account', () => {
    it("limited on A, answered on B: B's answer and two journal rows", () => {
        _setRunner(fakeAgentSwitch(['codex/A', 'codex/B'], []));
        process.env['LIMIT_ON'] = '/as/codex/A/config';
        const c = seat();
        const r = c.ask('', 'q');
        expect(r.error).toBeFalsy();
        expect(r.text).toBe('HOME=/as/codex/B/config');
        expect(r.metadata['account']).toBe('codex/B');
        expect(r.metadata['account_retry_from']).toBe('codex/A');
        expect(c.events.map((e) => [e['account'], e['outcome']])).toEqual([
            ['codex/A', 'turn_failed'],
            ['codex/B', 'ok'],
        ]);
    });
    it('no other account: the seat fails with the original limit error, once', () => {
        _setRunner(fakeAgentSwitch(['codex/A'], []));
        process.env['LIMIT_ON'] = '/as/codex/A/config';
        const c = seat();
        const r = c.ask('', 'q');
        expect(r.error).toBe('turn_failed');
        expect(String(r.metadata['detail'])).toContain('usage limit');
        expect(r.metadata['account_retry']).toBe('no_other_account');
        expect(c.events).toHaveLength(1);
    });
    it('limited on every account: one retry, never a loop', () => {
        const calls: string[][] = [];
        _setRunner(fakeAgentSwitch(['codex/A', 'codex/B'], calls));
        process.env['LIMIT_ON'] = '/as/codex/A/config';
        const c = seat();
        // B limits too: point LIMIT_ON at whichever account the child starts on.
        fs.writeFileSync(stub, '#!/bin/sh\ncat >/dev/null\necho \'{"type":"turn.failed","error":{"message":"usage_limit_reached"}}\'\n', { mode: 0o755 });
        const r = c.ask('', 'q');
        expect(r.error).toBe('turn_failed');
        expect(c.events).toHaveLength(2);
    });
});

describe('3.1 spreading the seats of one round', () => {
    it('two seats, two accounts → two accounts; three seats → both, the third shared', () => {
        _setRunner(fakeAgentSwitch(['codex/A', 'codex/B'], []));
        const homes = [seat(), seat(), seat()].map((c) => c.ask('', 'q').text);
        expect(homes.slice(0, 2).sort()).toEqual(['HOME=/as/codex/A/config', 'HOME=/as/codex/B/config']);
        expect(['HOME=/as/codex/A/config', 'HOME=/as/codex/B/config']).toContain(homes[2]);
    });
    it('a new round frees every account again', () => {
        _setRunner(fakeAgentSwitch(['codex/A', 'codex/B'], []));
        expect(seat().ask('', 'q').text).toBe('HOME=/as/codex/A/config');
        beginSeatAccountRound();
        expect(seat().ask('', 'q').text).toBe('HOME=/as/codex/A/config');
    });
});

describe('4.1 council:status names the account source', () => {
    it('agent-switch with two accounts, and absent', () => {
        _setRunner(fakeAgentSwitch(['codex/A', 'codex/B', 'claude/C'], []));
        expect(accountSourceLine('openai', 'codex')).toBe('codex seats: agent-switch (2 accounts, rules)');
        _setRunner(() => ({ status: null, stdout: '', stderr: '', missing: true }));
        expect(accountSourceLine('openai', 'codex')).toBe('codex seats: default login (agent-switch not found)');
    });
});
