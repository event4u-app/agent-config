import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { countSession, main, measure, render } from '../../src/scripts/measure_work_product_line.js';

const LINE = '> ⚠️ Attorney review required on material use. This is a draft for a licensed attorney.';

const prompt = (text: string): string => JSON.stringify({ type: 'user', message: { content: text } });
const toolResult = (): string =>
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } });
const reply = (text: string): string =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const write = (name = 'Write'): string =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input: { file_path: 'x.md' } }] } });
const bash = (): string =>
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } });

/** Three turns: question (line), drafting turn (write + line), question (line, twice). */
const SESSION_A = [
    prompt('what is an NDA?'),
    reply(`An NDA is ...\n${LINE}`),
    prompt('draft one'),
    write('Write'),
    toolResult(),
    reply(`Drafted.\n${LINE}`),
    prompt('and the term?'),
    bash(),
    toolResult(),
    reply(`Two years.\n${LINE}`),
    reply(`Also: ${LINE}`),
];

/** One edit turn carrying the line, one quiet question turn. */
const SESSION_B = [prompt('redline it'), write('Edit'), toolResult(), reply(LINE), prompt('thanks'), reply('You are welcome.')];

/** Never carries the line. */
const SESSION_C = [prompt('hello'), reply('Hi.')];

let tmp: string | null = null;
afterEach(() => {
    if (tmp !== null) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
});

function store(): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wpl-'));
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, 'aaaaaaaa-1.jsonl'), SESSION_A.join('\n'));
    fs.writeFileSync(path.join(project, 'bbbbbbbb-2.jsonl'), SESSION_B.join('\n'));
    fs.writeFileSync(path.join(tmp, 'cccccccc-3.jsonl'), SESSION_C.join('\n'));
    return tmp;
}

describe('measure_work_product_line', () => {
    it('splits replies by whether their turn wrote a file', () => {
        expect(countSession('a', SESSION_A)).toEqual({ session: 'a', replies: 4, inWriteTurn: 1, inNoWriteTurn: 3 });
        expect(countSession('b', SESSION_B)).toEqual({ session: 'b', replies: 1, inWriteTurn: 1, inNoWriteTurn: 0 });
        expect(countSession('c', SESSION_C)).toEqual({ session: 'c', replies: 0, inWriteTurn: 0, inNoWriteTurn: 0 });
    });

    it('counts three sessions across a store and one project directory', () => {
        const result = measure([store()]);
        expect(result.sessions).toBe(3);
        expect(result.rows.map((r) => r.session)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
        const out = render(result);
        expect(out).toContain('| total | 5 | 2 | 3 |');
        expect(out).not.toMatch(/NDA|Drafted|Two years/);
    });

    it('refuses an empty store instead of reporting zero', () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wpl-'));
        expect(main(['--store', tmp])).toBe(2);
        expect(main([])).toBe(2);
    });
});
