/**
 * `permissionDecision` emission and its composition policy.
 *
 * The dispatcher built exactly one envelope shape, so a call this package does
 * not gate at all still cost the user a host confirmation. The field that
 * removes that prompt is offered by the host — probed 2026-09-06 against Claude
 * Code 2.1.263, whose own strings read `` `permissionDecision` - "allow",
 * "deny", or "ask" (PreToolUse only) `` — and was emitted by nothing.
 *
 * The reason it stayed unemitted was not the field but the composition
 * question: a dispatcher that reduces many concerns to one exit code has to say
 * what happens when they disagree. `composePermissionDecision` answers it —
 * ONE `ask` OR `deny` BEATS EVERY `allow` — and the first describe block below
 * is the test that goes red the moment an `allow` is allowed to outrank a
 * `deny`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    claudePermissionDecision,
    composePermissionDecision,
    emitFor,
} from '../../src/scripts/hooks/host_semantics.js';
import {
    isCategoryA,
    isCategoryABashCommand,
    isInsideWorkingTree,
    namesConsequenceOperation,
} from '../../src/scripts/hooks/category_a.js';
import {
    _concern_permission_verdict,
    _permission_for,
    _working_tree_root,
} from '../../src/scripts/hooks/dispatch_hook.js';

const ROOT = '/repo';

function envelope(tool_name: string, tool_input: Record<string, unknown>, cwd = ROOT) {
    return { payload: { tool_name, tool_input, cwd }, workspace_root: ROOT };
}

describe('composition — one ask or deny beats every allow', () => {
    it('a single deny outranks any number of allows', () => {
        expect(composePermissionDecision(['allow', 'allow', 'deny', 'allow'])).toBe('deny');
    });

    it('a single ask outranks any number of allows', () => {
        expect(composePermissionDecision(['allow', 'ask', 'allow'])).toBe('ask');
    });

    it('deny outranks ask', () => {
        expect(composePermissionDecision(['ask', 'deny'])).toBe('deny');
    });

    it('allow only when every verdict is an allow', () => {
        expect(composePermissionDecision(['allow', 'allow'])).toBe('allow');
    });

    it('no verdicts is not an allow — it is no field at all', () => {
        // Distinct from 'allow' on purpose: an absent field leaves the host's
        // own permission machinery in charge, an allow asserts this package
        // looked and had nothing to stop.
        expect(composePermissionDecision([])).toBeNull();
    });
});

describe('a concern states its verdict', () => {
    it('an exit-1 block is a deny', () => {
        expect(_concern_permission_verdict(1, {})).toBe('deny');
    });

    it('an advisory concern may ask without blocking', () => {
        // EXIT_ALLOW with {"decision":"ask"} — recorded in the feedback file
        // since v1 and read by nothing until now.
        expect(_concern_permission_verdict(0, { decision: 'ask' })).toBe('ask');
    });

    it('a warn is not an ask', () => {
        expect(_concern_permission_verdict(2, {})).toBe('allow');
    });

    it('silence abstains', () => {
        expect(_concern_permission_verdict(0, {})).toBe('allow');
    });
});

describe('_permission_for — four gates, each sufficient to withhold', () => {
    const READ = envelope('Read', { file_path: '/repo/src/a.ts' });

    it('emits an allow when all four hold', () => {
        const p = _permission_for('pre_tool_use', READ, 0, ['allow']);
        expect(p?.decision).toBe('allow');
    });

    it('withholds when a concern denied', () => {
        expect(_permission_for('pre_tool_use', READ, 0, ['allow', 'deny'])).toBeNull();
    });

    it('withholds when a concern asked', () => {
        expect(_permission_for('pre_tool_use', READ, 0, ['allow', 'ask'])).toBeNull();
    });

    it('withholds when the reduced severity is not allow', () => {
        expect(_permission_for('pre_tool_use', READ, 2, ['allow'])).toBeNull();
    });

    it('withholds on any event but pre_tool_use', () => {
        expect(_permission_for('post_tool_use', READ, 0, ['allow'])).toBeNull();
    });

    it('withholds for a call that is not category A', () => {
        const write = envelope('Write', { file_path: '/repo/src/a.ts' });
        expect(_permission_for('pre_tool_use', write, 0, ['allow'])).toBeNull();
    });

    it('withholds when no concern voted', () => {
        expect(_permission_for('pre_tool_use', READ, 0, [])).toBeNull();
    });
});

describe('emitFor carries the field only on the allow path', () => {
    const PERMISSION = { decision: 'allow' as const, reason: 'category-A Read' };

    it('an allow on pre_tool_use emits the permission envelope at exit 0', () => {
        const e = emitFor('claude', 'pre_tool_use', 'allow', [], 0, PERMISSION);
        expect(e.exit).toBe(0);
        expect(e.stdout).toBe(claudePermissionDecision('pre_tool_use', 'allow', 'category-A Read'));
        const parsed = JSON.parse(e.stdout);
        expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
        expect(parsed.hookSpecificOutput.permissionDecision).toBe('allow');
        expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('category-A');
    });

    it('the field never rides on a block — exit 2 discards stdout anyway', () => {
        const e = emitFor('claude', 'pre_tool_use', 'block', ['nope'], 1, PERMISSION);
        expect(e.exit).toBe(2);
        expect(e.stdout).toBe('');
    });

    it('the field never rides on a warn — the advisory context stands', () => {
        const e = emitFor('claude', 'pre_tool_use', 'warn', ['heads up'], 2, PERMISSION);
        expect(e.stdout).toContain('additionalContext');
        expect(e.stdout).not.toContain('permissionDecision');
    });

    it('the host documents the field as PreToolUse only, so no other event gets it', () => {
        const e = emitFor('claude', 'post_tool_use', 'allow', [], 0, PERMISSION);
        expect(e.stdout).toBe('');
    });

    it('an unverified platform is unchanged, byte for byte', () => {
        const e = emitFor('cursor', 'pre_tool_use', 'allow', [], 0, PERMISSION);
        expect(e).toEqual({ exit: 0, stdout: '', stderr: '' });
    });

    it('omitting the argument reproduces the pre-change emission', () => {
        expect(emitFor('claude', 'pre_tool_use', 'allow', [], 0)).toEqual({
            exit: 0,
            stdout: '',
            stderr: '',
        });
    });
});

describe('category A is an allowlist', () => {
    it('read tools inside the tree qualify', () => {
        expect(isCategoryA('Read', { file_path: 'src/a.ts' }, ROOT)).toBe(true);
        expect(isCategoryA('Grep', { pattern: 'x', path: '/repo/src' }, ROOT)).toBe(true);
    });

    it('a read that escapes the tree does not', () => {
        expect(isCategoryA('Read', { file_path: '/etc/passwd' }, ROOT)).toBe(false);
        expect(isCategoryA('Read', { file_path: '../../secrets' }, ROOT)).toBe(false);
    });

    it('a write tool never qualifies, however innocent its target', () => {
        expect(isCategoryA('Write', { file_path: 'src/a.ts' }, ROOT)).toBe(false);
        expect(isCategoryA('Edit', { file_path: 'src/a.ts' }, ROOT)).toBe(false);
    });

    it('network tools never qualify — egress is not a read', () => {
        expect(isCategoryA('WebFetch', { url: 'https://example.com' }, ROOT)).toBe(false);
    });

    it('an unestablished working tree disqualifies everything', () => {
        expect(isCategoryA('Read', { file_path: 'src/a.ts' }, '')).toBe(false);
    });

    it('an unknown tool is not category A', () => {
        expect(isCategoryA('SomeFutureTool', {}, ROOT)).toBe(false);
    });
});

describe('category A over Bash commands', () => {
    it('admits reads, navigation, build, test and lint', () => {
        for (const cmd of [
            'ls src',
            'cat package.json',
            'grep -rn foo src',
            'git status',
            'git log --oneline -5',
            'git diff',
            'tsc --noEmit',
            'eslint src',
            'vitest run',
            'pytest -q',
            'npm test',
            'npm run lint',
            'cargo check',
            'go test ./...',
        ]) {
            expect(isCategoryABashCommand(cmd), cmd).toBe(true);
        }
    });

    it('refuses every consequence operation', () => {
        for (const cmd of [
            'git push',
            'git reset --hard HEAD~1',
            'rm -rf build',
            'npm publish',
            'npm run deploy',
            'curl https://example.com',
            'terraform apply',
            'kubectl apply -f x.yaml',
            'docker build .',
        ]) {
            expect(isCategoryABashCommand(cmd), cmd).toBe(false);
        }
    });

    it('refuses any compound or redirecting shape outright', () => {
        // The whole point: a safe head token must not be able to carry a
        // second command. No shell parsing, no exceptions.
        for (const cmd of [
            'ls && rm -rf /',
            'cat a.txt; git push',
            'ls | xargs rm',
            'echo $(git push)',
            'ls > /etc/hosts',
            'ls `git push`',
            'cd /tmp && ls',
        ]) {
            expect(isCategoryABashCommand(cmd), cmd).toBe(false);
        }
    });

    it('refuses an interpreter, whose named operation is "run this program"', () => {
        expect(isCategoryABashCommand('node script.js')).toBe(false);
        expect(isCategoryABashCommand('python scary.py')).toBe(false);
        expect(isCategoryABashCommand('sh setup.sh')).toBe(false);
    });

    it('refuses a run-script whose name is not itself a build/test/lint word', () => {
        expect(isCategoryABashCommand('npm run start')).toBe(false);
        expect(isCategoryABashCommand('npm run release')).toBe(false);
        expect(isCategoryABashCommand('npm run build')).toBe(true);
    });

    it('sees a consequence word hidden behind a namespace separator', () => {
        expect(namesConsequenceOperation('npm run db:seed')).toBe(true);
        expect(namesConsequenceOperation('task deploy:prod')).toBe(true);
    });

    it('does not refuse a safe command for merely containing the letters', () => {
        // A substring test would refuse `git log --format=…` for containing
        // `mat`; a classifier that refuses everything is indistinguishable
        // from one that was never wired.
        expect(namesConsequenceOperation('git log --format=short')).toBe(false);
        expect(isCategoryABashCommand('git log --format=short')).toBe(true);
    });

    it('parses git global options so the directory-flag form qualifies', () => {
        // The shape the canon teaches in place of `cd X && …`. Found missing by
        // the friction corpus on its first run: `_firstSubcommand` resolved
        // `git -C sub status` to `sub`, so the replacement shape cost exactly
        // as many confirmations as the shape it replaced.
        expect(isCategoryABashCommand('git -C sub status')).toBe(true);
        expect(isCategoryABashCommand('git -C sub log --oneline')).toBe(true);
        expect(isCategoryABashCommand('git --git-dir=sub/.git status')).toBe(true);
        expect(isCategoryABashCommand('git -c core.pager=cat diff')).toBe(true);
    });

    it('refuses a directory flag whose value escapes the working tree', () => {
        expect(isCategoryABashCommand('git -C /etc status')).toBe(false);
        expect(isCategoryABashCommand('git -C ../../other status')).toBe(false);
        expect(isCategoryABashCommand('git --git-dir=/other/.git log')).toBe(false);
    });

    it('a directory flag does not smuggle a consequential subcommand through', () => {
        expect(isCategoryABashCommand('git -C sub push')).toBe(false);
        expect(isCategoryABashCommand('git -C sub reset --hard')).toBe(false);
    });

    it('an empty command is not category A', () => {
        expect(isCategoryABashCommand('')).toBe(false);
        expect(isCategoryABashCommand('   ')).toBe(false);
    });
});

describe('working-tree confinement', () => {
    it('accepts the root itself and anything under it', () => {
        expect(isInsideWorkingTree('/repo', ROOT)).toBe(true);
        expect(isInsideWorkingTree('src/a.ts', ROOT)).toBe(true);
        expect(isInsideWorkingTree('/repo/src/a.ts', ROOT)).toBe(true);
    });

    it('rejects an escape by traversal or by absolute path', () => {
        expect(isInsideWorkingTree('../outside', ROOT)).toBe(false);
        expect(isInsideWorkingTree('/etc/passwd', ROOT)).toBe(false);
        expect(isInsideWorkingTree('src/../../outside', ROOT)).toBe(false);
        expect(isInsideWorkingTree('..', ROOT)).toBe(false);
    });

    it('a name that merely starts with two dots is inside', () => {
        // `go test ./...` resolves to `<root>/...`; a prefix test on `..`
        // read that as an escape.
        expect(isInsideWorkingTree('./...', ROOT)).toBe(true);
        expect(isInsideWorkingTree('..cache/x', ROOT)).toBe(true);
    });

    it('an empty root confines nothing and therefore admits nothing', () => {
        expect(isInsideWorkingTree('src/a.ts', '')).toBe(false);
    });
});

describe('the confinement root is the host cwd, not the dispatcher process cwd', () => {
    it('prefers the payload cwd', () => {
        // In a worktree the dispatcher's own cwd is the parent checkout, so
        // confining against it would admit a path outside the tree the call
        // actually runs in.
        expect(_working_tree_root({ payload: { cwd: '/wt' }, workspace_root: '/repo' })).toBe('/wt');
    });

    it('falls back to the workspace root when the host sends no cwd', () => {
        expect(_working_tree_root({ payload: {}, workspace_root: '/repo' })).toBe('/repo');
    });
});

/*
 * Phase 0 of road-to-a-hard-floor-the-shell-cannot-talk-past: category A stops
 * granting what it cannot prove. Every D2 row below was executed through
 * `_permission_for` on main@17f028941 and came back `allow`.
 */
