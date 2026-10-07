/**
 * `doctor neighbours --contradictions`
 * (road-to-neighbours-that-pull-their-weight step 2.2).
 *
 * The step's own fixture first: a neighbour's always-on "spawn agents and wait"
 * against the project's "never end a turn waiting" yields exactly one pair, and
 * the "which wins" column names the project line. Then the properties that keep
 * the review honest: no council → `n/a` and no review; same-modality lines form
 * no pair; a body the shape scan refused contributes no line; and the mode
 * writes nothing into the project tree.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { contradictionCandidates, runContradictions } from '../../src/scripts/_cli/cmd_doctor_neighbours.js';
import {
    RANK_NEIGHBOUR_ALWAYS_ON,
    RANK_PROJECT,
    extractInstructions,
    modalityPairs,
    parseVerdicts,
    seatPrompt,
    stem,
} from '../../src/scripts/_lib/neighbour_contradictions.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const dirs: string[] = [];

afterEach(() => {
    while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
    dirs.push(d);
    return d;
}

function write(root: string, rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body, 'utf-8');
}

function fixture(neighbourRule: string): { project: string; home: string } {
    const project = tmp('contra-');
    write(project, 'CLAUDE.md', '# Project\n\n- Never end a turn waiting on a background job.\n');
    write(project, path.join('.claude', 'rules', 'orchestrate.md'), neighbourRule);
    return { project, home: tmp('contra-home-') };
}

function listing(root: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push(`${path.relative(root, p)}:${fs.statSync(p).mtimeMs}`);
        }
    };
    walk(root);
    return out.sort();
}

describe('the step 2.2 fixture', () => {
    it('"spawn agents and wait" against "never end a turn waiting" yields one pair naming the project line', () => {
        const { project, home } = fixture('# Orchestrate\n\nSpawn agents and wait for every result.\n');
        const prompts: string[] = [];

        const r = runContradictions(project, REPO_ROOT, {
            homeRoot: home,
            configured: true,
            seat: (p) => {
                prompts.push(p);
                return 'PAIR 1: contradiction — one says wait, the other forbids ending a turn waiting.';
            },
        });

        expect(r.rows).toHaveLength(1);
        expect(r.rows?.[0]?.verdict).toBe('contradiction');
        expect(r.rows?.[0]?.wins).toContain('CLAUDE.md');
        expect(r.rows?.[0]?.wins).toContain(`rank ${RANK_PROJECT}`);
        expect(r.lines[0]).toBe('  pair | verdict | which wins by 2.1');
        // The seat got the rubric: the shipped rule text, not a paraphrase.
        expect(prompts[0]).toContain('Neighbour Precedence');
        expect(prompts[0]).toContain('never end a turn waiting'.replace('never', 'Never'));
    });

    it('prints n/a and reviews nothing when no council is configured', () => {
        const { project, home } = fixture('# Orchestrate\n\nSpawn agents and wait for every result.\n');
        let called = false;

        const r = runContradictions(project, REPO_ROOT, {
            homeRoot: home,
            configured: false,
            seat: () => {
                called = true;
                return '';
            },
        });

        expect(r.rows).toBeNull();
        expect(r.lines[0]).toMatch(/^ {2}contradictions: n\/a — no council configured/u);
        expect(called).toBe(false);
    });

    it('changes no file in the project tree', () => {
        const { project, home } = fixture('# Orchestrate\n\nSpawn agents and wait for every result.\n');
        const before = listing(project);

        runContradictions(project, REPO_ROOT, { homeRoot: home, configured: true, seat: () => 'PAIR 1: unclear' });

        expect(listing(project)).toEqual(before);
    });
});

describe('candidate formation is narrow', () => {
    it('same modality on a shared word forms no pair', () => {
        const { project, home } = fixture('# Orchestrate\n\nNever leave agents waiting unattended.\n');
        expect(contradictionCandidates(project, REPO_ROOT, home)).toEqual([]);
    });

    it('a neighbour body the shape scan refuses contributes no line', () => {
        // A zero-width space is a `hidden-unicode` finding; the identical text
        // without it forms the pair above.
        const { project, home } = fixture('# Orchestrate\n\nSpawn agents and wait​ for every result.\n');
        expect(contradictionCandidates(project, REPO_ROOT, home)).toEqual([]);
    });

    it('lines of one rank never pair with each other', () => {
        const src = { label: 'CLAUDE.md', file: '', rank: RANK_PROJECT };
        const lines = extractInstructions(src, 'Spawn agents and wait.\nNever end a turn waiting.\n');
        expect(lines).toHaveLength(2);
        expect(modalityPairs(lines)).toEqual([]);
    });

    it('fences, headings, tables and frontmatter are not instructions', () => {
        const src = { label: 'x', file: '', rank: RANK_NEIGHBOUR_ALWAYS_ON };
        const body = '---\ndescription: always wait\n---\n# Always wait here\n```\nalways wait now\n```\n| always | wait |\nThe agent waits often.\n';
        expect(extractInstructions(src, body)).toEqual([]);
    });
});

describe('the seat contract', () => {
    it('parses one verdict per pair and reads a missing one as unclear', () => {
        expect(parseVerdicts('PAIR 2: compatible\npair 1: Contradiction — x', 3)).toEqual([
            'contradiction',
            'compatible',
            'unclear',
        ]);
    });

    it('the prompt states no expected verdict', () => {
        const p = seatPrompt([], 'rubric');
        expect(p).not.toMatch(/expect|should be clean|confirm/iu);
    });

    it('stems meet a word and its -ing form', () => {
        expect(stem('waiting')).toBe(stem('wait'));
        expect(stem('agents')).toBe('agent');
    });
});
