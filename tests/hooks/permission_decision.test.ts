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