describe('category A withdraws only what it cannot prove (Phase 0)', () => {
    const bash = (command: string) => envelope('Bash', { command });
    const allowOf = (command: string) => _permission_for('pre_tool_use', bash(command), 0, ['allow']);
    const a = (command: string) => isCategoryA('Bash', { command }, ROOT);

    it('branch-loses-a-ref: a branch form that can lose a ref is not category A', () => {
        for (const cmd of [
            'git branch -d topic',
            'git branch -D main',
            'git branch --delete topic',
            'git branch -f main HEAD~20',
            'git branch --force main HEAD~20',
            'git branch -M main old',
            'git branch -C main old',
            'git branch -m main old',
            'git branch --move main old',
            'git branch -Dr origin/x',
            'git -C sub branch -D main',
        ]) {
            expect(a(cmd), cmd).toBe(false);
        }
    });

    it('branch-loses-a-ref: only observational branch forms stay category A', () => {
        // Council review 2026-10-18: a form that writes a ref without losing
        // one is still not a read, so the allowlist admits observation only.
        for (const cmd of [
            'git branch new',
            'git branch new HEAD~3',
            'git branch -c main copy',
            'git branch --copy main copy',
            'git branch -u origin/main',
            'git branch --set-upstream-to=origin/main',
            'git branch --unset-upstream',
            'git branch --edit-description',
            'git branch -t topic origin/x',
        ]) {
            expect(a(cmd), cmd).toBe(false);
        }
        for (const cmd of [
            'git branch',
            'git branch -a',
            'git branch -av',
            'git branch -vv',
            'git branch --list',
            "git branch --list 'feat*'",
            'git branch -l feat',
            'git branch --show-current',
            'git branch --merged main',
            'git branch --contains HEAD~3',
            'git branch --sort=-committerdate',
        ]) {
            expect(a(cmd), cmd).toBe(true);
        }
    });

    it('bash-path-confinement: shell spellings that reach outside are refused', () => {
        for (const cmd of [
            'cat .*/etc/passwd',
            'cat src/.?/x',
            'ls [.][.]/other',
            'cat -- -/../../etc/passwd',
            'cat -- --/../../etc/passwd',
            'sort -o --/../../outside src/a',
            'git diff --output --/../../outside',
            'sort -o -x/../../../outside src/a',
            'cat ""/etc/passwd',
            'cat "."/../x',
            'grep -f/etc/patterns src',
            'grep -- -x /etc/passwd',
            'cat ..\\/outside',
            'cat ~root/.profile',
        ]) {
            expect(a(cmd), cmd).toBe(false);
        }
        expect(a('cat -- src/a.ts')).toBe(true);
        expect(a('ls .github')).toBe(true);
    });

    it('bash-path-confinement: a path argument outside the working tree is not category A', () => {
        for (const cmd of [
            'cat ~/.ssh/id_rsa',
            "cat '~/.ssh/id_rsa'",
            'cat "/etc/passwd"',
            'cat /etc/passwd',
            'find / -name x',
            'ls ../../other',
            'head --file=/etc/shadow',
            'grep -rn foo /etc',
        ]) {
            expect(a(cmd), cmd).toBe(false);
        }
        for (const cmd of ['cat src/x.ts', 'cat /repo/src/x.ts', 'ls', 'grep -rn foo src', 'go test ./...', 'git log main..topic']) {
            expect(a(cmd), cmd).toBe(true);
        }
    });

    it('bash-path-confinement: a grep pattern is data, not a path', () => {
        expect(a('grep -rn /api src')).toBe(true);
        expect(a('rg -e /api src')).toBe(true);
        expect(a('grep -rn /api /etc')).toBe(false);
        expect(a('grep -f /etc/patterns src')).toBe(false);
    });

    it('output-flags-are-paths: an output-writing flag sends its target through confinement', () => {
        for (const cmd of [
            'sort -o /home/u/.bashrc /dev/null',
            'sort -o/home/u/.bashrc src/a',
            'sort -o../../x src/a',
            'sort --output=/home/u/.bashrc src/a',
            'git diff --output=/home/u/.bashrc',
            'git diff --output /home/u/.bashrc',
            'find . -fprint /tmp/x',
            'tsc --outDir /tmp/out',
            'tsc --outFile=/tmp/out.js',
            'prettier --write /etc/hosts',
            'eslint --fix /etc',
        ]) {
            expect(a(cmd), cmd).toBe(false);
        }
        for (const cmd of [
            'sort -o out.txt src/a',
            'git diff --output=diff.patch',
            'tsc --outDir dist',
            'prettier --write src',
            'eslint --fix .',
            'find . -fprint list.txt',
        ]) {
            expect(a(cmd), cmd).toBe(true);
        }
    });

    it('output-flags-are-paths: without a root, an outside target is still refused', () => {
        expect(isCategoryABashCommand('sort -o /home/u/.bashrc src/a')).toBe(false);
        expect(isCategoryABashCommand('sort -o ../../x src/a')).toBe(false);
        expect(isCategoryABashCommand('sort -o out.txt src/a')).toBe(true);
    });

    it('reason-names-what-was-checked: the working tree is named only when confinement ran', () => {
        expect(allowOf('cat src/x.ts')?.reason).toContain('inside the working tree');
        const bare = allowOf('pwd');
        expect(bare?.decision).toBe('allow');
        expect(bare?.reason).not.toContain('inside the working tree');
        const todo = _permission_for('pre_tool_use', envelope('TodoRead', {}), 0, ['allow']);
        expect(todo?.decision).toBe('allow');
        expect(todo?.reason).not.toContain('inside the working tree');
        const read = _permission_for('pre_tool_use', envelope('Read', { file_path: '/repo/a' }), 0, ['allow']);
        expect(read?.reason).toContain('inside the working tree');
    });

    it('every D2 row is withheld through _permission_for, every true row still allowed', () => {
        for (const cmd of [
            'git branch -D main',
            'git branch -f main HEAD~20',
            'git branch -M main old',
            'cat ~/.ssh/id_rsa',
            'find / -name x',
            'sort -o /home/u/.bashrc /dev/null',
            'git diff --output=/home/u/.bashrc',
            'prettier --write /etc/hosts',
        ]) {
            expect(allowOf(cmd), cmd).toBeNull();
        }
        for (const cmd of ['git branch', 'git branch -a', 'cat src/x.ts', 'prettier --write src', 'eslint --fix .']) {
            expect(allowOf(cmd)?.decision, cmd).toBe('allow');
        }
    });

    it('bash-path-confinement: an in-tree symlink that points outside is outside', () => {
        // Council review 2026-10-18, round 2: lexical confinement admitted
        // `cat link` where `link` resolves to a file outside the tree.
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-a-'));
        try {
            const tree = path.join(base, 'tree');
            const outside = path.join(base, 'outside');
            fs.mkdirSync(path.join(tree, 'src'), { recursive: true });
            fs.mkdirSync(outside);
            fs.writeFileSync(path.join(outside, 'secret'), 'x');
            fs.writeFileSync(path.join(tree, 'src', 'a.ts'), 'x');
            fs.symlinkSync(path.join(outside, 'secret'), path.join(tree, 'link'));
            fs.symlinkSync(outside, path.join(tree, 'linkdir'));
            fs.symlinkSync(path.join(tree, 'src'), path.join(tree, 'inner'));
            // Round 4: a glob is expanded after the check, so `li*` reaches `link`.
            for (const cmd of [
                'cat link',
                'cat linkdir/secret',
                'sort -o linkdir/new src/a.ts',
                'cat li*',
                'cat l?nk',
                'cat l[i]nk',
                'grep -r x --include=li*',
                'grep li* src',
                'ls src/*.ts',
            ]) {
                expect(isCategoryA('Bash', { command: cmd }, tree), cmd).toBe(false);
            }
            expect(isCategoryA('Read', { file_path: path.join(tree, 'link') }, tree)).toBe(false);
            for (const cmd of [
                'cat src/a.ts',
                'cat inner/a.ts',
                'sort -o src/new.txt src/a.ts',
                "grep -r x --include='*.ts' src",
                'grep -r x --include="*.ts" src',
            ]) {
                expect(isCategoryA('Bash', { command: cmd }, tree), cmd).toBe(true);
            }
            expect(isCategoryA('Read', { file_path: path.join(tree, 'inner', 'a.ts') }, tree)).toBe(true);
            expect(isCategoryA('Bash', { command: 'cat src/missing/new.txt' }, tree)).toBe(true);
        } finally {
            fs.rmSync(base, { recursive: true, force: true });
        }
    });

    it('bash-path-confinement: a symlink that cannot be resolved is not inside', () => {
        // Council review 2026-10-18, round 3: a resolution failure other than
        // a missing suffix must withhold, never fall back to the lexical answer.
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-a-'));
        const locked = path.join(tree, 'locked');
        try {
            fs.symlinkSync('loop', path.join(tree, 'loop'));
            fs.mkdirSync(path.join(locked, 'sub'), { recursive: true });
            fs.chmodSync(locked, 0o000);
            // root reads through mode 000, so the EACCES row needs a non-root user.
            const rows = ['cat loop', 'cat loop/x', ...(process.getuid?.() === 0 ? [] : ['cat locked/sub/x'])];
            for (const cmd of rows) {
                expect(isCategoryA('Bash', { command: cmd }, tree), cmd).toBe(false);
            }
            expect(isCategoryA('Read', { file_path: path.join(tree, 'loop') }, tree)).toBe(false);
        } finally {
            fs.chmodSync(locked, 0o755);
            fs.rmSync(tree, { recursive: true, force: true });
        }
    });
});
