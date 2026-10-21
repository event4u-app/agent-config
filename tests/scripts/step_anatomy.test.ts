// Step anatomy — every class gets a distinct duration, so a class total can
// only come out right if every gap landed in its own class.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import { classifyBlockingCall, main } from '../../src/scripts/probe_turnaround.js';
import {
    classifyCall,
    closedStep,
    readSteps,
    stepSumError,
    summariseSteps,
} from '../../src/scripts/_lib/step_anatomy.js';

const T0 = Date.parse('2026-10-21T10:00:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();
const CWD = '/repo';
const ROADMAP = `${CWD}/agents/roadmaps/road-to-x.md`;

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

let seq = 0;
function call(s: number, name: string, input: Record<string, unknown>): { row: unknown; id: string } {
    seq += 1;
    const id = `toolu_${String(seq)}`;
    return {
        id,
        row: {
            type: 'assistant',
            cwd: CWD,
            requestId: `req_${String(seq)}`,
            timestamp: at(s),
            message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
        },
    };
}
const result = (s: number, id: string): unknown => ({
    type: 'user',
    timestamp: at(s),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
});
const flip = (step: string): Record<string, unknown> => ({
    file_path: ROADMAP,
    old_string: `- [ ] **${step} Do it.**`,
    new_string: `- [x] **${step} Do it.** Done.`,
});

function fixture(): string {
    const rows: unknown[] = [{ type: 'user', timestamp: at(0), message: { role: 'user', content: 'run the roadmap' } }];
    const edit = call(10, 'Edit', { file_path: `${CWD}/src/x.ts`, old_string: 'a', new_string: 'b' });
    rows.push(edit.row, result(40, edit.id));
    const test = call(45, 'Bash', { command: 'npx vitest run tests/x.test.ts' });
    rows.push(test.row, result(105, test.id));
    const record = call(110, 'Write', { file_path: `${CWD}/agents/evidence/analysis/x.md`, content: 'x' });
    rows.push(record.row, result(130, record.id));
    const settle = call(140, 'Bash', { command: './scripts-run src/scripts/ci_settle 12' });
    rows.push(settle.row, result(740, settle.id));
    rows.push({ type: 'user', timestamp: at(760), message: { role: 'user', content: 'Stop hook feedback: turn-end-gate: REFUSED — not finished' } });
    const close1 = call(770, 'Edit', flip('1.1'));
    rows.push(close1.row, result(775, close1.id));
    const close2 = call(780, 'Edit', flip('1.2'));
    rows.push(close2.row);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-anatomy-'));
    dirs.push(dir);
    const file = path.join(dir, 'sess.jsonl');
    fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return file;
}

describe('step anatomy', () => {
    it('splits a closed step into its classes, and they sum to the step total', () => {
        const [first, second] = readSteps(fixture(), classifyBlockingCall);
        expect(first?.step).toBe('1.1');
        expect(first?.totalMs).toBe(770_000);
        expect(first?.ms).toEqual({
            model: 40_000,
            change: 30_000,
            verify: 60_000,
            ceremony: 20_000,
            wait: 600_000,
            refusal: 20_000,
            unknown: 0,
        });
        expect(first !== undefined && stepSumError(first)).toBeNull();
        expect(first?.riskClass).toBe('R2');
        expect(second?.step).toBe('1.2');
        expect(second?.ms.ceremony).toBe(5_000);
        expect(second?.ms.model).toBe(5_000);
    });

    it('counts the roadmap bytes a step read, and nothing else', () => {
        const file = fixture();
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        const read = call(5, 'Read', { file_path: ROADMAP });
        const other = call(6, 'Read', { file_path: `${CWD}/src/x.ts` });
        const body = (id: string, text: string): string =>
            JSON.stringify({ type: 'user', timestamp: at(id === read.id ? 7 : 8), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] } });
        lines.splice(1, 0, JSON.stringify(read.row), body(read.id, 'x'.repeat(4000)), JSON.stringify(other.row), body(other.id, 'y'.repeat(9000)));
        // A shell read of the roadmap counts too; a shell command that only names it does not read it.
        const shell = call(8, 'Bash', { command: `sed -n 1,80p ${ROADMAP}` });
        const write = call(9, 'Bash', { command: `git add ${ROADMAP}` });
        lines.splice(5, 0, JSON.stringify(shell.row), body(shell.id, 'z'.repeat(1500)), JSON.stringify(write.row), body(write.id, 'w'.repeat(700)));
        fs.writeFileSync(file, `${lines.join('\n')}\n`);
        const [first, second] = readSteps(file, classifyBlockingCall);
        expect(first?.roadmapReadBytes).toBe(5500);
        expect(second?.roadmapReadBytes).toBe(0);
        expect(first !== undefined && stepSumError(first)).toBeNull();
    });

    it('metadata rows (queue operations, system notes, pr links) anchor no gap', () => {
        const file = fixture();
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
        // Inside the 600 s CI wait: two metadata rows. Before the fix the second
        // half of the wait landed in `unknown`, ended by a row nobody waited on.
        lines.splice(8, 0, JSON.stringify({ type: 'queue-operation', timestamp: at(300) }), JSON.stringify({ type: 'system', subtype: 'informational', timestamp: at(500) }));
        fs.writeFileSync(file, `${lines.join('\n')}\n`);
        const [first] = readSteps(file, classifyBlockingCall);
        expect(first?.ms.unknown).toBe(0);
        expect(first?.ms.wait).toBe(600_000);
    });

    it('classifies the planted ceremony turn as ceremony, not change', () => {
        expect(classifyCall('Write', { file_path: 'agents/evidence/analysis/x.md' }, classifyBlockingCall)).toBe('ceremony');
        expect(classifyCall('Bash', { command: './scripts-run src/scripts/council_cli run q.md' }, classifyBlockingCall)).toBe('ceremony');
        expect(classifyCall('Edit', { file_path: 'src/x.ts' }, classifyBlockingCall)).toBe('change');
    });

    it('the sum check goes red when one class is neutralised', () => {
        const [first] = readSteps(fixture(), classifyBlockingCall);
        if (first === undefined) throw new Error('no step read');
        const broken = { ...first, ms: { ...first.ms, ceremony: 0 } };
        expect(stepSumError(broken)).toMatch(/classes sum to 750000 ms, total is 770000 ms/);
        expect(summariseSteps([broken]).sumErrors).toHaveLength(1);
    });

    it('a roadmap edit that flips no checkbox closes no step', () => {
        expect(closedStep('Edit', { file_path: ROADMAP, old_string: 'a', new_string: 'b' })).toBeNull();
        expect(closedStep('Edit', { ...flip('1.1'), file_path: `${CWD}/src/x.md` })).toBeNull();
        expect(closedStep('Edit', flip('2.3'))).toEqual({ roadmap: 'road-to-x', step: '2.3' });
        // An already-ticked step in the edit's context must not hide the flip below it.
        expect(
            closedStep('Edit', {
                file_path: ROADMAP,
                old_string: '- [x] **1.1 Done.**\n- [ ] **1.2 Next.**',
                new_string: '- [x] **1.1 Done.**\n- [x] **1.2 Next.** Done.',
            }),
        ).toEqual({ roadmap: 'road-to-x', step: '1.2' });
        // `1.1` is not `1.10`.
        expect(
            closedStep('Edit', {
                file_path: ROADMAP,
                old_string: '- [ ] **1.10 Ten.**\n- [x] **1.1 One.**',
                new_string: '- [x] **1.10 Ten.** Done.\n- [x] **1.1 One.**',
            }),
        ).toEqual({ roadmap: 'road-to-x', step: '1.10' });
    });

    it('probe_turnaround --steps reads a comma-separated list of stores as one corpus', () => {
        const a = path.dirname(fixture());
        const b = path.dirname(fixture());
        const res = runInProc(main, ['--steps', '--json', '--include-current', '--store', `${a},${b}`]);
        expect(res.status).toBe(0);
        expect((JSON.parse(res.stdout) as { steps: number; sessions: number }).steps).toBe(4);
    });

    it('reads the steps a subagent closed — its transcript is all sidechain rows, filed under the session', () => {
        const top = fixture();
        const store = path.dirname(top);
        const sub = path.join(store, 'sess', 'subagents');
        fs.mkdirSync(sub, { recursive: true });
        const rows = fs
            .readFileSync(top, 'utf8')
            .trim()
            .split('\n')
            .map((l) => JSON.stringify({ ...(JSON.parse(l) as Record<string, unknown>), isSidechain: true }));
        fs.writeFileSync(path.join(sub, 'agent-1.jsonl'), `${rows.join('\n')}\n`);
        const res = runInProc(main, ['--steps', '--json', '--include-current', '--store', store]);
        expect(res.status).toBe(0);
        expect((JSON.parse(res.stdout) as { steps: number }).steps).toBe(4);
    });

    it('summarises per class and per change class, unknown always present', () => {
        const s = summariseSteps(readSteps(fixture(), classifyBlockingCall));
        expect(s.steps).toBe(2);
        expect(s.p50Min).toBe(0.2);
        expect(s.p90Min).toBe(0.2);
        expect(s.roadmapReadP50Kb).toBe(0);
        expect(Object.keys(s.byClass)).toContain('unknown');
        expect(s.byRisk.R2.steps).toBe(1);
        expect(s.byRisk.R3.steps).toBe(1);
        expect(s.sumErrors).toEqual([]);
    });
});
