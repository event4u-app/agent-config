// The bundle ceiling's raise rule, enforced against the base revision.
//
// The budget file used to say the gate "prints the rule but cannot enforce
// it". Against the base it can: a raise with a new, complete `raise_log` entry
// passes, a raise without one fails, a lowering without one passes. Near-misses
// pinned beside them: an entry already present at the base does not cover a
// fresh raise, a new entry naming a different `to` does not either, and a bare
// `{ to }` entry with no reason — what the ratification review refused the
// first version on — does not count as a recorded reason.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    chunkBuildArgv,
    chunkFindings,
    chunkRaiseFindings,
    raiseEntryProblems,
    raiseFindings,
} from '../../src/scripts/check_hook_bundle_composition.js';

const OLD_ENTRY = { date: '2026-10-01', from: 1500000, to: 1550000 };

function entry(from: number, to: number): object {
    return {
        date: '2026-10-07',
        from,
        to,
        what_was_added: 'A concern that inlines a second parser for one call site.',
        why_it_could_not_be_avoided: 'The parser is the only one that reads the format the host emits.',
    };
}

function budget(max: number, log: object[]): string {
    return JSON.stringify({ max_bytes: max, max_yaml_packages: 1, raise_log: log });
}

const BASE = budget(1550000, [OLD_ENTRY]);

describe('raiseFindings', () => {
    it('a raise with a new, complete raise_log entry naming the new ceiling passes', () => {
        expect(raiseFindings(BASE, budget(1600000, [OLD_ENTRY, entry(1550000, 1600000)]))).toEqual([]);
    });

    it('a raise without a new raise_log entry fails', () => {
        const findings = raiseFindings(BASE, budget(1600000, [OLD_ENTRY]));
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatch(/raised from 1550000 to 1600000/);
    });

    it('a lowering without an entry passes', () => {
        expect(raiseFindings(BASE, budget(1500000, [OLD_ENTRY]))).toEqual([]);
    });

    it('a new entry whose `to` is not the new ceiling does not cover the raise', () => {
        expect(raiseFindings(BASE, budget(1600000, [OLD_ENTRY, entry(1550000, 1580000)]))).toHaveLength(1);
    });

    it('an entry already at the base does not cover a raise to its own `to`', () => {
        const base = budget(1500000, [OLD_ENTRY]);
        expect(raiseFindings(base, budget(1550000, [OLD_ENTRY]))).toHaveLength(1);
    });

    it('a bare `{ to }` entry with no reason does not cover the raise', () => {
        const findings = raiseFindings(BASE, budget(1600000, [OLD_ENTRY, { to: 1600000 }]));
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatch(/incomplete/);
    });

    it('a base without the file (the registration diff) is not a raise', () => {
        expect(raiseFindings(null, budget(1550000, []))).toEqual([]);
    });
});

describe('raiseEntryProblems', () => {
    it('names a wrong `from`, a bad date and a missing reason', () => {
        const problems = raiseEntryProblems(
            { date: 'yesterday', from: 1, to: 1600000, what_was_added: 'x' },
            1550000,
        );
        expect(problems).toHaveLength(4);
    });

    it('the entry the shipped budget already carries is complete', () => {
        const shipped = {
            date: '2026-10-01',
            from: 1500000,
            to: 1550000,
            what_was_added: 'Nothing in this commit. The 1,500,000 ceiling was red on the very commit.',
            why_it_could_not_be_avoided: 'The bytes are deliberately merged capability, not an accident.',
        };
        expect(raiseEntryProblems(shipped, 1500000)).toEqual([]);
    });
});

describe('chunk ceilings', () => {
    const ENTRY = 'src/scripts/_lib/egress_engine.ts';
    const chunked = (max: number, log: object[]): string =>
        JSON.stringify({ max_bytes: 1550000, max_yaml_packages: 1, chunks: [{ entry: ENTRY, max_bytes: max }], raise_log: log });
    const chunkEntry = (from: number, to: number): object => ({ ...entry(from, to), chunk: ENTRY });

    it('a chunk over its ceiling is a finding, at or under it is not', () => {
        const budgets = [{ entry: ENTRY, maxBytes: 100 }];
        expect(chunkFindings(new Map([[ENTRY, 100]]), budgets)).toEqual([]);
        expect(chunkFindings(new Map([[ENTRY, 101]]), budgets)).toHaveLength(1);
    });

    it('a ceiling nothing measured is a finding, never a pass', () => {
        expect(chunkFindings(new Map(), [{ entry: ENTRY, maxBytes: 100 }])).toHaveLength(1);
    });

    it('a chunk raise needs a new entry naming the chunk and the new ceiling', () => {
        expect(chunkRaiseFindings(chunked(28000, []), chunked(30000, []))).toHaveLength(1);
        expect(chunkRaiseFindings(chunked(28000, []), chunked(30000, [entry(28000, 30000)]))).toHaveLength(1);
        expect(chunkRaiseFindings(chunked(28000, []), chunked(30000, [chunkEntry(28000, 30000)]))).toEqual([]);
    });

    it('a chunk lowering or a newly registered chunk needs no entry', () => {
        expect(chunkRaiseFindings(chunked(28000, []), chunked(20000, []))).toEqual([]);
        expect(chunkRaiseFindings(budget(1550000, []), chunked(28000, []))).toEqual([]);
    });
});

describe('chunkBuildArgv — the one definition of a chunk build, read as an argv', () => {
    const ENTRY = 'src/scripts/_lib/egress_engine.ts';
    const plain = `esbuild ${ENTRY} --bundle --platform=node --format=cjs --target=node20 --outfile=dist/hooks/e.cjs`;

    it('reads a plain esbuild segment into its flags', () => {
        const argv = chunkBuildArgv({ 'build:hook-chunks': `${plain} && node digest.mjs dist/hooks/e.cjs` }, ENTRY);
        expect(argv[0]).toBe(ENTRY);
        expect(argv).toContain('--format=cjs');
    });

    it('refuses a segment with shell semantics, a missing or doubled entry, and a missing outfile', () => {
        const bad = [
            `cd sub && ${plain}`,
            plain.replace('--target=node20', '--target="node20"'),
            `${plain} > log.txt`,
            `${plain} && ${plain}`,
            plain.replace(/ --outfile=\S+/, ''),
            'esbuild other.ts --outfile=x.cjs',
        ];
        for (const script of bad) {
            expect(() => chunkBuildArgv({ 'build:hook-chunks': script }, ENTRY), script).toThrow();
        }
    });

    it('the shipped package.json builds the engine chunk in one plain segment', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')) as { scripts: Record<string, string> };
        expect(chunkBuildArgv(pkg.scripts, ENTRY)[0]).toBe(ENTRY);
    });
});
