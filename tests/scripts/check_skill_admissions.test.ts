// Tests for src/scripts/check_skill_admissions.ts — the admission and refusal
// ledger that replaces "answer these in the PR body".
//
// Every case is sabotage-then-repair over a real git repo, because the gate's
// forward-only scope is a `git diff` and a fixture without git history would
// exercise a different code path than the one that runs.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    DECISIONS,
    LEDGER_REL,
    REQUIRED_ANSWERS,
    liveSkills,
    readLedger,
    validate,
    type AdmissionRow,
} from '../../src/scripts/check_skill_admissions';

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'src/scripts/check_skill_admissions.ts');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const tmpDirs: string[] = [];

afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}

function write(root: string, rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

const ANSWERS = {
    family: 'engineering-base, alongside the other build-time skills',
    capability: 'reads a lockfile shape no existing skill parses',
    why_not_extend: 'the nearest skill is supply-chain-intake and it owns intake, not parsing',
    why_not_a_guideline: 'it is an executable workflow with a verification step, not reference prose',
    visibility: 'core, in the engineering-base pack',
} as const;

function ledgerLine(row: Partial<AdmissionRow> & { skill: string }): string {
    return `${JSON.stringify({ decision: 'admitted', date: '2026-08-24', ...ANSWERS, ...row })}\n`;
}

/** A git repo with one committed skill and an empty ledger on `main`. */
function initRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skadm-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'a@b.c');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'src/skills/existing/SKILL.md', '---\nname: existing\ndescription: Pre-existing.\n---\n');
    write(dir, LEDGER_REL, '{"_comment":"fixture ledger"}\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    git(dir, 'checkout', '-qb', 'feat/change');
    return dir;
}

function run(cwd: string, args: string[] = ['--base', 'main']): SpawnSyncReturns<string> {
    // `--root` as well as cwd: the script resolves its own repo root from its
    // file location, so cwd alone would have every case reading the live tree.
    return spawnSync(TSX, [SCRIPT, '--root', cwd, ...args], { cwd, encoding: 'utf8' });
}

function addSkill(dir: string, name: string): void {
    write(dir, `src/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: New.\n---\n`);
}

describe('a new skill needs a row, and the row needs answers', () => {
    it('is green when nothing was added', () => {
        const repo = initRepo();
        expect(run(repo).status).toBe(0);
    });

    it('FAILS on an added skill with no row', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'add');
        const r = run(repo);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('fresh [missing_row]');
        expect(r.stderr).toContain('not in the PR body');
    });

    it('greens once the row lands — the repair half', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'add');
        expect(run(repo).status).toBe(1);
        fs.appendFileSync(path.join(repo, LEDGER_REL), ledgerLine({ skill: 'fresh' }));
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'ledger');
        expect(run(repo).status).toBe(0);
    });

    it('FAILS on a one-word answer — boilerplate is not an answer', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        fs.appendFileSync(path.join(repo, LEDGER_REL), ledgerLine({ skill: 'fresh', family: 'eng' }));
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'thin row');
        const r = run(repo);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('incomplete_row');
        expect(r.stderr).toContain('family');
    });

    it('names every blank field at once rather than one per run', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        fs.appendFileSync(
            path.join(repo, LEDGER_REL),
            `${JSON.stringify({ skill: 'fresh', decision: 'admitted', date: '2026-08-24' })}\n`,
        );
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'bare row');
        const r = run(repo);
        for (const k of REQUIRED_ANSWERS) expect(r.stderr).toContain(k);
    });
});

describe('a refusal is a first-class state, and it must stay a refusal', () => {
    it('FAILS when a rejected row names a skill that exists', () => {
        // The record would otherwise say a capability was refused while it ships.
        const repo = initRepo();
        fs.appendFileSync(
            path.join(repo, LEDGER_REL),
            `${JSON.stringify({ skill: 'existing', decision: 'rejected', date: '2026-08-24', instead: 'folded into a sibling' })}\n`,
        );
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'contradictory refusal');
        const r = run(repo);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('rejected_but_present');
    });

    it('accepts a rejected row for a skill that does NOT exist', () => {
        const repo = initRepo();
        fs.appendFileSync(
            path.join(repo, LEDGER_REL),
            `${JSON.stringify({ skill: 'never-built', decision: 'rejected', date: '2026-08-24', instead: 'extend supply-chain-intake' })}\n`,
        );
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'a visible no');
        expect(run(repo).status).toBe(0);
    });

    it('a rejected row needs no five answers — it is not an admission', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        fs.appendFileSync(
            path.join(repo, LEDGER_REL),
            `${JSON.stringify({ skill: 'fresh', decision: 'rejected', date: '2026-08-24' })}\n`,
        );
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'rejected but present');
        // Caught as rejected_but_present, NOT as incomplete_row — the two
        // findings must not be confused, or a refusal would be asked for
        // admission answers.
        const r = run(repo);
        expect(r.stderr).toContain('rejected_but_present');
        expect(r.stderr).not.toContain('incomplete_row');
    });
});

