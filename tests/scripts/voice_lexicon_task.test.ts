// The opt-in persisted-prose target (road-to-a-brand-the-tree-can-check 5.6):
// `task voice-lexicon` runs `check_voice_lexicon` over this branch's PR
// title/body and its commit messages — the prose an agent writes that LANDS,
// as opposed to the drafts 5.4 checks before they are sent.
//
// The target's command block is not asserted as text and then trusted: it is
// EXTRACTED from `taskfiles/content.yml` and EXECUTED verbatim in a scratch git
// repository with a stubbed `gh`, so the test fails when the composition stops
// working, not only when the words change.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CONTENT_TASKFILE = path.join(REPO_ROOT, 'taskfiles', 'content.yml');
const TARGET = 'voice-lexicon';

/** The slot the target reads, relative to the project root it runs in. */
const SLOT_REL = path.join('agents', 'context-spine', 'brand-voice.md');

const SLOT = [
    '---',
    'version: 1',
    'attributes:',
    '  - { is: warm, is_not: gushing, proof: "thanks once" }',
    '  - { is: precise, is_not: pedantic, proof: "units" }',
    '  - { is: direct, is_not: curt, proof: "answer first" }',
    'avoid:',
    '  - { term: "game-changer", match: word, note: "say what changed" }',
    '  - { term: "synergy", match: word }',
    'provenance:',
    '  confidence: med',
    '  last_reviewed_at: 2026-10-19',
    '  sources:',
    '    - { ref: "docs/contracts/brand-token-consumption.md", tier: authoritative }',
    '---',
    '# Voice',
    '',
    'Prose body.',
    '',
].join('\n');

interface TaskDef {
    desc?: string;
    cmds?: unknown[];
    cmd?: unknown;
}

function taskfile(): { tasks?: Record<string, TaskDef> } {
    return parseYaml(fs.readFileSync(CONTENT_TASKFILE, 'utf-8')) as { tasks?: Record<string, TaskDef> };
}

/** Every shell line the target runs, joined — the thing the behaviour cases execute. */
function targetScript(): string {
    const def = taskfile().tasks?.[TARGET];
    if (def === undefined) throw new Error(`taskfiles/content.yml has no '${TARGET}' task`);
    const parts = def.cmd !== undefined ? [def.cmd] : (def.cmds ?? []);
    const shell = parts.filter((c): c is string => typeof c === 'string');
    if (shell.length === 0) throw new Error(`'${TARGET}' carries no shell command`);
    return shell.join('\n');
}

let scratch = '';

