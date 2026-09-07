/**
 * The skill ranker distinguishes an empty RESULT from an unread CATALOGUE.
 *
 * `road-to-inbox-harvest-2026-08-f-skill-selection-evidence` 1.3. The defect
 * survived because nothing looked: `DEFAULT_SKILLS_DIR` pointed at a directory
 * that had been moved away, and the CLI answered `(no relevant skills found)`
 * with exit 0 — indistinguishable from a task that genuinely matches nothing.
 *
 * THREE states are pinned, not two. The middle one is what actually bit:
 * `.claude/skills` is a gitignored projection, so a fresh worktree has a root
 * that EXISTS and is EMPTY, and an empty directory is not a missing one.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SKILLS_DIR, rank } from '../../src/scripts/skill_tools/score_skill_relevance.js';
import {
    resolveSkillCatalogueRoots,
    resolveSkillsRoot,
} from '../../src/scripts/_lib/skill_catalogue.js';

const REPO = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const CLI = path.join(REPO, 'src', 'scripts', 'skill_tools', 'score_skill_relevance.ts');

const run = (args: readonly string[]): { code: number; out: string; err: string } => {
    const r = spawnSync(TSX, [CLI, ...args], { cwd: REPO, encoding: 'utf8' });
    return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
};

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-cat-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the default root', () => {
    it('resolves to a directory that EXISTS in this repository', () => {
        // The regression this pins: the default used to name a path that had
        // been moved away, and nothing in the tree noticed.
        expect(DEFAULT_SKILLS_DIR).not.toBeNull();
        expect(fs.existsSync(DEFAULT_SKILLS_DIR as string)).toBe(true);
    });

    it('ranks real rows with no directory flag at all', () => {
        const r = run(['--task', 'review a pull request', '--top', '3']);
        expect(r.code).toBe(0);
        expect(r.out).not.toContain('no relevant skills found');
        expect(r.out).toMatch(/\d+\s+\S+/);
    });
});

describe('resolveSkillCatalogueRoots — the UNION, in precedence order', () => {
    // A fixture HOME is not hygiene here, it is the subject: the resolver reads
    // `~/.claude/skills` as a real candidate since 2026-09-07, so a test that let
    // it see the developer's own home asserted whatever that machine installed.
    const claude = (): string => path.join(tmp, 'ws', '.claude', 'skills');
    const authored = (): string => path.join(tmp, 'ws', 'src', 'skills');
    const hostLayer = (): string => path.join(tmp, 'home', '.claude', 'skills');
    const ws = (): string => path.join(tmp, 'ws');
    const home = (): string => path.join(tmp, 'home');
    const skill = (root: string, name: string): void => {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.writeFileSync(path.join(root, name, 'SKILL.md'), `---\nname: ${name}\n---\nbody\n`, 'utf-8');
    };

    it('reads EVERY readable root, authored first, host layer last', () => {
        // The defect this replaced: first-hit-wins ranked one tree and reported it
        // as the catalogue. A consumer can carry its own skills in the project
        // layer while the shipped set sits in the host layer, and an answer over
        // either half alone is partial without saying so.
        skill(authored(), 'a');
        skill(claude(), 'b');
        skill(hostLayer(), 'c');
        expect(resolveSkillCatalogueRoots(ws(), home())).toEqual([
            authored(),
            claude(),
            hostLayer(),
        ]);
    });

    it('skips an EMPTY root and keeps the order of the rest', () => {
        // The empty guard has its own job, unchanged: an empty root read as a
        // match made the ranker report an empty catalogue as an empty RESULT.
        fs.mkdirSync(authored(), { recursive: true });
        skill(claude(), 'b');
        skill(hostLayer(), 'c');
        expect(resolveSkillCatalogueRoots(ws(), home())).toEqual([claude(), hostLayer()]);
    });

    it('is the project roots only when the host layer is absent', () => {
        skill(authored(), 'a');
        expect(resolveSkillCatalogueRoots(ws(), home())).toEqual([authored()]);
    });

    it('never lists one directory twice when the workspace IS the home', () => {
        // `<home>/.claude/skills` would otherwise appear as both the project and
        // the host candidate, and every skill in it would be ranked twice.
        skill(path.join(tmp, 'home', '.claude', 'skills'), 'a');
        expect(resolveSkillCatalogueRoots(home(), home())).toEqual([hostLayer()]);
    });

    it('is EMPTY when no candidate exists at all, and resolveSkillsRoot is null', () => {
        expect(resolveSkillCatalogueRoots(ws(), home())).toEqual([]);
        expect(resolveSkillsRoot(ws(), home())).toBeNull();
    });

    it('resolveSkillsRoot is the FIRST root, not a second resolver', () => {
        skill(claude(), 'b');
        skill(hostLayer(), 'c');
        expect(resolveSkillsRoot(ws(), home())).toBe(claude());
    });
});

describe('rank across roots — precedence resolves a name collision', () => {
    const mk = (root: string, name: string, desc: string): void => {
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.writeFileSync(
            path.join(root, name, 'SKILL.md'),
            `---\nname: ${name}\ndescription: ${desc}\n---\nbody\n`,
            'utf-8',
        );
    };

    it('ranks the union, and one name appears exactly ONCE', () => {
        const first = path.join(tmp, 'r1');
        const second = path.join(tmp, 'r2');
        mk(first, 'shared', 'merge conflict resolution');
        mk(second, 'shared', 'merge conflict resolution');
        mk(second, 'only-there', 'merge conflict resolution');
        const rows = rank('merge conflict resolution', [first, second]);
        expect(rows.map(([n]) => n).sort()).toEqual(['only-there', 'shared']);
    });

    it('the EARLIEST root wins a name collision — asserted by score, not by name', () => {
        // Corrected 2026-09-07 after a neutral review: the test above gives both
        // copies of `shared` the same description, so which root won is invisible
        // and the first-occurrence-wins property was untested. Here the two copies
        // score differently, so the winning root is observable.
        const first = path.join(tmp, 'p1');
        const second = path.join(tmp, 'p2');
        mk(first, 'shared', 'merge conflict resolution');
        mk(second, 'shared', 'totally unrelated subject matter');
        const won = rank('merge conflict resolution', [first, second]);
        const lost = rank('merge conflict resolution', [second, first]);
        expect(won).toHaveLength(1);
        // First root carries the matching description -> it scores; reversed, the
        // non-matching copy wins the name and scores 0, so it drops out entirely.
        expect(won[0]?.[1]).toBeGreaterThan(0);
        expect(lost).toEqual([]);
    });

    it('a single string root still works — the old signature is untouched', () => {
        const first = path.join(tmp, 'r1');
        mk(first, 'solo', 'merge conflict resolution');
        expect(rank('merge conflict resolution', first).map(([n]) => n)).toEqual(['solo']);
    });
});

describe('the three outcomes are distinguishable at the CLI', () => {
    it('a real root with a nonsense task is an EMPTY RESULT, exit 0', () => {
        const r = run(['--task', 'zzzz qqqq wwww', '--skills-dir', 'src/skills']);
        expect(r.code).toBe(0);
        expect(r.out).toContain('no relevant skills found');
    });

    it('a MISSING root is an unread catalogue, exit 3', () => {
        const r = run(['--task', 'anything', '--skills-dir', path.join(tmp, 'nope')]);
        expect(r.code).toBe(3);
        expect(r.err).toContain('is not a directory');
        expect(r.err).toContain('NOT "no skill matches"');
    });

    it('an EMPTY root is an unread catalogue too, and says which', () => {
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        const r = run(['--task', 'anything', '--skills-dir', empty]);
        expect(r.code).toBe(3);
        expect(r.err).toContain('exists and is EMPTY');
    });

    it('--json carries a machine-readable status rather than an empty ranking', () => {
        const r = run(['--task', 'anything', '--skills-dir', path.join(tmp, 'nope'), '--json']);
        expect(r.code).toBe(3);
        const payload = JSON.parse(r.out) as { status?: string; ranked?: unknown[] };
        expect(payload.status).toBe('no_catalogue');
        expect(payload.ranked).toBeUndefined();
    });
});