describe('the ledger is the corpus, so a broken one is a hard error', () => {
    it('a missing ledger is exit 2, never a clean run', () => {
        const repo = initRepo();
        fs.rmSync(path.join(repo, LEDGER_REL));
        expect(run(repo).status).toBe(2);
    });

    it('a malformed line is exit 2, never a neutral skip', () => {
        const repo = initRepo();
        fs.appendFileSync(path.join(repo, LEDGER_REL), 'not json at all\n');
        const r = run(repo);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('not valid JSON');
    });

    it('an empty ledger with nothing added is GREEN, and that is the shipped state', () => {
        // The allowEmpty this gate declares: 299 skills are grandfathered by the
        // forward-only diff scope, so the first row arrives with the first new
        // skill. Distinct from the two cases above, which is the whole point.
        const repo = initRepo();
        expect(run(repo).status).toBe(0);
    });

    it('two rows for one skill is a finding — a ledger with two answers has none', () => {
        const repo = initRepo();
        addSkill(repo, 'fresh');
        fs.appendFileSync(path.join(repo, LEDGER_REL), ledgerLine({ skill: 'fresh' }));
        fs.appendFileSync(path.join(repo, LEDGER_REL), ledgerLine({ skill: 'fresh' }));
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'two rows');
        expect(run(repo).stderr).toContain('duplicate_row');
    });

    it('an unknown decision value is a finding, not a silent pass', () => {
        const repo = initRepo();
        fs.appendFileSync(
            path.join(repo, LEDGER_REL),
            `${JSON.stringify({ skill: 'whatever', decision: 'maybe', date: '2026-08-24' })}\n`,
        );
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'bad decision');
        expect(run(repo).stderr).toContain('bad_decision');
    });
});

describe('the live tree', () => {
    it('the shipped ledger parses, and every row it carries is well-formed', () => {
        // REWRITTEN 2026-08-25. This used to assert `readLedger(REPO)` equals
        // `[]`, which was true the day it was written and pinned a TRANSIENT
        // state as if it were an invariant: the ledger's whole purpose is to
        // accumulate rows, so the first one broke a test that was supposed to
        // guard the reader, not the count. It went red on the change that added
        // the first genuine `rejected` row.
        //
        // What is actually invariant: the file parses, bookkeeping lines are
        // ignored, and every real row carries a known decision. Asserted here;
        // the per-row admission requirements are asserted against fixtures
        // above, where a change to the live ledger cannot reach them.
        const rows = readLedger(REPO);
        for (const r of rows) {
            expect(typeof r.skill, 'every row names a skill').toBe('string');
            expect(r.skill.length).toBeGreaterThan(0);
            expect(DECISIONS, `${r.skill} carries an unknown decision`).toContain(r.decision);
        }
    });

    it('validate() is silent on the shipped ledger — it must never red on main', () => {
        // The consequence a snapshot assertion could not express: whatever the
        // ledger accumulates, the gate stays green on the live tree unless a
        // real defect lands. A rejected row naming a skill that EXISTS would
        // fail here, which is the one live-tree contradiction worth catching.
        expect(validate(readLedger(REPO), liveSkills(REPO), [])).toEqual([]);
    });

    it('reads 299 live skills, matching the estate metric', () => {
        expect(liveSkills(REPO).size).toBe(299);
    });

    it('DECISIONS is exactly admitted | rejected', () => {
        expect([...DECISIONS]).toEqual(['admitted', 'rejected']);
    });

    it('validate() is silent on an empty ledger with an empty added set', () => {
        expect(validate([], liveSkills(REPO), [])).toEqual([]);
    });
});
