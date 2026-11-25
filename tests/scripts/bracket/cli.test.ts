// The driver end to end: init deals angles, briefs builds a blind match folder,
// collect reads the verdict from the run folder and holds the judge to its seat.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { RUBRIC } from '../../../src/scripts/bracket/engine.js';

const root = mkdtempSync(path.join(tmpdir(), 'bracket-cli-'));
let main: (argv: string[]) => number;

const seat = ['--seat-id', 'j1', '--seat-family', 'fam-a', '--seat-billing', 'subscription'];
const run = (...argv: string[]): number => main(argv);

function verdict(pickA: boolean, seatOverride?: Record<string, string>): string {
    const hi = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, 8]));
    const lo = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, 3]));
    return JSON.stringify({
        a: pickA ? hi : lo,
        b: pickA ? lo : hi,
        fatal: { a: 'none', b: 'none' },
        pick: pickA ? 'a' : 'b',
        seat: seatOverride ?? { billing: 'subscription', family: 'fam-a', id: 'j1' },
    });
}

beforeAll(async () => {
    vi.stubEnv('BRACKET_ROOT', path.join(root, 'runs'));
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    ({ main } = await import('../../../src/scripts/bracket/cli.js'));
    writeFileSync(path.join(root, 'task.md'), 'make the import resumable\n');
    run('init', '--run', 'r1', '--task', path.join(root, 'task.md'), '--n', '2', '--seed', '4');
    for (const id of ['L001', 'L002']) writeFileSync(path.join(root, 'runs', 'r1', 'lines', `${id}.md`), `solution of ${id}\n`);
    run('scan', '--run', 'r1');
    run('advance', '--run', 'r1');
});

afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
});

const mdir = (): string => path.join(root, 'runs', 'r1', 'matches', 'R1M1');

describe('init', () => {
    it('records one distinct angle per line', () => {
        const angles = JSON.parse(readFileSync(path.join(root, 'runs', 'r1', 'angles.json'), 'utf8')) as Record<string, unknown>;
        expect(Object.keys(angles)).toEqual(['L001', 'L002']);
        expect(JSON.stringify(angles.L001)).not.toEqual(JSON.stringify(angles.L002));
    });

    it('refuses an --angles file with fewer distinct angles than lines', () => {
        writeFileSync(path.join(root, 'angles.txt'), 'one\none\n');
        expect(() => run('init', '--run', 'r2', '--task', path.join(root, 'task.md'), '--n', '2', '--angles', path.join(root, 'angles.txt'))).toThrow(/distinct angle/);
    });
});

describe('briefs', () => {
    it('refuses a free-quota judge seat', () => {
        expect(() => run('briefs', '--run', 'r1', '--match', 'R1M1', '--seat-id', 'f', '--seat-family', 'x', '--seat-billing', 'free-quota')).toThrow(/free-quota/);
    });

    it('builds a match folder whose judge-facing files carry no line id', () => {
        expect(run('briefs', '--run', 'r1', '--match', 'R1M1', ...seat)).toBe(0);
        for (const f of ['original-a.md', 'original-b.md', 'revised-a.md', 'revised-b.md', 'seat.json', 'briefs/judge.md']) expect(existsSync(path.join(mdir(), f))).toBe(true);
        expect(readFileSync(path.join(mdir(), 'briefs', 'judge.md'), 'utf8')).not.toMatch(/L00\d|lines\//);
    });
});

describe('collect', () => {
    it('refuses a verdict whose seat differs from the one named at briefs', () => {
        writeFileSync(path.join(mdir(), 'verdict.json'), verdict(true, { id: 'j1', family: 'fam-a', billing: 'per-token' }));
        expect(() => run('collect', '--run', 'r1', '--match', 'R1M1')).toThrow(/seat/);
    });

    it('reads the verdict from the run folder by default and carries the winner revision forward', () => {
        writeFileSync(path.join(mdir(), 'revised-a.md'), 'revised solution\n');
        writeFileSync(path.join(mdir(), 'verdict.json'), verdict(true));
        expect(run('collect', '--run', 'r1', '--match', 'R1M1')).toBe(0);
        const state = JSON.parse(readFileSync(path.join(root, 'runs', 'r1', 'bracket.json'), 'utf8')) as { matches: { id: string; a: string; winner: string }[] };
        const m = state.matches.find((x) => x.id === 'R1M1')!;
        expect(m.winner).toBe(m.a);
        expect(readFileSync(path.join(root, 'runs', 'r1', 'lines', `${m.a}.md`), 'utf8')).toBe('revised solution\n');
        expect(existsSync(path.join(root, 'runs', 'r1', 'lines', `${m.a}.before-R1M1.md`))).toBe(true);
    });

    it('refuses briefs for a closed match', () => {
        expect(() => run('briefs', '--run', 'r1', '--match', 'R1M1', ...seat)).toThrow(/already has a winner/);
    });
});
