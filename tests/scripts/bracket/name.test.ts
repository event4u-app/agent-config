// `bracket name` — the run's human name and one-line decision in name.json,
// in the exact v1 shape Agent Switch reads. A field the user set is kept.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { RUBRIC } from '../../../src/scripts/bracket/engine.js';
import { applyAgentWrite, DECISION_MAX, NAME_MAX, plainLine } from '../../../src/scripts/bracket/name.js';

const root = mkdtempSync(path.join(tmpdir(), 'bracket-name-'));
let main: (argv: string[]) => number;
const run = (...argv: string[]): number => main(argv);
const nameFile = (): string => path.join(root, 'runs', 'n1', 'name.json');
const read = (): Record<string, Record<string, string>> => JSON.parse(readFileSync(nameFile(), 'utf8')) as Record<string, Record<string, string>>;
const seat = ['--seat-id', 'j1', '--seat-family', 'fam-a', '--seat-billing', 'subscription'];

beforeAll(async () => {
    vi.stubEnv('BRACKET_ROOT', path.join(root, 'runs'));
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    ({ main } = await import('../../../src/scripts/bracket/cli.js'));
    writeFileSync(path.join(root, 'task.md'), 'name the sessions\n');
    run('init', '--run', 'n1', '--task', path.join(root, 'task.md'), '--n', '2', '--seed', '3');
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
});

describe('plainLine', () => {
    it('collapses control, bidi and line-separator characters and whitespace to one trimmed line', () => {
        expect(plainLine('  a\tb\n\nc d‮e⁦f\u0000g  ')).toBe('a b c d e f g');
    });
});

describe('applyAgentWrite', () => {
    const now = new Date('2026-11-26T08:00:00Z');

    it('refuses a text over the limit, counted in characters', () => {
        expect(() => applyAgentWrite({ v: 1 }, { field: 'name', text: 'ä'.repeat(NAME_MAX + 1), force: false, now })).toThrow(/at most 120/);
        expect(applyAgentWrite({ v: 1 }, { field: 'name', text: 'ä'.repeat(NAME_MAX), force: false, now }).change).toBe('set');
        expect(() => applyAgentWrite({ v: 1 }, { field: 'decision', text: 'x'.repeat(DECISION_MAX + 1), force: false, now })).toThrow(/at most 160/);
    });

    it('never replaces or clears a user field without force', () => {
        const user = { v: 1 as const, name: { text: 'Mine', by: 'user' as const, at: '2026-11-25T00:00:00Z' } };
        expect(() => applyAgentWrite(user, { field: 'name', text: 'Agent name', force: false, now })).toThrow(/set by the user/);
        expect(() => applyAgentWrite(user, { field: 'name', text: '', force: false, now })).toThrow(/set by the user/);
        expect(applyAgentWrite(user, { field: 'name', text: 'Agent name', force: true, now }).state.name).toEqual({ text: 'Agent name', by: 'agent', at: now.toISOString() });
        // The other field stays the agent's to write.
        expect(applyAgentWrite(user, { field: 'decision', text: 'Chosen', force: false, now, champion: 'L001' }).state).toMatchObject({ name: user.name, decision: { champion: 'L001' } });
    });
});

describe('bracket name (CLI)', () => {
    it('writes the name as the agent, in the v1 shape, at 0600', () => {
        expect(run('name', '--run', 'n1', '--text', '  Session names\npeople recognise ')).toBe(0);
        const f = read();
        expect(f['v']).toBe(1);
        expect(f['name']).toMatchObject({ text: 'Session names people recognise', by: 'agent' });
        expect(Number.isNaN(Date.parse(f['name']?.['at'] ?? ''))).toBe(false);
        if (process.platform !== 'win32') expect(statSync(nameFile()).mode & 0o777).toBe(0o600);
    });

    it('keeps a name the user set in Agent Switch unless --force', () => {
        writeFileSync(nameFile(), JSON.stringify({ v: 1, name: { text: 'Owner name', by: 'user', at: '2026-11-26T07:00:00Z' } }));
        expect(() => run('name', '--run', 'n1', '--text', 'Agent name')).toThrow(/set by the user/);
        expect(read()['name']?.['text']).toBe('Owner name');
        expect(run('name', '--run', 'n1', '--text', 'Agent name', '--force')).toBe(0);
        expect(read()['name']).toMatchObject({ text: 'Agent name', by: 'agent' });
    });

    it('an empty text clears the field', () => {
        expect(run('name', '--run', 'n1', '--text', '   ')).toBe(0);
        expect(read()['name']).toBeUndefined();
    });

    it('records the decision with the current champion once the run is done', () => {
        for (const id of ['L001', 'L002']) writeFileSync(path.join(root, 'runs', 'n1', 'lines', `${id}.md`), `solution ${id}\n`);
        run('scan', '--run', 'n1');
        run('advance', '--run', 'n1');
        run('briefs', '--run', 'n1', '--match', 'R1M1', ...seat);
        const hi = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, 8]));
        const lo = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, 3]));
        const verdict = { a: hi, b: lo, fatal: { a: 'none', b: 'none' }, pick: 'a', seat: { billing: 'subscription', family: 'fam-a', id: 'j1' } };
        writeFileSync(path.join(root, 'runs', 'n1', 'matches', 'R1M1', 'verdict.json'), JSON.stringify(verdict));
        run('collect', '--run', 'n1', '--match', 'R1M1');
        const state = JSON.parse(readFileSync(path.join(root, 'runs', 'n1', 'bracket.json'), 'utf8')) as { matches: { winner: string; loser: string; appeal: string | null }[] };
        const m = state.matches[0];
        const winner = m?.winner;
        expect(winner).toMatch(/^L00[12]$/);
        if (m?.appeal === 'open') run('decline', '--run', 'n1', '--line', m.loser, '--no-jury', 'test');
        expect(run('name', '--run', 'n1', '--decision', 'Sidecar name.json, PR-style fallbacks')).toBe(0);
        expect(read()['decision']).toMatchObject({ text: 'Sidecar name.json, PR-style fallbacks', by: 'agent', champion: winner });
    });

    it('refuses a run that does not exist and a traversal run id', () => {
        expect(() => run('name', '--run', 'nope', '--text', 'x')).toThrow(/no bracket.json/);
        expect(() => run('name', '--run', '../x', '--text', 'x')).toThrow(/single folder name/);
        expect(existsSync(path.join(root, 'x', 'name.json'))).toBe(false);
    });
});

describe('the engine stays out of name.json', () => {
    it('engine.ts neither imports name.ts nor names the file', () => {
        const src = readFileSync(path.resolve(__dirname, '../../../src/scripts/bracket/engine.ts'), 'utf8');
        expect(src).not.toMatch(/name\.json|from '\.\/name\.js'/);
    });
});
