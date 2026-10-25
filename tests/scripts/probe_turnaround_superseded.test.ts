// `ci-wait-superseded` in src/scripts/probe_turnaround.ts — a blocking CI wait
// whose PR receives another push from the same session afterwards. Its verdict
// was cancelled by that push (`cancel-in-progress: true`), so the wait bought
// nothing.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { measure } from '../../src/scripts/probe_turnaround.js';

const T0 = Date.parse('2026-10-24T10:00:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();

const PUSH = { command: 'git push -u origin feat/x' };
const SETTLE = { command: './scripts-run src/scripts/ci_settle 2649' };

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function transcript(calls: ReadonlyArray<{ input: Record<string, unknown>; seconds: number }>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-superseded-'));
    dirs.push(dir);
    const rows: unknown[] = [{ type: 'user', timestamp: at(0), message: { role: 'user', content: 'go' } }];
    let clock = 1;
    calls.forEach((c, i) => {
        const id = `toolu_${String(i)}`;
        rows.push({
            type: 'assistant',
            requestId: `req_${String(i)}`,
            timestamp: at(clock),
            message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: c.input }] },
        });
        clock += c.seconds;
        rows.push({ type: 'user', timestamp: at(clock), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
        clock += 1;
    });
    const file = path.join(dir, 'session.jsonl');
    fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    return file;
}

describe('ci-wait-superseded', () => {
    it('push → settle → push on one PR reports one superseded wait with its minutes', () => {
        const t = measure([transcript([{ input: PUSH, seconds: 5 }, { input: SETTLE, seconds: 540 }, { input: PUSH, seconds: 5 }])]);
        expect(t.blockingByCause['ci-wait'].calls).toBe(1);
        expect(t.ciWaitSuperseded).toEqual({ calls: 1, seconds: 540 });
    });

    it('a single push and its settle report zero', () => {
        const t = measure([transcript([{ input: PUSH, seconds: 5 }, { input: SETTLE, seconds: 540 }])]);
        expect(t.ciWaitSuperseded).toEqual({ calls: 0, seconds: 0 });
    });

    it('a push in another session does not supersede this session’s wait', () => {
        const a = transcript([{ input: PUSH, seconds: 5 }, { input: SETTLE, seconds: 540 }]);
        const b = transcript([{ input: PUSH, seconds: 5 }]);
        expect(measure([a, b]).ciWaitSuperseded).toEqual({ calls: 0, seconds: 0 });
    });
});