function sh(cmd: string, cwd: string, env: NodeJS.ProcessEnv = {}): { status: number; out: string } {
    const r = spawnSync('bash', ['-c', cmd], {
        cwd,
        encoding: 'utf-8',
        env: { ...process.env, ...env },
    });
    return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * A project the target can run in: a git repository with an `origin/main` ref,
 * a `./scripts-run` that reaches the real one, and a `gh` stub on PATH.
 */
function project(opts: {
    prBody?: string | null;
    commitMessage: string;
    slot?: boolean;
}): { dir: string; env: NodeJS.ProcessEnv } {
    const dir = fs.mkdtempSync(path.join(scratch, 'proj-'));
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);

    fs.writeFileSync(
        path.join(dir, 'scripts-run'),
        `#!/usr/bin/env bash\nexec ${JSON.stringify(path.join(REPO_ROOT, 'scripts-run'))} "$@"\n`,
        { mode: 0o755 },
    );
    if (opts.prBody !== null && opts.prBody !== undefined) {
        // The target pipes `gh pr view --json … --jq …` straight through, so the
        // stub prints what the real jq expression would have produced.
        fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\ncat <<'PRBODY'\n${opts.prBody}\nPRBODY\n`, {
            mode: 0o755,
        });
    }
    if (opts.slot !== false) {
        fs.mkdirSync(path.join(dir, path.dirname(SLOT_REL)), { recursive: true });
        fs.writeFileSync(path.join(dir, SLOT_REL), SLOT);
    }

    const git = (args: string) =>
        spawnSync('bash', ['-c', `git ${args}`], {
            cwd: dir,
            encoding: 'utf-8',
            env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e' },
        });
    git('init -q -b main');
    fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
    git('add base.txt');
    git("commit -q -m 'base commit'");
    git('update-ref refs/remotes/origin/main HEAD');
    fs.writeFileSync(path.join(dir, 'work.txt'), 'work\n');
    fs.writeFileSync(path.join(dir, '.msg'), opts.commitMessage);
    git('add work.txt');
    git('commit -q --file=.msg');
    fs.rmSync(path.join(dir, '.msg'));

    const sep = process.platform === 'win32' ? ';' : ':';
    return { dir, env: { PATH: `${bin}${sep}${process.env.PATH ?? ''}` } };
}

beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-lexicon-task-'));
});
afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
});

describe('persisted-prose', () => {
    it('declares an opt-in target that names its two sources and the checker', () => {
        const def = taskfile().tasks?.[TARGET];
        expect(def, `taskfiles/content.yml must define '${TARGET}'`).toBeDefined();
        const script = targetScript();
        expect(script).toMatch(/check_voice_lexicon/);
        // Both halves of "persisted prose": the PR text and the branch commits.
        expect(script).toMatch(/gh pr view/);
        expect(script).toMatch(/git log/);
        expect(def?.desc ?? '').toMatch(/opt-in/i);
    });

    it('reports an avoid term in a branch commit message and in the PR body', () => {
        const { dir, env } = project({
            prBody: '# Add the importer\n\nThis unlocks real synergy for the team.',
            commitMessage: 'feat(import): a game-changer for CSV handling\n',
        });
        const r = sh(targetScript(), dir, env);
        expect(r.out).toMatch(/warning avoid "game-changer"/);
        expect(r.out).toMatch(/warning avoid "synergy"/);
        // Brand findings flag and never block (5.4's stated design).
        expect(r.status).toBe(0);
    });

    it('is silent on prose carrying no avoid term', () => {
        const { dir, env } = project({
            prBody: '# Add the importer\n\nCSV import is twice as fast.',
            commitMessage: 'feat(import): read the header row before the body\n',
        });
        const r = sh(targetScript(), dir, env);
        expect(r.out).toMatch(/no lexicon or claim findings/);
        expect(r.out).not.toMatch(/avoid "/);
    });

    it('still checks the commit messages when gh is unavailable', () => {
        const { dir, env } = project({
            prBody: null,
            commitMessage: 'chore: drop the synergy wording from the readme\n',
        });
        const r = sh(targetScript(), dir, env);
        expect(r.out).toMatch(/warning avoid "synergy"/);
    });

    it('reports SKIPPED rather than a green nothing when no lexicon is reachable', () => {
        const { dir, env } = project({
            prBody: null,
            commitMessage: 'feat: a game-changer release\n',
            slot: false,
        });
        const r = sh(targetScript(), dir, env);
        expect(r.out).toMatch(/lexicon: SKIPPED/);
        expect(r.out).not.toMatch(/avoid "game-changer"/);
    });

    it('says there is nothing to check when the branch carries no persisted prose', () => {
        // A branch level with origin/main and no PR yet is the ordinary state at
        // the start of a change, not an unusable invocation: the checker's
        // empty-draft exit 2 must not surface as a failure here.
        const { dir, env } = project({ prBody: null, commitMessage: 'feat: a game-changer release\n' });
        spawnSync('bash', ['-c', 'git update-ref refs/remotes/origin/main HEAD'], { cwd: dir, encoding: 'utf-8' });
        const r = sh(targetScript(), dir, env);
        expect(r.out).toMatch(/no persisted prose/i);
        expect(r.status).toBe(0);
    });

    it('is referenced by no CI aggregate target and no workflow', () => {
        const roots = [path.join(REPO_ROOT, 'Taskfile.yml'), path.join(REPO_ROOT, '.github', 'workflows')];
        const files: string[] = [];
        for (const root of roots) {
            if (!fs.existsSync(root)) continue;
            if (fs.statSync(root).isDirectory()) {
                for (const f of fs.readdirSync(root)) if (/\.ya?ml$/.test(f)) files.push(path.join(root, f));
            } else files.push(root);
        }
        for (const f of fs.readdirSync(path.join(REPO_ROOT, 'taskfiles'))) {
            if (/\.ya?ml$/.test(f) && f !== 'content.yml') files.push(path.join(REPO_ROOT, 'taskfiles', f));
        }
        const citing = files.filter((f) => fs.readFileSync(f, 'utf-8').includes(TARGET));
        expect(citing.map((f) => path.relative(REPO_ROOT, f))).toEqual([]);
    });
});
