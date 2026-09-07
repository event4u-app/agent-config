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

import { DEFAULT_SKILLS_DIR } from '../../src/scripts/skill_tools/score_skill_relevance.js';
import { resolveSkillsRoot } from '../../src/scripts/_lib/skill_catalogue.js';

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

describe('resolveSkillsRoot — the AUTHORED tree wins, and an empty root is skipped', () => {
    const claude = (): string => path.join(tmp, '.claude', 'skills');
    const authored = (): string => path.join(tmp, 'src', 'skills');

    it('prefers src/skills even when .claude/skills is POPULATED', () => {
        // The 2026-09-07 regression this pins, and it is not hypothetical. The
        // ADR-236 amendment made `.claude/skills` hold only the ~49 flat-command
        // WRAPPERS — non-empty, and each carries a `SKILL.md`, so the old
        // projection-first order resolved it and nothing downstream could tell it
        // was not the catalogue. Measured: the `skill-route` hook ranked over 49
        // wrappers instead of 299 skills.
        fs.mkdirSync(path.join(claude(), 'some-command-wrapper'), { recursive: true });
        fs.mkdirSync(path.join(authored(), 'a-real-skill'), { recursive: true });
        expect(resolveSkillsRoot(tmp)).toBe(authored());
    });

    it('falls back to .claude/skills when there is no authored tree — the CONSUMER case', () => {
        // A consumer carries the projection and no `src/`. Checking the authored
        // tree first costs them one `existsSync` and must change nothing.
        fs.mkdirSync(path.join(claude(), 'a'), { recursive: true });
        expect(resolveSkillsRoot(tmp)).toBe(claude());
    });

    it('does not accept a directory that exists and holds nothing', () => {
        fs.mkdirSync(claude(), { recursive: true });
        expect(resolveSkillsRoot(tmp)).toBeNull();
    });

    it('skips an EMPTY authored tree and takes the populated projection', () => {
        // The empty guard still earns its place in BOTH directions after the
        // reorder — a maintainer checkout that has an empty `src/skills` must not
        // resolve it and report an empty catalogue as an empty result.
        fs.mkdirSync(authored(), { recursive: true });
        fs.mkdirSync(path.join(claude(), 'a'), { recursive: true });
        expect(resolveSkillsRoot(tmp)).toBe(claude());
    });

    it('is null when no candidate exists at all', () => {
        expect(resolveSkillsRoot(tmp)).toBeNull();
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
