// Rule 6 of src/scripts/lint_archived_skills.ts — a skill directory that left
// the tree without an archive note.
//
// road-to-skill-link-integrity-and-manifest-sync Phase 1 Step 3. The step named
// `new_skill.ts --archive` as the mechanism; that tool cannot run in this tree
// (it scaffolds into `packages/`, which ADR-051 removed, and its main() returns
// exit 2), so the obligation went to the gate that already owns the ledger. See
// `removed_without_note`'s docstring for the full reasoning.
//
// The third case is the regression test for a real false red this rule shipped
// with for one run: comparing against the TIP of the base branch made every
// skill ADDED on main after the fork read as a deletion.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removed_without_note } from '../../src/scripts/lint_archived_skills.js';

let tmp: string;

function git(args: string[], cwd = tmp): string {
    // GIT_DIR / GIT_WORK_TREE must be DELETED, not blanked — git rejects an
    // empty string outright ("fatal: The empty string is not a valid path").
    // They are inherited inside a git hook, which would point every command
    // below at the real repository instead of the fixture.
    const env = { ...process.env };
    delete env['GIT_DIR'];
    delete env['GIT_WORK_TREE'];
    delete env['RATCHET_BASE_REF'];
    delete env['GITHUB_BASE_REF'];
    delete env['GITHUB_ACTIONS'];
    return execFileSync('git', args, { cwd, encoding: 'utf-8', env });
}

function writeSkill(root: string, slug: string): void {
    const dir = path.join(root, 'src', 'skills', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${slug}\n---\n\n# ${slug}\n`, 'utf-8');
}

/** A repo with `main` carrying `keeper` + `goner`, and a `feat` branch off it. */
function fixtureRepo(): void {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 't']);
    writeSkill(tmp, 'keeper');
    writeSkill(tmp, 'goner');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'base']);
    git(['checkout', '-q', '-b', 'feat']);
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'las-rm-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_archived_skills rule 6 — removed_without_note', () => {
    it('reports a slug this branch removed with no archive note', () => {
        fixtureRepo();
        fs.rmSync(path.join(tmp, 'src', 'skills', 'goner'), { recursive: true });
        git(['add', '-A']);
        git(['commit', '-q', '-m', 'remove goner']);

        const r = removed_without_note(tmp, new Set(), new Set(['keeper']));
        expect(r).toEqual({ removed: ['goner'] });
    });

    it('stays silent when the removed slug carries an archive note', () => {
        fixtureRepo();
        fs.rmSync(path.join(tmp, 'src', 'skills', 'goner'), { recursive: true });
        git(['add', '-A']);
        git(['commit', '-q', '-m', 'remove goner']);

        const r = removed_without_note(tmp, new Set(['goner']), new Set(['keeper']));
        expect(r).toEqual({ removed: [] });
    });

    // The false red. `newcomer` is added on main AFTER the fork, so it is absent
    // from this branch's working tree while present at the tip of main. Against
    // the tip it reads as a removal; against the merge base it does not exist.
    it('does NOT report a skill added on main after the fork', () => {
        fixtureRepo();
        git(['checkout', '-q', 'main']);
        writeSkill(tmp, 'newcomer');
        git(['add', '-A']);
        git(['commit', '-q', '-m', 'add newcomer on main']);
        git(['checkout', '-q', 'feat']);

        expect(fs.existsSync(path.join(tmp, 'src', 'skills', 'newcomer'))).toBe(false);
        const r = removed_without_note(tmp, new Set(), new Set(['keeper', 'goner']));
        expect(r).toEqual({ removed: [] });
    });

    it('skips with a stated reason when no base ref resolves', () => {
        git(['init', '-q', '-b', 'orphan']);
        git(['config', 'user.email', 't@example.com']);
        git(['config', 'user.name', 't']);
        writeSkill(tmp, 'keeper');
        git(['add', '-A']);
        git(['commit', '-q', '-m', 'only commit']);

        const r = removed_without_note(tmp, new Set(), new Set(['keeper']));
        expect(r).toHaveProperty('skipped');
        expect((r as { skipped: string }).skipped).toMatch(/base ref|merge base/);
    });
});
