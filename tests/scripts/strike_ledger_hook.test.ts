/**
 * The strike ledger through the real
 * recorder: a streak survives the turn reset and a session change, while the
 * recorder's own turn-scoped runs are still cleared.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { run } from '../../src/scripts/before_complete_hook.js';
import { STRIKE_LEDGER_FILE, type StrikeLedger } from '../../src/scripts/_lib/strike_ledger.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strike-'));
});

const RED = 'FAIL  tests/a.test.ts > adds\nAssertionError: expected 2 to be 3\n      Tests  1 failed | 4 passed (5)\n';
const GREEN = '      Tests  5 passed (5)\n';

function send(session: string, event: string, payload: Record<string, unknown> = {}): void {
    run(JSON.stringify({ event, session_id: session, platform: 'claude', payload }), { consumer_root: tmp });
}
const bash = (s: string, out: string, exit: number) =>
    send(s, 'post_tool_use', {
        tool_name: 'Bash',
        tool_input: { command: 'npx vitest run' },
        tool_response: { stdout: out, stderr: '', exit_code: exit },
    });
const edit = (s: string) => send(s, 'post_tool_use', { tool_name: 'Edit', tool_input: { file_path: 'src/a.ts' } });
const ledger = (): StrikeLedger => JSON.parse(fs.readFileSync(path.join(tmp, STRIKE_LEDGER_FILE), 'utf8')) as StrikeLedger;
const only = () => Object.values(ledger().entries)[0];

describe('strike ledger via before_complete_hook', () => {
    it('counts the same red across a turn reset and a new session', () => {
        bash('s1', RED, 1);
        expect(only()?.streak).toBe(1);
        send('s1', 'user_prompt_submit'); // turn reset clears the recorder's runs
        edit('s1');
        bash('s1', RED, 1);
        expect(only()).toMatchObject({ streak: 2, verdict: 'SAME' });

        edit('s2');
        bash('s2', RED, 1);
        expect(only()).toMatchObject({ streak: 3, verdict: 'SAME', platform: 'claude' });
    });

    it('a green after an edit resets the streak', () => {
        bash('s1', RED, 1);
        edit('s1');
        bash('s1', GREEN, 0);
        expect(only()).toMatchObject({ streak: 0, verdict: 'FIXED' });
    });

    it('a non-verifying command never writes the ledger', () => {
        send('s1', 'post_tool_use', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'a', exit_code: 0 } });
        expect(fs.existsSync(path.join(tmp, STRIKE_LEDGER_FILE))).toBe(false);
    });

    it('never re-observes a run an earlier event appended — same command, inside any time window', () => {
        bash('s1', RED, 1);
        edit('s1'); // an edit-only event right after: nothing is observed again
        edit('s1');
        expect(only()).toMatchObject({ streak: 1, verdict: 'NEW' });
        // and a non-verifying Bash event does not re-observe the red either
        send('s1', 'post_tool_use', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'a', exit_code: 0 } });
        expect(only()).toMatchObject({ streak: 1, verdict: 'NEW' });
    });
});
